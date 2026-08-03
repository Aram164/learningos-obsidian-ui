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
2. Read canonical state only through `../repository/generated/`
   (`manifest.json` is the versioned, atomic interface contract and contains
   its reverse indexes) and, for the validation badge only, the CLI
   (`python ../repository/tools/los.py status --json`). **Never parse
   canonical Markdown or YAML from UI code.** If a view needs a field the
   manifest lacks, add it CORE-side and regenerate — do not regex for it.
   Corollary: the app must render fully with the CLI unavailable.
3. Send mutations only through explicit CLI commands (`capture`, `path-note`,
   `path-progress`, `path-attach`, `generate`, `validate`). Never rewrite YAML
   registries or canonical notes from UI code. AI canonical changes require a
   rendered shelving proposal and explicit selected-item approval.
4. Do not duplicate LearningOS validation or business rules in TypeScript —
   one implementation of every rule, and it lives in the core.
5. Treat generated files as disposable; never cache them as truth.
6. Keep ordinary Markdown compatible with every editor: no Obsidian-only
   meaning in canonical notes, no required `[[wikilinks]]`.
7. Ship the vault safety configuration with the installer (core gitignores
   `.obsidian/`): link auto-update OFF, no drag-in attachments,
   `generated/` and `archive/` excluded from recency surfaces.
8. Run UI tests before installation (`node tests/test-dashboard.js`);
   `install.py` runs them and aborts on failure. Installing into the real
   vault requires Aram's explicit confirmation.
9. The app never writes the core directly. Cross-layer changes are made
   core-side first (schema/gateway/projection), then consumed here.
10. Job/ quarantine applies unchanged (core CLAUDE.md §13): never read, index,
    or surface `Job/` content in any view.
11. This repository is **local-only** (Aram, 2026-08-03): its own git history,
    no GitHub remote, not folded into the core repo. Commit freely here; never
    add a remote or push without asking.
12. Every app-like behaviour (startup view, pinning, sidebars, chrome) must be
    a setting with a sane default. The interface may be opinionated; it may
    not be unescapable.
13. **All usability constraints live here** (Aram, 2026-08-03). The core is
    allowed to be optimised for robustness and efficacy at the cost of being
    unpleasant to browse; this project is what makes it usable. Concretely:
    no primary view may present a bare list of links. The current stage owns
    its resources and notes; record references are typed actions or chips.
    Follow `DESIGN.md`; extend it rather than inventing CSS.

## Anti-goals (from core ADR-006 and the 2026-07-16 external review)

No second canonical graph; no Dataview dependency for core meaning; no second
inbox (Daily Notes); no ungoverned plugin sprawl; no REST server; no competing
graph system; no interface maintained that nobody uses. Curated integrations
and exclusions are recorded in `ECOSYSTEM.md`.
