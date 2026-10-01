import type { AtlasNeighbourhood, AtlasNode } from './graph';

/** A bounded picture; the full authored neighbourhood remains the text model. */
export function conceptPlaneSlice(view: AtlasNeighbourhood, perLane = 4) {
  const limit = Math.max(1, Math.trunc(perLane));
  const counts = new Map<string, number>();
  const ids = new Set<string>([view.focus.id]);
  // Pick from the focus outward. A distant node whose connector was omitted
  // belongs in the named remainder, rather than floating without its path.
  const outward = [...view.nodes].sort((left, right) => left.distance - right.distance);
  for (const node of outward) {
    if (node.direction === 'focus') continue;
    const key = `${node.direction}:${node.column}`;
    const count = counts.get(key) ?? 0;
    const connected = node.direction === 'related'
      ? view.semanticEdges.some(edge => (edge.from === node.concept.id && ids.has(edge.to))
        || (edge.to === node.concept.id && ids.has(edge.from)))
      : view.strictEdges.some(edge => node.direction === 'prerequisite'
        ? edge.to === node.concept.id && ids.has(edge.from)
        : edge.from === node.concept.id && ids.has(edge.to));
    if (count >= limit || !connected) continue;
    ids.add(node.concept.id);
    counts.set(key, count + 1);
  }
  const shown: AtlasNode[] = view.nodes.filter(node => ids.has(node.concept.id));
  const omitted: AtlasNode[] = view.nodes.filter(node => !ids.has(node.concept.id));
  const visible = (edge: { from: string; to: string }) => ids.has(edge.from) && ids.has(edge.to);
  return {
    nodes: shown,
    omitted,
    strictEdges: view.strictEdges.filter(visible),
    semanticEdges: view.semanticEdges.filter(visible),
  };
}
