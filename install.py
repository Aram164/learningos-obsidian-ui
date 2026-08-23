#!/usr/bin/env python3
"""Install the LearningOS Obsidian interface into a vault (idempotent).

    python3 install.py                 # into ../repository (the live vault)
    python3 install.py --vault PATH    # into another vault (e.g. fixture-vault)
    python3 install.py --dry-run       # print actions only
    python3 install.py --ecosystem     # + pinned AI/search/OCR/PDF plugins

What it does (and nothing else):
  1. MERGES the managed safety keys of vault-config/app.json into
     <vault>/.obsidian/app.json (user settings survive; ours win on conflict).
  1b. MERGES the managed core-plugin states of vault-config/core-plugins.json
     (Web Viewer on, Daily Notes off, …) — unnamed core plugins are untouched.
  2. Enables the LearningOS plugin (and curated ecosystem when requested).
  3. Copies plugin/  -> <vault>/.obsidian/plugins/learningos-ui/.
  4. Copies bases/*.base -> <vault>/bases/.
  5. VERIFIES (never edits) that the core .gitignore covers .obsidian/,
     /bases/ and /.trash/ — the installer must not touch core-tracked files.
  6. Optionally downloads checksum-pinned Agentic Copilot, Omnisearch, Text
     Extractor, and PDF++; MERGES LearningOS safety/indexing keys while keeping
     other plugin preferences.
  7. Runs `los.py status` as a smoke test of the CLI gateway.

The UI test suite runs FIRST and a failure aborts the install (CLAUDE.md hard
rule 8). Missing Node is a hard failure unless `--skip-tests` is explicitly
chosen; `--node /absolute/path` supports bundled runtimes.

Boundary (core ADR-006): everything written lands at gitignored paths; the
core repository's tracked tree is never modified from here.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import urllib.request
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


def merge_core_plugins(vault: Path, dry: bool) -> None:
    """Merge the managed CORE-plugin states. Only the keys we name are touched;
    every other core plugin keeps whatever Aram set. Rationale per key lives in
    vault-config/core-plugins.json."""
    src = json.loads((HERE / "vault-config" / "core-plugins.json").read_text(encoding="utf-8"))
    managed = {k: v for k, v in src.items() if not k.startswith("_")}
    target = vault / ".obsidian" / "core-plugins.json"
    current = {}
    if target.is_file():
        try:
            current = json.loads(target.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            log(f"WARNING: {target} is not valid JSON — replacing it")
    changed = {k: v for k, v in managed.items() if current.get(k) != v}
    merged = {**current, **managed}
    log(f"core-plugins.json: {len(managed)} managed key(s), "
        f"{len(changed)} changed{': ' + ', '.join(f'{k}={v}' for k, v in changed.items()) if changed else ''}")
    if not dry:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(merged, indent=2, sort_keys=True) + "\n",
                          encoding="utf-8")


def enable_plugins(vault: Path, dry: bool, extra: list[str] | None = None) -> None:
    target = vault / ".obsidian" / "community-plugins.json"
    plugins: list[str] = []
    if target.is_file():
        try:
            plugins = json.loads(target.read_text(encoding="utf-8")) or []
        except json.JSONDecodeError:
            log(f"WARNING: {target} invalid — rewriting")
    for plugin_id in [PLUGIN_ID, *(extra or [])]:
        if plugin_id not in plugins:
            plugins.append(plugin_id)
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


def node_candidates() -> list[Path]:
    """Where a Node binary plausibly lives on this machine, best first.

    A GUI-launched or bare shell often has none of these on PATH, so refusing
    the install because `which node` came back empty is a false negative. The
    installer looks in the usual places itself rather than making the caller
    paste an absolute path (which is how a cache directory ended up hardcoded
    in the README).
    """
    found: list[Path] = []
    which = shutil.which("node")
    if which:
        found.append(Path(which))
    found += [Path("/opt/homebrew/bin/node"),          # Homebrew, Apple silicon
              Path("/usr/local/bin/node"),             # Homebrew, Intel / manual
              Path("/usr/bin/node")]                   # system / Linux
    # nvm and Volta keep versioned trees; take the highest version present.
    for root, glob in ((Path.home() / ".nvm" / "versions" / "node", "*/bin/node"),
                       (Path.home() / ".volta" / "tools" / "image" / "node", "*/bin/node")):
        if root.is_dir():
            found += sorted(root.glob(glob), reverse=True)
    # Bundled agent runtimes (the path this project's README used to hardcode).
    runtimes = Path.home() / ".cache" / "codex-runtimes"
    if runtimes.is_dir():
        found += sorted(runtimes.glob("*/dependencies/node/bin/node"), reverse=True)
    return found


def resolve_node(explicit: str | None) -> str:
    if explicit:
        if not Path(explicit).is_file():
            sys.exit(f"install: --node {explicit} is not a file")
        return explicit
    for candidate in node_candidates():
        if candidate.is_file():
            return str(candidate)
    sys.exit("install: Node not found — refusing an untested install.\n"
             "  Looked in: PATH, /opt/homebrew/bin, /usr/local/bin, /usr/bin, "
             "~/.nvm, ~/.volta, ~/.cache/codex-runtimes.\n"
             "  Pass --node /absolute/path/to/node, or explicitly use --skip-tests.")


def run_ui_tests(node: str | None = None) -> None:
    """Hard rule 8: runtime fixture tests run before installation."""
    suites = [
        HERE / "tests" / "test-dashboard.js",
        HERE / "tests" / "test-ai-actions.js",
    ]
    missing = [suite.name for suite in suites if not suite.is_file()]
    if missing:
        sys.exit(
            f"install: missing required UI suite(s) {missing} — nothing was written.\n"
            "  Restore the test files, or explicitly use --skip-tests."
        )
    node_bin = resolve_node(node)
    log(f"node: {node_bin}")
    build = subprocess.run([node_bin, str(HERE / "build.mjs")], cwd=HERE,
                           capture_output=True, text=True, timeout=120)
    if build.returncode != 0:
        print(build.stdout)
        print(build.stderr, file=sys.stderr)
        sys.exit("install: UI build FAILED — nothing was written")
    passed = 0
    for suite in suites:
        proc = subprocess.run([node_bin, str(suite)], cwd=HERE,
                              capture_output=True, text=True, timeout=120)
        if proc.returncode != 0:
            print(proc.stdout)
            print(proc.stderr, file=sys.stderr)
            sys.exit(f"install: {suite.name} FAILED — nothing was written (hard rule 8)")
        passed += proc.stdout.count("  ok   ")
    log(f"UI build + tests ✓  ({passed} checks, fixture vault, {len(suites)} suites)")


def merge_plugin_settings(vault: Path, plugin_id: str, config_name: str,
                          dry: bool, extra: dict | None = None) -> None:
    """Merge only LearningOS-managed keys into a community plugin's data.

    A plugin upgrade or reinstall must never erase unrelated user preferences.
    """
    src = json.loads((HERE / "vault-config" / config_name).read_text(encoding="utf-8"))
    src.pop("_comment", None)
    if extra:
        src.update(extra)
    target = vault / ".obsidian" / "plugins" / plugin_id / "data.json"
    current = {}
    if target.is_file():
        try:
            current = json.loads(target.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            log(f"WARNING: {target} invalid — replacing plugin settings")
    merged = {**current, **src}
    changed = [key for key, value in src.items() if current.get(key) != value]
    log(f"ecosystem config: {plugin_id}: {len(src)} managed key(s), "
        f"{len(changed)} changed{': ' + ', '.join(changed) if changed else ''}")
    if not dry:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(merged, indent=2, sort_keys=True) + "\n",
                          encoding="utf-8")


def install_ecosystem(vault: Path, dry: bool) -> list[str]:
    """Install pinned, checksum-verified plugins that serve the learning flow."""
    spec = json.loads((HERE / "ecosystem-plugins.json").read_text(encoding="utf-8"))
    installed: list[str] = []
    for plugin in spec["plugins"]:
        plugin_id = plugin["id"]
        dest = vault / ".obsidian" / "plugins" / plugin_id
        log(f"ecosystem: {plugin['name']} {plugin['version']} ({plugin['purpose']})")
        installed.append(plugin_id)
        if dry:
            continue
        dest.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix=f"learningos-{plugin_id}-") as tmp:
            tmp_dir = Path(tmp)
            for filename, meta in plugin["files"].items():
                existing = dest / filename
                if existing.is_file() and hashlib.sha256(existing.read_bytes()).hexdigest() \
                        == meta["sha256"]:
                    continue
                request = urllib.request.Request(
                    meta["url"], headers={"User-Agent": "LearningOS-Obsidian-installer/1"})
                with urllib.request.urlopen(request, timeout=90) as response:
                    content = response.read()
                actual = hashlib.sha256(content).hexdigest()
                if actual != meta["sha256"]:
                    sys.exit(f"install: checksum mismatch for {plugin_id}/{filename}: "
                             f"expected {meta['sha256']}, got {actual}")
                staged = tmp_dir / filename
                staged.write_bytes(content)
                shutil.copy2(staged, existing)
    wrapper = vault / "tools" / "codex_obsidian.py"
    if not dry and not wrapper.is_file():
        sys.exit(f"install: Agentic Copilot needs {wrapper}")
    merge_plugin_settings(vault, "agentic-copilot", "agentic-copilot.json", dry,
                          {"customBinaryPath": str(wrapper)})
    merge_plugin_settings(vault, "omnisearch", "omnisearch.json", dry)
    merge_plugin_settings(vault, "text-extractor", "text-extractor.json", dry)
    merge_plugin_settings(vault, "pdf-plus", "pdf-plus.json", dry)
    return installed


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
    ap.add_argument("--node", default=None,
                    help="absolute Node executable for the UI test gate")
    ap.add_argument("--ecosystem", action="store_true",
                    help="install pinned Agentic Copilot, Omnisearch, Text Extractor, and PDF++")
    args = ap.parse_args()

    if not args.skip_tests:
        run_ui_tests(args.node)

    vault = Path(args.vault).resolve() if args.vault \
        else (HERE.parent / "repository").resolve()
    if not vault.is_dir():
        sys.exit(f"install: vault not found: {vault}")
    is_live = (vault / "system" / "ARCHITECTURE.md").is_file()
    log(f"vault: {vault} ({'LIVE LearningOS repository' if is_live else 'fixture/other'})")

    merge_app_json(vault, args.dry_run)
    merge_core_plugins(vault, args.dry_run)
    ecosystem_ids = install_ecosystem(vault, args.dry_run) if args.ecosystem else []
    enable_plugins(vault, args.dry_run, ecosystem_ids)
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
