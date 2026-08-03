# LearningOS Obsidian UI — operating contract (interface layer)

This project implements a human interface for LearningOS. It is governed by
the boundary in the core repository:
`../repository/system/adr/ADR-006-interface-layer-boundary-2026-08-03.md`.

## Ownership

LearningOS core (`../repository/`) owns all canonical data, schemas,
validation, and business rules. This project owns only presentation and
interaction. When in doubt: if it changes *meaning*, it belongs to the core
and its operator; if it changes *how meaning is shown or reached*, it belongs
here.

## Hard rules

1. Develop against a **fixture vault** (`fixture-vault/`, synthetic data),
   never the real repository vault.
2. Read canonical state only through the LearningOS CLI
   (`python ../repository/tools/los.py status --json`) and the `generated/`
   views (`reading-room.md`, `manifest.json`, …).
3. Send mutations only through explicit CLI commands (today: `capture`) or by
   creating NEW files inside `work/inbox/` (ADR-006 blesses the inbox as the
   judgment-free capture surface — that is what the plugin's Capture modal
   does). Never rewrite YAML registries. Never create, rename, move, or edit
   canonical notes from UI code.
4. Do not duplicate LearningOS validation or business rules in TypeScript —
   one implementation of every rule, and it lives in the core.
5. Treat generated files as disposable; never cache them as truth.
6. Keep ordinary Markdown compatible with every editor: no Obsidian-only
   meaning in canonical notes, no required `[[wikilinks]]`.
7. Ship the vault safety configuration with the installer (core gitignores
   `.obsidian/`): link auto-update OFF, no drag-in attachments,
   `generated/` and `archive/` excluded from recency surfaces.
8. Run UI tests before installation; installing into the real vault requires
   Aram's explicit confirmation.
9. The core repository is read-only territory for this project — never
   commit, edit, or restructure anything under `../repository/` from here.
10. Job/ quarantine applies unchanged (core CLAUDE.md §13): never read, index,
    or surface `Job/` content in any view.

## Anti-goals (from core ADR-006 and the 2026-07-16 external review)

No second canonical graph; no Dataview dependency for core meaning; no second
inbox (Daily Notes); no plugin sprawl; no REST server; no competing graph
system; no interface maintained that nobody uses.
