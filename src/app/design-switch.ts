import { enableButtonGroupKeyboardNavigation } from '../accessibility/button-group';
import { designPalette, INTERFACE_DESIGNS, interfaceDesign, type InterfaceDesignSettings } from './interface-design';
import { PALETTES } from './palette';

interface SwitchHost {
  readonly settings: InterfaceDesignSettings;
  setInterfaceDesign(id: string): Promise<void>;
  setDesignPalette(palette: string): Promise<void>;
}

const SHORT_PALETTE: Readonly<Record<string, string>> = { wine: 'Paper', lamplight: 'Lamplight', daylight: 'Light', nightfall: 'Dark' };

function group(
  parent: HTMLElement,
  label: string,
  options: ReadonlyArray<readonly [string, string]>,
  active: string,
  choose: (id: string) => unknown,
): void {
  const wrap = parent.createDiv({ cls: 'los-design-switch' });
  wrap.createDiv({ cls: 'los-design-switch-label', text: label });
  const buttons = wrap.createDiv({ cls: 'los-design-switch-options', attr: { role: 'group', 'aria-label': label } });
  enableButtonGroupKeyboardNavigation(buttons);
  for (const [id, text] of options) {
    const control = buttons.createEl('button', {
      cls: `los-design-switch-option is-clickable${id === active ? ' is-active' : ''}`,
      text,
      attr: { type: 'button', 'aria-pressed': String(id === active), 'data-los-design': id },
    });
    control.addEventListener('click', () => { if (id !== active) void choose(id); });
  }
}

/**
 * The toggle, drawn by every design's sidebar so no design can strand you in it.
 * A design that offers more than one scheme gets its scheme here too; Classic's
 * long list stays in Settings, where it always was.
 */
export function renderDesignSwitch(parent: HTMLElement, host: SwitchHost): void {
  const design = interfaceDesign(host.settings.uiDesign);
  group(parent, 'Interface', INTERFACE_DESIGNS.map((row) => [row.id, row.label] as const), design.id,
    (id) => host.setInterfaceDesign(id));
  if (design.id === 'classic' || design.palettes.length < 2) return;
  const labels = new Map<string, string>(PALETTES);
  group(parent, 'Appearance', design.palettes.map((id) => [id, SHORT_PALETTE[id] ?? labels.get(id) ?? id] as const),
    designPalette(host.settings), (id) => host.setDesignPalette(id));
}
