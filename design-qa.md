# LearningOS compact command centre — design QA

## Visual source and implementation

- Selected source: `/Users/aramaljanadi/.codex/visualizations/2026/08/03/019fc813-e1f8-7331-9ae0-140039e75a7a/learningos-audit/selected-home-command-centre.png`
- Wide live implementation: `/Users/aramaljanadi/.codex/visualizations/2026/08/03/019fc813-e1f8-7331-9ae0-140039e75a7a/learningos-audit/final-home-light-1256.png`
- Responsive live implementation: `final-home-dark-720.png`, `final-home-light-720.png`, `final-home-dark-480.png`, and `final-home-light-480.png` in the same audit directory.
- Related live views: `final-module-light-1256.png`, `final-unit-light-1256.png`, and `final-unit-keyboard-focus-light-1256.png` in the same audit directory.

The source and live Home capture were reviewed together at the same 1256×800
window proportion. The implementation intentionally substitutes only canonical
manifest data for the mock's invented examples.

## Findings and fixes

### P0 — fixed

- Academic deadlines now have exactly two layout columns: a bounded date column
  and a flexible content column.
- Registration and exam actions are children of the flexible content column;
  there is no third action track that can squeeze prose.
- Long labels use normal word wrapping (`overflow-wrap: break-word` and
  `word-break: normal`). No one-character columns or horizontal page overflow
  were visible at 1256, 720, or 480 px.
- The three nearest dates remain visible. Later upcoming dates, past dates, and
  registration actions stay complete and keyboard-reachable through compact
  native disclosures.

### P1 — fixed

- Home, navigation, Module, Unit, Library, Inbox, Shelving, and boundary views
  share a 14 px body scale, 28 px maximum page heading, 17 px section heading,
  12–16 px surface padding, 28–32 px normal controls, and 24–32 px section
  rhythm.
- All button-like components reset appearance, width, height, alignment, line
  height, wrapping, hover, focus, and disabled behavior against Obsidian theme
  overrides.
- Unit feedback is tertiary and compact; stage completion retains the primary
  semantic variant.

### P2 — fixed

- Home follows the selected hierarchy: restrained Current work heading, slim
  resume surface, Semester priority heading with one-line summary, two-column
  command centre, and compact manifest-backed tables.
- The primary action uses the selected outlined accent treatment and navigator
  rows use compact theme surfaces.
- Skills and Thesis remain separate. Queues and boundaries remain below the
  primary composition as secondary rows.
- Additional real dates and longer real next actions are handled with
  disclosure and wrapping rather than deleted or replaced with mock data.

## Responsive, theme, and interaction checks

- 1256×800, 720×800, and 480×800 were checked in both dark and light themes.
- At 720 and 480 px the left sidebar was collapsed so the tested LearningOS
  content viewport matched the requested width; the command centre becomes one
  column and deadline rows stack only at 480 px.
- Controls remain at least 24×24 px, with normal wrapping and separation.
- Home → Module → Unit was traversed in the live vault with keyboard tab
  navigation. Native controls expose a visible theme-accent focus ring; the
  focus capture shows the Home navigator control focused from the Unit state.
- Reduced-motion behavior remains intact.

## Verification

- Build: passed.
- Synthetic fixture suite: 87 checks passed.
- `install.py --dry-run`: passed.
- Guarded live-vault install and CLI smoke test: passed.
- Live Obsidian reload and Home/Module/Unit inspection: passed.

final result: passed
