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
  3. Copies exactly the files declared in plugin-assets.json
     -> <vault>/.obsidian/plugins/learningos-ui/, verifying each by sha256.
     Before any vault file is touched it refuses the whole install if that
     directory holds an entry the manifest does not account for, and it never
     deletes, moves, or quarantines such an entry.
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
import fcntl
import hashlib
import json
import os
import re
import secrets
import shutil
import stat
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
PLUGIN_ID = "learningos-ui"

MANIFEST_KEYS = {"schema_version", "type", "shipped", "vault_owned"}
MANIFEST_TYPE = "learningos-ui-plugin-assets"
INSTALL_TRANSACTION = ".learningos-ui-install-transaction.json"
INSTALL_TRANSACTION_TYPE = "learningos-ui-install-transaction"
INSTALL_PLAN = "plan.json"
INSTALL_PLAN_TYPE = "learningos-ui-install-plan"
INSTALL_WORKSPACE_PREFIX = f".{PLUGIN_ID}-install-"


def log(msg: str) -> None:
    print(f"install: {msg}")


class PluginAssetsError(Exception):
    """A plugin install invariant could not be proven."""


class PluginRecoveryError(PluginAssetsError):
    """Recovery changed live state or transaction evidence before failing."""


class IncompleteTransactionMarker(PluginAssetsError):
    """The marker owner died before publishing one complete JSON document."""


def _check_names(values: object, field: str) -> list[str]:
    if not isinstance(values, list) or not values:
        raise PluginAssetsError(f"{field} must be a non-empty array")
    for value in values:
        if not isinstance(value, str) or not value.strip():
            raise PluginAssetsError(f"{field} entries must be non-empty strings")
        if "/" in value or "\\" in value:
            raise PluginAssetsError(f"{field} entry {value!r} must be a bare filename")
        if value in {".", ".."}:
            raise PluginAssetsError(f"{field} entry {value!r} is a path component")
    if len(set(values)) != len(values):
        raise PluginAssetsError(f"{field} repeats an entry")
    return values


def read_plugin_assets(here: Path = HERE) -> tuple[list[str], list[str]]:
    """The one declaration of what this repository ships into a vault.

    It used to be a `plugin/*` wildcard here, an array in
    `scripts/check-install-current.mjs`, and a copy of that array in the test
    suite. A wildcard ships whatever happens to be in the directory, and three
    lists that must agree eventually do not — quietly, and in the direction
    where a file is copied that nothing afterwards checks.
    """
    file = here / "plugin-assets.json"
    try:
        parsed = json.loads(file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PluginAssetsError(f"plugin-assets.json could not be read: {exc}") from exc
    if not isinstance(parsed, dict):
        raise PluginAssetsError("plugin-assets.json is not an object")
    if set(parsed) != MANIFEST_KEYS:
        raise PluginAssetsError(
            "plugin-assets.json must carry exactly "
            f"{', '.join(sorted(MANIFEST_KEYS))} (got {', '.join(sorted(parsed)) or 'nothing'})"
        )
    # bool is a subclass of int in Python, so `True == 1`.  JSON `true` is not
    # schema version 1 and the Node reader already rejects it.
    if type(parsed["schema_version"]) is not int or parsed["schema_version"] != 1:
        raise PluginAssetsError(
            f"unsupported plugin-assets schema_version {parsed['schema_version']!r}")
    if parsed["type"] != MANIFEST_TYPE:
        raise PluginAssetsError(f"unsupported plugin-assets type {parsed['type']!r}")
    shipped = _check_names(parsed["shipped"], "shipped")
    vault_owned = _check_names(parsed["vault_owned"], "vault_owned")
    overlap = sorted(set(shipped) & set(vault_owned))
    if overlap:
        raise PluginAssetsError(
            f"{', '.join(overlap)} cannot be both shipped and vault-owned")
    return shipped, vault_owned


def shipped_file_problem(path: Path) -> str | None:
    """A shipped source must be a real, present, regular file — never a link."""
    try:
        stat = path.lstat()
    except OSError:
        return "is missing"
    if Path(path).is_symlink():
        return "is a symlink"
    from stat import S_ISDIR, S_ISREG
    if S_ISDIR(stat.st_mode):
        return "is a directory"
    if not S_ISREG(stat.st_mode):
        return "is not a regular file"
    return None


def directory_problem(path: Path, *, missing_ok: bool = False) -> str | None:
    """A managed directory must be a real directory, never an indirection."""
    try:
        stat = path.lstat()
    except FileNotFoundError:
        return None if missing_ok else "is missing"
    except OSError as exc:
        return f"cannot be inspected: {exc}"
    if path.is_symlink():
        return "is a symlink"
    from stat import S_ISDIR
    if not S_ISDIR(stat.st_mode):
        return "is not a directory"
    return None


def optional_regular_file_problem(path: Path) -> str | None:
    """An absent managed file is fine; an existing one must be a real file."""
    if not path.exists() and not path.is_symlink():
        return None
    return shipped_file_problem(path)


def unknown_installed_entries(directory: Path, owned: set[str]) -> list[Path]:
    """Everything in the installed plugin directory the manifest cannot explain.

    Returned, never touched. An installer that deletes what it does not
    recognise is a worse failure than one that stops: the file it removes may
    be the only copy of something, and "unexpected" is not "disposable".
    """
    if not directory.is_dir():
        return []
    return sorted(entry for entry in directory.iterdir() if entry.name not in owned)


def preflight_plugin_directory(vault: Path, *, recover: bool = True) -> None:
    """Refuse the whole install before new configuration is written.

    Order matters here and is the reason this is a separate step: the installer
    merges `app.json`, core-plugin state and community-plugin enablement before
    it copies anything, so a refusal discovered at copy time would already have
    changed the learner's vault settings. A real install may first complete a
    fully recorded rollback left by a killed prior install; a dry run never does.
    """
    shipped, vault_owned = read_plugin_assets()
    source_dir = HERE / "plugin"
    source_problem = directory_problem(source_dir)
    if source_problem:
        sys.exit(
            f"install: plugin/ {source_problem}; refusing a build source that is "
            "missing, misshapen, or indirect. Nothing was written."
        )
    broken = [(name, shipped_file_problem(HERE / "plugin" / name)) for name in shipped]
    broken = [(name, problem) for name, problem in broken if problem]
    if broken:
        sys.exit("install: this checkout cannot ship a complete plugin:\n"
                 + "\n".join(f"  plugin/{name} {problem}" for name, problem in broken)
                 + "\n  Run `npm run build` first; nothing was written.")
    surplus = unknown_installed_entries(HERE / "plugin", set(shipped))
    if surplus:
        sys.exit("install: plugin/ holds files the shipping manifest does not declare:\n"
                 + "\n".join(f"  {entry}" for entry in surplus)
                 + "\n  Declare them in plugin-assets.json or remove them; nothing"
                   " undeclared is shipped. Nothing was written.")
    obsidian = vault / ".obsidian"
    plugins = obsidian / "plugins"
    installed = plugins / PLUGIN_ID
    bases = vault / "bases"
    for directory in (obsidian, plugins, installed, bases):
        problem = directory_problem(directory, missing_ok=True)
        if problem:
            sys.exit(
                f"install: {directory} {problem}; managed install directories must "
                "be real directories inside the vault. Nothing was written."
            )
    managed_files = [
        obsidian / "app.json",
        obsidian / "core-plugins.json",
        obsidian / "community-plugins.json",
    ]
    base_source = HERE / "bases"
    source_problem = directory_problem(base_source)
    if source_problem:
        sys.exit(f"install: {base_source} {source_problem}; nothing was written.")
    base_files = sorted(base_source.glob("*.base"))
    if not base_files:
        sys.exit(f"install: nothing matches {base_source}/*.base; nothing was written.")
    source_file_problems = [
        (path, shipped_file_problem(path)) for path in base_files
    ]
    source_file_problems = [row for row in source_file_problems if row[1]]
    if source_file_problems:
        sys.exit(
            "install: the bases source contains an indirect or misshapen file:\n"
            + "\n".join(f"  {path} {problem}" for path, problem in source_file_problems)
            + "\n  Nothing was written."
        )
    managed_files.extend(bases / path.name for path in base_files)
    managed_problems = [
        (path, optional_regular_file_problem(path)) for path in managed_files
    ]
    managed_problems = [row for row in managed_problems if row[1]]
    if managed_problems:
        sys.exit(
            "install: a managed vault file is indirect or misshapen:\n"
            + "\n".join(f"  {path} {problem}" for path, problem in managed_problems)
            + "\n  Nothing was written."
        )
    unknown = unknown_installed_entries(installed, set(shipped) | set(vault_owned))
    misshapen = [
        (name, shipped_file_problem(installed / name))
        for name in [*shipped, *vault_owned]
        if (installed / name).exists() or (installed / name).is_symlink()
    ]
    misshapen = [(name, problem) for name, problem in misshapen if problem]
    if unknown or misshapen:
        lines = [f"  {entry}" for entry in unknown]
        lines += [f"  {installed / name} {problem} (expected a regular file)"
                  for name, problem in misshapen]
        sys.exit(
            "install: the installed plugin directory holds entries this build does "
            "not own:\n" + "\n".join(lines)
            + "\n  Nothing was written, and nothing was deleted, moved, or quarantined."
            "\n  Review each path yourself, then run the installer again."
        )
    # Recovery is deliberately last. Once it succeeds, no later preflight
    # refusal may claim the vault was untouched when recovery restored bytes or
    # retired transaction evidence.
    journal = plugins / INSTALL_TRANSACTION
    if journal.exists() or journal.is_symlink():
        if not recover:
            raise PluginAssetsError(
                f"an interrupted plugin install is recorded at {journal}; "
                "dry-run will not alter or recover it"
            )
        recover_interrupted_install(plugins, installed, shipped)


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


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _copy_regular_file(source: Path, destination: Path) -> None:
    """Create one staged file without following a destination link."""
    with source.open("rb") as incoming, destination.open("xb") as outgoing:
        shutil.copyfileobj(incoming, outgoing)
        outgoing.flush()
        os.fsync(outgoing.fileno())
    shutil.copystat(source, destination, follow_symlinks=False)


def _sync_directory(directory: Path) -> None:
    descriptor = os.open(directory, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def _write_json_exclusive(path: Path, payload: dict):
    """Create and lock one marker without replacing another installer's.

    The returned handle deliberately remains open for the whole transaction.
    `O_EXCL` chooses one installer; `flock` lets a later preflight distinguish
    that live owner from residue left by a process that was killed.
    """
    encoded = (json.dumps(payload, indent=2, sort_keys=True) + "\n").encode("utf-8")
    flags = os.O_RDWR | os.O_CREAT | os.O_EXCL
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    descriptor = os.open(path, flags, 0o600)
    handle = None
    try:
        fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
        handle = os.fdopen(descriptor, "r+b")
        descriptor = -1
        handle.write(encoded)
        handle.flush()
        os.fsync(handle.fileno())
        return handle
    except Exception:
        if handle is not None:
            handle.close()
        if descriptor >= 0:
            os.close(descriptor)
        path.unlink(missing_ok=True)
        raise


def _write_json_durable(path: Path, payload: dict) -> None:
    encoded = (json.dumps(payload, indent=2, sort_keys=True) + "\n").encode("utf-8")
    with path.open("xb") as handle:
        handle.write(encoded)
        handle.flush()
        os.fsync(handle.fileno())


def _hash_or_missing(path: Path) -> str | None:
    if not path.exists() and not path.is_symlink():
        return None
    problem = shipped_file_problem(path)
    if problem:
        raise PluginAssetsError(f"{path} {problem}; refusing transaction recovery")
    return _sha256(path)


def _transaction_payload(
    workspace: str,
    shipped: list[str],
    old_hashes: dict[str, str | None],
    new_hashes: dict[str, str],
) -> dict:
    return {
        "schema_version": 1,
        "type": INSTALL_TRANSACTION_TYPE,
        "plugin_id": PLUGIN_ID,
        "workspace": workspace,
        "shipped": shipped,
        "old_sha256": old_hashes,
        "new_sha256": new_hashes,
    }


def _plan_payload(
    shipped: list[str],
    old_hashes: dict[str, str | None],
    new_hashes: dict[str, str],
) -> dict:
    return {
        "schema_version": 1,
        "type": INSTALL_PLAN_TYPE,
        "shipped": shipped,
        "old_sha256": old_hashes,
        "new_sha256": new_hashes,
    }


def _valid_sha256(value: object) -> bool:
    return isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value) is not None


def _validate_hash_map(
    value: object,
    shipped: list[str],
    *,
    missing_allowed: bool,
    label: str,
) -> dict[str, str | None]:
    if not isinstance(value, dict) or set(value) != set(shipped):
        raise PluginAssetsError(f"interrupted transaction has an invalid {label} map")
    for name in shipped:
        digest = value[name]
        if not (_valid_sha256(digest) or (missing_allowed and digest is None)):
            raise PluginAssetsError(
                f"interrupted transaction has an invalid {label} digest for {name}"
            )
    return value


def _read_transaction(handle, shipped: list[str]) -> dict:
    try:
        handle.seek(0)
        payload = json.load(handle)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise IncompleteTransactionMarker(
            f"interrupted transaction marker is unreadable: {exc}"
        ) from exc
    expected = {
        "schema_version", "type", "plugin_id", "workspace", "shipped",
        "old_sha256", "new_sha256",
    }
    if not isinstance(payload, dict) or set(payload) != expected:
        raise PluginAssetsError("interrupted transaction marker has an invalid shape")
    if (type(payload["schema_version"]) is not int
            or payload["schema_version"] != 1
            or payload["type"] != INSTALL_TRANSACTION_TYPE
            or payload["plugin_id"] != PLUGIN_ID
            or payload["shipped"] != shipped):
        raise PluginAssetsError("interrupted transaction marker does not match this installer")
    workspace = payload["workspace"]
    if (not isinstance(workspace, str)
            or re.fullmatch(
                re.escape(INSTALL_WORKSPACE_PREFIX) + r"[0-9a-f]{24}", workspace,
            ) is None):
        raise PluginAssetsError("interrupted transaction names an unsafe workspace")
    _validate_hash_map(
        payload["old_sha256"], shipped, missing_allowed=True, label="old_sha256",
    )
    _validate_hash_map(
        payload["new_sha256"], shipped, missing_allowed=False, label="new_sha256",
    )
    return payload


def _read_plan(path: Path, transaction: dict, shipped: list[str]) -> None:
    problem = shipped_file_problem(path)
    if problem:
        raise PluginAssetsError(f"interrupted transaction {path} {problem}")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PluginAssetsError(f"interrupted transaction plan is unreadable: {exc}") from exc
    expected = {"schema_version", "type", "shipped", "old_sha256", "new_sha256"}
    if not isinstance(payload, dict) or set(payload) != expected:
        raise PluginAssetsError("interrupted transaction plan has an invalid shape")
    if (type(payload["schema_version"]) is not int
            or payload["schema_version"] != 1
            or payload["type"] != INSTALL_PLAN_TYPE
            or payload["shipped"] != shipped
            or payload["old_sha256"] != transaction["old_sha256"]
            or payload["new_sha256"] != transaction["new_sha256"]):
        raise PluginAssetsError("interrupted transaction plan does not match its marker")


def _validate_transaction_workspace(workspace: Path, shipped: list[str]) -> None:
    """Prove every recursively removed entry belongs to this transaction."""
    if not workspace.exists() and not workspace.is_symlink():
        return
    problem = directory_problem(workspace)
    if problem:
        raise PluginAssetsError(f"transaction workspace {workspace} {problem}")
    allowed_top = {"staged", "backups", INSTALL_PLAN}
    unexpected_top = [entry for entry in workspace.iterdir() if entry.name not in allowed_top]
    if unexpected_top:
        raise PluginAssetsError(
            "transaction workspace contains unowned entries: "
            + ", ".join(str(entry) for entry in sorted(unexpected_top))
        )
    for directory_name in ("staged", "backups"):
        directory = workspace / directory_name
        if not directory.exists() and not directory.is_symlink():
            continue
        directory_issue = directory_problem(directory)
        if directory_issue:
            raise PluginAssetsError(
                f"transaction workspace {directory} {directory_issue}"
            )
        unexpected = [entry for entry in directory.iterdir() if entry.name not in shipped]
        misshapen = [
            (entry, shipped_file_problem(entry))
            for entry in directory.iterdir() if entry.name in shipped
        ]
        misshapen = [(entry, issue) for entry, issue in misshapen if issue]
        if unexpected or misshapen:
            details = [str(entry) for entry in sorted(unexpected)]
            details.extend(f"{entry} {issue}" for entry, issue in misshapen)
            raise PluginAssetsError(
                "transaction workspace contains unowned or misshapen entries: "
                + ", ".join(details)
            )
    plan = workspace / INSTALL_PLAN
    if plan.exists() or plan.is_symlink():
        plan_issue = shipped_file_problem(plan)
        if plan_issue:
            raise PluginAssetsError(f"transaction workspace {plan} {plan_issue}")


def _finish_install_transaction(
    journal: Path,
    workspace: Path,
    parent: Path,
    shipped: list[str],
) -> None:
    """Remove recoverable evidence only after the live set is fully old or new."""
    _validate_transaction_workspace(workspace, shipped)
    if workspace.exists() or workspace.is_symlink():
        shutil.rmtree(workspace)
        _sync_directory(parent)
    journal.unlink()
    _sync_directory(parent)


def _prepare_install_workspace(workspace: Path) -> tuple[Path, Path]:
    workspace.mkdir(mode=0o700)
    staged = workspace / "staged"
    backups = workspace / "backups"
    staged.mkdir()
    backups.mkdir()
    return staged, backups


def recover_interrupted_install(parent: Path, dst: Path, shipped: list[str]) -> None:
    """Validate and deterministically finish or roll back a killed promotion."""
    journal = parent / INSTALL_TRANSACTION
    problem = shipped_file_problem(journal)
    if problem:
        raise PluginAssetsError(f"interrupted transaction marker {journal} {problem}")
    flags = os.O_RDWR | getattr(os, "O_NONBLOCK", 0)
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    descriptor = os.open(journal, flags)
    try:
        if not stat.S_ISREG(os.fstat(descriptor).st_mode):
            raise PluginAssetsError(
                f"interrupted transaction marker {journal} is not a regular file"
            )
        handle = os.fdopen(descriptor, "r+b")
        descriptor = -1
    finally:
        if descriptor >= 0:
            os.close(descriptor)
    try:
        try:
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise PluginAssetsError(
                f"another plugin install still owns {journal}; refusing concurrent recovery"
            ) from exc
        try:
            transaction = _read_transaction(handle, shipped)
        except IncompleteTransactionMarker:
            # The fixed marker is published before any workspace or live-file
            # operation. If its owner died during that first write, no valid
            # transaction workspace can exist and removing the incomplete
            # reserved marker is safe. A workspace means the invariant cannot
            # be proven, so preserve everything for review.
            workspace_pattern = re.compile(
                re.escape(INSTALL_WORKSPACE_PREFIX) + r"[0-9a-f]{24}"
            )
            workspaces = [
                entry for entry in parent.iterdir()
                if workspace_pattern.fullmatch(entry.name)
            ]
            if workspaces:
                raise
            try:
                journal.unlink()
                _sync_directory(parent)
            except OSError as exc:
                raise PluginRecoveryError(
                    f"incomplete transaction marker cleanup failed at {journal}: {exc}"
                ) from exc
            log("recovered interrupted plugin install: removed incomplete marker ✓")
            return
        workspace = parent / transaction["workspace"]
        _validate_transaction_workspace(workspace, shipped)
        old_hashes = transaction["old_sha256"]
        new_hashes = transaction["new_sha256"]
        current_hashes = {name: _hash_or_missing(dst / name) for name in shipped}
        unknown = [
            name for name in shipped
            if current_hashes[name] not in {old_hashes[name], new_hashes[name]}
        ]
        if unknown:
            raise PluginAssetsError(
                "interrupted transaction cannot account for the current bytes of "
                + ", ".join(unknown)
            )
        all_old = all(current_hashes[name] == old_hashes[name] for name in shipped)
        all_new = all(current_hashes[name] == new_hashes[name] for name in shipped)
        plan = workspace / INSTALL_PLAN

        if all_old or all_new:
            try:
                _finish_install_transaction(journal, workspace, parent, shipped)
            except OSError as exc:
                raise PluginRecoveryError(
                    "live plugin assets are complete, but interrupted transaction "
                    f"cleanup failed; inspect {journal}: {exc}"
                ) from exc
            state = "previous" if all_old and not all_new else "promoted"
            log(f"recovered interrupted plugin install: verified {state} asset set ✓")
            return
        if not plan.exists() and not plan.is_symlink():
            raise PluginAssetsError(
                "interrupted transaction is mixed but has no verified rollback plan"
            )
        _read_plan(plan, transaction, shipped)

        backups = workspace / "backups"
        backups_problem = directory_problem(backups)
        if backups_problem:
            raise PluginAssetsError(
                f"interrupted transaction backups {backups} {backups_problem}"
            )
        # Validate every backup before changing the first live file. A corrupt
        # later backup must not turn a recoverable mixed set into a different
        # partially restored set.
        actions: list[tuple[str, Path | None]] = []
        for name in reversed(shipped):
            if current_hashes[name] == old_hashes[name]:
                continue
            if old_hashes[name] is None:
                actions.append((name, None))
                continue
            backup = backups / name
            backup_problem = shipped_file_problem(backup)
            if backup_problem or _sha256(backup) != old_hashes[name]:
                raise PluginAssetsError(
                    f"backup is not the recorded previous {name}; no recovery file changed"
                )
            actions.append((name, backup))

        rollback_failures: list[str] = []
        changed: list[str] = []
        for name, backup in actions:
            try:
                if backup is None:
                    (dst / name).unlink()
                else:
                    os.replace(backup, dst / name)
                changed.append(name)
            except OSError:
                rollback_failures.append(name)
                break
        try:
            _sync_directory(dst)
        except OSError:
            rollback_failures.append("plugin directory durability")
        try:
            restored = {name: _hash_or_missing(dst / name) for name in shipped}
            rollback_failures.extend(
                name for name in shipped
                if restored[name] != old_hashes[name] and name not in rollback_failures
            )
        except PluginAssetsError:
            rollback_failures.append("live plugin shape")
        if rollback_failures:
            error_type = PluginRecoveryError if changed else PluginAssetsError
            changed_detail = (
                f"; restored {', '.join(changed)} before the failure"
                if changed else "; no recovery file changed"
            )
            raise error_type(
                "interrupted transaction rollback is incomplete for "
                + ", ".join(sorted(set(rollback_failures)))
                + changed_detail
                + f"; evidence retained at {journal}"
            )
        try:
            _finish_install_transaction(journal, workspace, parent, shipped)
        except (OSError, PluginAssetsError) as exc:
            raise PluginRecoveryError(
                "the previous plugin asset set was restored, but transaction "
                f"cleanup failed; evidence remains at {journal}: {exc}"
            ) from exc
        log("recovered interrupted plugin install: previous asset set restored ✓")
    finally:
        handle.close()


def copy_shipped_plugin(dst: Path, shipped: list[str], dry: bool) -> None:
    """Stage and verify the complete build before promoting any live asset.

    Promotion replaces names rather than writing through them, keeps
    vault-owned `data.json` in place, and rolls ordinary failures back to the
    byte-for-byte previous set.  A durable marker is written before the first
    promotion; if the process is killed, both this installer and the status
    checker refuse to call the mixed state current. The next installer verifies
    the recorded hashes and either accepts the complete new set or rolls a
    mixed set back to the complete previous one.
    """
    log(f"copy {len(shipped)} declared file(s): plugin/ -> {dst}")
    if dry:
        return
    dst.mkdir(parents=True, exist_ok=True)
    parent = dst.parent
    journal = parent / INSTALL_TRANSACTION
    source_hashes = {name: _sha256(HERE / "plugin" / name) for name in shipped}
    old_hashes = {name: _hash_or_missing(dst / name) for name in shipped}
    workspace = parent / f"{INSTALL_WORKSPACE_PREFIX}{secrets.token_hex(12)}"
    journal_payload = _transaction_payload(
        workspace.name, shipped, old_hashes, source_hashes,
    )
    try:
        journal_handle = _write_json_exclusive(journal, journal_payload)
    except FileExistsError as exc:
        raise PluginAssetsError(
            f"another plugin install owns {journal}; refusing concurrent promotion"
        ) from exc
    except OSError as exc:
        raise PluginAssetsError(
            f"cannot create durable plugin transaction marker {journal}: {exc}"
        ) from exc
    promoted: list[str] = []
    try:
        try:
            _sync_directory(parent)
            staged, backups = _prepare_install_workspace(workspace)
            # The plan and backups are useless after a machine crash if the
            # workspace directory entry itself was never persisted.
            _sync_directory(parent)
            for name in shipped:
                source = HERE / "plugin" / name
                target = staged / name
                _copy_regular_file(source, target)
                if _sha256(target) != source_hashes[name]:
                    raise PluginAssetsError(f"staged {name} does not match its source")
            for name in shipped:
                current = dst / name
                if _hash_or_missing(current) != old_hashes[name]:
                    raise PluginAssetsError(
                        f"installed {name} changed while the transaction was being staged"
                    )
                if old_hashes[name] is not None:
                    _copy_regular_file(current, backups / name)
                    if _sha256(backups / name) != old_hashes[name]:
                        raise PluginAssetsError(f"backup of {name} is not byte-identical")

            _sync_directory(staged)
            _sync_directory(backups)
            _write_json_durable(
                workspace / INSTALL_PLAN,
                _plan_payload(shipped, old_hashes, source_hashes),
            )
            _sync_directory(workspace)

            # Keep build-info last: Diagnostics must never describe the new build
            # while an older runtime asset is still being promoted.
            order = [name for name in shipped if name != "build-info.json"]
            if "build-info.json" in shipped:
                order.append("build-info.json")
            for name in order:
                os.replace(staged / name, dst / name)
                promoted.append(name)
            _sync_directory(dst)
            mismatched = [
                name for name in shipped
                if _hash_or_missing(dst / name) != source_hashes[name]
            ]
            if mismatched:
                raise PluginAssetsError(
                    f"promoted files do not match their source: {', '.join(mismatched)}"
                )
        except Exception as exc:
            rollback_failures: list[str] = []
            for name in reversed(promoted):
                try:
                    if old_hashes[name] is not None:
                        os.replace(backups / name, dst / name)
                    else:
                        (dst / name).unlink(missing_ok=True)
                except OSError:
                    rollback_failures.append(name)
            if not rollback_failures:
                try:
                    _sync_directory(dst)
                except OSError:
                    rollback_failures.append("plugin directory durability")
            if not rollback_failures:
                try:
                    _finish_install_transaction(journal, workspace, parent, shipped)
                except (OSError, PluginAssetsError):
                    rollback_failures.append("transaction cleanup")
            suffix = (
                f"; rollback incomplete for {', '.join(sorted(rollback_failures))}; "
                f"transaction retained at {journal}"
                if rollback_failures else "; the previous plugin build was restored"
            )
            raise PluginAssetsError(f"plugin promotion failed: {exc}{suffix}") from exc
        try:
            _finish_install_transaction(journal, workspace, parent, shipped)
        except (OSError, PluginAssetsError) as exc:
            raise PluginAssetsError(
                "plugin assets were promoted and verified, but transaction cleanup "
                f"is incomplete; the next install will recover {journal}: {exc}"
            ) from exc
        log(
            f"verified and transactionally promoted {len(shipped)} "
            "shipped file(s) by sha256 ✓"
        )
    finally:
        journal_handle.close()


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


def _git_rev_parse(repo: Path) -> str | None:
    """40-character HEAD revision, or ``None`` if it cannot be established.

    ``None`` is never read downstream as "clean" or as matching anything —
    every caller treats an unreadable Git state as install-blocking, the same
    way a nonzero or timed-out status is treated elsewhere in this release
    (tools/codex_obsidian.py's GitStatusError is the Core-side counterpart).
    """
    try:
        proc = subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=repo,
            capture_output=True, text=True, timeout=30,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if proc.returncode != 0:
        return None
    value = proc.stdout.strip()
    return value if re.fullmatch(r"[0-9a-f]{40}", value) else None


def real_vault_install_problems(vault: Path, build_info: dict) -> list[str]:
    """Every reason a real-vault install must refuse; empty means clear.

    Unknown is never clean: a missing, malformed, or unreadable value is
    exactly as blocking here as a definite dirty flag or a definite mismatch.
    """
    problems: list[str] = []

    def revision_ok(value: object) -> bool:
        return isinstance(value, str) and bool(re.fullmatch(r"[0-9a-f]{40}", value))

    ui_revision = build_info.get("source_revision")
    if not revision_ok(ui_revision):
        problems.append(
            f"build-info.json source_revision is not a readable 40-character "
            f"revision: {ui_revision!r}"
        )
    if build_info.get("source_dirty") is not False:
        problems.append(
            "the UI worktree is dirty or its state is unknown "
            f"(source_dirty={build_info.get('source_dirty')!r})"
        )

    core_revision = build_info.get("core_revision")
    if not revision_ok(core_revision):
        problems.append(
            f"build-info.json core_revision is not a readable 40-character "
            f"revision: {core_revision!r}"
        )
    if build_info.get("core_dirty") is not False:
        problems.append(
            "the Core worktree is dirty or its state is unknown "
            f"(core_dirty={build_info.get('core_dirty')!r})"
        )

    actual_ui = _git_rev_parse(HERE)
    if actual_ui is None:
        problems.append("cannot read the UI repository's current Git revision")
    elif revision_ok(ui_revision) and actual_ui != ui_revision:
        problems.append(
            f"build-info.json source_revision ({ui_revision}) does not match "
            f"the current UI HEAD ({actual_ui})"
        )

    actual_core = _git_rev_parse(vault)
    if actual_core is None:
        problems.append("cannot read the Core repository's current Git revision")
    elif revision_ok(core_revision) and actual_core != core_revision:
        problems.append(
            f"build-info.json core_revision ({core_revision}) does not match "
            f"the current Core HEAD ({actual_core})"
        )

    return problems


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

    # A real-vault install is the one place an unproven artifact can reach a
    # place Aram actually studies from. It requires proof the deterministic
    # build check just passed (not merely that some earlier build succeeded),
    # and that both repositories are clean and their revisions agree with what
    # that just-verified build-info.json records. A fixture/dry-run install
    # needs none of this — it is a disposable target, never the real vault.
    if is_live and not args.dry_run:
        node_bin = resolve_node(args.node)
        log("real-vault install: running the deterministic build check before anything is written")
        check = subprocess.run(
            [node_bin, str(HERE / "scripts" / "check-build.mjs")],
            cwd=HERE, capture_output=True, text=True, timeout=180,
        )
        if check.returncode != 0:
            print(check.stdout)
            print(check.stderr, file=sys.stderr)
            sys.exit("install: deterministic build check FAILED — refusing a "
                     "real-vault install; nothing was written")
        try:
            build_info = json.loads(
                (HERE / "plugin" / "build-info.json").read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            sys.exit(f"install: cannot read plugin/build-info.json after the "
                     f"build check: {exc}")
        problems = real_vault_install_problems(vault, build_info)
        if problems:
            sys.exit(
                "install: refusing a real-vault install — nothing was written:\n  "
                + "\n  ".join(problems)
            )
        log("real-vault install: both repositories are clean and their "
            "revisions match the verified build ✓")

    # Before any new install state is written. A real run may first finish a
    # fully evidenced recovery from a killed prior install; dry-run never does.
    try:
        preflight_plugin_directory(vault, recover=not args.dry_run)
    except PluginRecoveryError as exc:
        sys.exit(f"install: {exc}")
    except PluginAssetsError as exc:
        sys.exit(f"install: {exc}; nothing was written.")
    shipped, _vault_owned = read_plugin_assets()

    # Promote and verify the complete plugin before enabling it or changing
    # vault settings.  A failed fresh install must not leave an enabled plugin
    # id whose directory does not exist.
    try:
        copy_shipped_plugin(vault / ".obsidian" / "plugins" / PLUGIN_ID,
                            shipped, args.dry_run)
    except PluginAssetsError as exc:
        sys.exit(f"install: {exc}")
    merge_app_json(vault, args.dry_run)
    merge_core_plugins(vault, args.dry_run)
    ecosystem_ids = install_ecosystem(vault, args.dry_run) if args.ecosystem else []
    enable_plugins(vault, args.dry_run, ecosystem_ids)
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
