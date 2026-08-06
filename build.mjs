import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const files = [
  'src/constants.ts',
  'src/app/router.ts',
  'src/manifest-store.ts',
  'src/gateway-client.ts',
  'src/infrastructure/ai-action-client.ts',
  'src/components.ts',
  'src/app/global-search.ts',
  'src/app/unit-note-modal.ts',
  'src/features/ai-actions/action-button.ts',
  'src/views/home-view.ts',
  'src/views/program-view.ts',
  'src/views/module-view.ts',
  'src/views/project-view.ts',
  'src/views/unit-view.ts',
  'src/views/library-view.ts',
  'src/views/atlas-view.ts',
  'src/views/shelving-view.ts',
  'src/views/boundary-view.ts',
  'src/views/review-view.ts',
  'src/views/garden-view.ts',
  'src/views/nav-view.ts',
  'src/settings.ts',
  'src/main.ts',
];

const header = `'use strict';\n\nconst { Plugin, PluginSettingTab, ItemView, Modal, Notice, Setting, setIcon } = require('obsidian');\nconst { execFile } = require('child_process');\nconst fs = require('fs');\nconst nodePath = require('path');\nconst { shell, webUtils } = require('electron');\n`;
const sources = files.map((relative) => ({
  relative,
  source: fs.readFileSync(path.join(root, relative), 'utf8'),
}));
const sections = sources.map(({ relative, source }) => {
  const stripped = source.replace(/^export\s+(?=(?:class|const|function)\s+[A-Za-z_$])/gm, '');
  return `\n/* ---- ${relative} ---- */\n${stripped.trim()}\n`;
});
const output = `${header}${sections.join('')}\nmodule.exports = LearningOSUI;\n`;
const pluginDir = path.join(root, 'plugin');
fs.mkdirSync(pluginDir, { recursive: true });
fs.writeFileSync(path.join(pluginDir, 'main.js'), output, 'utf8');

const sha256 = (value) => `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
const pluginManifest = JSON.parse(fs.readFileSync(path.join(pluginDir, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(root, 'contracts', 'manifest-v2.lock.json'), 'utf8'));
let sourceRevision = process.env.LEARNINGOS_UI_SOURCE_REVISION || process.env.GITHUB_SHA || '';
if (!sourceRevision) {
  try {
    sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch (_) {
    sourceRevision = 'working-tree';
  }
}
const sourceMaterial = [
  fs.readFileSync(path.join(root, 'build.mjs'), 'utf8'),
  fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
  fs.readFileSync(path.join(root, 'contracts', 'manifest-v2.lock.json'), 'utf8'),
  ...sources.flatMap(({ relative, source }) => [relative, source]),
].join('\0');
const buildInfo = {
  schema_version: 1,
  ui_version: pluginManifest.version,
  manifest_contract_version: contract.contract_version,
  source_revision: sourceRevision,
  source_fingerprint: sha256(sourceMaterial),
  bundle_sha256: sha256(output),
  node_version: process.version,
  modules: files,
};
fs.writeFileSync(path.join(pluginDir, 'build-info.json'), `${JSON.stringify(buildInfo, null, 2)}\n`, 'utf8');
console.log(`build: ${files.length} TypeScript modules -> plugin/main.js (${Buffer.byteLength(output)} bytes, ${buildInfo.bundle_sha256})`);
