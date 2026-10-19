# App ↔ OS integration — wiring, testing, evaluation

**Date:** 2026-08-07
**Core:** `LearningOS/repository/` @ `79a302a` · manifest contract v2 · 207 tests · validator 0/0
**App:** `LearningOS/obsidian-ui/` @ `e50daab` · 26 modules · 205 checks
**Bundle now installed in the vault:** `sha256:00d806d9…45738ec4`

See also: `LearningOS-App-OS-Binding-Map.md` (what each screen touches),
`LearningOS-App-v2-Figma-Notes.md` (the design).

---

## Verdict

The seam is sound. Read is a projection, write is the gateway, and both hold
under load — I drove all 19 commands against a live copy rather than a fixture.
Two real defects turned up at the boundary; both are fixed and pinned by tests.
Three gaps remain that are yours to decide on, and none of them is breakage —
they are places where the OS holds data the app has no surface for.

The thing that was actually broken was not the code. **The plugin running in
your vault was 32 commits old** — built 6 Aug 18:59, before the capability-
envelope migration. Refreshed; reload Obsidian with `Cmd+R`.

---

## 1. What I changed

### The core — committed as `79a302a`

The seven pending `note-evidence` files, validated and committed. A stale
`.git/index.lock` from a crashed process was silently blocking every commit;
the validator's `HYGIENE-LOCK` rule caught it, which is the rule earning its
keep. Removed. 207 tests, 0 errors, 0 warnings.

### The app — committed as `e166588` + `e50daab`

**Defect 1 — a refusal was invisible.** The core answers a refused write with
JSON on stdout and leaves stderr empty. `GatewayClient.call()` read stderr
first, so the only useful sentence was discarded and you got Node's
`Command failed: python tools/los.py capability …`. Every refusal — snapshot
conflict, validation failure, a capability saying no — looked identical and
said nothing.

Now it reads the structured body first and carries the exit code, as a
`GatewayError`.

**Defect 2 — a stale projection was a dead end.** The core refuses a write
whose snapshot is behind the authored tree and advises *"reload before
writing"*. The app's reload re-reads `generated/manifest.json` — which is
exactly as stale as the snapshot just refused. Only a rebuild moves it forward.

This is not an edge case. Planning happens in Claude; canonical files change
between app sessions **by design**. So this was the normal first write after
any authoring session, failing with advice that could not work. Proven:

```
1. clean projection, first write                  -> ok
2. something outside the app edits the tree
3. write after reload-only  <- the app's own path -> exit 3, refused
4. write after generate                           -> ok
```

`mutate()` now rebuilds and retries once on exit 3, and surfaces anything that
survives the rebuild. Retry is safe because a conflict is refused whole —
partial application of a validated transaction is forbidden by the capability
contract. Exit 3 is matched as the documented contract, not by message text.

Five new checks. Full gate green.

### The vault

`plugin/` refreshed from `e166588`. Everything the installer merges —
`app.json` keys, core-plugin states, `community-plugins.json`, `bases/*.base`,
the `.gitignore` verification — was already in place and unchanged; I verified
the whole installer end-to-end against a scratch vault first, including its
refusal to write anything when the build fails.

---

## 2. What I tested

### Every write path, driven for real

All 10 capabilities the app sends, plus the guard, against a live copy:

| capability | result |
|---|---|
| `stage.progress.update` | ok |
| `stage.note.write` | ok |
| `unit.note.append` | ok |
| `stage.attachment.add` | ok |
| `source.feedback.record` | ok |
| `detour.create` → `detour.resolve` | ok (id arrives as `result.detour.id`; the app reads it from the reloaded projection, correctly) |
| `capture.create` | ok |
| `review.prepare` → `review.apply` | ok |
| replay of an old snapshot | **refused, as it must be** |

Plus `status --json`, `bootstrap`, `search`, `inspect`, `related`,
`ai-action-list`, `capabilities`, `unit-list`, `validate`, `generate` — all ok.

Every capability name the app sends exists in the core's `commands` contract.
No orphans in either direction.

**Cost note:** a write costs ~4s, because each one regenerates the full
projection. Ten writes in a session is ~40s of waiting. Not wrong — the
projection has to move — but if stage ticking ever feels heavy, this is why.

### Every read binding

52 bindings from the binding map, checked against the live projection. The
contract lock and the projection agree exactly: 25 locked top-level keys, none
missing, none unlocked. Contract v2 on both sides.

### Reproducibility

The bundle is byte-identical across macOS/node 26 and Linux/node 22, and across
two consecutive builds. That is a real property, not a claimed one — I built it
on a different platform and got the same sha256.

---

## 3. Findings you should decide on

> **Status update (same day).** A, C and D are **fixed** — see
> `LearningOS-Semantic-Audit.md` §1. Correcting A surfaced a larger defect
> underneath: the app's evaluation card read three fields the schema forbids,
> so ~600 recorded judgments were invisible, not 87. B remains open as build
> work. The findings below are kept as written, for the record.

### A. The projection drops authored source judgments — 87 of them

`sources.schema.json` defines nine evaluation fields. The projection
(`tools/learning_os/genout/manifest.py:232–245`) hardcodes six.

| field | authored | reaches the app |
|---|---|---|
| `level` | **87 evaluations** (31 advanced · 29 introductory · 27 intermediate) | **no** |
| `audience` | **18 evaluations** | **no** |
| `prerequisites` | 0 | no |
| `verdict` | **0 — not in the schema at all** | yes, always `null` |

Screen 11 · Source menu is specced to render `level`. It is the most populated
of the dropped fields, and it is exactly the "which source for which purpose"
judgment that screen exists to surface. 87 recorded judgments about source
difficulty never leave the repository.

`verdict` is the mirror image: a field the projection emits on all 303
evaluations, always null, that the schema does not define. Dead weight crossing
the contract.

**Fix:** three lines in the evaluation projection, plus a contract-lock bump and
the matching field in `src/contracts/manifest-v2.ts`. Small in code, but it
moves the manifest contract, which is why I left it to you.

### B. Two screens have no surface, two are folded into another

| Figma screen | app surface | gap |
|---|---|---|
| 08 · Connections | **none** | `relations` (69), `backlinks.concept_relations` (64), `concept_to_notes` (77), `source_to_notes` (74) — all projected, none rendered |
| 14 · Note life | **none** | notes are not a destination; `supersedes` appears nowhere in the UI |
| 13 · Evidence and recall | inside unit + library views | no dedicated screen |
| 12 · Scope triage | inside unit view (detour rows) | no board across stages |

Everything else in the 25 is present: bands I, II, V and VI in full;
18 · Module logistics is a `module-detail` tab; 24 · stale and 25 · core
unavailable are real states in the Diagnostics view.

**Connections is the one I would build first.** The data is the richest
unrendered thing in the projection, and it is precisely the "enumerate, don't
count" surface — a backlink index that lists and links rather than reporting a
number. Note life is second, and it needs finding C resolved first.

### C. Screen 14 binds to two fields the projection does not emit

`note.schema.json` defines `transcription` and `semantic_review`. Neither is
projected — the manifest emits `reviewed` instead, and neither field is
authored on any of the 50 notes today. So there is no data loss right now, but
Screen 14 cannot be built as designed until the projection and the design agree
on one vocabulary. Cheapest resolution: point the design at `reviewed` and
`authorship`, which are projected and populated on all 50.

### D. `build-info.json` can lag, and says nothing about it

It is gitignored — local only, rewritten by each build — so its
`source_revision` records whatever HEAD was when you last built, not what the
bundle is from. Your vault copy claimed `8e290d62` while the source had moved 32
commits on, and nothing on screen said so.

The core solved this exact problem with `_generated.source_dirty`, which
Diagnostics already renders. The app has no equivalent. A `source_dirty` flag in
`build-info.json`, compared against the installed copy, would have made "your
vault is running an old build" visible instead of something I had to go
looking for.

---

## 4. Architecture — how it holds up

**The boundary is enforced mechanically, not by convention.** The bundle tests
assert against the built artifact that there is no `vault.modify`, no
`vault.delete`, no `vault.rename/copy`, no frontmatter write, no filesystem
write, no direct canonical parsing, and no legacy global-path command — and that
writes are action-specific. `check-host-surface.mjs` holds 27 files to the real
Obsidian API. ADR-006 is not a document the code agrees with; it is a property
the test suite proves about the shipped bundle. This is the strongest thing
about the project.

**Layering is clean.** No view imports another view. No view touches
`node:child_process` or `electron`. The single exception is `review-view.ts`
reading its own `build-info.json` via `node:fs` — self-inspection for the
Diagnostics screen, failing closed to a fallback. Legitimate, and worth keeping
as the only one.

**One write shape.** Every mutation is a declared capability sent as an
envelope, so there is one call shape, one response shape and one error path
rather than a positional signature per command. The Stage-3 migration was the
right call; the old build in your vault predates it.

**Serialization is in the right place.** The write lock lives in the gateway,
not in a view, because what is being protected is the single CLI process and
the snapshot it was handed. A per-view busy flag could not have covered a stage
completion and an inbox capture started from different leaves.

**Where the weight is.** `library-view.ts` is 2320 lines, `module-view` 1755,
`unit-view` 1606 — 5700 of 13600 total in three files. They are the legacy
concatenated view modules the README says are being moved behind the typed
router, and the fixture suites cover them. Not urgent, but that is where the
next structural work is, and Connections would be a chance to establish the
pattern on a new view rather than retrofitting an old one.

**Failure states are designed, not defaulted.** Stale, unavailable, and empty
each render as themselves. The empty states name the real counter and the
command that would fill it. That discipline is why finding D stood out: the
build identity was the one place where "I don't know" rendered as a confident
wrong answer.

---

## 5. Next

Yours to run — the plugin is installed, but Obsidian is holding the old bundle
in memory:

```
Cmd+R in Obsidian
```

To rebuild yourself at any point (your node_modules is macOS; mine was Linux,
which is why I built out-of-tree):

```bash
cd "/Users/aramaljanadi/Desktop/semestercontext/LearningOS/obsidian-ui" && npm run check && python3 install.py
```

Ordered by value:

1. **Project `level` and `audience`; drop `verdict`** — 87 authored judgments
   currently stop at the repository boundary. (finding A)
2. **Build 08 · Connections** — the richest unrendered data in the projection.
   (finding B)
3. **Decide Screen 14's vocabulary** — point it at `reviewed`/`authorship`, or
   project `transcription`/`semantic_review`. (finding C)
4. **Add a dirty flag to `build-info.json`** — so a stale install says so.
   (finding D)
5. **Publish `02 · Components` as a Figma library** — still the one manual step;
   the plugin API cannot do it.
