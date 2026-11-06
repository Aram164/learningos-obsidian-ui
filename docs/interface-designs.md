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
   falls through to the classic renderer. That is how a design ships part-built
   without losing a capability.
3. **Add its stylesheet** as `src/styles/4x-design-<id>.css` and list it in
   `STYLESHEET_MODULES` in `build-styles.mjs`. Put every rule inside one block,
   `body[data-los-ui="<id>"] { … }`, using native nesting. A test enforces this: it
   is what guarantees that switching away removes the whole design and leaves
   Classic untouched. Colours come from `--los-*` tokens only.
4. **Draw the toggle** in your `nav` screen with `renderDesignSwitch` from
   `src/app/design-switch.ts`, if you replace the sidebar. No design may strand the
   learner inside it.

A new colour scheme goes in `src/styles/25-palettes.css` and `PALETTES` in
`src/app/palette.ts`, where the existing contrast gate checks it automatically.

## Rules a design keeps

- **Reuse the feature logic.** Writes go through the helpers the classic screens
  use, such as `completeStage`, `stageMenuItems`, `openMaterialComparison` and
  `renderPlanControls`. If a classic renderer holds logic you need, extract it into
  a function both can call rather than copying it, and keep Classic's behaviour
  identical.
- **Everything stays reachable.** A capability the design does not redraw must still
  be one click away, usually by calling the classic section renderer inside a
  disclosure.
- **Classic's hard rules still bind:** `CLAUDE.md` and the anti-patterns in
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

## Focus

Focus implements the [refined Learn design](https://www.figma.com/design/gVh0ebCrqHsxpyaDBX5pzf?node-id=149-1057)
in `src/designs/focus/`: Home/Learn, whole-row Modules, module detail, study plan,
focused session, grouped material comparison and session wrap-up. Light and Dark
are remembered independently of Classic and Study Desk. Other destinations keep
their existing feature renderer, with Focus tokens and typography.

The refined foundation uses warm paper, forest navigation and one teal interaction
family in Light and Dark. An inset marker distinguishes persistent selection from
keyboard focus; named warnings retain their amber treatment. The same controls,
spacing and reading surfaces carry through the inherited feature renderers.

Both **Thesis & projects** entries open the complete collection of projected
`kind: project` modules. The existing Modules route and leaf-owned collection
attention retain search, selection and scroll on return from a detail. No first
project is selected automatically. The empty state offers the full curriculum.

Session leads with the current authored task, its instructions and access state,
then exact criteria and the completion action. Optional material facets separate
action/purpose, medium and access while retaining authored order, triage, complete
inventory counts and reset. Short unit menus stay flat with the existing explicit
route-choice controls. Criteria remain local working marks; completion remains
study progress; learner evidence remains a separate reviewed record.

Atlas retains its complete domain inventory, graph/outline and Plane/List views.
Selecting a concept inspects it in place; **Explore from here** changes the centre.
Mode meanings, depth and active scope are visible. Details/Routes retain the
ability camera; **Fit selection** explicitly changes its framing. Global search
names its supported record types and offers separate Atlas destinations.

The stage rail becomes an explicit Study plan control below 800px of pane width.
Plan, materials, overview and wrap-up attention belongs to the leaf, not the
route. Criteria use the existing local marks. Wrap-up edits the existing local
unit-note draft; Review and save note opens the existing guarded note dialog,
and Review session changes opens the existing exact-change review. Entering
wrap-up never advances progress, saves a note, commits or pushes.

The Figma macOS kit's Swift components are adapted to the existing DOM controls
and bundled Obsidian icons; no Swift runtime or copied bitmap screen is shipped.
The semantic control and navigation pairs pass the existing contrast gate.
No illustrative Figma progress is copied into learner state.

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
