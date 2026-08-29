#!/usr/bin/env python3
"""Regression tests for fail-closed installer prerequisites."""

from __future__ import annotations

import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest
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


if __name__ == "__main__":
    unittest.main()
