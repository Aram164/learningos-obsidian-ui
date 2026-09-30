# LearningOS UI design system v2

The interface carries usability while the core carries meaning.

## Principles

1. **Module-first, not focus-exclusive.** A resume card is useful, but every
   current module and unit remains reachable. Independent stage state is never
   flattened into one global path.
2. **Colour is chosen once and expressed through semantic tokens.** Carbon is
   the chosen visual direction: a near-black canvas, distinct cool surfaces,
   near-white decisive actions, and richer green, blue and amber for meaning.
   Wine, Graphite, Indigo, Ink, Midnight and Slate remain supported reader
   choices. Wine is the initial default; the selected scheme is independent
   of Obsidian's host mode. Native fields follow that scheme's light/dark mode.
   Every component resolves colour through `--los-*` tokens, declared only in
   `00-tokens.css` and `25-palettes.css`; `plugin/styles.css` is composed by
   `build-styles.mjs`. No component names a raw colour.

   Green means applied or supported, blue means information or nearby, and
   amber means attention or uncertainty. Slate uses periwinkle information
   to distinguish it from the cyan brand. Carbon and Graphite have neutral
   brand actions; the other accents remain distinct from semantic hues.
   Colour always repeats a visible word or state, never grants evidence.
   All shipped schemes pass numeric WCAG AA pairs: 4.5:1 for ordinary text,
   including status, selected, raised and semantic surfaces, and 3:1 for
   interactive boundaries. Quiet decorative borders need not compete with
   editable controls. `Custom` remains explicitly unchecked and snippet-owned.

3. **No orphan links or dumps.** Typed chips, cards and exact source actions
   show why a record matters in the current module/unit/stage.
4. **One stage workspace at a time.** Stage rail, exact work, and scratch are
   adjacent in wide panes and stack cleanly as the pane narrows.
5. **Keyboard and motion restraint.** Native buttons/inputs, visible focus
   rings, semantic labels, and `prefers-reduced-motion` support are mandatory.
6. **Honest emptiness.** Missing maps, artifacts, proposals and offline CLI
   states explain the next safe action without inventing completion.

7. **Progressive disclosure.** Show what is needed now, then nearby context,
   then technical detail only on request. Record IDs, operator metadata,
   coordination prose, past dates and diagnostics are available but never
   default. A screen that presents every valid fact at one weight has made no
   decision on the learner's behalf.
8. **One filled action per visible context.** Primary is a filled accent
   button, secondary is a neutral outline, tertiary is a text or menu item.
   Secondary operations live in a `•••` overflow rather than competing with the
   two the learner came for.

## Navigation

Eight permanent destinations: **Home, Modules, Learn, Projects, Library,
Atlas, Garden, Review.** (Amended 2026-09-23: the Atlas joined them and opens on
the ability map; Review carries a live count, which is the length of the same
queue Review lists and never a second tally.) Modules begins with explicit thematic groups and opens
full-page lists/details. Bachelor's, Skills, Job, and Thesis & projects remain
sub-areas inside Learn. Capture, Concept atlas, the Future Master's Planning
boundary, Diagnostics, and *Rebuild projection* live under **More** —
maintenance is never mixed with study destinations.

## Primary patterns

- **Home**: one Continue card carrying the resumable stage and the only filled
  primary action on the screen, followed by a short **Today** list and a short
  **Continue elsewhere** list. Home is not the module catalogue, project
  dashboard, or queue overview. Capture and structural Search remain secondary
  actions; boundaries, full coordination detail and maintenance controls are
  *not* on Home.
- **Program**: current/past semester facts and module cards. Academic status is
  never applied to skills/projects.
- **Modules**: thematic groups → full-page module list → full-page module detail.
  Group membership is projected by the core, never inferred from titles or
  paths. Back restores the group query, selected row and scroll position. The
  detail keeps four tabs — Overview / Units / Resources / Logistics — with
  **Units** the default for any module that has them. The header carries one
  line of facts (`semester · credits · exam`); institution, code, status and
  examination prose live in Logistics.
- **Unit**: a two-column workspace — stage rail | current stage. **Add note**
  follows the stage list and opens a temporary unit/session-note modal rather
  than permanently splitting the workspace. The stage action bar keeps one
  primary action and a `•••` overflow holding pause, skip, prerequisite gap,
  shelving, scoped AI and session end; the completion rule ("finish only
  when…") is stated beside that action, derived from the criteria the producer
  authored. Resource feedback collapses into a per-resource rate
  menu. `Done when` criteria are interactive checkboxes whose ticks are
  UI-owned working state — the core still learns only "complete", from
  `stage-progress`.

  **The stage shows one current action** (revised 2026-09-04, Figma 05).
  Order is stage target → `Done when` → **Current work** → the collapsed
  catalogue → the action bar. *Current work* promotes the single `required-now`
  resource; an unranked pre-v2 row counts as primary, never as deprioritised.
  Everything else collapses to one line that states the true total and the
  triage split — *"All 5 materials · 1 required · 1 if stuck · 3 preserved for
  depth/reference"* — because collapsing a list may never make a source
  unreachable or uncountable.

  **Current work is one material card** (amended 2026-09-23, Figma B1 · 11:291).
  The card states the material's purpose, its title, its kind and exact
  locator, and where it is — in words: *Local file*, *In the vault*, *Remote*,
  *Local copy missing* or *Not available* — before anything is opened.
  *Why this one* (the authored rationale, with coverage on route cards) opens
  only on request. A local copy's bounded excerpt is read from Core
  (`material.span --extract`, snapshot-bound) only when the learner asks for
  it; remote material is never fetched, and a missing copy says so. A
  locator-only placement still reaches its openable source (*Open source*).
  The heading counts *N required*, and the completion rule ends with
  *Completing it records progress, not a learner attempt*: stage completion is
  study progress and never ability evidence.

  **The session stays inside its module.** A concept bridge whose related unit
  belongs to another module is not listed in the lecture; it is counted
  (*"2 connections in other modules"*) with *Open in Atlas*, where both ends and
  the path between them are on screen.

- **Compare materials**: the drawer behind *Compare all* (rewritten 2026-09-23,
  Figma B1a · 70:985; supersedes the purpose/type filter drawer). A short rail
  on the left, one group's cards on the right. *What you need* partitions the
  stage's own placements by the producer's triage — **Required now**, **If
  stuck**, **For reference** (an unranked pre-v2 row counts as required, never
  as deprioritised) — and the rail states the reconciliation outright
  (*"2 + 0 + 3 = 5 on this stage"*), so showing one group never hides or
  uncounts a material. It opens on the most urgent group actually present; an
  empty group says where the materials are. *Beyond this stage* keeps **This
  lecture's full menu** (counted material-type disclosures, closed initially,
  with compact expandable rows and search that reveals matching types) and **All of** the course (other lectures' routes, with
  *Go to lecture* and never a cross-unit choice) one click away. Every card is
  the Current-work card shape: purpose, exact locator, availability in words,
  *Why this one* on demand, the bounded excerpt on request. Selection stays
  `unit.source-selection.set` with its snapshot guard, and it changes the
  current route only — it never deletes or hides a source record. Cross-course
  relationships are not offered here: they live in the Atlas.
  The menu stays on the page instead when there is no stage to open a drawer
  from (no study map, or a map with no stages), because there it is the whole
  account of what the lecture offers.
- **Job learning**: `program-job` is an ordinary non-semester learning area.
  Its modules use the same manifest, search, module detail, unit workspace,
  study-map, note, AI-action, gateway, and receipt paths as every other module.
  The `Job` badge is presentation only; there is no Job-specific dashboard,
  access grant, schema, plan profile, or write path.
- **Study maps**: the Unit surface applies a reviewed map through
  `unit.map.import` — the dialog names the standard the importer will enforce
  and carries a path, never file content, so the SOP's coverage audit stays a
  human gate that happens first. A map that predates the creation template says
  so under *Unit artifacts and evidence*, next to the action that replaces it.
- **Review**: every decision queue in one destination — ready to shelve, inbox,
  units needing a map, the Garden. Amended 2026-09-23 (Figma B2 · 11:334): a
  short selection list and **one open item at a time**, showing its claim or
  decision, its evidence, its effect, and the actions it supports. The queue
  is Core's `review_items` exactly as projected, Core's own ability conflicts
  (an ability whose reasons say later work is conflicting), and the learner's
  unconfirmed ability drafts, labelled *draft, not recorded* — nothing is
  synthesized from counts, status, layout or age, and the Figma entries are
  illustrative only. The open item is the leaf state, so a restored Review
  reopens it. **Confirm & record** is the only control that writes an ability
  record, and it sends exactly the record on screen: `learner.ability-observation.append`
  for a worked attempt, `ability.candidate.append` for a tentative connection,
  both admitted over the `ui` channel only, with
  `confirmation_ref = conversation://learningos-app/<idempotency key>` (the
  Review gesture's own request). It is disabled until Core's shape checks are
  met (reviewed ability, active workspace, result, activity, assistance, work
  pointer, claim); Core checks everything again and its refusal keeps the
  draft.
- **Atlas** (ability map, Figma A1 · 40:1117 and A2 · 40:1203): Core's bounded,
  snapshot-bound `ability.context` horizon, drawn and never derived. Abilities
  fall into **separate groups** — the connected pieces of preparation routes
  and bridges; a tentative connection carries nothing and never joins two
  groups — chosen one at a time from a rail. Inside a group the **directed
  preparation graph** runs left to right (foundations → steps → extensions),
  transitively reduced so an implied arrow is not drawn twice, with the same
  edges as a text outline for assistive technology. **Reviewed bridges are
  bands under the graph**, labelled with kind, review state and source
  freshness, never drawn as preparation arrows. State is always a word on the
  node (*Supported*, *Nearby*, *Uncertain*, *Unmapped*); colour only repeats
  it. Selecting a node opens the **inspector** beside the graph (what counts,
  preparation in one sentence, recorded evidence); *Open full ability detail*
  shows conditions, the evidence the attempt must show, every route, bridges,
  tentative connections and the stages where it is met. *Draft a worked
  attempt* and *Note a possible connection* save UI-owned drafts only; the
  Atlas sends no write. The concept atlas stays under More.
- **Diagnostics**: contract versions, projection freshness (`✓ current`,
  `● stale`, `? core unavailable`), resolved Python interpreter and its
  attempted paths. Under More, never on Home.
- **Global Search**: a manifest-only overlay available from every application
  route. It searches projected modules, units, sources, and compatibility
  projects, preserves the current route while open, and opens the owning route
  for the selected result. It does not parse files or replace full-text/OCR
  retrieval.
- **Library**: **Learning Sources** and **Topic Packs** are distinct top-level
  collections. Each follows thematic groups → full-page list → full-page detail,
  with no automatic first selection and no permanent detail column. Topic Packs
  expose one explicit purpose and preserve canonical manual entry order; they
  are not a source type. Back restores collection, group, query, filters,
  selected row and scroll. Omnisearch remains an optional full-text/OCR fallback.
- **Shelving**: native selected-item review; apply is explicit and delegated to
  the core. AI may explain or propose but cannot broadly write.
- **Inbox**: zero-friction text/file capture through `los.py capture`; the
  interface never asks the learner to choose a canonical destination.
- **Garden and atlas**: the managed Garden Base and generated domain atlas are
  first-class navigation targets, not hidden vault furniture. Reopening a
  target reveals its existing tab instead of multiplying identical tabs.
- **Boundaries**: Future Master's Planning is the sole curriculum boundary.
  No quarantined content is loaded to render it.

## Components and tokens

Spacing uses `--los-1` through `--los-6` on a 4 px scale. Body copy is 14 px,
page headings are capped at 28 px and section headings are 17 px. Normal
controls are at least 36 px high, fields 38 px, grouped segments 32 px and
sidebar rows 40 px. Surfaces use 12–24 px padding; sections use 24–32 px gaps.
Radii are 8, 12 and 18 px. Fields use contrast-checked strong boundaries;
reading surfaces use quieter token borders. Pane padding contracts naturally.

Every button-like primitive explicitly resets theme appearance, size,
alignment, line height, wrapping, hover, focus, and disabled behavior. Shared
variants are primary (`--cta`), secondary (default), quiet, row, and tertiary.
Row actions keep the whole label readable with normal word wrapping; they never
allow character-by-character wrapping. Shared primitives also include badges,
typed chips, fact lists, workspace/unit cards, empty states, sections, page
headers, filter tabs, `disclosure()` and `overflowMenu()`.

Layout and section choices share one rounded group with a raised selected
segment, visible focus and native `aria-pressed` buttons. Arrow keys move
focus; Enter activates; Tab leaves the group. Wrapping keeps every label
reachable in narrow panes. Library keeps its existing List/Columns behaviour.

The active macOS 26 references in Figma are genuine linked Apple Sidebar Item
`113:209` (Large, Selected) and Segmented Controls `113:1488` / `119:146`.
Their comfortable row height, grouped selection and readable labels inform
LearningOS's own reusable adaptation. The reference board is `119:121`;
the token-bound switcher variants are `119:108` / `119:113`. Native references
retain SF Pro; LearningOS mock-ups use Inter, and Obsidian uses its inherited
UI font and existing icons. Apple assets are not embedded in the plugin.

**Amended 2026-08-03: the always-visible ownership footer is retired.** It
stated architecture policy under every screen, which made the product read as
internal tooling rather than a study cockpit. The statement is now made once,
in Settings → About and on the Diagnostics view; `OWNERSHIP_STATEMENT` is the
single copy. This supersedes the earlier "always-visible ownership footer"
primitive.

**Borders carry meaning.** Strong borders mark selection, focus, an editable
area, or a boundary that needs review. Browsing rows use quiet rounded surfaces,
subtle token borders, and whitespace so each target is easy to distinguish.
Raised surfaces emphasize the Continue card, stage workspace, selected Library
detail, and modals. Navigation labels and icons align to a stable left edge.

Copy is sentence case and action-led: *Resume stage*, *Add note*, *Complete
stage*, *Attach selected file*, *Approve selected changes*, *End learning
session*. The learner is never asked for IDs or filing destinations while
working.

Stage notes and Inbox text retain explicit UI-owned drafts while the learner
navigates. Draft status is visible beside the editor; a successful core write
clears the corresponding draft. The draft is convenience state only and never
becomes a second canonical record.

Material copies outside the repository vault open in the operating system's
default application. Vault-native Markdown, PDF, Canvas, and Base files open in
Obsidian; authored registry files unsupported by Obsidian open externally with
clear success or failure feedback.

## Responsive and accessibility contract

Home keeps one reading column; row actions stack at narrow pane widths.
Library retains full wrapped place labels, placing the inspector below the
list before places move above it. Unit uses rail/current stage, contracts the
rail at 980 px of content width and stacks it at 700 px; the stage list remains
scrollable and complete. Atlas moves the inspector below the graph at 980 px,
and stacks list cells at 600 px. Review stacks at 850 px. These depend on the
pane's content width, including splits in a wide window. Modals use their
available viewport, keep navigation and close controls reachable, and retain
material totals and reconciliation at narrow widths.

Presentation redraws retain the focused search field's text, caret, selection
and scroll, and restore the corresponding button inside its own labelled
group. Restoration is scoped to the same leaf and never steals another
control's focus. Fixture regressions cover mid-string typing, replacing a
selection, repeated input, multiple leaves and group activation. Library's
existing in-place filtering and disclosure-state handling remain authoritative.
Native controls carry accessible labels and token focus rings. Loading and
empty/error states use the same headers, readable copy and safe action controls.
Reduced motion removes hover transitions.

## Anti-patterns

- one learning path dominating or hiding the curriculum;
- a metric wall, generic source sea, or raw wikilink list;
- direct canonical parsing/writing in UI code;
- AI identity inferred from the active file;
- scalar mastery or universal source ratings;
- ability evidence inferred from stage completion, shared concept tags or
  tentative connections;
- inaccessible click-only containers for primary actions;
- hardcoded colour, layout that requires a wide window, or a plugin-only fact.
