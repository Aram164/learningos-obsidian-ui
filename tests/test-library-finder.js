'use strict';

/*
 * The folder Library's invariants.
 *
 * A faceted view can afford to be approximate: five overlapping projections
 * that each answer "where might this be" are still useful when one of them
 * misses. A folder tree cannot. Its whole claim is that everything is
 * somewhere, that a count is a count, and that walking down always lands you
 * on something — so each of those three is asserted here rather than described
 * in a comment.
 *
 * Both vaults are checked. The fixture is the contract-shaped minimum; the
 * real projection beside this repo is where the awkward records actually live
 * (a source in two domains, a module with no domain at all, a registry entry
 * with neither a URL nor a local file). If core is not checked out, the real
 * pass is skipped loudly rather than silently reported as green.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createSourceModuleLoader } = require('./source-module-loader');

const root = path.dirname(__dirname);
// The tree reads the registry and the disk. Neither the DOM nor Obsidian is
// involved, so every module here is the real one — no mocks, which is what
// lets the same suite exercise the real materials adapter further down.
const load = createSourceModuleLoader(root);

const {
  MATERIAL_TYPES,
  MODULE_BUCKETS,
  bucketFor,
  createFinderContext,
  folderAt,
  reachableSourceIds,
  sourceTypeOf,
  totalSourceCount,
  trailFor,
} = load('src/features/library/finder-tree.ts');

// --------------------------------------------------------------------- doubles

/**
 * The store surface the tree uses, over a plain manifest.
 *
 * `thematic_groups` is a top-level collection in the manifest, not a record, so
 * this double exposes it the way the manifest holds it. The real `ManifestStore`
 * also folds those rows into its by-id map, so `store.get('thematic-group-…')`
 * happens to resolve there — but the tree never asks it to. Group identity comes
 * from `thematicGroups()`, which is the declaring list; leaning on the by-id
 * fold would make the taxonomy depend on an indexing convenience that nothing
 * about a group requires. Keeping the double narrow is what pins that.
 */
function storeFor(manifest) {
  const records = Array.isArray(manifest.records) ? manifest.records : [];
  const byId = new Map(
    records.filter((row) => row && typeof row.id === 'string').map((row) => [row.id, row]),
  );
  const of = (type) => records.filter((row) => row?.type === type);
  return {
    get: (id) => byId.get(id) ?? null,
    thematicGroups: () => manifest.thematic_groups ?? [],
    sources: () => of('source'),
    modules: () => of('module'),
    topicPacks: () => of('topic-pack'),
    catalogues: () => of('collection').filter((row) => row.collection_kind !== 'topic-pack'),
    useModules: (sourceId) => (manifest.indexes?.source_to_modules?.[sourceId] ?? [])
      .map((id) => byId.get(id))
      .filter((row) => row?.type === 'module'),
  };
}

/** A materials adapter with no disk behind it: every source is a leaf. */
const NO_MATERIALS = {
  isDirectory: () => false,
  list: () => [],
  count: () => 0,
};

/**
 * A materials adapter with a fixed tree, for the descent below the registry.
 *
 * Returns entries exactly as declared. Ordering belongs to the real adapter —
 * it is the only thing holding the dirents — so a double that quietly sorted
 * would make the tree look like it guarantees an order it does not. The real
 * ordering is checked against a real directory further down.
 */
function materialsFrom(tree) {
  return {
    isDirectory: (p) => Array.isArray(tree[p]),
    count: (p) => (tree[p] ?? []).length,
    list: (p) => (tree[p] ?? []).map((entry) => ({
      path: `${p}/${entry.name}`,
      name: entry.name,
      isDirectory: Boolean(entry.children),
      size: entry.size ?? 0,
      childCount: entry.children ?? 0,
    })),
  };
}

// ----------------------------------------------------------------------- walks

/** Every folder in the tree, registry-side; material directories are not walked. */
function everyFolder(context) {
  const found = [];
  const walk = (folderPath, depth) => {
    if (depth > 12) return;
    const folder = folderAt(context, folderPath);
    found.push({ path: folderPath, folder });
    for (const entry of folder.entries) {
      if (!entry.isFolder) continue;
      if (entry.kind === 'source' || entry.kind === 'directory') continue;
      walk([...folderPath, entry.segment], depth + 1);
    }
  };
  walk([], 0);
  return found;
}

function sourceIdsIn(folder) {
  return folder.entries.filter((entry) => entry.kind === 'source').map((entry) => entry.sourceId);
}

// ----------------------------------------------------------------------- suite

function checkVault(label, manifest, materials) {
  const store = storeFor(manifest);
  const context = createFinderContext(store, materials);
  const sourceIds = store.sources().map((row) => row.id).filter(Boolean);

  // ---- 1. Totality: nothing may be unreachable ----------------------------
  const reached = reachableSourceIds(context);
  const missing = sourceIds.filter((id) => !reached.has(id));
  assert.deepEqual(
    missing,
    [],
    `${label}: ${missing.length} source(s) cannot be reached by walking the folders: `
    + `${missing.slice(0, 5).join(', ')}`,
  );
  assert.equal(
    totalSourceCount(context),
    sourceIds.length,
    `${label}: the coverage line would report the wrong total`,
  );

  const folders = everyFolder(context);

  // ---- 2. Partition: a count is a count -----------------------------------
  // Within one domain, the type folders must be disjoint AND cover the domain;
  // within one module, the study buckets likewise. Both are what makes the
  // numbers on the folders addable rather than merely suggestive.
  for (const group of store.thematicGroups()) {
    const domainPath = [`domain:${group.id}`];
    const domainSources = store.sources()
      .filter((row) => (row.thematic_group_ids ?? []).includes(group.id))
      .map((row) => row.id);

    const filed = [];
    for (const [type] of MATERIAL_TYPES) {
      filed.push(...sourceIdsIn(folderAt(context, [...domainPath, `type:${type}`])));
    }
    assert.equal(
      new Set(filed).size,
      filed.length,
      `${label}: ${group.id} files a source under two material types`,
    );
    assert.deepEqual(
      [...filed].sort(),
      [...domainSources].sort(),
      `${label}: ${group.id}'s type folders are not exactly its sources`,
    );
  }

  for (const module of store.modules()) {
    const routed = store.sources()
      .filter((row) => store.useModules(row.id).some((m) => m.id === module.id))
      .map((row) => row.id);
    if (!routed.length) continue;

    const owner = (module.thematic_group_ids ?? []).find(
      (id) => (manifest.thematic_groups ?? []).some((g) => g.id === id),
    );
    const modulePath = owner
      ? [`domain:${owner}`, 'modules', `module:${module.id}`]
      : ['shelf:skills', `module:${module.id}`];

    const filed = [];
    for (const [bucket] of MODULE_BUCKETS) {
      filed.push(...sourceIdsIn(folderAt(context, [...modulePath, `bucket:${bucket}`])));
    }
    assert.equal(
      new Set(filed).size,
      filed.length,
      `${label}: ${module.id} files a source under two study buckets`,
    );
    assert.deepEqual(
      [...filed].sort(),
      [...routed].sort(),
      `${label}: ${module.id}'s buckets are not exactly the sources routed to it`,
    );
  }

  // ---- 3. Every folder resolves, and describes itself ----------------------
  for (const { path: folderPath, folder } of folders) {
    assert.equal(
      folder.missing,
      false,
      `${label}: a folder the tree offered does not resolve: ${folderPath.join(' / ')}`,
    );
    assert.ok(folder.name, `${label}: unnamed folder at ${folderPath.join(' / ')}`);
    assert.ok(folder.icon, `${label}: iconless folder at ${folderPath.join(' / ')}`);
    for (const entry of folder.entries) {
      assert.ok(entry.segment, `${label}: entry with no segment in ${folder.name}`);
      assert.ok(entry.kindLabel, `${label}: entry with no Kind in ${folder.name}`);
      assert.ok(
        !entry.isFolder || typeof entry.count === 'number',
        `${label}: folder entry "${entry.name}" reports no item count`,
      );
    }
  }

  // ---- 4. Only a DECLARED folder may be empty ------------------------------
  //
  // Two kinds of folder, and the difference decides whether empty is a bug.
  //
  // Derived folders — the type buckets, the study buckets, the shelves — are
  // emitted FROM what is filed. One of them being empty means the emitting
  // rule produced a folder with nothing behind it, which is a dead end.
  //
  // Declared folders — a domain (ADR-007) and a module (the curriculum) —
  // exist whether or not anything has been filed against them. An empty one is
  // a true and useful statement: this module has no material routed to it yet.
  // Hiding it would report that the taxonomy has seven domains, or that a
  // module you are enrolled in does not exist — and it would turn a documented
  // absence into a silent one, which this system does not do anywhere else.
  const declared = (folderPath) => {
    const last = folderPath[folderPath.length - 1] ?? '';
    if (last.startsWith('module:')) return true;
    return folderPath.length === 1 && last.startsWith('domain:');
  };

  for (const { path: folderPath, folder } of folders) {
    if (!folderPath.length || declared(folderPath)) continue;
    assert.ok(
      folder.entries.length > 0,
      `${label}: ${folderPath.join(' / ')} is derived from what is filed, `
      + 'so it must not be empty',
    );
  }

  const declaredDomains = store.thematicGroups().length;
  const offeredDomains = folderAt(context, []).entries
    .filter((entry) => entry.kind === 'domain').length;
  assert.equal(
    offeredDomains,
    declaredDomains,
    `${label}: the root must offer every declared domain, empty or not`,
  );

  // ---- 5. The breadcrumb is the path ---------------------------------------
  const deepest = folders.reduce(
    (best, candidate) => (candidate.path.length > best.path.length ? candidate : best),
    folders[0],
  );
  const trail = trailFor(context, deepest.path);
  assert.equal(
    trail.length,
    deepest.path.length + 1,
    `${label}: the trail does not have one folder per ancestor`,
  );
  assert.equal(trail[0].name, 'Library', `${label}: the trail does not start at the root`);
  assert.equal(
    trail[trail.length - 1].name,
    deepest.folder.name,
    `${label}: the trail does not end where the path points`,
  );

  return { context, store, folders };
}

// -------------------------------------------------------------- fixture vault

function fixtureManifest() {
  return JSON.parse(
    fs.readFileSync(path.join(root, 'fixture-vault', 'generated', 'manifest.json'), 'utf8'),
  );
}

const fixture = checkVault('fixture', fixtureManifest(), NO_MATERIALS);

// ------------------------------------------------- hand-built edge conditions

{
  // A source in two domains is one record seen twice, and says so.
  const manifest = {
    thematic_groups: [
      { id: 'g-a', title: 'Alpha', order: 1 },
      { id: 'g-b', title: 'Beta', order: 2 },
    ],
    indexes: { source_to_modules: {} },
    records: [
      {
        id: 'source-shared', type: 'source', title: 'Shared', source_type: 'book',
        thematic_group_ids: ['g-a', 'g-b'],
      },
      { id: 'source-orphan', type: 'source', title: 'Orphan', source_type: 'book' },
      {
        id: 'source-unknown-group', type: 'source', title: 'Dangling', source_type: 'book',
        thematic_group_ids: ['g-does-not-exist'],
      },
      { id: 'source-typeless', type: 'source', title: 'Typeless', thematic_group_ids: ['g-a'] },
    ],
  };
  const context = createFinderContext(storeFor(manifest), NO_MATERIALS);

  const inAlpha = folderAt(context, ['domain:g-a', 'type:book']);
  const inBeta = folderAt(context, ['domain:g-b', 'type:book']);
  assert.deepEqual(sourceIdsIn(inAlpha), ['source-shared']);
  assert.deepEqual(sourceIdsIn(inBeta), ['source-shared']);
  assert.equal(
    inAlpha.entries[0].alsoIn,
    2,
    'a source in two domains must be marked as an alias, not shown as a copy',
  );

  // A group id nothing defines is not a home. Both orphans land in Unfiled.
  const unfiled = folderAt(context, ['shelf:unfiled']);
  assert.deepEqual(
    sourceIdsIn(unfiled).sort(),
    ['source-orphan', 'source-unknown-group'],
    'a source whose only group is undefined must still be reachable',
  );

  // A source with no type is filed, not dropped.
  assert.deepEqual(
    sourceIdsIn(folderAt(context, ['domain:g-a', 'type:other'])),
    ['source-typeless'],
    'a source with no material type belongs in Other',
  );

  assert.deepEqual(
    [...reachableSourceIds(context)].sort(),
    ['source-orphan', 'source-shared', 'source-typeless', 'source-unknown-group'],
    'every source must be reachable',
  );
}

{
  // A malformed, stale or hand-edited path reports `missing` rather than throwing.
  const context = createFinderContext(storeFor({ thematic_groups: [], records: [] }), NO_MATERIALS);
  const broken = [
    ['domain:nope'],
    ['shelf:invented'],
    ['not-a-prefix'],
    [''],
    ['domain:nope', 'modules', 'module:ghost'],
    ['shelf:packs', 'catalogue:wrong-prefix'],
    Array.from({ length: 40 }, () => 'domain:nope'),
  ];
  for (const badPath of broken) {
    const folder = folderAt(context, badPath);
    assert.equal(folder.missing, true, `expected a missing folder for ${JSON.stringify(badPath)}`);
    assert.deepEqual(folder.entries, [], 'a missing folder has no contents');
  }
  // The root always exists, so there is always somewhere to stand.
  assert.equal(folderAt(context, []).missing, false);
}

{
  // The descent below the registry: the physical split the projection cannot see.
  const manifest = {
    thematic_groups: [{ id: 'g-ml', title: 'Machine Learning', order: 1 }],
    indexes: { source_to_modules: { 'source-lectures': ['module-x'] } },
    records: [
      {
        id: 'module-x', type: 'module', title: 'Course X', kind: 'academic',
        thematic_group_ids: ['g-ml'],
      },
      {
        id: 'source-lectures', type: 'source', title: 'Course X slides',
        source_type: 'lecture', thematic_group_ids: ['g-ml'],
        material_path: 'materials/ml/course-x', material_exists: true,
      },
    ],
  };
  const materials = materialsFrom({
    'materials/ml/course-x': [
      { name: 'lecture-slides', children: 2 },
      { name: 'exercise-slides', children: 1 },
      { name: 'Primer.pdf', size: 2048 },
    ],
    'materials/ml/course-x/lecture-slides': [
      { name: 'VL 11-transformers.pdf', size: 30 },
      { name: 'VL 02-nearest-neighbor.pdf', size: 20 },
    ],
  });
  const context = createFinderContext(storeFor(manifest), materials);

  const bucket = folderAt(context, [
    'domain:g-ml', 'modules', 'module:module-x', 'bucket:lecture-slides',
  ]);
  const [entry] = bucket.entries;
  assert.equal(entry.isFolder, true, 'a source whose material is a directory is a folder');
  assert.equal(entry.count, 3, 'a source folder reports what is inside it');

  const inside = folderAt(context, [
    'domain:g-ml', 'modules', 'module:module-x', 'bucket:lecture-slides',
    'source:source-lectures',
  ]);
  assert.deepEqual(
    inside.entries.map((row) => row.name),
    ['lecture-slides', 'exercise-slides', 'Primer.pdf'],
    'a source folder lists what the adapter hands it, in that order',
  );
  assert.deepEqual(
    inside.entries.map((row) => row.kind),
    ['directory', 'directory', 'file'],
    'directories and files are distinguished',
  );

  const slides = folderAt(context, [
    'domain:g-ml', 'modules', 'module:module-x', 'bucket:lecture-slides',
    'source:source-lectures', 'at:materials/ml/course-x/lecture-slides',
  ]);
  assert.equal(slides.entries.length, 2, 'descending reaches the real files');
  assert.equal(slides.entries[0].kindLabel, 'PDF document');
  assert.equal(slides.sourceId, 'source-lectures', 'a file keeps the source it came from');

  // A path escaping the materials root reads as empty, never as a folder.
  assert.equal(
    folderAt(context, [
      'domain:g-ml', 'modules', 'module:module-x', 'bucket:lecture-slides',
      'source:source-lectures', 'at:materials/../../etc',
    ]).missing,
    true,
    'a path outside materials/ must not resolve',
  );
}

{
  // Bucket priority is the documented one, and every source gets exactly one.
  const lecture = { source_type: 'lecture', roles: ['exercise', 'mock-exam'] };
  assert.equal(bucketFor(lecture), 'lecture-slides', 'a lecture deck is filed by its form');

  const pastPapers = { source_type: 'other', roles: ['mock-exam', 'exercise'] };
  assert.equal(bucketFor(pastPapers), 'past-exams', 'the more specific claim wins');

  const drill = { source_type: 'website', evaluations: [{ roles: ['exercise'] }] };
  assert.equal(bucketFor(drill), 'exercises', 'roles inside evaluations count too');

  assert.equal(bucketFor({}), 'other', 'bucketing is total');
  assert.equal(sourceTypeOf({ source_type: 'NOT-A-TYPE' }), 'other', 'typing is total');
  assert.equal(sourceTypeOf({ source_type: 'BOOK' }), 'book', 'type matching folds case');
}

{
  // Material on disk that no source claims — the sibling-folder gap.
  //
  // `source-lectures` claims `…/course-x/lecture-slides`, so `exercise-slides`
  // and the primer beside it belong to no record. They are this semester's
  // exercise sheets, and a Library that only renders records would hide them.
  const manifest = {
    thematic_groups: [{ id: 'g-ml', title: 'Machine Learning', order: 1 }],
    indexes: { source_to_modules: {} },
    records: [
      {
        id: 'source-lectures', type: 'source', title: 'Slides', source_type: 'lecture',
        thematic_group_ids: ['g-ml'],
        material_path: 'materials/ml/course-x/lecture-slides', material_exists: true,
      },
      {
        id: 'source-book', type: 'source', title: 'A book', source_type: 'book',
        thematic_group_ids: ['g-ml'],
        material_path: 'materials/ml/a-book', material_exists: true,
      },
    ],
  };
  const materials = materialsFrom({
    // The parent of the lecture-slides claim: three unclaimed siblings.
    'materials/ml/course-x': [
      { name: 'lecture-slides', children: 2 },
      { name: 'exercise-slides', children: 4 },
      { name: 'bonus-exercises', children: 1 },
      { name: 'Primer.pdf', size: 90 },
    ],
    // The parent of the whole-folder claim: registered folders and bookkeeping.
    'materials/ml': [
      { name: 'course-x', children: 4 },
      { name: 'a-book', children: 1 },
      { name: 'SOURCES.md', size: 12 },
    ],
    'materials/ml/course-x/exercise-slides': [{ name: 'Blatt 01.pdf', size: 5 }],
  });
  const context = createFinderContext(storeFor(manifest), materials);

  const shelf = folderAt(context, ['shelf:unregistered']);
  assert.deepEqual(
    shelf.entries.map((row) => row.name).sort(),
    ['Primer.pdf', 'bonus-exercises', 'exercise-slides'],
    'an unclaimed sibling of a claimed path is reported',
  );
  assert.ok(
    !shelf.entries.some((row) => row.name === 'course-x'),
    'a folder that CONTAINS a claim is reached through it, so it is not unclaimed',
  );
  assert.ok(
    !shelf.entries.some((row) => row.name === 'a-book'),
    'a directly claimed folder is not unclaimed',
  );
  assert.ok(
    !shelf.entries.some((row) => row.name === 'SOURCES.md'),
    'the tree builder\'s own index file is bookkeeping, not material',
  );

  // The shelf is offered at the root, and descends like any other folder.
  assert.ok(
    folderAt(context, []).entries.some(
      (row) => row.segment === 'shelf:unregistered' && row.count === 3,
    ),
    'the root offers the unregistered shelf with its count',
  );
  assert.deepEqual(
    folderAt(context, [
      'shelf:unregistered', 'at:materials/ml/course-x/exercise-slides',
    ]).entries.map((row) => row.name),
    ['Blatt 01.pdf'],
    'unregistered material is browsable, not merely counted',
  );

  // Nothing here is a source, so the registry invariant is untouched.
  assert.ok(
    shelf.entries.every((row) => row.sourceId === null),
    'unregistered material carries no source id, because it has none',
  );

  // A vault with nothing unclaimed does not grow an empty shelf.
  const tidy = createFinderContext(storeFor(manifest), materialsFrom({
    'materials/ml/course-x': [{ name: 'lecture-slides', children: 2 }],
    'materials/ml': [{ name: 'course-x', children: 1 }, { name: 'a-book', children: 1 }],
  }));
  assert.ok(
    !folderAt(tidy, []).entries.some((row) => row.segment === 'shelf:unregistered'),
    'the shelf is derived, so it does not appear when there is nothing in it',
  );
}

// ------------------------------------------------- the real materials adapter

/*
 * `MaterialTree` against a real directory.
 *
 * The doubles above cover what the TREE does with a listing. They cannot cover
 * the listing itself, and that is where the two properties that matter most
 * live: the numeric collation that keeps `VL 02` before `VL 11`, and the
 * realpath containment that lets `materials/.flat/` be a farm of symlinks
 * without becoming a way out of `materials/`.
 */
{
  const os = require('node:os');
  const { MaterialTree } = load('src/infrastructure/material-tree.ts');

  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'los-material-tree-'));
  const vault = path.join(sandbox, 'repository');
  const materials = path.join(sandbox, 'materials');
  const course = path.join(materials, 'ml', 'course-x');
  fs.mkdirSync(vault, { recursive: true });
  fs.mkdirSync(path.join(course, 'lecture-slides'), { recursive: true });
  fs.mkdirSync(path.join(course, 'exercise-slides'), { recursive: true });
  fs.mkdirSync(path.join(materials, '.flat'), { recursive: true });
  fs.mkdirSync(path.join(sandbox, 'outside'), { recursive: true });

  for (const name of ['VL 11-transformers.pdf', 'VL 02-nearest-neighbor.pdf', 'VL 1-intro.pdf']) {
    fs.writeFileSync(path.join(course, 'lecture-slides', name), 'x'.repeat(2048));
  }
  fs.writeFileSync(path.join(course, 'Primer.pdf'), 'x'.repeat(10));
  fs.writeFileSync(path.join(course, '.DS_Store'), 'junk');
  fs.symlinkSync(course, path.join(materials, '.flat', 'source-lectures'));
  fs.symlinkSync(path.join(sandbox, 'outside'), path.join(course, 'escape-hatch'));

  const tree = new MaterialTree({ vault: { adapter: { getBasePath: () => vault } } });

  assert.equal(tree.isDirectory('materials/ml/course-x'), true);
  assert.equal(tree.isDirectory('materials/ml/course-x/Primer.pdf'), false);
  assert.equal(tree.isDirectory('materials/ml/nope'), false, 'a missing path is not a directory');

  const listed = tree.list('materials/ml/course-x');
  assert.deepEqual(
    listed.map((row) => row.name),
    ['escape-hatch', 'exercise-slides', 'lecture-slides', 'Primer.pdf'],
    'directories sort before files, then by the app collation',
  );
  assert.ok(
    !listed.some((row) => row.name === '.DS_Store'),
    'storage junk is not material',
  );
  assert.equal(
    tree.list('materials').some((row) => row.name === '.flat'),
    false,
    'the id-addressed symlink farm is not browsable, or every source lists twice',
  );

  const slides = tree.list('materials/ml/course-x/lecture-slides');
  assert.deepEqual(
    slides.map((row) => row.name),
    ['VL 1-intro.pdf', 'VL 02-nearest-neighbor.pdf', 'VL 11-transformers.pdf'],
    'numeric collation: VL 02 sorts before VL 11, not between VL 10 and VL 12',
  );
  assert.equal(slides[0].size, 2048, 'a file reports its size');
  assert.equal(
    tree.count('materials/ml/course-x/lecture-slides'),
    3,
    'count agrees with list',
  );
  assert.equal(
    listed.find((row) => row.name === 'lecture-slides').childCount,
    3,
    'a directory reports how many items are in it',
  );

  // Containment, by realpath rather than by string prefix.
  assert.equal(tree.resolve('materials/../outside'), null, 'a lexical escape is refused');
  assert.equal(tree.resolve('../outside'), null, 'a relative escape is refused');
  assert.deepEqual(tree.list('materials/ml/course-x/escape-hatch'), [],
    'a symlink pointing out of materials/ lists as empty');
  assert.equal(tree.count('materials/ml/course-x/escape-hatch'), 0);
  // …while a symlink pointing back INTO materials/ still resolves, which is the
  // whole reason `.flat/` works.
  assert.equal(
    tree.list('materials/.flat/source-lectures').length,
    listed.length,
    'a contained symlink resolves to what it points at',
  );

  fs.rmSync(sandbox, { recursive: true, force: true });
  console.log('library-finder: MaterialTree OK — collation, hidden names and containment');
}

// ---------------------------------------------------------- the real projection

const realManifest = path.resolve(root, '..', 'repository', 'generated', 'manifest.json');
if (fs.existsSync(realManifest)) {
  const manifest = JSON.parse(fs.readFileSync(realManifest, 'utf8'));
  const { context, store } = checkVault('core', manifest, NO_MATERIALS);
  const root0 = folderAt(context, []);

  assert.ok(
    root0.entries.some((entry) => entry.kind === 'domain'),
    'core: the root offers no domains',
  );
  // The five job modules carry no thematic group. They must be somewhere.
  const ungrouped = store.modules().filter(
    (row) => !(row.thematic_group_ids ?? []).length,
  );
  if (ungrouped.length) {
    const skills = folderAt(context, ['shelf:skills']);
    assert.equal(
      skills.entries.length,
      ungrouped.length,
      'core: a module with no domain fell out of the tree',
    );
  }
  console.log(
    `library-finder: core projection OK — ${totalSourceCount(context)} sources, `
    + `all reachable across ${everyFolder(context).length} folders`,
  );
} else {
  console.log('library-finder: core projection not checked out; real-vault pass SKIPPED');
}

console.log(
  `library-finder: fixture OK — ${totalSourceCount(fixture.context)} sources across `
  + `${fixture.folders.length} folders`,
);
