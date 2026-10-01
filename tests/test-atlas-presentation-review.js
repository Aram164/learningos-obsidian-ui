'use strict';

// Independent adversarial checks: visibility is compared to a backwards-path
// oracle rather than another implementation of the renderer's forward walk.
const assert = require('node:assert/strict');
const path = require('node:path');
const { createSourceModuleLoader } = require('./source-module-loader');
const load = createSourceModuleLoader(path.dirname(__dirname));
const { foldedVisibility, preparationNeighbours } = load('src/features/abilities/model.ts');
const { zoomAt, fitCamera } = load('src/features/abilities/viewport.ts');
let seed = 91873;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
for (let trial = 0; trial < 180; trial++) {
  const ids = Array.from({ length: 35 }, (_, n) => `record-${n}`);
  const edges = [];
  for (let target = 1; target < ids.length; target++) {
    for (let source = 0; source < target; source++) {
      if (random() < 0.11) edges.push({ from: ids[source], to: ids[target] });
    }
  }
  const parents = new Map(ids.map(id => [id, edges.filter(e => e.to === id).map(e => e.from)]));
  const roots = ids.filter(id => !parents.get(id).length);
  const selected = ids[trial % ids.length];
  const retained = new Set([ids[(trial * 7) % ids.length]]);
  const folded = new Set(ids.filter(() => random() < 0.36));
  const anchors = new Set([...roots, ...retained, selected]);
  const memo = new Map();
  function oracle(id) {
    if (anchors.has(id)) return true;
    if (memo.has(id)) return memo.get(id);
    const needed = parents.get(id).some(parent => !folded.has(parent) && oracle(parent));
    memo.set(id, needed); return needed;
  }
  const overview = { nodes: new Map(ids.map(id => [id, { id }])), edges };
  const before = JSON.stringify(edges);
  const result = foldedVisibility(overview, folded, selected, retained);
  assert.deepEqual([...result.nodes].sort(), ids.filter(oracle).sort(), `visibility trial ${trial}`);
  const expectedEdges = edges.filter(e => result.nodes.has(e.from) && result.nodes.has(e.to) && !folded.has(e.from));
  assert.deepEqual(result.edges, expectedEdges);
  for (const id of result.nodes) {
    assert.equal(result.hiddenIncident.get(id) || 0,
      edges.filter(e => (e.from === id || e.to === id) && !expectedEdges.includes(e)).length);
  }
  assert.equal(JSON.stringify(edges), before, 'folding preserves authored geometry input');
  assert.equal(foldedVisibility(overview, new Set(), null).nodes.size, ids.length, 'reopening restores every identity');
  const oneHop = preparationNeighbours(edges, selected);
  assert.deepEqual([...oneHop.prerequisites].sort(), parents.get(selected).sort());
  assert.deepEqual([...oneHop.dependents].sort(), edges.filter(e => e.from === selected).map(e => e.to).sort());
}

for (const width of [560, 800, 980, 1440]) {
  for (const bounds of [
    { x: 0, y: 0, width: 15800, height: 600 }, // a 50-record chain
    { x: 72, y: 100, width: 1500, height: 5600 }, // a wide convergent fixture
    { x: -230, y: -40, width: 1200, height: 900 },
  ]) {
    const height = 600;
    const camera = fitCamera(bounds, { width, height });
    assert.ok(camera.x + bounds.x * camera.scale >= 0);
    assert.ok(camera.y + bounds.y * camera.scale >= 0);
    assert.ok(camera.x + (bounds.x + bounds.width) * camera.scale <= width + 1e-8, 'Fit all right bound');
    assert.ok(camera.y + (bounds.y + bounds.height) * camera.scale <= height + 1e-8, 'Fit all bottom bound');
  }
}
for (let n = 0; n < 100; n++) {
  const camera = { x: random() * 600 - 300, y: random() * 500 - 250, scale: .3 + random() };
  const pointer = { x: random() * 980, y: random() * 600 };
  const world = { x: (pointer.x - camera.x) / camera.scale, y: (pointer.y - camera.y) / camera.scale };
  const next = zoomAt(camera, pointer, camera.scale * 1.2);
  assert.ok(Math.abs(next.x + world.x * next.scale - pointer.x) < 1e-8);
  assert.ok(Math.abs(next.y + world.y * next.scale - pointer.y) < 1e-8);
}
console.log('Independent Atlas presentation review OK: 180 DAGs, fold claims/anchors/reopening, hidden edges, 12 large fits and 100 anchored zooms.');
