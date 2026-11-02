/**
 * Which interface design is on screen.
 *
 * A design is a complete way of presenting the same system: the same manifest,
 * routes, gateway writes and drafts, drawn differently. Switching one never
 * touches a learner record, so it is a setting like the colour scheme and can be
 * flipped at will.
 *
 * This file holds only what the switch itself needs. The screens a design
 * supplies are in `src/designs/registry.ts`, and docs/interface-designs.md says
 * how to add one.
 *
 * Like the palette, the choice is an attribute on `document.body`, and for the
 * same reason: `los-root` is applied in ten places including modals mounted
 * outside the view tree. 'classic' is the absence of the attribute, so Classic's
 * cascade is byte-for-byte what it was before designs existed.
 */
import { applyPaletteEverywhere, normalizePalette, PALETTES, type PaletteId } from './palette';

export interface InterfaceDesignInfo {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  /** The colour schemes this design is drawn for, in the order they are offered. */
  readonly palettes: readonly PaletteId[];
  readonly defaultPalette: PaletteId;
}

/** Add a design by adding a row here and one in `src/designs/registry.ts`. */
export const INTERFACE_DESIGNS: readonly InterfaceDesignInfo[] = [
  {
    id: 'classic',
    label: 'Classic',
    description: 'The interface LearningOS shipped with. Every colour scheme stays available.',
    palettes: PALETTES.map(([id]) => id).filter((id) => id !== 'lamplight'),
    defaultPalette: 'wine',
  },
  {
    id: 'study-desk',
    label: 'Study Desk',
    description: 'Warm paper, an open-book session, and an Atlas you walk through as a map.',
    palettes: ['wine', 'lamplight'],
    defaultPalette: 'wine',
  },
];

export const DEFAULT_INTERFACE_DESIGN = 'classic';

/** The settings the switch reads and writes. */
export interface InterfaceDesignSettings {
  uiDesign: string;
  palette: string;
  uiDesignPalettes: Record<string, string>;
}

/** A stale or hand-edited id degrades to Classic, never to an unstyled app. */
export function normalizeInterfaceDesign(value: unknown): string {
  return typeof value === 'string' && INTERFACE_DESIGNS.some((design) => design.id === value)
    ? value
    : DEFAULT_INTERFACE_DESIGN;
}

export function interfaceDesign(value: unknown): InterfaceDesignInfo {
  const id = normalizeInterfaceDesign(value);
  return INTERFACE_DESIGNS.find((design) => design.id === id) ?? INTERFACE_DESIGNS[0]!;
}

/**
 * The colour scheme a design shows.
 *
 * Each design remembers its own, so switching away and back restores what was
 * there. Classic keeps using the original `palette` setting, which means a vault
 * that never touches this feature reads and writes exactly what it always did. A
 * remembered scheme the design was not drawn for falls back to its default.
 */
export function designPalette(settings: InterfaceDesignSettings): PaletteId {
  const design = interfaceDesign(settings.uiDesign);
  if (design.id === DEFAULT_INTERFACE_DESIGN) return normalizePalette(settings.palette);
  const remembered = normalizePalette(settings.uiDesignPalettes?.[design.id] ?? design.defaultPalette);
  return design.palettes.includes(remembered) ? remembered : design.defaultPalette;
}

/** Store a scheme for the design on screen; returns what will actually show. */
export function rememberDesignPalette(settings: InterfaceDesignSettings, value: unknown): PaletteId {
  const design = interfaceDesign(settings.uiDesign);
  const palette = normalizePalette(value);
  if (design.id === DEFAULT_INTERFACE_DESIGN) settings.palette = palette;
  else settings.uiDesignPalettes = { ...settings.uiDesignPalettes, [design.id]: palette };
  return designPalette(settings);
}

/** Apply the design and its scheme to every document that can host a `.los-root`. */
export function applyInterfaceDesign(
  bodies: Iterable<HTMLElement | null | undefined>,
  settings: InterfaceDesignSettings,
): string {
  const id = normalizeInterfaceDesign(settings.uiDesign);
  const targets = [...new Set(bodies)];
  for (const body of targets) {
    if (!body) continue;
    if (id === DEFAULT_INTERFACE_DESIGN) body.removeAttribute('data-los-ui');
    else body.setAttribute('data-los-ui', id);
  }
  applyPaletteEverywhere(targets, designPalette(settings));
  return id;
}

export function clearInterfaceDesign(body: HTMLElement): void {
  body.removeAttribute('data-los-ui');
}
