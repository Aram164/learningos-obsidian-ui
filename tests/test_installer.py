#!/usr/bin/env python3
"""Regression tests for fail-closed installer prerequisites."""

from __future__ import annotations

import importlib.util
import hashlib
import io
import json
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest
import zipfile
from concurrent.futures import ThreadPoolExecutor
from unittest import mock
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("learningos_ui_installer", ROOT / "install.py")
assert SPEC and SPEC.loader
INSTALLER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(INSTALLER)

CHECKER = ROOT / "scripts" / "check-install-current.mjs"
# Read from the shipping manifest, never restated here. A test that carries its
# own copy of the list is a test that agrees with itself: it would keep passing
# while production and the checker drifted apart, which is the exact failure
# the manifest exists to prevent.
SHIPPED, VAULT_OWNED = INSTALLER.read_plugin_assets()


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
        # Explicit VAULT also selects Core provenance. Give the fixture its
        # own refs at the paired Core HEAD; never point its .git at a live
        # checkout or let status fall back to an unrelated sibling.
        subprocess.run(
            ["git", "clone", "--quiet", "--shared", "--no-checkout",
             str(ROOT.parent / "repository"), str(vault)],
            capture_output=True, text=True, timeout=120, check=True,
        )
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
        self.assertIn("installed files match this build", result.stdout)

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
        self.assertIn("installed files match this build", result.stdout)

    def test_an_unexpected_installed_file_fails_and_names_its_exact_path(self) -> None:
        """Reporting "current ✓" beside a file nobody ships is the false
        reassurance this check exists to withhold."""
        for name, make in (
            ("stray.js", lambda p: p.write_text("// who put this here", encoding="utf-8")),
            ("nested", lambda p: p.mkdir()),
            ("link.js", lambda p: p.symlink_to(ROOT / "plugin" / "main.js")),
        ):
            with self.subTest(unexpected=name), tempfile.TemporaryDirectory() as directory:
                vault = self._vault(directory)
                installed = vault / ".obsidian" / "plugins" / "learningos-ui"
                make(installed / name)
                result = self._check(vault)
                self.assertEqual(result.returncode, 1, result.stdout)
                self.assertIn(str(installed / name), result.stdout)
                self.assertIn("DOES NOT OWN", result.stdout)
                # Named, never removed.
                self.assertTrue((installed / name).exists()
                                or (installed / name).is_symlink())

    def test_a_vault_owned_entry_must_still_be_a_regular_file(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            vault = self._vault(directory)
            installed = vault / ".obsidian" / "plugins" / "learningos-ui"
            (installed / "data.json").mkdir()
            result = self._check(vault)
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("expected a regular file", result.stdout)

    def test_an_invalid_manifest_is_fatal_in_both_readers(self) -> None:
        """Python and Node must refuse the same manifests, for the same reasons."""
        broken = [
            {"schema_version": 2, "type": INSTALLER.MANIFEST_TYPE,
             "shipped": ["main.js"], "vault_owned": ["data.json"]},
            {"schema_version": True, "type": INSTALLER.MANIFEST_TYPE,
             "shipped": ["main.js"], "vault_owned": ["data.json"]},
            {"schema_version": 1, "type": "something-else",
             "shipped": ["main.js"], "vault_owned": ["data.json"]},
            {"schema_version": 1, "type": INSTALLER.MANIFEST_TYPE,
             "shipped": ["main.js"]},
            {"schema_version": 1, "type": INSTALLER.MANIFEST_TYPE,
             "shipped": ["main.js"], "vault_owned": ["data.json"], "extra": True},
            {"schema_version": 1, "type": INSTALLER.MANIFEST_TYPE,
             "shipped": [""], "vault_owned": ["data.json"]},
            {"schema_version": 1, "type": INSTALLER.MANIFEST_TYPE,
             "shipped": ["../main.js"], "vault_owned": ["data.json"]},
            {"schema_version": 1, "type": INSTALLER.MANIFEST_TYPE,
             "shipped": [".."], "vault_owned": ["data.json"]},
            {"schema_version": 1, "type": INSTALLER.MANIFEST_TYPE,
             "shipped": ["main.js", "main.js"], "vault_owned": ["data.json"]},
            {"schema_version": 1, "type": INSTALLER.MANIFEST_TYPE,
             "shipped": ["main.js", "data.json"], "vault_owned": ["data.json"]},
        ]
        reader = ROOT / "scripts" / "plugin-assets.mjs"
        for candidate in broken:
            with self.subTest(manifest=candidate), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                (root / "plugin-assets.json").write_text(
                    json.dumps(candidate), encoding="utf-8")
                with self.assertRaises(INSTALLER.PluginAssetsError):
                    INSTALLER.read_plugin_assets(root)
                node = subprocess.run(
                    ["node", "--input-type=module", "-e",
                     f"import {{ readPluginAssets }} from {json.dumps(str(reader))};"
                     f" readPluginAssets({json.dumps(str(root))});"],
                    capture_output=True, text=True, timeout=120,
                )
                self.assertNotEqual(node.returncode, 0, node.stdout + node.stderr)
                self.assertIn("plugin-assets.json", node.stderr)

    def test_the_installer_refuses_before_touching_any_vault_file(self) -> None:
        """The refusal has to happen before `app.json` and the core-plugin
        settings are merged, or a rejected install has already edited the
        learner's vault."""
        with tempfile.TemporaryDirectory() as directory:
            vault = self._vault(directory)
            installed = vault / ".obsidian" / "plugins" / "learningos-ui"
            (installed / "unexplained.txt").write_text("keep me", encoding="utf-8")
            before = {
                path.relative_to(vault).as_posix(): path.read_bytes()
                for path in sorted(vault.rglob("*")) if path.is_file()
            }
            result = subprocess.run(
                [sys.executable, str(ROOT / "install.py"),
                 "--vault", str(vault), "--skip-tests"],
                capture_output=True, text=True, timeout=180, cwd=str(ROOT),
            )
            after = {
                path.relative_to(vault).as_posix(): path.read_bytes()
                for path in sorted(vault.rglob("*")) if path.is_file()
            }
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn("unexplained.txt", result.stdout + result.stderr)
        self.assertEqual(after, before, "a refused install must change nothing")

    def test_a_shipped_destination_symlink_is_refused_without_following_it(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            vault = self._vault(directory)
            installed = vault / ".obsidian" / "plugins" / "learningos-ui"
            victim = Path(directory) / "outside-vault.txt"
            victim.write_text("do not overwrite me", encoding="utf-8")
            (installed / "main.js").unlink()
            (installed / "main.js").symlink_to(victim)
            result = subprocess.run(
                [sys.executable, str(ROOT / "install.py"),
                 "--vault", str(vault), "--skip-tests"],
                capture_output=True, text=True, timeout=180, cwd=str(ROOT),
            )
            victim_after = victim.read_text(encoding="utf-8")
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("main.js", result.stdout + result.stderr)
        self.assertIn("symlink", result.stdout + result.stderr)
        self.assertEqual(victim_after, "do not overwrite me")

    def test_a_symlinked_or_non_directory_plugin_root_is_refused_before_config(self) -> None:
        for shape in ("symlink", "file"):
            with self.subTest(shape=shape), tempfile.TemporaryDirectory() as directory:
                vault = Path(directory) / "vault"
                plugins = vault / ".obsidian" / "plugins"
                plugins.mkdir(parents=True)
                installed = plugins / "learningos-ui"
                if shape == "symlink":
                    outside = Path(directory) / "outside-plugin"
                    outside.mkdir()
                    installed.symlink_to(outside, target_is_directory=True)
                else:
                    installed.write_text("not a directory", encoding="utf-8")
                result = subprocess.run(
                    [sys.executable, str(ROOT / "install.py"),
                     "--vault", str(vault), "--skip-tests"],
                    capture_output=True, text=True, timeout=180, cwd=str(ROOT),
                )
                self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertFalse((vault / ".obsidian" / "app.json").exists())
                self.assertFalse((vault / ".obsidian" / "core-plugins.json").exists())
                self.assertFalse((vault / ".obsidian" / "community-plugins.json").exists())

    def test_a_managed_settings_or_base_symlink_is_never_followed(self) -> None:
        for relative in (
            ".obsidian/app.json",
            ".obsidian/core-plugins.json",
            ".obsidian/community-plugins.json",
            "bases/notes.base",
        ):
            with self.subTest(relative=relative), tempfile.TemporaryDirectory() as directory:
                vault = Path(directory) / "vault"
                target = vault / relative
                target.parent.mkdir(parents=True)
                victim = Path(directory) / "outside-vault.txt"
                victim.write_text("do not overwrite me", encoding="utf-8")
                target.symlink_to(victim)
                result = subprocess.run(
                    [sys.executable, str(ROOT / "install.py"),
                     "--vault", str(vault), "--skip-tests"],
                    capture_output=True, text=True, timeout=180, cwd=str(ROOT),
                )
                victim_after = victim.read_text(encoding="utf-8")
            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertIn(relative, result.stdout + result.stderr)
            self.assertIn("symlink", result.stdout + result.stderr)
            self.assertEqual(victim_after, "do not overwrite me")

    def test_a_promotion_failure_restores_the_previous_asset_set(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            vault = self._vault(directory)
            installed = vault / ".obsidian" / "plugins" / "learningos-ui"
            before = {}
            for name in SHIPPED:
                content = f"old {name}\n".encode()
                (installed / name).write_bytes(content)
                before[name] = content
            original_replace = INSTALLER.os.replace

            def fail_on_manifest(source, destination):
                source_path = Path(source)
                destination_path = Path(destination)
                if (source_path.parent.name == "staged"
                        and destination_path.name == "manifest.json"):
                    raise OSError("forced promotion failure")
                return original_replace(source, destination)

            with mock.patch.object(INSTALLER.os, "replace", side_effect=fail_on_manifest):
                with self.assertRaisesRegex(
                    INSTALLER.PluginAssetsError, "previous plugin build was restored",
                ):
                    INSTALLER.copy_shipped_plugin(installed, SHIPPED, False)
            after = {name: (installed / name).read_bytes() for name in SHIPPED}
            marker = installed.parent / INSTALLER.INSTALL_TRANSACTION
            marker_exists = marker.exists()
        self.assertEqual(after, before)
        self.assertFalse(marker_exists)

    def test_an_interruption_before_staging_recovers_the_unchanged_set(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            vault = self._vault(directory)
            installed = vault / ".obsidian" / "plugins" / "learningos-ui"
            before = {}
            for name in SHIPPED:
                content = f"previous {name}\n".encode()
                (installed / name).write_bytes(content)
                before[name] = content
            with mock.patch.object(
                INSTALLER, "_prepare_install_workspace", side_effect=KeyboardInterrupt,
            ):
                with self.assertRaises(KeyboardInterrupt):
                    INSTALLER.copy_shipped_plugin(installed, SHIPPED, False)

            marker = installed.parent / INSTALLER.INSTALL_TRANSACTION
            self.assertTrue(marker.is_file())
            INSTALLER.preflight_plugin_directory(vault)
            after = {name: (installed / name).read_bytes() for name in SHIPPED}
            leftovers = list(installed.parent.glob(".learningos-ui-install-*"))

        self.assertEqual(after, before)
        self.assertEqual(leftovers, [])

    def test_an_interrupted_mixed_promotion_is_rolled_back_from_verified_backups(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            vault = self._vault(directory)
            installed = vault / ".obsidian" / "plugins" / "learningos-ui"
            before = {}
            for name in SHIPPED:
                content = f"previous {name}\n".encode()
                (installed / name).write_bytes(content)
                before[name] = content
            original_replace = INSTALLER.os.replace
            interrupted = False

            def interrupt_after_first_promotion(source, destination):
                nonlocal interrupted
                result = original_replace(source, destination)
                if Path(source).parent.name == "staged" and not interrupted:
                    interrupted = True
                    raise KeyboardInterrupt
                return result

            with mock.patch.object(
                INSTALLER.os, "replace", side_effect=interrupt_after_first_promotion,
            ):
                with self.assertRaises(KeyboardInterrupt):
                    INSTALLER.copy_shipped_plugin(installed, SHIPPED, False)

            marker = installed.parent / INSTALLER.INSTALL_TRANSACTION
            self.assertTrue(marker.is_file())
            self.assertNotEqual(
                {name: (installed / name).read_bytes() for name in SHIPPED}, before,
            )
            INSTALLER.preflight_plugin_directory(vault)
            after = {name: (installed / name).read_bytes() for name in SHIPPED}
            leftovers = list(installed.parent.glob(".learningos-ui-install-*"))

        self.assertEqual(after, before)
        self.assertEqual(leftovers, [])

    def test_an_interruption_after_full_promotion_accepts_only_the_verified_new_set(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            vault = self._vault(directory)
            installed = vault / ".obsidian" / "plugins" / "learningos-ui"
            for name in SHIPPED:
                (installed / name).write_bytes(f"previous {name}\n".encode())
            expected = {name: (ROOT / "plugin" / name).read_bytes() for name in SHIPPED}

            with mock.patch.object(
                INSTALLER, "_finish_install_transaction", side_effect=KeyboardInterrupt,
            ):
                with self.assertRaises(KeyboardInterrupt):
                    INSTALLER.copy_shipped_plugin(installed, SHIPPED, False)

            marker = installed.parent / INSTALLER.INSTALL_TRANSACTION
            self.assertTrue(marker.is_file())
            promoted = {name: (installed / name).read_bytes() for name in SHIPPED}
            self.assertEqual(promoted, expected)
            INSTALLER.preflight_plugin_directory(vault)
            after = {name: (installed / name).read_bytes() for name in SHIPPED}
            leftovers = list(installed.parent.glob(".learningos-ui-install-*"))

        self.assertEqual(after, expected)
        self.assertEqual(leftovers, [])

    def test_dry_run_never_recovers_or_changes_an_interrupted_transaction(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            vault = self._vault(directory)
            installed = vault / ".obsidian" / "plugins" / "learningos-ui"
            with mock.patch.object(
                INSTALLER, "_prepare_install_workspace", side_effect=KeyboardInterrupt,
            ):
                with self.assertRaises(KeyboardInterrupt):
                    INSTALLER.copy_shipped_plugin(installed, SHIPPED, False)
            before = {
                path.relative_to(vault).as_posix(): path.read_bytes()
                for path in sorted(vault.rglob("*")) if path.is_file()
            }
            result = subprocess.run(
                [sys.executable, str(ROOT / "install.py"), "--vault", str(vault),
                 "--skip-tests", "--dry-run"],
                capture_output=True, text=True, timeout=180, cwd=str(ROOT),
            )
            after = {
                path.relative_to(vault).as_posix(): path.read_bytes()
                for path in sorted(vault.rglob("*")) if path.is_file()
            }

        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("dry-run will not", result.stdout + result.stderr)
        self.assertEqual(after, before)

    def test_a_forged_or_unowned_recovery_workspace_is_never_deleted(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            vault = self._vault(directory)
            installed = vault / ".obsidian" / "plugins" / "learningos-ui"
            parent = installed.parent
            old_hashes = {name: INSTALLER._sha256(installed / name) for name in SHIPPED}
            new_hashes = {name: INSTALLER._sha256(ROOT / "plugin" / name) for name in SHIPPED}
            unowned = parent / ".learningos-ui-install-user-data"
            unowned.mkdir()
            sentinel = unowned / "only-copy.txt"
            sentinel.write_text("must survive", encoding="utf-8")
            marker = parent / INSTALLER.INSTALL_TRANSACTION
            marker.write_text(json.dumps(INSTALLER._transaction_payload(
                unowned.name, SHIPPED, old_hashes, new_hashes,
            )), encoding="utf-8")

            with self.assertRaisesRegex(
                INSTALLER.PluginAssetsError, "unsafe workspace",
            ):
                INSTALLER.preflight_plugin_directory(vault)

            self.assertEqual(sentinel.read_text(encoding="utf-8"), "must survive")
            self.assertTrue(marker.is_file())

    def test_even_a_valid_nonce_workspace_refuses_unknown_recursive_content(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            vault = self._vault(directory)
            installed = vault / ".obsidian" / "plugins" / "learningos-ui"
            with mock.patch.object(
                INSTALLER, "_prepare_install_workspace", side_effect=KeyboardInterrupt,
            ):
                with self.assertRaises(KeyboardInterrupt):
                    INSTALLER.copy_shipped_plugin(installed, SHIPPED, False)
            marker = installed.parent / INSTALLER.INSTALL_TRANSACTION
            transaction = json.loads(marker.read_text(encoding="utf-8"))
            workspace = installed.parent / transaction["workspace"]
            workspace.mkdir()
            sentinel = workspace / "only-copy.txt"
            sentinel.write_text("must survive", encoding="utf-8")

            with self.assertRaisesRegex(
                INSTALLER.PluginAssetsError, "unowned entries",
            ):
                INSTALLER.preflight_plugin_directory(vault)

            self.assertEqual(sentinel.read_text(encoding="utf-8"), "must survive")
            self.assertTrue(marker.is_file())

    def test_incomplete_metadata_is_retired_only_before_any_promotion(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            vault = self._vault(directory)
            installed = vault / ".obsidian" / "plugins" / "learningos-ui"
            parent = installed.parent
            marker = parent / INSTALLER.INSTALL_TRANSACTION

            marker.write_text("{", encoding="utf-8")
            INSTALLER.preflight_plugin_directory(vault)
            self.assertFalse(marker.exists())

            for name in SHIPPED:
                (installed / name).write_bytes(f"previous {name}\n".encode())
            before = {name: (installed / name).read_bytes() for name in SHIPPED}
            original_replace = INSTALLER.os.replace

            def interrupt_before_first_promotion(source, destination):
                if Path(source).parent.name == "staged":
                    raise KeyboardInterrupt
                return original_replace(source, destination)

            with mock.patch.object(
                INSTALLER.os, "replace", side_effect=interrupt_before_first_promotion,
            ):
                with self.assertRaises(KeyboardInterrupt):
                    INSTALLER.copy_shipped_plugin(installed, SHIPPED, False)
            transaction = json.loads(marker.read_text(encoding="utf-8"))
            plan = parent / transaction["workspace"] / INSTALLER.INSTALL_PLAN
            plan.write_text("{", encoding="utf-8")

            INSTALLER.preflight_plugin_directory(vault)
            after = {name: (installed / name).read_bytes() for name in SHIPPED}
            leftovers = list(parent.glob(".learningos-ui-install-*"))

        self.assertEqual(after, before)
        self.assertEqual(leftovers, [])

    def test_a_partial_recovery_reports_that_it_changed_live_files(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            vault = self._vault(directory)
            installed = vault / ".obsidian" / "plugins" / "learningos-ui"
            for name in SHIPPED:
                (installed / name).write_bytes(f"previous {name}\n".encode())
            original_replace = INSTALLER.os.replace
            promotions = 0

            def interrupt_after_two_promotions(source, destination):
                nonlocal promotions
                result = original_replace(source, destination)
                if Path(source).parent.name == "staged":
                    promotions += 1
                    if promotions == 2:
                        raise KeyboardInterrupt
                return result

            with mock.patch.object(
                INSTALLER.os, "replace", side_effect=interrupt_after_two_promotions,
            ):
                with self.assertRaises(KeyboardInterrupt):
                    INSTALLER.copy_shipped_plugin(installed, SHIPPED, False)

            restores = 0

            def fail_second_restore(source, destination):
                nonlocal restores
                if Path(source).parent.name == "backups":
                    restores += 1
                    if restores == 2:
                        raise OSError("forced second restore failure")
                return original_replace(source, destination)

            argv = ["install.py", "--vault", str(vault), "--skip-tests"]
            with mock.patch.object(sys, "argv", argv), mock.patch.object(
                INSTALLER.os, "replace", side_effect=fail_second_restore,
            ):
                with self.assertRaises(SystemExit) as stopped:
                    INSTALLER.main()

            message = str(stopped.exception)
            marker = installed.parent / INSTALLER.INSTALL_TRANSACTION
            marker_exists = marker.is_file()

        self.assertIn("restored", message)
        self.assertIn("evidence retained", message)
        self.assertNotIn("nothing was written", message)
        self.assertTrue(marker_exists)

    def test_workspace_directory_is_synced_before_the_first_live_promotion(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            vault = self._vault(directory)
            installed = vault / ".obsidian" / "plugins" / "learningos-ui"
            parent = installed.parent
            original_sync = INSTALLER._sync_directory
            original_replace = INSTALLER.os.replace
            events = []

            def record_sync(path):
                path = Path(path)
                workspace_exists = any(
                    entry.is_dir() and entry.name.startswith(INSTALLER.INSTALL_WORKSPACE_PREFIX)
                    for entry in parent.iterdir()
                )
                events.append(("sync", path, workspace_exists))
                return original_sync(path)

            def record_replace(source, destination):
                if Path(source).parent.name == "staged":
                    events.append(("promote", Path(destination), True))
                return original_replace(source, destination)

            with mock.patch.object(
                INSTALLER, "_sync_directory", side_effect=record_sync,
            ), mock.patch.object(INSTALLER.os, "replace", side_effect=record_replace):
                INSTALLER.copy_shipped_plugin(installed, SHIPPED, False)

        first_promotion = next(i for i, event in enumerate(events) if event[0] == "promote")
        durable_workspace = [
            i for i, event in enumerate(events)
            if event[0] == "sync" and event[1] == parent and event[2]
        ]
        self.assertTrue(durable_workspace)
        self.assertLess(durable_workspace[0], first_promotion)

    def test_concurrent_promotions_cannot_share_or_replace_the_transaction(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            vault = self._vault(directory)
            installed = vault / ".obsidian" / "plugins" / "learningos-ui"
            original_acquire = INSTALLER._write_json_exclusive
            arrivals = threading.Barrier(2)
            loser_finished = threading.Event()

            def synchronized_acquire(path, payload):
                arrivals.wait(timeout=10)
                try:
                    result = original_acquire(path, payload)
                except FileExistsError:
                    loser_finished.set()
                    raise
                if not loser_finished.wait(timeout=10):
                    raise AssertionError("the competing installer never attempted the marker")
                return result

            def install_once():
                try:
                    INSTALLER.copy_shipped_plugin(installed, SHIPPED, False)
                    return "installed"
                except INSTALLER.PluginAssetsError as exc:
                    return str(exc)

            with mock.patch.object(
                INSTALLER, "_write_json_exclusive", side_effect=synchronized_acquire,
            ):
                with ThreadPoolExecutor(max_workers=2) as pool:
                    outcomes = list(pool.map(lambda _: install_once(), range(2)))

            leftovers = list(installed.parent.glob(".learningos-ui-install-*"))
            status = self._check(vault)

        self.assertEqual(outcomes.count("installed"), 1, outcomes)
        self.assertEqual(sum("concurrent promotion" in row for row in outcomes), 1, outcomes)
        self.assertEqual(leftovers, [])
        self.assertEqual(status.returncode, 0, status.stdout + status.stderr)

    def test_copy_failure_happens_before_vault_configuration_or_enablement(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            vault = Path(directory) / "vault"
            vault.mkdir()
            argv = ["install.py", "--vault", str(vault), "--skip-tests"]
            with mock.patch.object(sys, "argv", argv), mock.patch.object(
                INSTALLER,
                "copy_shipped_plugin",
                side_effect=INSTALLER.PluginAssetsError("forced copy failure"),
            ):
                with self.assertRaisesRegex(SystemExit, "forced copy failure"):
                    INSTALLER.main()

            self.assertFalse((vault / ".obsidian" / "app.json").exists())
            self.assertFalse((vault / ".obsidian" / "core-plugins.json").exists())
            self.assertFalse((vault / ".obsidian" / "community-plugins.json").exists())

    def test_the_installer_copies_only_the_declared_files(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            vault = Path(directory) / "vault"
            vault.mkdir()
            result = subprocess.run(
                [sys.executable, str(ROOT / "install.py"),
                 "--vault", str(vault), "--skip-tests"],
                capture_output=True, text=True, timeout=180, cwd=str(ROOT),
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            installed = vault / ".obsidian" / "plugins" / "learningos-ui"
            self.assertEqual(sorted(p.name for p in installed.iterdir()), sorted(SHIPPED))
            status = self._check(vault)
        self.assertEqual(status.returncode, 0, status.stdout + status.stderr)
        self.assertIn("running this build", status.stdout)

    def test_the_checker_names_unknown_entries_even_when_all_assets_are_missing(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            vault = Path(directory) / "vault"
            installed = vault / ".obsidian" / "plugins" / "learningos-ui"
            installed.mkdir(parents=True)
            stray = installed / "unexplained.txt"
            stray.write_text("keep me", encoding="utf-8")
            result = self._check(vault)
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("DOES NOT OWN", result.stdout)
        self.assertIn(str(stray), result.stdout)

    def test_the_checker_refuses_a_symlinked_installed_root(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            vault = Path(directory) / "vault"
            plugins = vault / ".obsidian" / "plugins"
            plugins.mkdir(parents=True)
            outside = Path(directory) / "outside-plugin"
            outside.mkdir()
            for name in SHIPPED:
                shutil.copy2(ROOT / "plugin" / name, outside / name)
            (plugins / "learningos-ui").symlink_to(outside, target_is_directory=True)
            result = self._check(vault)
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("NOT A REAL DIRECTORY", result.stdout)
        self.assertIn("symlink", result.stdout)

    def test_the_checker_refuses_symlinked_installed_parent_components(self) -> None:
        for component in (".obsidian", "plugins"):
            with self.subTest(component=component), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                vault = root / "vault"
                vault.mkdir()
                outside = root / "outside"
                if component == ".obsidian":
                    installed = outside / "plugins" / "learningos-ui"
                    installed.mkdir(parents=True)
                    (vault / ".obsidian").symlink_to(outside, target_is_directory=True)
                else:
                    (vault / ".obsidian").mkdir()
                    installed = outside / "learningos-ui"
                    installed.mkdir(parents=True)
                    (vault / ".obsidian" / "plugins").symlink_to(
                        outside, target_is_directory=True,
                    )
                for name in SHIPPED:
                    shutil.copy2(ROOT / "plugin" / name, installed / name)
                result = self._check(vault)
            self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
            self.assertIn("PATH COMPONENT", result.stdout)
            self.assertIn("symlink", result.stdout)

    def test_build_identity_includes_every_direct_packaging_input(self) -> None:
        build = (ROOT / "build.mjs").read_text(encoding="utf-8")
        for relative in (
            "plugin-assets.json",
            "scripts/plugin-assets.mjs",
            "scripts/contract-locks.mjs",
            "plugin/manifest.json",
        ):
            self.assertIn(f"'{relative}'", build)
        self.assertIn("DIRECT_BUILD_INPUTS.flatMap", build)
        self.assertIn("...DIRECT_BUILD_INPUTS", build)

    def test_a_missing_declared_build_input_is_fatal(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            checkout = Path(directory) / "obsidian-ui"
            shutil.copytree(
                ROOT,
                checkout,
                ignore=shutil.ignore_patterns("node_modules", ".git"),
            )
            (checkout / "node_modules").symlink_to(
                ROOT / "node_modules", target_is_directory=True,
            )
            (checkout / "package-lock.json").unlink()
            result = subprocess.run(
                ["node", "build.mjs"], cwd=checkout,
                capture_output=True, text=True, timeout=120,
            )
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("required direct input", result.stdout + result.stderr)
        self.assertIn("package-lock.json is missing", result.stdout + result.stderr)

    def test_a_dry_run_refuses_without_writing(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            vault = self._vault(directory)
            installed = vault / ".obsidian" / "plugins" / "learningos-ui"
            (installed / "unexplained.txt").write_text("keep me", encoding="utf-8")
            result = subprocess.run(
                [sys.executable, str(ROOT / "install.py"), "--vault", str(vault),
                 "--skip-tests", "--dry-run"],
                capture_output=True, text=True, timeout=180, cwd=str(ROOT),
            )
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn("unexplained.txt", result.stdout + result.stderr)

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


class RealVaultInstallGateTests(unittest.TestCase):
    """`real_vault_install_problems` — the release-hardening gate (Phase 5).

    Unknown must never read as clean, and a stale-but-technically-false dirty
    flag must not be trusted on its own: the actual current Git revision is
    re-checked against what build-info.json claims.
    """

    GOOD_UI_REV = "a" * 40
    GOOD_CORE_REV = "b" * 40

    def _clean_build_info(self) -> dict:
        return {
            "source_revision": self.GOOD_UI_REV,
            "source_dirty": False,
            "core_revision": self.GOOD_CORE_REV,
            "core_dirty": False,
        }

    def _assert_ok(self, build_info: dict) -> None:
        with mock.patch.object(
            INSTALLER, "_git_rev_parse",
            side_effect=lambda repo: self.GOOD_CORE_REV if repo == Path("/vault")
            else self.GOOD_UI_REV,
        ):
            problems = INSTALLER.real_vault_install_problems(Path("/vault"), build_info)
        self.assertEqual(problems, [])

    def test_a_clean_matching_pair_has_no_problems(self) -> None:
        self._assert_ok(self._clean_build_info())

    def test_dirty_ui_blocks(self) -> None:
        info = {**self._clean_build_info(), "source_dirty": True}
        with mock.patch.object(
            INSTALLER, "_git_rev_parse",
            side_effect=lambda repo: self.GOOD_CORE_REV if repo == Path("/vault")
            else self.GOOD_UI_REV,
        ):
            problems = INSTALLER.real_vault_install_problems(Path("/vault"), info)
        self.assertTrue(any("UI worktree is dirty" in p for p in problems), problems)

    def test_dirty_core_blocks(self) -> None:
        info = {**self._clean_build_info(), "core_dirty": True}
        with mock.patch.object(
            INSTALLER, "_git_rev_parse",
            side_effect=lambda repo: self.GOOD_CORE_REV if repo == Path("/vault")
            else self.GOOD_UI_REV,
        ):
            problems = INSTALLER.real_vault_install_problems(Path("/vault"), info)
        self.assertTrue(any("Core worktree is dirty" in p for p in problems), problems)

    def test_unknown_dirty_flag_blocks_like_a_definite_one(self) -> None:
        """`None` (never checked) must block exactly like `True` does."""
        info = {**self._clean_build_info(), "source_dirty": None}
        with mock.patch.object(
            INSTALLER, "_git_rev_parse",
            side_effect=lambda repo: self.GOOD_CORE_REV if repo == Path("/vault")
            else self.GOOD_UI_REV,
        ):
            problems = INSTALLER.real_vault_install_problems(Path("/vault"), info)
        self.assertTrue(any("UI worktree is dirty" in p for p in problems), problems)

    def test_git_command_failure_blocks(self) -> None:
        """`_git_rev_parse` returning None (unreadable state) must refuse, not pass."""
        with mock.patch.object(INSTALLER, "_git_rev_parse", return_value=None):
            problems = INSTALLER.real_vault_install_problems(
                Path("/vault"), self._clean_build_info())
        self.assertTrue(any("cannot read the UI repository" in p for p in problems), problems)
        self.assertTrue(any("cannot read the Core repository" in p for p in problems), problems)

    def test_mismatched_ui_revision_blocks(self) -> None:
        with mock.patch.object(
            INSTALLER, "_git_rev_parse",
            side_effect=lambda repo: self.GOOD_CORE_REV if repo == Path("/vault")
            else "c" * 40,
        ):
            problems = INSTALLER.real_vault_install_problems(
                Path("/vault"), self._clean_build_info())
        self.assertTrue(any("source_revision" in p and "does not match" in p for p in problems), problems)

    def test_mismatched_core_revision_blocks(self) -> None:
        with mock.patch.object(
            INSTALLER, "_git_rev_parse",
            side_effect=lambda repo: "d" * 40 if repo == Path("/vault")
            else self.GOOD_UI_REV,
        ):
            problems = INSTALLER.real_vault_install_problems(
                Path("/vault"), self._clean_build_info())
        self.assertTrue(any("core_revision" in p and "does not match" in p for p in problems), problems)

    def test_malformed_revision_string_blocks_before_any_git_call(self) -> None:
        info = {**self._clean_build_info(), "source_revision": "not-a-sha"}
        problems = INSTALLER.real_vault_install_problems(Path("/vault"), info)
        self.assertTrue(any("not a readable" in p for p in problems), problems)


class RealVaultInstallEndToEndTests(unittest.TestCase):
    """A fixture/dry-run install must never trip the real-vault gate at all."""

    def test_fixture_dry_run_never_runs_the_real_vault_gate(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            # Not even a Git repository. If the real-vault gate ran here it
            # would fail on "cannot read the Git revision" — this directory
            # both lacks system/ARCHITECTURE.md (not live) and the run is
            # --dry-run, either of which alone must already skip the gate.
            vault = Path(directory) / "vault"
            vault.mkdir()
            result = subprocess.run(
                [sys.executable, str(ROOT / "install.py"), "--vault", str(vault),
                 "--skip-tests", "--dry-run"],
                capture_output=True, text=True, timeout=180, cwd=str(ROOT),
            )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


class LegacyLocalMetadataTests(unittest.TestCase):
    """Local stamps classify rollback bytes; they never become a release receipt."""

    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="learningos-legacy-metadata-")
        self.addCleanup(temporary.cleanup)
        self.base = Path(temporary.name).resolve()
        self.core = self.base / "selected-core"
        self.core.mkdir()
        self._git("init", "-q")
        (self.core / ".gitignore").write_text(".obsidian/\n")
        self.ancestor = self._commit("local Core")
        self.hosted_core = self._commit("hosted Core")
        self.previous = self.base / "previous"
        self.destination = self.core / ".obsidian/plugins/learningos-ui"
        (self.previous / "plugin").mkdir(parents=True)
        self.destination.mkdir(parents=True)
        for name in SHIPPED:
            if name != "build-info.json":
                content = ("hosted runtime " + name).encode()
                (self.previous / "plugin" / name).write_bytes(content)
                (self.destination / name).write_bytes(content)
        self.hosted_info = {
            "schema_version": 5, "source_revision": "a" * 40,
            "core_revision": self.hosted_core, "source_dirty": False, "core_dirty": False,
            "source_fingerprint": "sha256:" + "f" * 64,
            "bundle_sha256": "sha256:" + INSTALLER._sha256(self.destination / "main.js"),
            "stylesheet_sha256": "sha256:" + INSTALLER._sha256(self.destination / "styles.css"),
            "node_version": "v22.1.0", "modules": ["src/main.ts"],
            "stylesheet_modules": ["src/styles/00-tokens.css"], "manifest_contract_version": 16,
        }
        (self.previous / "plugin/build-info.json").write_text(json.dumps(self.hosted_info))
        self.local_info = {**self.hosted_info, "core_revision": self.ancestor,
                           "node_version": "v26.6.0"}
        self._write_local()
        self.old = {
            "core_sha": self.hosted_core, "ui_sha": self.hosted_info["source_revision"],
            "workflow_run_id": "12", "runtime_source_fingerprint": self.hosted_info["source_fingerprint"],
            "shipped_asset_sha256": {
                name: "sha256:" + INSTALLER._sha256(self.previous / "plugin" / name)
                for name in SHIPPED},
        }
        (self.previous / "pair-receipt.json").write_text(json.dumps(self.old))

    def _git(self, *args):
        result = subprocess.run(["git", "-C", str(self.core), *args],
                                capture_output=True, text=True, timeout=30, check=True)
        return result.stdout.strip()

    def _commit(self, label):
        (self.core / "identity.txt").write_text(label)
        self._git("add", ".gitignore", "identity.txt")
        self._git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid",
                  "commit", "-qm", label)
        return self._git("rev-parse", "HEAD")

    def _write_local(self):
        (self.destination / "build-info.json").write_text(json.dumps(self.local_info, indent=2))

    def _hashes(self):
        return {name: "sha256:" + INSTALLER._sha256(self.destination / name) for name in SHIPPED}

    def _check(self):
        return INSTALLER.verify_legacy_local_metadata(
            self.destination, self.previous, self.old, self._hashes(), core_root=self.core)

    def test_known_ancestor_and_node_stamps_are_classified_without_claiming_acceptance(self):
        result = self._check()
        self.assertEqual(result, {
            "local_core_sha": self.ancestor, "previous_hosted_core_sha": self.hosted_core,
            "core_relation": "ancestor", "metadata_fields": ["core_revision", "node_version"],
        })
        self.local_info["node_version"] = self.hosted_info["node_version"]
        self._write_local()
        self.assertEqual(self._check()["metadata_fields"], ["core_revision"])
        self.local_info.update(core_revision=self.hosted_core, node_version="v26.6.0")
        self._write_local()
        self.assertEqual(self._check(), {
            "local_core_sha": self.hosted_core, "previous_hosted_core_sha": self.hosted_core,
            "core_relation": "same", "metadata_fields": ["node_version"],
        })

    def test_future_unrelated_unknown_and_noncommit_core_stamps_refuse(self):
        future = self._commit("later Core")
        tree = self._git("rev-parse", "HEAD^{tree}")
        unrelated = self._git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid",
                              "commit-tree", tree, "-m", "unrelated Core")
        blob = self._git("rev-parse", "HEAD:identity.txt")
        for revision in (future, unrelated, "e" * 40, blob, "HEAD~1"):
            with self.subTest(revision=revision):
                self.local_info["core_revision"] = revision
                self._write_local()
                with self.assertRaisesRegex(INSTALLER.PluginAssetsError,
                                            "ancestor|known commit|full commit"):
                    self._check()

    def test_unavailable_git_refuses_with_a_typed_classification_error(self):
        with mock.patch.object(INSTALLER.subprocess, "run", side_effect=FileNotFoundError("no git")):
            with self.assertRaisesRegex(INSTALLER.PluginAssetsError, "ancestry could not be verified"):
                self._check()

    def test_other_metadata_and_clean_flag_changes_stay_strict(self):
        original = dict(self.local_info)
        for key, value in (
                ("core_dirty", True), ("core_dirty", 0), ("source_dirty", True),
                ("schema_version", 5.0), ("source_revision", "b" * 40),
                ("source_fingerprint", "sha256:" + "0" * 64), ("modules", []),
                ("stylesheet_modules", ["different.css"]), ("node_version", "v26.x"),
                ("manifest_contract_version", True), ("unexpected", "extra")):
            with self.subTest(field=key, value=value):
                self.local_info = {**original, key: value}
                self._write_local()
                with self.assertRaisesRegex(INSTALLER.PluginAssetsError, "beyond permitted"):
                    self._check()

    def test_runtime_drift_and_no_stamp_difference_refuse(self):
        self.local_info = dict(self.hosted_info)
        self._write_local()
        with self.assertRaisesRegex(INSTALLER.PluginAssetsError, "no permitted stamp difference"):
            self._check()
        (self.destination / "main.js").write_bytes(b"changed runtime")
        with self.assertRaisesRegex(INSTALLER.PluginAssetsError, "runtime assets"):
            self._check()

    def test_rollback_preserves_exact_local_bytes_and_distinguishes_core_stamps(self):
        classification = self._check()
        before = {name: (self.destination / name).read_bytes() for name in SHIPPED}
        hashes = self._hashes()
        rollback = self.base / "original-local-before-state"
        INSTALLER.legacy_rollback_destination(rollback, (self.core, self.previous, ROOT))
        INSTALLER.preserve_legacy_rollback(
            self.destination, self.previous, rollback, self.old, hashes, classification)
        self.assertEqual({name: (rollback / "plugin" / name).read_bytes() for name in SHIPPED}, before)
        self.assertEqual({name: (self.destination / name).read_bytes() for name in SHIPPED}, before)
        record = json.loads((rollback / "before-state.json").read_text())
        self.assertEqual(record["core_sha"], self.ancestor)
        self.assertEqual(record["previous_hosted_core_sha"], self.hosted_core)
        self.assertEqual(record["core_relation"], "ancestor")
        self.assertEqual(record["accepted_difference"], "build-info.json core_revision and node_version only")
        self.assertEqual(record["shipped_asset_sha256"], hashes)
        self.assertEqual((rollback / "previous-hosted-pair-receipt.json").read_bytes(),
                         (self.previous / "pair-receipt.json").read_bytes())

    def test_accepted_update_requires_and_preserves_local_rollback_with_publication_checks(self):
        artifact, ui = self.base / "new-artifact", self.base / "selected-ui"
        shutil.copytree(self.previous / "plugin", artifact / "plugin")
        shutil.copytree(self.previous / "plugin", ui / "plugin")
        shutil.copytree(ROOT / "bases", ui / "bases")
        shutil.copytree(ROOT / "vault-config", ui / "vault-config")
        shutil.copy2(ROOT / "plugin-assets.json", ui / "plugin-assets.json")
        info = {**self.hosted_info, "source_revision": "b" * 40,
                "source_fingerprint": "sha256:" + "d" * 64}
        (artifact / "plugin/main.js").write_bytes(b"new accepted runtime")
        info["bundle_sha256"] = "sha256:" + INSTALLER._sha256(artifact / "plugin/main.js")
        (artifact / "plugin/build-info.json").write_text(json.dumps(info))
        receipt = {**self.old, "ui_sha": info["source_revision"], "workflow_run_id": "13",
                   "runtime_source_fingerprint": info["source_fingerprint"],
                   "shipped_asset_sha256": {
                       name: "sha256:" + INSTALLER._sha256(artifact / "plugin" / name)
                       for name in SHIPPED}}
        before = {name: (self.destination / name).read_bytes() for name in SHIPPED}
        (self.destination / "data.json").write_bytes(b'{"working-draft":"keep exactly"}')
        rollback = self.base / "original-before-update"
        actual_run = subprocess.run

        def run(args, **kwargs):
            # Release cleanliness and remote proof are separate tested owners.
            # Keep actual Git object/ancestry calls in the selected Core fixture.
            if args[:3] == ["git", "status", "--porcelain=v1"]:
                return subprocess.CompletedProcess(args, 0, b"", b"")
            return actual_run(args, **kwargs)

        with mock.patch.object(INSTALLER, "HERE", ui), \
                mock.patch.object(INSTALLER, "verified_artifact", side_effect=lambda _, directory:
                                  receipt if directory == artifact else self.old), \
                mock.patch.object(INSTALLER, "real_vault_install_problems", return_value=[]), \
                mock.patch.object(INSTALLER, "_git_rev_parse", side_effect=lambda directory:
                                  self.hosted_core if directory == self.core else receipt["ui_sha"]), \
                mock.patch.object(INSTALLER, "corroborate_hosted_pair") as hosted, \
                mock.patch.object(INSTALLER, "verify_published_artifact") as published, \
                mock.patch.object(INSTALLER, "_hosted_run") as previous_run, \
                mock.patch.object(INSTALLER.subprocess, "run", side_effect=run), \
                mock.patch.object(INSTALLER, "smoke_test_cli"):
            with self.assertRaisesRegex(INSTALLER.PluginAssetsError, "requires --legacy-rollback"):
                INSTALLER.install_accepted_artifact(
                    self.core, artifact, self.previous, "14", "15", dry=False)
            self.assertFalse(rollback.exists())
            self.assertEqual({name: (self.destination / name).read_bytes() for name in SHIPPED}, before)
            INSTALLER.install_accepted_artifact(
                self.core, artifact, self.previous, "14", "15", dry=False, legacy_rollback=rollback)
        self.assertEqual({name: (rollback / "plugin" / name).read_bytes() for name in SHIPPED}, before)
        for name in SHIPPED:
            self.assertEqual((self.destination / name).read_bytes(), (artifact / "plugin" / name).read_bytes())
        self.assertEqual((self.destination / "data.json").read_bytes(), b'{"working-draft":"keep exactly"}')
        hosted.assert_called_with(receipt, "14", "15")
        previous_run.assert_called_once_with(
            "Aram164/LearningOS", self.old["workflow_run_id"], self.old["core_sha"],
            ".github/workflows/release-pair.yml")
        published.assert_has_calls([mock.call(artifact, receipt),
                                    mock.call(artifact, receipt), mock.call(self.previous, self.old)])


class AcceptedArtifactTests(unittest.TestCase):
    def _release(self, base):
        vault, artifact = base / 'vault', base / 'artifact'
        vault.mkdir()
        source = artifact / 'plugin'
        source.mkdir(parents=True)
        for name in SHIPPED:
            (source / name).write_bytes(name.encode())
        (source / 'build-info.json').write_text(json.dumps({
            'source_revision': 'a' * 40, 'core_revision': 'b' * 40,
            'source_dirty': False, 'core_dirty': False,
        }))
        receipt = {'core_sha': 'b' * 40, 'ui_sha': 'a' * 40,
                   'workflow_run_id': '12',
                   'shipped_asset_sha256': {name: 'sha256:' + INSTALLER._sha256(source / name)
                                            for name in SHIPPED}}
        self.fake_ui = base / 'obsidian-ui'
        (self.fake_ui / 'plugin').mkdir(parents=True)
        shutil.copytree(ROOT / 'bases', self.fake_ui / 'bases')
        shutil.copytree(ROOT / 'vault-config', self.fake_ui / 'vault-config')
        for name in SHIPPED:
            shutil.copy2(source / name, self.fake_ui / 'plugin' / name)
        return vault, artifact, receipt

    def test_accepted_mode_installs_verified_bytes_without_local_rebuild_or_source_changes(self):
        with tempfile.TemporaryDirectory() as directory:
            vault, artifact, receipt = self._release(Path(directory))
            with mock.patch.object(INSTALLER, 'verified_artifact', return_value=receipt), \
                    mock.patch.object(INSTALLER, 'corroborate_hosted_pair') as hosted, \
                    mock.patch.object(INSTALLER, 'verify_published_artifact'), \
                    mock.patch.object(INSTALLER, 'HERE', self.fake_ui), \
                    mock.patch.object(INSTALLER, '_git_rev_parse', side_effect=lambda root:
                                      receipt['core_sha'] if root == vault else receipt['ui_sha']), \
                    mock.patch.object(INSTALLER.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, b'', b'')), \
                    mock.patch.object(INSTALLER, 'smoke_test_cli'), \
                    mock.patch.object(INSTALLER, 'run_ui_tests', side_effect=AssertionError('local rebuild forbidden')):
                INSTALLER.install_accepted_artifact(vault, artifact, None, '13', '14', dry=False)
            hosted.assert_called_once_with(receipt, '13', '14')
            installed = vault / '.obsidian/plugins/learningos-ui'
            self.assertEqual({p.name for p in installed.iterdir()}, set(SHIPPED))
            for name in SHIPPED:
                self.assertEqual((installed / name).read_bytes(), (artifact / 'plugin' / name).read_bytes())
                self.assertEqual((self.fake_ui / 'plugin' / name).read_bytes(), (artifact / 'plugin' / name).read_bytes())

    def test_local_bytes_must_equal_the_published_zip(self):
        with tempfile.TemporaryDirectory() as directory:
            _, artifact, receipt = self._release(Path(directory))
            (artifact / 'pair-receipt.json').write_text(json.dumps(receipt))
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, 'w') as archive:
                archive.writestr('pair-receipt.json', (artifact / 'pair-receipt.json').read_bytes())
                for name in SHIPPED:
                    archive.writestr('plugin/' + name, (artifact / 'plugin' / name).read_bytes())
            published = buffer.getvalue()
            metadata = {'total_count': 1, 'artifacts': [{
                'name': 'learningos-pair-' + receipt['core_sha'][:12] + '-' + receipt['ui_sha'][:12],
                'expired': False, 'id': 99, 'digest': 'sha256:' + hashlib.sha256(published).hexdigest(),
            }]}

            def github(args, **kwargs):
                if args[-1].endswith('/zip'):
                    kwargs['stdout'].write(published)
                    return subprocess.CompletedProcess(args, 0, None, b'')
                return subprocess.CompletedProcess(args, 0, json.dumps(metadata), '')

            with mock.patch.object(INSTALLER.subprocess, 'run', side_effect=github):
                INSTALLER.verify_published_artifact(artifact, receipt)
                (artifact / 'plugin' / SHIPPED[0]).write_bytes(b'forged-local-bundle')
                with self.assertRaisesRegex(INSTALLER.PluginAssetsError, 'differs from the published'):
                    INSTALLER.verify_published_artifact(artifact, receipt)

    def test_stale_pair_refuses_before_creating_any_install_state(self):
        with tempfile.TemporaryDirectory() as directory:
            vault, artifact, receipt = self._release(Path(directory))
            with mock.patch.object(INSTALLER, 'verified_artifact', return_value=receipt), \
                    mock.patch.object(INSTALLER, '_git_rev_parse', return_value='c' * 40), \
                    mock.patch.object(INSTALLER.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, b'', b'')):
                with self.assertRaisesRegex(INSTALLER.PluginAssetsError, 'current source pair'):
                    INSTALLER.install_accepted_artifact(vault, artifact, None, '13', '14', dry=False)
            self.assertFalse((vault / '.obsidian').exists())

    def test_retry_recovers_when_source_output_alignment_failed_after_vault_promotion(self):
        with tempfile.TemporaryDirectory() as directory:
            vault, artifact, receipt = self._release(Path(directory))
            previous = Path(directory) / 'previous-artifact'
            installed = vault / '.obsidian/plugins/learningos-ui'
            installed.mkdir(parents=True)
            (installed / 'data.json').write_bytes(b'{"draft":"keep"}')
            (self.fake_ui / 'plugin/main.js').write_bytes(b'previous bundle')
            for name in SHIPPED:
                shutil.copy2(self.fake_ui / 'plugin' / name, installed / name)
            old = {**receipt, 'shipped_asset_sha256': {
                name: 'sha256:' + INSTALLER._sha256(installed / name) for name in SHIPPED}}
            original = INSTALLER.os.replace

            def fail_source_manifest(source, destination):
                if Path(source).parent.name == 'staged' and Path(destination) == self.fake_ui / 'plugin/manifest.json':
                    raise OSError('injected source promotion failure')
                return original(source, destination)

            with mock.patch.object(INSTALLER, 'verified_artifact', side_effect=lambda _, path:
                                   receipt if path == artifact else old), \
                    mock.patch.object(INSTALLER, 'corroborate_hosted_pair'), \
                    mock.patch.object(INSTALLER, 'verify_published_artifact'), \
                    mock.patch.object(INSTALLER, 'HERE', self.fake_ui), \
                    mock.patch.object(INSTALLER, '_git_rev_parse', side_effect=lambda root:
                                      receipt['core_sha'] if root == vault else receipt['ui_sha']), \
                    mock.patch.object(INSTALLER.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, b'', b'')), \
                    mock.patch.object(INSTALLER, 'smoke_test_cli'):
                with mock.patch.object(INSTALLER.os, 'replace', side_effect=fail_source_manifest):
                    with self.assertRaises(INSTALLER.PluginAssetsError):
                        INSTALLER.install_accepted_artifact(vault, artifact, previous, '13', '14', dry=False)
                self.assertEqual((installed / 'main.js').read_bytes(), (artifact / 'plugin/main.js').read_bytes())
                self.assertEqual((self.fake_ui / 'plugin/main.js').read_bytes(), b'previous bundle')
                INSTALLER.install_accepted_artifact(vault, artifact, previous, '13', '14', dry=False)
            self.assertEqual((installed / 'data.json').read_bytes(), b'{"draft":"keep"}')
            self.assertEqual((self.fake_ui / 'plugin/main.js').read_bytes(), (artifact / 'plugin/main.js').read_bytes())

    def test_artifact_transaction_preserves_settings_and_source_checkout(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            source, target = base / 'artifact/plugin', base / 'vault/.obsidian/plugins/learningos-ui'
            source.mkdir(parents=True)
            target.mkdir(parents=True)
            (target / 'data.json').write_bytes(b'{"learner":"preserve exactly"}')
            source_before = {name: (ROOT / 'plugin' / name).read_bytes() for name in SHIPPED}
            for name in SHIPPED:
                (source / name).write_bytes(b'accepted-' + name.encode())
                (target / name).write_bytes(b'previous-' + name.encode())
            expected = {name: INSTALLER._sha256(source / name) for name in SHIPPED}
            INSTALLER.copy_shipped_plugin(target, SHIPPED, False,
                                          source_dir=source, expected_hashes=expected)
            self.assertEqual((target / 'data.json').read_bytes(), b'{"learner":"preserve exactly"}')
            for name in SHIPPED:
                self.assertEqual((target / name).read_bytes(), (source / name).read_bytes())
                self.assertEqual((ROOT / 'plugin' / name).read_bytes(), source_before[name])

    def test_changed_receipted_source_refuses_before_creating_install_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            source, target = base / 'artifact/plugin', base / 'vault/.obsidian/plugins/learningos-ui'
            source.mkdir(parents=True)
            for name in SHIPPED:
                (source / name).write_bytes(name.encode())
            expected = {name: INSTALLER._sha256(source / name) for name in SHIPPED}
            (source / SHIPPED[0]).write_bytes(b'tampered')
            with self.assertRaisesRegex(INSTALLER.PluginAssetsError, 'receipt'):
                INSTALLER.copy_shipped_plugin(target, SHIPPED, False,
                                              source_dir=source, expected_hashes=expected)
            self.assertFalse(target.exists())

    def test_hosted_pair_requires_the_ui_actual_producer_checkout(self):
        core, ui = 'a' * 40, 'b' * 40
        receipt = {'core_sha': core, 'ui_sha': ui, 'workflow_run_id': '12'}
        with mock.patch.object(INSTALLER, '_hosted_run', return_value={
            'jobs': [{'databaseId': 77, 'conclusion': 'success'}],
        }), mock.patch.object(INSTALLER.subprocess, 'run', return_value=subprocess.CompletedProcess(
            [], 0, 'Core commit checked out: ' + 'c' * 40, '')):
            with self.assertRaisesRegex(INSTALLER.PluginAssetsError, 'producer'):
                INSTALLER.corroborate_hosted_pair(receipt, '13', '14')

    def test_hosted_run_rejects_skipped_jobs_even_when_overall_run_succeeded(self):
        payload = {'status': 'completed', 'conclusion': 'success', 'headSha': 'a' * 40,
                   'jobs': [{'conclusion': 'skipped'}]}
        with mock.patch.object(INSTALLER.subprocess, 'run', return_value=subprocess.CompletedProcess(
            [], 0, json.dumps(payload), '')):
            with self.assertRaisesRegex(INSTALLER.PluginAssetsError, 'hosted'):
                INSTALLER._hosted_run('Aram164/LearningOS', '12', 'a' * 40)


if __name__ == "__main__":
    unittest.main()
