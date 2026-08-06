# LearningOS Obsidian app v2

The human work surface for LearningOS. Obsidian opens `../repository/` as the
vault; this project presents its module-first curriculum without becoming a
second source of truth.

## Workflow

1. Open Home: resume the current session, handle a short list of time-sensitive
   items, or continue one of a few other active modules/projects.
2. Open **Modules**, choose a projected thematic group, then a full-page module
   detail; or use **Learn** to resume active curriculum work. Choose an optional
   component and lecture/topic/milestone unit.
3. Work through the unit's one current study map. Exact resources, done-when
   criteria, resources, feedback and detours stay stage-scoped; one session note is added at unit level after the relevant stages.
4. Review Ultimate Reference, Exercise Bank, Mock Exam and other durable
   artifacts through stable unit references.
5. Prepare shelving, review destinations/rationale/diffs, and apply only
   selected proposal IDs through the guarded gateway.
6. End the learning session deliberately: review the exact gateway ledger,
   then optionally commit and push only those files.

The current navigation is **Home · Modules · Learn · Library · Capture · Review**, with structural Search available from the navigator and command palette. Modules and Library now use explicit full-page application routes; Library separates Learning Sources from purpose-built Topic Packs. Master's and Job are policy-only
boundary views; quarantined content is not in the manifest or default search.

## Engineering boundary

- Modular TypeScript-syntax source lives under `src/`; `build.mjs` deterministically concatenates
  it into the required `plugin/main.js`. The source files share build-injected
  Obsidian/Electron globals; this project does not claim an import-based `tsc`
  architecture. The core has no Node dependency.
- The app reads only atomic `generated/manifest.json` contract v2. It never
  parses canonical Markdown/YAML and remains useful when Python is offline.
- Mutations use `tools/los.py` action-specific commands: `unit-note`, legacy `stage-note`,
  `stage-progress`, `stage-attach`, `source-feedback`, detour commands,
  selected-only shelving, validation/generation, and `session-end`.
- Every stage mutation carries the manifest snapshot. Stale views reload instead
  of overwriting newer authored state.
- AI prompts carry explicit area, module, component, unit, stage, source,
  material and snapshot context. The active file is supplementary only.
- The Garden's **Shelve with AI** button is a registered `garden.shelve`
  action, not a general prompt. It prepares an exact request bundle through the
  core, exposes provider availability, and applies only an approved delivery.
  Original Garden artifacts remain distinct from AI transcriptions and state.

## Curated ecosystem

`ecosystem-plugins.json` checksum-pins Agentic Copilot 1.5.3, Omnisearch
1.30.1, Text Extractor 0.7.0, and PDF++ 0.40.31. The installer merges only
managed keys: approval-mode local AI, PDF/image indexing with English/German
OCR, HTTP API off, quarantine exclusions, and direct PDF editing off. See
`ECOSYSTEM.md`.

## Build, check, install

The checked development gate is:

```bash
npm install
npm run check       # build, typed contract check, contract lock, fixture suites, reproducibility
npm run build:info  # print the exact source and bundle identity
```

Gate A introduces a strict typed boundary for the versioned manifest contract.
The legacy concatenated view modules remain protected by the complete synthetic
fixture suites while they are moved behind the typed router and feature
contracts. `scripts/check-build.mjs` also proves that two consecutive
builds are byte-identical and that `plugin/build-info.json` describes the bundle
that was actually produced.

`ApplicationRouter` is the sole adapter between product routes and Obsidian
leaves. Persisted navigation stores route identity and history rather than raw
view types, including Modules group queries and Library collection/group/filter
state. Back restores scroll and selected-row context without reintroducing a
permanent master/detail split.

Installation remains explicit:

```bash
python3 install.py                 # build + fixture test + install into ../repository
python3 install.py --ecosystem     # + the pinned AI/search/OCR/PDF plugins
python3 install.py --dry-run       # print actions only
```

`install.py` runs the runtime fixture gate before writing. The broader
`npm run check` gate runs in development and CI. The installer merges
vault/plugin settings, verifies pinned downloads, installs only into gitignored
vault paths, copies the generated build identity with the plugin, and smoke-tests
the CLI. Reload Obsidian with `Cmd+R`.

It finds Node itself — PATH first, then `/opt/homebrew/bin`, `/usr/local/bin`,
`/usr/bin`, `~/.nvm`, `~/.volta`, and bundled agent runtimes under
`~/.cache/codex-runtimes` — and prints which binary it used. A GUI-launched or
bare shell often has none of these on PATH, which is not a reason to refuse the
install. Override with `--node /absolute/path/to/node`.

This repository is local-only and has no remote. Core and UI remain separate
ownership layers; the core remains portable plain files and Git.
