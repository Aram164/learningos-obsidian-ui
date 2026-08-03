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

## Primary patterns

- **Home**: compact command centre with a slim resume row and one-line
  core-owned semester priority; academic dates and Bachelor's modules share the
  primary column, while Skills and Thesis keep independent tables in the
  secondary column. Workspace next actions are projected into the relevant
  module row. Missing-map, shelving, inbox, and boundary rows remain visible
  below the command centre without competing with current work.
- **Program**: current/past semester facts and module cards. Academic status is
  never applied to skills/projects.
- **Module**: administrative header where applicable, stable component tabs,
  all units grouped by state, module source roles/routes, related workspaces.
- **Unit**: ordered stage rail; objective/resources/done-when; stage note,
  attachments and use evidence; durable artifact section; feedback, detour,
  shelving, scoped-AI and session-end actions.
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
typed chips, compact data tables, two-column academic-date rows, cards, empty
states, sections, page headers, and the always-visible ownership footer.

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
