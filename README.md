# LearningOS Obsidian UI — interface layer

The human desktop for LearningOS: Obsidian opens the `../repository/` vault;
this project builds the views, shelves, dashboards, and safe action buttons
that make it comfortable. **Presentation and interaction only** — LearningOS
core (`../repository/`) owns all canonical data, validation, and business
rules. The boundary is fixed in the core repository's
`system/adr/ADR-006-interface-layer-boundary-2026-08-03.md`; the contract this
project must obey is `CLAUDE.md` here.

## Status

**v0.4.0 — 2026-08-03.** v0.1 shipped the plugin, v0.2 the dashboard, v0.3
made the dashboard actually appear, v0.4 made the thing navigable and took
over browsing from `materials/INDEX.html`. Installed into the live vault by
`install.py`. Track and improve this layer in its own Claude project, not in
the core project.

**Division of labour (Aram, 2026-08-03):** the core optimises for robustness,
correctness and efficacy and is *not* required to be pleasant to browse. All
usability constraints move here. If something is hard to find, that is a bug
in this project.

**Git: local-only, no remote** (Aram's decision, 2026-08-03). This directory
is its own git repository with no GitHub remote and no place in the core
`LearningOS` repo or in `semestercontext` (whose `.gitignore` covers all of
`LearningOS/`). Commit here for history; nothing is pushed anywhere. If that
ever changes, the choice to revisit is a remote for *this* repo — not folding
the interface into the core, which ADR-006 keeps separate.

## What v0.4 contains

**The read path changed.** Everything is rendered from
`generated/manifest.json` + `generated/backlinks.json` — the manifest is the
interface contract (ADR-006 addendum 4) and now carries workspace
`next_action`/`objective`, source `url`/`material_path`/`roles`/`evaluations`
(including per-section reading plans), note `domain`/`summary`, and the
`exam_spine`. Consequences: no Markdown is parsed by UI code, no rule is
reimplemented, and **the whole app works with no Python running** — a broken
venv degrades one banner instead of the interface.

- `plugin/` — single-file plugin, **no build step** (`main.js` +
  `manifest.json` + `styles.css`).
  - **Dashboard** — the home view on every launch: exam hero + countdown,
    spine tiles, a six-stat strip where every stat navigates, workspace cards
    (status stripe, deadline, next action, linked-record counts), recently
    changed notes, queues, and a reference shelf of local sources.
  - **Explorer** — a master/detail browser over every record type. Type tabs
    with counts, a search field, facets derived from the data (kind, role,
    domain, state, status — with counts), and a detail pane: facts grid,
    prose, evaluations (strengths/weaknesses), **Where to look** (which
    chapter or lecture covers which concept, as clickable chips), and every
    connected record grouped and clickable. Chip clicks push history, so Back
    works. This is what replaced `materials/INDEX.html`.
  - **Navigator** — a left rail: Home, Find, one entry per record type with
    counts, queues (inbox / garden / unreviewed), generated views, actions,
    and your active workspaces.
  - **Finder** — fuzzy search over all ~400 records; notes and workspaces open
    as files, everything else opens in the Explorer.
  - Source actions: **Open online** (in Obsidian's Web Viewer when enabled,
    else the browser) and **Open local copy** (resolved by the core, not by
    the UI).
- **App behaviour** (Settings → LearningOS UI, all toggleable): dashboard on
  startup, pinned home tab, Navigator, collapsed sidebars, app chrome,
  in-app source links, live refresh.
- **Vault hygiene** — `vault-config/core-plugins.json` merges managed core
  plugin states with a written rationale for each: Web Viewer **on** (136
  sources have URLs), Daily Notes **off** (no second inbox), link graph
  **off** (the concept canvas is the curated graph), Sync/Publish off.
- `DESIGN.md` — the design system: tokens, five components, four patterns,
  copy rules, and the anti-patterns it exists to prevent.
- `tests/` — Node suite against an Obsidian stub and the fixture vault
  (`node tests/test-dashboard.js`, ~70 checks). `install.py` runs it and
  aborts on failure. Covers the store, startup, settings, dashboard,
  explorer, navigator, finder, both degraded modes (CLI down, projection
  missing), the open verbs, and the ADR-006 write boundary — including a
  check that no UI code parses canonical Markdown and that the CSS contains
  no hardcoded colours.
- `bases/` — shelf definitions (Obsidian Bases): notes (all / recently
  changed / needs review / rough-or-evolving / exam artifacts / with
  evidence / by domain), garden (ripest first), workspaces (active/archived).
- `vault-config/app.json` — the managed safety keys (merged, never
  clobbered): link auto-update OFF, Markdown links, attachments→`work/inbox/`,
  local trash, archive/venv excluded from search.
- `install.py` — idempotent installer; writes ONLY to gitignored vault paths
  (`.obsidian/`, `bases/`); verifies but never edits core-tracked files.
- `fixture-vault/` — synthetic vault for development (hard rule: never
  develop against the live vault).

## Install / update

```bash
python3 /Users/aramaljanadi/Desktop/semestercontext/LearningOS/obsidian-ui/install.py
```

Then open `LearningOS/repository/` as a vault in Obsidian and, if prompted,
turn OFF Restricted mode (enables the plugin). If Obsidian is already running,
reload it (`Cmd+R`) — plugin code is only read at load. The core side renders
the data: `concept-canvas.canvas` and `reading-room.md` come from `make views`.

## Test

```bash
cd /Users/aramaljanadi/Desktop/semestercontext/LearningOS/obsidian-ui && node tests/test-dashboard.js
```

## What this project may touch

- `python ../repository/tools/los.py` — `status --json` · `validate` ·
  `generate` · `capture` (the CLI mutation channel), plus direct note
  creation into `work/inbox/` (blessed by ADR-006 as the judgment-free
  capture surface).
- `../repository/generated/` — read-only; entry point `reading-room.md`,
  machine projection `manifest.json`.

Nothing else. See `CLAUDE.md`.

## Design input

`inputs/LearningOS-Obsidian-Architecture.md` — Aram's plan (2026-08-03), as
reviewed against the core contract that same day (see ADR-006 for what was
adopted core-side, rejected, or deferred). Its implementation order still
applies here from step 4 onward (fixture vault → read-only dashboard → shelves
→ source explorer → canvas → forms).

## First success criterion (from the 2026-07-16 external review)

An interface nobody uses is a dead second interface and gets deleted, not
maintained. The first deliverable must be something actually opened daily —
start with the read-only reading-room/dashboard experience, prove it earns a
place, then grow.
