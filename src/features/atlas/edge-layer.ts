import { canonicalSentence, type AtlasEdge, type AtlasGraph } from './graph';
import type { AtlasHost } from './ports';

let sequence = 0;
const SVG = 'http://www.w3.org/2000/svg';

/** Draw the exact authored edges against the rendered cards, never lane adjacency. */
export function mountEdges(
  canvas: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
  edges: readonly AtlasEdge[],
): void {
  const doc = canvas.ownerDocument;
  if (!doc?.createElementNS || typeof canvas.getBoundingClientRect !== 'function') return;
  const win = doc.defaultView;
  if (!win) return;
  const svg = doc.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'los-atlas-edge-layer');
  svg.setAttribute('aria-hidden', 'true');
  canvas.prepend(svg);
  const markerId = `los-atlas-arrow-${++sequence}`;
  let frame = 0;
  let disposed = false;

  const draw = () => {
    frame = 0;
    if (disposed || !canvas.isConnected) return;
    svg.replaceChildren();
    const base = canvas.getBoundingClientRect();
    svg.setAttribute('width', String(canvas.scrollWidth));
    svg.setAttribute('height', String(canvas.scrollHeight));
    const defs = doc.createElementNS(SVG, 'defs');
    const marker = doc.createElementNS(SVG, 'marker');
    for (const [key, value] of Object.entries({ id: markerId, viewBox: '0 0 10 10', refX: '9', refY: '5',
      markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' })) marker.setAttribute(key, value);
    const arrow = doc.createElementNS(SVG, 'path');
    arrow.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    arrow.setAttribute('class', 'los-atlas-arrowhead');
    marker.append(arrow); defs.append(marker); svg.append(defs);
    const nodes = new Map(Array.from(canvas.querySelectorAll<HTMLElement>('[data-atlas-concept]'))
      .map(node => [node.getAttribute('data-atlas-concept'), node]));
    for (const edge of edges) {
      const from = nodes.get(edge.studyFrom), to = nodes.get(edge.studyTo);
      if (!from || !to) continue;
      const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
      if (!a.width || !b.width) continue;
      const rightward = b.left + b.width / 2 >= a.left + a.width / 2;
      const x1 = (rightward ? a.right : a.left) - base.left + canvas.scrollLeft;
      const x2 = (rightward ? b.left : b.right) - base.left + canvas.scrollLeft;
      const y1 = a.top + a.height / 2 - base.top + canvas.scrollTop;
      const y2 = b.top + b.height / 2 - base.top + canvas.scrollTop;
      const bend = Math.max(20, Math.abs(x2 - x1) / 2) * (rightward ? 1 : -1);
      const d = `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
      for (const hit of [false, true]) {
        const path = doc.createElementNS(SVG, 'path');
        path.setAttribute('d', d);
        path.setAttribute('data-relation-id', edge.id);
        path.setAttribute('data-from', edge.studyFrom);
        path.setAttribute('data-to', edge.studyTo);
        path.setAttribute('class', hit ? 'los-atlas-edge-hit' :
          `los-atlas-edge los-atlas-edge--${edge.type}${host.edgeId === edge.id ? ' is-selected' : ''}`);
        if (!hit) path.setAttribute('marker-end', `url(#${markerId})`);
        else {
          const title = doc.createElementNS(SVG, 'title');
          title.textContent = canonicalSentence(graph, edge);
          path.append(title);
          path.addEventListener('click', () => host.inspectEdge(edge.id));
        }
        svg.append(path);
      }
    }
  };
  const schedule = () => {
    if (!disposed && !frame) frame = win.requestAnimationFrame(draw);
  };
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
  observer?.observe(canvas);
  canvas.querySelectorAll<HTMLElement>('[data-atlas-concept]').forEach(node => observer?.observe(node));
  win.addEventListener('resize', schedule);
  schedule();
  host.addRenderCleanup(() => {
    disposed = true;
    if (frame) win.cancelAnimationFrame(frame);
    observer?.disconnect();
    win.removeEventListener('resize', schedule);
    svg.remove();
  });
}
