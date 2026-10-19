# LearningOS App v2 — design notes

**File:** https://www.figma.com/design/TRqyMF0WxGHOUPZ3PBsmST
**Prototype start:** `01 · Home` (flow "LearningOS app")
**Target:** laptop / desktop, 1440×960
**Updated:** 2026-08-07
**Reference only:** `KpuHky94bpxHw2FFfVfnBT` (v1 demo) — untouched.

See also: `LearningOS-App-OS-Binding-Map.md` — which manifest keys and `los.py`
commands each screen touches.

---

## State

| | v1 | v2 |
|---|---|---|
| Components | **0** | **34 (17 sets + 17 singles) / 119 variants** |
| Icons | grey placeholder squares | 9 stroke icons, variable-bound, instance-swappable |
| Screens | 30 hand-drawn frames | **25 screens, 100% instances** |
| Prototype links | none | **301, zero dangling** |
| Interaction states | none | 6 component sets, focus rings throughout |
| Organisation | one flat page | 3 pages, 15 named sections |

---

## File architecture

Divided so that each layer can grow without disturbing the others.

**`01 · Foundations`** — the system made visible, not implicit.
Semantic palette rendered twice, Light and Dark, from the same variables (the
Dark panel uses `setExplicitVariableModeForCollection`, so it is proof the
theming works rather than a mock-up). Type scale specimen, spacing, radius and
layout scales.

**`02 · Components`** — six sections, ordered from generic to domain-specific:

| Section | What goes here | Count |
|---|---|---|
| A · Primitives | Button, Badge, Chip, Role chip, Tab, Search field, Criterion row | 7 |
| B · Chrome & navigation | Page header, Section header, Nav item, Sidebar, Empty state | 5 |
| C · Records & lists | Record row, Fact row, Graph node, Session entry | 4 |
| D · Learning model | Continue card, Stage rail item, Source evaluation, Evidence row, Triage item/column, Horizon item, Term column | 8 |
| E · AI gateway | Change row | 1 |
| F · Icons | icon/* | 9 |

The split is the extension point. A new learning concept goes in **D**; a new
gateway state goes in **E**; neither touches the others. **A** and **B** should
stay small — if something in A needs domain knowledge, it belongs in D.

**`03 · Screens`** — five flow bands. Sections, not separate pages, because
**Figma prototype links are page-scoped**: a NAVIGATE action can only target a
top-level frame on the same page. Splitting screens across pages would break all
246 links.

| Band | Screens |
|---|---|
| I · Daily loop | 01 Home · 04 Unit workspace · 09 Global search · 10 Capture · 16 Session end |
| II · Structure | 02 Horizon · 03 Module detail · 17 Project detail · 18 Module logistics |
| III · Knowledge | 05 Library · 08 Connections · 11 Source menu · 12 Scope triage · 13 Evidence · 14 Note life · 19 Topic pack |
| IV · AI gateway | 06 Delivery review · 07 Review queue · 20 Garden seed |
| V · System | 15 Diagnostics · 24 stale · 25 core unavailable |
| VI · Day one | 21 Home quiet · 22 Evidence no trails · 23 Review queue empty |

**Band VI exists because of the data audit.** `notes_with_evidence`,
`ai_action_requests` and `inbox_items` are all 0 today, so the empty versions of
those screens are the ones you would actually see first. Designing only the
populated state would have been designing for a repository you do not have yet.
Each empty state names the real counter and the command that would fill it —
never "no data available".

Band V now draws all three projection states `DESIGN.md` specifies: ✓ current,
● stale, ? core unavailable. The stale screen keeps rendering the data behind a
banner rather than blanking, on the reasoning that a photograph whose age you
know beats an empty screen.

---

## The boundary this design encodes

> The app is very good hardware. LearningOS is a really good OS.
> Planning happens in Claude. The app consumes the result.

- **No AI authoring surface.** AI appears only as a *prepared delivery* awaiting
  approval (06), a *seed awaiting preparation* (20), or *provenance* on a record.
- **Canonical facts render read-only** (18 states this on the page itself).
- **The entire write surface is 15 `los.py` commands** — see the binding map.
- **`Job/` is quarantined**; 17 renders the boundary as policy text only.

---

## What reading the repository changed

Three corrections, all now in the file:

1. **Source menu was ranking sources.** `sources.schema.json`: *"No universal
   scalar ratings."* Rebuilt as a purpose selector over `evaluations[].roles`
   (the eight roles actually in your registry). 206 of 228 sources already carry
   evaluations — the data was there; the design was wrong.
2. **Triage invented a vocabulary that exists.** Now bound to the live
   `stage.scope_triage` enum (182 required-now / 39 helpful-now / 2 deferred /
   7 reference-only).
3. **Evidence claimed an axis the schema cannot record.** `note.evidence[].type`
   has no slot for "explain". Screen 13 shows that axis Absent and says why.

---

## Traps worth remembering

- **`resize()` resets auto-layout sizing modes to FIXED.** Calling it after
  `primaryAxisSizingMode = "AUTO"` silently clips content. Bit four screens.
  Every content-bearing component is now explicitly `layoutSizingVertical = "HUG"`.
- **`addComponentProperty(…, "INSTANCE_SWAP", default)` wants the node id**, not
  `.key`, despite the docs.
- **Sections move their children.** Set the section's position *first*, then lay
  children out relative to it, or everything double-offsets.
- **Prototype destinations must be on the same page** as the source frame.

---

## Interaction states

`DESIGN.md` calls visible focus rings mandatory. Six component sets now carry
interaction states, and the focus ring is a 2px `border/focus` stroke drawn
**outside** the box so it never shifts layout:

| Component | States |
|---|---|
| Button | Default / Hover / Pressed / Disabled (× Variant × Size = 24 variants) |
| Record row | Default / Selected / Hover / Focus (× Trailing = 12) |
| Nav item | Default / Active / Hover / Focus |
| Tab | Default / Active / Hover / Focus |
| Search field | Default / Focus |
| Graph node | Default / Focus |

Hover and Pressed on Button resolve through two semantic tokens
(`bg/accent-hover`, `bg/accent-pressed`) so they re-theme with everything else.
Disabled is opacity only — it never invents a colour.

Record row, Nav item and Tab gained their states by **extending the existing
`State` enum** rather than adding a property, so all 91 Record row instances,
34 Tabs and every nested Nav item kept working untouched. Button did need a new
property; its 19 instances were recorded beforehand and verified after.

## Known gaps

1. **No responsive variants** — descoped. You chose laptop-first; `DESIGN.md`'s
   1020 / 720 / 480 breakpoints are unbuilt. Tall screens scroll vertically,
   Horizon scrolls horizontally.
2. **Library not published** — the one remaining manual step. The Figma plugin
   API cannot publish; open the file → Assets → *Publish library*. After that,
   obsidian-ui can consume the tokens instead of re-deriving them.
3. **The `•••` overflow button has no menu**, and Add note opens a full screen
   where `DESIGN.md` specifies a modal.
4. **Search loading and no-results** are undrawn (v1 had both).

## Closed since the last pass

- **Screen 13's schema gap is now a resolution note.** `note.evidence[].type`
  gained an `explanation` value and `los note-evidence` writes it, so
  PHILOSOPHY §3.6 is fully recordable. The Explain row is still Absent — but
  now because no trail was recorded, not because the schema could not hold one.
  That distinction is the whole point of the screen.
- **Screen 12 names its write path**: `los detour-create … --classification`
  takes exactly the four `scope_triage` values the columns render.
- **Two hand-drawn pills on Note life** became real `Badge` instances. The file
  now contains zero raw frames impersonating a component.
