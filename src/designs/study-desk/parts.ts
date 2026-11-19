/**
 * The pieces every Study Desk screen is built from (Figma frame 15, "The rules
 * every screen follows"): a breadcrumb head, Literata titles, whole-row targets,
 * one spine colour per module, and one filled action per view.
 */
import { button, icon, manifestFreshness } from '../../components';
import type { ProjectionRecord } from '../../contracts/manifest';
import type { ManifestStore } from '../../manifest-store';
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
import { asLabel, asString } from '../../projection/readers';
import type { ApplicationRouter } from '../../app/router';
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
const pageClasses = new WeakMap<HTMLElement, string>();

/** Start a page. Classes from another design's last draw stay inert: every rule is scoped. */
export function deskPage(root: HTMLElement, name: string, store: Pick<ManifestStore, 'stale' | 'error'>): HTMLElement {
  const previous = pageClasses.get(root);
  if (previous) root.removeClass(previous);
  root.onscroll = null;
  root.empty();
  manifestFreshness(root, store);
  root.addClass('los-root', 'sd-page', `sd-${name}`);
  pageClasses.set(root, `sd-${name}`);
  return root;
}

export interface Crumb {
  readonly label: string;
  readonly go?: () => unknown;
}

/** The toolbar line: where you are on the left, at most a couple of plain actions on the right. */
export function deskHead(
  parent: HTMLElement,
  crumbs: readonly Crumb[],
  view: DesignView & { readonly plugin: { readonly router: ApplicationRouter } },
): HTMLElement {
  const bar = parent.createDiv({ cls: 'sd-toolbar' });
  const location = bar.createDiv({ cls: 'sd-location' });
  const { leaf, plugin: { router } } = view;
  const history = location.createDiv({ cls: 'sd-history', attr: { role: 'group', 'aria-label': 'Navigation history' } });
  for (const [direction, label, glyph] of [['back', 'Back', 'chevron-left'], ['forward', 'Forward', 'chevron-right']] as const) {
    const control = history.createEl('button', { cls: 'sd-history-button', attr: { type: 'button', 'aria-label': label } });
    control.disabled = !router.paneHistoryAvailable(leaf, direction);
    icon(control.createSpan(), glyph);
    control.addEventListener('click', () => { void router.movePaneHistory(leaf, direction); });
  }
  const trail = location.createEl('nav', { cls: 'sd-crumbs', attr: { 'aria-label': 'Location' } });
  crumbs.forEach((crumb, index) => {
    if (index) icon(trail.createSpan({ cls: 'sd-crumb-sep' }), 'chevron-right');
    const last = index === crumbs.length - 1;
    if (crumb.go && !last) {
      trail.createEl('button', { cls: 'sd-crumb is-clickable', text: crumb.label, attr: { type: 'button' } })
        .addEventListener('click', () => crumb.go?.());
    } else {
      trail.createSpan({ cls: `sd-crumb${last ? ' is-current' : ''}`, text: crumb.label, ...(last ? { attr: { 'aria-current': 'page' } } : {}) });
    }
  });
  return bar.createDiv({ cls: 'sd-toolbar-actions' });
}

/** A native button that is the whole row, as on every list in this design. */
export function deskRow(
  parent: HTMLElement,
  cls: string,
  label: string,
  open: () => unknown,
): HTMLButtonElement {
  const row = parent.createEl('button', {
    cls: `sd-row is-clickable ${cls}`.trim(),
    attr: { type: 'button' },
  });
  labelControl(row, label);
  row.addEventListener('click', () => open());
  return row;
}

let controlLabelId = 0;

/** Obsidian uses aria-label as a hover tooltip. Reference the name instead. */
export function labelControl(control: HTMLElement, label: string): void {
  const id = `sd-control-label-${++controlLabelId}`;
  control.createSpan({ cls: 'los-sr-only', text: label, attr: { id } });
  control.setAttr('aria-labelledby', id);
}

export function chevron(parent: HTMLElement, name = 'chevron-right'): HTMLElement {
  return icon(parent.createSpan({ cls: 'sd-chevron' }), name);
}

/** A segmented bar that says how far along something is. Words beside it repeat the state. */
export function stageBars(parent: HTMLElement, total: number, done: number, current: number | null = null): HTMLElement {
  const bars = parent.createDiv({ cls: 'sd-bars', attr: { 'aria-hidden': 'true' } });
  for (let index = 0; index < total; index += 1) {
    const state = index === current ? 'is-current' : index < done ? 'is-done' : '';
    bars.createSpan({ cls: `sd-bar ${state}`.trim() });
  }
  return bars;
}

export function moduleRow(
  parent: HTMLElement,
  store: ManifestStore,
  module: ProjectionRecord,
  open: () => unknown,
  state = moduleState(store, module),
): HTMLButtonElement {
  const title = asLabel(module);
  const row = deskRow(parent, 'sd-module-row', `Open module: ${title}${state ? `. ${state}` : ''}`, open);
  row.setAttrs({ 'data-cover': coverOf(module), 'data-record-id': asString(module.id) ?? '' });
  row.createSpan({ cls: 'sd-spine' });
  const copy = row.createDiv({ cls: 'sd-row-copy' });
  copy.createEl('strong', { cls: 'sd-row-title', text: title });
  const facts = moduleFacts(store, module);
  if (facts) copy.createDiv({ cls: 'sd-row-facts', text: facts });
  const progress = store.progress(asString(module.id) ?? '');
  const progressCell = row.createSpan({ cls: 'sd-module-progress' });
  if (progress.stages_total) {
    const bars = Math.min(10, progress.stages_total);
    const filled = progress.stages_complete === progress.stages_total ? bars : Math.min(bars - 1, Math.round(bars * progress.stages_complete / progress.stages_total));
    stageBars(progressCell, bars, filled);
  }
  progressCell.createSpan({ cls: 'sd-row-facts', text: progress.stages_total ? `${progress.stages_complete} of ${progress.stages_total} stages` : 'No study plan yet' });
  const next = row.createSpan({ cls: 'sd-row-next sd-module-next' });
  next.createSpan({ text: state });
  chevron(row);
  return row;
}

/** A plain text link that reads as part of a sentence. */
export function textLink(parent: HTMLElement, label: string, go: () => unknown): HTMLButtonElement {
  const link = button(parent, label, go, 'tertiary');
  link.addClass('sd-link');
  return link;
}

export function sideGroup(parent: HTMLElement, title: string): HTMLElement {
  const group = parent.createDiv({ cls: 'sd-side-group' });
  group.createDiv({ cls: 'sd-eyebrow', text: title });
  return group;
}
