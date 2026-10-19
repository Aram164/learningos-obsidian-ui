# LearningOS design QA

## Comparison target

- Source visual truth: [LearningOS App v2 — System & Screens](https://www.figma.com/design/TRqyMF0WxGHOUPZ3PBsmST/LearningOS-App-v2-%E2%80%94-System--amp--Screens?node-id=77-315), especially Home `10:2`, Library `77:316`, Garden `81:669`, and Review `82:807`.
- Local source captures:
  - `/Users/aramaljanadi/Documents/Codex/2026-08-09/look-thouroughly-at-my-project-and/work/design-qa/figma-home.png`
  - `/Users/aramaljanadi/Documents/Codex/2026-08-09/look-thouroughly-at-my-project-and/work/design-qa/figma-library.png`
  - `/Users/aramaljanadi/Documents/Codex/2026-08-09/look-thouroughly-at-my-project-and/work/design-qa/figma-garden.png`
  - `/Users/aramaljanadi/Documents/Codex/2026-08-09/look-thouroughly-at-my-project-and/work/design-qa/figma-review.png`
- Final implementation captures:
  - `/Users/aramaljanadi/Documents/Codex/2026-08-09/look-thouroughly-at-my-project-and/work/audit-current/26-home-search-final.png`
  - `/Users/aramaljanadi/Documents/Codex/2026-08-09/look-thouroughly-at-my-project-and/work/audit-current/27-library-search-final.png`
  - `/Users/aramaljanadi/Documents/Codex/2026-08-09/look-thouroughly-at-my-project-and/work/audit-current/24-garden-final-installed.png`
  - `/Users/aramaljanadi/Documents/Codex/2026-08-09/look-thouroughly-at-my-project-and/work/audit-current/21-review-final-installed.png`

## Viewport and normalization

- Figma captures: 1440 × 960 pixels at 1×. The main application region is `x=240, y=0, width=1200, height=960`.
- Obsidian captures: 3024 × 1964 physical pixels from a 1512 × 982 CSS-pixel Retina window at 2×.
- Host-owned macOS chrome, Obsidian tabs, and the native Obsidian ribbon were excluded from the fidelity crop.
- The LearningOS main region was cropped at `x=646, y=146, width=2272, height=1818` physical pixels (1136 × 909 CSS pixels), then normalized to 1200 × 960 to compare equal-size content regions.
- Combined evidence, with Figma on the left and the implementation on the right:
  - `/Users/aramaljanadi/Documents/Codex/2026-08-09/look-thouroughly-at-my-project-and/work/design-qa/compare-home.png`
  - `/Users/aramaljanadi/Documents/Codex/2026-08-09/look-thouroughly-at-my-project-and/work/design-qa/compare-library.png`
  - `/Users/aramaljanadi/Documents/Codex/2026-08-09/look-thouroughly-at-my-project-and/work/design-qa/compare-garden.png`
  - `/Users/aramaljanadi/Documents/Codex/2026-08-09/look-thouroughly-at-my-project-and/work/design-qa/compare-review.png`

## State

- Source: Figma's light-theme example content.
- Implementation: the user's live LearningOS repository in Obsidian's active dark theme.
- Content counts and titles intentionally differ because the implementation shows current repository truth: 239 sources, one Garden seed, and one Core-owned review decision. No sample records were introduced to imitate the mock.
- The implementation follows Obsidian theme mode. Light and dark palettes define the same LearningOS token surface, and the dark palette preserves the Figma hierarchy, warm paper/ink relationship, and brick-red semantic accent.

## Full-view comparison evidence

- Home: the Figma search launcher and Capture action now occupy the header's right side; one dominant Continue card is followed by flat Today and Continue elsewhere rows.
- Library: Sources and Curated packs remain separate, one full-width search control precedes Browse / filter, all five facets are peers, and the collection renders as flat rows.
- Garden: the compact composer, four filters, quiet eligibility message, and flat seed rows match the incubation structure. Technical controls are collapsed under Garden tools.
- Review: the decision count, five peer filters, explanatory line, and flat decision rows match the decision-only structure.
- The 280-pixel LearningOS navigator is slightly wider than the Figma's 240-pixel standalone sidebar so the brand and search control remain intact inside Obsidian. This is an intentional host-fit constraint and no longer changes the main-region hierarchy.

## Focused region evidence

No additional region file was needed after normalization: the 2400 × 960 combined images retain legible header controls, facet labels, composer fields, filter tabs, badges, and decision-row copy. The 3024 × 1964 originals were also inspected at full density for typography, border, icon, focus-control, and truncation defects.

## Required fidelity surfaces

- Fonts and typography: Obsidian's UI font fallback is retained, with compact display/body weights, line heights, uppercase kickers, and truncation matching the Figma hierarchy. No broken wraps or cramped labels remain at the tested desktop viewport.
- Spacing and layout rhythm: 48-pixel content insets, an 1104-pixel header reach, 900-pixel decision columns, flat list dividers, compact composer surfaces, and the corrected navigator width restore the intended density and alignment.
- Colors and visual tokens: every component color resolves through `--los-*` tokens; light and dark define the same palette surface. Contrast, active navigation, CTA, badges, and quiet text remain distinct in dark mode.
- Image quality and asset fidelity: these screens contain no source imagery or custom decorative art. Icons use the existing Lucide/Obsidian icon system; no emoji, CSS drawings, placeholder images, or handcrafted SVG substitutes were introduced.
- Copy and content: Modules explicitly means the current semester; Library explicitly means everything possessed; Garden is incubation; Review is decisions only. UI copy no longer exposes provider selection, classification backlog, or developer-oriented routing language.
- Responsiveness and accessibility: controls are semantic buttons, inputs, selects, details, and tabs with labels, focus-visible treatment, selected/current states, and reduced-motion support. The narrow-layout rules and host-surface checks pass; no desktop overflow, overlap, or clipped persistent control remains.

## Comparison history

### Iteration 1 — blocked

- [P1] Modules rendered thematic catalogue groups instead of the current semester.
- [P2] Home mixed the Garden capture and reconstructed queue state into Today, while Continue elsewhere included out-of-semester modules.
- [P2] Garden marked Review active and exposed a large technical form/provider surface.
- [P2] Review mixed explanatory Garden content with the Core decision queue.
- [P2] Library's global collection was visually crowded and did not follow the flat, five-peer-facet browser.

Fixes: added current-semester projection and list rendering; limited Home to actual deadlines/Core decisions/current-semester work; rebuilt Garden and Review around their Figma structures; made Library the complete 239-source faceted collection; removed row-level provider configuration.

Post-fix evidence: `04-after-reload.png`, `09-home-after.png`, `10-library-after.png`, and `11-garden-after.png` in the audit-current folder.

### Iteration 2 — blocked

- [P2] The LearningOS navigator remained materially wider than the Figma proportion.
- [P2] Library promoted 234 missing Topic classifications as a large backlog warning.
- [P2] Review lacked a direct Obsidian command, preventing reliable parity inspection.

Fixes: set the host navigator to 280 pixels; removed the classification-backlog warning from the primary collection; added and tested `Open Review`.

Post-fix evidence: `20-review-sidebar-280.png`, `25-library-final-reloaded.png`, and `21-review-final-installed.png`.

### Iteration 3 — blocked

- [P2] Home still used a plain Search button instead of the Figma search launcher.
- [P2] Library displayed Full-text / OCR as a separate control that narrowed the primary search field.

Fixes: implemented the wide Home search launcher with shortcut hint and correct action order; integrated Full text / OCR into the Library search field; restored the Browse / filter heading.

Post-fix evidence: `26-home-search-final.png`, `27-library-search-final.png`, `compare-home.png`, and `compare-library.png`.

## Final findings

No actionable P0, P1, or P2 visual, usability, accessibility, or content mismatches remain in the compared screens.

## Follow-up polish

- [P3] Garden shows `Title optional` rather than the Figma sample's `Tags optional`. The current Core capability accepts exact seed text plus an optional title, but not a separate tag array; preserving the capability boundary is preferable to presenting a control that cannot be saved faithfully.
- [P3] The Figma Home sample includes a personalized name and date. The current projection does not expose a user-profile name, so the live UI keeps a correct time-of-day greeting rather than hardcoding identity.

## Verification

- Live navigation exercised for Home, Library, Garden, and Review after a full plugin disable/enable reload.
- Home search launcher and Library integrated search visually inspected in the installed bundle.
- The Obsidian developer console showed no LearningOS load/runtime errors during QA.
- `npm run check` passed: deterministic build, TypeScript checks, contract lock, 22 direct module tests, 231 UI checks, host-surface checks, and build identity verification.

final result: passed
