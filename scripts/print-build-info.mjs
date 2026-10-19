import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const target = path.join(root, 'plugin', 'build-info.json');
if (!fs.existsSync(target)) {
  console.error('build-info.json is missing. Run `npm run build` first.');
  process.exit(1);
}
const info = JSON.parse(fs.readFileSync(target, 'utf8'));
for (const [key, value] of Object.entries(info)) {
  console.log(`${key}: ${Array.isArray(value) ? value.join(', ') : value}`);
}
