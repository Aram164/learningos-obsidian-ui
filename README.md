# LearningOS Obsidian UI — interface layer

The human desktop for LearningOS: Obsidian opens the `../repository/` vault;
this project builds the views, shelves, dashboards, and safe action buttons
that make it comfortable. **Presentation and interaction only** — LearningOS
core (`../repository/`) owns all canonical data, validation, and business
rules. The boundary is fixed in the core repository's
`system/adr/ADR-006-interface-layer-boundary-2026-08-03.md`; the contract this
project must obey is `CLAUDE.md` here.

## Status

**v0.3.0 — 2026-08-03.** v0.1 shipped the plugin, v0.2 the dashboard, v0.3
made the dashboard actually appear. Installed into the live vault by
`install.py`. Track and improve this layer in its own Claude project, not in
the core project.

**Git: local-only, no remote** (Aram's decision, 2026-08-03). This directory
is its own git repository with no GitHub remote and no place in the core
`LearningOS` repo or in `semestercontext` (whose `.gitignore` covers all of
`LearningOS/`). Commit here for history; nothing is pushed anywhere. If that
ever changes, the choice to revisit is a remote for *this* repo — not folding
the interface into the core, which ADR-006 keeps separate.

## What v0.3 contains

- `plugin/` — single-file plugin, **no build step** (`main.js` +
  `manifest.json` + `styles.css`). **The Dashboard** is the home view on every
  launch: a hero countdown to the nearest exam, tiles for the rest of the
  spine, a stat strip (notes/concepts/sources/inbox/garden/reviewed %), a
  "continue where I stopped" grid of workspace cards (status stripe, deadline,
  next action, last touched), recently changed notes, a jump rail to
  shelves/canvas/generated views, and action buttons (Capture, Rebuild,
  Validate, Refresh). It re-renders when files under `work/` or `knowledge/`
  change. Plus ribbon/commands for all of the above and a status-bar
  validation state + next-exam countdown (display-side countdowns are fine —
  the determinism rule binds generated *files*, not live UI). The generated
  `reading-room.md` stays the plain-text home for every non-Obsidian surface.
- **App behaviour** (Settings → LearningOS UI, all toggleable): open the
  dashboard on startup, pin it as the home tab, collapse both sidebars at
  launch, app chrome, live refresh.
- `tests/` — Node test suite against an Obsidian stub and the fixture vault
  (`node tests/test-dashboard.js`). `install.py` runs it and aborts on
  failure. Covers the startup path, the settings, the render, degraded
  no-CLI mode, and the ADR-006 write boundary.
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
