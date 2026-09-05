'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { createSourceModuleLoader } = require('./source-module-loader');

const root = path.dirname(__dirname);
const load = createSourceModuleLoader(root);
const graphModule = load('src/features/atlas/graph.ts');
const {
  bridges,
  buildAtlasGraph,
  canonicalSentence,
  diagnostics,
  evidenceFor,
  findStrictCycle,
  modulesFor,
  neighbourhood,
  provenanceOf,
  relationLayer,
  relationPhrase,
  strictAncestors,
  strictPath,
  studyOrderSentence,
  summarize,
} = graphModule;

/**
 * A store stub with the same read boundary as ManifestStore: `get` resolves a
 * record or null, and the three collections come back as plain arrays.
 */
function storeOf({ records = [], relations = [], moduleEdges = [], modules = [] }) {
  const byId = new Map(records.map((record) => [record.id, record]));
  return {
    get: (id) => byId.get(id) ?? null,
    of: (type) => records.filter((record) => record.type === type),
    modules: () => modules,
    moduleConceptEdges: () => moduleEdges,
    relations: () => relations,
  };
}

function concept(id, title) {
  return { id, type: 'concept', title };
}

function relation(from, type, to, context = null, source = null) {
  return { from, type, to, context, source };
}

function diagnosticOf(entries, id) {
  const entry = entries.filter((row) => row.id === id)[0];
  assert.ok(entry, `diagnostic ${id} is published`);
  return entry;
}

/* --------------------------------------------------------------------------
 * The corpus under test.
 *
 * Shaped after the live registry rather than for convenience: a strict chain,
 * a diamond, every provenance state, a semantic-only concept, a relation type
 * outside the vocabulary, an `equivalent-to` the live corpus has zero of, and
 * an endpoint the projection does not carry.
 * ----------------------------------------------------------------------- */

const records = [
  concept('concept-derivative', 'Derivative'),
  concept('concept-gradient-descent', 'Gradient descent'),
  concept('concept-adam', 'Adam optimizer'),
  concept('concept-conditional-probability', 'Conditional probability'),
  concept('concept-logistic-regression', 'Logistic regression'),
  concept('concept-softmax', 'Softmax'),
  concept('concept-attention', 'Attention'),
  concept('concept-unrelated', 'Measure theory'),
  concept('concept-abbreviated', 'zeta ordering probe'),
  { id: 'note-optimisation', type: 'note', title: 'Optimisation wiring' },
  { id: 'note-stats', type: 'note', title: 'Statistics lecture 4' },
];

const relations = [
  relation('concept-gradient-descent', 'requires', 'concept-derivative',
    'the update step is a derivative', 'note-optimisation'),
  relation('concept-adam', 'builds-on', 'concept-gradient-descent',
    'momentum is an EMA of gradients', 'note-optimisation'),
  relation('concept-logistic-regression', 'requires', 'concept-conditional-probability',
    null, 'note-stats'),
  relation('concept-logistic-regression', 'requires', 'concept-softmax', null, null),
  relation('concept-attention', 'requires', 'concept-softmax',
    'attention weights are softmax-normalised', 'note-missing'),
  relation('concept-attention', 'derives', 'concept-logistic-regression', null, 'note-stats'),
  relation('concept-softmax', 'equivalent-to', 'concept-abbreviated', null, 'note-stats'),
  relation('concept-adam', 'applies-in', 'concept-ghost', null, 'note-optimisation'),
  relation('concept-derivative', 'inspires', 'concept-attention', null, 'note-optimisation'),
];

const modules = [
  { id: 'module-aml', type: 'module', title: 'Advanced Machine Learning', is_actionable: true },
  { id: 'module-stats', type: 'module', title: 'Statistics', is_actionable: false },
  { id: 'module-quiet', type: 'module', title: 'Quiet module', is_actionable: false },
];

const moduleEdges = [
  {
    module_id: 'module-aml',
    concept_id: 'concept-softmax',
    evidence: [{ kind: 'knowledge-node', unit_id: 'unit-aml-11', node_id: 'node-softmax' }],
  },
  {
    module_id: 'module-stats',
    concept_id: 'concept-softmax',
    evidence: [{
      kind: 'stage-concept',
      unit_id: 'unit-stats-04',
      study_map_id: 'map-stats-04',
      stage_id: 'stage-stats-04-2',
    }],
  },
  {
    module_id: 'module-aml',
    concept_id: 'concept-attention',
    evidence: [{ kind: 'knowledge-node', unit_id: 'unit-aml-11', node_id: 'node-attention' }],
  },
  // Refused upstream and refused here: an unevidenced edge licenses no chip.
  { module_id: 'module-quiet', concept_id: 'concept-derivative', evidence: [] },
];

const graph = buildAtlasGraph(storeOf({ records, relations, moduleEdges, modules }));

/* -------------------------------------------------------------------------
 * Layers, direction, and the two sentences
 * ---------------------------------------------------------------------- */

assert.equal(relationLayer('requires'), 'strict');
assert.equal(relationLayer('builds-on'), 'strict');
assert.equal(relationLayer('equivalent-to'), 'semantic');
assert.equal(relationLayer('applies-in'), 'semantic');
assert.equal(
  relationLayer('inspires'),
  'unrecognized',
  'a type outside both vocabularies is never promoted into one',
);

const strictEdge = graph.relationByIdentity.get(
  'concept-logistic-regression--requires--concept-conditional-probability',
);
assert.ok(strictEdge, 'edges keep their canonical from--type--to identity');
assert.equal(strictEdge.prerequisiteId, 'concept-conditional-probability');
assert.equal(strictEdge.dependentId, 'concept-logistic-regression');
assert.equal(
  strictEdge.studyFrom,
  'concept-conditional-probability',
  'a strict arrow points prerequisite to dependent',
);
assert.equal(strictEdge.studyTo, 'concept-logistic-regression');
assert.equal(
  canonicalSentence(graph, strictEdge),
  'Logistic regression requires Conditional probability',
);
assert.equal(
  studyOrderSentence(graph, strictEdge),
  'Learn Conditional probability before Logistic regression',
);

const semanticEdge = graph.relationByIdentity.get(
  'concept-attention--derives--concept-logistic-regression',
);
assert.equal(semanticEdge.prerequisiteId, null);
assert.equal(
  semanticEdge.studyFrom,
  'concept-attention',
  'the semantic layer keeps the authored direction because it claims no order',
);
assert.equal(
  studyOrderSentence(graph, semanticEdge),
  null,
  'a semantic relation states no study order and none is invented for it',
);

// `equivalent-to` has zero instances in the live corpus; it must still read.
const equivalence = graph.relationByIdentity.get(
  'concept-softmax--equivalent-to--concept-abbreviated',
);
assert.equal(equivalence.layer, 'semantic');
assert.equal(relationPhrase('equivalent-to'), 'is equivalent to');
assert.equal(
  canonicalSentence(graph, equivalence),
  'Softmax is equivalent to zeta ordering probe',
);
assert.equal(studyOrderSentence(graph, equivalence), null);

const unrecognized = graph.relationByIdentity.get(
  'concept-derivative--inspires--concept-attention',
);
assert.equal(unrecognized.layer, 'unrecognized');
assert.equal(
  canonicalSentence(graph, unrecognized),
  'Derivative inspires Attention',
  'an unknown type still renders, under the word that was authored',
);
assert.deepEqual(
  (graph.prerequisiteEdges.get('concept-attention') ?? []).map((edge) => edge.type),
  ['requires'],
  'an unrecognized type orders nothing',
);

/* -------------------------------------------------------------------------
 * Concepts the projection does not carry
 * ---------------------------------------------------------------------- */

const ghost = graph.conceptById.get('concept-ghost');
assert.ok(ghost, 'a relation endpoint with no record is kept, not dropped');
assert.equal(ghost.record, null);
assert.equal(ghost.label, 'concept-ghost', 'it appears under its identifier');

/* -------------------------------------------------------------------------
 * Provenance: three states that never collapse into two
 * ---------------------------------------------------------------------- */

assert.deepEqual(
  provenanceOf(graph, graph.relationByIdentity.get(
    'concept-gradient-descent--requires--concept-derivative',
  )),
  {
    state: 'resolved',
    sourceId: 'note-optimisation',
    label: 'Optimisation wiring',
    record: { id: 'note-optimisation', type: 'note', title: 'Optimisation wiring' },
  },
);
assert.deepEqual(
  provenanceOf(graph, graph.relationByIdentity.get(
    'concept-logistic-regression--requires--concept-softmax',
  )),
  { state: 'undocumented' },
  'an absent source is permitted by schema and reported as its own state',
);
assert.deepEqual(
  provenanceOf(graph, graph.relationByIdentity.get(
    'concept-attention--requires--concept-softmax',
  )),
  { state: 'unresolved', sourceId: 'note-missing' },
  'a broken citation names the exact identifier and offers no substitute',
);
assert.ok(
  graph.edges.some((edge) => edge.source === 'note-missing'),
  'the edge with the broken citation is still on the graph',
);

/* -------------------------------------------------------------------------
 * Module evidence — a lens, never an axis
 * ---------------------------------------------------------------------- */

assert.deepEqual(
  modulesFor(graph, 'concept-softmax').map((module) => module.id),
  ['module-aml', 'module-stats'],
  'actionable modules first, then by label',
);
assert.deepEqual(
  evidenceFor(graph, 'module-stats', 'concept-softmax'),
  [{
    kind: 'stage-concept',
    unit_id: 'unit-stats-04',
    study_map_id: 'map-stats-04',
    stage_id: 'stage-stats-04-2',
  }],
);
assert.deepEqual(
  evidenceFor(graph, 'module-quiet', 'concept-derivative'),
  [],
  'an unevidenced module edge licenses no chip',
);
assert.deepEqual(
  bridges(graph).map((bridge) => bridge.concept.id),
  ['concept-softmax'],
  'a bridge is shared evidence, and it creates no relation between the modules',
);
assert.deepEqual(
  (graph.prerequisiteEdges.get('concept-attention') ?? []).map((edge) => edge.to),
  ['concept-softmax'],
  'sharing a module with Attention never becomes an edge',
);

/* -------------------------------------------------------------------------
 * The focused neighbourhood, and what it does not show
 * ---------------------------------------------------------------------- */

const depth1 = neighbourhood(graph, 'concept-gradient-descent');
assert.equal(depth1.focus.label, 'Gradient descent');
assert.equal(depth1.depth, 1);
assert.deepEqual(
  depth1.nodes.map((node) => [node.concept.id, node.direction, node.column]),
  [
    ['concept-derivative', 'prerequisite', -1],
    ['concept-gradient-descent', 'focus', 0],
    ['concept-adam', 'dependent', 1],
  ],
  'prerequisites left, focus centred, dependents right',
);
assert.equal(depth1.focusColumn, 1);
assert.deepEqual(depth1.columns.map((column) => column.length), [1, 1, 1]);
assert.deepEqual(
  depth1.strictEdges.map((edge) => edge.id),
  [
    'concept-adam--builds-on--concept-gradient-descent',
    'concept-gradient-descent--requires--concept-derivative',
  ],
);
assert.deepEqual(
  depth1.beyond,
  { prerequisites: [], dependents: [], semantic: [], unrecognized: [], total: 0 },
  'nothing is invented to fill a column, and nothing is owed to the reader here',
);

const adamView = neighbourhood(graph, 'concept-adam');
assert.deepEqual(
  adamView.nodes.map((node) => node.concept.id),
  ['concept-gradient-descent', 'concept-adam'],
);
assert.deepEqual(
  adamView.beyond.prerequisites.map((row) => row.id),
  ['concept-derivative'],
  'a prerequisite excluded by the depth bound is named, not merely counted',
);

const derivativeView = neighbourhood(graph, 'concept-derivative');
assert.deepEqual(
  derivativeView.beyond.dependents.map((row) => row.id),
  ['concept-adam'],
  'and so is a dependent one hop past the bound',
);
assert.deepEqual(
  derivativeView.beyond.unrecognized.map((row) => row.id),
  ['concept-attention'],
  'a neighbour only an unknown relation type reaches is named rather than drawn',
);
assert.deepEqual(
  derivativeView.nodes.filter((node) => node.direction === 'prerequisite'),
  [],
  'a strict root has no prerequisites, which the shell must state rather than dress up',
);
assert.equal(
  (graph.prerequisiteEdges.get('concept-derivative') ?? []).length,
  0,
);
assert.deepEqual(
  neighbourhood(graph, 'concept-adam', { depth: 2 }).beyond.prerequisites,
  [],
  'raising the depth bound consumes the remainder it was reported for',
);

const logistic = neighbourhood(graph, 'concept-logistic-regression');
assert.deepEqual(
  logistic.beyond.semantic.map((row) => row.id),
  ['concept-attention'],
  'a semantic neighbour the lens does not draw is named too',
);
assert.deepEqual(
  logistic.nodes.map((node) => node.concept.id),
  [
    'concept-conditional-probability',
    'concept-softmax',
    'concept-logistic-regression',
  ],
  'the strict lens places no semantic neighbour on the graph',
);

const overlay = neighbourhood(graph, 'concept-logistic-regression', {
  includeSemanticNeighbours: true,
});
assert.deepEqual(
  overlay.nodes
    .filter((node) => node.direction === 'related')
    .map((node) => node.concept.id),
  ['concept-attention'],
  'the semantic lens carries the view for a concept the strict layer would leave alone',
);
assert.deepEqual(overlay.beyond.semantic, []);
assert.deepEqual(
  overlay.semanticEdges.map((edge) => edge.id),
  ['concept-attention--derives--concept-logistic-regression'],
);

const semanticOnly = neighbourhood(graph, 'concept-abbreviated', {
  includeSemanticNeighbours: true,
});
assert.deepEqual(
  semanticOnly.nodes.map((node) => node.direction),
  ['focus', 'related'],
  'a concept with no strict relation is not an empty screen under the semantic lens',
);

const depth2 = neighbourhood(graph, 'concept-gradient-descent', { depth: 2 });
assert.deepEqual(
  depth2.nodes.map((node) => [node.concept.id, node.distance]),
  [
    ['concept-derivative', 1],
    ['concept-gradient-descent', 0],
    ['concept-adam', 1],
  ],
  'depth 2 reaches no further here, and invents nothing to fill the columns',
);

/* -------------------------------------------------------------------------
 * Ancestors, layers, and the cycle that blocks them
 * ---------------------------------------------------------------------- */

assert.deepEqual(
  strictAncestors(graph, 'concept-adam').map((row) => row.id),
  ['concept-derivative', 'concept-gradient-descent'],
);
assert.deepEqual(strictAncestors(graph, 'concept-derivative'), []);

const adamPath = strictPath(graph, 'concept-adam');
assert.equal(adamPath.ok, true);
assert.deepEqual(
  adamPath.layers.map((layer) => layer.map((row) => row.id)),
  [
    ['concept-derivative'],
    ['concept-gradient-descent'],
    ['concept-adam'],
  ],
  'a concept sits one layer after its deepest prerequisite',
);
assert.equal(adamPath.total, 3);
assert.equal(adamPath.edges.length, 2);
assert.equal(findStrictCycle(graph), null, 'the fixture registry is acyclic');

const cyclic = buildAtlasGraph(storeOf({
  records: [concept('concept-a', 'A'), concept('concept-b', 'B'), concept('concept-c', 'C')],
  relations: [
    relation('concept-a', 'requires', 'concept-b'),
    relation('concept-b', 'requires', 'concept-c'),
    relation('concept-c', 'requires', 'concept-a'),
  ],
}));
const blocked = strictPath(cyclic, 'concept-a');
assert.equal(blocked.ok, false, 'a cycle blocks path derivation rather than ordering it');
assert.deepEqual(
  blocked.cycle,
  ['concept-a', 'concept-b', 'concept-c', 'concept-a'],
  'the blocked state names the concept ids, closing the loop it reports',
);
assert.deepEqual(
  strictAncestors(cyclic, 'concept-a').map((row) => row.id),
  ['concept-b', 'concept-c'],
  'the closure walk terminates on a cycle instead of hanging',
);
assert.deepEqual(
  diagnosticOf(diagnostics(cyclic), 'strict-cycle').conceptIds,
  ['concept-a', 'concept-b', 'concept-c', 'concept-a'],
);

const semanticCycle = buildAtlasGraph(storeOf({
  records: [concept('concept-a', 'A'), concept('concept-b', 'B')],
  relations: [
    relation('concept-a', 'contrasts-with', 'concept-b'),
    relation('concept-b', 'contrasts-with', 'concept-a'),
  ],
}));
assert.equal(
  findStrictCycle(semanticCycle),
  null,
  'semantic cycles are valid and never block anything',
);
assert.equal(strictPath(semanticCycle, 'concept-a').ok, true);

/* -------------------------------------------------------------------------
 * Diagnostics — every count carries its records
 * ---------------------------------------------------------------------- */

const entries = diagnostics(graph);
assert.equal(
  entries.filter((entry) => entry.id === 'strict-cycle').length,
  0,
  'no cycle entry is published when there is no cycle',
);

const roots = diagnosticOf(entries, 'strict-roots');
assert.deepEqual(roots.conceptIds, [
  'concept-conditional-probability',
  'concept-derivative',
  'concept-softmax',
]);
assert.equal(roots.count, 3);
assert.match(
  roots.meaning,
  /not a claim that the concept is foundational/,
  'absence is stated as absence',
);

assert.deepEqual(
  diagnosticOf(entries, 'strict-leaves').conceptIds,
  ['concept-adam', 'concept-attention', 'concept-logistic-regression'],
  'a semantic relation naming the concept does not make it a strict dependency',
);
assert.deepEqual(
  diagnosticOf(entries, 'unrelated-concepts').conceptIds,
  ['concept-unrelated'],
);
assert.deepEqual(
  diagnosticOf(entries, 'unresolved-concepts').conceptIds,
  ['concept-ghost'],
);
assert.deepEqual(
  diagnosticOf(entries, 'relations-without-source').edgeIds,
  ['concept-logistic-regression--requires--concept-softmax'],
);
assert.deepEqual(
  diagnosticOf(entries, 'relations-with-unresolved-source').edgeIds,
  ['concept-attention--requires--concept-softmax'],
);
assert.deepEqual(
  diagnosticOf(entries, 'relations-outside-vocabulary').edgeIds,
  ['concept-derivative--inspires--concept-attention'],
);
assert.equal(diagnosticOf(entries, 'relations-without-context').count, 6);
assert.deepEqual(
  diagnosticOf(entries, 'modules-without-concepts').moduleIds,
  ['module-quiet'],
);
assert.match(
  diagnosticOf(entries, 'modules-without-concepts').meaning,
  /not because nothing is taught/,
);
assert.ok(
  diagnosticOf(entries, 'concepts-without-module-evidence').conceptIds
    .includes('concept-derivative'),
);
for (const entry of entries) {
  const records_ = entry.kind === 'concepts'
    ? entry.conceptIds
    : entry.kind === 'relations' ? entry.edgeIds : entry.moduleIds;
  assert.equal(entry.count, records_.length, `${entry.id} counts exactly its records`);
}

/* -------------------------------------------------------------------------
 * Summary and determinism
 * ---------------------------------------------------------------------- */

assert.deepEqual(summarize(graph), {
  concepts: 10,
  relations: 9,
  strictRelations: 5,
  semanticRelations: 3,
  unrecognizedRelations: 1,
  conceptsInStrictLayer: 7,
  bridges: 1,
  modulesPublishing: 2,
  modules: 3,
});

const shuffled = buildAtlasGraph(storeOf({
  records: [...records].reverse(),
  relations: [...relations].reverse(),
  moduleEdges: [...moduleEdges].reverse(),
  modules: [...modules].reverse(),
}));
assert.deepEqual(
  shuffled.concepts.map((row) => row.id),
  graph.concepts.map((row) => row.id),
  'ordering comes from the data, not from the order rows arrived in',
);
assert.deepEqual(
  neighbourhood(shuffled, 'concept-gradient-descent').nodes.map((node) => node.concept.id),
  depth1.nodes.map((node) => node.concept.id),
);
assert.deepEqual(summarize(shuffled), summarize(graph));

const duplicated = buildAtlasGraph(storeOf({
  records,
  relations: [...relations, relations[0]],
}));
assert.equal(
  duplicated.edges.length,
  graph.edges.length,
  'one authored claim is one edge, however many times the row appears',
);

const empty = buildAtlasGraph(storeOf({}));
assert.deepEqual(empty.concepts, []);
assert.deepEqual(neighbourhood(empty, 'concept-absent').nodes.map((node) => node.concept.id), [
  'concept-absent',
]);
assert.equal(strictPath(empty, 'concept-absent').ok, true);
assert.deepEqual(bridges(empty), []);

console.log('Atlas graph OK: layers, direction, provenance, remainders, cycles, and determinism.');
