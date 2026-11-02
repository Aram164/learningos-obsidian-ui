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

Two sessions building designs at once should each work on their own branch from
`main`. They meet in only two registry files and the `build-styles.mjs` list, one row
each, so merging them is trivial.

## Focus

Focus implements the [Learn redesign](https://www.figma.com/design/gVh0ebCrqHsxpyaDBX5pzf?node-id=116-3628)
in `src/designs/focus/`: Home/Learn, whole-row Modules, module detail, study plan,
focused session, grouped material comparison and session wrap-up. Light and Dark
are remembered independently of Classic and Study Desk. Other destinations keep
their existing feature renderer, with Focus tokens and typography.

The stage rail becomes an explicit Study plan control below 800px of pane width.
Plan, materials, overview and wrap-up attention belongs to the leaf, not the
route. Criteria use the existing local marks. Wrap-up edits the existing local
unit-note draft; Review and save note opens the existing guarded note dialog,
and Review session changes opens the existing exact-change review. Entering
wrap-up never advances progress, saves a note, commits or pushes.

The Figma macOS kit's Swift components are adapted to the existing DOM controls
and bundled Obsidian icons; no Swift runtime or copied bitmap screen is shipped.
The light blue action colour is strengthened to satisfy the existing contrast
gate. No illustrative Figma progress is copied into learner state.
