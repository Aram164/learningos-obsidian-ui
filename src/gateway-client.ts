import type { JsonRecord, ProjectionRecord } from './contracts/manifest';
import {
  GatewayError, exitCodeOf, structuredError,
  type GatewayResultV1,
} from './contracts/gateway-v1';

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

export class GatewayClient {
  private readonly plugin: GatewayHost;
  private chain: Promise<void>;
  private jobSnapshotId: string | null = null;
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
          const reason = structuredError(stdout) || stderr.trim()
            || error.message || String(error);
          reject(new GatewayError(reason, exitCodeOf(error)));
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
          reject(new GatewayError(
            parsed?.error || 'LearningOS refused the change; your draft was kept.',
            exitCodeOf(error),
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
  ): Promise<GatewayResultV1> {
    const envelope = {
      request_id: nextRequestId(name),
      capability: name,
      expected_snapshot: options.expectedSnapshot || this.snapshotId(),
      ...(options.expectedRevisions && Object.keys(options.expectedRevisions).length
        ? { expected_revisions: options.expectedRevisions }
        : {}),
      payload,
    };
    return this.call(['capability', name, '--payload-file', '-'],
      { stdin: JSON.stringify(envelope) });
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
  saveNote(unitId: string, stageId: string, text: string) {
    return this.capability('stage.note.write',
      { unit_id: unitId, stage_id: stageId, text, replace: true });
  }
  saveUnitNote(
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
  ) {
    const payload: Record<string, unknown> = { unit_id: unitId, text };
    if (String(title).trim()) payload.title = String(title).trim();
    if (stageIds.length) payload.stage_id = [...stageIds];
    if (filePaths.length) payload.attachment = [...filePaths];
    return this.capability('unit.note.append', payload);
  }
  progress(unitId: string, stageId: string, status: string) {
    return this.capability('stage.progress.update',
      { unit_id: unitId, stage_id: stageId, status });
  }
  sourceSelection(
    unitId: string,
    sourceId: string,
    locator: string,
    purpose: string,
    selected: boolean,
  ) {
    return this.capability(
      'unit.source-selection.set',
      {
        unit_id: unitId,
        source_id: sourceId,
        locator,
        action: selected ? 'select' : 'remove',
        ...(selected ? { purpose } : {}),
      },
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
  ) {
    return this.capability('source.feedback.record', {
      unit_id: unitId,
      stage_id: stageId,
      source_id: sourceId,
      feedback,
      ...(resourceId ? { resource_id: resourceId } : {}),
    });
  }
  detour(
    unitId: string,
    stageId: string,
    title: string,
    classification = 'required-now',
  ) {
    return this.capability('detour.create',
      { unit_id: unitId, stage_id: stageId, title, classification });
  }
  resolveDetour(
    unitId: string,
    detourId: string,
    resolution = '',
  ) {
    const payload: Record<string, unknown> = { unit_id: unitId, detour_id: detourId };
    if (resolution) payload.resolution = resolution;
    return this.capability('detour.resolve', payload);
  }
  attach(
    unitId: string,
    stageId: string,
    filePath: string,
    label = '',
  ) {
    const payload: Record<string, unknown> = { unit_id: unitId, stage_id: stageId, file: filePath };
    if (label) payload.label = label;
    return this.capability('stage.attachment.add', payload);
  }
  captureText(text: string, title = '') {
    const payload: Record<string, unknown> = { text };
    if (title) payload.title = title;
    return this.capability('capture.create', payload);
  }
  captureFile(filePath: string) {
    return this.capability('capture.create', { file: filePath });
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
  prepareShelving(unitId: string) {
    return this.capability('review.prepare', { unit_id: unitId });
  }
  applyShelving(unitId: string, selected: readonly string[]) {
    return this.capability('review.apply',
      { unit_id: unitId, selected: [...selected], approve: true });
  }
  endSession(commitMessage: string | null = null, push = false) {
    const args = ['session-end'];
    if (commitMessage) args.push('--commit-message', commitMessage);
    if (push) args.push('--push');
    return this.call(args);
  }

  /**
   * The Job dashboard is the sole read outside the normal projection. The
   * confirmation flag is the learner's deliberate navigation gesture; the
   * core still owns path bounding and returns no durable cache.
   */
  async jobDashboard() {
    const result = await this.call(['job-dashboard', '--confirm-job-access']);
    const access = result.access && typeof result.access === 'object'
      ? result.access as Record<string, unknown>
      : {};
    this.jobSnapshotId = typeof access.snapshot_id === 'string'
      && access.snapshot_id.startsWith('sha256:')
      ? access.snapshot_id
      : null;
    return result;
  }

  private jobCapability(
    name: string,
    payload: Record<string, unknown>,
    expectedRevisions: Readonly<Record<string, number>> = {},
  ) {
    if (!this.jobSnapshotId) {
      throw new Error('Reload the confidential Job workspace before saving; nothing was written.');
    }
    return this.capability(name, payload, {
      expectedSnapshot: this.jobSnapshotId,
      expectedRevisions,
    });
  }

  /**
   * Bounded Job writes (ADR-010). Each carries the same deliberate-gesture flag
   * as the read, and each is a declared capability rooted at Job/ — the view
   * never writes a Job file itself, exactly as it never writes a canonical one.
   */
  logJobSession(text: string, options: {
    track?: string; session?: number; minutes?: number;
  } = {}) {
    const payload: Record<string, unknown> = { text, confirm_job_access: true };
    if (options.track) payload.track = options.track;
    if (options.session !== undefined) payload.session = options.session;
    if (options.minutes !== undefined) payload.minutes = options.minutes;
    return this.jobCapability('job.session.log', payload);
  }

  stampJobNote(noteId: string, commit: string, status = 'current') {
    return this.jobCapability('job.note.stamp', {
      note: noteId, commit, status, confirm_job_access: true,
    });
  }

  saveJobNote(noteId: string, title: string, body: string, revision?: number) {
    return this.jobCapability('job.note.save', {
      note: noteId || title,
      title,
      body,
      folder: 'learning',
      approve: true,
      confirm_job_access: true,
    }, noteId && revision !== undefined ? { [`job-note:${noteId}`]: revision } : {});
  }

  saveJobPlan(plan: Record<string, unknown>, revision?: number) {
    const id = typeof plan.id === 'string' ? plan.id : '';
    return this.jobCapability('job.plan.save', {
      plan,
      approve: true,
      confirm_job_access: true,
    }, id && revision !== undefined ? { [`job-plan:${id}`]: revision } : {});
  }

  saveJobTask(task: Record<string, unknown>, revision?: number) {
    const id = typeof task.id === 'string' ? task.id : '';
    return this.jobCapability('job.task.save', {
      task,
      confirm_job_access: true,
    }, id && revision !== undefined ? { [`job-task:${id}`]: revision } : {});
  }

  recordJobTrackSession(
    trackId: string,
    session: number,
    state: 'done' | 'open',
    revision: number,
  ) {
    return this.jobCapability('job.track.progress', {
      track: trackId, session, state, confirm_job_access: true,
    }, { [`job-track:${trackId}`]: revision });
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
