#!/usr/bin/env python3
"""Regression tests for fail-closed installer prerequisites."""

from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("learningos_ui_installer", ROOT / "install.py")
assert SPEC and SPEC.loader
INSTALLER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(INSTALLER)


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


if __name__ == "__main__":
    unittest.main()
