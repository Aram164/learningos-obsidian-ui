import { button, icon, manifestFreshness } from '../../components';
import type { ManifestStore } from '../../manifest-store';
import type { ProjectionRecord } from '../../contracts/manifest';
import { semesterLabel } from '../../features/module/logistics';
import { asLabel, asRecords, asString } from '../../projection/readers';

export function page(root: HTMLElement, name: string, store: ManifestStore): HTMLElement {
  root.empty();
  root.addClass('los-root', 'focus-root');
  root.setAttr('data-focus-screen', name);
  manifestFreshness(root, store);
  return root;
}
export function toolbar(root: HTMLElement, title: string, detail = '', go?: () => unknown): HTMLElement {
  const bar = root.createDiv({ cls: 'focus-toolbar' });
  const copy = bar.createDiv({ cls: 'focus-location' });
  if (go) button(copy, title, go, 'quiet');
  else copy.createEl('strong', { text: title });
  if (detail) copy.createDiv({ cls: 'focus-muted', text: detail });
  return bar.createDiv({ cls: 'focus-toolbar-actions' });
}
export function heading(parent: HTMLElement, eyebrow: string, title: string, detail = ''): void {
  if (eyebrow) parent.createDiv({ cls: 'focus-eyebrow', text: eyebrow });
  parent.createEl('h1', { cls: 'focus-title', text: title });
  if (detail) parent.createEl('p', { cls: 'focus-lede', text: detail });
}
export function row(parent: HTMLElement, label: string, action: () => unknown): HTMLButtonElement {
  const target = parent.createEl('button', { cls: 'focus-row is-clickable', attr: { type: 'button', 'aria-label': label } });
  target.addEventListener('click', () => action());
  return target;
}
export function chevron(parent: HTMLElement): void {
  icon(parent.createSpan({ cls: 'focus-chevron', attr: { 'aria-hidden': 'true' } }), 'chevron-right');
}
export function progress(parent: HTMLElement, complete: number, total: number): void {
  const wrap = parent.createDiv({ cls: 'focus-progress' });
  const bar = wrap.createEl('progress', { attr: { max: String(Math.max(total, 1)), value: String(complete), 'aria-label': 'Recorded study stages' } });
  bar.value = complete;
  bar.max = Math.max(total, 1);
  wrap.createSpan({ cls: 'focus-muted', text: `${complete} of ${total} stages complete` });
}
export function moduleRow(parent: HTMLElement, store: ManifestStore, module: ProjectionRecord, open: () => unknown): void {
  const target = row(parent, `Open module: ${asLabel(module)}`, open);
  icon(target.createSpan({ cls: 'focus-record-icon', attr: { 'aria-hidden': 'true' } }), 'library');
  const copy = target.createDiv({ cls: 'focus-row-copy' });
  copy.createEl('strong', { text: asLabel(module) });
  const units = store.unitsFor(asString(module.id) ?? '');
  const stages = units.flatMap(unit => asRecords(store.mapForUnit(asString(unit.id) ?? '')?.stages));
  const done = stages.filter(stage => stage.status === 'complete').length;
  copy.createSpan({ cls: 'focus-muted', text: [semesterLabel(asString(module.semester) ?? ''), `${units.length} unit${units.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ') });
  target.createSpan({ cls: 'focus-row-state', text: done ? `${done} of ${stages.length} stages complete` : asString(module.status)?.replaceAll('-', ' ') ?? 'Open module' });
  chevron(target);
}
