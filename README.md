# LearningOS Obsidian UI — interface layer

The human desktop for LearningOS: Obsidian opens the `../repository/` vault;
this project builds the views, shelves, dashboards, and safe action buttons
that make it comfortable. **Presentation and interaction only** — LearningOS
core (`../repository/`) owns all canonical data, validation, and business
rules. The boundary is fixed in the core repository's
`system/adr/ADR-006-interface-layer-boundary-2026-08-03.md`; the contract this
project must obey is `CLAUDE.md` here.

## Status

**v0.1.0 shipped 2026-08-03** (gate lifted by Aram same day: "forget about M2
… I want the whole thing working now"). Installed into the live vault by
`install.py`. Track and improve this layer in its own Claude project, not in
the core project. GitHub remote (e.g. `Aram164/LearningOS-Obsidian`) still to
be created by Aram.

## What v0.1 contains

- `plugin/` — single-file plugin, **no build step** (`main.js` +
  `manifest.json`): reading room auto-opens on startup; ribbon + commands for
  Capture-to-inbox, Rebuild views, Validate, Status, Concept canvas; status
  bar shows validation state + next-exam countdown (display-side countdowns
  are fine — the determinism rule binds generated *files*, not live UI).
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
turn OFF Restricted mode (enables the plugin). The core side renders the data:
`concept-canvas.canvas` and `reading-room.md` come from `make views`.

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
