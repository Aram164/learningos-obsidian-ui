'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
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
  openMaterialReferencePath: (pathArg, destination) => opened.push([pathArg, destination]),
  notify: (message) => notices.push(message),
};
assert.equal(openEvidenceBinding(ports, 'concept-a--requires--concept-b', 0), true);
assert.deepEqual(opened, [['book.pdf', { page: 29, label: 'physical page 29' }]]);
assert.equal(openEvidenceBinding(ports, 'concept-x--requires--concept-b', 0), false);
assert.equal(notices.length, 1);

async function checkMaterialLayouts() {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'los-atlas-evidence-'));
  const materialFiles = [];
  const hostNotices = [];
  const hostLoad = createSourceModuleLoader(root, {
    obsidian: { Notice: class Notice { constructor(message) { hostNotices.push(message); } } },
    electron: { shell: { openPath: async (filename) => { materialFiles.push(filename); return ''; } } },
  });
  const { ResourceOpener } = hostLoad('src/infrastructure/resource-opener.ts');
  const materials = path.join(fixture, 'materials');
  const direct = path.join(materials, 'source-book');
  const topic = path.join(materials, 'topics', 'probability');
  const flat = path.join(materials, '.flat');
  const pdf = 'chapter #1.pdf';
  const ref = 'source-book/' + pdf;
  const dest = { page: 29, label: 'physical page 29' };
  const opener = new ResourceOpener({
    vault: { adapter: { getBasePath: () => path.join(fixture, 'repository') } },
  });
  try {
    fs.mkdirSync(direct, { recursive: true });
    fs.writeFileSync(path.join(direct, pdf), 'direct');
    assert.equal(await opener.openMaterialReferencePath(ref, dest), true);
    assert.equal(materialFiles.at(-1), fs.realpathSync(path.join(direct, pdf)));
    assert.match(hostNotices.at(-1), /go to physical page 29/);

    fs.mkdirSync(topic, { recursive: true });
    fs.writeFileSync(path.join(topic, pdf), 'registered');
    fs.mkdirSync(flat);
    fs.symlinkSync(topic, path.join(flat, 'source-book'), 'dir');
    assert.equal(await opener.openMaterialReferencePath(ref, dest), true);
    assert.equal(materialFiles.at(-1), fs.realpathSync(path.join(topic, pdf)));

    assert.equal(await opener.openMaterialReferencePath('source-book/missing.pdf', dest), false);
    assert.equal(await opener.openMaterialReferencePath('../outside.pdf', dest), false);
    fs.writeFileSync(path.join(fixture, 'outside.pdf'), 'outside');
    fs.symlinkSync(path.join(fixture, 'outside.pdf'), path.join(topic, 'outside.pdf'));
    assert.equal(await opener.openMaterialReferencePath('source-book/outside.pdf', dest), false);
    assert.equal(materialFiles.length, 2);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}

checkMaterialLayouts().then(() => {
  console.log('Atlas evidence OK: params, digest, exact material alias and physical page policy.');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
