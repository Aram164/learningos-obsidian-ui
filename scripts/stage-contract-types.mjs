/*
 * Stage a contract bundle as relative-ref JSON files for type generators.
 *
 * Reproducibility helper for the Phase 3 verdict (json-schema-to-typescript
 * cannot consume this graph): rewrites every alias URI to a relative file
 * path from the bundle's own alias map, strips $id/$schema (tooling does
 * $id-based resolution poorly or not at all), and overrides the stale root
 * title with the version-derived ManifestV<N>.
 *
 * Usage:
 *   node scripts/stage-contract-types.mjs --bundle <bundle.json> --meta <meta.json> --out <dir>
 *   npx --package=json-schema-to-typescript json2ts -i <dir>/root.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function argValue(argv, name, fallback = null) {
  const index = argv.indexOf(name);
  if (index === -1) return fallback;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${name}.`);
  return value;
}

function rewriteRefs(node, aliasToFile) {
  if (Array.isArray(node)) return node.map((item) => rewriteRefs(item, aliasToFile));
  if (node && typeof node === 'object') {
    const rewritten = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && typeof value === 'string' && !value.startsWith('#')) {
        const hash = value.indexOf('#');
        const base = hash === -1 ? value : value.slice(0, hash);
        const fragment = hash === -1 ? '' : value.slice(hash);
        const target = aliasToFile.get(base);
        if (target === undefined) {
          throw new Error(`staging cannot resolve $ref ${value}.`);
        }
        rewritten[key] = target === '<root>' ? `#${fragment}` : `./${target}${fragment}`;
      } else {
        rewritten[key] = rewriteRefs(value, aliasToFile);
      }
    }
    return rewritten;
  }
  return node;
}

const bundlePath = argValue(process.argv, '--bundle');
const metaPath = argValue(process.argv, '--meta');
const outDir = argValue(process.argv, '--out');
if (!bundlePath || !metaPath || !outDir) {
  throw new Error('Usage: stage-contract-types.mjs --bundle <p> --meta <p> --out <dir>.');
}

const bundle = JSON.parse(fs.readFileSync(path.resolve(root, bundlePath), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.resolve(root, metaPath), 'utf8'));
if (typeof meta.contract_version !== 'number') {
  throw new Error('Meta carries no numeric contract_version.');
}
const aliasToFile = new Map([[bundle.root_uri, '<root>']]);
for (const resource of bundle.resources || []) {
  for (const alias of resource.aliases || []) aliasToFile.set(alias, resource.path);
  if (resource.declared_id) aliasToFile.set(resource.declared_id, resource.path);
}

const resolvedOut = path.resolve(root, outDir);
fs.mkdirSync(resolvedOut, { recursive: true });
for (const resource of bundle.resources || []) {
  const { $id: _id, $schema: _schema, ...rest } = resource.schema;
  fs.writeFileSync(path.join(resolvedOut, resource.path), JSON.stringify(rewriteRefs(rest, aliasToFile)));
}
const { $id: _rootId, $schema: _rootSchema, ...rootRest } = bundle.root;
fs.writeFileSync(path.join(resolvedOut, 'root.json'), JSON.stringify({
  ...rewriteRefs(rootRest, aliasToFile),
  title: `ManifestV${meta.contract_version}`,
}));
console.log(`staged ${(bundle.resources || []).length + 1} files in ${resolvedOut}`);
