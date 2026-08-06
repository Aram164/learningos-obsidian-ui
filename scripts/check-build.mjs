import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const bundlePath = path.join(root, 'plugin', 'main.js');
const infoPath = path.join(root, 'plugin', 'build-info.json');
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

function buildOnce() {
  const result = spawnSync(process.execPath, ['build.mjs'], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'build failed');
  return {
    bundle: fs.readFileSync(bundlePath),
    info: fs.readFileSync(infoPath, 'utf8'),
  };
}

const first = buildOnce();
const second = buildOnce();
if (!first.bundle.equals(second.bundle) || first.info !== second.info) {
  throw new Error('Build is not deterministic: two consecutive builds differ.');
}

const info = JSON.parse(second.info);
if (!['esbuild', 'typescript-fallback'].includes(info.bundler) || info.entry_point !== 'src/main.ts') {
  throw new Error('build-info.json does not describe the expected module entrypoint.');
}
if (process.env.CI && process.env.LEARNINGOS_ALLOW_FALLBACK !== '1' && info.bundler !== 'esbuild') {
  throw new Error('CI builds must use esbuild; the offline fallback is verification-only.');
}
if (info.bundle_sha256 !== `sha256:${hash(second.bundle)}`) {
  throw new Error('build-info.json bundle fingerprint does not match plugin/main.js.');
}
if (!Array.isArray(info.modules) || !info.modules.includes('src/main.ts')
    || !info.modules.includes('src/manifest-store.ts')) {
  throw new Error('The module graph did not report the expected source inputs.');
}
if (second.bundle.includes(Buffer.from('/* ---- src/'))) {
  throw new Error('Legacy concatenation section markers remain in the bundle.');
}
console.log(`build: deterministic ${info.bundler} ${info.modules.length}-module bundle ${info.bundle_sha256}`);
