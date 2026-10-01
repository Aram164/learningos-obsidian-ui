import { button, empty, factList, filterTabs, pageHeader } from '../../components';
import { withRenderFocus } from '../../accessibility/render-focus';
import { enableButtonGroupKeyboardNavigation } from '../../accessibility/button-group';
import type { AppNavigator } from '../../app/navigator';
import type { ProjectionRecord } from '../../contracts/manifest';
import { asStrings, asText, isRecord } from '../../projection/readers';
import { compareStrings, foldCase } from '../../sorting';
import type { AtlasHost, DomainAtlasState } from './ports';

const KNOWN_DOMAINS: ReadonlyArray<readonly [string, string]> = [
  ['mathematics', 'Mathematics'], ['machine-learning', 'Machine learning'],
  ['systems', 'Systems'], ['data-systems', 'Data systems'], ['algorithms', 'Algorithms'],
  ['programming', 'Programming'], ['cross-domain', 'Across domains'],
];
const ROLE_LABELS: Readonly<Record<string, string>> = {
  crosswalk: 'Crosswalk', reference: 'Reference', synthesis: 'Synthesis', derivation: 'Derivation',
  'exercise-bank': 'Exercise bank', 'mock-exam': 'Mock exam', implementation: 'Implementation', question: 'Question',
};
const AUTHOR_LABELS: Readonly<Record<string, string>> = {
  user: 'User authored', mixed: 'Mixed authorship', 'operator-drafted': 'Operator draft',
  external: 'External authorship',
  unrecorded: 'Authorship unrecorded',
};
const INITIAL_ROWS = 20;
interface DomainRow {
  readonly id: string;
  readonly title: string;
  readonly notes: ProjectionRecord[];
  readonly shelves: ProjectionRecord[];
}
interface DomainIndex {
  readonly domains: DomainRow[];
  readonly notes: readonly ProjectionRecord[];
  readonly sources: ReadonlyMap<string, ProjectionRecord>;
}
const count = (amount: number, singular: string, plural = `${singular}s`) => `${amount} ${amount === 1 ? singular : plural}`;
const roleOf = (record: ProjectionRecord) => asText(record.role) ?? 'unrecorded';
const authorOf = (record: ProjectionRecord) => asText(record.authorship) ?? 'unrecorded';
const roleLabel = (role: string) => ROLE_LABELS[role] ?? role;
const authorLabel = (author: string) => AUTHOR_LABELS[author] ?? author;
const title = (record: ProjectionRecord) => asText(record.title) ?? asText(record.id) ?? 'Untitled record';
const prose = (value: unknown) => {
  const text = asText(value)?.trim() ?? '';
  return text.startsWith('<!--') ? '' : text;
};
const domainTitle = (id: string) => KNOWN_DOMAINS.find(([key]) => key === id)?.[1]
  ?? id.split('-').map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1) : '').join(' ');
const byTitle = (a: ProjectionRecord, b: ProjectionRecord) => compareStrings(title(a), title(b))
  || compareStrings(asText(a.id) ?? '', asText(b.id) ?? '');

/** Match the generated atlas's buckets using published path metadata only. */
function noteBucket(record: ProjectionRecord): string {
  const parts = asText(record.path)?.split('/') ?? [];
  return parts[0] === 'knowledge' && parts[1] === 'notes' && parts[2] && !parts[2].endsWith('.md')
    ? parts[2] : 'cross-domain';
}
function domainIndex(host: AtlasHost): DomainIndex {
  const notes = host.plugin.store.of('note');
  const shelves = [...host.plugin.store.catalogues(), ...host.plugin.store.topicPacks()];
  const ids = new Set(KNOWN_DOMAINS.map(([id]) => id));
  for (const note of notes) ids.add(noteBucket(note));
  for (const shelf of shelves) ids.add(asText(shelf.domain) ?? 'cross-domain');
  const known = KNOWN_DOMAINS.map(([id]) => id);
  const ordered = [...known, ...[...ids].filter((id) => !known.includes(id)).sort(compareStrings)];
  return {
    notes,
    domains: ordered.map((id) => ({ id, title: domainTitle(id),
      notes: notes.filter((note) => noteBucket(note) === id).sort(byTitle),
      shelves: shelves.filter((shelf) => (asText(shelf.domain) ?? 'cross-domain') === id).sort(byTitle),
    })),
    sources: new Map(host.plugin.store.sources().flatMap((source) => {
      const id = asText(source.id);
      return id ? [[id, source] as const] : [];
    })),
  };
}
function entries(shelf: ProjectionRecord): ReadonlyArray<Record<string, unknown>> {
  return Array.isArray(shelf.entries) ? shelf.entries.filter(isRecord) : [];
}
function shelfCounts(shelf: ProjectionRecord): string {
  const rows = entries(shelf);
  return `${count(rows.length, 'ordered entry', 'ordered entries')} · ${count(new Set(rows.map((row) => asText(row.source)).filter(Boolean)).size, 'source')}`;
}
function matches(query: string, fields: unknown[]): boolean {
  const words = foldCase(query).split(/\s+/).filter(Boolean);
  const haystack = foldCase(fields.map((field) => typeof field === 'string' ? field : '').join(' '));
  return words.every((word) => haystack.includes(word));
}
function noteMatches(note: ProjectionRecord, state: DomainAtlasState, wholeDomainMatches: boolean): boolean {
  return (!state.role || roleOf(note) === state.role) && (!state.authorship || authorOf(note) === state.authorship)
    && (wholeDomainMatches || matches(state.query, [title(note), note.domain, note.role, roleLabel(roleOf(note)),
      authorLabel(authorOf(note)), note.state, prose(note.summary)]));
}
function shelfMatches(shelf: ProjectionRecord, query: string, index: DomainIndex): boolean {
  return matches(query, [title(shelf), shelf.domain, shelf.purpose, prose(shelf.summary),
    ...entries(shelf).flatMap((entry) => {
      const source = index.sources.get(asText(entry.source) ?? '');
      return [entry.group, entry.why, source ? title(source) : entry.source, ...asStrings(source?.authors)];
    })]);
}

/** Atlas variants share one native, keyboard-accessible grouped control. */
export function renderAtlasVariants(
  parent: HTMLElement,
  nav: Pick<AppNavigator, 'openAbilities' | 'openAtlas'>,
  active: 'abilities' | 'concepts' | 'domains',
): void {
  const variants = filterTabs(parent, 'Atlas views', [
    ['concepts', 'Concepts'], ['domains', 'Notes & shelves'], ['abilities', 'Abilities'],
  ] as const, active, (value) => {
    if (value === active) return;
    if (value === 'abilities') void nav.openAbilities();
    else void nav.openAtlas({ lens: value === 'domains' ? 'domains' : 'prerequisites' });
  });
  variants.addClass('los-atlas-variant-switch');
}

/** A native disclosure retains attention across a projection redraw. */
function disclosure(parent: HTMLElement, state: DomainAtlasState, key: string, label: string, cls: string): HTMLElement {
  const details = parent.createEl('details', { cls }) as HTMLDetailsElement;
  details.open = state.disclosures.get(key) === true;
  details.createEl('summary', { cls: 'los-domain-disclosure-summary', text: label })
    .addEventListener('click', () => state.disclosures.set(key, !details.open));
  details.addEventListener('toggle', () => state.disclosures.set(key, details.open));
  return details.createDiv({ cls: 'los-domain-disclosure-body' });
}
function showMore(parent: HTMLElement, state: DomainAtlasState, key: string, total: number, redraw: () => void, noun: string): number {
  const limit = state.limits.get(key) ?? INITIAL_ROWS;
  if (total > limit) button(parent, `Show all ${total} ${noun}`, () => {
    state.limits.set(key, total); redraw();
  }, 'tertiary').addClass('los-domain-show-more');
  return limit;
}
function renderNoteInspector(parent: HTMLElement, host: AtlasHost, index: DomainIndex, note: ProjectionRecord, outsideFilter: boolean, redraw: (focusNote?: string) => void): void {
  const panel = parent.createEl('aside', { cls: 'los-domain-inspector', attr: { 'aria-label': 'Selected note' } });
  panel.createDiv({ cls: 'los-domain-inspector-kicker', text: 'Selected note' });
  panel.createEl('h3', { text: title(note) });
  panel.createDiv({ cls: 'los-domain-note-meta', text: [roleLabel(roleOf(note)), authorLabel(authorOf(note)), asText(note.state)].filter(Boolean).join(' · ') });
  if (outsideFilter) panel.createDiv({ cls: 'los-domain-empty', text: 'This selected note is outside the current filters.' });
  const actions = panel.createDiv({ cls: 'los-actions' });
  button(actions, 'Open note', () => host.plugin.nav.openRecord(note), 'quiet').addClass('los-domain-open-note');
  button(actions, 'Clear selection', () => { host.domains.selectedNote = null; redraw(asText(note.id) ?? ''); }, 'tertiary');
  const ids = asStrings(note.concepts);
  const concepts = panel.createDiv({ cls: 'los-domain-note-concepts' });
  concepts.createEl('h4', { text: `Linked concepts · ${ids.length}` });
  if (!ids.length) concepts.createDiv({ cls: 'los-domain-empty', text: 'No explicit concept links are recorded.' });
  for (const id of ids) {
    const concept = host.plugin.store.get(id);
    if (concept?.type === 'concept') button(concepts, title(concept), () => host.plugin.nav.openAtlas({ concept: id, lens: 'prerequisites' }), 'tertiary')
      .addClass('los-domain-open-concept');
    else concepts.createDiv({ cls: 'los-domain-source-unavailable', text: `${id} · unavailable in this projection` });
  }
  const body = disclosure(panel, host.domains, `note:${note.id}:provenance`, 'Sources and provenance', 'los-domain-note-provenance');
  const summary = prose(note.summary);
  if (summary) body.createEl('p', { text: summary });
  factList(body, [['Authorship', authorLabel(authorOf(note))], ['Lifecycle', asText(note.state)],
    ['Semantic review', asText(note.semantic_review)], ['Reviewed', asText(note.reviewed)]]);
  const sourceIds = asStrings(note.sources);
  body.createEl('h4', { text: `Recorded sources · ${sourceIds.length}` });
  if (!sourceIds.length) body.createDiv({ cls: 'los-domain-empty', text: 'No direct note sources recorded.' });
  for (const id of sourceIds) {
    const source = index.sources.get(id);
    if (source) button(body, title(source), () => host.plugin.nav.openSourceDetail(id), 'tertiary').addClass('los-domain-note-source');
    else body.createDiv({ cls: 'los-domain-source-unavailable', text: `${id} · unavailable in this projection` });
  }
  if (isRecord(note.material_analysis)) {
    const analysis = note.material_analysis;
    factList(body, [['Material', asText(analysis.material)], ['Observed range', isRecord(analysis.inspected_range)
      ? `${asText(analysis.inspected_range.start) ?? '?'}–${asText(analysis.inspected_range.end) ?? '?'}` : null],
    ['Analysis provenance', asText(analysis.resolution)], ['Analysis source', asText(analysis.source_id)]]);
    const sourceId = asText(analysis.source_id);
    if (sourceId) {
      const source = index.sources.get(sourceId);
      if (source) button(body, `Open analysis source: ${title(source)}`, () => host.plugin.nav.openSourceDetail(sourceId), 'tertiary')
        .addClass('los-domain-analysis-source');
      else body.createDiv({ cls: 'los-domain-source-unavailable', text: `${sourceId} · unavailable in this projection` });
    }
  }
  const evidence = Array.isArray(note.evidence) ? note.evidence : [];
  if (evidence.length) {
    body.createEl('h4', { text: `Recorded evidence · ${evidence.length}` });
    for (const item of evidence) body.createDiv({ cls: 'los-domain-recorded-evidence', text: isRecord(item) && asText(item.type) && asText(item.ref)
      ? `${asText(item.type)} · ${asText(item.ref)}` : asText(item) ?? JSON.stringify(item) });
  }
}
function renderNotes(parent: HTMLElement, host: AtlasHost, index: DomainIndex, domain: DomainRow, notes: ProjectionRecord[], redraw: (focusNote?: string) => void): void {
  const state = host.domains;
  const selected = domain.notes.find((note) => note.id === state.selectedNote);
  const workspace = parent.createDiv({ cls: 'los-domain-note-workspace' });
  workspace.toggleClass('has-selection', Boolean(selected));
  const list = workspace.createDiv({ cls: 'los-domain-notes', attr: { role: 'group', 'aria-label': `Notes in ${domain.title}` } });
  enableButtonGroupKeyboardNavigation(list, 'vertical');
  if (!notes.length) empty(list, domain.notes.length ? 'No notes match these filters' : 'No notes published in this domain',
    'Choose another domain, adjust the note filters, or browse Source shelves.');
  const key = `notes:${domain.id}:${state.role ?? ''}:${state.authorship ?? ''}:${state.query}`;
  const limit = state.limits.get(key) ?? INITIAL_ROWS;
  for (const note of notes.slice(0, limit)) {
    const id = asText(note.id) ?? '';
    const row = list.createDiv({ cls: 'los-domain-note-row', attr: { 'data-note-id': id } });
    row.toggleClass('is-selected', note === selected);
    const choice = button(row, title(note), () => { state.selectedNote = id; redraw(); }, 'quiet');
    choice.addClass('los-domain-select-note');
    choice.setAttrs({ 'aria-pressed': String(note === selected), 'data-los-tab': id });
    choice.createSpan({ cls: 'los-domain-note-meta', text: `${roleLabel(roleOf(note))} · ${authorLabel(authorOf(note))}` });
    button(row, 'Open', () => host.plugin.nav.openRecord(note), 'tertiary').addClass('los-domain-row-open');
  }
  const footer = list.createDiv({ cls: 'los-domain-list-footer', text: `${Math.min(limit, notes.length)} of ${count(notes.length, 'note')} shown` });
  showMore(footer, state, key, notes.length, redraw, 'notes');
  if (selected) renderNoteInspector(workspace, host, index, selected, !notes.includes(selected), redraw);
}
function renderShelves(parent: HTMLElement, host: AtlasHost, index: DomainIndex, domain: DomainRow, shelves: ProjectionRecord[], redraw: () => void): void {
  const state = host.domains;
  const section = parent.createDiv({ cls: 'los-domain-shelves' });
  const first = shelves[0];
  if (!first) {
    empty(section, domain.shelves.length ? 'No source shelves match this search' : 'No source shelves published in this domain',
      'Source folders remain available through Atlas tools.');
    return;
  }
  if (!shelves.some((shelf) => shelf.id === state.selectedShelf)) state.selectedShelf = asText(first.id);
  if (shelves.length > 1) {
    const choices = section.createDiv({ cls: 'los-domain-shelf-choices', attr: { role: 'group', 'aria-label': `Source shelves in ${domain.title}` } });
    enableButtonGroupKeyboardNavigation(choices, 'vertical');
    for (const shelf of shelves) {
      const id = asText(shelf.id) ?? '';
      const choice = button(choices, title(shelf), () => { state.selectedShelf = id; redraw(); }, 'quiet');
      choice.addClass('los-domain-shelf-choice');
      choice.setAttrs({ 'aria-pressed': String(shelf.id === state.selectedShelf), 'data-los-tab': id });
      choice.toggleClass('is-active', shelf.id === state.selectedShelf);
      choice.createSpan({ cls: 'los-domain-note-meta', text: shelfCounts(shelf) });
    }
  }
  const shelf = shelves.find((row) => row.id === state.selectedShelf) ?? first;
  const shelfId = asText(shelf.id) ?? '';
  const body = section.createDiv({ cls: 'los-domain-shelf', attr: { 'data-shelf-id': shelfId } });
  body.createEl('h3', { text: title(shelf) });
  body.createDiv({ cls: 'los-domain-counts', text: shelfCounts(shelf) });
  const actions = body.createDiv({ cls: 'los-actions' });
  button(actions, 'Open shelf', () => host.plugin.nav.openRecord(shelf), 'tertiary').addClass('los-domain-open-shelf');
  const about = disclosure(body, state, `shelf:${shelfId}:about`, 'About this source shelf', 'los-domain-shelf-about');
  for (const text of new Set([prose(shelf.purpose), prose(shelf.summary)].filter(Boolean))) about.createEl('p', { text });
  const rows = entries(shelf);
  const key = `shelf:${shelfId}:entries`;
  const limit = state.limits.get(key) ?? INITIAL_ROWS;
  // Entry identity is its authored position, never source id: duplicates are placements.
  for (const [position, entry] of rows.slice(0, limit).entries()) {
    const id = asText(entry.source) ?? '';
    const source = index.sources.get(id);
    const row = body.createDiv({ cls: 'los-domain-entry-row', attr: { 'data-entry-index': String(position), 'data-source-id': id } });
    row.createEl('h4', { text: source ? title(source) : `${id || 'Source'} · unavailable in this projection`,
      cls: source ? 'los-domain-entry-title' : 'los-domain-source-unavailable' });
    const controls = row.createDiv({ cls: 'los-domain-entry-actions' });
    const group = prose(entry.group);
    if (group) controls.createSpan({ cls: 'los-domain-entry-group', text: group });
    const why = disclosure(controls, state, `shelf:${shelfId}:entry:${position}:why`, 'Why this source', 'los-domain-entry-rationale');
    why.createEl('p', { cls: 'los-domain-entry-why', text: prose(entry.why) || 'No rationale recorded for this placement.' });
    if (source) button(controls, 'Open source', () => host.plugin.nav.openSourceDetail(id), 'tertiary').addClass('los-domain-open-source');
  }
  const footer = body.createDiv({ cls: 'los-domain-list-footer', text: `${Math.min(limit, rows.length)} of ${count(rows.length, 'ordered entry', 'ordered entries')} shown` });
  showMore(footer, state, key, rows.length, redraw, 'entries');
  button(footer, 'All source folders', () => host.plugin.nav.openLibraryHome('sources'), 'tertiary');
}
function renderResults(results: HTMLElement, host: AtlasHost, index: DomainIndex): void {
  const state = host.domains;
  const redraw = (focusNote?: string) => {
    withRenderFocus(results, () => { results.empty(); renderResults(results, host, index); });
    if (focusNote) {
      const choice = Array.from(results.querySelectorAll<HTMLButtonElement>('button')).find((control) => control.getAttribute('data-los-tab') === focusNote);
      // A filtered-out selection has no row, so return to the domain choice.
      (choice ?? Array.from(results.querySelectorAll<HTMLButtonElement>('button')).find((control) => control.getAttribute('data-los-tab') === state.selected))?.focus({ preventScroll: true });
    }
  };
  const domainMatches = (domain: DomainRow) => matches(state.query, [domain.id, domain.title]);
  const visibleNotes = (domain: DomainRow) => domain.notes.filter((note) => noteMatches(note, state, domainMatches(domain)));
  const visibleShelves = (domain: DomainRow) => domain.shelves.filter((shelf) => domainMatches(domain) || shelfMatches(shelf, state.query, index));
  const filtering = Boolean(state.query.trim() || (state.collection === 'notes' && (state.role || state.authorship)));
  const searching = Boolean(state.query.trim());
  const visible = index.domains.filter((domain) => !filtering || (searching
    ? domainMatches(domain) || visibleNotes(domain).length || visibleShelves(domain).length
    : state.collection === 'notes' ? visibleNotes(domain).length : visibleShelves(domain).length));
  const searchScope = searching ? ` · ${count(index.domains.reduce((n, domain) => n + visibleNotes(domain).length, 0), 'matching note')}`
    + ` · ${count(index.domains.reduce((n, domain) => n + visibleShelves(domain).length, 0), 'matching source shelf')}` : '';
  results.createDiv({ cls: 'los-domain-search-status', attr: { role: 'status' }, text: filtering
    ? `${count(visible.length, 'domain')} match${searchScope}. Your selected domain stays open.`
    : `${count(index.notes.length, 'note')} · ${count(index.domains.reduce((n, domain) => n + domain.shelves.length, 0), 'source shelf')}` });
  const layout = results.createDiv({ cls: 'los-domain-layout' });
  const rail = layout.createDiv({ cls: 'los-domain-rail', attr: { role: 'group', 'aria-label': 'Knowledge domains' } });
  rail.createDiv({ cls: 'los-domain-rail-label', text: 'Domains' });
  enableButtonGroupKeyboardNavigation(rail, 'vertical');
  for (const domain of index.domains.filter((row) => visible.includes(row) || row.id === state.selected)) {
    const choice = button(rail, domain.title, () => {
      if (state.selected !== domain.id) { state.selectedNote = null; state.selectedShelf = null; }
      state.selected = domain.id; redraw();
    }, 'quiet');
    choice.addClass('los-domain-choice');
    choice.toggleClass('is-active', domain.id === state.selected);
    choice.setAttrs({ 'aria-pressed': String(domain.id === state.selected), 'data-los-tab': domain.id });
    choice.createSpan({ cls: 'los-domain-choice-counts', text: `${count(domain.notes.length, 'note')} · ${count(domain.shelves.length, 'source shelf')}` });
    if (filtering && !visible.includes(domain)) choice.createSpan({ cls: 'los-domain-choice-empty', text: 'No filter matches' });
  }
  const domain = index.domains.find((row) => row.id === state.selected);
  if (!domain) return;
  const detail = layout.createDiv({ cls: 'los-domain-detail' });
  const heading = detail.createDiv({ cls: 'los-domain-detail-heading' });
  heading.createEl('h2', { text: domain.title });
  const notes = visibleNotes(domain), shelves = visibleShelves(domain);
  const full = state.collection === 'notes' ? domain.notes.length : domain.shelves.length;
  const shown = state.collection === 'notes' ? notes.length : shelves.length;
  heading.createDiv({ cls: 'los-domain-counts', text: `${filtering ? `${shown} of ` : ''}${count(full, state.collection === 'notes' ? 'note' : 'source shelf')}` });
  filterTabs(detail, 'Domain content', [['notes', 'Notes'], ['shelves', 'Source shelves']] as const, state.collection, (value) => {
    state.collection = value; host.render();
  }, searching ? (value) => value === 'notes' ? notes.length : shelves.length : null).addClass('los-domain-content-switch');
  if (searching && !shown) {
    const other = state.collection === 'notes' ? shelves.length : notes.length;
    if (other) button(detail, `Show ${count(other, state.collection === 'notes' ? 'matching source shelf' : 'matching note')}`, () => {
      state.collection = state.collection === 'notes' ? 'shelves' : 'notes'; host.render();
    }, 'quiet').addClass('los-domain-other-matches');
  }
  if (state.collection === 'notes') renderNotes(detail, host, index, domain, notes, redraw);
  else renderShelves(detail, host, index, domain, shelves, redraw);
}
function renderSourceDomains(root: HTMLElement, host: AtlasHost, index: DomainIndex): void {
  const body = disclosure(root, host.domains, 'atlas:tools', 'Atlas tools', 'los-domain-tools');
  const section = body.createDiv({ cls: 'los-domain-source-domains' });
  section.createEl('h2', { text: 'Source folders' });
  section.createEl('p', { text: 'Sources use their recorded thematic groups. A source may appear in more than one folder; these counts overlap.' });
  const actions = section.createDiv({ cls: 'los-actions' });
  button(actions, `All sources · ${index.sources.size}`, () => host.plugin.nav.openLibraryHome('sources'), 'quiet').addClass('los-domain-all-sources');
  button(actions, 'Search all sources', () => host.plugin.nav.openLibraryHome('sources', host.domains.query), 'quiet').addClass('los-domain-search-sources');
  const groups = host.plugin.store.thematicGroups();
  const groupIds = new Set(groups.map((group) => asText(group.id)).filter(Boolean));
  const list = section.createDiv({ cls: 'los-domain-source-groups' });
  for (const group of groups) {
    const id = asText(group.id);
    if (!id) continue;
    const amount = [...index.sources.values()].filter((source) => asStrings(source.thematic_group_ids).includes(id)).length;
    button(list, `${title(group)} · ${count(amount, 'source')}`,
      () => host.plugin.nav.openLibraryFolder([`domain:${id}`]), 'quiet').addClass('los-domain-source-group');
  }
  const unfiled = [...index.sources.values()].filter((source) => !asStrings(source.thematic_group_ids).some((id) => groupIds.has(id))).length;
  if (unfiled) button(list, `Unfiled · ${count(unfiled, 'source')}`,
    () => host.plugin.nav.openLibraryFolder(['shelf:unfiled']), 'quiet').addClass('los-domain-unfiled');
  button(body, 'Generated text overview', () => host.plugin.openVaultPath('generated/domain-atlas.md'), 'tertiary');
}
function noteFilter(parent: HTMLElement, cls: string, ariaLabel: string, allLabel: string, values: string[], selected: string | null,
  labelOf: (value: string) => string, choose: (value: string | null) => void, disabled: boolean): void {
  const select = parent.createEl('select', { cls, attr: { 'aria-label': ariaLabel } });
  select.createEl('option', { text: allLabel, attr: { value: '' } });
  for (const value of values) select.createEl('option', { text: labelOf(value), attr: { value } });
  select.value = selected ?? '';
  select.disabled = disabled;
  select.addEventListener('change', () => choose(select.value || null));
}
export function renderDomains(root: HTMLElement, host: AtlasHost): void {
  const header = pageHeader(root, '', 'Atlas');
  header.addClass('los-domain-header');
  const about = disclosure(header, host.domains, 'atlas:about', 'About Atlas', 'los-domain-about');
  about.createEl('p', { text: 'Browse explicitly linked concepts, published notes and ordered source shelves. Abilities shows authored preparation and recorded evidence. Browsing does not record learning progress or ability credit.' });
  renderAtlasVariants(root, host.plugin.nav, 'domains');
  if (!host.plugin.store.ready) {
    empty(root, 'Notes & shelves unavailable', 'The interface contract could not be loaded. Reopen this view when the projection is available.');
    return;
  }
  const index = domainIndex(host), state = host.domains;
  if (!index.domains.some((domain) => domain.id === state.selected)) state.selected = index.domains.find((domain) => domain.notes.length || domain.shelves.length)?.id ?? index.domains[0]?.id ?? null;
  if (!index.notes.some((note) => note.id === state.selectedNote)) state.selectedNote = null;
  if (state.role && !index.notes.some((note) => roleOf(note) === state.role)) state.role = null;
  if (state.authorship && !index.notes.some((note) => authorOf(note) === state.authorship)) state.authorship = null;
  const controls = root.createDiv({ cls: 'los-domain-controls' });
  const search = controls.createEl('input', { cls: 'los-domain-search', attr: { type: 'search', placeholder: 'Find a note or source shelf', 'aria-label': 'Search Notes & shelves' } });
  search.value = state.query;
  const results = root.createDiv({ cls: 'los-domain-results' });
  const update = () => { results.empty(); renderResults(results, host, index); };
  search.addEventListener('input', () => { state.query = search.value; update(); });
  noteFilter(controls, 'los-domain-author-filter', 'Note authorship', 'All authors', [...new Set(index.notes.map(authorOf))].sort(compareStrings), state.authorship, authorLabel,
    (value) => { state.authorship = value; update(); }, state.collection === 'shelves');
  noteFilter(controls, 'los-domain-role-filter', 'Note type', 'All note types', [...new Set(index.notes.map(roleOf))].sort(compareStrings), state.role, roleLabel,
    (value) => { state.role = value; update(); }, state.collection === 'shelves');
  renderResults(results, host, index);
  renderSourceDomains(root, host, index);
}
