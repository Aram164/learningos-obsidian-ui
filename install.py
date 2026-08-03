#!/usr/bin/env python3
"""Install the LearningOS Obsidian interface into a vault (idempotent).

    python3 install.py                 # into ../repository (the live vault)
    python3 install.py --vault PATH    # into another vault (e.g. fixture-vault)
    python3 install.py --dry-run       # print actions only

What it does (and nothing else):
  1. MERGES the managed safety keys of vault-config/app.json into
     <vault>/.obsidian/app.json (user settings survive; ours win on conflict).
  2. Enables the plugin in <vault>/.obsidian/community-plugins.json.
  3. Copies plugin/  -> <vault>/.obsidian/plugins/learningos-ui/.
  4. Copies bases/*.base -> <vault>/bases/.
  5. VERIFIES (never edits) that the core .gitignore covers .obsidian/,
     /bases/ and /.trash/ — the installer must not touch core-tracked files.
  6. Runs `los.py status` as a smoke test of the CLI gateway.

The UI test suite runs FIRST and a failure aborts the install (CLAUDE.md hard
rule 8). `--skip-tests` exists for machines without Node.

Boundary (core ADR-006): everything written lands at gitignored paths; the
core repository's tracked tree is never modified from here.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PLUGIN_ID = "learningos-ui"


def log(msg: str) -> None:
    print(f"install: {msg}")


def merge_app_json(vault: Path, dry: bool) -> None:
    src = json.loads((HERE / "vault-config" / "app.json").read_text(encoding="utf-8"))
    src.pop("_comment", None)
    target = vault / ".obsidian" / "app.json"
    current = {}
    if target.is_file():
        try:
            current = json.loads(target.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            log(f"WARNING: {target} is not valid JSON — replacing it")
    merged = {**current, **src}
    # union, not clobber, for the ignore filters
    filters = list(dict.fromkeys(
        (current.get("userIgnoreFilters") or []) + src["userIgnoreFilters"]))
    merged["userIgnoreFilters"] = filters
    log(f"app.json: merge {sorted(src)} into {target}")
    if not dry:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(merged, indent=2, sort_keys=True) + "\n",
                          encoding="utf-8")


def enable_plugin(vault: Path, dry: bool) -> None:
    target = vault / ".obsidian" / "community-plugins.json"
    plugins: list[str] = []
    if target.is_file():
        try:
            plugins = json.loads(target.read_text(encoding="utf-8")) or []
        except json.JSONDecodeError:
            log(f"WARNING: {target} invalid — rewriting")
    if PLUGIN_ID not in plugins:
        plugins.append(PLUGIN_ID)
    log(f"community-plugins.json: {plugins}")
    if not dry:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(plugins, indent=2) + "\n", encoding="utf-8")


def copy_tree(src: Path, dst: Path, pattern: str, dry: bool) -> None:
    files = sorted(src.glob(pattern))
    if not files:
        sys.exit(f"install: nothing matches {src}/{pattern} — broken checkout")
    log(f"copy {len(files)} file(s): {src.name}/{pattern} -> {dst}")
    if not dry:
        dst.mkdir(parents=True, exist_ok=True)
        for f in files:
            shutil.copy2(f, dst / f.name)


def verify_gitignore(vault: Path) -> None:
    gi = vault / ".gitignore"
    text = gi.read_text(encoding="utf-8") if gi.is_file() else ""
    missing = [p for p in (".obsidian/", "/bases/", "/.trash/") if p not in text]
    if missing:
        log(f"WARNING: core .gitignore lacks {missing} — add them CORE-side "
            "(the installer never edits tracked core files)")
    else:
        log(".gitignore covers .obsidian/, /bases/, /.trash/ ✓")


def run_ui_tests() -> None:
    """Hard rule 8: UI tests run before installation, failures abort."""
    suite = HERE / "tests" / "test-dashboard.js"
    if not suite.is_file():
        log("WARNING: tests/test-dashboard.js missing — installing untested")
        return
    if shutil.which("node") is None:
        log("WARNING: node not found — skipping UI tests (install with --skip-tests "
            "to silence this)")
        return
    proc = subprocess.run(["node", str(suite)], cwd=HERE,
                          capture_output=True, text=True, timeout=120)
    if proc.returncode != 0:
        print(proc.stdout)
        sys.exit("install: UI tests FAILED — nothing was written (hard rule 8)")
    passed = proc.stdout.count("  ok   ")
    log(f"UI tests ✓  ({passed} checks, fixture vault)")


def smoke_test_cli(vault: Path) -> None:
    los = vault / "tools" / "los.py"
    if not los.is_file():
        log("NOTE: tools/los.py not found (fixture vault?) — skipping CLI smoke test")
        return
    venv = vault / ".venv" / "bin" / "python"
    python = str(venv) if venv.is_file() else sys.executable
    proc = subprocess.run([python, str(los), "status"], cwd=vault,
                          capture_output=True, text=True, timeout=180)
    if proc.returncode == 0:
        log("CLI smoke test ✓  (los.py status)")
    else:
        log("WARNING: `los.py status` failed — the plugin's rebuild/validate/"
            "status buttons need Python deps. Fix on the Mac with:\n"
            f"  cd {vault} && make setup\n{proc.stderr.strip()[:300]}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--vault", default=None,
                    help="vault root (default: ../repository next to obsidian-ui/)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--skip-tests", action="store_true",
                    help="skip the Node UI test suite (not recommended)")
    args = ap.parse_args()

    if not args.skip_tests:
        run_ui_tests()

    vault = Path(args.vault).resolve() if args.vault \
        else (HERE.parent / "repository").resolve()
    if not vault.is_dir():
        sys.exit(f"install: vault not found: {vault}")
    is_live = (vault / "system" / "ARCHITECTURE.md").is_file()
    log(f"vault: {vault} ({'LIVE LearningOS repository' if is_live else 'fixture/other'})")

    merge_app_json(vault, args.dry_run)
    enable_plugin(vault, args.dry_run)
    copy_tree(HERE / "plugin", vault / ".obsidian" / "plugins" / PLUGIN_ID,
              "*", args.dry_run)
    copy_tree(HERE / "bases", vault / "bases", "*.base", args.dry_run)
    verify_gitignore(vault)
    if not args.dry_run:
        smoke_test_cli(vault)

    log("done. Open the vault in Obsidian; if it asks, turn OFF Restricted "
        "mode to activate the LearningOS UI plugin. If Obsidian is already "
        "running, reload it (Cmd+R) to pick up a new plugin build. The "
        "dashboard is the home view on every launch — behaviour toggles live "
        "in Settings → LearningOS UI (generated/reading-room.md stays the "
        "plain-text fallback for other editors).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
