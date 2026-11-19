/**
 * Shared Focus 2.0 chrome primitives: sticky command bar with per-leaf
 * back/forward + breadcrumbs, segmented stage progress bars, and whole-button cards.
 */
import { button, icon, manifestFreshness } from '../../components';
import type { ApplicationRouter } from '../../app/router';
import type { ProjectionRecord } from '../../contracts/manifest';
import {
  coverOf,
  moduleFacts,
  moduleLongTitle,
  moduleName,
  moduleShort,
  moduleState,
  unitLabel,
  type Cover,
  type UnitLabel,
} from '../../features/module/labels';
import { stageProgress } from '../../features/unit/model';
import type { ManifestStore } from '../../manifest-store';
import { asLabel, asRecords, asString } from '../../projection/readers';
import type { DesignView } from '../screens';

export {
  coverOf,
  moduleFacts,
  moduleLongTitle,
  moduleName,
  moduleShort,
  moduleState,
  unitLabel,
  type Cover,
  type UnitLabel,
};

export interface Crumb {
  readonly label: string;
  readonly go?: () => unknown;
}

export function page(root: HTMLElement, name: string, store: Pick<ManifestStore, 'stale' | 'error'>): HTMLElement {
  root.onscroll = null;
  root.empty();
  root.addClass('los-root', 'focus-root');
  root.setAttr('data-focus-screen', name);
  manifestFreshness(root, store);
  return root;
}

/** 44 px macOS command bar: per-leaf Back/Forward, clickable breadcrumbs, and right toolbar slot. */
export function commandBar(
  root: HTMLElement,
  crumbs: readonly Crumb[],
  view: DesignView & { readonly plugin: { readonly router: ApplicationRouter } },
): HTMLElement {
  const bar = root.createDiv({ cls: 'focus-commandbar' });
  const location = bar.createDiv({ cls: 'focus-location' });
  const { leaf, plugin: { router } } = view;
  const history = location.createDiv({ cls: 'focus-history', attr: { role: 'group', 'aria-label': 'Navigation history' } });
  for (const [direction, label, glyph] of [['back', 'Back', 'chevron-left'], ['forward', 'Forward', 'chevron-right']] as const) {
    const control = history.createEl('button', { cls: 'focus-history-btn', attr: { type: 'button', 'aria-label': label } });
    control.disabled = !router.paneHistoryAvailable(leaf, direction);
    icon(control.createSpan({ attr: { 'aria-hidden': 'true' } }), glyph);
    control.addEventListener('click', () => { void router.movePaneHistory(leaf, direction); });
  }
  const trail = location.createEl('nav', { cls: 'focus-crumbs', attr: { 'aria-label': 'Location' } });
  crumbs.forEach((crumb, index) => {
    if (index) icon(trail.createSpan({ cls: 'focus-crumb-sep', attr: { 'aria-hidden': 'true' } }), 'chevron-right');
    const last = index === crumbs.length - 1;
    if (crumb.go && !last) {
      trail.createEl('button', { cls: 'focus-crumb is-clickable', text: crumb.label, attr: { type: 'button' } })
        .addEventListener('click', () => crumb.go?.());
    } else {
      trail.createSpan({ cls: `focus-crumb${last ? ' is-current' : ''}`, text: crumb.label, ...(last ? { attr: { 'aria-current': 'page' } } : {}) });
    }
  });
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

export function chevron(parent: HTMLElement, glyph = 'chevron-right'): void {
  icon(parent.createSpan({ cls: 'focus-chevron', attr: { 'aria-hidden': 'true' } }), glyph);
}

/** Segmented macOS stage progress bars; accessible state is always named in text nearby. */
export function stageBars(parent: HTMLElement, total: number, done: number, current: number | null = null): HTMLElement {
  const capped = Math.min(10, total);
  const filled = capped && total ? (done === total ? capped : Math.min(capped - 1, Math.round(capped * done / total))) : 0;
  const active = current !== null && capped && total ? Math.min(capped - 1, Math.round(capped * current / total)) : null;
  const bars = parent.createDiv({ cls: 'focus-bars', attr: { 'aria-hidden': 'true' } });
  for (let index = 0; index < capped; index += 1) {
    const state = index === active ? 'is-current' : index < filled ? 'is-done' : '';
    bars.createSpan({ cls: `focus-bar ${state}`.trim() });
  }
  return bars;
}

export function progress(parent: HTMLElement, complete: number, total: number): void {
  const wrap = parent.createDiv({ cls: 'focus-progress' });
  const bar = wrap.createEl('progress', { attr: { max: String(Math.max(total, 1)), value: String(complete), 'aria-label': 'Recorded study stages' } });
  bar.value = complete;
  bar.max = Math.max(total, 1);
  wrap.createSpan({ cls: 'focus-muted', text: `${complete} of ${total} stages complete` });
}

export function moduleRow(parent: HTMLElement, store: ManifestStore, module: ProjectionRecord, open: () => unknown): HTMLButtonElement {
  const target = row(parent, `Open module: ${asLabel(module)}`, open);
  const id = asString(module.id) ?? '';
  target.addClass('focus-module-row');
  target.setAttrs({ 'data-record-id': id, 'data-cover': coverOf(module) });
  target.createSpan({ cls: 'focus-spine', attr: { 'aria-hidden': 'true' } });
  const copy = target.createDiv({ cls: 'focus-row-copy' });
  copy.createEl('strong', { text: asLabel(module) });
  const units = store.unitsFor(id);
  const stages = units.flatMap((unit) => asRecords(store.mapForUnit(asString(unit.id) ?? '')?.stages));
  const { done, total } = stageProgress(stages);
  copy.createSpan({ cls: 'focus-muted', text: moduleFacts(store, module) });
  if (total) stageBars(target, total, done);
  const isDone = Boolean(total && done === total);
  const stateText = isDone ? 'Done' : done ? `${done} of ${total} stages complete` : moduleState(store, module) || 'Open module';
  target.createSpan({ cls: `focus-row-state${isDone ? ' is-complete' : ''}`, text: stateText });
  chevron(target);
  return target;
}

export function textLink(parent: HTMLElement, label: string, go: () => unknown): HTMLButtonElement {
  const link = button(parent, label, go, 'tertiary');
  link.addClass('focus-link');
  return link;
}

export function sideCard(parent: HTMLElement, title: string, pill?: { readonly text: string; readonly tone?: 'accent' | 'success' | 'warning' | 'info' }): HTMLElement {
  const card = parent.createDiv({ cls: 'focus-dock-card' });
  const head = card.createDiv({ cls: 'focus-section-head' });
  head.createDiv({ cls: 'focus-eyebrow', text: title });
  if (pill) head.createSpan({ cls: `focus-pill${pill.tone ? ` is-${pill.tone}` : ''}`, text: pill.text });
  return card;
}
