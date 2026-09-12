/**
 * Colour-scheme application.
 *
 * A scheme is a palette swap and nothing more: `25-palettes.css` redefines the
 * root `--los-*` tokens under `body[data-los-palette="…"]`, so every screen,
 * modal and chip follows without a component knowing a scheme exists. That is
 * DESIGN.md principle 2 paying for itself — the reason no component may name a
 * colour is precisely so this can be one attribute.
 *
 * The attribute goes on `document.body` rather than on each `.los-root`,
 * because `los-root` is applied in ten places including modals mounted outside
 * the view tree. One element that is always an ancestor of all of them is the
 * only place a scheme can be set once and be true everywhere.
 */

/** The schemes a learner may choose, in the order the settings tab lists them. */
export const PALETTES = [
  ['wine', 'Wine — warm paper, berry brand (default)'],
  ['graphite', 'Graphite — warm paper, no brand hue'],
  ['indigo', 'Indigo — cool paper, blue-violet brand'],
  ['ink', 'Ink — dark, warm berry brand'],
  ['midnight', 'Midnight — dark navy, violet brand'],
  ['slate', 'Slate — dark blue-grey, cyan brand'],
  ['carbon', 'Carbon — dark near-black, no brand hue'],
  ['custom', 'Custom — your own, via a CSS snippet (not contrast-checked)'],
] as const;

export type PaletteId = typeof PALETTES[number][0];

const KNOWN = new Set<string>(PALETTES.map(([id]) => id));

/** 'wine' is the base palette in `00-tokens.css`, so it is the absence of the
 *  attribute rather than a value of it. An unrecognised id resolves to it too:
 *  a stale or hand-edited setting degrades to the default palette, never to an
 *  unstyled app.
 *
 *  'custom' is the opposite case: it is a real value that the plugin ships no
 *  rules for. Selecting it sets the attribute and nothing else, so the base
 *  palette still renders and a reader's own snippet is the only thing defining
 *  `body[data-los-palette="custom"] .los-root`. That is deliberate — with no
 *  plugin rule at that specificity there is no cascade tie to lose, and the
 *  tokens stay overridable without `!important`. It is also outside the
 *  contrast gate, which is why the label says so. */
export function normalizePalette(value: unknown): PaletteId {
  return typeof value === 'string' && KNOWN.has(value)
    ? value as PaletteId
    : 'wine';
}

export function applyPalette(body: HTMLElement, value: unknown): PaletteId {
  const palette = normalizePalette(value);
  if (palette === 'wine') body.removeAttribute('data-los-palette');
  else body.setAttribute('data-los-palette', palette);
  return palette;
}

/**
 * Apply to every document that can host a `.los-root`, skipping what is not
 * there.
 *
 * One `document` is not enough. Obsidian 1.13.7 opens Settings in a window of
 * its own and supports popped-out leaves, so the body the dropdown can reach
 * and the body the app is rendered into are not always the same element — and
 * a scheme written to the wrong one persists correctly while appearing to do
 * nothing at all. Callers pass every body they can name; duplicates are
 * harmless because the write is idempotent.
 */
export function applyPaletteEverywhere(
  bodies: Iterable<HTMLElement | null | undefined>,
  value: unknown,
): PaletteId {
  const palette = normalizePalette(value);
  const seen = new Set<HTMLElement>();
  for (const body of bodies) {
    if (!body || seen.has(body)) continue;
    seen.add(body);
    applyPalette(body, palette);
  }
  return palette;
}

/** Leave no trace in the host DOM when the plugin unloads. */
export function clearPalette(body: HTMLElement): void {
  body.removeAttribute('data-los-palette');
}
