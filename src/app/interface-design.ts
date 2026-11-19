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
 * outside the view tree. Study Desk (`study-desk`) and Focus (`focus`) both
 * set `data-los-ui` on `document.body`. An internal test-only sentinel
 * (`BASE_VIEWS_DESIGN_ID`) removes the attribute and lets base feature-view
 * regression suites exercise `src/views/*` + `src/features/*` directly.
 */
import { applyPaletteEverywhere, normalizePalette, type PaletteId } from './palette';

export const BASE_VIEWS_DESIGN_ID = '__base_views__';

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
    id: 'study-desk',
    label: 'Study Desk',
    description: 'Warm paper, an open-book session, and an Atlas you walk through as a map.',
    palettes: ['wine', 'lamplight'],
    defaultPalette: 'wine',
  },
  {
    id: 'focus',
    label: 'Focus',
    description: 'A native Mac study workspace: a clear plan, one focused stage, and a useful stopping point.',
    palettes: ['daylight', 'nightfall'],
    defaultPalette: 'daylight',
  },
];

export const DEFAULT_INTERFACE_DESIGN = 'study-desk';

/** The settings the switch reads and writes. */
export interface InterfaceDesignSettings {
  uiDesign: string;
  palette: string;
  uiDesignPalettes: Record<string, string>;
}

/** A stale, retired or hand-edited id degrades to Study Desk, never to an unstyled app. */
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
 * Each design remembers its own scheme under `uiDesignPalettes[design.id]`, so
 * switching away and back restores what was there. If a design has not saved a
 * scheme yet, it adopts `settings.palette` when compatible, otherwise its own
 * defaultPalette.
 */
export function designPalette(settings: InterfaceDesignSettings): PaletteId {
  if (settings.uiDesign === BASE_VIEWS_DESIGN_ID) return normalizePalette(settings.palette);
  const design = interfaceDesign(settings.uiDesign);
  const raw = settings.uiDesignPalettes?.[design.id];
  if (raw !== undefined) {
    const remembered = normalizePalette(raw);
    return design.palettes.includes(remembered) ? remembered : design.defaultPalette;
  }
  const fallback = normalizePalette(settings.palette);
  return design.palettes.includes(fallback) ? fallback : design.defaultPalette;
}

/** Store a scheme for the design on screen; returns what will actually show. */
export function rememberDesignPalette(settings: InterfaceDesignSettings, value: unknown): PaletteId {
  const palette = normalizePalette(value);
  if (settings.uiDesign === BASE_VIEWS_DESIGN_ID) {
    settings.palette = palette;
    return designPalette(settings);
  }
  const design = interfaceDesign(settings.uiDesign);
  const applied = design.palettes.includes(palette) ? palette : design.defaultPalette;
  settings.uiDesignPalettes = { ...settings.uiDesignPalettes, [design.id]: applied };
  return designPalette(settings);
}

/** Apply the design and its scheme to every document that can host a `.los-root`. */
export function applyInterfaceDesign(
  bodies: Iterable<HTMLElement | null | undefined>,
  settings: InterfaceDesignSettings,
): string {
  const isBaseViews = settings.uiDesign === BASE_VIEWS_DESIGN_ID;
  const id = isBaseViews ? BASE_VIEWS_DESIGN_ID : normalizeInterfaceDesign(settings.uiDesign);
  const targets = [...new Set(bodies)];
  for (const body of targets) {
    if (!body) continue;
    if (isBaseViews) body.removeAttribute('data-los-ui');
    else body.setAttribute('data-los-ui', id);
  }
  applyPaletteEverywhere(targets, designPalette(settings));
  return id;
}

export function clearInterfaceDesign(body: HTMLElement): void {
  body.removeAttribute('data-los-ui');
}
