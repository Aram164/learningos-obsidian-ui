#!/usr/bin/env python3
"""Regression tests for fail-closed installer prerequisites."""

from __future__ import annotations

import importlib.util
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("learningos_ui_installer", ROOT / "install.py")
assert SPEC and SPEC.loader
INSTALLER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(INSTALLER)

CHECKER = ROOT / "scripts" / "check-install-current.mjs"
# Exactly what `install.py` copies out of `plugin/`; the status check must
# compare every one of them, not only the bundle.
SHIPPED = ("main.js", "styles.css", "manifest.json", "build-info.json")


class InstallerTests(unittest.TestCase):
    def test_missing_required_suites_refuse_untested_install(self) -> None:
        original = INSTALLER.HERE
        try:
            with tempfile.TemporaryDirectory() as directory:
                INSTALLER.HERE = Path(directory)
                with self.assertRaisesRegex(SystemExit, "missing required UI suite"):
                    INSTALLER.run_ui_tests()
        finally:
            INSTALLER.HERE = original


class InstallStatusTests(unittest.TestCase):
    """The status check is what stands between a partial install and silence.

    Comparing only `main.js` reported "the vault is running this build" while a
    stale `styles.css` sat beside it, so each shipped file gets its own proof.
    """

    @classmethod
    def setUpClass(cls) -> None:
        missing = [name for name in SHIPPED if not (ROOT / "plugin" / name).is_file()]
        if missing:
            raise unittest.SkipTest(
                f"no local build to compare against (missing {', '.join(missing)}); "
                "run `npm run build` and `npm run build:info`"
            )

    def _vault(self, directory: str) -> Path:
        """A temporary vault holding a byte-identical copy of this build."""
        vault = Path(directory) / "vault"
        installed = vault / ".obsidian" / "plugins" / "learningos-ui"
        installed.mkdir(parents=True)
        for name in SHIPPED:
            shutil.copy2(ROOT / "plugin" / name, installed / name)
        return vault

    def _check(self, vault: Path) -> subprocess.CompletedProcess:
        return subprocess.run(
            ["node", str(CHECKER), str(vault)],
            capture_output=True, text=True, timeout=120, cwd=str(ROOT),
        )

    def test_all_shipped_assets_equal_reports_current(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            result = self._check(self._vault(directory))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("running this build", result.stdout)

    def test_each_missing_shipped_asset_fails_and_names_the_file(self) -> None:
        for name in SHIPPED:
            with self.subTest(missing=name), tempfile.TemporaryDirectory() as directory:
                vault = self._vault(directory)
                (vault / ".obsidian" / "plugins" / "learningos-ui" / name).unlink()
                result = self._check(vault)
                self.assertEqual(result.returncode, 1, result.stdout)
                self.assertIn(name, result.stdout)

    def test_each_changed_shipped_asset_fails_and_names_the_file(self) -> None:
        for name in SHIPPED:
            with self.subTest(changed=name), tempfile.TemporaryDirectory() as directory:
                vault = self._vault(directory)
                target = vault / ".obsidian" / "plugins" / "learningos-ui" / name
                target.write_bytes(target.read_bytes() + b"\n/* drift */\n")
                result = self._check(vault)
                self.assertEqual(result.returncode, 1, result.stdout)
                self.assertIn("DIFFERENT BUILD", result.stdout)
                self.assertIn(name, result.stdout)

    def test_build_info_only_drift_is_reported_not_hidden(self) -> None:
        """Identical code built beside a different Core commit is still drift."""
        with tempfile.TemporaryDirectory() as directory:
            vault = self._vault(directory)
            target = vault / ".obsidian" / "plugins" / "learningos-ui" / "build-info.json"
            info = json.loads(target.read_text(encoding="utf-8"))
            info["source_revision"] = "0" * 40
            info["source_committed_at"] = "2000-01-01T00:00:00+00:00"
            target.write_text(json.dumps(info, indent=2) + "\n", encoding="utf-8")
            result = self._check(vault)
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("build-info.json", result.stdout)
        self.assertIn("different source revision", result.stdout)

    def test_vault_owned_data_json_is_ignored(self) -> None:
        """`data.json` is Obsidian's settings file, not something we ship."""
        with tempfile.TemporaryDirectory() as directory:
            vault = self._vault(directory)
            installed = vault / ".obsidian" / "plugins" / "learningos-ui"
            (installed / "data.json").write_text(
                json.dumps({"unrelated": "vault-owned setting"}), encoding="utf-8",
            )
            result = self._check(vault)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("running this build", result.stdout)

    def test_the_checker_never_writes_to_the_vault(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            vault = self._vault(directory)
            installed = vault / ".obsidian" / "plugins" / "learningos-ui"
            before = {
                path.relative_to(vault).as_posix(): path.read_bytes()
                for path in sorted(vault.rglob("*")) if path.is_file()
            }
            (installed / "main.js").write_bytes(b"// stale\n")
            after_edit = (installed / "main.js").read_bytes()
            self._check(vault)
            now = {
                path.relative_to(vault).as_posix(): path.read_bytes()
                for path in sorted(vault.rglob("*")) if path.is_file()
            }
        self.assertEqual(set(now), set(before))
        self.assertEqual(now[".obsidian/plugins/learningos-ui/main.js"], after_edit)


if __name__ == "__main__":
    unittest.main()
