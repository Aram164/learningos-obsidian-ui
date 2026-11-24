#!/usr/bin/env python3
"""Install one pinned experimental plugin into a marked fixture vault.

Scope (IMPLEMENTATION-PLAN P5 step 31): Advanced Canvas goes only into a
vault marked `.los-atlas-fixture`; LearnKit only into a practice vault whose
`.learningos-practice-vault.json` carries `experimental: true`. Assets come
from a caller-supplied directory and must match `experimental-atlas-plugins
.json` byte-for-byte (SHA-256, embedded manifest id and exact version).
`--check` validates without writing; `--apply` stages a complete directory
on the target filesystem and publishes it only if absent. Existing exact
assets are a no-op. Anything divergent, symlinked, unmarked or cross-marked
refuses. Production `ecosystem-plugins.json`/`install.py` are untouched.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

PINS_PATH = Path(__file__).with_name("experimental-atlas-plugins.json")
ASSET_NAMES = ("main.js", "manifest.json", "styles.css")


class Refusal(Exception):
    """A stated refusal: exit 2, no writes beyond a removed staging dir."""


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


# macOS firmlink aliases are operating-system plumbing, not caller links.
_SYSTEM_ALIASES = {"/var": "/private/var", "/tmp": "/private/tmp",
                   "/etc": "/private/etc"}


def refuse_symlink_components(path: Path, what: str) -> None:
    current = Path(path.anchor) if path.is_absolute() else Path(".")
    for part in path.parts:
        if part == path.anchor:
            continue
        current /= part
        if current.is_symlink():
            if _SYSTEM_ALIASES.get(str(current)) == str(current.resolve()):
                continue
            raise Refusal(f"{what} crosses a symlink: {current}")


def load_pins() -> dict:
    try:
        pins = json.loads(PINS_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise Refusal(f"cannot read pin table {PINS_PATH}: {exc}") from exc
    if pins.get("schema_version") != 1 or not isinstance(pins.get("plugins"), dict):
        raise Refusal("pin table is malformed")
    return pins["plugins"]


def validate_assets(asset_dir: Path, pin: dict) -> dict[str, Path]:
    if asset_dir.is_symlink() or not asset_dir.is_dir():
        raise Refusal(f"asset directory is missing or linked: {asset_dir}")
    refuse_symlink_components(asset_dir, "asset directory")
    found: dict[str, Path] = {}
    for name in ASSET_NAMES:
        candidate = asset_dir / name
        if candidate.is_symlink() or not candidate.is_file():
            raise Refusal(f"asset is missing or linked: {candidate}")
        if digest(candidate) != pin["assets"][name]:
            raise Refusal(f"asset digest mismatch: {name}")
        found[name] = candidate
    try:
        manifest = json.loads(found["manifest.json"].read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise Refusal(f"asset manifest is unreadable: {exc}") from exc
    if manifest.get("id") != pin["id"]:
        raise Refusal(f"asset manifest id {manifest.get('id')!r} != pinned {pin['id']!r}")
    if manifest.get("version") != pin["version"]:
        raise Refusal(
            f"asset version {manifest.get('version')!r} != pinned {pin['version']!r}")
    return found


def validate_marker(vault: Path, pin: dict) -> None:
    marker = pin["marker"]
    marker_path = vault / marker["file"]
    if marker_path.is_symlink() or not marker_path.is_file():
        raise Refusal(
            f"vault is not marked for {pin['id']}: missing {marker['file']}")
    if marker.get("json_experimental"):
        try:
            payload = json.loads(marker_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise Refusal(f"practice marker is unreadable: {exc}") from exc
        if not isinstance(payload, dict) or payload.get("experimental") is not True:
            raise Refusal("practice marker does not carry experimental: true")


def installed_state(target: Path, pin: dict) -> str:
    """'absent', 'exact', or 'divergent' for the pinned asset bytes."""
    if target.is_symlink():
        raise Refusal(f"installed plugin path is a symlink: {target}")
    if not target.exists():
        return "absent"
    if not target.is_dir():
        raise Refusal(f"installed plugin path is not a directory: {target}")
    for name in ASSET_NAMES:
        candidate = target / name
        if candidate.is_symlink() or not candidate.is_file():
            return "divergent"
        if digest(candidate) != pin["assets"][name]:
            return "divergent"
    return "exact"


def _fsync_dir(directory: Path) -> None:
    fd = os.open(directory, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def _copy_and_sync(src: Path, dst: Path) -> None:
    with src.open("rb") as source, dst.open("wb") as dest:
        shutil.copyfileobj(source, dest)
        dest.flush()
        os.fsync(dest.fileno())


def validate_destination(vault: Path, pin: dict) -> Path:
    if vault.is_symlink() or not vault.is_dir():
        raise Refusal(f"vault is missing or linked: {vault}")
    refuse_symlink_components(vault, "vault path")
    resolved = vault.resolve()
    if any((ancestor / ".git").exists() for ancestor in (resolved, *resolved.parents)):
        raise Refusal("refusing a Git checkout as a fixture vault")
    validate_marker(vault, pin)
    obsidian_dir = vault / ".obsidian"
    if obsidian_dir.is_symlink() or (obsidian_dir.exists() and not obsidian_dir.is_dir()):
        raise Refusal(f".obsidian path is linked or not a directory: {obsidian_dir}")
    plugins_dir = obsidian_dir / "plugins"
    if plugins_dir.is_symlink() or (plugins_dir.exists() and not plugins_dir.is_dir()):
        raise Refusal(f"plugins directory is a symlink or non-directory: {plugins_dir}")
    return plugins_dir / pin["id"]


def apply_install(vault: Path, pin: dict, assets: dict[str, Path]) -> str:
    target = validate_destination(vault, pin)
    state = installed_state(target, pin)
    if state == "exact":
        return "no-op"
    if state == "divergent":
        raise Refusal(f"installed bytes diverge from the pin: {target}")
    refuse_symlink_components(target.parent, "plugins directory")
    for directory in (vault / ".obsidian", target.parent):
        if directory.is_symlink():
            raise Refusal(f"plugins directory crosses a symlink: {directory}")
        directory.mkdir(exist_ok=True)
        if directory.is_symlink() or not directory.is_dir():
            raise Refusal(f"plugins directory is not a regular directory: {directory}")
    refuse_symlink_components(target.parent, "plugins directory")
    staging = Path(tempfile.mkdtemp(prefix=f".los-stage-{pin['id']}-", dir=target.parent))
    try:
        for name in ASSET_NAMES:
            _copy_and_sync(assets[name], staging / name)
            if digest(staging / name) != pin["assets"][name]:
                raise Refusal(f"staged asset failed verification: {name}")
        _fsync_dir(staging)
        # Publish only if still absent; a racer with exact bytes is a no-op.
        if target.exists():
            if installed_state(target, pin) == "exact":
                return "no-op"
            raise Refusal(f"installed bytes diverge from the pin: {target}")
        try:
            staging.rename(target)
        except (FileExistsError, OSError) as exc:
            raced = installed_state(target, pin)
            if raced == "exact":
                return "no-op"
            if raced == "divergent":
                raise Refusal(f"installed bytes diverge from the pin: {target}") from exc
            raise Refusal(f"could not publish plugin into {target}: {exc}") from exc
        _fsync_dir(target.parent)
    finally:
        if staging.exists():
            shutil.rmtree(staging)
    if installed_state(target, pin) != "exact":
        raise Refusal(f"published plugin failed verification: {target}")
    return "installed"


def main(argv: list[str] | None = None) -> int:
    pins = load_pins()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plugin", required=True, choices=sorted(pins))
    parser.add_argument("--vault", required=True, type=Path)
    parser.add_argument("--asset-dir", required=True, type=Path)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true",
                      help="validate assets and destination without writing")
    mode.add_argument("--apply", action="store_true",
                      help="stage and publish only if absent")
    args = parser.parse_args(argv)

    pin = pins[args.plugin]
    try:
        target = validate_destination(args.vault, pin)
        assets = validate_assets(args.asset_dir, pin)
        state = installed_state(target, pin)
        if args.check:
            if state == "divergent":
                raise Refusal(f"installed bytes diverge from the pin: {target}")
            result = {"plugin": pin["id"], "version": pin["version"],
                      "mode": "check", "status": "check-ok",
                      "installed": state}
        else:
            status = apply_install(args.vault, pin, assets)
            result = {"plugin": pin["id"], "version": pin["version"],
                      "mode": "apply", "status": status,
                      "installed": installed_state(target, pin)}
    except Refusal as exc:
        print(json.dumps({"plugin": args.plugin, "status": "refused",
                          "reason": str(exc)}))
        return 2
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
