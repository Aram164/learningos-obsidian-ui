/* Core-owned UI response validators and wire types. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import standaloneCode from 'ajv/dist/standalone/index.js';
import { createAjv2020, registerBundleIdentities } from './ajv-options.mjs';
import { findCorePython } from './core-contract-bundle.mjs';
import { emitTypes } from './emit-contract-types.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const core = path.resolve(root, '../repository');
const production = path.join(root, 'src/contracts/generated');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'los-response-contract-'));
const checking = process.argv.includes('--check');
const schemaRelative = 'system/schema/ui-responses.schema.json';
const names = ['HealthReportV1', 'LegacyArchiveLockV1', 'LegacyArchiveStatusV1',
  'MastersPlanningDashboardV1', 'OperationsListV1', 'OperationDetailV1',
  'GatewaySuccessV2', 'GatewayFailureV2', 'GatewayRequestV2', 'MaterialSpanWire',
  'AbilityBriefWire', 'AbilityFocusWire', 'AbilityUnmappedWire'];
try {
  const info = findCorePython(core);
  if (!info) throw new Error('Core with its dependencies is required to generate or check response contracts.');
  const result = spawnSync(info.python, ['tools/contract_bundle.py', 'build',
    '--schema', schemaRelative, '--out', scratch], { cwd: core, env: info.env, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  const bytes = fs.readFileSync(path.join(scratch, 'ui-responses.bundle.json'));
  const bundle = JSON.parse(bytes);
  const ajv = createAjv2020();
  registerBundleIdentities(ajv, bundle);
  const exports = Object.fromEntries(names.map((name) => ['validate' + name,
    bundle.root_uri + '#/$defs/' + name]));
  // Validate every endpoint before generating the standalone module.
  for (const uri of Object.values(exports)) if (!ajv.getSchema(uri)) throw new Error('Unresolved response ' + uri);
  const header = '// GENERATED from Core system/schema/ui-responses.schema.json; do not edit.\n';
  const aliases = Object.fromEntries(Object.keys(bundle.root.$defs).map((name) =>
    [name, { resource: bundle.root_uri, pointer: '/$defs/' + name }]));
  const artifacts = {
    'responses.validator.cjs': header + standaloneCode(ajv, exports),
    'responses.types.ts': emitTypes(bundle, aliases).source,
    'responses.validator.d.cts': header + "import type * as Wire from './responses.types';\n" + names.map((name) =>
      `export function validate${name}(value: unknown): value is Wire.${name};`).join('\n') + '\n',
    'responses.lock.json': JSON.stringify({ root: schemaRelative,
      closure_sha256: 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex'),
      endpoints: names }, null, 2) + '\n',
  };
  fs.mkdirSync(production, { recursive: true });
  for (const [name, content] of Object.entries(artifacts)) {
    const target = path.join(production, name);
    if (checking) {
      if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content) {
        throw new Error(`Response contract drift: ${name}. Run npm run contract:responses.`);
      }
    } else fs.writeFileSync(target, content);
  }
  console.log(`Response contracts ${checking ? 'match Core' : 'generated'}: ${names.length} endpoints, ${bundle.resources.length} resources`);
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
