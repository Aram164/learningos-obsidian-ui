# LearningOS Obsidian UI — agent entry

Use this route to change or verify the LearningOS Obsidian interface (`learningos-ui`).
Core (`../repository/`) owns all canonical data, schemas, validation, and business
rules; this repository owns presentation, interaction, UI-owned drafts, and
interrupted-write recovery. No agent has a standing role here: workspace-wide
planning and review guidance lives in `../../AGENTS.md` at the `semestercontext/`
root. To change Core code or contracts, start at
[`../repository/system/DEVELOPER.md`](../repository/system/DEVELOPER.md); to
operate learner records, enter through
[`../repository/system/OPERATOR.md`](../repository/system/OPERATOR.md).

## Read in this order

1. Read [`CLAUDE.md`](CLAUDE.md) for the interface operating contract, hard rules,
   and the Core boundary (`../repository/system/adr/ADR-006-interface-layer-boundary-2026-08-03.md`).
2. Read [`ARCHITECTURE.md`](ARCHITECTURE.md) for the `src/main.ts` runtime flow,
   directory ownership, dependency rules, compatibility surfaces, and code gates.
3. Read [`DESIGN.md`](DESIGN.md) before changing layout, interaction behavior,
   navigation, or CSS tokens.
4. Develop and test against [`fixture-vault/`](fixture-vault/) (synthetic data),
   never against the live `../repository/` vault.

## How do I change it?

| Task | Owning code and contract | Files to change & boundaries to preserve | Focused verification |
|---|---|---|---|
| Change a view, screen design, or feature interaction (`Home`, `Modules`, `Learn`, `Library`, `Atlas`, `Garden`, `Review`, `Abilities`, `Unit`) | `src/features/<area>/` (domain models, rendering, interactions, `ports.ts`), `src/views/<area>-view.ts` (leaf shells), `src/designs/` (`study-desk/`, `focus/`), `src/app/router.ts`, and [`DESIGN.md`](DESIGN.md) | Edit `src/features/`, `src/designs/`, or `src/views/`. Features must depend on feature-owned `ports.ts` and shared `src/projection/readers.ts`, never on concrete classes in `src/views/`. Every non-declaration `.ts` file under `src/` must stay reachable from `src/main.ts` with zero cycles. Never use test-harness DOM helpers in `src/`. Preserve `LEGACY_VIEW_TYPES`, `ApplicationRouter.fromLegacy()`, and `legacy-library-list` ([`ARCHITECTURE.md#compatibility-surfaces`](ARCHITECTURE.md#compatibility-surfaces)). | `npm run check:code`, `node scripts/check-host-surface.mjs`, `node tests/test-dashboard.js --suite=<name>`, and area suites (`npm run test:abilities`, `npm run test:atlas-graph`, `npm run test:library-finder`) |
| Consume a manifest field or Core query response / update the contract mirror | Producer contract in `../repository/system/contracts/manifest-contract.yaml` and `../repository/system/schema/`; mirrored in `contracts/manifest-v<N>.lock.json`, `src/contracts/`, `src/contracts/generated/`, `src/projection/readers.ts`, and `src/manifest-store.ts` | Change Core first, then regenerate and update `contracts/manifest-v<N>.lock.json`, `src/contracts/generated/` (`npm run contract:generate`, `npm run contract:responses`), `src/contracts/`, `src/manifest-store.ts`, and `fixture-vault/generated/manifest.json`. Never parse canonical Markdown or YAML in UI code. | `npm run typecheck:contracts`, `npm run contract:check`, `npm run test:manifest-store-indexes`, `npm run test:response-validation-diff`, and paired Core `make test-paired` |
| Change a Gateway write, bounded Core CLI read, or interrupted-write recovery | `src/gateway-client.ts`, `src/contracts/gateway-v2.ts` (`UI_GESTURE_CAPABILITIES` mirrored against Core `../repository/system/contracts/capabilities.yaml`), `src/application/gateway-recovery.ts`, `src/application/ability-drafts.ts`, `src/infrastructure/los-runtime.ts`, `src/infrastructure/ai-action-client.ts` | Edit `src/gateway-client.ts`, `src/application/`, or `src/contracts/`. Canonical writes use sealed `GatewayEnvelopeV2` over stdin (`capability NAME --payload-file - --json`) with `expected_snapshot` and `expected_revisions`, or explicit positional CLI commands (`session-end --session-id ui`, `ai-action-prepare`, `ai-action-apply-delivery`, `validate`, `generate`). Preserve `GatewayClient.saveNote()` (`stage.note.write`) and `GatewayClient.attach()` (`stage.attachment.add`) compatibility surfaces and the unresolved-recovery write block. | `npm run contract:check`, `npm run test:operations`, `npm run test:trace-context`, `node tests/test-ai-actions.js`, `node tests/test-dashboard.js --suite=gateway-recovery`, `node tests/test-dashboard.js --suite=abilities-review`, and Core `pytest -q tests/test_ui_gateway_recovery.py` |
| Change styles or CSS tokens | `src/styles/*.css`, ordered in `build-styles.mjs`, and [`DESIGN.md`](DESIGN.md) | Edit `src/styles/*.css` (and `build-styles.mjs` if adding a module), then run `npm run build` to emit `plugin/styles.css`. Never hand-edit `plugin/styles.css` or `plugin/main.js`. | `npm run build`, `node tests/test-dashboard.js --suite=runtime-integrity`, `node scripts/check-build.mjs` |
| Change build identity, installer, ecosystem pins, or live-app diagnostics | `build.mjs`, `install.py`, `plugin-assets.json`, `ecosystem-plugins.json`, [`ECOSYSTEM.md`](ECOSYSTEM.md), `scripts/check-install-current.mjs`, `scripts/check-live-app.mjs` | Preserve deterministic two-pass builds (`scripts/check-build.mjs`), transactional install journals, and read-only `check:live` allowlists. `install.py` requires `--accepted-artifact` or `--local-build`; live vault installation requires explicit authorization. | `npm run test:installer`, `npm run test:build-fingerprint`, `npm run test:install-current`, `npm run test:live-app-check`, `npm run test:ci-policy` |

## Closing gates

- **Fast source gate:** `npm run check:code` (TypeScript typecheck, `check:source-graph`, `check:derived-facts`, and fast unit suites).
- **Complete local UI gate:** `npm run check` (runs `npm run test`, `node scripts/check-host-surface.mjs`, and `node scripts/check-build.mjs` to prove two consecutive builds are byte-identical and `plugin/build-info.json` matches the bundle).
- **Paired local gate (from `../repository/`):** `make system-check`.
- **Upstream release gate:** GitHub Actions `UI CI` (`.github/workflows/ui-ci.yml`), Core `validate` (`../repository/.github/workflows/validate.yml`), and exact-SHA `release-pair` (`../repository/.github/workflows/release-pair.yml`).
