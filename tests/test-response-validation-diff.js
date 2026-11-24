'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createSourceModuleLoader } = require('./source-module-loader');
const root = path.dirname(__dirname);
const load = createSourceModuleLoader(root);
const golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'response-validation-golden.json')));
const validators = require('../src/contracts/generated/responses.validator.cjs');
const schemas = { asHealthReport: 'HealthReportV1', asLegacyArchiveLock: 'LegacyArchiveLockV1',
  asLegacyArchiveStatus: 'LegacyArchiveStatusV1', asMastersPlanningDashboard: 'MastersPlanningDashboardV1',
  asAbilityBrief: 'AbilityBriefWire', asAbilityFocus: 'AbilityFocusWire', asAbilityUnmapped: 'AbilityUnmappedWire',
  asMaterialSpan: 'MaterialSpanWire', asOperationsList: 'OperationsListV1', asOperationDetail: 'OperationDetailV1',
  asGatewaySuccessV2: 'GatewaySuccessV2', asGatewayFailureV2: 'GatewayFailureV2', asGatewayRequestV2: 'GatewayRequestV2' };
function canonical(value) {
  return Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
}
const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
function outcome(fn, args) {
  try {
    const value = fn(...JSON.parse(JSON.stringify(args), (_, item) => item && item.__set ? new Set(item.__set) : item));
    return value === null ? { kind: 'reject' } : { kind: 'value', value };
  } catch (error) {
    return JSON.parse(JSON.stringify({ kind: 'throw', message: error.message, code: error.code, retryable: error.retryable }));
  }
}
const coverage = new Map();
for (const [index, test] of golden.cases.entries()) {
  const seed = golden.seeds[test.seed];
  const args = JSON.parse(JSON.stringify(seed.args));
  const mutation = test.mutation;
  if (mutation) {
    if (mutation.path.length === 0) args[0] = mutation.value;
    else {
      let parent = args[0];
      for (const key of mutation.path.slice(0, -1)) parent = parent[key];
      const key = mutation.path.at(-1);
      if (mutation.delete) delete parent[key];
      else parent[key] = mutation.value;
    }
  }
  const schema = schemas[seed.name];
  assert(schema, seed.name);
  assert.equal(Boolean(validators['validate' + schema](args[0])), test.shape, `Core shape ${index} ${seed.name}`);
  const fn = load('src/contracts/' + seed.file + '.ts')[seed.name];
  assert.equal(hash(outcome(fn, args)), test.expected, `Decoder verdict/projection ${index} ${seed.name}`);
  const counts = coverage.get(seed.name) || { accepts: 0, rejects: 0 };
  counts[test.shape ? 'accepts' : 'rejects'] += 1;
  coverage.set(seed.name, counts);
}
assert.equal(coverage.size, 13);
for (const [name, count] of coverage) assert(count.accepts > 0 && count.rejects > 0, name);
assert.equal(golden.core_shape_comparisons, golden.cases.length);
assert.equal(golden.cases.length, 12750);
// A counterfactual decoder that silently changes projection content must fail.
assert.notEqual(hash({ kind: 'value', value: { corrupted: true } }), golden.cases[0].expected);

// Phase 2: validate all 7 newly added response endpoint validators (positive + negative).
const SNAPSHOT = `sha256:${'a'.repeat(64)}`;
const DIGEST = `sha256:${'b'.repeat(64)}`;
const SEVEN_ENDPOINTS = {
  StudySequenceV1: {
    valid: {
      contract: 'study-sequence-v1',
      snapshot_id: SNAPSHOT,
      valid_on_date: '2026-10-01',
      timezone: 'Europe/Berlin',
      lifetime: 'unit-view-and-snapshot',
      canonical_files_written: 0,
      unit_id: 'unit-demo-l01',
      study_map_id: 'study-map-demo-l01',
      canonical_current_stage: 'stage-demo',
      durable_stage_ids: ['stage-demo'],
      omitted_stage_ids: [],
      limitations: ['No mastery inferred.'],
      stages: [{ id: 'stage-demo', title: 'Derive', status: 'active' }],
      prerequisite_edges: [],
    },
    invalid: { contract: 'study-sequence-v1', snapshot_id: SNAPSHOT, valid_on_date: 'not-a-date' },
  },
  SessionEndV1: {
    valid: {
      ok: true,
      touched: [],
      owned_changes: [],
      unrelated_changes: [],
      committed: false,
      pushed: false,
      validation: '0 error(s), 0 warning(s)',
      ownership_conflicts: [],
      session_id: 'channel:ui',
      client: 'obsidian-ui/2.0.0',
      stale_paths: [],
      stale_hours: 24,
      other_sessions: {},
      session_closed: false,
    },
    invalid: { ok: true, committed: 'no' },
  },
  StatusV1: {
    valid: {
      learning_os: '3.2.0',
      root: '<ROOT>',
      counts: {
        notes: 1, concepts: 1, concept_relations: 0, sources: 1, programs: 1,
        programs_quarantined: 0, modules: 1, modules_compatibility_only: 0,
        modules_enrolled: 1, active_workspaces: 1, standing_workspaces: 0,
        archived_workspaces: 0, inbox_items: 0, inbox_files: 0, garden_notes: 0,
        units: 1, study_maps: 1,
      },
      adoption: { notes_reviewed: 0, notes_with_evidence: 0 },
      exam_spine: [],
      validation: { skipped: true },
    },
    invalid: { learning_os: '3.2.0', validation: { skipped: false } },
  },
  PlanTemplateV1: {
    valid: {
      ok: true,
      contract: 'plan-template-v1',
      profile: 'curriculum',
      plan_template_version: 1,
      schema: 'study-map.schema.json',
      plan: {
        id: 'study-map-demo-l01',
        type: 'study-map',
        plan_template_version: 1,
        unit_id: 'unit-demo-l01',
        status: 'ready',
        current_stage: 'stage-demo',
        source_plan: { path: 'replace-with-reviewed-plan.yaml', provenance: 'operator' },
        detours: [],
        stages: [{
          id: 'stage-demo',
          number: 1,
          title: 'Stage Demo',
          status: 'pending',
          objective: 'Objective',
          done_when: ['Done criterion'],
          exam_critical: false,
          concepts: [],
          scope_triage: 'required-now',
          resources: [],
          working_note: 'curriculum/modules/m/units/u/stages/stage-demo/notes.md',
          attachments: [],
          source_feedback: [],
        }],
        shelving: { state: 'none' },
      },
    },
    invalid: { ok: true, contract: 'plan-template-v1', profile: 'unknown-profile' },
  },
  AiActionPrepareV1: {
    valid: {
      ok: true,
      request: {
        id: 'ai-request-1',
        action_id: 'garden.shelve',
        target: { kind: 'garden-note', id: 'garden-note-seed' },
        provider: 'manual-bundle',
        status: 'prepared',
        created_at: '2026-10-01T07:00:00+00:00',
        delivery_id: null,
        receipt_id: null,
        bundle_path: 'operations/ai-actions/requests/ai-request-1',
      },
      bundle_path: 'operations/ai-actions/requests/ai-request-1',
    },
    invalid: { ok: true, bundle_path: 'operations/ai-actions/requests/ai-request-1' },
  },
  AiActionStatusV1: {
    valid: {
      ok: true,
      request: {
        id: 'ai-request-1',
        action_id: 'garden.shelve',
        target: { kind: 'garden-note', id: 'garden-note-seed' },
        provider: 'manual-bundle',
        status: 'delivery-ready',
        created_at: '2026-10-01T07:00:00+00:00',
        delivery_id: 'ai-delivery-1',
        receipt_id: null,
        bundle_path: 'operations/ai-actions/requests/ai-request-1',
      },
    },
    invalid: { ok: true, request: { id: 'ai-request-1', status: 'bogus-status' } },
  },
  UnitMapImportCheckV1: {
    valid: {
      ok: true,
      mode: 'check',
      unit_id: 'unit-demo-l01',
      study_map_id: 'study-map-demo-l01',
      files_checked: 2,
      canonical_files_written: 0,
      file_sha256: DIGEST,
      snapshot_id: SNAPSHOT,
      expected_revisions: { 'unit-demo-l01': 1, 'study-map-demo-l01': 0 },
      diff: {
        replacement: false,
        unit_status: 'ready',
        stages_after: ['stage-demo'],
        content_changes: [],
        map_changes: [],
      },
    },
    invalid: { ok: true, mode: 'apply', canonical_files_written: 1 },
  },
};
for (const [name, sample] of Object.entries(SEVEN_ENDPOINTS)) {
  const fn = validators['validate' + name];
  assert.equal(typeof fn, 'function', `Missing validator validate${name}`);
  assert.equal(Boolean(fn(sample.valid)), true, `Expected valid ${name}: ${JSON.stringify(fn.errors)}`);
  assert.equal(Boolean(fn(sample.invalid)), false, `Expected invalid ${name} to fail`);
}
console.log(`Response differential OK: ${golden.cases.length} cases, 13 endpoints (+7 generated Phase 2 validators verified); ${golden.stricter_malformed_rejections} malformed values rejected by producer shape`);
