/**
 * F5 · A module at a glance, for revision (Figma `67:10217`, decision D14).
 *
 * Read-only, in the Atlas: one row per lecture in course order, each lecture's
 * ideas left to right by `builds_on`, from `unit.knowledge_map`. Positions come
 * from the data alone (`layoutLectureMap`), so a place on the map stays where
 * it was. The ideas are not links: the map is for studying, and finding stays
 * in Search and the lists (D14). It draws the Atlas route's existing `module`
 * field; no route is new.
 */
import { renderAtlasVariants } from '../../features/atlas/domains';
import type { AtlasHost } from '../../features/atlas/ports';
import { nonNull, normalizeUnitRecord, orderModuleUnits, readModuleRecord } from '../../features/module/model';
import { readStudyMap, readUnitRecord, type KnowledgeNodeView, type UnitRecordView } from '../../features/unit/model';
import { asString } from '../../projection/readers';
import type { AtlasScreenHost } from '../screens';
import { layoutLectureMap } from './atlas-model';
import { moduleLongTitle, moduleName, sideGroup, textLink, unitLabel, type UnitLabel } from './parts';

type Store = AtlasHost['plugin']['store'];

export interface MapRow {
  readonly unit: UnitRecordView;
  readonly label: UnitLabel;
  readonly ideas: readonly KnowledgeNodeView[];
}

export interface ModuleMap {
  readonly moduleId: string;
  /** Lectures with an idea map, in course order. */
  readonly rows: readonly MapRow[];
  /** Exam blocks: a lecture map's row is for a lecture, so these are named instead. */
  readonly examBlocks: readonly UnitRecordView[];
  /** Units that have no idea map yet: named, never hidden. */
  readonly unmapped: readonly UnitRecordView[];
  readonly ideas: number;
}

/** The module's lectures as F5 draws them, or null when nothing in it has an idea map. */
export function moduleMap(store: Store, moduleId: string): ModuleMap | null {
  const record = store.get(moduleId);
  const module = record ? readModuleRecord(record) : null;
  if (!record || !module) return null;
  const ordered = orderModuleUnits(module, store.unitsFor(moduleId).map(normalizeUnitRecord).filter(nonNull));
  const units = ordered.map((row) => readUnitRecord(row.record, row.id)).filter(nonNull);
  const blocks = units.filter((unit) => unit.kind === 'exam-block');
  const lectures = units.filter((unit) => unit.kind !== 'exam-block');
  // Rows are lectures. A module made only of exam blocks (one in exam preparation)
  // draws those instead, so a map that exists is never hidden.
  const drawn = lectures.some((unit) => unit.knowledgeNodes.length) ? lectures : blocks;
  const rows = drawn.filter((unit) => unit.knowledgeNodes.length)
    .map((unit) => ({ unit, label: unitLabel(unit.record, record), ideas: unit.knowledgeNodes }));
  if (!rows.length) return null;
  return {
    moduleId,
    rows,
    examBlocks: drawn === lectures ? blocks : [],
    unmapped: drawn.filter((unit) => !unit.knowledgeNodes.length),
    ideas: rows.reduce((sum, row) => sum + row.ideas.length, 0),
  };
}

/** Every module with at least one lecture map, in the manifest's module order. */
export function moduleMaps(store: Store): ModuleMap[] {
  return store.modules().map((module) => asString(module.id)).filter(nonNull)
    .map((id) => moduleMap(store, id)).filter(nonNull);
}

const plural = (amount: number, noun: string) => `${amount} ${noun}${amount === 1 ? '' : 's'}`;


/** "11 lectures · 71 ideas": what a module map holds, for a link to it. */
export function moduleMapFacts(map: ModuleMap): string {
  return `${plural(map.rows.length, 'lecture')} · ${plural(map.ideas, 'idea')}`;
}

/** Where a lecture stands, in Core's own counts: Studied when every stage is complete. */
function progressTag(store: Store, unitId: string): { text: string; tone: 'success' | 'accent' } | null {
  const projected = store.mapForUnit(unitId);
  if (!projected) return null;
  const stages = readStudyMap(projected).stages;
  const done = stages.filter((stage) => stage.status === 'complete').length;
  if (!stages.length || !done) return null;
  if (done === stages.length) return { text: 'Studied', tone: 'success' };
  return { text: `In progress · ${done} of ${plural(stages.length, 'stage')}`, tone: 'accent' };
}

/** Ids for lecture headings, unique across panes that draw the same module. */
let headings = 0;

/** The lecture a learner came from, to scroll to and mark. View state, never a route. */
const landing = new WeakMap<object, string>();

export function openModuleMap(host: AtlasHost, moduleId: string, unitId: string | null = null): void {
  if (unitId) landing.set(host, unitId);
  else landing.delete(host);
  host.go({ concept: null, module: moduleId, lens: 'prerequisites' });
}

export function leaveModuleMap(host: AtlasHost): void {
  landing.delete(host);
  Object.assign(host.concepts, { domain: null, subdomain: null, browseAll: false, recentsOnly: false });
  host.go({ concept: null, module: null, lens: 'prerequisites' });
}

/* ──────────────────────────────── drawing ──────────────────────────────── */

export function renderModuleMap(root: HTMLElement, host: AtlasScreenHost, map: ModuleMap): void {
  const { store, nav } = host.plugin;
  const module = store.get(map.moduleId);
  const short = moduleName(module);
  const head = root.createDiv({ cls: 'sd-title-row' });
  const copy = head.createDiv({ cls: 'sd-title-copy' });
  copy.createEl('h1', { cls: 'sd-title', text: moduleLongTitle(module) });
  copy.createDiv({ cls: 'sd-facts', text: `The module at a glance · ${plural(map.rows.length, 'lecture')} · ${map.ideas} ideas from your lecture maps` });
  renderAtlasVariants(head.createDiv({ cls: 'sd-title-tools' }), nav, 'concepts', (target) => host.go(target));

  const sheet = root.createDiv({ cls: 'sd-sheet sd-mm-sheet' });
  const title = sheet.createDiv({ cls: 'sd-mm-head' });
  title.createEl('h2', { cls: 'sd-mm-title', text: 'The module at a glance' });
  title.createSpan({ cls: 'sd-mm-subtitle', text: 'lectures top to bottom, in course order · ideas left to right: an arrow means “builds on”' });
  const guide = sheet.createDiv({ cls: 'sd-mm-guide' });
  for (const [label, text] of [
    ['How to read it', 'One row per lecture, in course order. Inside a row, an arrow means the idea on the right builds on the one on the left. Nothing moves between visits, so places stay familiar.'],
    ['Revise with it', 'Cover a row and say each idea in a sentence, then open the lecture to check. Start with the lectures you studied longest ago.'],
    ['Not drawn yet', 'Links between lectures. Your lecture maps link ideas inside one lecture only; concept pages show the Atlas’s links across lectures.'],
  ] as const) {
    const column = sideGroup(guide, label);
    column.createEl('p', { cls: 'sd-mm-note', text });
  }

  const here = landing.get(host) ?? null;
  let landed: HTMLElement | null = null;
  const lectures = sheet.createDiv({ cls: 'sd-mm-lectures' });
  const canvases: { canvas: HTMLElement; links: readonly { from: string; to: string }[] }[] = [];
  for (const [index, row] of map.rows.entries()) {
    const lecture = lectures.createDiv({ cls: `sd-mm-lecture${row.unit.id === here ? ' is-here' : ''}`, attr: { 'data-unit': row.unit.id } });
    if (row.unit.id === here) landed = lecture;
    const line = lecture.createDiv({ cls: 'sd-mm-lecture-head' });
    line.createSpan({ cls: 'sd-mm-number', text: (row.label.number ?? String(index + 1)).padStart(2, '0') });
    // Named by its heading, not an aria-label: Obsidian shows every aria-label as a hover tooltip.
    const heading = `sd-mm-lecture-${++headings}`;
    line.createEl('h3', { cls: 'sd-mm-lecture-title', text: row.label.title, attr: { id: heading } });
    const tag = progressTag(store, row.unit.id);
    if (tag) line.createSpan({ cls: `sd-tag is-${tag.tone}`, text: tag.text });
    line.createSpan({ cls: 'sd-mat-flex' });
    textLink(line, 'Open lecture', () => nav.openUnit(row.unit.id)).addClass('sd-mm-open');
    if (row.unit.knowledgeSummary) {
      lecture.createDiv({ cls: 'sd-mm-summary', text: row.unit.knowledgeSummary, attr: { title: row.unit.knowledgeSummary } });
    }
    const layout = layoutLectureMap(row.ideas);
    const byId = new Map(row.ideas.map((idea) => [idea.id, idea]));
    const canvas = lecture.createDiv({ cls: 'sd-mm-ideas', attr: { role: 'group', 'aria-labelledby': heading } });
    for (const column of layout.columns) {
      const stack = canvas.createDiv({ cls: 'sd-mm-column', attr: { role: 'list' } });
      for (const id of column) {
        const idea = byId.get(id);
        if (!idea) continue;
        const node = stack.createDiv({ cls: 'sd-mm-idea', attr: { role: 'listitem', 'data-idea': id, title: idea.summary } });
        node.createSpan({ text: idea.title });
        const before = layout.links.filter((link) => link.to === id).map((link) => byId.get(link.from)?.title).filter(nonNull);
        if (before.length) node.createSpan({ cls: 'los-sr-only', text: `, builds on ${before.join(' and ')}` });
      }
    }
    canvases.push({ canvas, links: layout.links });
  }

  // What has no row is named, so nothing in the module is silently missing.
  if (map.examBlocks.length || map.unmapped.length) {
    const foot = sheet.createDiv({ cls: 'sd-mm-foot' });
    for (const unit of map.examBlocks) {
      const note = foot.createDiv({ cls: 'sd-mm-foot-line' });
      note.createSpan({ text: `${short} ${unitLabel(unit.record, module).place.replace(/^./, (first) => first.toLowerCase())} is an exam block, not a lecture, so it has no row here. ` });
      textLink(note, 'Open it', () => nav.openUnit(unit.id));
    }
    if (map.unmapped.length) {
      foot.createDiv({ cls: 'sd-mm-foot-line', text: `No idea map yet: ${map.unmapped.map((unit) => unitLabel(unit.record, module).place).join(', ')}.` });
    }
  }

  mountIdeaLinks(host, canvases);
  const target = landed as HTMLElement | null;
  if (target && typeof target.scrollIntoView === 'function') {
    root.ownerDocument?.defaultView?.requestAnimationFrame(() => target.scrollIntoView({ block: 'center' }));
  }
}

/* ─────────────────────────────── the arrows ────────────────────────────── */

const SVG = 'http://www.w3.org/2000/svg';
let sequence = 0;

/**
 * Draw "builds on" arrows against the laid-out idea boxes. Between neighbouring
 * columns an arrow is a straight line through the gutter (as the mock draws it);
 * one that skips a column bends under the boxes in between instead of crossing
 * them (BRIEF §10 step 4).
 */
function mountIdeaLinks(host: AtlasHost, canvases: readonly { canvas: HTMLElement; links: readonly { from: string; to: string }[] }[]): void {
  const first = canvases[0]?.canvas;
  const doc = first?.ownerDocument;
  const win = doc?.defaultView;
  if (!first || !doc?.createElementNS || !win || typeof first.getBoundingClientRect !== 'function') return;
  let frame = 0;
  let disposed = false;
  const layers = canvases.map(({ canvas, links }) => {
    const svg = doc.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'sd-mm-links');
    svg.setAttribute('aria-hidden', 'true');
    canvas.prepend(svg);
    return { canvas, links, svg, marker: `sd-mm-arrow-${++sequence}` };
  });
  const draw = () => {
    frame = 0;
    if (disposed) return;
    for (const { canvas, links, svg, marker } of layers) {
      if (!canvas.isConnected) continue;
      svg.replaceChildren();
      const defs = doc.createElementNS(SVG, 'defs');
      const head = doc.createElementNS(SVG, 'marker');
      for (const [key, value] of Object.entries({ id: marker, viewBox: '0 0 8 8', refX: '6.5', refY: '4', markerWidth: '8', markerHeight: '8', markerUnits: 'userSpaceOnUse', orient: 'auto' })) head.setAttribute(key, value);
      const chevron = doc.createElementNS(SVG, 'path');
      chevron.setAttribute('d', 'M 2 1 L 6.5 4 L 2 7');
      chevron.setAttribute('class', 'sd-mm-arrowhead');
      head.append(chevron); defs.append(head); svg.append(defs);
      const base = canvas.getBoundingClientRect();
      const box = (node: Element) => {
        const rect = node.getBoundingClientRect();
        const left = rect.left - base.left + canvas.scrollLeft, top = rect.top - base.top + canvas.scrollTop;
        return { left, top, right: left + rect.width, bottom: top + rect.height, width: rect.width };
      };
      const nodes = new Map(Array.from(canvas.querySelectorAll('[data-idea]')).map((node) => [node.getAttribute('data-idea'), box(node)]));
      // Sized to the boxes, never to the scroll area: a layer as large as what it
      // sits in would grow that area and draw scrollbars around every row.
      const boxes = [...nodes.values()];
      svg.setAttribute('width', String(Math.ceil(Math.max(0, ...boxes.map((node) => node.right))) + 4));
      svg.setAttribute('height', String(Math.ceil(Math.max(0, ...boxes.map((node) => node.bottom))) + 15));
      let under = 0;
      for (const link of links) {
        const a = nodes.get(link.from), b = nodes.get(link.to);
        if (!a || !b || !a.width || !b.width || b.left <= a.right) continue;
        const x1 = a.right + 2, y1 = (a.top + a.bottom) / 2, x2 = b.left - 3, y2 = (b.top + b.bottom) / 2;
        const between = [...nodes.values()].filter((node) => node.left > a.right && node.right < b.left);
        const yAt = (x: number) => y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
        const blocked = between.some((node) => {
          const top = Math.min(yAt(node.left), yAt(node.right)), bottom = Math.max(yAt(node.left), yAt(node.right));
          return bottom >= node.top - 4 && top <= node.bottom + 4;
        });
        let d = `M ${x1} ${y1} L ${x2} ${y2}`;
        if (blocked) {
          // Each bend in a row gets its own track, so two never run along one line.
          const below = Math.max(...between.map((node) => node.bottom)) + 5 + Math.min(under, 2) * 4;
          under += 1;
          d = `M ${x1} ${y1} C ${x1 + 12} ${y1}, ${x1 + 10} ${below}, ${x1 + 22} ${below} L ${x2 - 22} ${below} C ${x2 - 10} ${below}, ${x2 - 12} ${y2}, ${x2} ${y2}`;
        }
        const path = doc.createElementNS(SVG, 'path');
        path.setAttribute('d', d);
        path.setAttribute('class', 'sd-mm-link');
        path.setAttribute('marker-end', `url(#${marker})`);
        svg.append(path);
      }
    }
  };
  const schedule = () => { if (!disposed && !frame) frame = win.requestAnimationFrame(draw); };
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
  for (const { canvas } of layers) observer?.observe(canvas);
  win.addEventListener('resize', schedule);
  schedule();
  host.addRenderCleanup(() => {
    disposed = true;
    if (frame) win.cancelAnimationFrame(frame);
    observer?.disconnect();
    win.removeEventListener('resize', schedule);
  });
}
