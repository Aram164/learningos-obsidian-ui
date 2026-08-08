# App ↔ LearningOS binding map

**App design:** https://www.figma.com/design/TRqyMF0WxGHOUPZ3PBsmST (16 screens, desktop 1440×960)
**OS read surface:** `generated/manifest.json`, contract v2, locked by `obsidian-ui/contracts/manifest-v2.lock.json`
**OS write surface:** `python tools/los.py <cmd>` (ADR-006 — the only gateway)
**Checked against:** snapshot `sha256:541b269d…48e3227`, revision `3cd98005`, generated 2026-08-07 06:39

---

## 1. What the audit changed in the design

Reading the repo corrected three things. All three are now fixed in the Figma file.

### The Source menu was ranking sources. Your schema forbids that.

`sources.schema.json` states verbatim: *"Contextual evaluations recorded here are the
canonical home of pedagogical judgments… **No universal scalar ratings.**"*

The first version of screen 11 invented **Primary / Complementary / Gap-only /
Reference** — a rank. Replaced with the canonical model: a **purpose selector**
over `evaluations[].roles`, plus `level`, `strengths`, `weaknesses`,
`useful_sections`, `prerequisites`. Ordering now comes from the purpose you pick,
not from anything stored. There is no "best source" in the UI because there is
none in the data.

The eight roles actually in your registry, with real counts:

| role | sources |
|---|---|
| first-learning | 142 |
| review | 82 |
| derivation | 51 |
| reference | 35 |
| exercise | 33 |
| implementation | 33 |
| intuition | 26 |
| mock-exam | 8 |

**206 of 228 sources already carry evaluations.** This screen has real data today —
it was the design that was wrong, not the repository.

### Triage was inventing a vocabulary that already exists

`stage.scope_triage` is a live enum: `required-now | helpful-now | deferred |
reference-only`, and it is populated — 182 / 39 / 2 / 7 across 230 stages. Screen
12 now renders those exact values. It reads `stages[].scope_triage`, **not**
`study_maps[].detours` — detours are defined but empty (0 across all 48 maps).

### Evidence claimed an axis the schema cannot record

PHILOSOPHY §3.6 defines understanding as *derive, explain, apply*.
`note.evidence[].type` offers `derivation | implementation | exercise | exam |
external`. There is no slot for **explain**. Screen 13 now shows that axis as
Absent with the reason stated on screen: *"a synthesis note exists — but a note is
not proof."* The app does not round it up.

---

## 2. Per-screen binding

Reads are manifest keys. Writes are `los.py` subcommands. Nothing else touches disk.

| # | Screen | Reads | Writes |
|---|---|---|---|
| 01 | Home | `resume_pointer`, `progress`, `academic_deadlines`, `ai_actions.requests`, `counts` | — |
| 02 | Horizon | `semesters`, `programs`, `modules[].semester/examination/credits/status`, `academic_deadlines`, `projects`, `relations` | — |
| 03 | Module detail | `modules[]`, `indexes.module_to_units`, `units[]`, `progress[module_id]`, `module_source_maps` | — |
| 04 | Unit workspace | `units[]`, `study_maps[]`, `stages[]` (`objective`, `done_when`, `resources`, `attachments`, `working_note`, `status`) | `stage-progress`, `stage-note`, `stage-attach`, `unit-note`, `source-feedback` |
| 05 | Library | source registry, `indexes.source_to_modules/source_to_units`, `topic_packs`, `thematic_groups` | `source-feedback` |
| 06 | Delivery review | `ai_actions.requests/available/provider_adapters`, `_generated.snapshot_id` | `ai-action-import-delivery`, `-validate-delivery`, `-apply-delivery` |
| 07 | Review queue | `ai_actions.requests`, `garden_entries`, `counts.units_needing_map`, `counts.inbox_items` | `shelving-prepare`, `shelving-apply` |
| 08 | Connections | `relations`, `backlinks.concept_relations/concept_to_notes/source_to_notes` | — |
| 09 | Global search | `los search` (manifest only) | — |
| 10 | Capture | `counts.inbox_items` | `capture` |
| 11 | Source menu | `sources[].evaluations`, `backlinks.concept_to_notes`, `relations` | `source-feedback` |
| 12 | Scope triage | `stages[].scope_triage` | `detour-create`, `detour-resolve` |
| 13 | Evidence and recall | `notes[].evidence/role/state/authorship`, `counts.notes_with_evidence` | — |
| 14 | Note life | `notes[].transcription/authorship/semantic_review/supersedes`, `artifact_revisions` | `note-revise` |
| 15 | Diagnostics | `_generated` (all 8), `counts`, `ai_actions` | `generate` |
| 16 | Session end | `stages[]`, `artifact_revisions` | `session-end`, `validate` |

**The whole write surface is 15 commands.** That is the app's entire blast radius,
and it is enumerable on one screen. Everything else is read-only projection.

---

## 3. Where the app will render empty today

Not bugs — the OS has the slots, nothing has filled them yet. The app states this
rather than inferring.

| counter | value | screen affected |
|---|---|---|
| `notes_with_evidence` | 0 | 13 · Evidence and recall |
| `notes_reviewed` | 0 | 13, 14 |
| `stages_complete` | 0 of 230 | 01, 03, 04 — all progress |
| `source_feedback_records` | 0 | 11 (evaluations exist; *your* feedback records don't) |
| `ai_action_requests` | 0 | 06, 07 |
| `inbox_items` | 0 | 10 |
| detours | 0 across 48 maps | 12 |

`stage.status` is `pending` × 228, `active` × 2, `complete` × 0. Any progress
number the demo shows is illustrative. Screen 15 says so out loud.

---

## 4. Next steps — status

**1. Evidence capture had no entry point. — DONE (7 Aug 2026)**

`note.evidence[]` existed but nothing wrote it. Added the `note.evidence.add`
capability end to end:

| file | change |
|---|---|
| `system/schema/note.schema.json` | evidence type enum gained `explanation` |
| `system/contracts/capabilities.yaml` | new `note.evidence.add` capability |
| `system/schema/capabilities/note.evidence.add.schema.json` | generated payload schema |
| `tools/learning_os/commands/note.py` | `cmd_note_evidence` |
| `tools/learning_os/commands/capability.py` | gateway handler entry |
| `tools/los.py` | `note-evidence` parser |
| `tests/test_note_evidence.py` | 8 tests |

```bash
python tools/los.py note-evidence <note-id> \
  derivation|explanation|implementation|exercise|exam|external <typed-uri>
```

Two invariants are pinned by tests: **the note body is never touched** (only
frontmatter is re-rendered) and **evidence is append-only** (an earlier trail
cannot be dropped by recording a later one). Duplicates are refused.

Writing the tests first paid for itself — they surfaced `REF-EVIDENCE`, an
existing validation rule requiring evidence refs to be typed URIs
(`note:// source:// concept:// workspace:// material:// project:// github://
https:// http://`). A bare path like `knowledge/attachments/x.md` is rejected.
The command now checks the scheme up front and prints the allowed vocabulary,
rather than letting the failure arrive as a deep transaction rejection.

**2. The "explain" axis. — DONE.** `explanation` added to the enum, so
PHILOSOPHY §3.6 is now fully recordable: `derivation`, `explanation`, and the
apply family (`implementation`, `exercise`, `exam`). Screen 13's gap callout is
now a resolution note.

**3. `stage-progress` and non-zero progress. — By design, awaiting use.** Not a
defect: 228 stages pending / 2 active / 0 complete is simply the current state.
Screen 15 says so rather than implying otherwise.

**4. Detours. — Resolved as a documentation question.** `detour-create` already
takes exactly the `scope_triage` enum (`required-now | helpful-now | deferred |
reference-only`), so it *is* screen 12's write path — it had simply never been
used (0 detours across 48 study maps). Screen 12 now names the command on the
page. No code change needed.

**5. Publish `02 · Components` as a Figma library. — Needs you.** Publishing is
not exposed to the Figma plugin API, so this is a manual step: open the file →
Assets panel → *Publish library*. Everything else in the file is ready for it.

### Verification after the change

```
207 passed          (198 before, +9)
0 error(s), 0 warning(s) — OK
```

`tools/generate.py` was re-run so the projection matches the authored tree.
Nothing is committed — the working tree is left for you to review:

```
 M system/contracts/capabilities.yaml
 M system/schema/note.schema.json
 M tools/learning_os/commands/capability.py
 M tools/learning_os/commands/note.py
 M tools/los.py
?? system/schema/capabilities/note.evidence.add.schema.json
?? tests/test_note_evidence.py
```

---

## 5. Boundary rules the app must keep

- **Read is projection, write is gateway.** No screen reads YAML directly; no
  screen writes anything except through `los.py`.
- **Stale projection is a first-class state.** `_generated.source_dirty` and
  `snapshot_id` drive screen 15's ✓ current / ● stale / ? unavailable.
- **Canonical facts render read-only.** Exam dates, credits, grades come from the
  owning `module.yaml`. The app never offers to edit them.
- **`Job/` is quarantined.** `quarantine_boundaries` renders as policy text only;
  no content is loaded to display it.
- **UI-owned state never becomes canonical** — done-when ticks, drafts, scroll and
  selection. The core learns only that a stage completed.
