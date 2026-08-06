import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * Properties and helpers provided by tests/harness.js but not by Obsidian's
 * real HTMLElement surface.
 *
 * Production code that reads these may pass the synthetic suite while failing
 * in Obsidian. Keep test-driver helpers in tests only.
 */
const HARNESS_ONLY = [
  '.attrs',
  '.fire(',
  '.classes',
  '.allText(',
  '.findText(',
  '.listeners',
];

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, '..', 'src');
const files = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
}

walk(root);

const hits = [];

for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');

  lines.forEach((line, index) => {
    for (const token of HARNESS_ONLY) {
      if (line.includes(token)) {
        hits.push(
          `${path.relative(root, file)}:${index + 1}  ${token}  ${line.trim()}`,
        );
      }
    }
  });
}

if (hits.length > 0) {
  console.error(
    `Production source reads harness-only host API:\n  ${hits.join('\n  ')}`,
  );
  process.exit(1);
}

console.log(`check-host-surface: ${files.length} files clean`);
