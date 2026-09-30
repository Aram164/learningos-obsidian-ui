import { button, empty, filterTabs, pageHeader } from '../../components';
import { withRenderFocus } from '../../accessibility/render-focus';
import { enableButtonGroupKeyboardNavigation } from '../../accessibility/button-group';
import type { AppNavigator } from '../../app/navigator';
import type { ProjectionRecord } from '../../contracts/manifest';
import { asStrings, asText, isRecord } from '../../projection/readers';
import { compareStrings, foldCase } from '../../sorting';
import type { AtlasHost, DomainAtlasState } from './ports';

const KNOWN_DOMAINS: ReadonlyArray<readonly [string, string]> = [
  ['mathematics', 'Mathematics'],
  ['machine-learning', 'Machine learning'],
  ['systems', 'Systems'],
  ['data-systems', 'Data systems'],
  ['algorithms', 'Algorithms'],
  ['programming', 'Programming'],
  ['cross-domain', 'Across domains'],
];
const ROLE_LABELS: Readonly<Record<string, string>> = {
  crosswalk: 'Crosswalks', reference: 'Reference notes', synthesis: 'Syntheses',
  derivation: 'Derivations', 'exercise-bank': 'Exercise banks', 'mock-exam': 'Mock exams',
  implementation: 'Implementations', question: 'Questions',
};
const ROLE_ORDER = ['crosswalk', 'reference', 'synthesis', 'derivation', 'exercise-bank', 'mock-exam', 'implementation', 'question'];

interface DomainRow {
  readonly id: string;
  readonly title: string;
  readonly notes: ProjectionRecord[];
  readonly shelves: ProjectionRecord[];
}
interface DomainIndex {
  readonly domains: DomainRow[];
  readonly sources: ReadonlyMap<string, ProjectionRecord>;
}
const count = (amount: number, singular: string, plural = `${singular}s`) => `${amount} ${amount === 1 ? singular : plural}`;
const roleOf = (record: ProjectionRecord) => asText(record.role) ?? 'reference';
const title = (record: ProjectionRecord) => asText(record.title) ?? asText(record.id) ?? 'Untitled record';
const prose = (value: unknown) => {
  const text = asText(value)?.trim() ?? '';
  return text.startsWith('<!--') ? '' : text;
};
const domainTitle = (id: string) => KNOWN_DOMAINS.find(([key]) => key === id)?.[1]
  ?? id.split('-').map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1) : '').join(' ');

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
    domains: ordered.map((id) => ({
      id, title: domainTitle(id),
      notes: notes.filter((note) => noteBucket(note) === id).sort((a, b) => compareStrings(title(a), title(b))),
      shelves: shelves.filter((shelf) => (asText(shelf.domain) ?? 'cross-domain') === id)
        .sort((a, b) => compareStrings(title(a), title(b))),
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
  return `${count(rows.length, 'entry', 'entries')} · ${count(new Set(rows.map((row) => asText(row.source)).filter(Boolean)).size, 'source')}`;
}
function matches(query: string, fields: unknown[]): boolean {
  const words = foldCase(query).split(/\s+/).filter(Boolean);
  const haystack = foldCase(fields.map((field) => typeof field === 'string' ? field : '').join(' '));
  return words.every((word) => haystack.includes(word));
}
function noteMatches(note: ProjectionRecord, query: string): boolean {
  return matches(query, [title(note), note.domain, note.role, note.state, prose(note.summary)]);
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
    ['abilities', 'Ability map'], ['concepts', 'Concept atlas'], ['domains', 'Domain Atlas'],
  ] as const, active, (value) => {
    if (value === active) return;
    if (value === 'abilities') void nav.openAbilities();
    else void nav.openAtlas({ lens: value === 'domains' ? 'domains' : 'prerequisites' });
  });
  variants.addClass('los-atlas-variant-switch');
}

/** Search may reveal a group without changing the user's disclosure preference. */
function disclosure(parent: HTMLElement, state: DomainAtlasState, key: string, query: string, label: string, cls: string): HTMLElement {
  const details = parent.createEl('details', { cls }) as HTMLDetailsElement;
  details.open = Boolean(query.trim()) || state.disclosures.get(key) === true;
  const summary = details.createEl('summary', { cls: 'los-domain-disclosure-summary', text: label });
  summary.addEventListener('click', () => state.disclosures.set(key, !details.open));
  return details.createDiv({ cls: 'los-domain-disclosure-body' });
}

function renderDomainDetail(parent: HTMLElement, host: AtlasHost, index: DomainIndex, domain: DomainRow): void {
  const state = host.domains;
  const query = state.query;
  const wholeDomainMatches = matches(query, [domain.id, domain.title]);
  const notes = domain.notes.filter((note) => wholeDomainMatches || noteMatches(note, query));
  const shelves = domain.shelves.filter((shelf) => wholeDomainMatches || shelfMatches(shelf, query, index));
  const detail = parent.createDiv({ cls: 'los-domain-detail' });
  detail.createEl('h2', { text: domain.title });
  detail.createDiv({ cls: 'los-domain-counts', text: query.trim()
    ? `${notes.length} of ${count(domain.notes.length, 'note')} · ${shelves.length} of ${count(domain.shelves.length, 'shelf')} match`
    : `${count(notes.length, 'note')} · ${count(shelves.length, 'shelf')}` });

  if (!notes.length && !shelves.length) {
    empty(detail, query.trim() ? 'No matches in this domain' : 'Nothing published here yet',
      query.trim() ? 'Choose another matching domain, or clear the search to see this domain’s full overview.'
        : 'Published notes and curated shelves will appear here. Source folders remain available below.');
    return;
  }
  if (domain.notes.length) {
    const section = detail.createDiv({ cls: 'los-domain-notes' });
    section.createEl('h3', { text: 'Notes by role' });
    if (!notes.length) section.createDiv({ cls: 'los-domain-empty', text: 'No notes match this search.' });
    const roles = [...new Set(notes.map(roleOf))]
      .sort((a, b) => (ROLE_ORDER.indexOf(a) < 0 ? 99 : ROLE_ORDER.indexOf(a))
        - (ROLE_ORDER.indexOf(b) < 0 ? 99 : ROLE_ORDER.indexOf(b)) || compareStrings(a, b));
    for (const role of roles) {
      const visible = notes.filter((note) => roleOf(note) === role);
      const total = domain.notes.filter((note) => roleOf(note) === role).length;
      const body = disclosure(section, state, `${domain.id}:role:${role}`, query,
        `${ROLE_LABELS[role] ?? role} · ${query.trim() ? `${visible.length} of ${total}` : total}`, 'los-domain-role');
      for (const note of visible) {
        const row = button(body, title(note), () => host.plugin.nav.openRecord(note), 'quiet');
        row.addClass('los-domain-note-row');
        row.createSpan({ cls: 'los-domain-note-meta', text: [asText(note.state), asText(note.authorship)].filter(Boolean).join(' · ') });
      }
    }
  }
  if (domain.shelves.length) {
    const section = detail.createDiv({ cls: 'los-domain-shelves' });
    section.createEl('h3', { text: 'Curated shelves' });
    if (!shelves.length) section.createDiv({ cls: 'los-domain-empty', text: 'No shelves match this search.' });
    for (const shelf of shelves) {
      const shelfId = asText(shelf.id) ?? title(shelf);
      const body = disclosure(section, state, `${domain.id}:shelf:${shelfId}`, query,
        `${title(shelf)} · ${shelfCounts(shelf)}`, 'los-domain-shelf');
      const purpose = prose(shelf.purpose);
      const summary = prose(shelf.summary);
      if (purpose) body.createEl('p', { text: purpose });
      if (summary && summary !== purpose) body.createEl('p', { text: summary });
      const actions = body.createDiv({ cls: 'los-actions' });
      button(actions, 'Open shelf', () => host.plugin.nav.openRecord(shelf), 'quiet').addClass('los-domain-open-shelf');
      for (const entry of entries(shelf)) {
        const id = asText(entry.source) ?? '';
        const source = index.sources.get(id);
        const row = body.createDiv({ cls: 'los-domain-entry-row' });
        if (source) button(row, title(source), () => host.plugin.nav.openSourceDetail(id), 'tertiary').addClass('los-domain-open-source');
        else row.createDiv({ cls: 'los-domain-source-unavailable', text: `${id || 'Source'} · unavailable in this projection` });
        const group = prose(entry.group);
        if (group) row.createDiv({ cls: 'los-domain-entry-group', text: group });
        const why = prose(entry.why);
        if (why) row.createEl('p', { cls: 'los-domain-entry-why', text: why });
      }
    }
  }
}

function renderResults(results: HTMLElement, host: AtlasHost, index: DomainIndex): void {
  const state = host.domains;
  const query = state.query;
  const visible = index.domains.filter((domain) => matches(query, [domain.id, domain.title])
    || domain.notes.some((note) => noteMatches(note, query))
    || domain.shelves.some((shelf) => shelfMatches(shelf, query, index)));
  results.createDiv({ cls: 'los-domain-search-status', attr: { role: 'status' }, text: query.trim()
    ? `${count(visible.length, 'domain')} match “${query}”. Your selected domain stays open.`
    : `${count(index.domains.length, 'domain')} · ${count(index.domains.reduce((n, domain) => n + domain.notes.length, 0), 'note')} · ${count(index.domains.reduce((n, domain) => n + domain.shelves.length, 0), 'shelf')}` });
  const layout = results.createDiv({ cls: 'los-domain-layout' });
  const rail = layout.createDiv({ cls: 'los-domain-rail', attr: { role: 'group', 'aria-label': 'Knowledge domains' } });
  enableButtonGroupKeyboardNavigation(rail, 'vertical');
  for (const domain of index.domains.filter((row) => visible.includes(row) || row.id === state.selected)) {
    const choice = button(rail, domain.title, () => {
      state.selected = domain.id;
      withRenderFocus(results, () => { results.empty(); renderResults(results, host, index); });
    }, 'quiet');
    choice.addClass('los-domain-choice');
    choice.toggleClass('is-active', domain.id === state.selected);
    choice.setAttrs({ 'aria-pressed': String(domain.id === state.selected), 'data-los-tab': domain.id });
    choice.createSpan({ cls: 'los-domain-choice-counts', text: `${count(domain.notes.length, 'note')} · ${count(domain.shelves.length, 'shelf')}` });
    if (query.trim() && !visible.includes(domain)) choice.createSpan({ cls: 'los-domain-choice-empty', text: 'No search matches' });
  }
  const selected = index.domains.find((domain) => domain.id === state.selected);
  if (selected) renderDomainDetail(layout, host, index, selected);
}

/** All source domains stay separately named; note buckets do not imply source ownership. */
function renderSourceDomains(root: HTMLElement, host: AtlasHost, index: DomainIndex): void {
  const section = root.createDiv({ cls: 'los-domain-source-domains' });
  section.createEl('h2', { text: 'Source folders' });
  section.createEl('p', { text: 'Sources use their own recorded thematic groups. A source may appear in more than one folder; these counts overlap.' });
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
  const secondary = section.createDiv({ cls: 'los-actions' });
  button(secondary, 'Generated text overview', () => host.plugin.openVaultPath('generated/domain-atlas.md'), 'tertiary');
  section.createEl('p', { cls: 'los-micro', text: 'The generated overview also records material outside this map. Notes, shelf placements and source counts describe published records; they do not record learning progress or ability evidence.' });
}

export function renderDomains(root: HTMLElement, host: AtlasHost): void {
  pageHeader(root, 'Reach', 'Domain Atlas', 'A readable map of your published notes and curated shelves across every domain. Open one domain, then follow the records it holds.');
  renderAtlasVariants(root, host.plugin.nav, 'domains');
  if (!host.plugin.store.ready) {
    empty(root, 'Domain Atlas unavailable', 'The interface contract could not be loaded. Rebuild the projection or reopen this view when it is available.');
    return;
  }
  const index = domainIndex(host);
  const state = host.domains;
  if (!index.domains.some((domain) => domain.id === state.selected)) {
    state.selected = index.domains.find((domain) => domain.notes.length || domain.shelves.length)?.id ?? index.domains[0]?.id ?? null;
  }
  const controls = root.createDiv({ cls: 'los-domain-controls' });
  const label = controls.createEl('label', { text: 'Search domains, notes and shelves', cls: 'los-domain-search-label' });
  const search = label.createEl('input', { cls: 'los-domain-search', attr: { type: 'search', placeholder: 'Find a note, role, shelf or source on a shelf', 'aria-label': 'Search Domain Atlas' } });
  search.value = state.query;
  const results = root.createDiv({ cls: 'los-domain-results' });
  search.addEventListener('input', () => {
    state.query = search.value;
    results.empty(); renderResults(results, host, index);
  });
  renderResults(results, host, index);
  renderSourceDomains(root, host, index);
}
