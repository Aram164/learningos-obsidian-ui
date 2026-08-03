# LearningOS UI design system v2

The interface carries usability while the core carries meaning.

## Principles

1. **Module-first, not focus-exclusive.** A resume card is useful, but every
   current module and unit remains reachable. Independent stage state is never
   flattened into one global path.
2. **No raw colour.** All colour resolves through Obsidian theme variables.
   Light/dark mode therefore preserves meaning without a second palette.
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

Five permanent destinations: **Home, Learn, Library, Capture, Review.** Areas
(Bachelor's / Skills / Thesis) are sub-areas inside Learn; the decision queues
(Shelving / Garden / Inbox / needs-a-map) are Review. Domain atlas, the
Master's and Job boundaries, Diagnostics and *Rebuild projection* live under
**More** — maintenance is never mixed with study destinations.

## Primary patterns

- **Home**: one Continue card carrying the resume stage and the only filled
  primary action on the screen, a one-line core-owned priority, Upcoming
  (three nearest dates, the rest folded), My learning (every area's modules as
  compact progress rows), and one Attention row linking to Review. Boundaries,
  full coordination detail and maintenance controls are *not* on Home.
- **Program**: current/past semester facts and module cards. Academic status is
  never applied to skills/projects.
- **Module**: four tabs — Overview / Units / Resources / Logistics — with
  **Units** the default for any module that has them. The header carries one
  line of facts (`semester · credits · exam`); institution, code, status and
  examination prose live in Logistics.
- **Unit**: a true three-column workspace — stage rail | current stage | sticky
  note panel — and exactly three visible actions: *Save note*, *Mark complete*,
  and a `•••` overflow holding pause, skip, prerequisite gap, shelving, scoped
  AI and session end. Resource feedback collapses into a per-resource rate
  menu. `Done when` criteria are interactive checkboxes whose ticks are
  UI-owned working state — the core still learns only "complete", from
  `stage-progress`.
- **Review**: every decision queue in one destination — ready to shelve, inbox,
  units needing a map, the Garden.
- **Diagnostics**: contract versions, projection freshness (`✓ current`,
  `● stale`, `? core unavailable`), resolved Python interpreter and its
  attempted paths. Under More, never on Home.
- **Library**: secondary structural search and source master/detail. Global
  identity/evaluations remain distinct from unit use. Omnisearch provides
  full-text/OCR retrieval without becoming canonical metadata.
- **Shelving**: native selected-item review; apply is explicit and delegated to
  the core. AI may explain or propose but cannot broadly write.
- **Inbox**: zero-friction text/file capture through `los.py capture`; the
  interface never asks the learner to choose a canonical destination.
- **Garden and atlas**: the managed Garden Base and generated domain atlas are
  first-class navigation targets, not hidden vault furniture. Reopening a
  target reveals its existing tab instead of multiplying identical tabs.
- **Boundaries**: Master's and Job display policy/action text only. No hidden
  content is loaded to render them.

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
are spent on the Continue card, the stage workspace, the note editor, the
selected Library detail and modals; everything else sits on the page.

Copy is sentence case and action-led: *Resume stage*, *Save note*, *Complete
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

At wide widths Home uses a two-column command centre and Unit uses rail/work/note.
Below 720 px both become a single column. Academic-date rows keep a stable date
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
