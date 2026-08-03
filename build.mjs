import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const files = [
  'src/constants.ts',
  'src/manifest-store.ts',
  'src/gateway-client.ts',
  'src/components.ts',
  'src/views/home-view.ts',
  'src/views/program-view.ts',
  'src/views/module-view.ts',
  'src/views/unit-view.ts',
  'src/views/library-view.ts',
  'src/views/atlas-view.ts',
  'src/views/shelving-view.ts',
  'src/views/boundary-view.ts',
  'src/views/review-view.ts',
  'src/views/nav-view.ts',
  'src/settings.ts',
  'src/main.ts',
];

const header = `'use strict';\n\nconst { Plugin, PluginSettingTab, ItemView, Modal, Notice, Setting, setIcon } = require('obsidian');\nconst { execFile } = require('child_process');\nconst fs = require('fs');\nconst nodePath = require('path');\nconst { shell, webUtils } = require('electron');\n`;
const sections = files.map((relative) => {
  const source = fs.readFileSync(path.join(root, relative), 'utf8')
    .replace(/^export\s+(?=(?:class|const|function)\s+[A-Za-z_$])/gm, '');
  return `\n/* ---- ${relative} ---- */\n${source.trim()}\n`;
});
const output = `${header}${sections.join('')}\nmodule.exports = LearningOSUI;\n`;
fs.writeFileSync(path.join(root, 'plugin', 'main.js'), output, 'utf8');
console.log(`build: ${files.length} TypeScript modules -> plugin/main.js (${Buffer.byteLength(output)} bytes)`);
