import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { STYLESHEET_MODULES, composeStylesheet } from '../build-styles.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const bundlePath = path.join(root, 'plugin', 'main.js');
const stylesPath = path.join(root, 'plugin', 'styles.css');
const infoPath = path.join(root, 'plugin', 'build-info.json');
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

function buildOnce() {
  const result = spawnSync(process.execPath, ['build.mjs'], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'build failed');
  return {
    bundle: fs.readFileSync(bundlePath),
    styles: fs.readFileSync(stylesPath, 'utf8'),
    info: fs.readFileSync(infoPath, 'utf8'),
  };
}

const first = buildOnce();
const second = buildOnce();
if (!first.bundle.equals(second.bundle) || first.styles !== second.styles || first.info !== second.info) {
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
/* Core and the UI release together. A release build must therefore be able to
 * name the core it was verified against — "which pair is this?" should be
 * answerable from the artifact, not only by re-running the check. In CI, where
 * core is checked out and check-contract.mjs refuses an unverified mirror, a
 * null core_revision means the pairing went unrecorded and the artifact cannot
 * substantiate the release-together claim. */
if (process.env.CI && process.env.LEARNINGOS_ALLOW_MISSING_CORE !== '1'
    && !/^[0-9a-f]{40}$/.test(String(info.core_revision ?? ''))) {
  throw new Error(
    `A release build must record the core commit it was verified against; `
    + `build-info.json says core_revision: ${JSON.stringify(info.core_revision ?? null)}.`,
  );
}
if (!Array.isArray(info.modules) || !info.modules.includes('src/main.ts')
    || !info.modules.includes('src/manifest-store.ts')) {
  throw new Error('The module graph did not report the expected source inputs.');
}
if (second.bundle.includes(Buffer.from('/* ---- src/'))) {
  throw new Error('Legacy concatenation section markers remain in the bundle.');
}
/* The stylesheet is an artifact now, so it gets the artifact's guarantees: it
 * is exactly the declared cascade, and build-info's fingerprint describes the
 * file that actually ships. Hand-editing plugin/styles.css fails here rather
 * than surviving until the next build silently discards it. */
if (second.styles !== composeStylesheet()) {
  throw new Error('plugin/styles.css is not the composition of src/styles — was it edited by hand?');
}
if (info.stylesheet_sha256 !== `sha256:${hash(second.styles)}`) {
  throw new Error('build-info.json stylesheet fingerprint does not match plugin/styles.css.');
}
if (!Array.isArray(info.stylesheet_modules)
    || info.stylesheet_modules.length !== STYLESHEET_MODULES.length
    || !info.stylesheet_modules.includes('src/styles/00-tokens.css')) {
  throw new Error('The stylesheet cascade did not report the expected source inputs.');
}
console.log(`build: deterministic ${info.bundler} ${info.modules.length}-module bundle ${info.bundle_sha256}`);
console.log(`build: deterministic ${info.stylesheet_modules.length}-module stylesheet ${info.stylesheet_sha256}`);
