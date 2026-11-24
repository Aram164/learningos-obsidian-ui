import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PRE_PHASE_3_KNOWN_DRIFT,
  checkUnitMapImportAudit,
  evaluateParityResult,
  extractImportUnitMapPayloadKeys,
} from '../scripts/check-gateway-parity.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const mirror = JSON.parse(
  fs.readFileSync(path.join(root, 'contracts/capability-schemas.generated.json'), 'utf8'),
);

// 1. Comment-only or dead-string mentions must NOT satisfy importUnitMap AST audit.
const commentOnlyGatewaySource = `
// intentional_reorder intentional_state_reset retire_stage retire_reason
export class GatewayClient {
  unrelatedHelper() {
    return 'intentional_reorder intentional_state_reset retire_stage retire_reason';
  }

  async importUnitMap(review: any) {
    // intentional_reorder intentional_state_reset
    /* retire_stage retire_reason */
    return this.capability('unit.map.import', {
      unit_id: review.unitId,
      file: review.file,
      file_sha256: review.fileSha256,
      ...(review.replace ? { replace: true } : {}),
    });
  }
}
`;

const commentKeys = extractImportUnitMapPayloadKeys(commentOnlyGatewaySource);
assert.deepEqual(
  [...commentKeys].sort(),
  ['file', 'file_sha256', 'replace', 'unit_id'],
  'comment/string mentions outside unit.map.import payload must be ignored',
);
const commentAudit = checkUnitMapImportAudit([], mirror, commentOnlyGatewaySource);
assert.deepEqual(
  commentAudit.missingOverrideSupport,
  ['intentional_reorder', 'intentional_state_reset', 'retire_stage', 'retire_reason'],
  'comment-only mentions must leave all four override flags flagged as missing',
);
assert.equal(
  commentAudit.driftHits.has('unit-map-import-override-flags-and-revision-pin'),
  true,
);

// 2. Real transmitted payload object properties (both inline spread and local object builds) pass AST audit.
const spreadGatewaySource = `
export class GatewayClient {
  async importUnitMap(review: any) {
    return this.capability('unit.map.import', {
      unit_id: review.unitId,
      file: review.file,
      file_sha256: review.fileSha256,
      ...(review.replace ? { replace: true } : {}),
      ...(review.intentionalReorder ? { intentional_reorder: true } : {}),
      ...(review.intentionalStateReset ? { intentional_state_reset: true } : {}),
      ...(review.retireStage ? { retire_stage: review.retireStage, retire_reason: review.retireReason } : {}),
    });
  }
}
`;
const spreadAudit = checkUnitMapImportAudit([], mirror, spreadGatewaySource);
assert.deepEqual(spreadAudit.missingOverrideSupport, []);
assert.equal(spreadAudit.driftHits.size, 0);

const localVarGatewaySource = `
export class GatewayClient {
  async importUnitMap(review: any) {
    const payload: Record<string, unknown> = {
      unit_id: review.unitId,
      file: review.file,
      file_sha256: review.fileSha256,
    };
    if (review.intentionalReorder) payload.intentional_reorder = true;
    if (review.intentionalStateReset) payload.intentional_state_reset = true;
    if (review.retireStage) {
      payload.retire_stage = review.retireStage;
      payload.retire_reason = review.retireReason;
    }
    return this.capability('unit.map.import', payload);
  }
}
`;
const localVarAudit = checkUnitMapImportAudit([], mirror, localVarGatewaySource);
assert.deepEqual(localVarAudit.missingOverrideSupport, []);
assert.equal(localVarAudit.driftHits.size, 0);

// 3. Disabling or throwing early in AIActionClient.applyApprovedDelivery without Gateway V2 fails strict & normal modes.
const disabledStrict = evaluateParityResult({
  strict: true,
  hardFailures: [],
  driftHits: new Set(),
  capturedCapabilities: new Set(['unit.source-selection.set', 'unit.map.import']),
  aiApplyThrew: null,
});
assert.equal(disabledStrict.ok, false, '--strict must fail if ai-action.delivery.apply is left unexercised');
assert.equal(disabledStrict.exitCode, 1);

const thrownStrict = evaluateParityResult({
  strict: true,
  hardFailures: [],
  driftHits: new Set(),
  capturedCapabilities: new Set(['unit.source-selection.set', 'unit.map.import', 'ai-action.delivery.apply']),
  aiApplyThrew: 'button disabled before send',
});
assert.equal(thrownStrict.ok, false, '--strict must fail if applyApprovedDelivery threw');
assert.equal(thrownStrict.exitCode, 1);

const phase2Strict = evaluateParityResult({
  strict: true,
  hardFailures: [],
  driftHits: new Set(Object.keys(PRE_PHASE_3_KNOWN_DRIFT)),
  capturedCapabilities: new Set(['unit.source-selection.set', 'unit.map.import']),
  aiApplyThrew: null,
});
assert.equal(phase2Strict.ok, false);
assert.equal(phase2Strict.failures.length, 3);

const phase3CleanStrict = evaluateParityResult({
  strict: true,
  hardFailures: [],
  driftHits: new Set(),
  capturedCapabilities: new Set(['unit.source-selection.set', 'unit.map.import', 'ai-action.delivery.apply']),
  aiApplyThrew: null,
});
assert.equal(phase3CleanStrict.ok, true);
assert.equal(phase3CleanStrict.exitCode, 0);

console.log('Gateway parity regression tests: AST payload extraction and strict delivery guards verified');
