# LearningOS UI source architecture

This is the source map for the Obsidian interface. Product behavior belongs in
[`DESIGN.md`](DESIGN.md); Core ownership and safety rules remain authoritative
in `../repository/system/OPERATOR.md` and its accepted ADRs.

## Runtime flow

```text
Obsidian
  └─ src/main.ts                 composition root and plugin lifecycle
      ├─ src/app/                routing, registration, navigation adapters
      ├─ src/views/              Obsidian leaf shells
      │   └─ src/features/       domain models, rendering, interactions, ports
      ├─ src/manifest-store.ts    validated atomic projection and read indexes
      │   ├─ src/contracts/      wire contracts and strict decoders
      │   └─ src/projection/     shared structural readers
      ├─ src/gateway-client.ts    action-specific Core gateway facade
      ├─ src/application/         drafts and interrupted-write recovery
      └─ src/infrastructure/      process, resource, and host adapters
```

`src/main.ts` is the only runtime entrypoint. `app/registration.ts` is the
production composition point that constructs concrete views. The build follows
the same import graph and emits one CommonJS plugin bundle.

## Directory ownership

| Path | Owns | Does not own |
| --- | --- | --- |
| `src/contracts/` | Versioned producer/consumer shapes and strict decoding | Product policy or host behavior |
| `src/projection/` | Reusable readers for unknown projected values | Domain decisions |
| `src/manifest-store.ts` | One validated snapshot, lookup indexes, archived-curriculum filtering | Canonical data or mutation |
| `src/features/` | Domain read models, rendering, and interactions | Obsidian leaf classes |
| `src/features/*/ports.ts` | Narrow feature-owned host contracts | Implementations |
| `src/views/` | Leaf lifecycle and feature composition | New domain logic |
| `src/app/` | Routes, navigation state, view registration, global overlays | Canonical meaning |
| `src/application/` | UI-owned drafts and recovery state | Canonical records |
| `src/infrastructure/` | Host/process/resource adapters | Business rules |
| `src/accessibility/` | Shared keyboard and modal behavior | Domain state |
| `src/security/` | URL allowlisting at the host boundary | Resource ownership |
| `src/types/` | Obsidian runtime type augmentation | Runtime behavior |
| `src/styles/` | Ordered authored CSS modules | Generated `plugin/styles.css` |

Shared UI primitives live in `src/components.ts`; constants and settings remain
in `src/constants.ts` and `src/settings.ts`. `src/gateway-client.ts` is a facade:
it may translate a user action into a declared Core capability, but it never
becomes a second implementation of that capability.

## Dependency rules

1. Views may compose features. Features depend on their own ports, contracts,
   shared readers, and narrowly scoped adapters; they never import concrete
   views.
2. Contract and projection code does not depend on views or product rendering.
3. Canonical state enters only through the validated manifest or declared Core
   responses. Writes enter only through action-specific gateway capabilities.
4. Adding a non-declaration `.ts` file requires connecting it to `src/main.ts`
   through the import graph. This includes type-only feature ports. An
   intentionally non-runtime program belongs under `scripts/` or `tests/`, not
   as an unreachable source module.

`npm run check:source-graph` enforces the feature-to-view prohibition in rule 1,
rejects runtime dependency cycles, and enforces the reachability rule 4 without
adding another dependency. `npm run typecheck` enforces the TypeScript boundary.

## Compatibility surfaces

Compatibility is explicit, not dead code:

- `LEGACY_VIEW_TYPES` detaches obsolete persisted Obsidian leaves during
  startup.
- `ApplicationRouter.fromLegacy()` and `legacy-library-list` preserve persisted
  navigation and old Library deep links.
- `GatewayClient.saveNote()` and `GatewayClient.attach()` retain the Core
  `stage.note.write` and `stage.attachment.add` compatibility capabilities.

These surfaces are classified here so a zero-current-caller result is not, by
itself, permission to delete them.

## Artifacts and gates

Authored runtime code is under `src/`. `plugin/main.js` and
`plugin/styles.css` are tracked build artifacts; `plugin/manifest.json` is the
shipped plugin manifest; `plugin/build-info.json` is generated and ignored.
The CSS cascade is declared explicitly in `build-styles.mjs`.

Fast source-only checks:

```bash
npm run check:code
```

`npm run check` remains the complete build, contract, fixture, installer,
live-check harness, CI-policy, host-surface, and reproducibility gate. It also
invokes `check:code`, so the fast architectural checks cannot be skipped by the
complete gate.
