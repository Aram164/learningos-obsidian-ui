import { button } from '../../components';
import { enableButtonGroupKeyboardNavigation } from '../../accessibility/button-group';
import { asStrings, asText } from '../../projection/readers';
import { compareStrings } from '../../sorting';
import { linkedConceptNotes } from './context';
import { KNOWN_DOMAINS, noteBucket } from './domains';
import { conceptOf, neighbourhood, type AtlasGraph } from './graph';
import { plural, moduleTrail } from './narrative';
import type { AtlasHost } from './ports';

interface BrowsePlace {
  readonly id: string;
  readonly title: string;
  readonly concepts: Set<string>;
  readonly folders: Map<string, Set<string>>;
  notes: number;
  shelves: number;
}

const label = (id: string) => KNOWN_DOMAINS.find(([key]) => key === id)?.[1]
  ?? id.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');

/** Browse aliases from explicit note links and published folders, never a taxonomy or graph edge. */
export function conceptPlaces(host: AtlasHost, graph: AtlasGraph): BrowsePlace[] {
  const places = new Map<string, BrowsePlace>();
  const place = (id: string) => {
    if (!places.has(id)) places.set(id, { id, title: label(id), concepts: new Set(), folders: new Map(), notes: 0, shelves: 0 });
    return places.get(id)!;
  };
  for (const [id] of KNOWN_DOMAINS) place(id);
  const assigned = new Set<string>();
  for (const note of host.plugin.store.of('note')) {
    const bucket = place(noteBucket(note));
    bucket.notes++;
    const path = asText(note.path)?.split('/') ?? [];
    const folder = path.length > 4 ? path.slice(3, -1).join('/') : 'ungrouped';
    if (!bucket.folders.has(folder)) bucket.folders.set(folder, new Set());
    for (const id of asStrings(note.concepts)) {
      if (!graph.conceptById.get(id)?.record) continue;
      bucket.concepts.add(id); bucket.folders.get(folder)!.add(id); assigned.add(id);
    }
  }
  for (const shelf of [...host.plugin.store.catalogues(), ...host.plugin.store.topicPacks()]) {
    place(asText(shelf.domain) ?? 'cross-domain').shelves++;
  }
  const ungrouped = place('ungrouped');
  for (const concept of graph.concepts) if (concept.record && !assigned.has(concept.id)) ungrouped.concepts.add(concept.id);
  return [...places.values()].map((row) => row.id === 'ungrouped' ? { ...row, title: 'Not yet grouped' } : row);
}

function chooseDomain(host: AtlasHost, id: string | null): void {
  if (host.state.concept) { host.showConceptOverview(id); return; }
  Object.assign(host.concepts, { domain: id, subdomain: null, selected: null, recentsOnly: false, browseAll: false, visibleLimit: 30 });
  host.query = '';
  host.render();
}

export function renderConceptRail(parent: HTMLElement, host: AtlasHost, graph: AtlasGraph): void {
  const rail = parent.createEl('nav', { cls: 'los-atlas-place-rail', attr: { 'aria-label': 'Browse knowledge domains' } });
  rail.createDiv({ cls: 'los-atlas-group-head los-micro', text: 'Browse' });
  const overview = button(rail, 'All domains', () => chooseDomain(host, null), 'quiet');
  overview.setAttr('aria-pressed', String(!host.concepts.domain && !host.concepts.recentsOnly));
  button(rail, 'Recently visited', () => {
    if (host.state.concept) { host.showConceptOverview(null, false, true); return; }
    Object.assign(host.concepts, { domain: null, subdomain: null, browseAll: false, recentsOnly: true, selected: null });
    host.query = '';
    host.render();
  }, 'quiet');
  rail.createDiv({ cls: 'los-atlas-group-head los-micro', text: 'Domains' });
  for (const place of conceptPlaces(host, graph)) {
    const control = button(rail, place.title, () => chooseDomain(host, place.id), 'quiet');
    control.addClass('los-atlas-place');
    control.setAttrs({ 'data-domain': place.id, 'aria-pressed': String(host.concepts.domain === place.id) });
    control.createSpan({ cls: 'los-micro', text: plural(place.concepts.size, 'concept') });
  }
  enableButtonGroupKeyboardNavigation(rail, 'vertical');
}

export function renderConceptBreadcrumb(parent: HTMLElement, host: AtlasHost): void {
  const crumbs = parent.createEl('nav', { cls: 'los-atlas-breadcrumb', attr: { 'aria-label': 'Concept browse location' } });
  button(crumbs, 'All domains', () => chooseDomain(host, null), 'tertiary');
  if (host.concepts.domain) {
    crumbs.createSpan({ text: ' / ', attr: { 'aria-hidden': 'true' } });
    button(crumbs, host.concepts.domain === 'ungrouped' ? 'Not yet grouped' : label(host.concepts.domain),
      () => chooseDomain(host, host.concepts.domain), 'tertiary');
  }
  if (host.concepts.subdomain) {
    crumbs.createSpan({ text: ` / ${host.concepts.subdomain === 'ungrouped' ? 'Not yet grouped' : label(host.concepts.subdomain)}` });
  }
}

export function renderConceptDomainFilter(parent: HTMLElement, host: AtlasHost, graph: AtlasGraph): void {
  const select = parent.createEl('select', { cls: 'los-atlas-domain-filter', attr: { 'aria-label': 'Browse domain' } });
  select.createEl('option', { text: 'All domains', attr: { value: '' } });
  for (const place of conceptPlaces(host, graph)) select.createEl('option', { text: place.title, attr: { value: place.id } });
  select.value = host.concepts.domain ?? '';
  select.addEventListener('change', () => chooseDomain(host, select.value || null));
}

function conceptRow(parent: HTMLElement, host: AtlasHost, graph: AtlasGraph, id: string, update: () => void, recent = false): void {
  const concept = conceptOf(graph, id);
  const notes = linkedConceptNotes(host.plugin.store, id);
  const row = parent.createDiv({ cls: 'los-atlas-browse-row' });
  row.toggleClass('is-selected', host.concepts.selected === id);
  const preview = button(row, concept.label, () => {
    if (recent) host.go({ concept: id, lens: 'prerequisites' });
    else { host.concepts.selected = id; update(); }
  }, 'quiet');
  preview.addClass('los-atlas-concept-select');
  preview.setAttrs({ 'data-preview-concept': id, 'aria-pressed': String(host.concepts.selected === id), 'data-los-tab': `preview:${id}` });
  preview.createSpan({ cls: 'los-micro', text: plural(notes.length, 'linked note') });
  const open = button(row, 'Map', () => host.go({ concept: id,
    lens: host.state.lens === 'bridges' || host.state.lens === 'diagnostics' ? 'prerequisites' : host.state.lens }), 'tertiary');
  open.addClass('los-atlas-concept-seed');
  open.setAttrs({ 'data-concept-id': id, 'data-linked-note-count': String(notes.length), 'aria-label': `Open map: ${concept.label}` });
}

function previewConcept(parent: HTMLElement, host: AtlasHost, graph: AtlasGraph, id: string): void {
  const view = neighbourhood(graph, id, { depth: 1, includeSemanticNeighbours: false });
  const panel = parent.createEl('aside', { cls: 'los-atlas-concept-preview', attr: { 'aria-label': 'Selected concept preview' } });
  panel.createDiv({ cls: 'los-micro los-atlas-group-head', text: 'Selected concept' });
  panel.createEl('h3', { text: view.focus.label });
  panel.createDiv({ cls: 'los-micro', text: `${plural(linkedConceptNotes(host.plugin.store, id).length, 'linked note')} · ${moduleTrail(graph, id)}` });
  button(panel, 'Open concept map', () => host.go({ concept: id, lens: 'prerequisites' }), 'cta');
  const prerequisites = graph.prerequisiteEdges.get(id) ?? [];
  const dependents = graph.dependentEdges.get(id) ?? [];
  for (const [title, edges, endpoint] of [
    ['Before this', prerequisites, 'prerequisiteId'], ['Builds on this', dependents, 'dependentId'],
  ] as const) {
    panel.createEl('h4', { text: title });
    if (!edges.length) panel.createDiv({ cls: 'los-micro', text: `No authored ${title === 'Before this' ? 'prerequisites' : 'dependents'} recorded.` });
    for (const edge of edges) {
      const target = edge[endpoint];
      if (target) button(panel, conceptOf(graph, target).label, () => host.go({ concept: target, lens: 'prerequisites' }), 'tertiary');
    }
  }
  panel.createDiv({ cls: 'los-micro', text: 'Browse paths follow linked note folders. Authored connections stay complete across domains.' });
}

export function renderConceptBrowser(parent: HTMLElement, host: AtlasHost, graph: AtlasGraph): void {
  const layout = parent.createDiv({ cls: 'los-atlas-browser-layout' });
  renderConceptRail(layout, host, graph);
  const content = layout.createDiv({ cls: 'los-atlas-browser-content' });
  const update = () => host.render();
  renderConceptBreadcrumb(content, host);
  const places = conceptPlaces(host, graph);
  const place = places.find((row) => row.id === host.concepts.domain);
  const query = host.query.trim();
  const recentIds = host.plugin.settings.atlasRecentConcepts.filter((id) => graph.conceptById.get(id)?.record
    && (!host.state.module || (graph.modulesByConcept.get(id) ?? []).includes(host.state.module)));
  const overview = !place && !query && !host.concepts.browseAll && !host.concepts.recentsOnly;
  if (overview) {
    content.createEl('h2', { text: 'Explore by domain' });
    content.createDiv({ cls: 'los-micro', text: 'Browse your knowledge, then explore its connections.' });
    const split = content.createDiv({ cls: 'los-atlas-browser-split' });
    const domains = split.createDiv({ cls: 'los-atlas-browse-panel' });
    for (const domain of places) {
      const choice = button(domains, domain.title, () => chooseDomain(host, domain.id), 'quiet');
      choice.addClass('los-atlas-domain-row');
      choice.setAttr('data-browse-domain', domain.id);
      choice.createSpan({ cls: 'los-micro', text: `${plural(domain.concepts.size, 'concept')} · ${plural(domain.notes, 'note')} · ${plural(domain.shelves, 'source shelf', 'source shelves')}` });
    }
    const recents = split.createDiv({ cls: 'los-atlas-browse-panel' });
    recents.createEl('h3', { text: 'Recently visited' });
    if (!recentIds.length) recents.createDiv({ cls: 'los-micro', text: 'No concepts visited yet. Search above or browse all concepts.' });
    for (const id of recentIds.slice(0, 4)) conceptRow(recents, host, graph, id, update, true);
    button(recents, `Browse all ${graph.concepts.filter((concept) => concept.record).length} concepts`, () => {
      host.concepts.browseAll = true; host.concepts.visibleLimit = 30; host.render();
    }, 'quiet')
      .addClass('los-atlas-browse-all');
    return;
  }
  // Nested published note folders provide browse subdomains. Unfiled paths are
  // explicit; no concept is assigned from a title, module name or graph neighbour.
  const nested = place && [...place.folders.keys()].filter((id) => id !== 'ungrouped');
  if (place && nested && nested.length && !query && !host.concepts.browseAll && !host.concepts.subdomain) {
    content.createEl('h2', { text: place.title });
    content.createDiv({ cls: 'los-micro', text: 'Subdomains from linked note folders. A concept can appear in more than one place.' });
    const list = content.createDiv({ cls: 'los-atlas-browse-panel' });
    for (const [id, ids] of place.folders) {
      button(list, `${id === 'ungrouped' ? 'Not yet grouped' : label(id)} · ${plural(ids.size, 'concept')}`, () => {
        host.concepts.subdomain = id; host.concepts.selected = null; host.render();
      }, 'quiet').addClass('los-atlas-subdomain');
    }
    button(list, `All concepts in ${place.title}`, () => { host.concepts.browseAll = true; host.render(); }, 'quiet');
    return;
  }
  const heading = query ? 'Concept results' : host.concepts.recentsOnly ? 'Recently visited'
    : host.concepts.subdomain ? label(host.concepts.subdomain) : place?.title ?? 'Browse concepts';
  content.createEl('h2', { text: heading });
  const related = content.createDiv({ cls: 'los-actions los-atlas-browser-related' });
  if (place && place.id !== 'ungrouped') for (const [collection, title] of [['notes', 'Notes'], ['shelves', 'Source shelves']] as const) {
    button(related, title, () => {
      host.domains.selected = place.id; host.domains.collection = collection;
      host.go({ concept: null, lens: 'domains' });
    }, 'quiet');
  }
  const searched = query ? new Set(host.plugin.store.search(query, ['concept']).map((record) => asText(record.id))) : null;
  const folder = host.concepts.subdomain ? place?.folders.get(host.concepts.subdomain) : null;
  let ids = graph.concepts.filter((concept) => concept.record && (!searched || searched.has(concept.id))
    && (!place || place.concepts.has(concept.id)) && (!folder || folder.has(concept.id))
    && (!host.state.module || (graph.modulesByConcept.get(concept.id) ?? []).includes(host.state.module))
    && (!host.concepts.recentsOnly || recentIds.includes(concept.id))).map((concept) => concept.id);
  ids = host.concepts.recentsOnly ? recentIds.filter((id) => ids.includes(id)) : ids.sort((a, b) => compareStrings(conceptOf(graph, a).label, conceptOf(graph, b).label) || compareStrings(a, b));
  const shown = Math.min(host.concepts.visibleLimit, ids.length);
  content.createDiv({ cls: 'los-micro los-atlas-browser-scope', attr: { role: 'status' }, text: `${shown} of ${plural(ids.length, 'concept')} shown${host.state.module ? ' in this module' : ''}` });
  const split = content.createDiv({ cls: 'los-atlas-browser-split' });
  const list = split.createDiv({ cls: 'los-atlas-browse-panel los-atlas-records', attr: { role: 'group', 'aria-label': 'Concept results',
    'data-los-scroll': `concepts:${place?.id ?? ''}:${host.concepts.subdomain ?? ''}:${query}:${host.state.module ?? ''}` } });
  enableButtonGroupKeyboardNavigation(list, 'vertical');
  if (!ids.length) list.createDiv({ cls: 'los-atlas-absence', text: query ? `Nothing matches “${query}” in this scope. Try another concept, domain or module.` : 'No explicitly linked concepts in this area yet. Browse all concepts or Not yet grouped.' });
  for (const id of ids.slice(0, shown)) conceptRow(list, host, graph, id, update);
  if (shown < ids.length) button(list, `Show more · ${ids.length - shown} remaining`, () => { host.concepts.visibleLimit += 30; host.render(); }, 'quiet').addClass('los-atlas-show-more');
  const selected = host.concepts.selected;
  if (selected && ids.includes(selected)) previewConcept(split, host, graph, selected);
  else {
    const preview = split.createDiv({ cls: 'los-atlas-concept-preview' });
    preview.createEl('h3', { text: 'Choose a concept' });
    preview.createDiv({ cls: 'los-micro', text: 'Select a title to preview its connections, or Map to explore it.' });
  }
  button(content, 'Close browser', () => chooseDomain(host, null), 'quiet');
}
