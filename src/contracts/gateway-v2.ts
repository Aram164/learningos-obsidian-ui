import { GatewayError } from './gateway-v1';

export const GATEWAY_SCHEMA_VERSION = 2 as const;

export type GatewayChannelV2 = 'ui' | 'codex' | 'operator' | 'system-task';
export type GatewayApprovalKindV2 =
  | 'direct-user-gesture'
  | 'approved-delivery'
  | 'operator-approval';

export interface GatewayApprovalV2 {
  kind: GatewayApprovalKindV2;
  subject_sha256: string;
}

export interface GatewayRequestV2 {
  schema_version: typeof GATEWAY_SCHEMA_VERSION;
  request_id: string;
  idempotency_key: string;
  capability: string;
  channel: GatewayChannelV2;
  expected_snapshot: string;
  expected_revisions: Readonly<Record<string, number>>;
  approval: GatewayApprovalV2;
  payload: Record<string, unknown>;
}

export interface GatewayErrorBodyV2 {
  code: string;
  message: string;
  retryable: boolean;
  details: Record<string, unknown>;
}

/**
 * A capability response is not a confirmation until every identity echo,
 * receipt field and resulting snapshot has been checked. Nullable producer
 * fields belong only to refused responses; this narrowed success type makes it
 * impossible for a caller to treat one of those as a completed write.
 */
export interface GatewaySuccessV2 {
  schema_version: typeof GATEWAY_SCHEMA_VERSION;
  request_id: string;
  idempotency_key: string;
  capability: string;
  ok: true;
  replayed: boolean;
  transaction_id: string;
  receipt_path: string;
  snapshot_after: string;
  result: Record<string, unknown>;
  error: null;
}

export interface GatewayResponseIdentityV2 {
  requestId: string;
  idempotencyKey: string;
  capability: string;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length
    && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

export function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^sha256:[0-9a-f]{64}$/.test(value);
}

/**
 * Capabilities whose write target is named by Core, not by the caller.
 *
 * A capture cannot be guarded as `capture:work/inbox/<name>.md`, because the
 * filename does not exist until Core picks it. Both of these guard the
 * *request* instead, and Core requires the envelope's `expected_revisions` to
 * cover exactly the artifacts the transaction touches — so an empty map is a
 * refusal, not a permissive default. This mirrors
 * `REQUEST_SCOPED_ARTIFACT_PREFIXES` in Core's `contracts/gateway.py`; the two
 * must derive the identical string.
 */
export const REQUEST_SCOPED_ARTIFACT_PREFIXES: Readonly<Record<string, string>> = {
  'capture.create': 'capture-request',
  'garden.seed.create': 'garden-request',
};

export function isRequestScopedCapability(capability: string): boolean {
  return Object.prototype.hasOwnProperty.call(
    REQUEST_SCOPED_ARTIFACT_PREFIXES, capability,
  );
}

/** The one request-scoped artifact id, derived from this request's own key. */
export function requestArtifactId(
  capability: string,
  idempotencyKey: string,
): string {
  const prefix = REQUEST_SCOPED_ARTIFACT_PREFIXES[capability];
  if (!prefix) {
    throw new GatewayError(
      `${capability} does not use request-scoped artifacts; nothing was written.`,
      null,
      { code: 'INVALID_REQUEST', retryable: false },
    );
  }
  if (!nonEmpty(idempotencyKey)) {
    throw new GatewayError(
      `${capability} needs an idempotency key to guard its request; nothing was written.`,
      null,
      { code: 'INVALID_REQUEST', retryable: false },
    );
  }
  return `${prefix}:${idempotencyKey}`;
}

/**
 * Core signs this exact object using sorted, compact JSON and UTF-8. Request
 * identifiers and approval are deliberately excluded so replay identity can
 * change without changing what the learner approved.
 */
export function gatewayApprovalSubject(
  capability: string,
  expectedSnapshot: string,
  expectedRevisions: Readonly<Record<string, number>>,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return {
    schema_version: GATEWAY_SCHEMA_VERSION,
    capability,
    channel: 'ui',
    expected_snapshot: expectedSnapshot,
    expected_revisions: expectedRevisions,
    payload,
  };
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  const object = record(value);
  if (!object) return value;
  return Object.fromEntries(
    Object.keys(object).sort(unicodeCodePointCompare)
      .map((key) => [key, canonical(object[key])]),
  );
}

/** Python's sort_keys compares Unicode code points, not UTF-16 code units. */
function unicodeCodePointCompare(left: string, right: string): number {
  const leftPoints = [...left].map((value) => value.codePointAt(0) ?? 0);
  const rightPoints = [...right].map((value) => value.codePointAt(0) ?? 0);
  const shared = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < shared; index += 1) {
    const leftPoint = leftPoints[index] ?? 0;
    const rightPoint = rightPoints[index] ?? 0;
    if (leftPoint !== rightPoint) {
      return leftPoint - rightPoint;
    }
  }
  return leftPoints.length - rightPoints.length;
}

/** Match Core's ensure_ascii=False UTF-8 serialization byte-for-byte. */
export async function gatewaySubjectSha256(
  subject: Record<string, unknown>,
): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(subject)));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

/** Turn an untrusted process response into the only success shape the UI uses. */
export function asGatewaySuccessV2(
  value: unknown,
  expected: GatewayResponseIdentityV2,
): GatewaySuccessV2 {
  const response = record(value);
  const result = record(response?.result);
  const responseKeys = [
    'schema_version', 'request_id', 'idempotency_key', 'capability', 'ok',
    'replayed', 'transaction_id', 'receipt_path', 'snapshot_after', 'result',
    'error',
  ] as const;
  const identityMatches = response?.request_id === expected.requestId
    && response?.idempotency_key === expected.idempotencyKey
    && response?.capability === expected.capability;
  const confirmed = response !== null
    && exactKeys(response, responseKeys)
    && response.schema_version === GATEWAY_SCHEMA_VERSION
    && identityMatches
    && response.ok === true
    && typeof response.replayed === 'boolean'
    && nonEmpty(response.transaction_id)
    && nonEmpty(response.receipt_path)
    && isSha256(response.snapshot_after)
    && result !== null
    && response.error === null;

  if (!confirmed) {
    throw new GatewayError(
      'LearningOS did not return a complete Gateway V2 receipt, so the change is unconfirmed. Your draft was kept.',
      null,
      { code: 'UNCONFIRMED', retryable: false },
    );
  }
  return response as unknown as GatewaySuccessV2;
}

/** A cheap marker used only after `asGatewaySuccessV2` has narrowed the value. */
export function isGatewaySuccessV2(value: unknown): value is GatewaySuccessV2 {
  const response = record(value);
  return response?.schema_version === GATEWAY_SCHEMA_VERSION
    && response?.ok === true
    && nonEmpty(response?.receipt_path)
    && isSha256(response?.snapshot_after);
}

/**
 * Receipt is necessary, not sufficient: the newly loaded projection must be
 * the state the receipt says the transaction published.
 */
export function assertGatewaySnapshotObserved(
  confirmation: GatewaySuccessV2,
  observedSnapshot: string | null,
): void {
  if (observedSnapshot !== confirmation.snapshot_after) {
    throw new GatewayError(
      'LearningOS wrote a receipt, but the reloaded manifest does not show its resulting snapshot. The change is unconfirmed in this view; your draft was kept.',
      null,
      { code: 'UNCONFIRMED', retryable: true },
    );
  }
}
