export function icon(el, name) { setIcon(el, name || 'circle'); return el; }

export function button(parent, label, onClick, variant = '') {
  const el = parent.createEl('button', {
    cls: `los-btn is-clickable ${variant ? `los-btn--${variant}` : ''}`,
    text: label,
    attr: { type: 'button' },
  });
  el.addEventListener('click', (event) => { event.preventDefault(); onClick?.(event); });
  return el;
}

export function badge(parent, text, variant = '') {
  return parent.createSpan({ cls: `los-badge ${variant ? `los-badge--${variant}` : ''}`, text });
}

export function chip(parent, record, onClick) {
  const el = parent.createEl('button', {
    cls: `los-chip los-t-${record?.type || 'record'} is-clickable`,
    attr: { type: 'button' },
  });
  icon(el.createSpan({ cls: 'los-chip-icon' }), ICONS[record?.type] || 'circle');
  el.createSpan({ text: record?.title || record?.id || 'Unknown' });
  if (onClick) el.addEventListener('click', () => onClick(record));
  return el;
}

export function pageHeader(parent, kicker, title, description = '') {
  const header = parent.createDiv({ cls: 'los-page-header' });
  if (kicker) header.createDiv({ cls: 'los-kicker', text: kicker });
  header.createEl('h1', { text: title });
  if (description) header.createEl('p', { text: description });
  return header;
}

export function section(parent, title, description = '') {
  const wrap = parent.createDiv({ cls: 'los-section' });
  wrap.createEl('h2', { text: title });
  if (description) wrap.createEl('p', { cls: 'los-muted', text: description });
  return wrap;
}

export function empty(parent, title, detail, actionLabel, action) {
  const el = parent.createDiv({ cls: 'los-empty' });
  el.createEl('h3', { text: title });
  el.createEl('p', { text: detail });
  if (actionLabel) button(el, actionLabel, action, 'quiet');
  return el;
}

export function localFilePath(file) {
  if (!file) return '';
  try { return webUtils.getPathForFile(file) || ''; }
  catch (_) { return ''; }
}

export function projectedExcerpt(value, limit = 900) {
  const first = String(value || '').split(/\n\s*\n/)[0]
    .replace(/\*\*/g, '').replace(/`/g, '')
    .replace(/(^|\n)\s*-\s*/g, '$1').replace(/\s+/g, ' ').trim();
  return first.length > limit ? `${first.slice(0, limit - 1)}…` : first;
}

export function workspaceCard(parent, plugin, workspace, moduleContext = null) {
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
  const moduleIds = (workspace.module_ids || []).filter((id) => id !== moduleContext);
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

export function unitCard(parent, plugin, unit) {
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
    const done = (map.stages || []).filter((row) => row.status === 'complete').length;
    card.createDiv({ cls: 'los-progress-copy', text: `${done} of ${(map.stages || []).length} stages complete` });
  } else {
    card.createDiv({ cls: 'los-progress-copy', text: 'No study map yet' });
  }
  card.addEventListener('click', () => plugin.openUnit(unit.id));
  return card;
}

export function moduleCard(parent, plugin, module) {
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

export function viewFooter(parent) {
  parent.createDiv({ cls: 'los-footer', text: 'Presentation only · facts live in the LearningOS core · buttons are conveniences, never duties.' });
}
