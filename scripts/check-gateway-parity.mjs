/*
 * Cross-repo Gateway V2 schema-mirror, static TypeScript AST, mocked-porcelain
 * AJV payload, and response-endpoint parity gate.
 *
 * Enforces zero tolerance for Gateway V2, CLI, and response drift across:
 *   - Core schema mirror parity (`contracts/capability-schemas.generated.json` vs
 *     sibling `../repository/system/schema/capabilities/*.schema.json` and CLI request docs).
 *   - Static TypeScript AST call-site checks (literal capability ids, CLI flags
 *     and positionals, `importUnitMap` transmitted payload keys, and revision
 *     map key-count pins) plus mocked-porcelain AJV payload validation and
 *     retired-surface / response-lock coverage.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { createAjv2020 } from './ajv-options.mjs';
import { buildCapabilitySchemaMirror } from './core-contract-bundle.mjs';

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const strict = process.argv.includes('--strict');

const SNAPSHOT = `sha256:${'a'.repeat(64)}`;
const REQUIRED_RESPONSE_ENDPOINTS = [
  'HealthReportV1',
  'LegacyArchiveLockV1',
  'LegacyArchiveStatusV1',
  'MastersPlanningDashboardV1',
  'OperationsListV1',
  'OperationDetailV1',
  'GatewaySuccessV2',
  'GatewayFailureV2',
  'GatewayRequestV2',
  'MaterialSpanWire',
  'AbilityBriefWire',
  'AbilityFocusWire',
  'AbilityUnmappedWire',
  'ProjectionSettlementWire',
  'StudySequenceV1',
  'SessionEndV1',
  'StatusV1',
  'PlanTemplateV1',
  'AiActionPrepareV1',
  'AiActionStatusV1',
  'AiActionDeliveryPreviewV1',
  'UnitMapImportCheckV1',
  'UnitMapImportPreviewV1',
  'PracticeContextWire',
];

function collectTsFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (path.relative(root, full).split(path.sep).join('/') === 'src/contracts/generated') return [];
      return collectTsFiles(full);
    }
    if (!entry.isFile() || !entry.name.endsWith('.ts') || entry.name.endsWith('.d.ts')) return [];
    return [path.relative(root, full).split(path.sep).join('/')];
  }).sort();
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function stringLiteralText(node) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : null;
}

export function loadMirror({
  mirrorPath = path.join(root, 'contracts/capability-schemas.generated.json'),
  coreRoot = path.resolve(root, '../repository'),
  isStrict = strict,
  env = process.env,
} = {}) {
  if (!fs.existsSync(mirrorPath)) {
    throw new Error('Missing contracts/capability-schemas.generated.json. Run npm run contract:generate.');
  }
  const mirror = JSON.parse(fs.readFileSync(mirrorPath, 'utf8'));
  if (mirror.format !== 'learningos-capability-mirror/1') {
    throw new Error(`Unsupported capability mirror format: ${mirror.format}`);
  }
  const coreCapsDir = path.join(coreRoot, 'system/schema/capabilities');
  if (!fs.existsSync(coreCapsDir)) {
    const mustVerify = isStrict || (
      env.LEARNINGOS_ALLOW_MISSING_CORE !== '1'
      && Boolean(env.CI || env.LEARNINGOS_REQUIRE_CORE_MIRROR)
    );
    if (mustVerify) {
      throw new Error(
        `Core capability schemas not found at ${coreCapsDir}; `
        + (isStrict
          ? '--strict requires the sibling Core checkout.'
          : 'set LEARNINGOS_ALLOW_MISSING_CORE=1 only for offline local runs.'),
      );
    }
    console.log(`parity: Core checkout absent at ${coreRoot}; using mirrored contracts/capability-schemas.generated.json`);
  } else {
    const fresh = buildCapabilitySchemaMirror(coreRoot);
    assert.deepEqual(
      mirror,
      fresh,
      'contracts/capability-schemas.generated.json drifted from ../repository. Run npm run contract:generate.',
    );
    console.log(
      `parity: Core mirror matches ${Object.keys(mirror.capabilities).length} capabilities and `
      + `${Object.keys(mirror.cli_commands).length} CLI commands`,
    );
  }
  return mirror;
}

function enclosingBlock(node) {
  let current = node.parent;
  while (current) {
    if (ts.isBlock(current) || ts.isSourceFile(current)) return current;
    current = current.parent;
  }
  return null;
}

function findVariableInitializer(block, name, beforePos) {
  let found = null;
  function visit(node) {
    if (node.getStart() >= beforePos) return;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && node.initializer) {
      found = node.initializer;
    }
    ts.forEachChild(node, visit);
  }
  if (block) visit(block);
  return found;
}

function extractPushStrings(block, varName, afterPos, beforePos) {
  const guaranteed = [];
  const conditional = [];
  function visit(node, inConditional) {
    const pos = node.getStart();
    if (pos >= beforePos) return;
    const cond = inConditional || ts.isIfStatement(node) || ts.isConditionalExpression(node);
    if (
      pos > afterPos
      && ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && ts.isIdentifier(node.expression.expression)
      && node.expression.expression.text === varName
      && node.expression.name.text === 'push'
    ) {
      for (const arg of node.arguments) {
        const text = stringLiteralText(arg);
        if (text !== null) {
          (cond ? conditional : guaranteed).push(text);
        } else {
          (cond ? conditional : guaranteed).push({ dynamic: arg.getText() });
        }
      }
    }
    ts.forEachChild(node, (child) => visit(child, cond));
  }
  if (block) visit(block, false);
  return { guaranteed, conditional };
}

function collectStaticSites() {
  const srcFiles = collectTsFiles(path.join(root, 'src'));
  const capabilitySites = [];
  const cliCallSites = [];
  const revisionCountPins = [];
  const unparseable = [];

  for (const relative of srcFiles) {
    const content = fs.readFileSync(path.join(root, relative), 'utf8');
    const sourceFile = ts.createSourceFile(relative, content, ts.ScriptTarget.Latest, true);

    function visit(node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text;
        const receiver = node.expression.expression.getText(sourceFile);
        if (method === 'capability' && (receiver === 'this' || receiver.endsWith('gateway'))) {
          const cap = node.arguments[0] ? stringLiteralText(node.arguments[0]) : null;
          if (!cap) {
            unparseable.push(`${relative}:${lineOf(sourceFile, node)}: capability() call must name a literal capability id`);
          } else {
            capabilitySites.push({ file: relative, line: lineOf(sourceFile, node), capability: cap });
          }
        }
        if (method === 'call' && (receiver === 'this' || receiver.endsWith('gateway'))) {
          const arg = node.arguments[0];
          if (arg && ts.isArrayLiteralExpression(arg)) {
            const first = arg.elements[0] ? stringLiteralText(arg.elements[0]) : null;
            if (!first) {
              unparseable.push(`${relative}:${lineOf(sourceFile, node)}: call([...]) must start with a literal command name`);
            } else {
              cliCallSites.push({
                file: relative,
                line: lineOf(sourceFile, node),
                command: first,
                guaranteed: arg.elements.slice(1).map((el) => stringLiteralText(el) ?? { dynamic: el.getText(sourceFile) }),
                conditional: [],
              });
            }
          } else if (arg && ts.isIdentifier(arg)) {
            const block = enclosingBlock(node);
            const init = findVariableInitializer(block, arg.text, node.getStart(sourceFile));
            if (init && ts.isArrayLiteralExpression(init) && init.elements[0]) {
              const first = stringLiteralText(init.elements[0]);
              if (first) {
                const pushes = extractPushStrings(block, arg.text, init.getEnd(), node.getStart(sourceFile));
                cliCallSites.push({
                  file: relative,
                  line: lineOf(sourceFile, node),
                  command: first,
                  guaranteed: [
                    ...init.elements.slice(1).map((el) => stringLiteralText(el) ?? { dynamic: el.getText(sourceFile) }),
                    ...pushes.guaranteed,
                  ],
                  conditional: pushes.conditional,
                });
              }
            }
          }
        }
      }

      // Detect exact Object.keys(revisions).length === / !== N pins on Core-owned revision maps.
      if (
        ts.isBinaryExpression(node)
        && [
          ts.SyntaxKind.ExclamationEqualsEqualsToken,
          ts.SyntaxKind.EqualsEqualsEqualsToken,
          ts.SyntaxKind.ExclamationEqualsToken,
          ts.SyntaxKind.EqualsEqualsToken,
        ].includes(node.operatorToken.kind)
      ) {
        const pair = [node.left.getText(sourceFile), node.right.getText(sourceFile)];
        const keysLen = pair.find((text) => /Object\.keys\(([^)]+)\)\.length/.test(text));
        if (keysLen) {
          const targetVar = keysLen.match(/Object\.keys\(([^)]+)\)\.length/)?.[1] || '';
          if (/revision/i.test(targetVar)) {
            revisionCountPins.push({ file: relative, line: lineOf(sourceFile, node), expr: node.getText(sourceFile) });
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return { capabilitySites, cliCallSites, revisionCountPins, unparseable };
}

async function exerciseLivePorcelain(mirror, capabilitySites) {
  const { createSourceModuleLoader } = require('../tests/source-module-loader');
  const load = createSourceModuleLoader(root);
  const { GatewayClient } = load('src/gateway-client.ts');
  const { UI_GESTURE_CAPABILITIES } = load('src/contracts/gateway-v2.ts');
  const { AIActionClient } = load('src/infrastructure/ai-action-client.ts');
  const ajv = createAjv2020();
  const validators = Object.fromEntries(
    Object.entries(mirror.capabilities).map(([name, schema]) => [name, ajv.compile(schema)]),
  );

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'los-gateway-parity-'));
  const fixtureFile = path.join(tmpDir, 'attachment.txt');
  const mapFile = path.join(tmpDir, 'study-map.yaml');
  fs.writeFileSync(fixtureFile, 'fixture attachment\n');
  fs.writeFileSync(mapFile, 'id: study-map-demo\n');
  const mapSha = `sha256:${crypto.createHash('sha256').update(fs.readFileSync(mapFile)).digest('hex')}`;

  const captured = [];
  let aiApplyThrew = null;
  const plugin = {
    store: { snapshotId: SNAPSHOT },
    runLos: (args, callback, stdin) => {
      if (args[0] === 'unit-map-import-preview') {
        return callback(null, JSON.stringify({
          ok: true,
          mode: 'preview',
          can_apply: true,
          unit_id: args[1],
          study_map_id: 'study-map-demo',
          files_checked: 1,
          canonical_files_written: 0,
          file_sha256: mapSha,
          snapshot_id: SNAPSHOT,
          expected_revisions: { [args[1]]: 0, 'study-map-demo': 0, 'extra-note': 1 },
          problems: [],
          required_decisions: {
            reorder_required: false,
            state_reset_required: false,
            state_reset_optional: false,
            missing_retire_stages: [],
            retire_reason_required: false,
          },
          diff: {
            replacement: false,
            unit_status: 'ready',
            stages_after: ['stage-demo'],
            content_changes: [],
            map_changes: [],
          },
        }), '');
      }
      if (args[0] === 'unit-map-import') {
        return callback(null, JSON.stringify({
          ok: true,
          mode: 'check',
          unit_id: args[1],
          study_map_id: 'study-map-demo',
          files_checked: 1,
          canonical_files_written: 0,
          file_sha256: mapSha,
          snapshot_id: SNAPSHOT,
          expected_revisions: { [args[1]]: 0, 'study-map-demo': 0, 'extra-note': 1 },
          diff: { replacement: false },
        }), '');
      }
      if (args[0] === 'ai-action-apply-preview') {
        return callback(null, JSON.stringify({
          ok: true,
          delivery_id: args[1] || 'delivery-demo',
          request_id: 'ai-request-demo',
          delivery_sha256: mapSha,
          artifact_sha256: {},
          expected_snapshot: SNAPSHOT,
          expected_revisions: {},
        }), '');
      }
      if (stdin) {
        const envelope = JSON.parse(stdin);
        captured.push(envelope);
        return callback(null, JSON.stringify({
          schema_version: 2,
          request_id: envelope.request_id,
          idempotency_key: envelope.idempotency_key,
          capability: envelope.capability,
          ok: true,
          replayed: false,
          transaction_id: 'tx-parity',
          receipt_path: 'operations/transactions/tx-parity.yaml',
          snapshot_after: SNAPSHOT,
          result: {},
          error: null,
        }), '');
      }
      return callback(null, JSON.stringify({ ok: true }), '');
    },
  };

  const hardFailures = [];
  let saveNoteRetired = false;

  async function probe(label, fn) {
    try {
      await fn();
    } catch (error) {
      hardFailures.push(`${label} threw during mocked-porcelain probe: ${String(error?.message || error)}`);
    }
  }

  try {
    const gateway = new GatewayClient(plugin);
    try {
      await gateway.saveNote('unit-demo', 'stage-demo', 'note body');
    } catch (error) {
      if (String(error?.message || error).includes('Stage notes are a retired surface')) {
        saveNoteRetired = true;
      } else {
        hardFailures.push(`stage.note.write: unexpected error ${String(error?.message || error)}`);
      }
    }
    if (!saveNoteRetired) {
      hardFailures.push('stage.note.write: expected retired-surface refusal from GatewayClient.saveNote');
    }
    await probe('unit.note.append', () => gateway.saveUnitNote('unit-demo', {
      title: 'Note', text: 'body', stageIds: ['stage-demo'], filePaths: [fixtureFile],
    }));
    await probe('stage.progress.update', () => gateway.progress('unit-demo', 'stage-demo', 'complete'));
    await probe('unit.source-selection.set', () => gateway.sourceSelection(
      'unit-demo', 'source-demo', 'Chapter 1', 'Core explanation', true,
    ));
    await probe('source.feedback.record', () => gateway.feedback(
      'unit-demo', 'stage-demo', 'source-demo', 'helpful', 'resource-demo',
    ));
    await probe('detour.create', () => gateway.detour('unit-demo', 'stage-demo', 'Review prereq'));
    await probe('detour.resolve', () => gateway.resolveDetour('unit-demo', 'detour-demo', 'Resolved'));
    await probe('stage.attachment.add', () => gateway.attach('unit-demo', 'stage-demo', fixtureFile, 'Attachment'));
    await probe('capture.create (text)', () => gateway.captureText('inbox text', 'Title'));
    await probe('capture.create (file)', () => gateway.captureFile(fixtureFile));
    await probe('garden.seed.create', () => gateway.createGardenSeed('seed text', 'Seed title'));
    await probe('atlas.question.save', () => gateway.saveAtlasQuestion({ id: 'note-q', state: 'open' }));
    await probe('concept.relations.change', () => gateway.changeConceptRelations([
      { action: 'add', new: { from: 'a', to: 'b', kind: 'relates' } },
    ]));
    await probe('practice.verification.record', () => gateway.recordPracticeVerification(
      {
        item_id: 'practice-demo',
        expected_old: null,
        new_status: 'verified',
        method: 'self_check',
        concept_ids: ['concept-demo'],
        artifact_sha256: mapSha,
        reviewer_id: 'aram',
      },
      {
        snapshot_id: SNAPSHOT,
        practice_index_revision: 0,
        note_id: 'note-demo',
        note_revision: 0,
      },
    ));
    await probe('review.prepare', () => gateway.prepareShelving('unit-demo'));
    await probe('review.apply', () => gateway.applyShelving('unit-demo', ['item-1']));
    await probe('unit.map.import', async () => {
      await gateway.previewUnitMapImport('unit-demo', mapFile, false);
      const review = await gateway.checkUnitMapImport('unit-demo', mapFile, false);
      await gateway.importUnitMap(review);
    });
    const obsId = 'ability-observation-parity';
    await probe('learner.ability-observation.append', () => gateway.recordAbilityObservation(
      {
        workspace: 'workspace-demo',
        ability: 'ability-demo',
        claim: 'Derives Bayes rule',
        work_ref: 'curriculum/modules/module-demo/units/unit-demo/notes.md',
        confirmation_ref: 'conversation://learningos-app/' + obsId,
        activity: 'Solved derivation without notes.',
        result: 'correct',
        assistance: 'none',
        condition: ['stated prior'],
        evidence_tag: ['correct posterior'],
      },
      { kind: 'conversation', id: obsId },
    ));
    await probe('ability.candidate.append', () => gateway.recordAbilityCandidate(
      {
        from_ability: 'ability-a',
        to_ability: 'ability-b',
        kind: 'connection',
        carries: 'Shared conditioning rule',
        changes: 'Applies to continuous densities',
        condition: [],
        source_ref: 'conversation://learningos-app/candidate-parity',
      },
      { kind: 'conversation', id: 'candidate-parity' },
    ));

    const aiActions = new AIActionClient({
      gateway,
      store: { aiProviders: () => [] },
      mutate: (action) => Promise.resolve(action()),
    });
    try {
      await aiActions.applyApprovedDelivery('delivery-demo');
    } catch (error) {
      aiApplyThrew = String(error?.message || error);
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const capturedCapabilities = new Set(captured.map((env) => env.capability));
  for (const gestureCap of UI_GESTURE_CAPABILITIES) {
    if (!capturedCapabilities.has(gestureCap)) {
      hardFailures.push(
        `UI_GESTURE_CAPABILITIES capability '${gestureCap}' was not exercised via a Gateway V2 envelope (disabled, thrown early, or missing probe)`,
      );
    }
  }
  for (const site of capabilitySites) {
    if (!(site.capability in validators)) {
      hardFailures.push(`${site.file}:${site.line}: undeclared capability ${site.capability}`);
      continue;
    }
    if (site.capability === 'stage.note.write') {
      if (!saveNoteRetired) {
        hardFailures.push(`${site.file}:${site.line}: expected retired-surface refusal for stage.note.write`);
      }
      continue;
    }
    if (!capturedCapabilities.has(site.capability)) {
      hardFailures.push(`${site.file}:${site.line}: capability ${site.capability} has no exercised Gateway V2 envelope`);
    }
  }

  for (const envelope of captured) {
    const validate = validators[envelope.capability];
    if (!validate) {
      hardFailures.push(`Unknown capability emitted: ${envelope.capability}`);
      continue;
    }
    if ('expected_snapshot' in envelope.payload || 'expected_revision' in envelope.payload) {
      hardFailures.push(`${envelope.capability}: envelope concurrency token leaked into payload`);
    }
    const ok = validate(envelope.payload);
    if (!ok) {
      const msg = (validate.errors || []).map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ');
      hardFailures.push(`AJV payload failure for ${envelope.capability}: ${msg}`);
    }
  }

  return {
    hardFailures,
    exercisedCount: captured.length,
    capturedCapabilities,
    aiApplyThrew,
  };
}

export function extractImportUnitMapPayloadKeys(
  gatewaySource,
  fileName = 'src/gateway-client.ts',
) {
  const sourceFile = ts.createSourceFile(fileName, gatewaySource, ts.ScriptTarget.Latest, true);
  let importMethod = null;
  function findMethod(node) {
    if (
      ts.isMethodDeclaration(node)
      && node.name
      && ts.isIdentifier(node.name)
      && node.name.text === 'importUnitMap'
    ) {
      importMethod = node;
      return;
    }
    ts.forEachChild(node, findMethod);
  }
  findMethod(sourceFile);
  if (!importMethod?.body) return new Set();

  const localVars = new Map();
  const localMutations = new Map();
  function scanLocals(node) {
    if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.initializer
    ) {
      localVars.set(node.name.text, node.initializer);
    } else if (
      ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isPropertyAccessExpression(node.left)
      && ts.isIdentifier(node.left.expression)
    ) {
      const target = node.left.expression.text;
      if (!localMutations.has(target)) localMutations.set(target, new Set());
      localMutations.get(target).add(node.left.name.text);
    }
    ts.forEachChild(node, scanLocals);
  }
  scanLocals(importMethod.body);

  function unwrap(expr) {
    let cur = expr;
    while (
      cur
      && (ts.isParenthesizedExpression(cur)
        || ts.isAsExpression(cur)
        || ts.isTypeAssertionExpression(cur)
        || ts.isSatisfiesExpression(cur)
        || ts.isNonNullExpression(cur))
    ) {
      cur = cur.expression;
    }
    return cur;
  }

  function collectKeys(expr, keys, seenVars) {
    const node = unwrap(expr);
    if (!node) return;
    if (ts.isObjectLiteralExpression(node)) {
      for (const prop of node.properties) {
        if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) {
          if (ts.isIdentifier(prop.name)) keys.add(prop.name.text);
          else {
            const lit = stringLiteralText(prop.name);
            if (lit !== null) keys.add(lit);
          }
        } else if (ts.isSpreadAssignment(prop)) {
          collectKeys(prop.expression, keys, seenVars);
        }
      }
      return;
    }
    if (ts.isConditionalExpression(node)) {
      collectKeys(node.whenTrue, keys, seenVars);
      collectKeys(node.whenFalse, keys, seenVars);
      return;
    }
    if (
      ts.isBinaryExpression(node)
      && [
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken,
      ].includes(node.operatorToken.kind)
    ) {
      collectKeys(node.left, keys, seenVars);
      collectKeys(node.right, keys, seenVars);
      return;
    }
    if (ts.isIdentifier(node) && !seenVars.has(node.text)) {
      seenVars.add(node.text);
      if (localVars.has(node.text)) {
        collectKeys(localVars.get(node.text), keys, seenVars);
      }
      if (localMutations.has(node.text)) {
        for (const propName of localMutations.get(node.text)) keys.add(propName);
      }
    }
  }

  const keys = new Set();
  function findCapabilityPayload(node) {
    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'capability'
      && node.arguments.length >= 2
      && stringLiteralText(node.arguments[0]) === 'unit.map.import'
    ) {
      collectKeys(node.arguments[1], keys, new Set());
    }
    ts.forEachChild(node, findCapabilityPayload);
  }
  findCapabilityPayload(importMethod.body);
  return keys;
}

export function checkCliSites(cliCallSites, mirror) {
  const hardFailures = [];

  for (const site of cliCallSites) {
    const spec = mirror.cli_commands[site.command];
    if (!spec) {
      hardFailures.push(`${site.file}:${site.line}: unknown CLI command '${site.command}'`);
      continue;
    }
    const declaredFlags = new Set();
    for (const meta of Object.values(spec.properties)) {
      for (const flag of meta.flags || []) declaredFlags.add(flag);
    }

    const literalFlags = new Set();
    let positionalsCount = 0;
    const allTokens = [...site.guaranteed, ...site.conditional];
    let expectsFlagValue = false;
    for (const token of allTokens) {
      if (typeof token === 'string' && token.startsWith('-')) {
        if (!declaredFlags.has(token)) {
          hardFailures.push(`${site.file}:${site.line}: command '${site.command}' passes unknown flag '${token}'`);
        }
        literalFlags.add(token);
        const propMeta = Object.values(spec.properties).find((m) => (m.flags || []).includes(token));
        expectsFlagValue = Boolean(propMeta && !['store_true', 'store_false', 'count'].includes(propMeta.action));
      } else if (expectsFlagValue) {
        expectsFlagValue = false;
      } else if (site.guaranteed.includes(token)) {
        positionalsCount += 1;
      }
    }

    const guaranteedFlags = new Set(site.guaranteed.filter((t) => typeof t === 'string' && t.startsWith('-')));
    const requiredPositionals = Object.values(spec.properties).filter((m) => m.position !== null && m.required);
    if (positionalsCount < requiredPositionals.length) {
      hardFailures.push(
        `${site.file}:${site.line}: '${site.command}' supplies ${positionalsCount} positional(s), requires ${requiredPositionals.length}`,
      );
    }

    const missingRequiredFlags = [];
    for (const [propName, meta] of Object.entries(spec.properties)) {
      if (meta.flags.length > 0 && meta.required && !meta.flags.some((f) => guaranteedFlags.has(f))) {
        missingRequiredFlags.push(`${propName} (${meta.flags.join('/')})`);
      }
    }

    const isDirectCapabilityBypass = Boolean(
      spec.operation
      && spec.operation in mirror.capabilities
      && !literalFlags.has('--check'),
    );

    if (missingRequiredFlags.length > 0) {
      hardFailures.push(
        `${site.file}:${site.line}: '${site.command}' omits required flags: ${missingRequiredFlags.join(', ')}`,
      );
    }
    if (isDirectCapabilityBypass) {
      hardFailures.push(
        `${site.file}:${site.line}: mutating capability '${spec.operation}' called via direct CLI '${site.command}' instead of gateway.capability(...)`,
      );
    }
  }

  return { hardFailures };
}

export function checkUnitMapImportAudit(
  revisionCountPins,
  mirror,
  gatewaySource = fs.readFileSync(path.join(root, 'src/gateway-client.ts'), 'utf8'),
) {
  const hardFailures = [];
  const transmittedKeys = extractImportUnitMapPayloadKeys(gatewaySource);

  const coreOverrideFlags = [
    'intentional_reorder',
    'intentional_state_reset',
    'retire_stage',
    'retire_reason',
  ];
  const capProps = mirror.capabilities['unit.map.import']?.properties || {};
  const missingOverrideSupport = coreOverrideFlags.filter(
    (key) => key in capProps && !transmittedKeys.has(key),
  );

  for (const pin of revisionCountPins) {
    hardFailures.push(`${pin.file}:${pin.line}: exact revision count pin '${pin.expr}' rejects superset maps`);
  }
  if (missingOverrideSupport.length > 0) {
    hardFailures.push(
      `GatewayClient.importUnitMap omits Core-declared unit.map.import override flag(s): ${missingOverrideSupport.join(', ')}`,
    );
  }

  return { hardFailures, missingOverrideSupport, transmittedKeys };
}

function checkResponseBundleCoverage() {
  const lockPath = path.join(root, 'src/contracts/generated/responses.lock.json');
  const hardFailures = [];
  if (!fs.existsSync(lockPath)) {
    return ['Missing src/contracts/generated/responses.lock.json'];
  }
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  const present = new Set(lock.endpoints || []);
  for (const name of REQUIRED_RESPONSE_ENDPOINTS) {
    if (!present.has(name)) {
      hardFailures.push(`responses.lock.json missing required response endpoint: ${name}`);
    }
  }
  return hardFailures;
}

export function evaluateParityResult({
  strict: isStrict,
  hardFailures,
  capturedCapabilities,
  aiApplyThrew = null,
}) {
  const failures = [...hardFailures];
  const captured = new Set(capturedCapabilities);

  if (aiApplyThrew) {
    failures.push(
      `AIActionClient.applyApprovedDelivery threw without completing a Gateway V2 flow: ${aiApplyThrew}`,
    );
  }
  if (!captured.has('ai-action.delivery.apply')) {
    failures.push(
      'ai-action.delivery.apply / AIActionClient.applyApprovedDelivery was disabled, removed, or left unexercised without sending a Gateway V2 envelope',
    );
  }

  return {
    ok: failures.length === 0,
    exitCode: failures.length === 0 ? 0 : 1,
    strict: Boolean(isStrict),
    failures,
  };
}

async function main() {
  const mirror = loadMirror();
  const staticSites = collectStaticSites();
  const porcelain = await exerciseLivePorcelain(mirror, staticSites.capabilitySites);
  const cli = checkCliSites(staticSites.cliCallSites, mirror);
  const unitMapAudit = checkUnitMapImportAudit(staticSites.revisionCountPins, mirror);
  const responseErrors = checkResponseBundleCoverage();

  const verdict = evaluateParityResult({
    strict,
    hardFailures: [
      ...staticSites.unparseable,
      ...porcelain.hardFailures,
      ...cli.hardFailures,
      ...unitMapAudit.hardFailures,
      ...responseErrors,
    ],
    capturedCapabilities: porcelain.capturedCapabilities,
    aiApplyThrew: porcelain.aiApplyThrew,
  });

  if (!verdict.ok) {
    console.error(`Gateway parity${strict ? ' --strict' : ''} FAILED (${verdict.failures.length} violation(s)):`);
    for (const failure of verdict.failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Gateway parity${strict ? ' --strict' : ''} OK: 0 drifts across ${porcelain.exercisedCount} mocked-porcelain V2 probes, `
    + `${staticSites.cliCallSites.length} CLI call sites, and ${REQUIRED_RESPONSE_ENDPOINTS.length} response endpoints.`,
  );
}

const isMain = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exitCode = 1;
  });
}
