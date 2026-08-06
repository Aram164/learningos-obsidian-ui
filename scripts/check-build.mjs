import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const bundlePath = path.join(root, 'plugin', 'main.js');
const infoPath = path.join(root, 'plugin', 'build-info.json');
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

function build() {
  const result = spawnSync(process.execPath, ['build.mjs'], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'build failed');
  return {
    bundle: fs.readFileSync(bundlePath),
    info: fs.readFileSync(infoPath, 'utf8'),
  };
}

const first = build();
const second = build();
if (!first.bundle.equals(second.bundle) || first.info !== second.info) {
  throw new Error('Build is not deterministic: two consecutive builds differ.');
}

const info = JSON.parse(second.info);
if (info.bundle_sha256 !== `sha256:${hash(second.bundle)}`) {
  throw new Error('build-info.json bundle fingerprint does not match plugin/main.js.');
}
for (const source of info.modules || []) {
  if (!second.bundle.includes(Buffer.from(`/* ---- ${source} ---- */`))) {
    throw new Error(`Built bundle is missing source section ${source}.`);
  }
}
console.log(`build: deterministic ${info.modules.length}-module bundle ${info.bundle_sha256}`);
