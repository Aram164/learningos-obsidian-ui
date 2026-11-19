/**
 * Focus 2.0 Atlas screens:
 * - Concept Overview & Domain Study Order columns,
 * - 3-Column Concept Dependency Flow ("1. You need first" -> "2. This concept" -> "3. Leads to") + prerequisite reasons + semantic bridges + "See it in its module",
 * - Path to concept & Across modules overlap matrix,
 * - Read-only Module Revision Map (one row per lecture in course order with SVG buildsOn connectors).
 * - Notes & shelves ('domains') and Diagnostics ('diagnostics') stay on their base renderers (returning false).
 */
import { button, disclosure, filterTabs, icon, plural } from '../../components';
import { enableButtonGroupKeyboardNavigation } from '../../accessibility/button-group';
import {
  browsingRegion,
  buildConceptMap,
  layoutLectureMap,
  moduleOverlap,
  overlapKey,
  studyOrderLayout,
  type ConceptMap,
  type Region,
} from '../../features/atlas/atlas-model';
import { buildConceptContext, linkedConceptNotes } from '../../features/atlas/context';
import { readDomainCatalog } from '../../features/atlas/domain-model';
import { renderAtlasVariants } from '../../features/atlas/domains';
import { mountEdges } from '../../features/atlas/edge-layer';
import { renderOutline, renderPath } from '../../features/atlas/focused-graph';
import {
  buildAtlasGraph,
  conceptOf,
  modulesFor,
  neighbourhood,
  relationPhrase,
  strictPath,
  type AtlasEdge,
  type AtlasGraph,
} from '../../features/atlas/graph';
import { renderInspector } from '../../features/atlas/inspector';
import {
  mapProgressTag,
  moduleMap,
  moduleMapFacts,
  moduleMaps,
  mountIdeaLinks,
  type ModuleMap,
} from '../../features/atlas/module-map';
import type { AtlasHost } from '../../features/atlas/ports';
import { newDraft, renderRelationEditor } from '../../features/atlas/relation-editor';
import { nonNull } from '../../features/module/model';
import { asLabel, asString, asStrings } from '../../projection/readers';
import type { AtlasScreenHost } from '../screens';
import {
  chevron,
  commandBar,
  heading,
  moduleLongTitle,
  moduleName,
  moduleShort,
  page,
  row,
  sideCard,
  textLink,
  unitLabel,
} from './parts';

interface AtlasContext {
  readonly host: AtlasScreenHost;
  readonly graph: AtlasGraph;
  readonly map: ConceptMap;
}

const landing = new WeakMap<object, string>();
const overlapSelection = new WeakMap<AtlasHost, string>();
let revisionHeadings = 0;

function focusConcept(host: AtlasHost, id: string): void {
  host.go({ concept: id, lens: 'prerequisites' });
}

function chooseRegion(host: AtlasHost, id: string | null): void {
  if (host.state.concept || host.state.lens !== 'prerequisites') {
    host.showConceptOverview(id);
    return;
  }
  Object.assign(host.concepts, { domain: id, subdomain: null, selected: null, recentsOnly: false, browseAll: false, visibleLimit: 30 });
  host.query = '';
  host.render();
}

function openRevisionMap(host: AtlasHost, moduleId: string, unitId: string | null = null): void {
  if (unitId) landing.set(host, unitId);
  else landing.delete(host);
  host.go({ concept: null, module: moduleId, lens: 'prerequisites' });
}

function leaveRevisionMap(host: AtlasHost): void {
  landing.delete(host);
  Object.assign(host.concepts, { domain: null, subdomain: null, browseAll: false, recentsOnly: false });
  host.go({ concept: null, module: null, lens: 'prerequisites' });
}

function renderSearchBox(parent: HTMLElement, host: AtlasHost, placeholder: string): void {
  const wrap = parent.createDiv({ cls: 'focus-search-field' });
  icon(wrap.createSpan({ attr: { 'aria-hidden': 'true' } }), 'search');
  const input = wrap.createEl('input', {
    cls: 'focus-search',
    attr: { type: 'search', placeholder, 'aria-label': placeholder },
  });
  input.value = host.query;
  const results = parent.createDiv({ cls: 'focus-module-list', attr: { 'aria-live': 'polite' } });
  const draw = () => {
    results.empty();
    const query = host.query.trim();
    if (!query) return;
    const hits = host.plugin.store.search(query, ['concept']).slice(0, 8);
    if (!hits.length) {
      results.createDiv({ cls: 'focus-muted', text: `No concept matches “${query}”.` });
      return;
    }
    for (const record of hits) {
      const id = asString(record.id);
      if (!id) continue;
      const item = row(results, `Open ${asLabel(record)}`, () => {
        host.query = '';
        focusConcept(host, id);
      });
      item.createDiv({ cls: 'focus-row-copy' }).createEl('strong', { text: asLabel(record) });
      chevron(item);
    }
  };
  input.addEventListener('input', () => {
    host.query = input.value;
    draw();
  });
  draw();
}

function renderConceptFlowCard(
  parent: HTMLElement,
  context: AtlasContext,
  edge: AtlasEdge,
  otherId: string,
  focusId: string,
): void {
  const { host, graph } = context;
  const concept = conceptOf(graph, otherId);
  const label = `${concept.label} — ${relationPhrase(edge.type)}`;
  const card = parent.createEl('button', {
    cls: 'focus-atlas-card is-clickable',
    attr: { type: 'button', 'aria-label': label, 'data-atlas-concept': otherId },
  });
  card.createEl('strong', { text: concept.label });
  const modules = modulesFor(graph, otherId).map((mod) => moduleShort(host.plugin.store.get(mod.id))).join(', ');
  const sub = [relationPhrase(edge.type), modules].filter(Boolean).join(' · ');
  card.createSpan({ cls: 'focus-muted', text: sub });
  if (edge.from === focusId && edge.layer !== 'strict') card.addClass('is-soft');
  card.addEventListener('click', () => focusConcept(host, otherId));
}

function renderModuleSignposts(side: HTMLElement, context: AtlasContext, id: string, units: readonly Record<string, unknown>[]): void {
  const { host, graph } = context;
  const { store } = host.plugin;
  const teaches = (unitId: string) => {
    const plan = store.mapForUnit(unitId);
    return (Array.isArray(plan?.stages) ? plan!.stages as Array<Record<string, unknown>> : [])
      .some((stage) => asStrings(stage.concepts).includes(id));
  };
  const moduleIds = [...new Set([
    ...modulesFor(graph, id).map((module) => module.id),
    ...units.map((unit) => asString(unit.module_id)).filter((moduleId): moduleId is string => Boolean(moduleId)),
  ])];
  const maps = moduleIds.map((moduleId) => moduleMap(store, moduleId)).filter((m): m is ModuleMap => m !== null);
  if (!maps.length) return;
  const card = sideCard(side, 'See it in its module');
  card.addClass('is-signpost');
  const list = card.createDiv({ cls: 'focus-dock-list' });
  for (const map of maps) {
    const rowHit = map.rows.find((entry) => teaches(entry.unit.id)) ?? null;
    const label = `${moduleName(store.get(map.moduleId))} module map`;
    const pos = rowHit ? map.rows.indexOf(rowHit) + 1 : 0;
    const where = !rowHit ? '' : !rowHit.label.number ? rowHit.label.title
      : Number(rowHit.label.number) === pos ? `${rowHit.label.place} of ${map.rows.length}` : rowHit.label.place;
    const btn = list.createEl('button', { cls: 'focus-dock-item is-clickable', attr: { type: 'button' } });
    btn.createEl('strong', { text: label });
    btn.createSpan({ cls: 'focus-muted', text: [where, `all ${map.ideas} ideas, one row per lecture`].filter(Boolean).join(' · ') });
    btn.addEventListener('click', () => openRevisionMap(host, map.moduleId, rowHit?.unit.id ?? null));
  }
}

function renderConceptDetail(root: HTMLElement, context: AtlasContext, id: string): void {
  const { host, graph, map } = context;
  const { store, nav } = host.plugin;
  const concept = conceptOf(graph, id);
  const aliases = asStrings(concept.record?.aliases);
  const modules = modulesFor(graph, id).map((m) => moduleShort(store.get(m.id))).join(', ');

  const body = root.createDiv({ cls: 'focus-page' });
  const head = body.createDiv({ cls: 'focus-page-head' });
  const copy = head.createDiv({ cls: 'focus-heading-copy' });
  heading(copy, 'Concept', concept.label, [aliases.length ? `Also called ${aliases.join(', ')}` : '', modules].filter(Boolean).join(' · '));

  const tools = body.createDiv({ cls: 'focus-filters' });
  const lens = host.state.lens === 'path' ? 'path' : 'connections';
  filterTabs<'connections' | 'path'>(
    tools,
    'What to see about this concept',
    [['connections', 'Connections'], ['path', 'Path to it']],
    lens,
    (next) => { if (next !== lens) host.go({ lens: next === 'path' ? 'path' : 'prerequisites' }); },
  );
  renderSearchBox(tools, host, 'Find a concept');

  if (lens === 'path') {
    const path = strictPath(graph, id);
    const sheet = body.createDiv({ cls: 'focus-atlas-sheet' });
    if (!path.ok) {
      renderPath(sheet, host, graph, id);
      return;
    }
    const stops = path.layers.flat();
    heading(sheet, 'Prerequisite route', `Path to ${concept.label}`, 'Concepts in strict build order.');
    const list = sheet.createDiv({ cls: 'focus-module-list' });
    for (const [idx, stop] of stops.entries()) {
      const target = row(list, `Open ${stop.label}`, () => host.go({ concept: stop.id, lens: 'path' }));
      if (stop.id === id) target.addClass('is-current');
      target.createSpan({ cls: 'focus-stage-number focus-mono', text: String(idx + 1).padStart(2, '0') });
      const rowCopy = target.createDiv({ cls: 'focus-row-copy' });
      rowCopy.createEl('strong', { text: stop.label });
      const notes = linkedConceptNotes(store, stop.id).length;
      rowCopy.createSpan({ cls: 'focus-muted', text: `${plural(notes, 'note')} · ${modulesFor(graph, stop.id).map((m) => moduleShort(store.get(m.id))).join(', ') || 'No module'}` });
      chevron(target);
    }
    button(sheet, `Inspect ${concept.label} connections`, () => focusConcept(host, id), 'cta');
    return;
  }

  const before = graph.prerequisiteEdges.get(id) ?? [];
  const after = graph.dependentEdges.get(id) ?? [];
  const semantic = graph.semanticEdges.get(id) ?? [];

  const layout = body.createDiv({ cls: 'focus-atlas-layout' });
  const sheet = layout.createDiv({ cls: 'focus-atlas-sheet' });

  if (!before.length && !after.length && !semantic.length) {
    const gap = sheet.createDiv({ cls: 'focus-atlas-gap' });
    gap.createEl('strong', { text: 'No links recorded for this concept' });
    gap.createEl('p', { cls: 'focus-muted', text: 'Its notes and sources are still available on the right, and you can connect it to another concept.' });
    button(gap, 'Connect this concept', () => {
      host.editor = newDraft(id);
      host.render();
    }, 'quiet');
  } else {
    const flow = sheet.createDiv({ cls: 'focus-atlas-flow' });
    const lane = (eyebrow: string) => {
      const col = flow.createDiv({ cls: 'focus-atlas-lane' });
      col.createDiv({ cls: 'focus-eyebrow', text: eyebrow });
      return col;
    };

    const first = lane('1. You need first');
    for (const edge of before) {
      if (!edge.prerequisiteId) continue;
      const need = first.createDiv({ cls: 'focus-need' });
      renderConceptFlowCard(need, context, edge, edge.prerequisiteId, id);
      if (edge.context) need.createDiv({ cls: 'focus-need-why', text: edge.context });
    }
    if (!before.length) first.createDiv({ cls: 'focus-atlas-gap', text: 'Nothing recorded comes before this.' });

    const middle = lane('2. This concept');
    const self = middle.createDiv({
      cls: 'focus-atlas-card is-selected',
      attr: { 'data-atlas-concept': id },
    });
    self.createEl('strong', { text: concept.label });
    const region = map.regions.find((r) => r.id === map.regionOf.get(id));
    if (region) self.createSpan({ cls: 'focus-muted', text: region.title });

    const leads = lane('3. Leads to');
    for (const edge of after) {
      if (edge.dependentId) renderConceptFlowCard(leads, context, edge, edge.dependentId, id);
    }
    if (!after.length) leads.createDiv({ cls: 'focus-atlas-gap', text: 'Nothing recorded builds on this yet.' });

    mountEdges(flow, host, graph, [...before, ...after]);

    const related = sheet.createDiv({ cls: 'focus-module-group' });
    const relHead = related.createDiv({ cls: 'focus-section-head' });
    relHead.createDiv({ cls: 'focus-eyebrow', text: 'Related, not an order' });
    relHead.createSpan({ cls: 'focus-muted', text: 'Semantic bridges never change prerequisites.' });
    if (!semantic.length) related.createEl('p', { cls: 'focus-muted', text: 'No related ideas are recorded.' });
    for (const edge of semantic) {
      const other = edge.from === id ? edge.to : edge.from;
      const item = row(related, `Open ${conceptOf(graph, other).label}`, () => focusConcept(host, other));
      item.createSpan({ cls: 'focus-pill', text: relationPhrase(edge.type) });
      const rCopy = item.createDiv({ cls: 'focus-row-copy' });
      rCopy.createEl('strong', { text: conceptOf(graph, other).label });
      rCopy.createSpan({ cls: 'focus-muted', text: edge.context ?? 'Authored without a rationale.' });
      chevron(item);
    }
  }

  if (host.editor) renderRelationEditor(sheet, host, graph, host.editor);
  const foot = sheet.createDiv({ cls: 'focus-section-head' });
  const navBtns = foot.createDiv({ cls: 'focus-nearby' });
  const back = button(navBtns, 'Back', () => host.conceptBack(), 'quiet');
  back.disabled = !host.canConceptBack;
  const forward = button(navBtns, 'Forward', () => host.conceptForward(), 'quiet');
  forward.disabled = !host.canConceptForward;
  if (!host.editor) {
    textLink(foot, 'Connect this concept', () => {
      host.editor = newDraft(id);
      host.render();
    });
  }

  const side = layout.createDiv({ cls: 'focus-home-dock' });
  const known = buildConceptContext(store, id);
  const reference = known.notes.find((note) => asString(note.role) === 'reference') ?? null;
  if (reference) button(side, 'Open the reference', () => nav.openRecord(reference), 'cta');

  const units = store.of('unit').filter((unit) => {
    const unitMap = asString(unit.id) ? store.mapForUnit(asString(unit.id)!) : null;
    return (Array.isArray(unitMap?.stages) ? unitMap!.stages as Array<Record<string, unknown>> : [])
      .some((stage) => asStrings(stage.concepts).includes(id));
  });
  const listCard = (title: string, items: readonly { label: string; open: () => unknown }[]) => {
    const card = sideCard(side, `${title} · ${items.length}`);
    if (!items.length) {
      card.createEl('p', { cls: 'focus-muted', text: 'None recorded.' });
      return;
    }
    for (const item of items.slice(0, 4)) textLink(card, item.label, item.open);
    if (items.length > 4) {
      const more = disclosure(card, `All ${items.length}`);
      for (const item of items.slice(4)) textLink(more, item.label, item.open);
    }
  };
  listCard('Where you meet it', units.map((unit) => ({
    label: unitLabel(unit, store.get(asString(unit.module_id) ?? '')).title,
    open: () => nav.openUnit(asString(unit.id) ?? ''),
  })));
  renderModuleSignposts(side, context, id, units);
  listCard('Notes', known.notes.map((n) => ({ label: asLabel(n), open: () => nav.openRecord(n) })));
  listCard('Sources', known.sources.map((s) => ({ label: asLabel(s), open: () => nav.openSourceDetail(asString(s.id) ?? '') })));

  const view = neighbourhood(graph, id, { depth: host.state.depth, includeSemanticNeighbours: true });
  renderInspector(disclosure(side, 'Where each link comes from, and questions'), host, graph, view);
  renderOutline(disclosure(side, 'Full text outline'), host, graph, view);
}

function renderAtlasModuleMap(root: HTMLElement, host: AtlasScreenHost, map: ModuleMap): void {
  const { store, nav } = host.plugin;
  const module = store.get(map.moduleId);
  const short = moduleName(module);
  const body = root.createDiv({ cls: 'focus-page' });
  const head = body.createDiv({ cls: 'focus-page-head' });
  heading(
    head.createDiv({ cls: 'focus-heading-copy' }),
    'Module revision map',
    moduleLongTitle(module),
    `${plural(map.rows.length, 'lecture')} · ${map.ideas} ideas from your lecture maps · left to right shows builds-on order.`,
  );

  const here = landing.get(host) ?? null;
  let landed: HTMLElement | null = null;
  const sheet = body.createDiv({ cls: 'focus-atlas-sheet' });
  const lectures = sheet.createDiv({ cls: 'focus-mm-lectures' });
  const canvases: { canvas: HTMLElement; links: readonly { from: string; to: string }[] }[] = [];

  for (const [index, entry] of map.rows.entries()) {
    const lecture = lectures.createDiv({
      cls: `focus-mm-lecture${entry.unit.id === here ? ' is-here' : ''}`,
      attr: { 'data-unit': entry.unit.id },
    });
    if (entry.unit.id === here) landed = lecture;
    const line = lecture.createDiv({ cls: 'focus-mm-lecture-head' });
    line.createSpan({ cls: 'focus-mm-number focus-mono', text: (entry.label.number ?? String(index + 1)).padStart(2, '0') });
    const headingId = `focus-mm-lecture-${++revisionHeadings}`;
    line.createEl('h3', { text: entry.label.title, attr: { id: headingId } });
    const tag = mapProgressTag(store, entry.unit.id);
    if (tag) line.createSpan({ cls: `focus-pill is-${tag.tone}`, text: tag.text });
    textLink(line, 'Open lecture', () => nav.openUnit(entry.unit.id));
    if (entry.unit.knowledgeSummary) lecture.createDiv({ cls: 'focus-muted', text: entry.unit.knowledgeSummary });

    const layout = layoutLectureMap(entry.ideas);
    const byId = new Map(entry.ideas.map((idea) => [idea.id, idea]));
    const canvas = lecture.createDiv({ cls: 'focus-mm-ideas', attr: { role: 'group', 'aria-labelledby': headingId } });
    for (const column of layout.columns) {
      const stack = canvas.createDiv({ cls: 'focus-mm-column', attr: { role: 'list' } });
      for (const id of column) {
        const idea = byId.get(id);
        if (!idea) continue;
        const node = stack.createDiv({ cls: 'focus-mm-idea', attr: { role: 'listitem', 'data-idea': id, title: idea.summary } });
        node.createSpan({ text: idea.title });
        const before = layout.links.filter((link) => link.to === id).map((link) => byId.get(link.from)?.title).filter(nonNull);
        if (before.length) node.createSpan({ cls: 'los-sr-only', text: `, builds on ${before.join(' and ')}` });
      }
    }
    canvases.push({ canvas, links: layout.links });
  }

  if (map.examBlocks.length || map.unmapped.length) {
    const foot = sheet.createDiv({ cls: 'focus-dock-list' });
    for (const unit of map.examBlocks) {
      const note = foot.createDiv({ cls: 'focus-muted' });
      note.createSpan({ text: `${short} ${unitLabel(unit.record, module).place.toLowerCase()} is an exam block. ` });
      textLink(note, 'Open it', () => nav.openUnit(unit.id));
    }
    if (map.unmapped.length) {
      foot.createDiv({ cls: 'focus-muted', text: `No idea map yet: ${map.unmapped.map((unit) => unitLabel(unit.record, module).place).join(', ')}.` });
    }
  }

  mountIdeaLinks(host, canvases, 'focus-mm');
  const target = landed as HTMLElement | null;
  if (target && typeof target.scrollIntoView === 'function') {
    root.ownerDocument?.defaultView?.requestAnimationFrame(() => target.scrollIntoView({ block: 'center' }));
  }
}

function renderRegionOrder(root: HTMLElement, context: AtlasContext, region: Region): void {
  const { host, graph } = context;
  const body = root.createDiv({ cls: 'focus-page' });
  const head = body.createDiv({ cls: 'focus-page-head' });
  heading(
    head.createDiv({ cls: 'focus-heading-copy' }),
    'Region study order',
    region.title,
    `${plural(region.concepts.length, 'concept')} · ${plural(region.linked, 'linked')}. Left to right shows prerequisite order.`,
  );
  button(head, 'All Atlas areas', () => chooseRegion(host, null), 'quiet');

  const sheet = body.createDiv({ cls: 'focus-atlas-sheet' });
  const layout = studyOrderLayout(region.concepts, graph);
  if (layout.placed.length) {
    const columns = sheet.createDiv({ cls: 'focus-study-columns' });
    for (let colIdx = 0; colIdx < layout.columns; colIdx += 1) {
      const here = layout.placed.filter((item) => item.column === colIdx).sort((a, b) => a.row - b.row);
      if (!here.length) continue;
      const col = columns.createDiv({ cls: 'focus-study-col' });
      col.createDiv({
        cls: 'focus-eyebrow',
        text: layout.beyond === colIdx ? 'Unlocks next' : `Step ${colIdx + 1}`,
      });
      for (const item of here) {
        const c = conceptOf(graph, item.id);
        const btn = col.createEl('button', { cls: 'focus-atlas-card is-clickable', attr: { type: 'button' } });
        btn.createEl('strong', { text: c.label });
        if (item.visiting) btn.createSpan({ cls: 'focus-muted', text: 'Outside region' });
        btn.addEventListener('click', () => focusConcept(host, item.id));
      }
    }
  }
  if (layout.unlinked.length) {
    sheet.createDiv({ cls: 'focus-eyebrow', text: `Other concepts in ${region.title} · ${layout.unlinked.length}` });
    const list = sheet.createDiv({ cls: 'focus-module-list' });
    for (const id of layout.unlinked) {
      const c = conceptOf(graph, id);
      const item = row(list, `Open ${c.label}`, () => focusConcept(host, id));
      item.createDiv({ cls: 'focus-row-copy' }).createEl('strong', { text: c.label });
      chevron(item);
    }
  }
}

function renderOverlap(root: HTMLElement, context: AtlasContext): void {
  const { host, graph } = context;
  const { store } = host.plugin;
  const body = root.createDiv({ cls: 'focus-page' });
  const head = body.createDiv({ cls: 'focus-page-head' });
  heading(head.createDiv({ cls: 'focus-heading-copy' }), 'Across modules', 'Shared concepts', 'Where modules touch the same ideas without implying module order.');

  const sheet = body.createDiv({ cls: 'focus-atlas-sheet' });
  const modules = graph.modules.filter((m) => m.conceptCount > 0);
  const shared = moduleOverlap(graph);
  const selected = overlapSelection.get(host) ?? null;

  const list = sheet.createDiv({ cls: 'focus-module-list' });
  for (let i = 0; i < modules.length; i += 1) {
    for (let j = i + 1; j < modules.length; j += 1) {
      const a = modules[i]!;
      const b = modules[j]!;
      const key = overlapKey(a.id, b.id);
      const concepts = shared.get(key) ?? [];
      if (!concepts.length) continue;
      const item = row(list, `${a.label} and ${b.label}`, () => {
        overlapSelection.set(host, key);
        host.render();
      });
      if (selected === key) item.addClass('is-current');
      const copy = item.createDiv({ cls: 'focus-row-copy' });
      copy.createEl('strong', { text: `${moduleShort(store.get(a.id))} ↔ ${moduleShort(store.get(b.id))}` });
      copy.createSpan({ cls: 'focus-muted', text: `${a.label} · ${b.label}` });
      item.createSpan({ cls: 'focus-row-state', text: plural(concepts.length, 'shared concept') });
      chevron(item);
    }
  }
  if (selected) {
    const concepts = shared.get(selected) ?? [];
    sheet.createDiv({ cls: 'focus-eyebrow', text: `Shared ideas · ${concepts.length}` });
    for (const id of concepts) {
      const c = conceptOf(graph, id);
      const hit = row(sheet, `Open ${c.label}`, () => focusConcept(host, id));
      hit.createDiv({ cls: 'focus-row-copy' }).createEl('strong', { text: c.label });
      chevron(hit);
    }
  }
}

function renderAtlasOverview(root: HTMLElement, context: AtlasContext): void {
  const { host, graph, map } = context;
  const { store } = host.plugin;
  const body = root.createDiv({ cls: 'focus-page' });
  const head = body.createDiv({ cls: 'focus-page-head' });
  heading(
    head.createDiv({ cls: 'focus-heading-copy' }),
    'Knowledge graph',
    'Atlas',
    `${plural(graph.concepts.filter((c) => c.record).length, 'concept')} · ${plural(graph.edges.filter((e) => e.layer === 'strict').length, 'prerequisite link')}.`,
  );

  const tools = body.createDiv({ cls: 'focus-filters' });
  const navGroup = tools.createDiv({ cls: 'focus-nearby' });
  button(navGroup, 'Across modules', () => host.go({ concept: null, lens: 'bridges' }), 'quiet');
  button(navGroup, 'All concepts', () => {
    host.concepts.browseAll = true;
    host.render();
  }, 'quiet');
  renderSearchBox(tools, host, 'Search concepts');

  const layout = body.createDiv({ cls: 'focus-atlas-layout' });
  const sheet = layout.createDiv({ cls: 'focus-atlas-sheet' });

  if (host.concepts.browseAll) {
    const bar = sheet.createDiv({ cls: 'focus-section-head' });
    bar.createEl('h2', { text: 'All concepts' });
    textLink(bar, 'Back to regions', () => {
      host.concepts.browseAll = false;
      host.render();
    });
    const rows = graph.concepts.filter((c) => c.record);
    const shown = rows.slice(0, host.concepts.visibleLimit);
    const list = sheet.createDiv({ cls: 'focus-module-list', attr: { role: 'group', 'aria-label': 'Concepts' } });
    enableButtonGroupKeyboardNavigation(list, 'vertical');
    for (const c of shown) {
      const target = row(list, `Open ${c.label}`, () => focusConcept(host, c.id));
      target.createDiv({ cls: 'focus-row-copy' }).createEl('strong', { text: c.label });
      chevron(target);
    }
    if (shown.length < rows.length) {
      button(sheet, `Show more · ${rows.length - shown.length} remaining`, () => {
        host.concepts.visibleLimit += 30;
        host.render();
      }, 'quiet');
    }
  } else {
    sheet.createEl('h2', { text: 'Study areas' });
    const grid = sheet.createDiv({ cls: 'focus-atlas-regions' });
    for (const region of map.regions) {
      if (!region.concepts.length) continue;
      const card = grid.createEl('button', { cls: 'focus-region-card is-clickable', attr: { type: 'button' } });
      card.createEl('strong', { text: region.title });
      card.createSpan({ cls: 'focus-muted', text: `${plural(region.concepts.length, 'concept')} · ${region.linked} linked` });
      card.addEventListener('click', () => chooseRegion(host, region.id));
    }
  }

  const side = layout.createDiv({ cls: 'focus-home-dock' });
  const maps = moduleMaps(store);
  if (maps.length) {
    const rev = sideCard(side, 'Module revision maps', { text: `${maps.length}` });
    const list = rev.createDiv({ cls: 'focus-dock-list' });
    for (const entry of maps) {
      const mod = store.get(entry.moduleId);
      const item = list.createEl('button', { cls: 'focus-dock-item is-clickable', attr: { type: 'button' } });
      item.createEl('strong', { text: moduleName(mod) });
      item.createSpan({ cls: 'focus-muted', text: moduleMapFacts(entry) });
      item.addEventListener('click', () => openRevisionMap(host, entry.moduleId));
    }
  }
}

export function renderFocusAtlas(host: AtlasScreenHost): boolean {
  const lens = host.state.lens;
  if (lens === 'domains' || lens === 'diagnostics') return false;
  const graph = buildAtlasGraph(host.plugin.store);
  if (!graph.concepts.length) return false;
  const map = buildConceptMap(readDomainCatalog(host.plugin.store), host.plugin.store.of('note'), graph);
  const context: AtlasContext = { host, graph, map };
  const conceptId = host.state.concept;
  const glance = host.state.module && !conceptId && lens !== 'bridges' ? moduleMap(host.plugin.store, host.state.module) : null;
  const root = page(host.contentEl, 'atlas', host.plugin.store);

  if (glance) {
    const barActions = commandBar(root, [
      { label: 'Atlas', go: () => leaveRevisionMap(host) },
      { label: moduleName(host.plugin.store.get(glance.moduleId)) },
    ], host);
    renderAtlasVariants(barActions, host.plugin.nav, 'concepts', (target) => host.go(target));
    renderAtlasModuleMap(root, host, glance);
    return true;
  }

  const atlasCrumb = { label: 'Atlas', go: () => host.showConceptOverview(null) };
  if (conceptId && lens !== 'bridges') {
    const regionId = map.regionOf.get(conceptId);
    const region = map.regions.find((r) => r.id === regionId);
    const barActions = commandBar(root, [
      atlasCrumb,
      ...(region ? [{ label: region.title, go: () => chooseRegion(host, region.id) }] : []),
      { label: conceptOf(graph, conceptId).label },
    ], host);
    renderAtlasVariants(barActions, host.plugin.nav, 'concepts', (target) => host.go(target));
    renderConceptDetail(root, context, conceptId);
    return true;
  }

  if (lens === 'bridges') {
    const barActions = commandBar(root, [atlasCrumb, { label: 'Across modules' }], host);
    renderAtlasVariants(barActions, host.plugin.nav, 'concepts', (target) => host.go(target));
    renderOverlap(root, context);
    return true;
  }

  const region = map.regions.find((row) => row.id === host.concepts.domain);
  if (region) {
    const browse = browsingRegion(map, graph, region.id) ?? region;
    const barActions = commandBar(root, [atlasCrumb, { label: browse.title }], host);
    renderAtlasVariants(barActions, host.plugin.nav, 'concepts', (target) => host.go(target));
    renderRegionOrder(root, context, browse);
    return true;
  }

  const barActions = commandBar(root, [{ label: 'Atlas' }], host);
  renderAtlasVariants(barActions, host.plugin.nav, 'concepts', (target) => host.go(target));
  renderAtlasOverview(root, context);
  return true;
}
