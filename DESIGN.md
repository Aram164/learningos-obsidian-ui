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
   defined in exactly two blocks (light, and `.theme-dark`), and both are
   contrast-checked — body text 16.5:1, secondary text 5.0:1, muted text 4.5:1,
   brand fill 9.7:1, completion fill 8.0:1, information 6.1:1, attention 6.3:1,
   and reversible choice 8.6:1. Wine remains the brand action; sage is reserved
   for commit/apply, slate for opening information, amber for attention, and
   blush for reversible selection. Colour never carries meaning alone: every
   state and action also has a text label.
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

Six permanent destinations: **Home, Modules, Learn, Library, Capture, Review.**
Modules begins with explicit thematic groups and opens full-page lists/details. Areas
(Bachelor's / Skills / Thesis) remain sub-areas inside Learn; the decision queues
(Shelving / Garden / Inbox / needs-a-map) are Review. Domain atlas, the
Master's and Job boundaries, Diagnostics and *Rebuild projection* live under
**More** — maintenance is never mixed with study destinations.

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
  shelving, scoped AI and session end. Resource feedback collapses into a per-resource rate
  menu. `Done when` criteria are interactive checkboxes whose ticks are
  UI-owned working state — the core still learns only "complete", from
  `stage-progress`.
- **Job learning**: the confidential Job destination adapts its independent
  plan records into the same presentation-only learning route, progress,
  stage workspace, material catalogue, facts and card primitives as Unit.
  This is deliberate reuse of the original learning experience, not a data
  merge: Job records never enter the canonical manifest, Job writes still use
  only the Job gateway, and Stratum remains an unopened, immutable reference.
  *Create study plan* names the standard it is creating under and prefills from
  the read-only `plan.template` query, so the interface never carries its own
  copy of the defaults; a plan authored before that template is badged
  `pre-template` rather than shown as if it conformed.
- **Review**: every decision queue in one destination — ready to shelve, inbox,
  units needing a map, the Garden.
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
- **Boundaries**: Master's and Job display policy/action text only. No hidden
  content is loaded to render them. Shared presentation components may render
  explicitly supplied Job view models; they never acquire, index, persist, or
  transmit Job content themselves.

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
typed chips, learning progress rows, two-column academic-date rows, cards,
empty states, sections, page headers, `disclosure()` and `overflowMenu()`.

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
- inaccessible click-only containers for primary actions;
- hardcoded colour, layout that requires a wide window, or a plugin-only fact.
