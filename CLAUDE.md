# LearningOS Obsidian UI — operating contract (interface layer)

This project implements a human interface for LearningOS. It is governed by
the boundary in the core repository:
`../repository/system/adr/ADR-006-interface-layer-boundary-2026-08-03.md`.
For task routing, owning paths, focused test suites, and release gates, start
at [`AGENTS.md`](AGENTS.md) and [`ARCHITECTURE.md`](ARCHITECTURE.md).

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
   its reverse indexes) and bounded on-demand Core CLI queries (`tools/los.py`:
   `status --json [--no-validate]`, `material-span`, `ability-context`,
   `study-sequence`, `plan-template`, `unit-map-import --check`,
   `projection-observe`, `health-report`, `operations`,
   `legacy-archive-status`, `masters-planning-dashboard`, `ai-action-status`,
   and `ui-capability ... --replay-only`). **Never parse canonical Markdown or
   YAML from UI code.** If a view needs a field the manifest or a declared Core
   response lacks, add it CORE-side and regenerate — do not regex for it.
   Corollary: the app must render its projected views from `manifest.json` even
   when the CLI is unavailable.
3. Send canonical mutations only through Core's gateway (`tools/los.py`):
   sealed `GatewayEnvelopeV2` requests via `ui-capability NAME --payload-file -`
   over stdin for the gesture-admitted capabilities in
   `UI_GESTURE_CAPABILITIES` (`src/contracts/gateway-v2.ts`, mirrored against
   Core's `system/contracts/capabilities.yaml`, plus the retained
   `stage.note.write` compatibility method), and explicit positional CLI
   commands for session closure, AI-action bundles, and view refresh
   (`session-end --session-id ui`, `ai-action-prepare`,
   `ai-action-apply-delivery`, `validate`, `generate`). Every canonical
   mutation carries the current manifest snapshot and required artifact
   revision guards. Never rewrite YAML registries or canonical notes from UI
   code. AI canonical changes require an action-specific capability, scope
   check, rendered proposal where semantic, and explicit selected-item
   approval.
4. Do not duplicate LearningOS validation or business rules in TypeScript —
   one implementation of every rule, and it lives in the core.
5. Treat generated files as disposable; never cache them as truth.
6. Keep ordinary Markdown compatible with every editor: no Obsidian-only
   meaning in canonical notes, no required `[[wikilinks]]`.
7. Ship the vault safety configuration with the installer (core gitignores
   `.obsidian/`): link auto-update OFF, attachments captured into the inbox,
   and `generated/`, `archive/`, registries, migration and curriculum
   quarantine excluded from default search.
8. Run the complete checked development gate (`npm run check`) before release
   or installation. `install.py` defaults to `--accepted-artifact`, which
   independently verifies its Core receipt, all hosted gates and the UI
   gate's actual producer checkout before transactionally copying receipt-bound
   assets and aligning declared build outputs with the published ZIP. It
   preserves implementation source and vault-owned settings; it is not
   `--skip-tests`. Installing from a local build requires explicit
   `--local-build`, which independently reruns the runtime build and synthetic
   fixture tests and aborts on failure (and refuses without `--accepted-artifact`
   or `--local-build`). Installing into the real vault requires explicit
   authorization.
9. The app never writes the core directly. Cross-layer changes are made
   core-side first (schema/gateway/projection), then consumed here.
10. Job learning follows core ADR-013: `program-job` uses the ordinary program,
    module, unit, study-map, note, search, AI-action, gateway, and receipt
    contracts. The UI may add a `Job` badge, but it must not reintroduce a
    Job-specific dashboard, access grant, schema, plan profile, transaction
    root, or validation path. External sibling code is not LearningOS data and
    is never indexed, validated, migrated, or managed by this interface.
11. This repository is **separate from the core repo** (Aram, 2026-08-03): its
    own git history, never folded in. It has a GitHub remote
    (`Aram164/learningos-obsidian-ui`); until 2026-08-18 this rule claimed it
    did not, which in a system whose thesis is that written contracts are
    authoritative made the governance layer itself untrustworthy. Commits,
    pushes, installation, and remote changes remain explicit operator actions.
    Core and the UI release together — a contract bump that lands on one side
    alone is the failure `contracts/manifest-v<N>.lock.json` exists to prevent,
    and CI now checks core out to enforce it.
12. Every app-like behaviour (startup view, pinning, sidebars, chrome) must be
    a setting with a sane default. The interface may be opinionated; it may
    not be unescapable.
13. **All usability constraints live here** (Aram, 2026-08-03). The core is
    allowed to be optimised for robustness and efficacy at the cost of being
    unpleasant to browse; this project is what makes it usable. Concretely:
    no primary view may present a bare list of links. Home shows one resumable
    focus, a short Today list, and a short Continue elsewhere list; Modules,
    Learn, and Projects keep the complete hierarchy reachable. The current
    stage owns its resources; a single session note is attached to the unit
    after the relevant stages; record references are typed actions or chips.
    Follow `DESIGN.md`; extend it rather than inventing CSS.

## Module boundaries

- `src/contracts/` owns stable wire types and contract identities. Contract
  versions are constants and lock data, never source filenames.
- `src/projection/` owns shared structural readers for untrusted JSON values.
- `src/features/` owns domain decoding, presentation models, and interactions;
  it must reuse the shared readers rather than grow a per-feature parsing kit.
  Feature-owned `ports.ts` files describe the narrow host surface a feature
  needs; feature modules never import concrete classes from `src/views/`.
- `src/views/` owns Obsidian leaf shells and delegates product behaviour to
  features. New domain logic does not enter view shells.
- `src/infrastructure/` owns host and process adapters. No feature bypasses the
  gateway to read or mutate Core files.

The complete directory and dependency map is in `ARCHITECTURE.md`.

## Anti-goals (from core ADR-006 and the 2026-07-16 external review)

No second canonical graph; no Dataview dependency for core meaning; no second
inbox (Daily Notes); no ungoverned plugin sprawl; no REST server; no competing
graph system; no interface maintained that nobody uses. Curated integrations
and exclusions are recorded in `ECOSYSTEM.md`.
