'use strict';

// Exercise the app's real decoder and store publication, without validator mocks.
const fs = require('node:fs');
const path = require('node:path');
const { createSourceModuleLoader } = require('./source-module-loader');
const load = createSourceModuleLoader(path.dirname(__dirname));
const { ManifestStore } = load('src/manifest-store.ts');
const manifestPath = process.argv[2];
if (!manifestPath) throw new Error('A manifest path is required.');
const store = new ManifestStore({
  vault: { adapter: {
    exists: async () => fs.existsSync(manifestPath),
    read: async () => fs.readFileSync(manifestPath, 'utf8'),
  } },
});

store.load().then((valid) => {
  const verdict = valid ? {
    valid: true,
    ready: store.ready,
    snapshot_id: store.snapshotId,
    source_revision: store.data._generated.source_revision,
    module_count: store.data.modules.length,
  } : { valid: false, error: store.error };
  console.log(JSON.stringify(verdict));
  process.exitCode = valid ? 0 : 1;
}).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
