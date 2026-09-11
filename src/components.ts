import { setIcon } from 'obsidian';
import { webUtils } from 'electron';
import { ICONS } from './constants';
import type { ProjectionRecord } from './contracts/manifest';
import type { ManifestStore } from './manifest-store';
import { asLabel, asRecords, asString } from './projection/readers';
import { enableButtonGroupKeyboardNavigation } from './accessibility/button-group';
export { safeWebUrl } from './security/safe-url';

/**
 * The card components read the projection and navigate. That is the whole
 * surface they need — they must not reach further into the plugin.
 */
type CardHost = {
  readonly store: Pick<ManifestStore, 'get' | 'mapForUnit'>;
  readonly nav: {
    openModule(moduleId: string): unknown;
    openUnit(unitId: string): unknown;
  };
};

/*
 * The DOM node type every component takes and returns.
 *
 * This is deliberately the real `HTMLElement` rather than a bespoke shape:
 * `src/types/runtime.d.ts` already augments the global interface with
 * Obsidian's sugar (`createEl`, `createDiv`, `setAttrs`, …), so an alias buys
 * fidelity to the host for free. Anything the host does not provide — the
 * harness's `attrs` bag, `fire()` — is now a compile error at the call site.
 */
type UiNode = HTMLElement;
type ClickHandler =
  ((event: MouseEvent) => unknown) | null | undefined;
export type ButtonVariant =
  | ''
  | 'cta'
  | 'success'
  | 'info'
  | 'warm'
  | 'choice'
  | 'quiet'
  | 'tertiary'
  | 'row'
  | 'menu';
type OverflowItem =
  [string, () => unknown] | null | undefined | false;

export function icon(el: UiNode, name: string): UiNode {
  el.setAttrs({
    'aria-hidden': 'true',
    focusable: 'false',
  });
  setIcon(el, name || 'circle');
  return el;
}

export function button(
  parent: UiNode,
  label: string,
  onClick: ClickHandler,
  variant: ButtonVariant = '',
): HTMLButtonElement {
  const el = parent.createEl('button', {
    cls: `los-btn is-clickable ${variant ? `los-btn--${variant}` : ''}`,
    text: label,
    attr: { type: 'button' },
  });
  el.addEventListener('click', (event: MouseEvent) => {
    event.preventDefault();
    onClick?.(event);
  });
  return el;
}

export function badge(
  parent: UiNode,
  text: string,
  variant = '',
): UiNode {
  return parent.createSpan({ cls: `los-badge ${variant ? `los-badge--${variant}` : ''}`, text });
}

/**
 * The tone a status word carries, or none.
 *
 * The word is the signal; the tone only reinforces it, so a reader who cannot
 * separate these hues loses nothing (DESIGN.md principle 2). States that are
 * *inert* — planned, dropped, archived — deliberately get no tone: colouring
 * them would read as a verdict on a decision that was simply made, and
 * "dropped" is not a failure state the interface gets to editorialise.
 */
const STATUS_TONES: Readonly<Record<string, string>> = {
  active: 'active',
  enrolled: 'active',
  'in-progress': 'active',
  complete: 'complete',
  completed: 'complete',
  passed: 'complete',
  paused: 'paused',
  'on-hold': 'paused',
  'awaiting-grade': 'attention',
  blocked: 'attention',
};

/** Class for a status word, or '' when the status is unknown or inert. */
export function statusTone(status: unknown): string {
  const key = String(status ?? '').trim().toLowerCase();
  const tone = STATUS_TONES[key];
  return tone ? `los-status los-status--${tone}` : 'los-status';
}

export function chip(
  parent: UiNode,
  record: ProjectionRecord,
  onClick?: ((record: ProjectionRecord) => unknown) | null,
): UiNode {
  const el = parent.createEl('button', {
    cls: `los-chip los-t-${record?.type || 'record'} is-clickable`,
    attr: { type: 'button' },
  });
  const iconName =
    (ICONS as Record<string, string>)[String(record?.type || '')]
    || 'circle';
  icon(el.createSpan({ cls: 'los-chip-icon' }), iconName);
  el.createSpan({ text: record?.title || record?.id || 'Unknown' });
  if (onClick) el.addEventListener('click', () => onClick(record));
  return el;
}

export function pageHeader(
  parent: UiNode,
  kicker: string,
  title: string,
  description = '',
  headingId = '',
): UiNode {
  const header = parent.createDiv({ cls: 'los-page-header' });
  if (kicker) header.createDiv({ cls: 'los-kicker', text: kicker });
  const heading = header.createEl('h1', { text: title });
  if (headingId) heading.setAttribute('id', headingId);
  if (description) header.createEl('p', { text: description });
  return header;
}

export function section(
  parent: UiNode,
  title: string,
  description = '',
): UiNode {
  const wrap = parent.createDiv({ cls: 'los-section' });
  wrap.createEl('h2', { text: title });
  if (description) wrap.createEl('p', { cls: 'los-muted', text: description });
  return wrap;
}

/** Shared label/value facts used by learning, logistics, and diagnostics. */
export function factList(
  parent: UiNode,
  facts: ReadonlyArray<readonly [string, unknown]>,
): UiNode {
  const list = parent.createDiv({ cls: 'los-fact-list' });
  for (const [label, value] of facts) {
    if (value === null || value === undefined || value === '') continue;
    const row = list.createDiv({ cls: 'los-fact-row' });
    row.createDiv({ cls: 'los-fact-label', text: label });
    row.createDiv({ cls: 'los-fact-value', text: String(value) });
  }
  return list;
}

/**
 * One row of mutually exclusive tabs.
 *
 * Garden and Review once carried separate copies of this loop, and one copy
 * drifted — it styled itself differently and skipped `is-active`, so the
 * same control looked like two different things depending on which surface you
 * were standing on. The definition lives here now; a caller supplies the values
 * and, optionally, a count per tab.
 *
 * `aria-pressed` and `is-active` are both set: the first is what a screen
 * reader announces, the second is what the stylesheet selects on. Neither is
 * redundant, because CSS cannot key off the accessible state alone here.
 */
export function filterTabs<T extends string>(
  parent: UiNode,
  ariaLabel: string,
  tabs: ReadonlyArray<readonly [T, string]>,
  active: T,
  choose: (value: T) => unknown,
  countOf: ((value: T) => number) | null = null,
): UiNode {
  const row = parent.createDiv({ cls: 'los-filter-tabs' });
  row.setAttrs({ role: 'group', 'aria-label': ariaLabel });
  enableButtonGroupKeyboardNavigation(row);
  for (const [value, label] of tabs) {
    const count = countOf ? countOf(value) : 0;
    const control = button(
      row,
      count ? `${label} ${count}` : label,
      () => choose(value),
      'quiet',
    );
    control.addClass('los-filter-tab');
    control.toggleClass('is-active', value === active);
    control.setAttrs({ 'aria-pressed': String(value === active) });
  }
  return row;
}

/**
 * Progressive disclosure primitive. Native `<details>` so it is keyboard
 * reachable and readable with no script, which is also why the overflow menu
 * below is built on it rather than on Obsidian's `Menu`.
 */
export function disclosure(
  parent: UiNode,
  summaryText: string,
  cls = '',
): UiNode {
  const details = parent.createEl('details', { cls: `los-disclosure ${cls}`.trim() });
  details.createEl('summary', { text: summaryText });
  return details.createDiv({ cls: 'los-disclosure-body' });
}

/**
 * The `•••` overflow. Secondary operations stay reachable in one place instead
 * of competing with the two actions the learner actually came for.
 */
export function overflowMenu(
  parent: UiNode,
  items: readonly OverflowItem[],
  label = 'More actions',
): UiNode | null {
  const rows = items.filter(Boolean) as Array<
    [string, () => unknown]
  >;
  if (!rows.length) return null;
  const details = parent.createEl('details', { cls: 'los-overflow' });
  const summary = details.createEl('summary', { cls: 'los-overflow-trigger', text: '•••' });
  summary.setAttrs({ 'aria-label': label, role: 'button' });
  const body = details.createDiv({ cls: 'los-overflow-body' });
  for (const [itemLabel, action] of rows) {
    button(body, itemLabel, () => { details.removeAttribute?.('open'); action(); }, 'menu');
  }
  return details;
}

/**
 * A projected URL is core data, but core data is not a licence to hand an
 * arbitrary scheme to Electron. Anything outside the allowlist is refused
 * before it can reach a viewer.
 */
export function empty(
  parent: UiNode,
  title: string,
  detail: string,
  actionLabel = '',
  action: ClickHandler = null,
): UiNode {
  const el = parent.createDiv({ cls: 'los-empty' });
  el.createEl('h3', { text: title });
  el.createEl('p', { text: detail });
  if (actionLabel) button(el, actionLabel, action, 'quiet');
  return el;
}

export function localFilePath(file: unknown): string {
  if (!file) return '';
  try { return webUtils.getPathForFile(file) || ''; }
  catch (_) { return ''; }
}

export function projectedExcerpt(
  value: unknown,
  limit = 900,
): string {
  const [paragraph = ''] = String(value || '').split(/\n\s*\n/);
  const first = paragraph
    .replace(/\*{1,2}/g, '').replace(/`/g, '')
    .replace(/(^|\n)\s*-\s*/g, '$1').replace(/\s+/g, ' ').trim();
  if (first.length <= limit) return first;
  // Slice by code point: a plain .slice() could cut an emoji in half and leak a
  // lone surrogate into the DOM.
  return `${Array.from(first).slice(0, limit - 1).join('')}…`;
}

export function workspaceCard(
  parent: UiNode,
  plugin: CardHost,
  workspace: ProjectionRecord,
  moduleContext: string | null = null,
): UiNode {
  const workspaceTitle = asLabel(workspace);
  const workspaceStatus = asString(workspace.status) || 'active';
  const card = parent.createDiv({ cls: `los-card los-workspace-card los-s-${workspaceStatus}` });
  const top = card.createDiv({ cls: 'los-card-top' });
  top.createEl('h3', { text: workspaceTitle });
  badge(top, workspace.standing ? `${workspaceStatus} · standing` : workspaceStatus, workspaceStatus);
  if (workspace.objective) card.createEl('p', { cls: 'los-workspace-objective', text: workspace.objective });
  const next = card.createDiv({ cls: 'los-next-action' });
  next.createDiv({ cls: 'los-kicker', text: 'Next action' });
  next.createEl('p', { text: projectedExcerpt(workspace.next_action, 1600) || 'No next action recorded.' });
  if (workspace.deadline) badge(next, `Deadline ${workspace.deadline}`, 'needs-map');
  const actions = card.createDiv({ cls: 'los-actions' });
  const moduleIds: string[] = (workspace.module_ids || []).filter(
    (id: string) => id !== moduleContext,
  );
  for (const id of moduleIds.slice(0, 3)) {
    const module = plugin.store.get(id);
    if (module) button(actions, `Open ${module.title}`, () => plugin.nav.openModule(id), 'quiet');
  }
  for (const id of (workspace.unit_ids || []).slice(0, 3)) {
    const unit = plugin.store.get(id);
    if (unit) button(actions, `Open ${unit.title}`, () => plugin.nav.openUnit(id), 'quiet');
  }
  return card;
}

export function unitCard(
  parent: UiNode,
  plugin: CardHost,
  unit: ProjectionRecord,
): UiNode {
  const unitId = asString(unit.id);
  const unitTitle = asLabel(unit);
  const unitStatus = asString(unit.status) || 'ready';
  const card = parent.createEl('button', {
    cls: `los-card los-unit-card los-s-${unitStatus} is-clickable`,
    attr: { type: 'button', 'aria-label': `Open unit: ${unitTitle}` },
  });
  const top = card.createDiv({ cls: 'los-card-top' });
  top.createEl('h3', { text: unitTitle });
  badge(top, unitStatus, unitStatus);
  card.createEl('p', { text: asString(unit.scope) || 'No scope projected.' });
  const map = unitId ? plugin.store.mapForUnit(unitId) : null;
  if (map) {
    const stages = asRecords(map.stages);
    const done = stages.filter(
      (row: ProjectionRecord) => row.status === 'complete',
    ).length;
    card.createDiv({ cls: 'los-progress-copy', text: `${done} of ${stages.length} stages complete` });
  } else {
    card.createDiv({ cls: 'los-progress-copy', text: 'No study map yet' });
  }
  if (unitId) card.addEventListener('click', () => plugin.nav.openUnit(unitId));
  return card;
}

/**
 * The ownership statement is architecture policy, not study content. Repeating
 * it under every screen made the product read as internal tooling, so it is
 * stated once in Settings → About (DESIGN.md records the change).
 */
export const OWNERSHIP_STATEMENT =
  'Presentation only · facts live in the LearningOS core · buttons are conveniences, never duties.';
