import type { AtlasLensV1 } from '../../contracts/route-v1';
import {
  canonicalSentence,
  modulesFor,
  provenanceOf,
  studyOrderSentence,
  type AtlasEdge,
  type AtlasGraph,
  type AtlasNeighbourhood,
  type AtlasProvenance,
} from './graph';

/**
 * Every sentence the Atlas says, built once.
 *
 * The subgraph summary has three consumers — the band under the controls, the
 * outline's heading, and the live region that announces a change of focus. If
 * each built its own wording they would drift, and the reader would be told
 * two slightly different things about one screen. So the string is composed
 * here, from the read model, and the three places render the same value.
 *
 * Pure: no DOM, no host. Copy is part of the product, and it belongs where it
 * can be read and tested without a browser.
 */

export function plural(
  count: number,
  singular: string,
  many = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : many}`;
}

/** The question this view answers, derived from lens plus focus. */
export function focusQuestion(
  lens: AtlasLensV1,
  label: string | null,
): string {
  switch (lens) {
    case 'path':
      return label
        ? `Everything I would have to work through to reach ${label}`
        : 'Everything I would have to work through to reach a concept';
    case 'semantic':
      return label
        ? `What does ${label} relate to that is not a prerequisite?`
        : 'What does a concept relate to that is not a prerequisite?';
    case 'bridges':
      return 'Which concepts are taught in more than one module?';
    case 'diagnostics':
      return 'What has the relation registry not yet been told?';
    case 'prerequisites':
    default:
      return label
        ? `What must I understand to derive ${label}?`
        : 'What must I understand to derive a concept?';
  }
}

/**
 * The one summary string.
 *
 * It states counts by relation class, what the lens is not drawing, what the
 * depth bound excludes, and that nothing here is inferred. Every number comes
 * from the read model's indexes; none is written into the copy.
 */
export function subgraphSummary(
  graph: AtlasGraph,
  view: AtlasNeighbourhood,
): string {
  const prerequisites = graph.prerequisiteEdges.get(view.focus.id)?.length ?? 0;
  const dependents = graph.dependentEdges.get(view.focus.id)?.length ?? 0;
  const modules = new Set<string>();

  for (const node of view.nodes) {
    for (const module of graph.modulesByConcept.get(node.concept.id) ?? []) {
      modules.add(module);
    }
  }

  const parts = [
    modules.size
      ? `${plural(prerequisites, 'authored prerequisite')} across ${plural(modules.size, 'module')}`
      : plural(prerequisites, 'authored prerequisite'),
    `${plural(dependents, 'authored dependent')}`,
  ];

  const semanticShown = view.semanticEdges.length;
  const semanticHidden = view.beyond.semantic.length;
  if (semanticHidden) {
    parts.push(`${plural(semanticHidden, 'semantic link')} this lens does not draw`);
  } else if (semanticShown) {
    parts.push(`${plural(semanticShown, 'semantic link')} shown, none of them in a path`);
  }

  const beyondDepth = view.beyond.prerequisites.length + view.beyond.dependents.length;
  if (beyondDepth) {
    parts.push(`${plural(beyondDepth, 'concept')} beyond depth ${view.depth}, named below`);
  }

  if (view.beyond.unrecognized.length) {
    parts.push(
      `${plural(view.beyond.unrecognized.length, 'concept')} reached only by a relation type outside the authored vocabulary`,
    );
  }

  return `${parts.join(' · ')}. Nothing on this screen is inferred.`;
}

/** Where a concept is taught, as a trail — evidence, never an axis. */
export function moduleTrail(graph: AtlasGraph, conceptId: string): string {
  const modules = modulesFor(graph, conceptId);
  if (!modules.length) return 'No module evidence recorded';
  return modules.map((module) => module.shortLabel).join(' · ');
}

/**
 * The relation, spelled out.
 *
 * Both readings, as ADR-016 decision 3 requires: the canonical sentence the
 * registry authored, and the study order it implies. A semantic relation gets
 * only the first, because it implies no order.
 */
export function relationSentences(
  graph: AtlasGraph,
  edge: AtlasEdge,
): readonly string[] {
  const study = studyOrderSentence(graph, edge);
  return study
    ? [`${canonicalSentence(graph, edge)}.`, `${study}.`]
    : [`${canonicalSentence(graph, edge)}.`];
}

/** The role the far end of an edge plays, relative to one concept. */
export function edgeRole(edge: AtlasEdge, conceptId: string): string {
  if (edge.layer === 'strict') {
    return edge.dependentId === conceptId ? 'Prerequisite' : 'Dependent';
  }
  if (edge.layer === 'semantic') return 'Semantic';
  return 'Outside the authored vocabulary';
}

export function otherEnd(edge: AtlasEdge, conceptId: string): string {
  return edge.from === conceptId ? edge.to : edge.from;
}

/**
 * How the relation reads on a row: the type, then the concept at the far end.
 * `requires Conditional probability`, `builds on Linear regression`.
 */
export function edgeHeadline(
  graph: AtlasGraph,
  edge: AtlasEdge,
  _conceptId: string,
): string {
  return canonicalSentence(graph, edge);
}

/**
 * Provenance in words. Three states, three sentences, and the unresolved one
 * names the identifier that failed rather than dressing the failure up.
 */
export function provenanceSentence(provenance: AtlasProvenance): string {
  switch (provenance.state) {
    case 'resolved':
      return `source ${provenance.label}`;
    case 'undocumented':
      return 'No source recorded';
    case 'unresolved':
    default:
      return `Source ${provenance.sourceId} does not resolve`;
  }
}

/** Whether the relation records why it holds. Optional by schema, so stated. */
export function contextSentence(edge: AtlasEdge): string {
  return edge.context ? 'rationale documented' : 'no rationale documented';
}

/** The whole provenance line under one relation row. */
export function provenanceLine(
  graph: AtlasGraph,
  edge: AtlasEdge,
  conceptId: string,
): string {
  const trail = moduleTrail(graph, otherEnd(edge, conceptId));
  return [
    trail,
    provenanceSentence(provenanceOf(graph, edge)),
    contextSentence(edge),
  ].join(' · ');
}
