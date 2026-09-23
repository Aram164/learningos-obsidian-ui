# LearningOS UI design system v2

The interface carries usability while the core carries meaning.

## Principles

1. **Module-first, not focus-exclusive.** A resume card is useful, but every
   current module and unit remains reachable. Independent stage state is never
   flattened into one global path.
2. **No raw colour *in components*; one palette at the root.** Revised
   2026-08-15. This principle used to read "all colour resolves through Obsidian
   theme variables", which meant LearningOS had no visual identity of its own —
   it looked like whichever theme happened to be installed. It now has one:
   **warm daylight paper with a berry-wine identity**, defined once in
   `src/styles/00-tokens.css` as `--los-*` tokens and grounded in the Figma
   foundations. LearningOS keeps this daylight work surface inside either
   Obsidian host mode; dark chrome may frame it, but the learning canvas does
   not become another near-black developer panel.
   (`plugin/styles.css` is the composed artifact — the cascade is declared in
   `build-styles.mjs`.)

   The constraint the old rule was protecting is unchanged and still binding:
   **no component may name a colour.** Every rule refers to a token, colour is
   defined only in palette blocks, and every one of them is
   contrast-checked — body text 16.5:1, secondary text 5.0:1, muted text 4.5:1,
   brand fill 9.7:1, completion fill 8.0:1, information 6.1:1, attention 6.3:1,
   and reversible choice 8.6:1. Wine remains the brand action; sage is reserved
   for commit/apply, slate for opening information, amber for attention, and
   blush for reversible selection. Colour never carries meaning alone: every
   state and action also has a text label.
2a. **Schemes are palette swaps; meaning does not move.** Amends principle 2,
   2026-09-11. Colour now lives in more than two blocks: the base palette in
   `00-tokens.css`, the `.theme-dark` restatement beside it, and one block per
   selectable scheme in `25-palettes.css` (Graphite, Indigo, Ink, Midnight,
   Slate, Carbon). The reader chooses in Settings → LearningOS UI.

   Three rules keep this from becoming the drift principle 2 exists to prevent:

   - **A scheme may vary canvas and brand only.** The light schemes do not
     touch `--los-success`, `--los-info` or `--los-warning`: sage still means
     applied, slate information, amber attention. A skin the reader picks must
     not change what a colour *means*. The dark schemes restate the semantics
     because a wash is a tinted panel, and on a dark ground a tinted panel is
     darker than the canvas rather than lighter — but they keep the same
     assignments.
   - **The brand must stay distinguishable from all three semantic hues**, so
     decisive action is never mistaken for applied, information, or attention.
     That is why there is no green or amber scheme: Graphite and Carbon solve
     it by having no brand hue at all, Indigo and Midnight by being far more
     saturated than slate, and Slate by moving *information* onto periwinkle
     rather than moving the brand.
   - **Every scheme passes the same numeric gate** before it can ship — the
     contrast pairs in `tests/dashboard/runtime-integrity.js`, which also
     refuses a scheme declaring a token the others lack. The state hues are
     checked as text (4.5:1), not only as dots (3:1), since a status word now
     carries its tone.

   `Custom` is the deliberate exception: it sets the attribute, ships no rules,
   and is labelled as unchecked. A reader's CSS snippet is then the only rule
   defining those tokens, so it needs no `!important` to win — which is also
   why the dark-surface rule no longer uses one.

3. **No orphan links or dumps.** Typed chips, cards and exact source actions
   show why a record matters in the current module/unit/stage.
4. **One stage workspace at a time.** Stage rail, exact work, and scratch are
   adjacent on wide windows and stack cleanly below 1020/720 px.
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
  lecture's full menu** (purpose-first sub-headings in the fixed learnable
  order, with search) and **All of** the course (other lectures' routes, with
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
page headings are capped at 28 px, section headings are 17 px, surfaces use
12–16 px padding, and normal controls are 28–32 px high. Sections are separated
by 24–32 px instead of card-scale whitespace. Radii use
`--los-r-sm/md/lg/pill`; surfaces and borders map to Obsidian
`--background-*`; status stripes map to theme colours.

Every button-like primitive explicitly resets theme appearance, size,
alignment, line height, wrapping, hover, focus, and disabled behavior. Shared
variants are primary (`--cta`), secondary (default), quiet, row, and tertiary.
Row actions keep the whole label readable with normal word wrapping; they never
allow character-by-character wrapping. Shared primitives also include badges,
typed chips, fact lists, workspace/unit cards, empty states, sections, page
headers, filter tabs, `disclosure()` and `overflowMenu()`.

**Amended 2026-08-03: the always-visible ownership footer is retired.** It
stated architecture policy under every screen, which made the product read as
internal tooling rather than a study cockpit. The statement is now made once,
in Settings → About and on the Diagnostics view; `OWNERSHIP_STATEMENT` is the
single copy. This supersedes the earlier "always-visible ownership footer"
primitive.

**Borders carry meaning.** They mark selection, focus, an editable area, or a
boundary that needs review — not ordinary navigation, module, resource or queue
rows, which are separated by dividers and whitespace instead. Raised surfaces
are spent on the Continue card, the stage workspace, the note modal, the
selected Library detail and modals; everything else sits on the page.

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

Home uses one focused content column at every width; rows stack their action below the label on narrow screens. Unit still uses rail/work/note at wide widths and becomes a single column below 720 px. Academic-date rows keep a stable date
plus flexible-content grid until 480 px, when the date stacks above the content;
actions always remain inside the flexible content row. Compact tables stack
their labeled cells at 480 px. Resource actions wrap below their label. Every
interactive element is a native control with an ARIA label where visible text
is insufficient. Focus rings use the theme accent; loading does not animate,
and reduced-motion removes hover transitions.

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
