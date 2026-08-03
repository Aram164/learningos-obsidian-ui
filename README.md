# LearningOS Obsidian app

The human work surface for LearningOS. Obsidian opens `../repository/` as the
vault; this project turns the rigorous file-based core into a stage-focused
learning app without becoming another source of truth.

## v1 workflow

1. Pick or ask AI to create a learning path for one subtopic.
2. Resume its current stage. Watch/read/practice resources, completion criteria,
   and the working note stay in one view.
3. Save typed notes or attach a handwritten PDF/image to that stage. No filing,
   note ID, concept ID, or destination is required while learning.
4. Complete, skip, revisit, or detour a stage without losing its reasoning.
5. Ask AI to prepare a shelving proposal after the path is ready.
6. Review proposed durable notes/Garden items, destinations, rationale, and
   diffs. Only explicitly selected items may be applied.

The primary navigation is now **Home · Learning path · Shelve review ·
Library**. University and Job are separate areas; Job remains quarantined and
is never indexed by the LearningOS vault.

## Architecture

- The core owns schemas, records, paths, validation, routing, and semantics.
- The app reads only `generated/manifest.json`, a versioned atomic snapshot that
  now includes its backlinks. It never races two projection files or parses
  canonical Markdown/YAML.
- Mechanical writes use `tools/los.py`: `path-note`, `path-progress`,
  `path-attach`, `capture`, and `generate`. Stage writes carry the manifest
  snapshot ID, so stale windows cannot overwrite newer work.
- AI uses the vendor-neutral `system/OPERATOR.md` contract and the same gateway.
  Shelving remains proposal → explicit approval → apply → validate → regenerate.
- The Library retains the existing master/detail record explorer as a secondary
  retrieval surface.

## Curated ecosystem

`ecosystem-plugins.json` pins release URLs and SHA-256 checksums for:

- Agentic Copilot, configured to the local Codex safety wrapper;
- Omnisearch plus Text Extractor for full-text and OCR search;
- PDF++ for stage-owned and durable PDF annotations.

See `ECOSYSTEM.md` for responsibilities and the plugins deliberately excluded
because they duplicate the graph, inbox, operator gateway, or semantic index.

The Codex wrapper (`../repository/tools/codex_obsidian.py`) is read-only by
default. Only LearningOS UI actions carrying an explicit operational, shelving,
or Job approval marker grant a write sandbox, and every write-enabled run ends
with validation and projection regeneration.

## Install / update

Use the bundled Node path when `node` is not on the shell PATH:

```bash
python3 /Users/aramaljanadi/Desktop/semestercontext/LearningOS/obsidian-ui/install.py \
  --node /Users/aramaljanadi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  --ecosystem
```

The installer refuses an untested install unless `--skip-tests` is explicitly
given. It merges safety settings, installs only into gitignored vault paths,
verifies pinned plugin checksums, enables the integrations, and smoke-tests the
core CLI. Reload Obsidian with `Cmd+R` after an update.

## Test

```bash
/Users/aramaljanadi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  /Users/aramaljanadi/Desktop/semestercontext/LearningOS/obsidian-ui/tests/test-dashboard.js
```

Tests run only against `fixture-vault/`. They cover the versioned store, home,
navigation, learning path, mixed capture, shelving approval, Job boundary,
secondary Library, degraded modes, and the core/UI write boundary.

## Repository policy

This project is its own local-only Git repository. The core and UI remain
separate repositories and separate ownership layers. All app styling uses
Obsidian theme variables; all core meaning remains portable plain files.
