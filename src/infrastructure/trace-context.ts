/**
 * W3C-shaped trace context for the UI -> Core child-process hop.
 *
 * Research track #2, Phase 1. No OpenTelemetry SDK: the UI mints one
 * `traceparent` per gateway dispatch and Core reads it from the child
 * environment. Context carries correlation IDs only — never payload text,
 * learner prose, or file bytes (see `TRACEPARENT` handling in Core's
 * `learning_os/diagnostics/conventions.py`, vocabulary v1).
 *
 * Identity rules (mirroring Core):
 * - `traceId` (32 hex) is the operation: stable across every attempt of one
 *   user-approved send while this process lives, including the in-session
 *   replay. A replay after restart mints a fresh operation; linking the two
 *   is Phase 2 trace-link work, not guessing here.
 * - `spanId` (16 hex) is one physical dispatch: fresh per attempt so a
 *   replay is distinguishable from its original.
 */

import { randomBytes } from 'node:crypto';

export interface TraceContext {
  readonly traceId: string;
  readonly spanId: string;
  readonly sampled: boolean;
}

const TRACE_ID_BYTES = 16;
const SPAN_ID_BYTES = 8;

function hex(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}

/** One user-approved operation: fresh operation id, first attempt span. */
export function newOperationContext(sampled = true): TraceContext {
  return { traceId: hex(TRACE_ID_BYTES), spanId: hex(SPAN_ID_BYTES), sampled };
}

/**
 * The next physical attempt of an operation: same operation, fresh span.
 * The input context is never mutated, so concurrent dispatches cannot share
 * or clobber an identity.
 */
export function childAttemptContext(operation: TraceContext): TraceContext {
  return { traceId: operation.traceId, spanId: hex(SPAN_ID_BYTES), sampled: operation.sampled };
}

/** Strict `00-<trace-id>-<span-id>-<flags>` rendering. */
export function formatTraceparent(context: TraceContext): string {
  return `00-${context.traceId}-${context.spanId}-${context.sampled ? '01' : '00'}`;
}

const TRACEPARENT_RE = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;
const ZERO_TRACE = '0'.repeat(32);
const ZERO_SPAN = '0'.repeat(16);

/**
 * One UI-side diagnostic event, shaped like Core's JSONL records so one
 * resolver reads both planes. Emitted only to the injected `diagnostics`
 * sink (default: nowhere) — never to the envelope, the console, or disk.
 */
export interface DiagnosticEvent {
  readonly v: 2;
  readonly kind: 'event';
  readonly name: string;
  readonly op: string;
  readonly span: string;
  readonly ts: number;
  readonly attrs: Record<string, string | number | boolean | null>;
}

export function diagnosticEvent(
  context: TraceContext,
  name: string,
  attrs: Record<string, string | number | boolean | null> = {},
  spanId?: string,
): DiagnosticEvent {
  return {
    v: 2,
    kind: 'event',
    name,
    op: context.traceId,
    span: spanId ?? context.spanId,
    ts: Date.now() / 1000,
    attrs,
  };
}

/**
 * The persistent store envelope (track #2, Phase 3A): the UI appends the
 * identical record shape Core persists, so one reader and one retention
 * pass cover both planes. Pinned to store schema 1 / conventions 2 — a
 * version bump is a coordinated Core+UI change, never a silent drift.
 */
export function storeEnvelope(event: DiagnosticEvent): Record<string, unknown> {
  return {
    schema_version: 1,
    conventions_version: 2,
    timestamp: event.ts,
    trace_id: event.op,
    operation_id: event.op,
    attempt_id: event.span,
    span_id: event.span,
    parent_span_id: null,
    kind: event.kind,
    name: event.name,
    stage: null,
    status: null,
    attributes: event.attrs,
  };
}

/**
 * Parse a traceparent value; `null` for anything not strictly shaped.
 * All-zero ids and non-`00` versions are rejected per the W3C spec.
 */
export function parseTraceparent(value: string | null | undefined): TraceContext | null {
  if (typeof value !== 'string') return null;
  const match = TRACEPARENT_RE.exec(value.trim());
  if (!match) return null;
  const traceId: string | undefined = match[1];
  const spanId: string | undefined = match[2];
  const flags: string | undefined = match[3];
  if (traceId === undefined || spanId === undefined || flags === undefined) return null;
  if (traceId === ZERO_TRACE || spanId === ZERO_SPAN) return null;
  return { traceId, spanId, sampled: (parseInt(flags, 16) & 1) === 1 };
}
