/**
 * Shared read-only Module Revision Map data model and SVG arrow connector.
 */
import { plural } from '../../components';
import { asString } from '../../projection/readers';
import { unitLabel, type UnitLabel } from '../module/labels';
import { nonNull, normalizeUnitRecord, orderModuleUnits, readModuleRecord } from '../module/model';
import { readStudyMap, readUnitRecord, stageProgress, type KnowledgeNodeView, type UnitRecordView } from '../unit/model';
import type { AtlasHost } from './ports';

type Store = AtlasHost['plugin']['store'];

export interface MapRow {
  readonly unit: UnitRecordView;
  readonly label: UnitLabel;
  readonly ideas: readonly KnowledgeNodeView[];
}

export interface ModuleMap {
  readonly moduleId: string;
  readonly rows: readonly MapRow[];
  readonly examBlocks: readonly UnitRecordView[];
  readonly unmapped: readonly UnitRecordView[];
  readonly ideas: number;
}

/** The module's lectures as the revision map draws them, or null when nothing in it has an idea map. */
export function moduleMap(store: Store, moduleId: string): ModuleMap | null {
  const record = store.get(moduleId);
  const module = record ? readModuleRecord(record) : null;
  if (!record || !module) return null;
  const ordered = orderModuleUnits(module, store.unitsFor(moduleId).map(normalizeUnitRecord).filter(nonNull));
  const units = ordered.map((row) => readUnitRecord(row.record, row.id)).filter(nonNull);
  const blocks = units.filter((unit) => unit.kind === 'exam-block');
  const lectures = units.filter((unit) => unit.kind !== 'exam-block');
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

/** "11 lectures · 71 ideas": what a module map holds, for a link to it. */
export function moduleMapFacts(map: ModuleMap): string {
  return `${plural(map.rows.length, 'lecture')} · ${plural(map.ideas, 'idea')}`;
}

/** Where a lecture stands, in Core's own counts: Studied when every stage is complete. */
export function mapProgressTag(store: Store, unitId: string): { text: string; tone: 'success' | 'accent' } | null {
  const projected = store.mapForUnit(unitId);
  if (!projected) return null;
  const stages = readStudyMap(projected).stages;
  const { done, total } = stageProgress(stages);
  if (!total || !done) return null;
  if (done === total) return { text: 'Studied', tone: 'success' };
  return { text: `In progress · ${done} of ${plural(total, 'stage')}`, tone: 'accent' };
}

const SVG = 'http://www.w3.org/2000/svg';
let sequence = 0;

/**
 * Draw "builds on" SVG arrows against the laid-out idea boxes.
 * `prefix` prefixes the SVG and path CSS classes (e.g. `sd-mm` or `focus-mm`).
 */
export function mountIdeaLinks(
  host: AtlasHost,
  canvases: readonly { canvas: HTMLElement; links: readonly { from: string; to: string }[] }[],
  prefix = 'sd-mm',
): void {
  const first = canvases[0]?.canvas;
  const doc = first?.ownerDocument;
  const win = doc?.defaultView;
  if (!first || !doc?.createElementNS || !win || typeof first.getBoundingClientRect !== 'function') return;
  let frame = 0;
  let disposed = false;
  const layers = canvases.map(({ canvas, links }) => {
    const svg = doc.createElementNS(SVG, 'svg');
    svg.setAttribute('class', `${prefix}-links`);
    svg.setAttribute('aria-hidden', 'true');
    canvas.prepend(svg);
    return { canvas, links, svg, marker: `${prefix}-arrow-${++sequence}` };
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
      chevron.setAttribute('class', `${prefix}-arrowhead`);
      head.append(chevron); defs.append(head); svg.append(defs);
      const base = canvas.getBoundingClientRect();
      const box = (node: Element) => {
        const rect = node.getBoundingClientRect();
        const left = rect.left - base.left + canvas.scrollLeft, top = rect.top - base.top + canvas.scrollTop;
        return { left, top, right: left + rect.width, bottom: top + rect.height, width: rect.width };
      };
      const nodes = new Map(Array.from(canvas.querySelectorAll('[data-idea]')).map((node) => [node.getAttribute('data-idea'), box(node)]));
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
          const below = Math.max(...between.map((node) => node.bottom)) + 5 + Math.min(under, 2) * 4;
          under += 1;
          d = `M ${x1} ${y1} C ${x1 + 12} ${y1}, ${x1 + 10} ${below}, ${x1 + 22} ${below} L ${x2 - 22} ${below} C ${x2 - 10} ${below}, ${x2 - 12} ${y2}, ${x2} ${y2}`;
        }
        const path = doc.createElementNS(SVG, 'path');
        path.setAttribute('d', d);
        path.setAttribute('class', `${prefix}-link`);
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
