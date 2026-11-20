# Interface designs

LearningOS can be drawn by more than one interface. The learner flips between them
at will, so two designs can be compared on the same screen with the same data. A
design changes how things are drawn and nothing else: same manifest, routes, gateway
writes and drafts. It may not add a write path, a route, or a fact of its own.

## Adding a design

1. **Register it** in `src/app/interface-design.ts`: one row in `INTERFACE_DESIGNS`
   with an id, a label, a description, the colour schemes it is drawn for, and its
   default scheme. The Settings dropdown, the sidebar toggle and the commands all
   read this list, so nothing else needs to know the design exists.
2. **Register its screens** in `src/designs/registry.ts`, from a new folder
   `src/designs/<id>/`. `src/designs/screens.ts` lists what can be replaced: `nav`,
   `home`, `learn`, `moduleList`, `moduleDetail`, `unit`, `atlas`.
   Every one is optional. Anything left out, and any screen that returns `false`,
   falls through to the shared base renderer in `src/views/`. That is how a
   design ships part-built or leaves utility surfaces shared without losing a capability.
3. **Add its stylesheet** as `src/styles/4x-design-<id>.css` and list it in
   `STYLESHEET_MODULES` in `build-styles.mjs`. Put every rule inside one block,
   `body.los-ui-<id> { … }`, using native nesting. A test enforces this: it
   is what guarantees that switching away removes the whole design and leaves
   other designs untouched. Colours come from `--los-*` tokens only. Select the
   body class, never the `data-los-ui` attribute: Obsidian 1.15 paints a saved
   HTML snapshot of the workspace while it starts, and that snapshot keeps only
   the body's `class` and `style`, so an attribute-scoped design is missing from
   it and every launch flashes the wrong layout.
4. **Draw the toggle** in your `nav` screen with `renderDesignSwitch` from
   `src/app/design-switch.ts`, if you replace the sidebar. No design may strand the
   learner inside it.

Classic is retired from `INTERFACE_DESIGNS`; `'study-desk'` is the default
design (`DEFAULT_INTERFACE_DESIGN`), and legacy `'classic'` or unknown values
normalize to `'study-desk'`. A test-only `'__base_views__'` sentinel lets the
base feature-view regression suites exercise `src/views/*` directly.

A new colour scheme goes in `src/styles/25-palettes.css` and `PALETTES` in
`src/app/palette.ts`, where the existing contrast gate checks it automatically.

## Rules a design keeps

- **Reuse the feature logic.** Writes and pure domain models belong in
  `src/features/` (`material-purpose.ts`, `lecture-materials.ts`, `study-work.ts`,
  `atlas-model.ts`, `module-map.ts`, `labels.ts`, `completeStage`,
  `stageMenuItems`, `renderPlanControls`), never duplicated across designs or
  imported across `src/designs/*`.
- **Everything stays reachable.** A capability the design does not redraw stays
  reachable through the shared feature renderer or a disclosure.
- **Boundary rules still bind:** `CLAUDE.md` and the anti-patterns in
  `DESIGN.md`. Regions, spines and similar groupings are presentation; they never
  become a graph edge, an evidence claim or a record.
- **View-owned attention stays view-owned.** Which tab is open is not a route.

## Looking at it

```bash
npm run preview:design
```

This runs the real plugin code in a browser against the fixture manifest, read-only
(`--manifest PATH` for another one, `--port N`). Add `?design=<id>` to the URL. It has
no Obsidian chrome and no Obsidian stylesheet, so it speeds up design work but does
not replace checking the real app.
The default synthetic fixture also supplies the existing test-only ability and
material-span reads, so graph inspection can be checked visually. Every write
and unsupported command fails explicitly. A custom manifest receives no
synthetic ability state or evidence.

Arrows in the Atlas (concept links and the module map) are drawn on an animation
frame. A browser never runs one in a hidden or background tab, so keep the preview
tab visible when checking them.

Two sessions building designs at once should each work on their own branch from
`main`. They meet in only two registry files and the `build-styles.mjs` list, one row
each, so merging them is trivial.

## Focus 2.0

Focus 2.0 implements the [Focus 2.0 design](https://www.figma.com/design/p4Mpw78mLv8FxJAa6SPAEQ)
("LearningOS — Focus 2.0") in `src/designs/focus/`: architectural 224 px sidebar
with six unified destinations (Learn merged into Modules) and `In progress` unit
shortcuts (`study-work.ts`), 44 px top command bar with per-leaf Back/Forward
history and breadcrumbs, Home/Modules/Module detail, 48 px horizontal stage
timeline strip, 60/40 Split Session Cockpit (`Start here`, inline Purpose-tabbed
`If you get stuck`, folded `Kept for reference` | `Prove to complete` shifting CTA
from `Open` to `Complete stage`, inline `Working scratch` local note draft, and
stage concepts), Purpose-first `Unit materials` with `Best fit`/`Course` marks and
`S1..SN` stage matrix, explicit mapless `Needs a study map` screen, and native
Focus Atlas (`D1` 3-column Concept Dependency Flow with prerequisite reasons and
`See it in its module` signpost + `D2` deterministic Module Revision Map).
Daylight and Nightfall are remembered independently under `uiDesignPalettes`.
`Notes & shelves`, `Diagnostics`, `Review`, `Garden`, and `Library` retain their
shared feature renderers styled in Focus tokens.

Modular macOS 26/27 UI Kit styling (`01b-macos-ui-kit-foundations.png` in
`outputs/2026-11-19-focus-ui-2.0-redesign/screens/`) is adapted cleanly to
Obsidian's DOM controls and bundled Lucide icons using `--los-*` tokens only; no
Swift/AppKit binary or copied bitmap screen is shipped. Criteria remain local
working marks; completion remains study progress; learner evidence remains a
separate reviewed record.

Returning from a Course-source lecture detour keeps *Back to ‹lecture› · Stage N*
and leaf-scoped attention (bounded to the eight most recent lectures) in memory.
Entering wrap-up never advances progress, saves a note, commits or pushes.

## Study Desk

Study Desk implements the [Study Desk design](https://www.figma.com/design/OYWzCiANiWjVWwwu5GTYrz)
in `src/designs/study-desk/`: warm paper, a serif reading voice, Wine and Lamplight.
It draws Home, Modules, the lecture, the open-book session and the Atlas; every
other destination keeps its feature renderer with Study Desk tokens.

**A lecture's materials** (v2 frames C2–C4). The Materials view lists every
material of the lecture once: each placement target across the plan, then every
route no stage uses. Materials are grouped by what they are for (The lecture,
Intuition, Theory, Practice, Build it, Going deeper, Reference), then by type in
one fixed order, best first. `src/features/unit/material-purpose.ts` decides purpose,
type and rank from structured fields only: provenance, route depth and format, the
working kind, the source's role and the stage triage. It never reads a title. Best
fit marks a group's top row only when that row strictly leads and nothing in the
group is the learner's pick. Up to 6 materials make one flat list; above 30, groups
start folded with their counts. Search and the Stage, Type and Where filters are
view attention.

**One Material row** (`material-row.ts`) is used on the lecture page, in the
session and in each stage's list on the plan. The row opens the material; the
chevron opens its details with existing actions only: Open, Inspect the pages,
Show in Library, Choose for this lecture (the guarded source selection) and, when
the row stands for one stage's placement, Rate (stage feedback).

**The session** (frame D1) shows Start here, then the rest of what the stage
requires, then "If you get stuck", split by purpose. What the stage keeps for
reference waits in one folded line. Compare stays until a module-wide materials
view carries every course material.

**Atlas.** The route's existing `module` field, with no concept in focus, draws
that module at a glance (frame F5). It has one row per lecture in course order, each
lecture's `knowledge_map` ideas left to right by `builds_on`; exam blocks are named,
not drawn. Positions come from the data alone, so the map is the same on every
visit. Ideas are not links: the map is for revising, and finding stays in Search
and the lists. Links between lectures are not drawn, because Core records none yet.
On a concept, each prerequisite shows its relation's own `context` note, and "See
it in its module" opens the map at the lecture that teaches the concept.

No new write path or route. Filters, open rows, folds, the session's purpose tab and
the lecture a map opens at are held per view (`materials-state.ts`,
`module-map.ts`), never in a route.
