# Source navigation and SaD L05: implementation and safe replication

This handoff records the implementation behind LearningOS issues #33 and #34. It is intended for Claude Code or another executor reading the repository without the conversation. Read the applicable AGENTS.md, the sibling Core's `system/OPERATOR.md`, and its current canonical-write contracts before executing anything. This document records an approved historical operation; it does not grant authority for future content changes, external model access, publication or a different vault installation.

## 1. User intent and accepted scope

The learner wanted an overview across many sources while retaining the detailed explanations, plus exact lectures when videos are mentioned. The accepted design groups by source, puts chapters/lectures underneath, opens at the current stage, and offers the current lecture and all SaD as broader scopes. SaD was the initial complete example; the interface is shared. Search and purpose filters help narrow the overview without removing authored content.

The user explicitly instructed Codex to stop Gemini and implement directly, then approved the reviewed L05 draft, scoped local commits and installation. No push was authorized. Earlier critical-recovery fixes are baseline work and must remain intact.

## 2. Repositories, commits and evidence

Local checkout pair:

- Core: `/Users/aramaljanadi/Desktop/semestercontext/LearningOS/repository`
- UI: `/Users/aramaljanadi/Desktop/semestercontext/LearningOS/obsidian-ui`
- Evidence directory: `/Users/aramaljanadi/Desktop/semestercontext/LearningOS/workbench/audits/source-navigation-2026-09-06`

Implementation history:

| Repository | Commit | Meaning |
| --- | --- | --- |
| Core | `0168fc86d7be864e7530e76ba36030926781fe4e` | Baseline before this content pilot |
| UI | `c527b9db85c62e144497f20328b34900e2248da1` | Baseline including earlier draft-loss repairs |
| Core | `833fe9af2a873cf6c8c56693c9a931851fa92138` | Approved L05 import and transaction records |
| UI | `fdcc0f46699af8c703294195ce6c01b96f0ed156` | Source browser implementation; superseded by the next fix |
| UI | `fc3c2fc5c737c6bcdeb18a9b5b13e4cf1305cb05` | Required host-modal keyboard-scope fix |

Do not install the first UI implementation commit alone. This documentation commit follows the required fix; use the current reviewed clean HEAD when producing build metadata. Commit IDs above identify evidence, not safe checkout/reset instructions for a dirty workspace.

The workbench contains `PLAN.md`, `INDEPENDENT-REVIEW.md`, the approved `l05-video-pilot.yaml`, its normalized diff, `l05-video-pilot-changes.json`, the approved envelope and response, preservation checks, test logs, installation logs and live evidence. These local workbench artifacts are not assumed to be present in a clone. If an exact approved input is absent, retrieve the authorized bytes or stop; do not reconstruct it from screenshots or an inverse projection. The committed Core study map and receipt remain the durable historical result.

## 3. UI architecture and invariants

### Grouping: `src/features/unit/source-browser.ts`

`groupBySource` uses a Map keyed by source identity. It preserves first source occurrence order and entry order within each group. Every original occurrence survives, including two placements using the same route and entries with unknown source identity. Never deduplicate stage resources by route ID or title: the same route can carry different direct URLs, locators, instructions and feedback context.

`renderSourceGroups` owns native source-level details/summary elements and delegates entry rendering. It does not own filtering, resource opening, choosing, ranking or canonical writes. An unknown source remains visible as an explicit unidentified group; never invent identity to improve appearance.

### Browser: `src/features/unit/material-drawer.ts`

- `sourceScope` is presentation state. Stage scope consumes the supplied StageResourceView occurrences unchanged. A route lookup may fill source/depth/format metadata only when there is an exact route ID; it does not replace the placement record or its target.
- Unit scope uses that unit's existing source-map routes. Component scope enumerates `store.unitsFor(unit.moduleId, unit.componentId)`, so Analysis units do not enter the SaD scope. These broader scopes are route menus, not a deduplicated aggregation of every stage placement. Consequently counts between stage and lecture scopes have different inputs, and direct stage-specific video entries remain stage-specific.
- Other units use their own source selections and knowledge-node coverage labels. They offer Go to lecture rather than a Choose action in the current unit's mutation context. Current-unit Choose/Remove keeps the existing gateway payload and expected revisions.
- Controls are created once in onOpen. Changes replace only the results container. Rebuilding the root on each keystroke would discard focus and typed query state.
- Search uses the shared `foldCase` helper and matches source title, entry title, locator and short angle. It is not a claim of full-text search over every detailed description. Purpose uses the existing depth/format metadata, including practice kinds. Reset clears search and purpose while retaining scope.
- Entry details delegate stage occurrences to the existing `renderStageResources` renderer. Keep the original record, its resource opener and feedback identity. Wider route entries display their complete `angle_detail`, locator and owner-specific coverage.
- Modal opening records an overlay and focuses the heading after the host's opening pass. Closing clears the overlay and restores accessibility state. Merely browsing must not write notes, progress, feedback or source selections.

### Shared menu and types

`src/features/unit/materials.ts` uses the same grouping for the menu when there is no study map, and includes the previously omitted full `angle_detail`. `src/features/unit/model.ts` only broadens the narrow navigation interface to include openUnit; `readMaterialOptions` keeps its existing unit ownership semantics.

### Accessibility and styling

`src/accessibility/modal.ts` includes summary elements in the focusable set and excludes descendants hidden by closed details, except their direct summaries. Preserve inert/aria-hidden restoration and cleanup idempotence. `src/styles/23-unit-surface.css` uses existing tokens for wrapping controls, group rows and nested entries. Do not hand-edit generated `plugin/main.js` or `plugin/styles.css`; regenerate with the build.

## 4. The live-only defect and why green tests were insufficient

The initial modal declared `private scope: Scope = 'stage'`. The local TypeScript declaration of Obsidian Modal did not expose its host-owned `scope`, so the compiler did not catch the collision. At runtime the string replaced Obsidian's keyboard scope. Opening the modal produced `Cannot create property 'win' on string 'stage'`; later typing produced `i.handleKey is not a function`. The DOM still rendered, so screenshots and successful clicking alone were insufficient acceptance.

The repair renamed the filter state to `sourceScope`. It did not patch Obsidian or suppress errors. `tests/harness.js` now provides a host scope with handleKey and refuses Modal.open if a subclass overwrites it. `tests/dashboard/study-surfaces.js` asserts preservation of that host scope. This guards the observed integration contract, though it is not a complete emulation of Obsidian.

After installing the corrected build, use a real reload. If the old corrupted scope prevents the command palette from working, Obsidian's native View > Force Reload remains available. First establish that there is no unresolved gateway write and preserve saved drafts. Do not clear an error buffer to manufacture a clean result: preserve the failing run, then inspect the new process's buffer after reproducing the interactions. In this execution, typing, Tab/Enter disclosure expansion, Escape, restored Compare all focus and reopening produced no captured errors after reload.

## 5. L05 content change: exact provenance and preservation

Target: Core `curriculum/modules/module-hu-m2-statistik-analysis/units/unit-m2-sad-l05/study-map.yaml`. The authored YAML was copied as the input draft; generated projection data was not serialized back into canonical form.

The original map contained 64 resources over seven stages. Fifty-six placements lacked one or both source/route identities. Each identity was recovered only through a unique within-L05 exact match of title/label, locator, angle and angle_detail against the owned route. No fuzzy title matching or arbitrary first match was accepted. Existing fields, descriptions, original relative order, stage criteria, map state and learner state stayed unchanged.

The existing Harvard aggregate reference was retained in `stage-sad-l05-decision-grid`, `stage-sad-l05-combinations` and `stage-sad-l05-counting-probability`. Two individual watch entries were added immediately after it in each stage, yielding 70 total placements:

| Exact lecture | Direct URL |
| --- | --- |
| Harvard Stat 110 — Lecture 1: Probability and Counting | https://www.youtube.com/watch?v=KbB0FjPg0mw |
| Harvard Stat 110 — Lecture 2: Story Proofs, Axioms of Probability | https://www.youtube.com/watch?v=FJd_1H3rZGg |

Primary evidence: https://stat110.hsites.harvard.edu/youtube. Both use existing source `source-stat110` and owned route `route-1c9301d9a29d6dc3920ca232`; both retain reference-only triage. The original aggregate's Strategic Practice 1 mention remains. No timestamps, durations, resource IDs or learner time budgets were fabricated. Lecture 1's exact destination and title were observed in Chrome; Lecture 2 playback was not exercised.

The draft's exact byte hash was `sha256:7b0a351748cf98b8bb5d37de5aae34c8aadd8ccc0a333bfd2afc10219fb60add`. This token is for that historical file only. Compute a new digest for any changed draft.

## 6. Gateway execution and failure boundaries

The applied command was the public capability `unit.map.import`, dispatched through GatewayEnvelopeV2 using Core's `.venv/bin/python tools/los.py capability unit.map.import --payload-file` and the explicit approved envelope artifact. Do not use the bare CLI import to apply, and never hand-edit the canonical study map, generated manifest, revision registry, idempotency ledger or receipts.

Historical authority binding:

- Before snapshot: `sha256:c0a6199c8c48eb0e1c9b5c7427dfba9a2b644a6673742cf79190d3fc24101917`.
- Expected revisions: unit-m2-sad-l05 = 5, study-map-m2-sad-l05 = 3.
- Request: request-source-navigation-l05-20260907. Idempotency key: source-navigation-l05-20260907.
- Envelope schema 2; channel codex; operator-approval. Payload contained the exact draft file, its file_sha256, unit_id and replace true.
- Approval subject was computed by production `learning_os.contracts.gateway.intent_sha256`, not handwritten or copied from another request.
- Result: committed Receipt V2 `operations/transactions/transaction-20260907-002509-001.yaml`; unit revision 6, map revision 4.
- After snapshot: `sha256:72337cea1a30ff4ec336958d8a27340bc90a5635a4b779ed8546e60cc83c6ce7`.

For a future approved edit, obtain fresh bootstrap state and artifact revisions, hash the exact reviewed input, construct a fresh content-bound envelope with a new logical request identity, and recompute its approval subject using the production helper. Use the current schema at `system/schema/capability-envelope.schema.json` and payload schema at `system/schema/capabilities/unit.map.import.schema.json`; `tests/gateway_helpers.py` is a reference for construction, not independent authorization.

The bare `unit-map-import --replace --check` preflight is useful but returns before the transaction: it does not prove expected revision enforcement or the complete repository reference/material/feedback validation. Independently review the proposed diff and route ownership; then let the gateway enforce the actual write. Check L05's existing feedback before changing identities; it was empty for this historical draft.

Stop on stale snapshot, changed revisions, digest mismatch, ambiguous route identity, unexpected stage/state changes, missing source bytes, failed validation or projection disagreement. An uncertain gateway response requires inspecting the receipt/recovery state and reusing the exact request/envelope for replay if appropriate; do not issue a new key blindly. Never silently refresh guards to force an old approved proposal onto changed learner data.

After success, require Receipt V2 committed status, inspect its writes and revisions, compare its snapshot_after with generated manifest `_generated.snapshot_id` and the canonical fingerprint, and compare the resulting authored map with the approved draft. Verify all original resources as an ordered subsequence with unchanged original fields; verify all non-resource stage/map fields separately. The receipt wrote unit.yaml identically; it did not require a content commit. The Core commit contains only the changed study map, revisions.yaml, idempotency.yaml and the new receipt.

## 7. Verification and release procedure

Use the actual checkout pair; preserve unrelated dirty or untracked work. Capture each repository's status and reviewed path list before staging. The commands below assume the local layout above; paths must be resolved deliberately on another machine.

1. In Core, run `make system-check`. This includes lint/reachability, validation without report writes, warning-baseline checking, the full Core suite (including six required cross-process UI recovery scenarios), and the sibling UI's full check. Historical result: 1048 Core tests, zero validation errors, five existing warnings and a passing UI suite.
2. UI regression coverage is in `tests/test-runtime-modules.js`, `tests/dashboard/study-surfaces.js`, `tests/dashboard/runtime-integrity.js` and `tests/harness.js`. Check duplicate route placements with distinct URLs/instructions, unknown identities, ordering, control identity/focus while typing, empty/reset results, SaD/Analysis boundaries, foreign owner selections/coverage, unchanged current-unit gateway arguments, missing-file opening failure and the host Modal scope. Native browser behavior still requires step 6.
3. Run `git diff --check`, inspect the exact status set, then stage only the reviewed files. Commit locally with a body stating the trigger, behavior, preserved invariants, validation and limits. Do not include dependency symlinks, another agent's work or wrapper changes. Never claim a pre-fix check proves a later edited build; the complete UI check was repeated after the host repair. Core was unchanged after its final 1048-test run.
4. After the Core commit, run `make views` in Core so generated metadata records the committed Core HEAD. After the UI commit, the installer builds clean HEAD. Use `python3 install.py --dry-run`, then `python3 install.py`, then `npm run install:status` in UI. Do not use skip-tests, dirty-install bypasses or manual copying. The normal installer verifies and transactionally promotes four managed assets and checks the clean Core/UI pair.
5. Before reload, inspect pending gateway recovery and preserve draft categories without copying learner text into reports. Hash saved uiDrafts values before and after. A reload can perform recovery; do not trigger it blindly when there is an unresolved transaction.
6. Reload the real repository vault and open Diagnostics. From UI resolve both full HEADs from Git immediately before running the following command; it records evidence outside canonical data:

   ```sh
   npm run check:live -- --core-sha "$(git -C ../repository rev-parse HEAD)" --ui-sha "$(git rev-parse HEAD)" --vault /Users/aramaljanadi/Desktop/semestercontext/LearningOS/repository --evidence-dir /private/tmp/learningos-source-navigation-live
   ```

   Use a distinct evidence directory for a new run when preserving an earlier run there. This script only observes and does not navigate or reload. Require exact live revisions, manifest contract 9, matching running fingerprint and clear recovery.
7. Open L05 > Compare all. Require This stage initially (15 entries / 12 groups), then This lecture (19 routes / 18 groups), then All SaD (326 routes / 65 groups). Counts are historical acceptance evidence, not permanent constants for future curriculum edits. Search Harvard using multiple keystrokes; expand its group and an exact lecture; use Tab/Enter, Escape and reopen. Open Lecture 1 and verify the destination/title, then close the verification tab. Do not click Choose, feedback, completion or note-save controls during a read-only smoke test.
8. Inspect the real app's error buffer after interactions, capture and visually inspect screenshots, confirm unchanged draft hashes, no extra canonical writes, and clean Core/UI status. Installed asset identity alone does not prove working interaction. A visible modal alone did not detect the observed keyboard failure.

The Obsidian CLI is `/Applications/Obsidian.app/Contents/MacOS/obsidian-cli`. Always target `vault=repository` and run from the Core vault; omitting the vault can target another open window or open the wrapper as a vault. Screenshot syntax is `dev:screenshot path=<absolute filename>`; DOM queries use `dev:dom selector=<css>`. Local IPC may require the normal tool permission escalation. Do not replace a permission refusal with a different uncontrolled access path.

## 8. Recovery and limits

If tests fail, fix and rerun the affected complete gate before committing/installing. If installation fails, inspect its transactional rollback evidence; do not copy half a build manually. If live behavior fails, retain the failed evidence and repair before accepting the release, as done for the scope collision. Preserve unrelated work throughout. Any future canonical reversal is another reviewed gateway operation against fresh state, not git checkout of old content or editing a receipt. Any code rollback needs a reviewed compatible Core/UI pair and normal installation; do not assume the old baseline UI is correct for later Core changes.

Issue #33 is implemented locally, with no upstream publication. Issue #34 remains open for jbstatistics and the broader SaD video audit. Gemini's incomplete inventory contained false positives and was not accepted as evidence. No whole-curriculum certification, timestamp research, backup configuration, legacy archive changes, learner notes/progress edits, external-model restarts or push is included in this work.
