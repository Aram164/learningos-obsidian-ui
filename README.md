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
3. Read the lecture knowledge map, compare the complete material menu by
   format and explanatory angle, and choose what fits the current gap. A
   personal study map is optional; when one exists, its exact resources,
   done-when criteria, feedback and detours stay stage-scoped. One session note
   is added at unit level after the relevant stages.
4. Review Ultimate Reference, Exercise Bank, Mock Exam and other durable
   artifacts through stable unit references.
5. Prepare shelving, review destinations/rationale/diffs, and apply only
   selected proposal IDs through the guarded gateway.
6. End the learning session deliberately: review the exact gateway ledger,
   then optionally commit and push only those files.

The current primary navigation is **Home · Modules · Learn · Projects · Library · Garden · Review**, with structural Search available from the navigator and command palette. Modules and Library use explicit full-page application routes; Library separates Learning Sources from purpose-built Topic Packs. Future Master's Planning remains a policy-only boundary. Job learning uses the same projected module, unit, study-map, note, search, and AI surfaces as every other learning area, with a small visual badge for `program-job`.

[`ARCHITECTURE.md`](ARCHITECTURE.md) is the concise source map: runtime flow,
directory ownership, dependency direction, compatibility surfaces, artifacts,
and code-only gates.

## Engineering boundary

- TypeScript source under `src/` uses explicit ESM imports and one `src/main.ts`
  entrypoint. `build.mjs` uses esbuild to produce the deterministic CommonJS
  `plugin/main.js`; Obsidian, Electron, CodeMirror and Node built-ins remain
  runtime externals. A TypeScript module-bundling fallback exists only for
  offline verification and is refused by CI unless explicitly enabled.
- `npm run typecheck` checks all runtime source files. The versioned manifest
  contract remains independently strict-checked before projected data reaches
  the typed store and view/feature layers. `npm run check:source-graph` proves
  that every non-declaration TypeScript source module is reachable from
  `src/main.ts`, the runtime graph is acyclic, and feature code does not depend
  on concrete view classes.
- The app reads only atomic `generated/manifest.json` contract v8. It never
  parses canonical Markdown/YAML and remains useful when Python is offline.
  The contract is declared by the producer — core's
  `system/contracts/manifest-contract.yaml` — and the single
  `contracts/manifest-v<N>.lock.json` here is a mirror of it. `npm run contract:check` verifies the
  mirror whenever
  core is checked out beside this repo, so a projection change cannot reach the
  UI as a surprise. Bump both together; they release together.
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
OCR, HTTP API off, bounded index exclusions, and direct PDF editing off. See
`ECOSYSTEM.md`.

## Build, check, install

The checked development gate is:

```bash
npm install
npm run check:code  # fast type, architecture, and indexed-store checks
npm run check       # build, typed contract check, contract lock, fixture suites, reproducibility
npm run build:info  # print the exact source and bundle identity
```

The source-only command remains useful during small refactors and is also part
of the complete gate, so unreachable runtime code, reversed feature/view
dependencies, and indexed-store regressions cannot bypass release checks. The
versioned manifest has a strict typed boundary, and the explicit ESM view and
feature modules remain protected by the complete synthetic fixture suites.
`scripts/check-build.mjs` also proves that two consecutive
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

### Release identity and the clean-install rule

`build.mjs` runs a deterministic two-pass build: the first pass resolves the
real module graph, `source_fingerprint` is computed from that graph plus every
other declared build input (never a commit SHA, a timestamp, or the bundle's
own hash — embedding any of those would make rebuilding after a commit change
the bundle again), and the second pass injects that fingerprint and the
manifest contract version into the running bundle through
`src/build-identity.ts`. `plugin/build-info.json` additionally records
`source_revision`/`source_dirty` for this repository's complete worktree and
`core_revision`/`core_dirty` for the sibling Core repository's — `null` means
unknown, and unknown is never read as clean anywhere downstream.

Installing into the real `../repository` vault (not a fixture) additionally
requires, before anything is written: the deterministic build check
(`scripts/check-build.mjs`) passing; both repositories' worktrees reporting
clean; both `source_revision`/`core_revision` reading as full 40-character
revisions; and those revisions matching each repository's actual current
`HEAD`. Any dirty flag, unreadable Git state, or mismatch refuses the install
outright. A fixture or `--dry-run` install needs none of this.

Diagnostics inside the running app compares the fingerprint compiled into the
bundle that is actually executing against the fingerprint the installed
`build-info.json` on disk claims — the one way to tell whether an older
in-memory plugin is still running after a newer build landed, since a reload
is the only thing that replaces it.

It finds Node itself — PATH first, then `/opt/homebrew/bin`, `/usr/local/bin`,
`/usr/bin`, `~/.nvm`, `~/.volta`, and bundled agent runtimes under
`~/.cache/codex-runtimes` — and prints which binary it used. A GUI-launched or
bare shell often has none of these on PATH, which is not a reason to refuse the
install. Override with `--node /absolute/path/to/node`.

This repository has its own history and GitHub remote. Core and UI remain
separate ownership layers; the core remains portable plain files and Git.
