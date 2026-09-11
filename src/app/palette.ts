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
  ['ink', 'Ink — dark canvas'],
] as const;

export type PaletteId = typeof PALETTES[number][0];

const KNOWN = new Set<string>(PALETTES.map(([id]) => id));

/** 'wine' is the base palette in `00-tokens.css`, so it is the absence of the
 *  attribute rather than a value of it. An unrecognised id resolves to it too:
 *  a stale or hand-edited setting degrades to the default palette, never to an
 *  unstyled app. */
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

/** Leave no trace in the host DOM when the plugin unloads. */
export function clearPalette(body: HTMLElement): void {
  body.removeAttribute('data-los-palette');
}
