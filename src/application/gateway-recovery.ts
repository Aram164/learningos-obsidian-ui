/**
 * One unresolved Gateway V2 write, remembered across a crash.
 *
 * The defect this exists for: the UI sent a capability envelope, the response
 * was interrupted — Obsidian quit, the child process died, the pipe closed
 * mid-JSON — and the learner pressed the button again. The second press built a
 * *new* request with a new idempotency key, so Core's replay protection could
 * not recognise it, and one gesture became two canonical writes. Nothing on
 * disk recorded that a write had been in flight, so a restart could not tell
 * either.
 *
 * The fix is not a retry counter. It is that the exact bytes sent are persisted
 * *before* the process is spawned, and every subsequent attempt resends that
 * same string. An interrupted response then becomes a question Core can answer
 * (`replayed: true`) instead of a guess the interface has to make.
 *
 * Three rules give the record its value, and all three are non-obvious:
 *
 *  - A malformed record never normalises to "nothing". A record that cannot be
 *    validated is evidence that *something* happened; converting it to null
 *    would erase the only trace of a possibly-committed write. It blocks.
 *  - A confirmed record is not cleared on the receipt. The receipt says Core
 *    committed; it does not say this vault can see it. The record survives
 *    until the projection has been reconciled.
 *  - Ambiguity is never cleared automatically. There is no discard action here
 *    on purpose: the only exits are a strict confirmation or a strict refusal.
 */
import {
  asGatewayRequestV2,
  asGatewaySuccessV2,
  gatewayApprovalSubject,
  gatewaySubjectSha256,
  type GatewayRequestV2,
  type GatewaySuccessV2,
} from '../contracts/gateway-v2';
import { sameComposerDraft, type LearningOSUiDrafts } from './draft-store';

export type GatewayRecoveryPhase =
  | 'prepared'
  | 'recovering'
  | 'confirmed'
  | 'blocked';

export interface GatewayRecoveryErrorV1 {
  code: string;
  message: string;
}

export interface GatewayRecoveryRecordV1 {
  schema_version: 1;
  phase: GatewayRecoveryPhase;
  created_at: string;
  /** The exact serialized string handed to Core. Retries resend it verbatim. */
  envelope_json: string;
  confirmation: GatewaySuccessV2 | null;
  last_error: GatewayRecoveryErrorV1 | null;
}

/** A validated record, paired with the envelope parsed out of it. */
export interface GatewayRecoveryEntry {
  readonly record: GatewayRecoveryRecordV1;
  readonly envelope: GatewayRequestV2;
}

export type GatewayRecoveryState =
  | { readonly kind: 'clear' }
  | { readonly kind: 'record'; readonly entry: GatewayRecoveryEntry }
  | { readonly kind: 'malformed'; readonly error: string };

export type GatewayRecoveryValidation =
  | { readonly ok: true; readonly entry: GatewayRecoveryEntry }
  | { readonly ok: false; readonly error: string };

const PHASES: readonly GatewayRecoveryPhase[] = [
  'prepared', 'recovering', 'confirmed', 'blocked',
];

const RECORD_KEYS = [
  'schema_version', 'phase', 'created_at', 'envelope_json', 'confirmation',
  'last_error',
] as const;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length
    && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Strict, closed validation of one persisted recovery record.
 *
 * Asynchronous because the approval hash is recomputed here. That check is the
 * one that matters most: it proves the persisted envelope still describes the
 * gesture the learner approved. A record that fails it is never repaired or
 * re-signed — resending a re-signed envelope would be the interface approving
 * a write on the learner's behalf.
 */
export async function validateGatewayRecoveryRecord(
  value: unknown,
): Promise<GatewayRecoveryValidation> {
  const refuse = (error: string): GatewayRecoveryValidation => ({ ok: false, error });
  const candidate = record(value);
  if (!candidate) return refuse('the recovery record is not an object');
  if (!exactKeys(candidate, RECORD_KEYS)) {
    return refuse(`the recovery record must carry exactly ${RECORD_KEYS.join(', ')}`);
  }
  if (candidate.schema_version !== 1) {
    return refuse(`unsupported recovery schema_version ${JSON.stringify(candidate.schema_version)}`);
  }
  if (!PHASES.includes(candidate.phase as GatewayRecoveryPhase)) {
    return refuse(`unknown recovery phase ${JSON.stringify(candidate.phase)}`);
  }
  const phase = candidate.phase as GatewayRecoveryPhase;
  if (!nonEmpty(candidate.created_at) || !Number.isFinite(Date.parse(candidate.created_at))) {
    return refuse('the recovery record has no readable creation timestamp');
  }
  if (typeof candidate.envelope_json !== 'string' || !candidate.envelope_json) {
    return refuse('the recovery record carries no persisted envelope');
  }
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(candidate.envelope_json);
  } catch (_) {
    return refuse('the persisted envelope is not readable JSON');
  }
  const envelope = asGatewayRequestV2(parsed);
  if (!envelope) return refuse('the persisted envelope is not a complete Gateway V2 request');
  const recomputed = await gatewaySubjectSha256(gatewayApprovalSubject(
    envelope.capability,
    envelope.expected_snapshot,
    envelope.expected_revisions,
    envelope.payload,
  ));
  if (recomputed !== envelope.approval.subject_sha256) {
    return refuse('the persisted envelope no longer matches the approval it carries');
  }
  let confirmation: GatewaySuccessV2 | null = null;
  if (candidate.confirmation !== null) {
    try {
      confirmation = asGatewaySuccessV2(candidate.confirmation, {
        requestId: envelope.request_id,
        idempotencyKey: envelope.idempotency_key,
        capability: envelope.capability,
      });
    } catch (_) {
      return refuse('the recorded confirmation is not a complete receipt for this request');
    }
  }
  if (phase === 'confirmed' && confirmation === null) {
    return refuse('a confirmed recovery record must carry its receipt');
  }
  if ((phase === 'prepared' || phase === 'recovering') && confirmation !== null) {
    return refuse(`a ${phase} recovery record cannot already carry a receipt`);
  }
  let lastError: GatewayRecoveryErrorV1 | null = null;
  if (candidate.last_error !== null) {
    const failure = record(candidate.last_error);
    if (!failure
      || !exactKeys(failure, ['code', 'message'])
      || !nonEmpty(failure.code)
      || typeof failure.message !== 'string') {
      return refuse('the recorded error is not a {code, message} pair');
    }
    lastError = { code: failure.code, message: failure.message };
  }
  return {
    ok: true,
    entry: {
      record: {
        schema_version: 1,
        phase,
        created_at: candidate.created_at,
        envelope_json: candidate.envelope_json,
        confirmation,
        last_error: lastError,
      },
      envelope,
    },
  };
}

/** What the Gateway client needs from whatever remembers the write. */
export interface GatewayRecoveryPort {
  /** True while any record — valid or malformed — remains unresolved. */
  readonly unresolved: boolean;
  readonly state: GatewayRecoveryState;
  begin(record: GatewayRecoveryRecordV1): Promise<void>;
  /** The stored entry, or null when there is nothing replayable. */
  replayable(): GatewayRecoveryEntry | null;
  markRecovering(error: GatewayRecoveryErrorV1 | null): Promise<void>;
  markConfirmed(confirmation: GatewaySuccessV2): Promise<void>;
  markBlocked(error: GatewayRecoveryErrorV1): Promise<void>;
  /** Only for a strict, definitive no-commit refusal. Drafts are untouched. */
  discardRefused(): Promise<void>;
}

/** The default port: real phases, no persistence, and no fresh-write gate. */
export class MemoryGatewayRecoveryStore implements GatewayRecoveryPort {
  protected current: GatewayRecoveryEntry | null = null;
  private readonly gate: boolean;

  constructor(gate = false) {
    this.gate = gate;
  }

  get unresolved(): boolean {
    return this.gate && this.current !== null;
  }

  get state(): GatewayRecoveryState {
    return this.current ? { kind: 'record', entry: this.current } : { kind: 'clear' };
  }

  replayable(): GatewayRecoveryEntry | null {
    return this.current;
  }

  protected async write(entry: GatewayRecoveryEntry | null): Promise<void> {
    this.current = entry;
  }

  private required(): GatewayRecoveryEntry {
    if (!this.current) throw new Error('There is no prepared Gateway request to advance.');
    return this.current;
  }

  async begin(next: GatewayRecoveryRecordV1): Promise<void> {
    const validated = await validateGatewayRecoveryRecord(next);
    if (!validated.ok) throw new Error(`Refusing to persist an invalid recovery record: ${validated.error}`);
    await this.write(validated.entry);
  }

  async markRecovering(error: GatewayRecoveryErrorV1 | null): Promise<void> {
    const { record: stored, envelope } = this.required();
    await this.write({
      record: { ...stored, phase: 'recovering', last_error: error },
      envelope,
    });
  }

  async markConfirmed(confirmation: GatewaySuccessV2): Promise<void> {
    const { record: stored, envelope } = this.required();
    await this.write({
      record: { ...stored, phase: 'confirmed', confirmation, last_error: null },
      envelope,
    });
  }

  async markBlocked(error: GatewayRecoveryErrorV1): Promise<void> {
    const { record: stored, envelope } = this.required();
    await this.write({
      record: { ...stored, phase: 'blocked', last_error: error },
      envelope,
    });
  }

  async discardRefused(): Promise<void> {
    await this.write(null);
  }
}

/** The settings host: exactly the one plugin-private slot this store owns. */
export interface GatewayRecoverySettingsHost {
  /** Deliberately `unknown`: a malformed value must survive unrewritten. */
  gatewayRecovery: unknown;
  uiDrafts: LearningOSUiDrafts;
}

/**
 * The production port. Every transition persists before it is believed, and
 * `begin` is awaited before Core is spawned — the ordering the whole design
 * rests on.
 */
export class SettingsGatewayRecoveryStore extends MemoryGatewayRecoveryStore {
  private status: GatewayRecoveryState = { kind: 'clear' };

  constructor(
    private readonly settings: GatewayRecoverySettingsHost,
    private readonly persist: () => Promise<void>,
  ) {
    super(true);
  }

  get unresolved(): boolean {
    return this.status.kind !== 'clear';
  }

  get state(): GatewayRecoveryState {
    return this.status;
  }

  replayable(): GatewayRecoveryEntry | null {
    return this.status.kind === 'record' ? this.status.entry : null;
  }

  /**
   * Read the persisted slot once at startup.
   *
   * An absent setting normalises to clear — existing installations predate the
   * field and have nothing in flight. A *present but malformed* one does not:
   * the raw value stays exactly as written and the store goes blocked, so the
   * evidence survives for Diagnostics and no write process is launched.
   */
  async load(): Promise<GatewayRecoveryState> {
    const raw = this.settings.gatewayRecovery;
    if (raw === null || raw === undefined) {
      this.status = { kind: 'clear' };
      return this.status;
    }
    const validated = await validateGatewayRecoveryRecord(raw);
    this.current = validated.ok ? validated.entry : null;
    this.status = validated.ok
      ? { kind: 'record', entry: validated.entry }
      : { kind: 'malformed', error: validated.error };
    return this.status;
  }

  /**
   * Every transition is failure-atomic: memory only keeps a change that the
   * disk actually accepted.
   *
   * The defect this guards against: memory used to be mutated before the save
   * was awaited, so a rejected `data.json` write left the record cleared in
   * memory while disk still held a `prepared` one. The fresh-write gate then
   * reported nothing unresolved and allowed the next write, and the next
   * startup replayed the stale envelope — a gesture already treated as
   * refused could turn into an unexpected canonical write. Snapshotting and
   * restoring on rejection keeps `unresolved` true and new writes blocked.
   */
  protected async write(entry: GatewayRecoveryEntry | null): Promise<void> {
    if (this.status.kind === 'malformed') {
      throw new Error('A malformed Gateway recovery record is unresolved; nothing was written.');
    }
    const previousSlot = this.settings.gatewayRecovery;
    const previousCurrent = this.current;
    const previousStatus = this.status;
    this.settings.gatewayRecovery = entry ? entry.record : null;
    this.current = entry;
    this.status = entry ? { kind: 'record', entry } : { kind: 'clear' };
    try {
      await this.persist();
    } catch (error: unknown) {
      this.settings.gatewayRecovery = previousSlot;
      this.current = previousCurrent;
      this.status = previousStatus;
      throw error;
    }
  }

  /**
   * The only path that clears a confirmed write, and it clears the matching
   * draft in the same in-memory update before a single awaited save.
   *
   * Two saves would leave a window in which a crash had erased the recovery
   * evidence but not the draft that belongs to it — the learner would be
   * offered their text back for a write that already landed. For the same
   * reason a rejected save must restore *both* halves: the confirmed record
   * and every draft this settlement cleared, so the learner's text is not
   * silently destroyed by a settlement that never reached disk.
   */
  async settleConfirmed(): Promise<void> {
    const entry = this.replayable();
    if (!entry) return;
    const previousSlot = this.settings.gatewayRecovery;
    const previousCurrent = this.current;
    const previousStatus = this.status;
    const previousDrafts = structuredClone(this.settings.uiDrafts);
    clearDraftsOwnedBy(this.settings.uiDrafts, entry.envelope);
    this.settings.gatewayRecovery = null;
    this.current = null;
    this.status = { kind: 'clear' };
    try {
      await this.persist();
    } catch (error: unknown) {
      this.settings.gatewayRecovery = previousSlot;
      this.current = previousCurrent;
      this.status = previousStatus;
      // Restored field by field, not by reassigning `uiDrafts`: the draft
      // store reads through the same settings object, and swapping the
      // reference would strand any holder of the old one.
      Object.assign(this.settings.uiDrafts, previousDrafts);
      throw error;
    }
  }
}

/**
 * Clear only the draft this envelope actually carried.
 *
 * Clearing by capability alone destroys work: a learner who kept typing while
 * the write was in flight would lose the newer text to a success notice about
 * the older one. Every branch compares the draft against the exact payload
 * that travelled, and leaves anything else alone. All of it is idempotent,
 * because live views repeat their own cleanup after `mutate` resolves.
 */
export function clearDraftsOwnedBy(
  drafts: LearningOSUiDrafts,
  envelope: GatewayRequestV2,
): void {
  const payload = envelope.payload;
  const text = typeof payload.text === 'string' ? payload.text : null;
  const title = typeof payload.title === 'string' ? payload.title : '';

  if (envelope.capability === 'capture.create') {
    // A file capture has no persisted picker state to clear.
    if (text === null) return;
    if (sameComposerDraft(drafts.inbox, { title, text })) {
      drafts.inbox = { title: '', text: '' };
    }
    return;
  }

  if (envelope.capability === 'garden.seed.create') {
    if (text === null) return;
    if (sameComposerDraft(drafts.garden, { title, text })) {
      drafts.garden = { title: '', text: '' };
    }
    return;
  }

  if (envelope.capability === 'unit.note.append') {
    const unitId = typeof payload.unit_id === 'string' ? payload.unit_id : '';
    if (!unitId) return;
    const draft = drafts.unitNotes[unitId];
    if (draft && draft.text === text && String(draft.title || '').trim() === title) {
      delete drafts.unitNotes[unitId];
    }
    // The stage scratch drafts folded into this note are named by the
    // envelope, so they are cleared by identity rather than by guesswork.
    const stageIds = Array.isArray(payload.stage_id) ? payload.stage_id : [];
    for (const stageId of stageIds) {
      if (typeof stageId === 'string') delete drafts.stages[`${unitId}::${stageId}`];
    }
    return;
  }

  if (envelope.capability === 'stage.progress.update'
    && payload.status === 'complete') {
    const unitId = typeof payload.unit_id === 'string' ? payload.unit_id : '';
    const stageId = typeof payload.stage_id === 'string' ? payload.stage_id : '';
    if (unitId && stageId) delete drafts.doneWhen[`${unitId}::${stageId}`];
  }
}

/** The metadata Diagnostics may show. Payload text and paths stay out of it. */
export function gatewayRecoverySummary(
  state: GatewayRecoveryState,
): ReadonlyArray<readonly [string, string]> | null {
  if (state.kind === 'clear') return null;
  if (state.kind === 'malformed') {
    return [
      ['Capability', 'unreadable'],
      ['Phase', 'blocked'],
      ['Validation error', state.error],
    ];
  }
  const { record: stored, envelope } = state.entry;
  return [
    ['Capability', envelope.capability],
    ['Phase', stored.phase],
    ['Created', stored.created_at],
    ['Request ID', envelope.request_id],
    ['Idempotency key', envelope.idempotency_key],
    ['Last error', stored.last_error
      ? `${stored.last_error.code}: ${stored.last_error.message}`
      : 'none'],
  ];
}
