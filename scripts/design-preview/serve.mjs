#!/usr/bin/env node
/*
 * Serve the plugin in a browser against one manifest, read-only:
 *
 *   node scripts/design-preview/serve.mjs [--manifest PATH] [--port 8765]
 *
 * The default manifest is the synthetic fixture. Reading a real one is safe: this
 * process only ever reads it, and the preview's vault adapter refuses every write.
 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { composeStylesheet } from '../../build-styles.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const option = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : fallback;
};
const manifestPath = path.resolve(option('manifest', path.join(root, 'fixture-vault/generated/manifest.json')));
const port = Number(option('port', '8765'));
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'los-design-preview-'));

const stubHost = {
  name: 'stub-host',
  setup(build) {
    build.onResolve({ filter: /^obsidian$/ }, () => ({ path: path.join(here, 'obsidian-browser.mjs') }));
    build.onResolve({ filter: /^(node:.*|electron|fs|path|child_process|crypto)$/ }, (args) => ({ path: args.path, namespace: 'stub' }));
    build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
      contents: 'const stub = new Proxy(function () {}, { get: (t, k) => (k === "__esModule" ? true : k === Symbol.toPrimitive ? () => "" : stub), apply: () => stub, construct: () => stub }); module.exports = stub;',
      loader: 'js',
    }));
  },
};
const context = await esbuild.context({
  entryPoints: [path.join(here, 'entry.mjs')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  outfile: path.join(out, 'bundle.js'),
  plugins: [stubHost],
  define: { 'process.platform': '"darwin"', 'process.env': '{}' },
  logLevel: 'warning',
});

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
http.createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const name = pathname === '/' ? 'index.html' : pathname.slice(1);
  try {
    let body;
    if (name === 'bundle.js') { await context.rebuild(); body = fs.readFileSync(path.join(out, name)); }
    else if (name === 'styles.css') body = composeStylesheet();
    else if (name === 'manifest.json') body = fs.readFileSync(manifestPath);
    else if (name === 'index.html') body = fs.readFileSync(path.join(here, name));
    else { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'content-type': types[path.extname(name)] ?? 'text/plain', 'cache-control': 'no-store' }).end(body);
  } catch (error) {
    response.writeHead(500).end(String(error));
  }
}).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}/ · manifest ${manifestPath}`));
