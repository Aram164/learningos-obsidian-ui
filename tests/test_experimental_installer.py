#!/usr/bin/env python3
"""Fixture proofs for the experimental plugin installer (P5 step 31).

Runs the real CLI against synthetic marked vaults and a synthetic asset
directory built from the pin table itself — never the live vault, never a
download. Approved, absent, exact no-op, divergent, cross-marked, linked and
unmarked states each get one case.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "install-experimental-plugin.py"
PINS = json.loads(
    (ROOT / "scripts" / "experimental-atlas-plugins.json").read_text())["plugins"]


def make_assets(base: Path, plugin: str) -> Path:
    pin = PINS[plugin]
    assets = base / f"assets-{plugin}"
    assets.mkdir(parents=True)
    manifest = {"id": pin["id"], "version": pin["version"], "name": plugin}
    (assets / "manifest.json").write_text(json.dumps(manifest))
    (assets / "main.js").write_text(f"// {plugin} synthetic main\n")
    (assets / "styles.css").write_text(f"/* {plugin} synthetic */\n")
    # Rewrite the pin digests is not an option: the test asset dir must match
    # the real pins, so instead the manifest case below uses tampered copies.
    return assets


def real_asset_dir(base: Path, plugin: str) -> Path:
    """An asset dir whose manifest matches the pinned id/version.

    Digests cannot be forged, so positive-path tests call the module
    functions with a pin table rewritten to the synthetic assets (see
    PinRewrite). The shipped pins are exercised negatively: real assets
    under them validate (covered by the engineering asset check), and any
    tampered byte refuses.
    """
    return make_assets(base, plugin)


class InstallerCliTests(unittest.TestCase):
    def run_cli(self, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run(
            [sys.executable, str(SCRIPT), *args],
            capture_output=True, text=True)

    def test_unmarked_vault_refuses(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            vault = base / "vault"
            vault.mkdir()
            result = self.run_cli(
                "--plugin", "learnkit", "--vault", str(vault),
                "--asset-dir", str(real_asset_dir(base, "learnkit")), "--check")
            self.assertEqual(result.returncode, 2, result.stdout)
            self.assertIn("refused", result.stdout)

    def test_cross_install_refuses(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            vault = base / "atlas-fixture"
            vault.mkdir()
            (vault / ".los-atlas-fixture").write_text("fixture\n")
            result = self.run_cli(
                "--plugin", "learnkit", "--vault", str(vault),
                "--asset-dir", str(real_asset_dir(base, "learnkit")), "--check")
            self.assertEqual(result.returncode, 2, result.stdout)
            self.assertIn("not marked for learnkit", result.stdout)

    def test_wrong_marker_json_refuses(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            vault = base / "practice"
            vault.mkdir()
            (vault / ".learningos-practice-vault.json").write_text(
                json.dumps({"experimental": False}))
            result = self.run_cli(
                "--plugin", "learnkit", "--vault", str(vault),
                "--asset-dir", str(real_asset_dir(base, "learnkit")), "--check")
            self.assertEqual(result.returncode, 2, result.stdout)

    def test_tampered_asset_refuses_before_destination(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            vault = base / "atlas-fixture"
            vault.mkdir()
            (vault / ".los-atlas-fixture").write_text("fixture\n")
            assets = real_asset_dir(base, "advanced-canvas")
            (assets / "main.js").write_text("// tampered\n")
            result = self.run_cli(
                "--plugin", "advanced-canvas", "--vault", str(vault),
                "--asset-dir", str(assets), "--check")
            self.assertEqual(result.returncode, 2, result.stdout)
            self.assertIn("digest mismatch", result.stdout)

    def test_symlink_vault_refuses(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            real = base / "real-vault"
            real.mkdir()
            (real / ".los-atlas-fixture").write_text("fixture\n")
            link = base / "linked-vault"
            link.symlink_to(real, target_is_directory=True)
            result = self.run_cli(
                "--plugin", "advanced-canvas", "--vault", str(link),
                "--asset-dir", str(real_asset_dir(base, "advanced-canvas")),
                "--check")
            self.assertEqual(result.returncode, 2, result.stdout)

    def test_git_checkout_refuses(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            vault = base / "repo"
            (vault / ".git").mkdir(parents=True)
            (vault / ".los-atlas-fixture").write_text("fixture\n")
            result = self.run_cli(
                "--plugin", "advanced-canvas", "--vault", str(vault),
                "--asset-dir", str(real_asset_dir(base, "advanced-canvas")),
                "--check")
            self.assertEqual(result.returncode, 2, result.stdout)
            self.assertIn("Git checkout", result.stdout)


class PinRewrite:
    """Point the installer module at synthetic pins matching synthetic assets."""

    def __init__(self, test: unittest.TestCase) -> None:
        self.test = test

    def __enter__(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "experimental_installer", SCRIPT)
        assert spec and spec.loader
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.module = module
        self.tmp = tempfile.TemporaryDirectory()
        base = Path(self.tmp.name)
        self.pins = {}
        for plugin, pin in PINS.items():
            assets = base / f"assets-{plugin}"
            assets.mkdir()
            manifest = {"id": pin["id"], "version": pin["version"]}
            (assets / "manifest.json").write_text(json.dumps(manifest))
            (assets / "main.js").write_text(f"// {plugin}\n")
            (assets / "styles.css").write_text(f"/* {plugin} */\n")
            rewritten = dict(pin)
            rewritten["assets"] = {
                name: hashlib.sha256((assets / name).read_bytes()).hexdigest()
                for name in ("main.js", "manifest.json", "styles.css")
            }
            self.pins[plugin] = rewritten
            setattr(self, f"assets_{plugin.replace('-', '_')}", assets)
        self.original = module.load_pins
        module.load_pins = lambda: self.pins
        return self

    def __exit__(self, *exc) -> None:
        self.module.load_pins = self.original
        self.tmp.cleanup()
        return False


class InstallerApplyTests(unittest.TestCase):
    def test_apply_noop_and_divergent_refusal(self) -> None:
        with PinRewrite(self) as ctx:
            module = ctx.module
            base = Path(ctx.tmp.name)
            vault = base / "fixture"
            vault.mkdir()
            (vault / ".los-atlas-fixture").write_text("fixture\n")
            pin = ctx.pins["advanced-canvas"]
            assets = module.validate_assets(ctx.assets_advanced_canvas, pin)
            self.assertEqual(
                module.apply_install(vault, pin, assets), "installed")
            target = vault / ".obsidian" / "plugins" / "advanced-canvas"
            self.assertEqual(
                (target / "manifest.json").read_bytes(),
                (ctx.assets_advanced_canvas / "manifest.json").read_bytes())
            self.assertEqual(
                module.apply_install(vault, pin, assets), "no-op")
            (target / "main.js").write_text("// diverged\n")
            with self.assertRaises(module.Refusal):
                module.apply_install(vault, pin, assets)

    def test_practice_marker_gate(self) -> None:
        with PinRewrite(self) as ctx:
            module = ctx.module
            base = Path(ctx.tmp.name)
            vault = base / "practice"
            vault.mkdir()
            (vault / ".learningos-practice-vault.json").write_text(json.dumps({
                "schema_version": 1, "purpose": "learnkit-practice",
                "experimental": True, "vault_id": "synthetic",
            }))
            pin = ctx.pins["learnkit"]
            assets = module.validate_assets(ctx.assets_learnkit, pin)
            self.assertEqual(
                module.apply_install(vault, pin, assets), "installed")
            # Advanced Canvas may not cross into the practice vault.
            with self.assertRaises(module.Refusal):
                module.validate_destination(vault, ctx.pins["advanced-canvas"])

    def test_symlink_obsidian_and_ancestor_git_refuse(self) -> None:
        with PinRewrite(self) as ctx:
            module = ctx.module
            base = Path(ctx.tmp.name)

            outside = base / "outside-obsidian"
            outside.mkdir()
            sym_vault = base / "sym-obsidian-vault"
            sym_vault.mkdir()
            (sym_vault / ".los-atlas-fixture").write_text("fixture\n")
            (sym_vault / ".obsidian").symlink_to(outside, target_is_directory=True)
            pin = ctx.pins["advanced-canvas"]
            assets = module.validate_assets(ctx.assets_advanced_canvas, pin)
            with self.assertRaises(module.Refusal):
                module.apply_install(sym_vault, pin, assets)
            self.assertFalse((outside / "plugins").exists())

            repo_root = base / "repo-ancestor"
            (repo_root / ".git").mkdir(parents=True)
            nested_vault = repo_root / "nested" / "fixture"
            nested_vault.mkdir(parents=True)
            (nested_vault / ".los-atlas-fixture").write_text("fixture\n")
            with self.assertRaises(module.Refusal):
                module.validate_destination(nested_vault, pin)

    def test_rename_race_handles_exact_noop_and_divergent_refusal(self) -> None:
        import shutil
        from unittest.mock import patch

        with PinRewrite(self) as ctx:
            module = ctx.module
            base = Path(ctx.tmp.name)
            vault = base / "raced-vault"
            vault.mkdir()
            (vault / ".los-atlas-fixture").write_text("fixture\n")
            pin = ctx.pins["advanced-canvas"]
            assets = module.validate_assets(ctx.assets_advanced_canvas, pin)
            target = vault / ".obsidian" / "plugins" / pin["id"]

            real_rename = Path.rename

            def race_exact(self_path: Path, dst: Path):
                if dst == target:
                    dst.mkdir(parents=True, exist_ok=True)
                    for name, src in assets.items():
                        shutil.copyfile(src, dst / name)
                    raise FileExistsError("raced exact")
                return real_rename(self_path, dst)

            with patch.object(Path, "rename", race_exact):
                self.assertEqual(module.apply_install(vault, pin, assets), "no-op")
            self.assertEqual(
                [p.name for p in target.parent.iterdir() if p.name.startswith(".los-stage-")],
                [],
            )

            shutil.rmtree(target)

            def race_divergent(self_path: Path, dst: Path):
                if dst == target:
                    dst.mkdir(parents=True, exist_ok=True)
                    (dst / "main.js").write_text("// raced divergent\n")
                    raise OSError("directory not empty")
                return real_rename(self_path, dst)

            with patch.object(Path, "rename", race_divergent):
                with self.assertRaises(module.Refusal):
                    module.apply_install(vault, pin, assets)
            self.assertEqual(
                [p.name for p in target.parent.iterdir() if p.name.startswith(".los-stage-")],
                [],
            )


if __name__ == "__main__":
    unittest.main()
