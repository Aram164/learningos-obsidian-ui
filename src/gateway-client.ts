import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, sep } from 'node:path';
import type { PlanProfile } from './contracts/plan-template';
import type { JsonRecord, ProjectionRecord } from './contracts/manifest';
import {
  GatewayError, exitCodeOf, structuredError,
  type GatewayResultV1,
} from './contracts/gateway-v1';
import {
  GATEWAY_SCHEMA_VERSION,
  asGatewaySuccessV2,
  gatewayApprovalSubject,
  gatewaySubjectSha256,
  isRequestScopedCapability,
  isSha256,
  requestArtifactId,
  type GatewaySuccessV2,
} from './contracts/gateway-v2';

type LosCallback = (
  error: Error | null,
  stdout: string,
  stderr: string,
) => void;

/** Everything the gateway needs from its host: one process runner, one snapshot id. */
interface GatewayHost {
  runLos(args: string[], callback: LosCallback, stdin?: string): void;
  store: {
    snapshotId: string | null;
  };
}

let requestCounter = 0;

/** A per-write id, so a response can be matched to the request that caused it. */
function nextRequestId(capability: string): string {
  requestCounter += 1;
  return `req-${capability.replace(/\./g, '-')}-${Date.now()}-${requestCounter}`;
}

function nextIdempotencyKey(requestId: string): string {
  return `idem-${requestId}`;
}

function expandedLocalPath(filePath: string): string {
  if (filePath === '~') return homedir();
  if (filePath.startsWith(`~${sep}`)) return join(homedir(), filePath.slice(2));
  return filePath;
}

/** Bind a user-selected path to the exact bytes Core is approved to consume. */
async function fileSha256(filePath: string): Promise<string> {
  const bytes = await readFile(expandedLocalPath(filePath));
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function gatewayErrorDetails(value: unknown): {
  message: string;
  code?: string;
  retryable?: boolean;
} {
  const response = typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : {};
  const error = typeof response.error === 'object' && response.error !== null
    ? response.error as Record<string, unknown>
    : null;
  if (error) {
    return {
      message: typeof error.message === 'string' && error.message.trim()
        ? error.message.trim()
        : 'LearningOS refused the change; your draft was kept.',
      ...(typeof error.code === 'string' ? { code: error.code } : {}),
      ...(typeof error.retryable === 'boolean' ? { retryable: error.retryable } : {}),
    };
  }
  return {
    message: typeof response.error === 'string' && response.error.trim()
      ? response.error.trim()
      : 'LearningOS refused the change; your draft was kept.',
  };
}

export class GatewayClient {
  private readonly plugin: GatewayHost;
  private chain: Promise<void>;
  pending: number;
  constructor(plugin: GatewayHost) {
    this.plugin = plugin;
    // The write lock lives here, not in a view, because the thing being
    // protected is the single CLI process and the snapshot it was handed.
    this.chain = Promise.resolve();
    this.pending = 0;
  }

  /**
   * Serialize every mutation, wherever it was clicked. Failures do not poison
   * the chain: the next task runs regardless of how the previous one settled,
   * but never alongside it.
   */
  enqueue<T>(task: () => T | PromiseLike<T>): Promise<T> {
    this.pending += 1;
    const run = this.chain.then(task, task);
    this.chain = run.then(() => undefined, () => undefined)
      .then(() => { this.pending -= 1; });
    return run;
  }

  get isBusy() { return this.pending > 0; }

  /**
   * Every mutating command answers in JSON. Unreadable or empty output means
   * the write was NOT confirmed, so this must reject: call sites clear
   * UI-owned drafts on resolve, and resolving on garbage would destroy the
   * learner's text behind a success notice. `expectJson: false` is only for
   * the text-reporting commands (`validate`, `generate`).
   */
  call(
    args: string[],
    { expectJson = true, stdin }: { expectJson?: boolean; stdin?: string } = {},
  ): Promise<GatewayResultV1> {
    return new Promise((resolve, reject) => {
      this.plugin.runLos(
        args,
        (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          // A refusal puts its reason on stdout and leaves stderr empty, so
          // reading stderr first threw the sentence away and reported Node's
          // "Command failed: python …" instead. The exit code travels with it
          // because code 3 (projection conflict) is recoverable and the
          // caller has to be able to tell.
          let refusal: ReturnType<typeof gatewayErrorDetails> | null = null;
          try { refusal = gatewayErrorDetails(JSON.parse(String(stdout || ''))); }
          catch (_) { /* A non-JSON process failure is reported from stderr below. */ }
          const reason = structuredError(stdout) || stderr.trim()
            || error.message || String(error);
          reject(new GatewayError(reason, exitCodeOf(error), refusal || {}));
          return;
        }
        const raw = String(stdout ?? '').trim();
        if (!expectJson) { resolve({ ok: true, stdout: raw }); return; }
        if (!raw) {
          reject(new Error('LearningOS wrote nothing back, so the change is unconfirmed. Your draft was kept.'));
          return;
        }
        let parsed = null;
        try { parsed = JSON.parse(raw); }
        catch (_) {
          reject(new Error(`LearningOS answered with unreadable output, so the change is unconfirmed and your draft was kept: ${raw.slice(0, 160)}`));
          return;
        }
        if (!parsed || typeof parsed !== 'object' || parsed.ok === false) {
          const refusal = gatewayErrorDetails(parsed);
          reject(new GatewayError(
            refusal.message,
            exitCodeOf(error),
            refusal,
          ));
          return;
        }
        resolve(parsed);
        },
        stdin,
      );
    });
  }

  /**
   * The one write shape.
   *
   * Every canonical mutation is a declared capability sent as an envelope, so
   * there is a single call shape, a single response shape and a single error
   * path — instead of one positional signature per command, each with its own
   * flag order to get wrong. The named methods below are porcelain over this.
   */
  capability(
    name: string,
    payload: Record<string, unknown>,
    options: {
      expectedSnapshot?: string;
      expectedRevisions?: Readonly<Record<string, number>>;
    } = {},
  ): Promise<GatewaySuccessV2> {
    const expectedSnapshot = options.expectedSnapshot || this.snapshotId();
    if (!isSha256(expectedSnapshot)) {
      throw new GatewayError(
        'LearningOS has no valid sha256 snapshot to guard this change against; nothing was written.',
        null,
        { code: 'INVALID_REQUEST', retryable: false },
      );
    }
    const expectedRevisions = options.expectedRevisions || {};
    if (Object.entries(expectedRevisions).some(
      ([id, revision]) => !id || !Number.isInteger(revision) || revision < 0,
    )) {
      throw new GatewayError(
        'LearningOS has invalid artifact revision guards; nothing was written.',
        null,
        { code: 'INVALID_REQUEST', retryable: false },
      );
    }
    // The guard for these two is derived below from an idempotency key that
    // does not exist yet, so a caller-supplied map cannot be honoured and must
    // not be silently replaced or merged either: quietly discarding a guard the
    // caller asked for is how a stale-revision refusal turns into an
    // unguarded write. Refuse here, before anything is sent.
    if (isRequestScopedCapability(name)
        && Object.keys(expectedRevisions).length > 0) {
      throw new GatewayError(
        `LearningOS guards ${name} against its own request, so it cannot also be guarded against caller-supplied artifact revisions; nothing was written.`,
        null,
        { code: 'INVALID_REQUEST', retryable: false },
      );
    }
    return this.sendCapability(
      name,
      payload,
      expectedSnapshot,
      expectedRevisions,
    );
  }

  private async sendCapability(
    name: string,
    payload: Record<string, unknown>,
    expectedSnapshot: string,
    expectedRevisions: Readonly<Record<string, number>>,
  ): Promise<GatewaySuccessV2> {
    const requestId = nextRequestId(name);
    const idempotencyKey = nextIdempotencyKey(requestId);
    // Order matters, and it is the whole defect this method once had. A
    // request-scoped guard can only be built once the idempotency key exists,
    // and Core hashes the approval subject over `expected_revisions` — so the
    // map has to be final *before* the subject is hashed, and the identical map
    // has to travel in the envelope. Deriving it afterwards produced a
    // correctly-signed approval for a guard Core never received, and every
    // capture and Garden seed was refused.
    const effectiveRevisions: Readonly<Record<string, number>> =
      isRequestScopedCapability(name)
        ? { [requestArtifactId(name, idempotencyKey)]: 0 }
        : expectedRevisions;
    const subject = gatewayApprovalSubject(
      name,
      expectedSnapshot,
      effectiveRevisions,
      payload,
    );
    const envelope = {
      schema_version: GATEWAY_SCHEMA_VERSION,
      request_id: requestId,
      idempotency_key: idempotencyKey,
      capability: name,
      channel: 'ui',
      expected_snapshot: expectedSnapshot,
      expected_revisions: effectiveRevisions,
      approval: {
        kind: 'direct-user-gesture',
        subject_sha256: await gatewaySubjectSha256(subject),
      },
      payload,
    };
    const response = await this.call(['capability', name, '--payload-file', '-'],
      { stdin: JSON.stringify(envelope) });
    return asGatewaySuccessV2(response, { requestId, idempotencyKey, capability: name });
  }

  /**
   * The snapshot guard is what makes a write refusable, so a missing snapshot
   * id must stop the write rather than travel to the CLI as the string
   * "null" — which would be compared against a real snapshot and refused with
   * a misleading message, or worse, matched by accident.
   */
  snapshotId(): string {
    const snapshotId = this.plugin.store.snapshotId;
    if (!snapshotId) {
      throw new Error('LearningOS has no loaded snapshot to guard this change against; nothing was written.');
    }
    return snapshotId;
  }

  /** Positional-flag form, kept for the commands that are not capabilities. */
  guard(): string[] {
    return ['--expected-snapshot', this.snapshotId()];
  }

  // ---- porcelain: each is one declared capability, nothing more ----------
  saveNote(unitId: string, stageId: string, text: string,
    expectedRevisions: Readonly<Record<string, number>> = {}) {
    return this.capability('stage.note.write',
      { unit_id: unitId, stage_id: stageId, text, replace: true },
      { expectedRevisions });
  }
  async saveUnitNote(
    unitId: string,
    {
      title = '',
      text,
      stageIds = [],
      filePaths = [],
    }: {
      title?: string;
      text: string;
      stageIds?: readonly string[];
      filePaths?: readonly string[];
    },
    expectedRevisions: Readonly<Record<string, number>> = {},
  ) {
    const payload: Record<string, unknown> = { unit_id: unitId, text };
    if (String(title).trim()) payload.title = String(title).trim();
    if (stageIds.length) payload.stage_id = [...stageIds];
    if (filePaths.length) {
      payload.attachment = [...filePaths];
      payload.attachment_sha256 = await Promise.all(filePaths.map(fileSha256));
    }
    return this.capability('unit.note.append', payload, { expectedRevisions });
  }
  progress(unitId: string, stageId: string, status: string,
    expectedRevisions: Readonly<Record<string, number>> = {}) {
    return this.capability('stage.progress.update',
      { unit_id: unitId, stage_id: stageId, status }, { expectedRevisions });
  }
  sourceSelection(
    unitId: string,
    routeId: string,
    sourceId: string,
    locator: string,
    purpose: string,
    selected: boolean,
    expectedRevisions: Readonly<Record<string, number>> = {},
  ) {
    return this.capability(
      'unit.source-selection.set',
      {
        unit_id: unitId,
        route_id: routeId,
        source_id: sourceId,
        locator,
        action: selected ? 'select' : 'remove',
        ...(selected ? { purpose } : {}),
      },
      { expectedRevisions },
    );
  }
  feedback(
    unitId: string,
    stageId: string,
    sourceId: string,
    feedback: string,
    // ADR-009: when the rated resource has its own identity, narrow the
    // judgment to it. source_id stays required so provenance survives —
    // course → paper → verdict, never a paper severed from its bundle.
    // Omitted (undefined) means source-level feedback, the pre-v3 shape.
    resourceId?: string | null,
    expectedRevisions: Readonly<Record<string, number>> = {},
  ) {
    return this.capability('source.feedback.record', {
      unit_id: unitId,
      stage_id: stageId,
      source_id: sourceId,
      feedback,
      ...(resourceId ? { resource_id: resourceId } : {}),
    }, { expectedRevisions });
  }
  detour(
    unitId: string,
    stageId: string,
    title: string,
    classification = 'required-now',
    expectedRevisions: Readonly<Record<string, number>> = {},
  ) {
    return this.capability('detour.create',
      { unit_id: unitId, stage_id: stageId, title, classification },
      { expectedRevisions });
  }
  resolveDetour(
    unitId: string,
    detourId: string,
    resolution = '',
    expectedRevisions: Readonly<Record<string, number>> = {},
  ) {
    const payload: Record<string, unknown> = { unit_id: unitId, detour_id: detourId };
    if (resolution) payload.resolution = resolution;
    return this.capability('detour.resolve', payload, { expectedRevisions });
  }
  async attach(
    unitId: string,
    stageId: string,
    filePath: string,
    label = '',
    expectedRevisions: Readonly<Record<string, number>> = {},
  ) {
    const payload: Record<string, unknown> = {
      unit_id: unitId,
      stage_id: stageId,
      file: filePath,
      file_sha256: await fileSha256(filePath),
    };
    if (label) payload.label = label;
    return this.capability('stage.attachment.add', payload, { expectedRevisions });
  }
  captureText(text: string, title = '') {
    const payload: Record<string, unknown> = { text };
    if (title) payload.title = title;
    return this.capability('capture.create', payload);
  }
  async captureFile(filePath: string) {
    return this.capability('capture.create', {
      file: filePath,
      file_sha256: await fileSha256(filePath),
    });
  }
  createGardenSeed(
    text: string,
    title = '',
  ) {
    const payload: Record<string, unknown> = { text };
    if (title.trim()) payload.title = title.trim();
    return this.capability(
      'garden.seed.create',
      payload,
    );
  }
  prepareShelving(unitId: string,
    expectedRevisions: Readonly<Record<string, number>> = {}) {
    return this.capability('review.prepare', { unit_id: unitId }, { expectedRevisions });
  }
  applyShelving(unitId: string, selected: readonly string[],
    expectedRevisions: Readonly<Record<string, number>> = {}) {
    return this.capability('review.apply',
      { unit_id: unitId, selected: [...selected] },
      { expectedRevisions });
  }
  endSession(commitMessage: string | null = null, push = false) {
    const args = ['session-end'];
    if (commitMessage) args.push('--commit-message', commitMessage);
    if (push) args.push('--push');
    return this.call(args);
  }

  /**
   * Apply a study map that has already been through the SOP's coverage audit.
   * The interface carries the reviewed file's path and exact content digest.
   * Core reads it once, verifies those approved bytes, checks them against the
   * creation template and study-map schema, and refuses it as a whole. Gate 1
   * stays where the SOP put it — this applies a reviewed result; it does not
   * skip the review.
   */
  async importUnitMap(unitId: string, file: string, replace = false,
    expectedRevisions: Readonly<Record<string, number>> = {}) {
    return this.capability('unit.map.import', {
      unit_id: unitId,
      file,
      file_sha256: await fileSha256(file),
      ...(replace ? { replace: true } : {}),
    }, { expectedRevisions });
  }

  /**
   * The declared read-only `plan.template` query. Core generates and validates
   * the starting record; the interface never authors defaults of its own, so
   * "the standard" and "what the Create dialog offers" cannot drift apart.
   * No snapshot guard: this reads no repository file and writes nothing.
   */
  planTemplate(
    profile: PlanProfile,
    title: string,
    ids: { unitId?: string; moduleId?: string } = {},
  ) {
    const args = ['plan-template', profile, '--title', title, '--json'];
    if (ids.unitId) args.push('--unit-id', ids.unitId);
    if (ids.moduleId) args.push('--module-id', ids.moduleId);
    return this.call(args);
  }

  /** Versioned read-only status surfaces. Their feature layers decode the
   *  exact producer schemas before rendering any field. */
  healthReport() {
    return this.call(['health-report', '--json']);
  }

  legacyArchiveStatus() {
    return this.call(['legacy-archive-status', '--json']);
  }

  mastersPlanningDashboard() {
    return this.call([
      'masters-planning-dashboard',
      '--confirm-masters-planning',
    ]);
  }

}

/**
 * A wider surface than GatewayHost: building an AI context bundle is a read
 * across the projection plus the one supplementary fact about the editor.
 */
interface AiContextHost {
  store: {
    get(id: string): ProjectionRecord | null;
    mapForUnit(unitId: string): ProjectionRecord | null;
    stage(stageId: string): ProjectionRecord | null;
    snapshotId: string | null;
  };
  app: {
    workspace: {
      getActiveFile?(): { readonly path: string } | null;
    };
  };
}

export function explicitAiContext(
  plugin: AiContextHost,
  context: Record<string, string | undefined> = {},
): JsonRecord {
  const unit = context.unitId ? plugin.store.get(context.unitId) : null;
  const module = context.moduleId ? plugin.store.get(context.moduleId) :
    (unit?.module_id ? plugin.store.get(unit.module_id) : null);
  const stage = context.stageId ? plugin.store.stage(context.stageId) : null;
  const stageResources: ProjectionRecord[] = Array.isArray(stage?.resources)
    ? stage.resources
    : [];
  const unitSelections: ProjectionRecord[] = Array.isArray(unit?.source_selections)
    ? unit.source_selections.filter(
      (row): row is ProjectionRecord =>
        typeof row === 'object'
        && row !== null
        && !Array.isArray(row),
    )
    : [];
  const resources = stageResources.length
    ? stageResources
    : unitSelections;
  return {
    area_program_id: context.programId || module?.area_id || null,
    module_id: module?.id || context.moduleId || null,
    component_id: context.componentId || unit?.component_id || null,
    unit_id: unit?.id || context.unitId || null,
    stage_id: stage?.id || context.stageId || null,
    selected_source_ids: [...new Set(resources.map((row) => row.source_id)
      .filter((value): value is string => typeof value === 'string' && value.length > 0))],
    selected_materials: resources
      .map((row) => row.material_uri
        || row.vault_path
        || row.url
        || row.material_path
        || row.locator)
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
    manifest_snapshot: plugin.store.snapshotId,
    active_file_supplement: plugin.app.workspace.getActiveFile?.()?.path || null,
  };
}
