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

- **Home**: resume shortcut; every current Bachelor's module grouped under the
  semester; separate Skills and Thesis/Projects; small needs-map, shelving and
  inbox queues; boundary cards only.
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
- **Boundaries**: Master's and Job display policy/action text only. No hidden
  content is loaded to render them.

## Components and tokens

Spacing uses `--los-1` through `--los-7` on a 4 px scale; radii use
`--los-r-sm/md/lg/pill`; surfaces and borders map to Obsidian
`--background-*`; status stripes map to theme colours. Shared primitives are
buttons (`--cta`, `--quiet`), badges, typed chips, status cards, rows, empty
states, sections, page headers and the always-visible ownership footer.

Copy is sentence case and action-led: *Resume stage*, *Save note*, *Complete
stage*, *Attach selected file*, *Approve selected changes*, *End learning
session*. The learner is never asked for IDs or filing destinations while
working.

## Responsive and accessibility contract

At wide widths the Unit view is rail/work/note. Below 1020 px the note spans the
next row. Below 720 px all layouts become a single column and resource actions
wrap below their label. Every interactive element is a native control with an
ARIA label where visible text is insufficient. Focus rings use the theme accent;
loading does not animate, and reduced-motion removes hover transitions.

## Anti-patterns

- one learning path dominating or hiding the curriculum;
- a metric wall, generic source sea, or raw wikilink list;
- direct canonical parsing/writing in UI code;
- AI identity inferred from the active file;
- scalar mastery or universal source ratings;
- inaccessible click-only containers for primary actions;
- hardcoded colour, layout that requires a wide window, or a plugin-only fact.
