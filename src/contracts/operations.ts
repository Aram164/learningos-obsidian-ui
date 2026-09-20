/**
 * Strict decoders for the read-only `operations` command (track #2, Phase 4A).
 *
 * The Operations view renders resolver verdicts — it never re-derives them,
 * never reads receipts or the trace store itself, and never reconstructs
 * causality from raw spans. Anything this decoder rejects is shown as
 * "Operations unavailable" rather than guessed at.
 */

export interface OperationRowV1 {
  readonly trace_id: string;
  readonly request_id: string | null;
  readonly capability: string;
  readonly started_at: number | null;
  readonly duration_ms: number | null;
  readonly attempts: number;
  readonly replayed: boolean;
  readonly first_failure_stage: string | null;
  readonly canonical_outcome: 'COMMITTED' | 'NOT_COMMITTED' | 'AMBIGUOUS';
  readonly recovery_requirement: 'none' | 'verify-observation' | 'reconcile-exact-request';
  readonly needs_attention: boolean;
}

export interface OperationsListV1 {
  readonly operations: readonly OperationRowV1[];
}

export interface OperationAttemptV1 {
  readonly span: string;
  readonly status: string;
  readonly replay_of: string | null;
}

export interface OperationDiagnosisV1 {
  readonly first_failure_stage: string | null;
  readonly execution_outcome: string;
  readonly canonical_outcome: 'COMMITTED' | 'NOT_COMMITTED' | 'AMBIGUOUS';
  readonly projection_outcome: string;
  readonly recovery_requirement: 'none' | 'verify-observation' | 'reconcile-exact-request';
  readonly authoritative_evidence: readonly string[];
  readonly attempts: readonly OperationAttemptV1[];
  readonly reasons: readonly string[];
}

export interface OperationTimelineRowV1 {
  readonly stage: string;
  readonly state: 'passed' | 'failed' | 'skipped' | 'missing';
  readonly detail: string | null;
}

export interface OperationFactsV1 {
  readonly transaction_id: string | null;
  readonly receipt_path: string | null;
  readonly snapshot_before: string | null;
  readonly snapshot_after: string | null;
}

export interface OperationDetailV1 {
  readonly request_id: string;
  readonly capability: string;
  readonly diagnosis: OperationDiagnosisV1;
  readonly timeline: readonly OperationTimelineRowV1[];
  readonly observed_snapshot: string | null;
  readonly ui_outcome: 'SETTLED' | 'REFUSED' | 'BLOCKED';
  readonly facts: OperationFactsV1;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function exactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
): boolean {
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key))
    && Object.keys(value).every((key) => (required as readonly string[]).includes(key));
}

const CANONICAL = ['COMMITTED', 'NOT_COMMITTED', 'AMBIGUOUS'];
const RECOVERY = ['none', 'verify-observation', 'reconcile-exact-request'];

function asRow(value: unknown): OperationRowV1 | null {
  const row = record(value);
  if (!row || !exactKeys(row, ['trace_id', 'request_id', 'capability',
    'started_at', 'duration_ms', 'attempts', 'replayed',
    'first_failure_stage', 'canonical_outcome', 'recovery_requirement',
    'needs_attention'])) return null;
  if (typeof row.trace_id !== 'string' || typeof row.capability !== 'string') return null;
  if (row.request_id !== null && typeof row.request_id !== 'string') return null;
  if (row.started_at !== null && typeof row.started_at !== 'number') return null;
  if (row.duration_ms !== null && typeof row.duration_ms !== 'number') return null;
  if (typeof row.attempts !== 'number' || typeof row.replayed !== 'boolean') return null;
  if (row.first_failure_stage !== null && typeof row.first_failure_stage !== 'string') return null;
  if (!CANONICAL.includes(String(row.canonical_outcome))) return null;
  if (!RECOVERY.includes(String(row.recovery_requirement))) return null;
  if (typeof row.needs_attention !== 'boolean') return null;
  return row as unknown as OperationRowV1;
}

export function asOperationsList(value: unknown): OperationsListV1 | null {
  const body = record(value);
  if (!body || !exactKeys(body, ['operations']) || !Array.isArray(body.operations)) return null;
  const operations: OperationRowV1[] = [];
  for (const item of body.operations) {
    const row = asRow(item);
    if (!row) return null;
    operations.push(row);
  }
  return { operations };
}

function asAttempt(value: unknown): OperationAttemptV1 | null {
  const row = record(value);
  if (!row || !exactKeys(row, ['span', 'status', 'replay_of'])) return null;
  if (typeof row.span !== 'string' || typeof row.status !== 'string') return null;
  if (row.replay_of !== null && typeof row.replay_of !== 'string') return null;
  return row as unknown as OperationAttemptV1;
}

function asDiagnosis(value: unknown): OperationDiagnosisV1 | null {
  const body = record(value);
  if (!body || !exactKeys(body, ['first_failure_stage', 'execution_outcome',
    'canonical_outcome', 'projection_outcome', 'recovery_requirement',
    'authoritative_evidence', 'attempts', 'reasons'])) return null;
  if (body.first_failure_stage !== null && typeof body.first_failure_stage !== 'string') return null;
  if (typeof body.execution_outcome !== 'string') return null;
  if (!CANONICAL.includes(String(body.canonical_outcome))) return null;
  if (typeof body.projection_outcome !== 'string') return null;
  if (!RECOVERY.includes(String(body.recovery_requirement))) return null;
  if (!Array.isArray(body.authoritative_evidence)
    || !body.authoritative_evidence.every((item) => typeof item === 'string')) return null;
  if (!Array.isArray(body.attempts)) return null;
  const attempts: OperationAttemptV1[] = [];
  for (const item of body.attempts) {
    const attempt = asAttempt(item);
    if (!attempt) return null;
    attempts.push(attempt);
  }
  if (!Array.isArray(body.reasons) || !body.reasons.every((item) => typeof item === 'string')) return null;
  return { ...(body as unknown as OperationDiagnosisV1), attempts };
}

const TIMELINE_STATES = ['passed', 'failed', 'skipped', 'missing'];

function asTimelineRow(value: unknown): OperationTimelineRowV1 | null {
  const row = record(value);
  if (!row || !exactKeys(row, ['stage', 'state', 'detail'])) return null;
  if (typeof row.stage !== 'string' || !TIMELINE_STATES.includes(String(row.state))) return null;
  if (row.detail !== null && typeof row.detail !== 'string') return null;
  return row as unknown as OperationTimelineRowV1;
}

function asFacts(value: unknown): OperationFactsV1 | null {
  const facts = record(value);
  if (!facts || !exactKeys(facts, ['transaction_id', 'receipt_path',
    'snapshot_before', 'snapshot_after'])) return null;
  for (const key of ['transaction_id', 'receipt_path', 'snapshot_before', 'snapshot_after'] as const) {
    if (facts[key] !== null && typeof facts[key] !== 'string') return null;
  }
  return facts as unknown as OperationFactsV1;
}

export function asOperationDetail(value: unknown): OperationDetailV1 | null {
  const body = record(value);
  if (!body || !exactKeys(body, ['request_id', 'capability', 'diagnosis',
    'timeline', 'observed_snapshot', 'ui_outcome', 'facts'])) return null;
  if (typeof body.request_id !== 'string' || typeof body.capability !== 'string') return null;
  const diagnosis = asDiagnosis(body.diagnosis);
  if (!diagnosis) return null;
  if (!Array.isArray(body.timeline)) return null;
  const timeline: OperationTimelineRowV1[] = [];
  for (const item of body.timeline) {
    const row = asTimelineRow(item);
    if (!row) return null;
    timeline.push(row);
  }
  if (body.observed_snapshot !== null && typeof body.observed_snapshot !== 'string') return null;
  if (!['SETTLED', 'REFUSED', 'BLOCKED'].includes(String(body.ui_outcome))) return null;
  const facts = asFacts(body.facts);
  if (!facts) return null;
  return {
    request_id: body.request_id,
    capability: body.capability,
    diagnosis,
    timeline,
    observed_snapshot: body.observed_snapshot,
    ui_outcome: body.ui_outcome as OperationDetailV1['ui_outcome'],
    facts,
  };
}
