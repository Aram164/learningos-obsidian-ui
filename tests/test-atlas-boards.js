'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createSourceModuleLoader } = require('./source-module-loader');

const root = path.dirname(__dirname);
const load = createSourceModuleLoader(root);
const { mergeBoards, parseBoard, serializeBoard } = load('src/features/atlas/board-merge.ts');
const { BoardController, advancedBoardAvailable, sidecarPath } =
  load('src/features/atlas/board-controller.ts');

const template = {
  nodes: [
    { id: 'los-concept-concept-a', type: 'text', text: '**A**', x: 0, y: 0, width: 320, height: 160 },
    { id: 'los-concept-concept-b', type: 'text', text: '**B**', x: 520, y: 0, width: 320, height: 160 },
  ],
  edges: [
    { id: 'los-rel-concept-b--builds-on--concept-a', fromNode: 'los-concept-concept-a',
      toNode: 'los-concept-concept-b', label: 'Strict' },
  ],
};
const managed = [...template.nodes, ...template.edges].map((n) => n.id);

// Dragged geometry survives; template semantics replace text.
{
  const working = structuredClone(template);
  working.nodes[0].x = 999; working.nodes[0].text = 'stale';
  const merged = mergeBoards(managed, working, template);
  assert.equal(merged.ok, true);
  assert.equal(merged.canvas.nodes[0].x, 999);
  assert.equal(merged.canvas.nodes[0].text, '**A**');
  // Redundant refresh is byte-stable.
  const again = mergeBoards(merged.managedIds, merged.canvas, template);
  assert.equal(serializeBoard(again.canvas), serializeBoard(merged.canvas));
}

// Authored objects survive; a retired managed node referenced by an authored
// edge survives as a layout object, then drops once the edge is gone.
{
  const working = structuredClone(template);
  working.nodes.push({ id: 'my-note', type: 'text', text: 'mine', x: 0, y: 400, width: 200, height: 100 });
  working.edges.push({ id: 'my-edge', fromNode: 'my-note', toNode: 'los-concept-concept-b' });
  const next = structuredClone(template);
  next.nodes = next.nodes.filter((n) => n.id !== 'los-concept-concept-b');
  next.edges = [];
  const merged = mergeBoards(managed, working, next);
  assert.equal(merged.ok, true);
  const retired = merged.canvas.nodes.find((n) => n.id === 'los-concept-concept-b');
  assert.equal(retired.losRetired, true);
  const dropped = mergeBoards(merged.managedIds, merged.canvas, next);
  assert.equal(dropped.canvas.nodes.some((n) => n.id === 'los-concept-concept-b'), true);
  const clean = structuredClone(merged.canvas);
  clean.edges = clean.edges.filter((e) => e.id !== 'my-edge');
  const final = mergeBoards(merged.managedIds, clean, next);
  assert.equal(final.canvas.nodes.some((n) => n.id === 'los-concept-concept-b'), false);
}

// Refusals: duplicates, unknown reserved ids, invalid geometry, dangling edges.
{
  const dup = structuredClone(template);
  dup.nodes.push({ ...dup.nodes[0] });
  assert.equal(mergeBoards(managed, dup, template).ok, false);
  const reserved = structuredClone(template);
  reserved.nodes.push({ id: 'los-concept-concept-nope', type: 'text', text: 'x', x: 0, y: 0, width: 10, height: 10 });
  assert.equal(mergeBoards(managed, reserved, template).ok, false);
  const badGeo = structuredClone(template);
  badGeo.nodes[0].width = 0;
  assert.equal(mergeBoards(managed, badGeo, template).ok, false);
  assert.equal(parseBoard('{nope'), null);
}

// Controller: refresh refuses while the board is open, and refuses a stale
// preview; a clean refresh writes merged bytes and advances the sidecar.
{
  const files = new Map();
  let open = false;
  const port = {
    read: async (p) => files.get(p) ?? null,
    create: async (p, text) => { files.set(p, text); },
    process: async (p, fn) => {
      const next = fn(files.get(p) ?? '');
      if (next === null) return false;
      files.set(p, next); return true;
    },
    openLeaf: async () => {},
    managedCanvasOpen: async () => open,
    isManagedCanvasOpenSync: () => open,
  };
  const text = serializeBoard(template);
  const entry = { kind: 'module', id: 'module-demo', template_path: 'generated/atlas/templates/module/module-demo.canvas',
    working_path: 'boards/atlas/module/module-demo.canvas', sha256: createHash('sha256').update(text).digest('hex') };
  (async () => {
    const controller = new BoardController(port);
    const mismatch = await controller.openBoard(entry, text + ' ');
    assert.equal(mismatch.ok, false);
    assert.equal(files.size, 0);
    // CW1 on openBoard: caller template must still match the live template bytes.
    files.set(entry.template_path, text + ' ');
    const staleOpen = await controller.openBoard(entry, text);
    assert.equal(staleOpen.ok, false);
    assert.equal(files.has(entry.working_path), false);
    files.set(entry.template_path, text);
    const [created, repeated] = await Promise.all([
      controller.openBoard(entry, text), controller.openBoard(entry, text),
    ]);
    assert.equal(repeated.action, 'opened');
    assert.equal((await controller.openBoard(entry, null)).action, 'opened');
    assert.equal(created.action, 'created');
    assert.ok(files.has(sidecarPath(entry)));
    const working = parseBoard(files.get(entry.working_path));
    working.nodes[0].x = 42;
    files.set(entry.working_path, serializeBoard(working));
    open = true;
    const blocked = await controller.refreshBoard(entry, text, files.get(entry.working_path));
    assert.equal(blocked.ok, false);
    assert.match(blocked.reason, /Close all managed Atlas boards/);
    open = false;
    const stale = await controller.refreshBoard(entry, serializeBoard(template), 'stale-bytes');
    assert.equal(stale.ok, false);
    // CW1 on refreshBoard: raw-byte difference (whitespace-only, same AST) refuses.
    const preview = await controller.previewRefresh(entry);
    assert.equal(preview.ok, true);
    assert.deepEqual(preview.changes, []);
    files.set(entry.template_path, preview.templateText + ' ');
    const staleTemplateRefresh = await controller.refreshBoard(
      entry, preview.templateText, preview.workingText, preview.ownershipText);
    assert.equal(staleTemplateRefresh.ok, false);
    assert.match(staleTemplateRefresh.reason, /template changed since the preview/);
    files.set(entry.template_path, preview.templateText);
    // CW2 on refreshBoard: canvas opened right inside process() aborts without writing.
    const beforeMidOpen = files.get(entry.working_path);
    const realProcess = port.process;
    port.process = async (p, fn) => {
      if (p === entry.working_path) open = true;
      try {
        return await realProcess(p, fn);
      } finally {
        port.process = realProcess;
      }
    };
    const midOpenRefresh = await controller.refreshBoard(
      entry, preview.templateText, preview.workingText, preview.ownershipText);
    assert.equal(midOpenRefresh.ok, false);
    assert.match(midOpenRefresh.reason, /Close all managed Atlas boards/);
    assert.equal(files.get(entry.working_path), beforeMidOpen);
    open = false;
    const refreshed = await controller.refreshBoard(
      entry, serializeBoard(template), files.get(entry.working_path));
    assert.equal(refreshed.ok, true);
    assert.equal(parseBoard(files.get(entry.working_path)).nodes[0].x, 42);
    const state = sidecarPath(entry);
    const originalOwnership = files.get(state);
    files.set(state, originalOwnership + ' ');
    assert.match((await controller.refreshBoard(entry, preview.templateText, preview.workingText,
      preview.ownershipText)).reason, /ownership changed since the preview/);
    files.set(state, originalOwnership);
    assert.equal(advancedBoardAvailable(true, false), false);
    assert.equal(advancedBoardAvailable(true, true), true);

    // Step 21: a portal target switched to the editable child survives
    // refresh with its flag; switching requires the child to exist.
    const child = { kind: 'lecture', id: 'unit-demo', parent_kind: 'module', parent_id: 'module-demo',
      template_path: 'generated/atlas/templates/lecture/unit-demo.canvas',
      working_path: 'boards/atlas/lecture/unit-demo.canvas', sha256: 'b'.repeat(64) };
    const parentTemplate = structuredClone(template);
    parentTemplate.nodes.push({ id: 'los-scope-lecture--unit-demo', type: 'file',
      file: child.template_path, x: 0, y: 400, width: 320, height: 160 });
    const withChild = mergeBoards([...managed, 'los-scope-lecture--unit-demo'],
      structuredClone(parentTemplate), parentTemplate);
    assert.equal(withChild.ok, true);
    const missing = await controller.useEditableChild(entry, child);
    assert.equal(missing.ok, false);
    files.set(child.working_path, serializeBoard(template));
    files.set(entry.working_path, serializeBoard(parentTemplate));
    // CW2 on useEditableChild: mid-flight canvas open inside process() aborts cleanly.
    const beforePortalMidOpen = files.get(entry.working_path);
    port.process = async (p, fn) => {
      if (p === entry.working_path) open = true;
      try {
        return await realProcess(p, fn);
      } finally {
        port.process = realProcess;
      }
    };
    const midOpenPortal = await controller.useEditableChild(entry, child);
    assert.equal(midOpenPortal.ok, false);
    assert.match(midOpenPortal.reason, /Close all managed Atlas boards/);
    assert.equal(files.get(entry.working_path), beforePortalMidOpen);
    open = false;
    const switched = await controller.useEditableChild(entry, child);
    assert.equal(switched.ok, true);
    let board = parseBoard(files.get(entry.working_path));
    const link = board.nodes.find((n) => n.id === 'los-scope-lecture--unit-demo');
    assert.equal(link.file, child.working_path);
    link.portal = true;
    files.set(entry.working_path, serializeBoard(board));
    const kept = mergeBoards([...managed, 'los-scope-lecture--unit-demo'],
      parseBoard(files.get(entry.working_path)), parentTemplate);
    assert.equal(kept.ok, true);
    const keptLink = kept.canvas.nodes.find((n) => n.id === 'los-scope-lecture--unit-demo');
    assert.equal(keptLink.file, child.working_path);
    assert.equal(keptLink.portal, true);

  })().catch((err) => { console.error(err); process.exit(1); });
}

// The real vault adapter against a host that behaves like Obsidian 1.15.1
// (measured 2026-11-23 in an isolated instance): the vault index skips every
// dot-segment path, `vault.create` there writes the file but returns null,
// `getAbstractFileByPath` never finds it, and a repeated `createFolder`
// throws. Only the DataAdapter reaches hidden files. Before the adapter
// routed `.state/` through it, refresh always refused and the second board of
// a kind threw on its first open.
{
  const hostLoad = createSourceModuleLoader(root, { obsidian: { Notice: class Notice {} } });
  const { AtlasBoardVault, hiddenVaultPath } = hostLoad('src/infrastructure/atlas-board-vault.ts');
  const { BoardController: HostController, sidecarPath: hostSidecar } =
    hostLoad('src/features/atlas/board-controller.ts');
  const files = new Map();
  const folders = new Set(['']);
  const hidden = (p) => p.split('/').some((segment) => segment.startsWith('.'));
  const parentOf = (p) => p.split('/').slice(0, -1).join('/');
  const addFolders = (folder) => {
    const parts = folder.split('/');
    for (let i = 1; i <= parts.length; i += 1) folders.add(parts.slice(0, i).join('/'));
  };
  const tfile = (p) => ({ path: p, extension: p.split('.').pop() });
  const enoent = (p) => new Error(`ENOENT: no such file or directory, open '${p}'`);
  const app = {
    vault: {
      getAbstractFileByPath: (p) => (hidden(p) ? null
        : files.has(p) ? tfile(p) : folders.has(p) ? { path: p, children: [] } : null),
      read: async (file) => files.get(file.path),
      create: async (p, text) => {
        if (files.has(p)) throw new Error('File already exists.');
        if (!folders.has(parentOf(p))) throw enoent(p);
        files.set(p, text);
        return hidden(p) ? null : tfile(p);
      },
      createFolder: async (p) => {
        if (folders.has(p)) throw new Error('Folder already exists.');
        addFolders(p);
      },
      process: async (file, fn) => { const next = fn(files.get(file.path)); files.set(file.path, next); return next; },
      adapter: {
        exists: async (p) => files.has(p) || folders.has(p),
        read: async (p) => { if (!files.has(p)) throw enoent(p); return files.get(p); },
        write: async (p, text) => { if (!folders.has(parentOf(p))) throw enoent(p); files.set(p, text); },
        mkdir: async (p) => { addFolders(p); },
        process: async (p, fn) => {
          if (!files.has(p)) throw enoent(p);
          const next = fn(files.get(p)); files.set(p, next); return next;
        },
      },
    },
    workspace: {
      iterateAllLeaves: () => {},
      revealLeaf: async () => {},
      getLeaf: () => ({ openFile: async () => {} }),
    },
  };
  const text = serializeBoard(template);
  const sha256 = createHash('sha256').update(text).digest('hex');
  const scope = (id) => ({ kind: 'module', id, sha256,
    template_path: `generated/atlas/templates/module/${id}.canvas`,
    working_path: `boards/atlas/module/${id}.canvas` });
  const first = scope('module-one');
  const second = scope('module-two');
  (async () => {
    assert.equal(hiddenVaultPath(hostSidecar(first)), true);
    assert.equal(hiddenVaultPath(first.working_path), false);
    const controller = new HostController(new AtlasBoardVault(app));
    files.set(first.template_path, text);
    files.set(second.template_path, text);
    assert.equal((await controller.openBoard(first, text)).action, 'created');
    assert.equal((await controller.openBoard(second, text)).action, 'created');
    assert.ok(files.has(hostSidecar(first)) && files.has(hostSidecar(second)));

    const moved = parseBoard(files.get(first.working_path));
    moved.nodes[0].x = 77;
    files.set(first.working_path, serializeBoard(moved));
    const preview = await controller.previewRefresh(first);
    assert.equal(preview.ok, true, preview.reason);
    const refreshed = await controller.refreshBoard(
      first, preview.templateText, preview.workingText, preview.ownershipText);
    assert.equal(refreshed.ok, true, refreshed.reason);
    assert.equal(parseBoard(files.get(first.working_path)).nodes[0].x, 77);

    // A board deleted in Obsidian leaves its hidden record behind; opening the
    // scope again recreates the board and replaces the record.
    files.delete(second.working_path);
    files.set(hostSidecar(second), JSON.stringify({ schema_version: 1, template_sha256: 'c'.repeat(64),
      managed_ids: ['los-concept-gone'] }) + '\n');
    files.set(second.template_path, text);
    assert.equal((await controller.openBoard(second, text)).action, 'created');
    assert.deepEqual(JSON.parse(files.get(hostSidecar(second))).managed_ids, managed);
    // One line, which the Core procedure transcript (refresh-an-atlas-board.md) matches.
    console.log('Atlas boards OK: merge preservation, refusals, controller lane, portal gate, '
      + 'hidden ownership records through the vault adapter.');
  })().catch((err) => { console.error(err); process.exit(1); });
}
