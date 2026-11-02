import { button, disclosure, icon } from '../../components';
import { enableButtonGroupKeyboardNavigation } from '../../accessibility/button-group';
import { buildConceptContext, linkedConceptNotes } from '../../features/atlas/context';
import { renderAtlasVariants } from '../../features/atlas/domains';
import { readResumePointer } from '../../features/home/model';
import { mountEdges } from '../../features/atlas/edge-layer';
import { renderOutline, renderPath } from '../../features/atlas/focused-graph';
import { buildAtlasGraph, conceptOf, modulesFor, neighbourhood, relationPhrase, strictPath, type AtlasEdge, type AtlasGraph } from '../../features/atlas/graph';
import { renderInspector } from '../../features/atlas/inspector';
import { newDraft, renderRelationEditor } from '../../features/atlas/relation-editor';
import type { AtlasHost } from '../../features/atlas/ports';
import { asLabel, asString, asStrings } from '../../projection/readers';
import { compareStrings } from '../../sorting';
import type { AtlasScreenHost } from '../screens';
import { buildConceptMap, moduleOverlap, overlapKey, studyOrderLayout, UNGROUPED, type ConceptMap, type Region } from './atlas-model';
import { chevron, deskHead, deskPage, deskRow, moduleShort, sideGroup, textLink, unitLabel, type Cover } from './parts';

/** Each region's place on the map, from Figma frame E1, as percentages of the canvas. */
const REGION_PLACES: Readonly<Record<string, { x: number; y: number; w: number; h: number; cover: Cover; designed: number }>> = {
  'cross-domain': { x: 29, y: 1, w: 22, h: 23, cover: 'stone', designed: 10 },
  programming: { x: 75, y: 1, w: 20, h: 16, cover: 'moss', designed: 4 },
  mathematics: { x: 1, y: 21, w: 26, h: 34, cover: 'teal', designed: 23 },
  'machine-learning': { x: 32, y: 29, w: 37, h: 48, cover: 'wine', designed: 36 },
  systems: { x: 73, y: 25, w: 22, h: 28, cover: 'plum', designed: 11 },
  algorithms: { x: 1, y: 63, w: 26, h: 34, cover: 'ochre', designed: 23 },
  'data-systems': { x: 73, y: 62, w: 22, h: 26, cover: 'slate', designed: 12 },
};

const plural = (amount: number, noun: string) => `${amount} ${noun}${amount === 1 ? '' : 's'}`;
const shortModule = (host: AtlasHost, id: string) => moduleShort(host.plugin.store.get(id));
const shortModules = (host: AtlasHost, graph: AtlasGraph, concept: string) =>
  modulesFor(graph, concept).map((module) => shortModule(host, module.id));
const coverFor = (id: string): Cover => REGION_PLACES[id]?.cover ?? 'stone';

interface AtlasContext {
  readonly host: AtlasScreenHost;
  readonly graph: AtlasGraph;
  readonly map: ConceptMap;
}

/** The subject of the session you last stopped in, if Core recorded one. */
function studyConcept(host: AtlasHost): { id: string; facts: string } | null {
  const { store } = host.plugin;
  const pointer = readResumePointer(store.data?.resume_pointer);
  const stage = pointer.stage_id ? store.stage(pointer.stage_id) : null;
  const id = asStrings(stage?.concepts)[0];
  if (!stage || !id || !store.get(id)) return null;
  const unit = pointer.unit_id ? store.get(pointer.unit_id) : null;
  const module = pointer.module_id ? store.get(pointer.module_id) : null;
  return { id, facts: [unit ? unitLabel(unit, module).place : '', asLabel(stage)].filter(Boolean).join(' · ') };
}

function chooseRegion(host: AtlasHost, id: string | null): void {
  if (host.state.concept || host.state.lens !== 'prerequisites') { host.showConceptOverview(id); return; }
  Object.assign(host.concepts, { domain: id, subdomain: null, selected: null, recentsOnly: false, browseAll: false, visibleLimit: 30 });
  host.query = '';
  host.render();
}

function focus(host: AtlasHost, id: string): void {
  host.go({ concept: id, lens: 'prerequisites' });
}

/** Search stays in place while typing: only its results redraw, so the caret never jumps. */
function renderSearch(parent: HTMLElement, host: AtlasHost, placeholder: string): void {
  const wrap = parent.createDiv({ cls: 'sd-atlas-search' });
  const field = wrap.createEl('label', { cls: 'sd-search' });
  icon(field.createSpan({ cls: 'sd-search-glyph' }), 'search');
  const input = field.createEl('input', {
    cls: 'sd-search-input',
    attr: { type: 'search', placeholder, 'aria-label': placeholder },
  });
  input.value = host.query;
  const results = wrap.createDiv({ cls: 'sd-search-results', attr: { 'aria-live': 'polite' } });
  const draw = () => {
    results.empty();
    const query = host.query.trim();
    if (!query) return;
    const rows = host.plugin.store.search(query, ['concept']).slice(0, 8);
    if (!rows.length) results.createDiv({ cls: 'sd-row-facts sd-search-none', text: `No concept matches “${query}”.` });
    for (const record of rows) {
      const id = asString(record.id);
      if (id) deskRow(results, 'sd-search-row', `Open ${asLabel(record)}`, () => { host.query = ''; focus(host, id); })
        .createSpan({ text: asLabel(record) });
    }
  };
  input.addEventListener('input', () => { host.query = input.value; draw(); });
  draw();
}

function pageHead(parent: HTMLElement, title: string, facts: string | null): HTMLElement {
  const head = parent.createDiv({ cls: 'sd-title-row' });
  const copy = head.createDiv({ cls: 'sd-title-copy' });
  copy.createEl('h1', { cls: 'sd-title', text: title });
  if (facts) copy.createDiv({ cls: 'sd-facts', text: facts });
  return head.createDiv({ cls: 'sd-title-tools' });
}

function concretePlace(id: string, count: number) {
  const place = REGION_PLACES[id];
  if (!place) return null;
  // Size follows the concept count, within a range that keeps the layout's gaps.
  const scale = Math.min(1.12, Math.max(0.82, Math.sqrt(Math.max(count, 1) / place.designed)));
  const w = place.w * scale, h = place.h * scale;
  return { x: place.x + (place.w - w) / 2, y: place.y + (place.h - h) / 2, w, h };
}

type Box = { x: number; y: number; w: number; h: number };

/** Where the line between two boxes crosses open paper, so its count never sits on a title. */
function gapMidpoint(a: Box, b: Box): { x: number; y: number } {
  const from = { x: a.x + a.w / 2, y: a.y + a.h / 2 }, to = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const exit = (box: Box) => {
    const scale = Math.min(
      Math.abs(to.x - from.x) ? (box.w / 2) / Math.abs(to.x - from.x) : Infinity,
      Math.abs(to.y - from.y) ? (box.h / 2) / Math.abs(to.y - from.y) : Infinity,
    );
    return scale;
  };
  const start = exit(a), end = 1 - exit(b);
  const middle = start < end ? (start + end) / 2 : 0.5;
  return { x: from.x + (to.x - from.x) * middle, y: from.y + (to.y - from.y) * middle };
}

function renderMiniMap(parent: HTMLElement, map: ConceptMap, here: string | null): void {
  const mini = parent.createDiv({ cls: 'sd-minimap', attr: { 'aria-hidden': 'true' } });
  for (const region of map.regions) {
    const place = concretePlace(region.id, region.concepts.length);
    if (!place) continue;
    mini.createDiv({
      cls: `sd-minimap-region${region.id === here ? ' is-here' : ''}`,
      attr: {
        'data-cover': coverFor(region.id),
        style: `left:${place.x}%;top:${place.y}%;width:${place.w}%;height:${place.h}%`,
      },
    });
  }
}

/* ─────────────────────────────── E1 · the map ───────────────────────────── */

function renderViewTabs(parent: HTMLElement, host: AtlasHost, active: 'map' | 'list' | 'bridges'): void {
  const tabs = parent.createDiv({ cls: 'los-filter-tabs', attr: { role: 'group', 'aria-label': 'How to see these concepts' } });
  enableButtonGroupKeyboardNavigation(tabs);
  const tab = (key: typeof active, label: string, choose: () => unknown) => {
    const control = button(tabs, label, () => { if (key !== active) choose(); }, 'quiet');
    control.addClass('los-filter-tab');
    control.toggleClass('is-active', key === active);
    control.setAttr('aria-pressed', String(key === active));
  };
  const toList = (browseAll: boolean) => {
    if (host.state.lens !== 'prerequisites') { host.showConceptOverview(null, browseAll); return; }
    Object.assign(host.concepts, { browseAll, domain: null, visibleLimit: 30 });
    host.render();
  };
  tab('map', 'Map', () => toList(false));
  tab('list', 'List', () => toList(true));
  tab('bridges', 'Across modules', () => host.go({ concept: null, lens: 'bridges' }));
}

function renderAtlasIntro(root: HTMLElement, host: AtlasHost): HTMLElement {
  const tools = pageHead(root, 'Atlas', null);
  renderAtlasVariants(tools, host.plugin.nav, 'concepts', (target) => host.go(target));
  renderSearch(tools, host, 'Find a concept, e.g. logistic regression');
  return tools;
}

function renderSideColumn(parent: HTMLElement, context: AtlasContext): void {
  const { host, graph } = context;
  const side = parent.createDiv({ cls: 'sd-side' });
  const study = studyConcept(host);
  if (study) {
    const group = sideGroup(side, 'From your study');
    const row = deskRow(group, 'sd-side-row', `Open ${conceptOf(graph, study.id).label}`, () => focus(host, study.id));
    row.createEl('strong', { text: conceptOf(graph, study.id).label });
    row.createDiv({ cls: 'sd-row-facts', text: study.facts });
  }
  const recent = host.plugin.settings.atlasRecentConcepts.filter((id) => graph.conceptById.get(id)?.record).slice(0, 3);
  if (recent.length) {
    const group = sideGroup(side, 'Recent');
    for (const id of recent) deskRow(group, 'sd-side-row', `Open ${conceptOf(graph, id).label}`, () => focus(host, id)).createEl('strong', { text: conceptOf(graph, id).label });
  }
  const ask = sideGroup(side, 'Ask the Atlas');
  const question = (title: string, detail: string, go: () => unknown) => {
    const row = deskRow(ask, 'sd-side-row', title, go);
    row.createEl('strong', { text: title });
    row.createDiv({ cls: 'sd-row-facts', text: detail });
  };
  const overlap = [...graph.modulesByConcept.values()].filter((modules) => modules.length > 1).length;
  const touched = new Set(graph.edges.flatMap((edge) => [edge.from, edge.to]));
  const concepts = graph.concepts.filter((concept) => concept.record);
  question('What must I know first?', 'Open a concept, then Path to it', () => {
    if (host.state.lens !== 'prerequisites') { host.showConceptOverview(null, true); return; }
    Object.assign(host.concepts, { browseAll: true, domain: null, visibleLimit: 30 });
    host.render();
  });
  question('Where do modules overlap?', `${plural(overlap, 'concept')} in two or more`, () => host.go({ concept: null, lens: 'bridges' }));
  question('What has no links yet?', `${concepts.filter((concept) => !touched.has(concept.id)).length} of ${concepts.length} concepts`, () => host.go({ concept: null, lens: 'diagnostics' }));
  question('Which records need care?', 'Open Diagnostics', () => host.plugin.nav.openDiagnostics());
}

function renderMap(root: HTMLElement, context: AtlasContext): void {
  const { host, graph, map } = context;
  renderAtlasIntro(root, host);
  const layout = root.createDiv({ cls: 'sd-atlas-layout' });
  const sheet = layout.createDiv({ cls: 'sd-sheet sd-map-sheet' });
  renderViewTabs(sheet, host, 'map');

  const study = studyConcept(host);
  const degree = (id: string) => graph.edges.filter((edge) => edge.from === id || edge.to === id).length;
  const canvas = sheet.createDiv({ cls: 'sd-map-canvas', attr: { role: 'group', 'aria-label': 'Regions of your knowledge' } });
  const placed = map.regions.filter((region) => REGION_PLACES[region.id]);
  const centre = (region: Region) => {
    const place = concretePlace(region.id, region.concepts.length)!;
    return { x: place.x + place.w / 2, y: place.y + place.h / 2 };
  };
  const doc = canvas.ownerDocument;
  if (doc?.createElementNS) {
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'sd-map-lines');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    for (const link of map.links) {
      const a = placed.find((region) => region.id === link.a), b = placed.find((region) => region.id === link.b);
      if (!a || !b) continue;
      const from = centre(a), to = centre(b);
      const line = doc.createElementNS('http://www.w3.org/2000/svg', 'line');
      for (const [key, value] of Object.entries({ x1: from.x, y1: from.y, x2: to.x, y2: to.y })) line.setAttribute(key, String(value));
      svg.append(line);
    }
    canvas.append(svg);
  }
  for (const region of placed) {
    const place = concretePlace(region.id, region.concepts.length)!;
    const card = canvas.createDiv({
      cls: `sd-region${region.concepts.length ? '' : ' is-empty'}`,
      attr: {
        'data-cover': coverFor(region.id),
        'data-region': region.id,
        style: `left:${place.x}%;top:${place.y}%;width:${place.w}%;height:${place.h}%`,
      },
    });
    const open = card.createEl('button', { cls: 'sd-region-head is-clickable', attr: { type: 'button', 'aria-label': `Open region: ${region.title}, ${plural(region.concepts.length, 'concept')}` } });
    open.createEl('strong', { cls: 'sd-heading', text: region.title });
    open.createDiv({ cls: 'sd-row-facts', text: region.linked ? `${plural(region.concepts.length, 'concept')}, ${region.linked} linked` : `${plural(region.concepts.length, 'concept')}, no links yet` });
    open.addEventListener('click', () => chooseRegion(host, region.id));
    const chips = card.createDiv({ cls: 'sd-region-chips' });
    const top = [...region.concepts].filter((id) => degree(id) > 0 && id !== study?.id)
      .sort((a, b) => degree(b) - degree(a) || compareStrings(a, b)).slice(0, region.id === 'machine-learning' ? 3 : 2);
    for (const id of top) button(chips, conceptOf(graph, id).label, () => focus(host, id), 'quiet').addClass('sd-chip-button');
    if (study && region.concepts.includes(study.id)) {
      const here = button(chips, `You are here: ${conceptOf(graph, study.id).label}`, () => focus(host, study.id), 'quiet');
      here.addClass('sd-chip-button');
      here.addClass('is-here');
    }
  }
  for (const link of map.links) {
    const a = placed.find((region) => region.id === link.a), b = placed.find((region) => region.id === link.b);
    if (!a || !b) continue;
    const spot = gapMidpoint(concretePlace(a.id, a.concepts.length)!, concretePlace(b.id, b.concepts.length)!);
    canvas.createDiv({
      cls: 'sd-map-badge',
      text: plural(link.count, 'link'),
      attr: { style: `left:${spot.x}%;top:${spot.y}%` },
    });
  }
  const other = map.regions.filter((region) => !REGION_PLACES[region.id] && region.concepts.length);
  if (other.length) {
    const rest = sheet.createDiv({ cls: 'sd-map-rest' });
    for (const region of other) {
      const row = deskRow(rest, 'sd-ungrouped', `Open ${region.title}`, () => chooseRegion(host, region.id));
      row.createEl('strong', { text: region.title });
      row.createSpan({ cls: 'sd-row-facts', text: region.id === UNGROUPED ? `${plural(region.concepts.length, 'concept')}, no linked note` : plural(region.concepts.length, 'concept') });
      chevron(row);
    }
  }
  sheet.createDiv({ cls: 'sd-row-facts sd-map-foot', text: 'Size shows how many concepts. Lines count authored links between regions. A concept is placed where most of its notes live, and it can have notes in more than one region. Nothing here measures what you know.' });
  renderSideColumn(layout, context);
}

/* ────────────────────────── E2 · one region, in study order ─────────────── */

function renderRegion(root: HTMLElement, context: AtlasContext, region: Region): void {
  const { host, graph, map } = context;
  const tools = pageHead(root, region.title, `${plural(region.concepts.length, 'concept')}. Read left to right: what you need first, then what it leads to.`);
  renderSearch(tools, host, 'Find in this region');
  const layout = root.createDiv({ cls: 'sd-atlas-layout is-wide' });
  const sheet = layout.createDiv({ cls: 'sd-sheet sd-region-sheet' });
  const order = studyOrderLayout(region.concepts, graph);
  if (!order.placed.length) {
    sheet.createDiv({ cls: 'sd-empty-state', text: 'No preparation links are recorded in this region yet. That is a gap in the records, not a verdict on the ideas.' });
  } else {
    sheet.createDiv({ cls: 'sd-row-facts', text: 'Arrow: study order. Pale: from another region.' });
    const scroll = sheet.createDiv({ cls: 'sd-order-scroll' });
    const canvas = scroll.createDiv({ cls: 'sd-order-canvas', attr: { style: `--sd-columns:${order.columns}` } });
    const labels = canvas.createDiv({ cls: 'sd-order-labels' });
    for (let column = 0; column < order.columns; column += 1) {
      labels.createDiv({
        cls: 'sd-eyebrow',
        text: column === order.beyond ? 'Beyond this region' : column === 0 ? 'First' : column === 1 ? 'Then' : column === 2 ? 'Leads to' : 'After that',
      });
    }
    const grid = canvas.createDiv({ cls: 'sd-order-grid', attr: { role: 'group', 'aria-label': 'Concepts in study order' } });
    enableButtonGroupKeyboardNavigation(grid, 'vertical');
    const selected = host.concepts.selected;
    for (const node of order.placed) {
      const control = grid.createEl('button', {
        cls: `sd-node is-clickable${node.visiting ? ' is-visiting' : ''}${node.id === selected ? ' is-selected' : ''}`,
        text: conceptOf(graph, node.id).label,
        attr: {
          type: 'button',
          'data-atlas-concept': node.id,
          'aria-pressed': String(node.id === selected),
          style: `grid-column:${node.column + 1};grid-row:${node.row + 1}`,
        },
      });
      control.addEventListener('click', () => { host.concepts.selected = node.id; host.render(); });
    }
    mountEdges(canvas, host, graph, order.edges, (edge) => edge.studyFrom === selected || edge.studyTo === selected);
  }
  if (order.unlinked.length) {
    const rest = sheet.createDiv({ cls: 'sd-unlinked' });
    rest.createEl('strong', { text: `${order.unlinked.length} ${order.placed.length ? 'more ' : ''}in this region ${order.unlinked.length === 1 ? 'has' : 'have'} no preparation links` });
    const names = rest.createDiv({ cls: 'sd-unlinked-names' });
    for (const id of order.unlinked) textLink(names, conceptOf(graph, id).label, () => focus(host, id));
  }
  renderRegionSide(layout, context, region, map);
}

function renderRegionSide(layout: HTMLElement, context: AtlasContext, region: Region, map: ConceptMap): void {
  const { host, graph } = context;
  const side = layout.createDiv({ cls: 'sd-sheet sd-region-side' });
  const id = host.concepts.selected;
  if (id && graph.conceptById.get(id)) {
    const before = (graph.prerequisiteEdges.get(id) ?? []).length;
    const after = (graph.dependentEdges.get(id) ?? []).length;
    const related = (graph.semanticEdges.get(id) ?? []).length;
    side.createEl('h2', { cls: 'sd-heading', text: conceptOf(graph, id).label });
    side.createEl('p', { cls: 'sd-note', text: [
      before ? `Needs ${plural(before, 'concept')} first.` : 'Nothing recorded comes first.',
      after ? `${plural(after, 'concept')} build${after === 1 ? 's' : ''} on it.` : 'Nothing recorded builds on it yet.',
      related ? `${plural(related, 'related link')}.` : '',
    ].filter(Boolean).join(' ') });
    button(side, 'Focus on this', () => focus(host, id), 'cta');
    const known = buildConceptContext(host.plugin.store, id);
    side.createDiv({ cls: 'sd-row-facts', text: `${plural(known.notes.length, 'note')} · ${plural(known.sources.length, 'source')}` });
  } else {
    side.createEl('h2', { cls: 'sd-heading', text: 'Choose a concept' });
    side.createEl('p', { cls: 'sd-note', text: 'Select one to see what it needs and what builds on it.' });
  }
  const where = side.createDiv({ cls: 'sd-where' });
  where.createDiv({ cls: 'sd-eyebrow', text: 'Where you are' });
  renderMiniMap(where, map, region.id);
}

/* ───────────────────────────── E3 · one concept ─────────────────────────── */

function regionCrumb(context: AtlasContext, id: string) {
  const { host, map } = context;
  const regionId = map.regionOf.get(id);
  const region = map.regions.find((row) => row.id === regionId);
  return region ? { label: region.title, go: () => host.showConceptOverview(region.id) } : null;
}

function conceptCard(parent: HTMLElement, context: AtlasContext, edge: AtlasEdge, id: string, focusId: string): void {
  const { host, graph, map } = context;
  const card = parent.createEl('button', {
    cls: 'sd-node sd-focus-node is-clickable',
    attr: { type: 'button', 'data-atlas-concept': id, 'aria-label': `${relationPhrase(edge.type)}: ${conceptOf(graph, id).label}` },
  });
  card.createEl('strong', { text: conceptOf(graph, id).label });
  const modules = shortModules(host, graph, id).join(' · ');
  const elsewhere = map.regionOf.get(id) !== map.regionOf.get(focusId)
    ? map.regions.find((region) => region.id === map.regionOf.get(id))?.title : null;
  const facts = [relationPhrase(edge.type), modules, elsewhere ? `from ${elsewhere}` : ''].filter(Boolean).join(' · ');
  if (facts) card.createDiv({ cls: 'sd-node-meta', text: facts });
  card.addEventListener('click', () => focus(host, id));
}

function renderConcept(root: HTMLElement, context: AtlasContext, id: string): void {
  const { host, graph } = context;
  const concept = conceptOf(graph, id);
  const aliases = asStrings(concept.record?.aliases);
  const modules = shortModules(host, graph, id).join(', ');
  const tools = pageHead(root, concept.label, [aliases.length ? `Also called ${aliases.join(', ')}` : '', modules].filter(Boolean).join(' · ') || null);
  const tabs = tools.createDiv({ cls: 'los-filter-tabs', attr: { role: 'group', 'aria-label': 'What to see about this concept' } });
  enableButtonGroupKeyboardNavigation(tabs);
  const lens = host.state.lens === 'path' ? 'path' : 'connections';
  for (const [key, label] of [['connections', 'Connections'], ['path', 'Path to it']] as const) {
    const control = button(tabs, label, () => { if (key !== lens) host.go({ lens: key === 'path' ? 'path' : 'prerequisites' }); }, 'quiet');
    control.addClass('los-filter-tab');
    control.toggleClass('is-active', key === lens);
    control.setAttr('aria-pressed', String(key === lens));
  }
  renderSearch(tools, host, 'Find a concept');
  if (lens === 'path') renderRoute(root, context, id);
  else renderConnections(root, context, id);
}

function renderConnections(root: HTMLElement, context: AtlasContext, id: string): void {
  const { host, graph } = context;
  const before = graph.prerequisiteEdges.get(id) ?? [];
  const after = graph.dependentEdges.get(id) ?? [];
  const semantic = graph.semanticEdges.get(id) ?? [];
  const layout = root.createDiv({ cls: 'sd-atlas-layout is-wide' });
  const sheet = layout.createDiv({ cls: 'sd-sheet sd-concept-sheet' });
  if (!before.length && !after.length && !semantic.length) {
    const gap = sheet.createDiv({ cls: 'sd-empty-state' });
    gap.createEl('h2', { cls: 'sd-heading', text: 'No links recorded for this concept' });
    gap.createEl('p', { cls: 'sd-reading', text: 'That is a gap in your records, not a verdict on the idea. Its notes and sources are still here, and you can connect it to something you know.' });
    textLink(gap, 'Connect this concept', () => { host.editor = newDraft(id); host.render(); });
  } else {
    const canvas = sheet.createDiv({ cls: 'sd-focus-canvas' });
    const lane = (title: string) => {
      const column = canvas.createDiv({ cls: 'sd-focus-lane' });
      column.createDiv({ cls: 'sd-eyebrow', text: title });
      return column;
    };
    const first = lane('You need first');
    for (const edge of before) if (edge.prerequisiteId) conceptCard(first, context, edge, edge.prerequisiteId, id);
    if (!before.length) first.createDiv({ cls: 'sd-node-gap', text: 'Nothing recorded comes before this.' });
    const middle = lane('This concept');
    const self = middle.createDiv({ cls: 'sd-node sd-focus-node is-selected', attr: { 'data-atlas-concept': id } });
    self.createEl('strong', { text: conceptOf(graph, id).label });
    const leads = lane('Leads to');
    for (const edge of after) if (edge.dependentId) conceptCard(leads, context, edge, edge.dependentId, id);
    if (!after.length) {
      const gap = leads.createDiv({ cls: 'sd-node-gap' });
      gap.createEl('strong', { text: 'Nothing recorded builds on this yet.' });
      gap.createDiv({ text: 'That is the state of the notes, not a claim about the idea.' });
    }
    mountEdges(canvas, host, graph, [...before, ...after]);

    const related = sheet.createDiv({ cls: 'sd-related' });
    const head = related.createDiv({ cls: 'sd-section-title' });
    head.createEl('h2', { cls: 'sd-heading', text: 'Related, not an order' });
    head.createSpan({ cls: 'sd-row-facts', text: 'These never change what comes first.' });
    if (!semantic.length) related.createEl('p', { cls: 'sd-quiet', text: 'No related ideas are recorded.' });
    for (const edge of semantic) {
      const other = edge.from === id ? edge.to : edge.from;
      const row = deskRow(related, 'sd-related-row', `Open ${conceptOf(graph, other).label}`, () => focus(host, other));
      row.createSpan({ cls: 'sd-related-kind', text: relationPhrase(edge.type) });
      const copy = row.createDiv({ cls: 'sd-row-copy' });
      copy.createEl('strong', { text: conceptOf(graph, other).label });
      copy.createDiv({ cls: 'sd-note', text: edge.context ?? 'Authored without a rationale.' });
      chevron(row);
    }
  }
  if (host.editor) renderRelationEditor(sheet, host, graph, host.editor);
  const foot = sheet.createDiv({ cls: 'sd-focus-foot' });
  const back = button(foot, 'Back', () => host.conceptBack(), 'tertiary');
  back.disabled = !host.canConceptBack;
  back.setAttrs({ 'aria-label': 'Back to previous concept', 'data-los-tab': 'concept-back' });
  const forward = button(foot, 'Forward', () => host.conceptForward(), 'tertiary');
  forward.disabled = !host.canConceptForward;
  forward.setAttrs({ 'aria-label': 'Forward to next concept', 'data-los-tab': 'concept-forward' });
  renderConceptSide(layout, context, id);
}

function renderConceptSide(layout: HTMLElement, context: AtlasContext, id: string): void {
  const { host, graph, map } = context;
  const { store, nav } = host.plugin;
  const side = layout.createDiv({ cls: 'sd-sheet sd-concept-side' });
  const known = buildConceptContext(store, id);
  const reference = known.notes.find((note) => asString(note.role) === 'reference') ?? null;
  if (reference) button(side, 'Open the reference', () => nav.openRecord(reference), 'cta');
  const list = (title: string, rows: readonly { label: string; open: () => unknown }[], visible = 3) => {
    const group = sideGroup(side, `${title} · ${rows.length}`);
    if (!rows.length) group.createEl('p', { cls: 'sd-row-facts', text: 'None recorded.' });
    for (const row of rows.slice(0, visible)) textLink(group, row.label, row.open).addClass('sd-link-quiet');
    if (rows.length > visible) {
      const more = group.createEl('details', { cls: 'sd-all' });
      more.createEl('summary', { cls: 'sd-link-summary', text: `All ${rows.length}` });
      for (const row of rows.slice(visible)) textLink(more, row.label, row.open).addClass('sd-link-quiet');
    }
  };
  const units = store.of('unit').filter((unit) => {
    const map = asString(unit.id) ? store.mapForUnit(asString(unit.id)!) : null;
    return (Array.isArray(map?.stages) ? map!.stages as Array<Record<string, unknown>> : [])
      .some((stage) => asStrings(stage.concepts).includes(id));
  });
  list('Where you meet it', units.map((unit) => ({
    label: unitLabel(unit, store.get(asString(unit.module_id) ?? '')).title,
    open: () => nav.openUnit(asString(unit.id) ?? ''),
  })));
  list('Notes', known.notes.map((note) => ({ label: asLabel(note), open: () => nav.openRecord(note) })));
  list('Sources', known.sources.map((source) => ({ label: asLabel(source), open: () => nav.openSourceDetail(asString(source.id) ?? '') })));

  const where = side.createDiv({ cls: 'sd-where' });
  where.createDiv({ cls: 'sd-eyebrow', text: 'Where you are' });
  renderMiniMap(where, map, map.regionOf.get(id) ?? null);

  const view = neighbourhood(graph, id, { depth: host.state.depth, includeSemanticNeighbours: true });
  renderInspector(disclosure(side, 'Where each link comes from, and questions', 'sd-side-disclosure'), host, graph, view);
  renderOutline(disclosure(side, 'Full text outline', 'sd-side-disclosure'), host, graph, view);
  if (!host.editor) textLink(side, 'Connect this concept', () => { host.editor = newDraft(id); host.render(); });
}

/* ────────────────────────── E4 · the route to a concept ─────────────────── */

function renderRoute(root: HTMLElement, context: AtlasContext, id: string): void {
  const { host, graph, map } = context;
  const { store } = host.plugin;
  const path = strictPath(graph, id);
  if (!path.ok) {
    // The classic path view is the one that names the cycle.
    renderPath(root.createDiv({ cls: 'sd-sheet' }), host, graph, id);
    return;
  }
  const stops = path.layers.flat();
  const line = root.createDiv({ cls: 'sd-sheet sd-route-line' });
  const track = line.createDiv({ cls: 'sd-route-track', attr: { role: 'list', 'aria-label': `The route to ${conceptOf(graph, id).label}` } });
  stops.forEach((stop) => {
    const item = track.createDiv({ cls: `sd-route-point${stop.id === id ? ' is-end' : ''}`, attr: { role: 'listitem' } });
    item.createSpan({ cls: 'sd-route-dot', attr: { 'aria-hidden': 'true' } });
    const open = item.createEl('button', { cls: 'sd-route-name is-clickable', text: stop.label, attr: { type: 'button' } });
    open.addEventListener('click', () => host.go({ concept: stop.id, lens: 'path' }));
    const notes = linkedConceptNotes(store, stop.id).length;
    item.createDiv({ cls: 'sd-row-facts', text: [plural(notes, 'note'), shortModules(host, graph, stop.id).join(', ')].filter(Boolean).join(' · ') });
  });
  const layout = root.createDiv({ cls: 'sd-atlas-layout is-wide' });
  const sheet = layout.createDiv({ cls: 'sd-sheet' });
  sheet.createEl('h2', { cls: 'sd-heading', text: 'Where to study each stop' });
  if (stops.length === 1) sheet.createEl('p', { cls: 'sd-quiet', text: 'Nothing is recorded as coming before this concept, so the route is this one stop.' });
  for (const stop of stops) {
    const row = deskRow(sheet, 'sd-study-row', `Open ${stop.label}`, () => focus(host, stop.id));
    row.createEl('strong', { text: stop.label });
    const units = store.of('unit').filter((unit) => {
      const unitMap = asString(unit.id) ? store.mapForUnit(asString(unit.id)!) : null;
      return (Array.isArray(unitMap?.stages) ? unitMap!.stages as Array<Record<string, unknown>> : [])
        .some((stage) => asStrings(stage.concepts).includes(stop.id));
    });
    row.createSpan({ cls: 'sd-row-next', text: units.slice(0, 2).map((unit) => {
      const module = store.get(asString(unit.module_id) ?? '');
      return unitLabel(unit, module).place;
    }).join(' · ') || 'No stage names it yet' });
    chevron(row);
  }
  const side = layout.createDiv({ cls: 'sd-sheet sd-concept-side' });
  side.createEl('h2', { cls: 'sd-heading', text: 'About this route' });
  side.createEl('p', { cls: 'sd-note', text: 'This is the order your notes record. It shows what prepares what. It does not know what you have already understood.' });
  side.createEl('p', { cls: 'sd-note', text: 'Links that say “related” or “contrasts with” never join a route.' });
  renderMiniMap(side, map, map.regionOf.get(id) ?? null);
  button(side, `Open ${conceptOf(graph, id).label}`, () => focus(host, id), 'cta');
}

/* ────────────────────────── E7 · the full list ─────────────────────────── */

function renderList(root: HTMLElement, context: AtlasContext): void {
  const { host, graph, map } = context;
  renderAtlasIntro(root, host);
  const layout = root.createDiv({ cls: 'sd-atlas-layout' });
  const sheet = layout.createDiv({ cls: 'sd-sheet' });
  renderViewTabs(sheet, host, 'list');
  const rows = graph.concepts.filter((concept) => concept.record);
  const shown = rows.slice(0, host.concepts.visibleLimit);
  sheet.createDiv({ cls: 'sd-row-facts', attr: { role: 'status' }, text: `${shown.length} of ${plural(rows.length, 'concept')}, in title order` });
  const list = sheet.createDiv({ cls: 'sd-concept-list', attr: { role: 'group', 'aria-label': 'Concepts' } });
  enableButtonGroupKeyboardNavigation(list, 'vertical');
  for (const concept of shown) {
    const row = deskRow(list, 'sd-study-row', `Open ${concept.label}`, () => focus(host, concept.id));
    row.createEl('strong', { text: concept.label });
    const region = map.regions.find((entry) => entry.id === map.regionOf.get(concept.id));
    const links = graph.edges.filter((edge) => edge.from === concept.id || edge.to === concept.id).length;
    row.createSpan({ cls: 'sd-row-next', text: [region?.title, plural(linkedConceptNotes(host.plugin.store, concept.id).length, 'note'), links ? plural(links, 'link') : 'no links yet'].filter(Boolean).join(' · ') });
    chevron(row);
  }
  if (shown.length < rows.length) {
    button(sheet, `Show more · ${rows.length - shown.length} remaining`, () => { host.concepts.visibleLimit += 30; host.render(); }, 'quiet');
  }
  renderSideColumn(layout, context);
}

/* ────────────────────────── E6 · where modules overlap ──────────────────── */

const overlapSelection = new WeakMap<AtlasHost, string>();

function renderOverlap(root: HTMLElement, context: AtlasContext): void {
  const { host, graph } = context;
  renderAtlasIntro(root, host);
  const layout = root.createDiv({ cls: 'sd-atlas-layout' });
  const sheet = layout.createDiv({ cls: 'sd-sheet' });
  renderViewTabs(sheet, host, 'bridges');
  sheet.createDiv({ cls: 'sd-row-facts', text: 'How many concepts two modules share. It says where a concept is taught, never that one module depends on another.' });
  const modules = graph.modules.filter((module) => module.conceptCount > 0);
  const shared = moduleOverlap(graph);
  const peak = Math.max(1, ...[...shared.values()].map((rows) => rows.length));
  const selected = overlapSelection.get(host) ?? null;
  const scroll = sheet.createDiv({ cls: 'sd-grid-scroll' });
  const table = scroll.createEl('table', { cls: 'sd-overlap' });
  const head = table.createEl('thead').createEl('tr');
  head.createEl('th', { attr: { scope: 'col' }, cls: 'sd-grid-corner', text: 'Module' });
  for (const module of modules) head.createEl('th', { attr: { scope: 'col', title: module.label }, text: shortModule(host, module.id) });
  const body = table.createEl('tbody');
  for (const row of modules) {
    const tr = body.createEl('tr');
    tr.createEl('th', { attr: { scope: 'row', title: row.label }, text: shortModule(host, row.id) });
    for (const column of modules) {
      const td = tr.createEl('td');
      if (row.id === column.id) { td.addClass('is-self'); continue; }
      const key = overlapKey(row.id, column.id);
      const rows = shared.get(key) ?? [];
      if (!rows.length) { td.createSpan({ cls: 'los-sr-only', text: 'None shared' }); continue; }
      const cell = td.createEl('button', {
        cls: `sd-overlap-cell is-clickable${selected === key ? ' is-selected' : ''}`,
        text: String(rows.length),
        attr: {
          type: 'button',
          'aria-label': `${row.label} and ${column.label} share ${plural(rows.length, 'concept')}`,
          'aria-pressed': String(selected === key),
          style: `--sd-share:${Math.round(12 + (rows.length / peak) * 48)}%`,
        },
      });
      cell.addEventListener('click', () => { overlapSelection.set(host, key); host.render(); });
    }
  }
  if (selected) {
    const [a, b] = selected.split('\u0000');
    const label = (id: string | undefined) => (id ? shortModule(host, id) : '');
    const rows = shared.get(selected) ?? [];
    sheet.createEl('h2', { cls: 'sd-heading', text: `${label(a)} and ${label(b)} · ${plural(rows.length, 'shared concept')}` });
    for (const id of rows) {
      const row = deskRow(sheet, 'sd-study-row', `Open ${conceptOf(graph, id).label}`, () => focus(host, id));
      row.createEl('strong', { text: conceptOf(graph, id).label });
      chevron(row);
    }
  } else {
    sheet.createEl('p', { cls: 'sd-quiet', text: 'Choose a number to list the concepts behind it.' });
  }
  renderSideColumn(layout, context);
}

/* ────────────────────────────────── routing ─────────────────────────────── */

export function renderDeskAtlas(host: AtlasScreenHost): boolean {
  const lens = host.state.lens;
  // Notes & shelves and the Diagnostics lens keep their complete classic screens,
  // restyled, until they are redrawn. Nothing about them is lost in the meantime.
  if (lens === 'domains' || lens === 'diagnostics') return false;
  const graph = buildAtlasGraph(host.plugin.store);
  if (!graph.concepts.length) return false;
  const map = buildConceptMap(host.plugin.store.of('note'), graph);
  const context: AtlasContext = { host, graph, map };
  const root = deskPage(host.contentEl, 'atlas', host.plugin.store);
  const atlas = { label: 'Atlas', go: () => host.showConceptOverview(null) };
  const conceptId = host.state.concept;
  if (conceptId && lens !== 'bridges') {
    const crumb = regionCrumb(context, conceptId);
    deskHead(root, [atlas, ...(crumb ? [crumb] : []), { label: conceptOf(graph, conceptId).label }]);
    renderConcept(root, context, conceptId);
    return true;
  }
  if (lens === 'bridges') {
    deskHead(root, [atlas, { label: 'Across modules' }]);
    renderOverlap(root, context);
    return true;
  }
  const region = map.regions.find((row) => row.id === host.concepts.domain);
  if (region) {
    deskHead(root, [atlas, { label: region.title }]);
    renderRegion(root, context, region);
    return true;
  }
  if (host.concepts.browseAll) {
    deskHead(root, [atlas, { label: 'All concepts' }]);
    renderList(root, context);
    return true;
  }
  deskHead(root, [{ label: 'Atlas' }]);
  renderMap(root, context);
  return true;
}
