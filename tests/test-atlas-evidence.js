'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { createSourceModuleLoader } = require('./source-module-loader');

const root = path.dirname(__dirname);
const load = createSourceModuleLoader(root);
const {
  parseEvidenceParams, resolveEvidenceBinding, openEvidenceBinding,
} = load('src/features/atlas/evidence.ts');
const { buildAtlasGraph } = load('src/features/atlas/graph.ts');

const BINDING = {
  source_id: 'source-book', material_relpath: 'book.pdf',
  file_sha256: 'a'.repeat(64), page: 29, quote: 'Quoted parity text',
};
const store = {
  get: (id) => (id === 'concept-a' || id === 'concept-b'
    ? { id, type: 'concept', title: id }
    : null),
  of: () => [
    { id: 'concept-a', type: 'concept', title: 'Alpha' },
    { id: 'concept-b', type: 'concept', title: 'Beta' },
  ],
  modules: () => [],
  moduleConceptEdges: () => [],
  relations: () => [{
    from: 'concept-a', type: 'requires', to: 'concept-b', context: null,
    source: null, status: 'active', evidence: [BINDING], evidence_state: 'verified',
  }],
};
const graph = buildAtlasGraph(store);

/* Params: only relation + ordinal, nothing else may arrive. */
assert.deepEqual(parseEvidenceParams({ relation: 'concept-a--requires--concept-b', ordinal: '0' }),
  { relationId: 'concept-a--requires--concept-b', ordinal: 0 });
assert.ok('error' in parseEvidenceParams({ relation: 'concept-a--requires--concept-b', ordinal: '0', path: '/etc/passwd' }),
  'a raw path parameter refuses');
assert.deepEqual(parseEvidenceParams({
  action: 'learningos-atlas-evidence', relation: 'concept-a--requires--concept-b', ordinal: '0',
}), { relationId: 'concept-a--requires--concept-b', ordinal: 0 });
assert.ok('error' in parseEvidenceParams({ action: 'open', relation: 'concept-a--requires--concept-b', ordinal: '0' }));
assert.ok('error' in parseEvidenceParams({ relation: 'not-a-relation', ordinal: '0' }));
assert.ok('error' in parseEvidenceParams({ relation: 'concept-a--requires--concept-b', ordinal: '-1' }));
assert.ok('error' in parseEvidenceParams({ relation: 'concept-a--requires--concept-b' }));

/* Resolution: unknown relation, ordinal bounds, unsupported digests refuse. */
assert.equal(resolveEvidenceBinding(graph, 'concept-a--requires--concept-b', 0).binding.page, 29);
assert.ok('error' in resolveEvidenceBinding(graph, 'concept-a--requires--concept-b', 1));
assert.ok('error' in resolveEvidenceBinding(graph, 'concept-x--requires--concept-b', 0));

/* Opening: the sibling material file at its physical page, never a raw path. */
const opened = [];
const notices = [];
const ports = {
  store,
  openMaterialPath: (pathArg, destination) => opened.push([pathArg, destination]),
  notify: (message) => notices.push(message),
};
assert.equal(openEvidenceBinding(ports, 'concept-a--requires--concept-b', 0), true);
assert.deepEqual(opened, [['materials/book.pdf', { page: 29, label: 'physical page 29' }]]);
assert.equal(openEvidenceBinding(ports, 'concept-x--requires--concept-b', 0), false);
assert.equal(notices.length, 1);

console.log('Atlas evidence OK: params, resolution, digest and page policy.');
