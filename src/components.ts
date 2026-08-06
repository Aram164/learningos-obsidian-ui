import { setIcon } from 'obsidian';
import { webUtils } from 'electron';
import { ICONS, SAFE_URL_PROTOCOLS } from './constants';

type UiNode = any;
type ProjectionRecord = Record<string, any>;
type ClickHandler =
  ((event: MouseEvent) => unknown) | null | undefined;
type OverflowItem =
  [string, () => unknown] | null | undefined | false;

export function icon(el: UiNode, name: string): UiNode {
  setIcon(el, name || 'circle');
  return el;
}

export function button(
  parent: UiNode,
  label: string,
  onClick: ClickHandler,
  variant = '',
): UiNode {
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
): UiNode {
  const header = parent.createDiv({ cls: 'los-page-header' });
  if (kicker) header.createDiv({ cls: 'los-kicker', text: kicker });
  header.createEl('h1', { text: title });
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
 * One learning row: what it is, where you are, one way in. Replaces the
 * Module/Status/Next-up table — a status badge is only worth the space when the
 * state needs the learner to do something.
 */
export function progressRow(
  parent: UiNode,
  plugin: any,
  module: ProjectionRecord,
  nextUp = '',
): UiNode {
  const row = parent.createDiv({ cls: 'los-learning-row' });
  const copy = row.createDiv({ cls: 'los-learning-copy' });
  const title = button(copy, module.title, () => plugin.openModule(module.id), 'row');
  title.addClass('los-learning-title');
  if (nextUp) copy.createDiv({ cls: 'los-learning-next', text: nextUp });
  const progress = plugin.store.progress(module.id);
  const meta = row.createDiv({ cls: 'los-learning-meta' });
  meta.createSpan({
    cls: 'los-micro',
    text: `${progress.stages_complete || 0} of ${progress.stages_total || 0} stages`,
  });
  if (progress.units_needing_map) badge(meta, `${progress.units_needing_map} need a map`, 'needs-map');
  return row;
}

/**
 * A projected URL is core data, but core data is not a licence to hand an
 * arbitrary scheme to Electron. Anything outside the allowlist is refused
 * before it can reach a viewer.
 */
export function safeWebUrl(value: unknown): URL | null {
  try {
    const url = new URL(String(value || ''));
    return SAFE_URL_PROTOCOLS.includes(url.protocol) ? url : null;
  } catch (_) { return null; }
}

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
  const first = String(value || '').split(/\n\s*\n/)[0]
    .replace(/\*\*/g, '').replace(/`/g, '')
    .replace(/(^|\n)\s*-\s*/g, '$1').replace(/\s+/g, ' ').trim();
  if (first.length <= limit) return first;
  // Slice by code point: a plain .slice() could cut an emoji in half and leak a
  // lone surrogate into the DOM.
  return `${Array.from(first).slice(0, limit - 1).join('')}…`;
}

/**
 * Boundary cards exist to prove nothing quarantined was loaded, so they show
 * short core-authored policy prose only: capped, single paragraph, and never a
 * `Job/` path. The field is core-owned, but this is the one view where trusting
 * the manifest has no upside.
 */
export function boundaryPolicy(value: unknown): string {
  const text = projectedExcerpt(value, 300);
  return /(^|[\s([<'"])Job\//.test(text) ? '' : text;
}

export function workspaceCard(
  parent: UiNode,
  plugin: any,
  workspace: ProjectionRecord,
  moduleContext: string | null = null,
): UiNode {
  const card = parent.createDiv({ cls: `los-card los-workspace-card los-s-${workspace.status}` });
  const top = card.createDiv({ cls: 'los-card-top' });
  top.createEl('h3', { text: workspace.title });
  badge(top, workspace.standing ? `${workspace.status} · standing` : workspace.status, workspace.status);
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
    if (module) button(actions, `Open ${module.title}`, () => plugin.openModule(id), 'quiet');
  }
  for (const id of (workspace.unit_ids || []).slice(0, 3)) {
    const unit = plugin.store.get(id);
    if (unit) button(actions, `Open ${unit.title}`, () => plugin.openUnit(id), 'quiet');
  }
  return card;
}

export function unitCard(
  parent: UiNode,
  plugin: any,
  unit: ProjectionRecord,
): UiNode {
  const card = parent.createEl('button', {
    cls: `los-card los-unit-card los-s-${unit.status} is-clickable`,
    attr: { type: 'button', 'aria-label': `Open unit: ${unit.title}` },
  });
  const top = card.createDiv({ cls: 'los-card-top' });
  top.createEl('h3', { text: unit.title });
  badge(top, unit.status, unit.status);
  card.createEl('p', { text: unit.scope });
  const map = plugin.store.mapForUnit(unit.id);
  if (map) {
    const done = (map.stages || []).filter(
      (row: ProjectionRecord) => row.status === 'complete',
    ).length;
    card.createDiv({ cls: 'los-progress-copy', text: `${done} of ${(map.stages || []).length} stages complete` });
  } else {
    card.createDiv({ cls: 'los-progress-copy', text: 'No study map yet' });
  }
  card.addEventListener('click', () => plugin.openUnit(unit.id));
  return card;
}

export function moduleCard(
  parent: UiNode,
  plugin: any,
  module: ProjectionRecord,
): UiNode {
  const card = parent.createEl('button', {
    cls: `los-card los-module-card los-s-${module.status} is-clickable`,
    attr: { type: 'button', 'aria-label': `Open module: ${module.title}` },
  });
  const top = card.createDiv({ cls: 'los-card-top' });
  top.createEl('h3', { text: module.title });
  badge(top, module.kind, 'role');
  const progress = plugin.store.progress(module.id);
  card.createEl('p', { text: `${progress.units_total || 0} units · ${progress.stages_complete || 0}/${progress.stages_total || 0} stages complete` });
  if (progress.units_needing_map) badge(card, `${progress.units_needing_map} need a map`, 'needs-map');
  card.addEventListener('click', () => plugin.openModule(module.id));
  return card;
}

/**
 * The ownership statement is architecture policy, not study content. Repeating
 * it under every screen made the product read as internal tooling, so it is
 * stated once in Settings → About (DESIGN.md records the change).
 */
export const OWNERSHIP_STATEMENT =
  'Presentation only · facts live in the LearningOS core · buttons are conveniences, never duties.';
