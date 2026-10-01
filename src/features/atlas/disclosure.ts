import type { AtlasHost } from './ports';

/** Native, keyboard-operable disclosure whose attention survives a redraw. */
export function conceptDisclosure(
  parent: HTMLElement,
  host: AtlasHost,
  key: string,
  label: string,
  cls = '',
): HTMLElement {
  const details = parent.createEl('details', {
    cls: `los-disclosure los-atlas-disclosure ${cls}`.trim(),
  });
  details.createEl('summary', { text: label });
  details.open = host.concepts.disclosures.get(key) === true;
  details.setAttribute('data-atlas-disclosure', key);
  // Native toggle fires for mouse, keyboard and programmatic opening alike.
  details.addEventListener('toggle', () => {
    if (details.isConnected !== false) host.concepts.disclosures.set(key, details.open);
  });
  return details.createDiv({ cls: 'los-disclosure-body' });
}
