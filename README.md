# LearningOS Obsidian app v2

The human work surface for LearningOS. Obsidian opens `../repository/` as the
vault; this project presents its module-first curriculum without becoming a
second source of truth.

## Workflow

1. Open Home: resume the last stage or choose any Bachelor's module, skill, or
   thesis/project module. The resume pointer never hides alternatives.
2. Choose a module, optional component, and lecture/topic/milestone unit.
3. Work through the unit's one current study map. Exact resources, done-when
   criteria, scratch note, attachments, feedback and detours stay stage-owned.
4. Review Ultimate Reference, Exercise Bank, Mock Exam and other durable
   artifacts through stable unit references.
5. Prepare shelving, review destinations/rationale/diffs, and apply only
   selected proposal IDs through the guarded gateway.
6. End the learning session deliberately: review the exact gateway ledger,
   then optionally commit and push only those files.

Navigation is **Home · Bachelor's · Skills · Thesis & projects · Shelving
· Library · Garden · Domain atlas · Inbox · Master's · Job**. Master's and Job are policy-only
boundary views; quarantined content is not in the manifest or default search.

## Engineering boundary

- Modular TypeScript-syntax source lives under `src/`; `build.mjs` concatenates
  it into the required `plugin/main.js`. The source files share build-injected
  Obsidian/Electron globals; this project does not claim an import-based `tsc`
  architecture. The core has no Node dependency.
- The app reads only atomic `generated/manifest.json` contract v2. It never
  parses canonical Markdown/YAML and remains useful when Python is offline.
- Mutations use `tools/los.py` action-specific commands: `stage-note`,
  `stage-progress`, `stage-attach`, `source-feedback`, detour commands,
  selected-only shelving, validation/generation, and `session-end`.
- Every stage mutation carries the manifest snapshot. Stale views reload instead
  of overwriting newer authored state.
- AI prompts carry explicit area, module, component, unit, stage, source,
  material and snapshot context. The active file is supplementary only.

## Curated ecosystem

`ecosystem-plugins.json` checksum-pins Agentic Copilot 1.5.3, Omnisearch
1.30.1, Text Extractor 0.7.0, and PDF++ 0.40.31. The installer merges only
managed keys: approval-mode local AI, PDF/image indexing with English/German
OCR, HTTP API off, quarantine exclusions, and direct PDF editing off. See
`ECOSYSTEM.md`.

## Build, test, install

```bash
python3 install.py                 # build + test + install into ../repository
python3 install.py --ecosystem     # + the pinned AI/search/OCR/PDF plugins
python3 install.py --dry-run       # print actions only
```

`install.py` builds and runs the synthetic fixture suite before writing. It
merges vault/plugin settings, verifies pinned downloads, installs only into
gitignored vault paths, and smoke-tests the CLI. Reload Obsidian with `Cmd+R`.

It finds Node itself — PATH first, then `/opt/homebrew/bin`, `/usr/local/bin`,
`/usr/bin`, `~/.nvm`, `~/.volta`, and bundled agent runtimes under
`~/.cache/codex-runtimes` — and prints which binary it used. A GUI-launched or
bare shell often has none of these on PATH, which is not a reason to refuse the
install. Override with `--node /absolute/path/to/node`; run the steps by hand
with `<node> build.mjs` and `<node> tests/test-dashboard.js`.

This repository is local-only and has no remote. Core and UI remain separate
ownership layers; the core remains portable plain files and Git.
