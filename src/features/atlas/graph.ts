import { compareStrings, foldCase } from '../../sorting';
import type {
  ModuleConceptEvidence,
  ProjectionRecord,
  RelationRecord,
} from '../../contracts/manifest';
import type { ManifestStore } from '../../manifest-store';
import {
  asLabel as projectedLabel,
  asString as projectedString,
} from '../../projection/readers';

/**
 * The focused concept graph, as a read model (ADR-016).
 *
 * Core authors `knowledge/concept-relations.yaml`; this file decides nothing
 * about meaning and everything about traversal. Three rules hold throughout,
 * and each of them is a decision that has already been taken:
 *
 * 1. **Two layers, one of which orders.** `requires` and `builds-on` are the
 *    strict layer and the only thing a learning order may be derived from.
 *    The semantic types explain knowledge, may cycle, and never reorder a
 *    prerequisite. A type is never promoted between layers to make the graph
 *    look better connected, and a type outside both vocabularies is
 *    `unrecognized` — kept, counted, named, and excluded from every traversal.
 *
 * 2. **Nothing is silently dropped.** A depth bound, a lens, a missing concept
 *    record and a broken citation are all reported by name. An authored
 *    relation that cannot be fully resolved is still an authored relation;
 *    hiding it would quietly shorten a learning path.
 *
 * 3. **Modules are evidence, never an axis.** No edge here is derived from
 *    shared module membership (ADR-015 decision 2, ADR-016 decision 5).
 *
 * Everything is pure. No DOM, no Obsidian, no store mutation — the same focus,
 * depth and lens over one manifest snapshot always produce the same result.
 */

/** The layer that defines learning order. Nothing else does. */
export const STRICT_RELATION_TYPES = ['builds-on', 'requires'] as const;

/** The layer that explains knowledge. It may cycle and it orders nothing. */
export const SEMANTIC_RELATION_TYPES = [
  'applies-in',
  'contrasts-with',
  'derives',
  'equivalent-to',
  'generalizes',
  'motivates',
] as const;

export type StrictRelationType = typeof STRICT_RELATION_TYPES[number];
export type SemanticRelationType = typeof SEMANTIC_RELATION_TYPES[number];
export type RelationLayer = 'strict' | 'semantic' | 'unrecognized';

const STRICT = new Set<string>(STRICT_RELATION_TYPES);
const SEMANTIC = new Set<string>(SEMANTIC_RELATION_TYPES);

/**
 * The authored reading of each relation type, subject to object.
 *
 * `equivalent-to` has no instances in the current corpus. It is spelled out
 * here for the same reason the others are: the interface must render it
 * correctly the first time one is authored, having never seen one.
 */
const RELATION_PHRASES: Readonly<Record<string, string>> = {
  'applies-in': 'applies in',
  'builds-on': 'builds on',
  'contrasts-with': 'contrasts with',
  'derives': 'derives',
  'equivalent-to': 'is equivalent to',
  'generalizes': 'generalizes',
  'motivates': 'motivates',
  'requires': 'requires',
};

export function relationLayer(type: string): RelationLayer {
  if (STRICT.has(type)) return 'strict';
  if (SEMANTIC.has(type)) return 'semantic';
  return 'unrecognized';
}

/** The authored verb, or the raw type when the vocabulary does not carry it. */
export function relationPhrase(type: string): string {
  return RELATION_PHRASES[type] ?? type;
}

export interface AtlasConcept {
  readonly id: string;
  readonly label: string;
  /** Normalized label; the primary sort key, with `id` as the tiebreak. */
  readonly sortKey: string;
  /**
   * Null when a relation or module edge names a concept the projection does
   * not carry. The concept still appears, under its identifier.
   */
  readonly record: ProjectionRecord | null;
}

export interface AtlasEdge {
  /**
   * The canonical `from--type--to` identity, unchanged by the direction an
   * arrow is drawn in. The generated Canvas uses the same spelling, so two
   * projections of one authored row cannot disagree about which row it is.
   */
  readonly id: string;
  readonly from: string;
  readonly type: string;
  readonly to: string;
  readonly context: string | null;
  readonly source: string | null;
  readonly layer: RelationLayer;
  /** Arrow tail in study order. */
  readonly studyFrom: string;
  /** Arrow head in study order. */
  readonly studyTo: string;
  /** Strict layer only: the concept to learn first. */
  readonly prerequisiteId: string | null;
  /** Strict layer only: the concept it unlocks. */
  readonly dependentId: string | null;
}

export interface AtlasModule {
  readonly id: string;
  readonly label: string;
  /** Code, else initials: a chip has room for a name, not for a title. */
  readonly shortLabel: string;
  readonly sortKey: string;
  readonly actionable: boolean;
  readonly conceptCount: number;
}

export interface AtlasGraph {
  readonly concepts: readonly AtlasConcept[];
  readonly conceptById: ReadonlyMap<string, AtlasConcept>;
  readonly edges: readonly AtlasEdge[];
  /** Every edge by its canonical `from--type--to` identity. */
  readonly relationByIdentity: ReadonlyMap<string, AtlasEdge>;
  /** Strict edges whose dependent is the key: that concept's prerequisites. */
  readonly prerequisiteEdges: ReadonlyMap<string, readonly AtlasEdge[]>;
  /** Strict edges whose prerequisite is the key: that concept's dependents. */
  readonly dependentEdges: ReadonlyMap<string, readonly AtlasEdge[]>;
  /** Semantic edges touching the key at either end. */
  readonly semanticEdges: ReadonlyMap<string, readonly AtlasEdge[]>;
  /** Edges whose type is in neither vocabulary, touching the key. */
  readonly unrecognizedEdges: ReadonlyMap<string, readonly AtlasEdge[]>;
  readonly modules: readonly AtlasModule[];
  readonly modulesByConcept: ReadonlyMap<string, readonly string[]>;
  readonly conceptsByModule: ReadonlyMap<string, readonly string[]>;
  /** Keyed by `moduleConceptKey`; the evidence that licenses one module chip. */
  readonly evidenceByModuleConcept: ReadonlyMap<
    string,
    readonly ModuleConceptEvidence[]
  >;
  /** Only the citations that resolve. An absent key is not an absent source. */
  readonly resolvedSources: ReadonlyMap<string, ProjectionRecord>;
}

export type AtlasGraphStore = Pick<
  ManifestStore,
  'get' | 'of' | 'modules' | 'moduleConceptEdges' | 'relations'
>;

export function moduleConceptKey(moduleId: string, conceptId: string): string {
  return `${moduleId}\u0000${conceptId}`;
}

function normalizedSortKey(label: string): string {
  return foldCase(label.trim());
}

function compareConcepts(left: AtlasConcept, right: AtlasConcept): number {
  return compareStrings(left.sortKey, right.sortKey)
    || compareStrings(left.id, right.id);
}

function compareModules(left: AtlasModule, right: AtlasModule): number {
  if (left.actionable !== right.actionable) return left.actionable ? -1 : 1;
  return compareStrings(left.sortKey, right.sortKey)
    || compareStrings(left.id, right.id);
}

function shortModuleLabel(record: ProjectionRecord, label: string): string {
  const code = projectedString(record.code);
  if (code) return code;

  const words = label.split(/\s+/).filter(Boolean);
  return words.length > 2
    ? words.map((word: string) => word.charAt(0)).join('').toUpperCase()
    : label;
}

function edgeIdentity(relation: RelationRecord): string {
  return `${relation.from}--${relation.type}--${relation.to}`;
}

function push<T>(index: Map<string, T[]>, key: string, value: T): void {
  const existing = index.get(key);
  if (existing) existing.push(value);
  else index.set(key, [value]);
}

function toEdge(relation: RelationRecord): AtlasEdge {
  const layer = relationLayer(relation.type);
  // Authoring reads subject to object — "logistic regression requires
  // conditional probability" — so on the strict layer the object is the
  // prerequisite and the arrow runs the other way. The semantic layer keeps
  // the authored direction precisely because it claims no order.
  const strict = layer === 'strict';

  return {
    id: edgeIdentity(relation),
    from: relation.from,
    type: relation.type,
    to: relation.to,
    context: relation.context,
    source: relation.source,
    layer,
    studyFrom: strict ? relation.to : relation.from,
    studyTo: strict ? relation.from : relation.to,
    prerequisiteId: strict ? relation.to : null,
    dependentId: strict ? relation.from : null,
  };
}

export function buildAtlasGraph(store: AtlasGraphStore): AtlasGraph {
  const conceptById = new Map<string, AtlasConcept>();

  const remember = (id: string): AtlasConcept => {
    const known = conceptById.get(id);
    if (known) return known;

    const record = store.get(id);
    // A relation may name a concept the projection does not carry. The concept
    // is kept under its identifier rather than dropped, so the edge stays
    // visible and the gap stays nameable.
    const label = record ? projectedLabel(record, id) : id;
    const concept: AtlasConcept = {
      id,
      label,
      sortKey: normalizedSortKey(label),
      record: record ?? null,
    };
    conceptById.set(id, concept);
    return concept;
  };

  for (const record of store.of('concept')) {
    const id = projectedString(record.id);
    if (id) remember(id);
  }

  const edges: AtlasEdge[] = [];
  const relationByIdentity = new Map<string, AtlasEdge>();
  const prerequisiteEdges = new Map<string, AtlasEdge[]>();
  const dependentEdges = new Map<string, AtlasEdge[]>();
  const semanticEdges = new Map<string, AtlasEdge[]>();
  const unrecognizedEdges = new Map<string, AtlasEdge[]>();
  const resolvedSources = new Map<string, ProjectionRecord>();

  for (const relation of store.relations()) {
    const edge = toEdge(relation);
    // One authored row is one edge. A duplicate identity is the same claim
    // twice, and indexing it twice would double every count derived from it.
    if (relationByIdentity.has(edge.id)) continue;

    relationByIdentity.set(edge.id, edge);
    edges.push(edge);
    remember(edge.from);
    remember(edge.to);

    if (edge.source && !resolvedSources.has(edge.source)) {
      const record = store.get(edge.source);
      if (record) resolvedSources.set(edge.source, record);
    }

    if (edge.layer === 'strict') {
      push(prerequisiteEdges, edge.from, edge);
      push(dependentEdges, edge.to, edge);
    } else if (edge.layer === 'semantic') {
      push(semanticEdges, edge.from, edge);
      if (edge.to !== edge.from) push(semanticEdges, edge.to, edge);
    } else {
      push(unrecognizedEdges, edge.from, edge);
      if (edge.to !== edge.from) push(unrecognizedEdges, edge.to, edge);
    }
  }

  const modulesByConcept = new Map<string, string[]>();
  const conceptsByModule = new Map<string, string[]>();
  const evidenceByModuleConcept = new Map<
    string,
    readonly ModuleConceptEvidence[]
  >();

  for (const edge of store.moduleConceptEdges()) {
    const moduleId = projectedString(edge.module_id);
    const conceptId = projectedString(edge.concept_id);
    // Core refuses to publish an unevidenced edge and the decoder refuses to
    // accept one. Refusing it here too means a module chip can never appear
    // without a reason, whatever went wrong upstream.
    if (!moduleId || !conceptId || !edge.evidence?.length) continue;

    const key = moduleConceptKey(moduleId, conceptId);
    if (evidenceByModuleConcept.has(key)) continue;

    evidenceByModuleConcept.set(key, edge.evidence);
    remember(conceptId);
    push(modulesByConcept, conceptId, moduleId);
    push(conceptsByModule, moduleId, conceptId);
  }

  const modules = store.modules()
    .flatMap((record): AtlasModule[] => {
      const id = projectedString(record.id);
      if (!id) return [];
      const label = projectedLabel(record, id);

      return [{
        id,
        label,
        shortLabel: shortModuleLabel(record, label),
        sortKey: normalizedSortKey(label),
        actionable: record.is_actionable === true,
        conceptCount: conceptsByModule.get(id)?.length ?? 0,
      }];
    })
    .sort(compareModules);

  const concepts = [...conceptById.values()].sort(compareConcepts);
  const order = (left: string, right: string): number =>
    compareConcepts(remember(left), remember(right));

  // Sort every adjacency by the concept at the far end, so a rendered column
  // reads in the same order as the outline beside it.
  for (const [index, farEnd] of [
    [prerequisiteEdges, (edge: AtlasEdge) => edge.to],
    [dependentEdges, (edge: AtlasEdge) => edge.from],
  ] as const) {
    for (const list of index.values()) {
      list.sort((left, right) =>
        order(farEnd(left), farEnd(right))
        || compareStrings(left.type, right.type)
        || compareStrings(left.id, right.id));
    }
  }

  for (const index of [semanticEdges, unrecognizedEdges]) {
    for (const [conceptId, list] of index) {
      list.sort((left, right) => {
        const leftFar = left.from === conceptId ? left.to : left.from;
        const rightFar = right.from === conceptId ? right.to : right.from;
        return compareStrings(left.type, right.type)
          || order(leftFar, rightFar)
          || compareStrings(left.id, right.id);
      });
    }
  }

  for (const list of modulesByConcept.values()) {
    list.sort((left, right) => compareStrings(left, right));
  }
  for (const list of conceptsByModule.values()) {
    list.sort(order);
  }

  return {
    concepts,
    conceptById,
    edges: edges.slice().sort((left, right) => compareStrings(left.id, right.id)),
    relationByIdentity,
    prerequisiteEdges,
    dependentEdges,
    semanticEdges,
    unrecognizedEdges,
    modules,
    modulesByConcept,
    conceptsByModule,
    evidenceByModuleConcept,
    resolvedSources,
  };
}

/* -------------------------------------------------------------------------
 * Reading one concept and one edge
 * ---------------------------------------------------------------------- */

export function conceptOf(graph: AtlasGraph, id: string): AtlasConcept {
  return graph.conceptById.get(id)
    ?? { id, label: id, sortKey: normalizedSortKey(id), record: null };
}

export function conceptLabel(graph: AtlasGraph, id: string): string {
  return conceptOf(graph, id).label;
}

/** *Logistic regression requires conditional probability.* */
export function canonicalSentence(graph: AtlasGraph, edge: AtlasEdge): string {
  return `${conceptLabel(graph, edge.from)} ${relationPhrase(edge.type)} ${conceptLabel(graph, edge.to)}`;
}

/**
 * *Learn conditional probability before logistic regression.*
 *
 * Null off the strict layer: a semantic relation states no order, and inventing
 * one for symmetry would be the exact promotion ADR-016 decision 2 forbids.
 */
export function studyOrderSentence(
  graph: AtlasGraph,
  edge: AtlasEdge,
): string | null {
  if (!edge.prerequisiteId || !edge.dependentId) return null;
  return `Learn ${conceptLabel(graph, edge.prerequisiteId)} before ${conceptLabel(graph, edge.dependentId)}`;
}

/**
 * The three provenance states, which must never collapse into two.
 *
 * `undocumented` is a normal, schema-permitted state and says so.
 * `unresolved` names the identifier that failed and offers no substitute —
 * the edge is still drawn, because dropping an authored relation over a broken
 * citation would silently shorten a learning path.
 */
export type AtlasProvenance =
  | { readonly state: 'resolved'; readonly sourceId: string; readonly label: string; readonly record: ProjectionRecord }
  | { readonly state: 'undocumented' }
  | { readonly state: 'unresolved'; readonly sourceId: string };

export function provenanceOf(
  graph: AtlasGraph,
  edge: AtlasEdge,
): AtlasProvenance {
  if (!edge.source) return { state: 'undocumented' };

  const record = graph.resolvedSources.get(edge.source);
  return record
    ? {
      state: 'resolved',
      sourceId: edge.source,
      label: projectedLabel(record, edge.source),
      record,
    }
    : { state: 'unresolved', sourceId: edge.source };
}

export function evidenceFor(
  graph: AtlasGraph,
  moduleId: string,
  conceptId: string,
): readonly ModuleConceptEvidence[] {
  return graph.evidenceByModuleConcept.get(
    moduleConceptKey(moduleId, conceptId),
  ) ?? [];
}

export function modulesFor(
  graph: AtlasGraph,
  conceptId: string,
): readonly AtlasModule[] {
  const ids = new Set(graph.modulesByConcept.get(conceptId) ?? []);
  return graph.modules.filter((module) => ids.has(module.id));
}

/* -------------------------------------------------------------------------
 * The focused neighbourhood
 * ---------------------------------------------------------------------- */

export type AtlasDirection = 'prerequisite' | 'focus' | 'dependent' | 'related';

export interface AtlasNode {
  readonly concept: AtlasConcept;
  readonly direction: AtlasDirection;
  /** Strict hops from the focus; 0 for the focus itself. */
  readonly distance: number;
  /** Prerequisites left of the focus, dependents right of it. */
  readonly column: number;
}

/**
 * What the current view does not show, named rather than counted alone.
 *
 * A number on its own ("3 more") tells a learner that something is missing
 * without telling them whether it matters. These are concepts, so the shell can
 * list and open them.
 */
export interface AtlasRemainder {
  /** Strict prerequisites excluded by the depth bound. */
  readonly prerequisites: readonly AtlasConcept[];
  /** Strict dependents excluded by the depth bound. */
  readonly dependents: readonly AtlasConcept[];
  /** Semantic neighbours the current lens does not draw. */
  readonly semantic: readonly AtlasConcept[];
  /**
   * Neighbours reachable only through a relation type outside the authored
   * vocabulary. No traversal may use one, so none is ever drawn — which is
   * exactly why the concepts are named here instead of disappearing.
   */
  readonly unrecognized: readonly AtlasConcept[];
  readonly total: number;
}

export interface AtlasNeighbourhood {
  readonly focus: AtlasConcept;
  readonly depth: number;
  readonly nodes: readonly AtlasNode[];
  /** Left to right, prerequisites first; `columns[focusColumn]` holds the focus. */
  readonly columns: readonly (readonly AtlasNode[])[];
  readonly focusColumn: number;
  readonly strictEdges: readonly AtlasEdge[];
  readonly semanticEdges: readonly AtlasEdge[];
  readonly unrecognizedEdges: readonly AtlasEdge[];
  readonly beyond: AtlasRemainder;
}

export interface NeighbourhoodOptions {
  readonly depth?: number;
  /**
   * Whether a purely semantic neighbour joins the node set. Off, the semantic
   * layer is an overlay over the strict nodes; on, it can carry the whole view
   * — which it must, since most concepts carry no strict relation at all.
   */
  readonly includeSemanticNeighbours?: boolean;
}

export function neighbourhood(
  graph: AtlasGraph,
  focusId: string,
  options: NeighbourhoodOptions = {},
): AtlasNeighbourhood {
  const depth = Math.max(1, Math.trunc(options.depth ?? 1));
  const focus = conceptOf(graph, focusId);
  const placed = new Map<string, AtlasNode>();
  placed.set(focus.id, { concept: focus, direction: 'focus', distance: 0, column: 0 });

  /**
   * Walk one direction to the depth bound, and return the frontier it stops at.
   *
   * The returned ids are the nodes whose own neighbours in this direction lie
   * *beyond* the bound. That is the only honest source for the "N more"
   * remainder: collecting it instead from every edge with one endpoint inside
   * the view calls a concept a dependent of the focus when it merely shares a
   * prerequisite with it, and raising the depth never reveals it because the
   * directional traversal correctly does not reach it (2026-09-05 audit, F09).
   */
  const walk = (
    direction: 'prerequisite' | 'dependent',
  ): readonly string[] => {
    let frontier = [focus.id];

    for (let distance = 1; distance <= depth; distance += 1) {
      const next: string[] = [];

      for (const id of frontier) {
        const edges = direction === 'prerequisite'
          ? graph.prerequisiteEdges.get(id) ?? []
          : graph.dependentEdges.get(id) ?? [];

        for (const edge of edges) {
          const neighbour = direction === 'prerequisite' ? edge.to : edge.from;
          // First placement wins, and prerequisites are walked first. Core's
          // acyclicity invariant means this only arbitrates a diamond, never a
          // contradiction — but the traversal stays total either way.
          if (placed.has(neighbour)) continue;

          placed.set(neighbour, {
            concept: conceptOf(graph, neighbour),
            direction,
            distance,
            column: direction === 'prerequisite' ? -distance : distance,
          });
          next.push(neighbour);
        }
      }

      frontier = next;
    }

    return frontier;
  };

  const prerequisiteFrontier = walk('prerequisite');
  const dependentFrontier = walk('dependent');

  const semanticNeighbours = new Map<string, AtlasConcept>();
  for (const edge of graph.semanticEdges.get(focus.id) ?? []) {
    const other = edge.from === focus.id ? edge.to : edge.from;
    if (placed.has(other) || semanticNeighbours.has(other)) continue;
    semanticNeighbours.set(other, conceptOf(graph, other));
  }

  const unrecognizedNeighbours = new Map<string, AtlasConcept>();
  for (const edge of graph.unrecognizedEdges.get(focus.id) ?? []) {
    const other = edge.from === focus.id ? edge.to : edge.from;
    if (placed.has(other) || unrecognizedNeighbours.has(other)) continue;
    unrecognizedNeighbours.set(other, conceptOf(graph, other));
  }

  if (options.includeSemanticNeighbours) {
    for (const concept of semanticNeighbours.values()) {
      placed.set(concept.id, {
        concept,
        direction: 'related',
        distance: 1,
        column: 0,
      });
    }
    semanticNeighbours.clear();
  }

  // Column, then the focus ahead of anything sharing its column, then label.
  // The semantic band sits in the focus column precisely because it claims no
  // order relative to the focus — but the focus still reads first.
  const nodes = [...placed.values()].sort((left, right) =>
    left.column - right.column
    || Number(left.direction !== 'focus') - Number(right.direction !== 'focus')
    || compareConcepts(left.concept, right.concept));

  const columnValues = [...new Set(nodes.map((node) => node.column))]
    .sort((left, right) => left - right);
  const columns = columnValues.map((column) =>
    nodes.filter((node) => node.column === column));
  const focusColumn = columnValues.indexOf(0);

  const inside = (id: string): boolean => placed.has(id);
  const strictEdges: AtlasEdge[] = [];
  const drawnSemantic: AtlasEdge[] = [];
  const drawnUnrecognized: AtlasEdge[] = [];

  for (const edge of graph.edges) {
    const both = inside(edge.from) && inside(edge.to);

    if (edge.layer === 'strict') {
      if (both) strictEdges.push(edge);
      continue;
    }

    if (!both) continue;
    if (edge.layer === 'semantic') drawnSemantic.push(edge);
    else drawnUnrecognized.push(edge);
  }

  /**
   * One more step in the stated direction from where the walk stopped.
   *
   * Everything named here is reachable from the focus by following the same
   * kind of edge, so raising the depth by one is guaranteed to bring it into
   * the view — which is precisely the promise the "N more" affordance makes.
   */
  const beyondFrom = (
    frontier: readonly string[],
    direction: 'prerequisite' | 'dependent',
  ): Map<string, AtlasConcept> => {
    const found = new Map<string, AtlasConcept>();
    for (const id of frontier) {
      const edges = direction === 'prerequisite'
        ? graph.prerequisiteEdges.get(id) ?? []
        : graph.dependentEdges.get(id) ?? [];
      for (const edge of edges) {
        const neighbour = direction === 'prerequisite' ? edge.to : edge.from;
        if (placed.has(neighbour) || found.has(neighbour)) continue;
        found.set(neighbour, conceptOf(graph, neighbour));
      }
    }
    return found;
  };

  const beyondPrerequisites = beyondFrom(prerequisiteFrontier, 'prerequisite');
  const beyondDependents = beyondFrom(dependentFrontier, 'dependent');

  const sortedConcepts = (
    values: Iterable<AtlasConcept>,
  ): readonly AtlasConcept[] => [...values].sort(compareConcepts);

  const prerequisites = sortedConcepts(beyondPrerequisites.values());
  const dependents = sortedConcepts(beyondDependents.values());
  const semantic = sortedConcepts(semanticNeighbours.values());
  const unrecognized = sortedConcepts(unrecognizedNeighbours.values());

  return {
    focus,
    depth,
    nodes,
    columns,
    focusColumn,
    strictEdges,
    semanticEdges: drawnSemantic,
    unrecognizedEdges: drawnUnrecognized,
    beyond: {
      prerequisites,
      dependents,
      semantic,
      unrecognized,
      total: prerequisites.length
        + dependents.length
        + semantic.length
        + unrecognized.length,
    },
  };
}

/* -------------------------------------------------------------------------
 * Ancestor closure, layers, and the cycle that blocks them
 * ---------------------------------------------------------------------- */

/**
 * Every concept that must be understood before the focus, however far back.
 *
 * Terminates on a cycle as well as on a DAG: `seen` gates enqueueing, so a
 * cycle among prerequisites bounds the walk instead of hanging it. Whether the
 * result may be presented as an order is `strictPath`'s question, not this
 * one's.
 */
export function strictAncestors(
  graph: AtlasGraph,
  focusId: string,
): readonly AtlasConcept[] {
  const seen = new Set<string>([focusId]);
  const collected = new Map<string, AtlasConcept>();
  const pending = [focusId];

  while (pending.length) {
    const id = pending.pop();
    if (id === undefined) break;

    for (const edge of graph.prerequisiteEdges.get(id) ?? []) {
      if (seen.has(edge.to)) continue;
      seen.add(edge.to);
      collected.set(edge.to, conceptOf(graph, edge.to));
      pending.push(edge.to);
    }
  }

  return [...collected.values()].sort(compareConcepts);
}

/**
 * One deterministic cycle among strict edges, or null.
 *
 * Core's `REL-PREREQ-CYCLE` makes this unreachable on a valid registry. It is
 * kept because the alternative to detecting a cycle is presenting an order the
 * data does not support, and a UI that assumes an invariant it cannot see is a
 * UI that fails silently when the invariant is one day relaxed.
 */
export function findStrictCycle(
  graph: AtlasGraph,
  scope?: ReadonlySet<string>,
): readonly string[] | null {
  const within = (id: string): boolean => !scope || scope.has(id);
  const roots = graph.concepts
    .map((concept) => concept.id)
    .filter(within);
  const state = new Map<string, 'open' | 'closed'>();
  const trail: string[] = [];

  const prerequisitesOf = (id: string): string[] =>
    (graph.prerequisiteEdges.get(id) ?? [])
      .map((edge) => edge.to)
      .filter(within);

  for (const root of roots) {
    if (state.has(root)) continue;

    // Explicit stack: the corpus is small, but a recursive walk over authored
    // data is a stack overflow waiting for one deep chain.
    const stack: Array<{ id: string; queue: string[]; at: number }> = [
      { id: root, queue: prerequisitesOf(root), at: 0 },
    ];
    state.set(root, 'open');
    trail.push(root);

    while (stack.length) {
      const frame = stack[stack.length - 1];
      if (!frame) break;

      const next = frame.queue[frame.at];
      frame.at += 1;

      if (next === undefined) {
        state.set(frame.id, 'closed');
        stack.pop();
        trail.pop();
        continue;
      }

      if (state.get(next) === 'closed') continue;
      if (state.get(next) === 'open') {
        const start = trail.indexOf(next);
        return [...trail.slice(start), next];
      }

      state.set(next, 'open');
      trail.push(next);
      stack.push({ id: next, queue: prerequisitesOf(next), at: 0 });
    }
  }

  return null;
}

export type AtlasPath =
  | {
      readonly ok: true;
      /** Prerequisites first; the focus is alone in the final layer. */
      readonly layers: readonly (readonly AtlasConcept[])[];
      readonly edges: readonly AtlasEdge[];
      readonly total: number;
    }
  | { readonly ok: false; readonly cycle: readonly string[] };

/**
 * The strict ancestor closure of one concept, laid out in study order.
 *
 * A concept sits one layer after its deepest prerequisite, so reading the
 * layers left to right never asks for something not yet introduced.
 */
export function strictPath(graph: AtlasGraph, focusId: string): AtlasPath {
  const ancestors = strictAncestors(graph, focusId);
  const scope = new Set<string>([focusId, ...ancestors.map((concept) => concept.id)]);
  const cycle = findStrictCycle(graph, scope);
  if (cycle) return { ok: false, cycle };

  const depthOf = new Map<string, number>();

  const resolve = (id: string): number => {
    const known = depthOf.get(id);
    if (known !== undefined) return known;

    let deepest = 0;
    for (const edge of graph.prerequisiteEdges.get(id) ?? []) {
      if (!scope.has(edge.to)) continue;
      deepest = Math.max(deepest, resolve(edge.to) + 1);
    }
    depthOf.set(id, deepest);
    return deepest;
  };

  for (const id of scope) resolve(id);

  const layers: AtlasConcept[][] = [];
  for (const id of scope) {
    const index = depthOf.get(id) ?? 0;
    while (layers.length <= index) layers.push([]);
    layers[index]?.push(conceptOf(graph, id));
  }
  for (const layer of layers) layer.sort(compareConcepts);

  const edges = graph.edges.filter((edge) =>
    edge.layer === 'strict' && scope.has(edge.from) && scope.has(edge.to));

  return { ok: true, layers, edges, total: scope.size };
}

/* -------------------------------------------------------------------------
 * Lenses over the whole corpus
 * ---------------------------------------------------------------------- */

export interface AtlasBridge {
  readonly concept: AtlasConcept;
  readonly modules: readonly AtlasModule[];
  readonly moduleCount: number;
}

/**
 * Concepts whose evidence crosses more than one module (ADR-015's question).
 *
 * A bridge is a claim about where a concept is taught, never about a relation
 * between the modules — no edge anywhere in this file comes from shared module
 * membership.
 */
export function bridges(graph: AtlasGraph): readonly AtlasBridge[] {
  return graph.concepts
    .flatMap((concept): AtlasBridge[] => {
      const modules = modulesFor(graph, concept.id);
      return modules.length > 1
        ? [{ concept, modules, moduleCount: modules.length }]
        : [];
    })
    .sort((left, right) =>
      right.moduleCount - left.moduleCount
      || compareConcepts(left.concept, right.concept));
}

export type AtlasDiagnosticKind = 'concepts' | 'relations' | 'modules';

export interface AtlasDiagnostic {
  readonly id: string;
  readonly title: string;
  /**
   * What the count means. Every one of these says what absence *is*, because
   * "no authored evidence" and "not relevant" are different facts and the
   * screen must not let a reader mistake one for the other.
   */
  readonly meaning: string;
  readonly kind: AtlasDiagnosticKind;
  readonly count: number;
  readonly conceptIds: readonly string[];
  readonly edgeIds: readonly string[];
  readonly moduleIds: readonly string[];
}

function diagnostic(
  id: string,
  title: string,
  meaning: string,
  kind: AtlasDiagnosticKind,
  records: {
    conceptIds?: readonly string[];
    edgeIds?: readonly string[];
    moduleIds?: readonly string[];
  },
): AtlasDiagnostic {
  const conceptIds = records.conceptIds ?? [];
  const edgeIds = records.edgeIds ?? [];
  const moduleIds = records.moduleIds ?? [];

  return {
    id,
    title,
    meaning,
    kind,
    count: kind === 'concepts'
      ? conceptIds.length
      : kind === 'relations' ? edgeIds.length : moduleIds.length,
    conceptIds,
    edgeIds,
    moduleIds,
  };
}

/**
 * The corpus read against itself. Every entry carries its records, so a count
 * is a way in rather than a verdict.
 */
export function diagnostics(graph: AtlasGraph): readonly AtlasDiagnostic[] {
  const conceptIds = (predicate: (concept: AtlasConcept) => boolean): string[] =>
    graph.concepts.filter(predicate).map((concept) => concept.id);

  const inStrict = (id: string): boolean =>
    Boolean(graph.prerequisiteEdges.get(id)?.length)
    || Boolean(graph.dependentEdges.get(id)?.length);

  const edgeIds = (predicate: (edge: AtlasEdge) => boolean): string[] =>
    graph.edges.filter(predicate).map((edge) => edge.id);

  const entries: AtlasDiagnostic[] = [
    diagnostic(
      'strict-roots',
      'Concepts with no authored prerequisites',
      'Nothing in the registry has to be learned first. That is a statement about what has been authored, not a claim that the concept is foundational.',
      'concepts',
      { conceptIds: conceptIds((concept) => inStrict(concept.id) && !graph.prerequisiteEdges.get(concept.id)?.length) },
    ),
    diagnostic(
      'strict-leaves',
      'Concepts nothing yet builds on',
      'No authored relation names this concept as a prerequisite. It does not mean the concept is advanced, or finished.',
      'concepts',
      { conceptIds: conceptIds((concept) => inStrict(concept.id) && !graph.dependentEdges.get(concept.id)?.length) },
    ),
    diagnostic(
      'unrelated-concepts',
      'Concepts with no authored relation',
      'The concept exists and carries no relation of any layer. Unwritten, not unrelated.',
      'concepts',
      {
        conceptIds: conceptIds((concept) =>
          !inStrict(concept.id)
          && !graph.semanticEdges.get(concept.id)?.length
          && !graph.unrecognizedEdges.get(concept.id)?.length),
      },
    ),
    diagnostic(
      'concepts-without-module-evidence',
      'Concepts no module evidences',
      'No module publishes a stage or knowledge node for this concept. It says where teaching has been recorded, not where the concept belongs.',
      'concepts',
      { conceptIds: conceptIds((concept) => !graph.modulesByConcept.get(concept.id)?.length) },
    ),
    diagnostic(
      'unresolved-concepts',
      'Relations naming an unknown concept',
      'A relation endpoint the projection does not carry. The relation is still drawn, under the identifier it names.',
      'concepts',
      { conceptIds: conceptIds((concept) => concept.record === null) },
    ),
    diagnostic(
      'relations-without-context',
      'Relations with no context note',
      'The relation is authored and valid; nothing records why. Context is optional by schema.',
      'relations',
      { edgeIds: edgeIds((edge) => edge.context === null) },
    ),
    diagnostic(
      'relations-without-source',
      'Relations with no recorded source',
      'Undocumented, and permitted: the schema allows an absent source. Nothing may be substituted for one.',
      'relations',
      { edgeIds: edgeIds((edge) => edge.source === null) },
    ),
    diagnostic(
      'relations-with-unresolved-source',
      'Relations whose source does not resolve',
      'The citation names a record the projection does not carry. The identifier is reported exactly and no stand-in is offered.',
      'relations',
      {
        edgeIds: edgeIds((edge) =>
          edge.source !== null && !graph.resolvedSources.has(edge.source)),
      },
    ),
    diagnostic(
      'relations-outside-vocabulary',
      'Relations outside the authored vocabulary',
      'The type is neither strict nor semantic, so it orders nothing and explains nothing here. It is kept and named rather than reclassified.',
      'relations',
      { edgeIds: edgeIds((edge) => edge.layer === 'unrecognized') },
    ),
    diagnostic(
      'modules-without-concepts',
      'Modules publishing no concept evidence',
      'The module has no stage or knowledge node tagged with a concept. Its column is empty because nothing has been mapped, not because nothing is taught.',
      'modules',
      { moduleIds: graph.modules.filter((module) => module.conceptCount === 0).map((module) => module.id) },
    ),
  ];

  const cycle = findStrictCycle(graph);
  if (cycle) {
    entries.push(diagnostic(
      'strict-cycle',
      'Prerequisite cycle',
      'Concepts that require one another in a loop. No learning order exists over them, so path derivation is blocked until the registry is corrected.',
      'concepts',
      { conceptIds: cycle },
    ));
  }

  return entries;
}

export interface AtlasSummary {
  readonly concepts: number;
  readonly relations: number;
  readonly strictRelations: number;
  readonly semanticRelations: number;
  readonly unrecognizedRelations: number;
  readonly conceptsInStrictLayer: number;
  readonly bridges: number;
  readonly modulesPublishing: number;
  readonly modules: number;
}

/** The corpus in numbers, for the line under the focus question. */
export function summarize(graph: AtlasGraph): AtlasSummary {
  const strictNodes = new Set<string>();
  let strict = 0;
  let semantic = 0;
  let unrecognized = 0;

  for (const edge of graph.edges) {
    if (edge.layer === 'strict') {
      strict += 1;
      strictNodes.add(edge.from);
      strictNodes.add(edge.to);
    } else if (edge.layer === 'semantic') semantic += 1;
    else unrecognized += 1;
  }

  return {
    concepts: graph.concepts.length,
    relations: graph.edges.length,
    strictRelations: strict,
    semanticRelations: semantic,
    unrecognizedRelations: unrecognized,
    conceptsInStrictLayer: strictNodes.size,
    bridges: bridges(graph).length,
    modulesPublishing: graph.modules.filter((module) => module.conceptCount > 0).length,
    modules: graph.modules.length,
  };
}
