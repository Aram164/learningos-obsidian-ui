# LearningOS UI — design system v1

The interface carries all of the usability. The core optimises for robustness
and correctness and is not required to be pleasant to browse; if something is
hard to find, that is a bug **here**, not there (ADR-006 addendum 4).

Three rules make the rest fall out:

1. **No raw colour.** Everything resolves to an Obsidian theme variable, so the
   app follows whatever theme and light/dark mode is active. Enforced by the
   test suite (`no hardcoded colours in CSS`).
2. **No orphan links.** A reference to another record is a `chip`, not a
   `[[wikilink]]` in a list. Chips carry a type icon and a colour, and click
   through to that record — the fix for "everything is just a dump of links".
3. **One learning focus.** The current path and current stage dominate. Library
   entities, metrics, inboxes, and graphs are secondary and appear only when
   the learner asks for them.

## Tokens

Defined once on `.los-root` in `plugin/styles.css`.

| Group | Tokens | Notes |
|---|---|---|
| Space | `--los-1` … `--los-7` (4·8·12·16·24·32·48) | 4pt scale; no arbitrary px |
| Radius | `--los-r-sm` 6, `--los-r-md` 10, `--los-r-lg` 14, `--los-r-pill` | cards use `lg`, controls `sm`, chips/facets `pill` |
| Type | `--los-display` 2.6rem, `--los-h1` 1.7, `--los-h2` 1.25, `--los-h3` 0.78 (uppercase label), `--los-body/small/micro` | body sizes inherit Obsidian's UI font scale |
| Surface | `--los-surface`, `--los-surface-2`, `--los-line`, `--los-line-strong` | mapped to `--background-*` |
| Motion | `--los-fast` 110ms | hover/selection only; nothing animates on load |
| Type accents | `--los-note` blue, `--los-concept` purple, `--los-source` orange, `--los-module` green, `--los-workspace` cyan, `--los-collection` pink | one hue per canonical record type, used by icons and chips |

## Components

| Component | Class | Variants | States |
|---|---|---|---|
| Button | `.los-btn` | `--cta`, `--quiet` | hover, `:focus-visible` |
| Badge | `.los-badge` | `--active`, `--blocked`, `--paused`, `--role` | static |
| Chip (typed record reference) | `.los-chip` + `.los-t-<type>` | — | hover, click → navigate |
| Card | `.los-card` + `.los-s-<status>` | status stripe on the left edge | hover lift, `.is-dim` |
| Row | `.los-row` | — | hover, `.is-selected` |
| Empty state | `.los-empty` | `--error` (adds recovery actions) | — |
| Banner | `.los-banner` | `--ok`, `--warn`, `--info` | clickable when it links a report |

Every clickable element gets `.is-clickable`, which supplies the cursor and a
`:focus-visible` ring. Keyboard focus is not optional.

## Patterns

**Home** (`.los-home-v2`) — one current path, stage progress, and one resume
action. Working notes, shelving, and the Job boundary are compact summaries,
not dashboards of links or counts.

**Learning path** (`.los-path-view`) — ordered stages on the left, the selected
stage's objective/resources/done-when in the center, and its working note plus
handwriting attachments on the right. The note column stacks below on narrower
windows. Completion advances through the core gateway with a snapshot guard.

**Shelve review** (`.los-shelve-view`) — an AI proposal of destinations,
rationale, and diffs. Native checkboxes select items. The CTA sends only the
selected IDs back to the operator; the view never writes canonical files.

**Explorer** (`.los-explorer`) — master/detail. Toolbar with type tabs and a
search field; a facet row derived from the data itself (counts included); a
scrolling result list; a detail pane with kicker → title → id, an action row,
a facts grid, prose blocks, evaluation cards, and grouped chips for everything
connected. Chips push onto a history stack, so **Back** works. Collapses to one
column under 900px.

**Navigator** (`.los-app-nav`) — left dock. Home, Learning path, Shelve review,
Library, then University and the quarantined Job area. Entity taxonomy stays
inside the secondary Library.

**Finder** (`.los-suggest`) — fuzzy modal over all ~400 records; notes and
workspaces open as files, everything else opens in the Explorer.

## Search behaviour

Two passes, because a filter and a suggestion box want different things:

1. **Strict** — every whitespace-separated token must appear literally in
   title, id, aliases, authors, organization or domain. Scored by match
   position and word-start bonus. This is what the Explorer list uses.
2. **Loose** — subsequence match, used *only when the strict pass found
   nothing*, so a typo degrades to "close enough" instead of an empty screen.

## Copy

- Sentence case everywhere. No title case in UI labels.
- Buttons are verbs: *Resume stage*, *Save note*, *Complete stage*, *Approve
  selected changes*, *Open online*.
- Empty states say what is missing **and** what to do: "Projection unavailable
  … rebuild it to continue", with the button right there.
- Never blame the reader. "Nothing matches — try a shorter query" beats
  "invalid search".
- The footer states the boundary in one line, every time: presentation only,
  facts live in the core, buttons are conveniences, never duties.

## Anti-patterns (things this system exists to prevent)

- A list of paths or `[[wikilinks]]` with no active learning context.
- A metric strip that makes the learner decide where to continue.
- Asking for note IDs, concepts, destinations, or filing while a stage is open.
- A 470 KB generated markdown file used as a browsing surface.
- Two implementations of "how do I find a source".
- Any colour that does not follow the user's theme.
- An interactive affordance that cannot be reached from the keyboard.
