import type { GatewayResultV1 } from '../../contracts/gateway-v1';
import type { ProjectionRecord } from '../../contracts/manifest-v5';
import type { StageResourceView } from '../stage-resources';

export type JobHorizon = 'now' | 'next' | 'later';
export type JobTab = 'now' | 'tasks' | 'plans' | 'notes' | 'library';

export interface JobWorkspaceScope {
  readonly label: string;
  readonly text: string;
}

export interface JobWorkspace {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly standing: boolean;
  readonly objective: string;
  readonly current_scope: readonly JobWorkspaceScope[];
  readonly next_action: string;
  readonly open_questions: readonly string[];
  readonly path: string;
}

export interface JobNote {
  readonly id: string;
  readonly title: string;
  readonly kind: 'learning' | 'skrub' | 'stratum';
  readonly family: string;
  readonly summary: string;
  readonly body: string;
  readonly path: string;
  readonly component: string;
  /** Stratum pipeline layer, derived by the core from the component path. */
  readonly layer: string;
  readonly verified_against: string;
  readonly declared_status: string;
  readonly freshness: string;
  readonly revision: number;
}

/** One stage of Stratum's pipeline. Published even when it holds no notes — an
 *  empty layer is the finding, so a view that dropped it would hide it. */
export interface JobLayer {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly noteIds: readonly string[];
}

export interface JobLearningResource extends StageResourceView {
  readonly url: string | null;
  readonly vaultPath: string | null;
}

export interface JobMentalModel {
  readonly label: string;
  readonly text: string;
}

export interface JobLearningStage {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly status: string;
  readonly objective: string;
  readonly doneWhen: readonly string[];
  readonly estimateMinutes: number | null;
  readonly examCritical: boolean;
  readonly concepts: readonly string[];
  readonly scopeTriage: string;
  readonly resources: readonly JobLearningResource[];
  readonly jobContext: {
    readonly mentalModels: readonly JobMentalModel[];
    readonly readOnlyAnchor: string;
  };
  /** Recorded by job.track.progress; the core merges it at read time. */
  readonly done: boolean;
}

export interface JobLearningTrack {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly cadence: string;
  readonly horizon: JobHorizon;
  readonly outcome: string;
  readonly stages: readonly JobLearningStage[];
  readonly completedSessions: readonly number[];
  readonly lastSessionAt: string;
  readonly path: string;
  readonly sourceKind: 'structured' | 'legacy-markdown';
  readonly revision: number;
}

export interface JobTask {
  readonly id: string;
  readonly title: string;
  readonly details: string;
  readonly horizon: JobHorizon;
  readonly status: 'open' | 'done';
  readonly trackId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly revision: number;
}

export interface JobPaper {
  readonly id: string;
  readonly title: string;
  readonly authors: readonly string[];
  readonly year: string;
  readonly pages: number;
  readonly horizon: JobHorizon;
  readonly angle: string;
  readonly path: string;
  readonly available: boolean;
}

export interface JobShelfSource {
  readonly source_id: string;
  readonly title: string;
  readonly authors: readonly string[];
  readonly horizon: JobHorizon;
  readonly why: string;
}

export interface JobDashboard {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly workspace: JobWorkspace;
  readonly notes: {
    readonly learning: readonly JobNote[];
    readonly skrub: readonly JobNote[];
    readonly stratum: readonly JobNote[];
    readonly health: Readonly<Record<string, number>>;
    readonly layers: readonly JobLayer[];
  };
  readonly learning_tracks: readonly JobLearningTrack[];
  readonly tasks: readonly JobTask[];
  readonly papers: readonly JobPaper[];
  readonly canonical_shelf: readonly JobShelfSource[];
  readonly counts: Readonly<Record<string, number>>;
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function string(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(string).filter(Boolean) : [];
}

function number(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** `rows` coerces to records, so a list of plain numbers needs its own reader. */
function numbers(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
    : [];
}

function rows(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.map(record).filter((row) => Object.keys(row).length > 0) : [];
}

function horizon(value: unknown): JobHorizon {
  return value === 'now' || value === 'next' ? value : 'later';
}

function relativeJobPath(value: unknown): string {
  const path = string(value).replace(/\\/g, '/').replace(/^\.\//, '');
  if (!path || path.startsWith('/') || path.split('/').includes('..')) return '';
  return path;
}

function counts(value: unknown): Record<string, number> {
  const source = record(value);
  return Object.fromEntries(
    Object.entries(source)
      .filter(([, entry]) => typeof entry === 'number' && Number.isFinite(entry))
      .map(([key, entry]) => [key, entry as number]),
  );
}

function note(value: unknown): JobNote | null {
  const row = record(value);
  const id = string(row.id);
  const title = string(row.title);
  const path = relativeJobPath(row.path);
  if (!id || !title || !path) return null;
  return {
    id,
    title,
    kind: row.kind === 'stratum'
      ? 'stratum'
      : row.kind === 'learning' ? 'learning' : 'skrub',
    family: string(row.family),
    summary: string(row.summary),
    body: string(row.body),
    path,
    component: string(row.component),
    layer: string(row.layer),
    verified_against: string(row.verified_against),
    declared_status: string(row.declared_status),
    freshness: string(row.freshness) || 'unverified',
    revision: number(row.revision),
  };
}

function track(value: unknown): JobLearningTrack | null {
  const row = record(value);
  const id = string(row.id);
  const title = string(row.title);
  const path = relativeJobPath(row.path);
  if (!id || !title || !path) return null;
  return {
    id,
    title,
    path,
    status: string(row.status) || 'ready',
    cadence: string(row.cadence),
    horizon: horizon(row.horizon),
    outcome: string(row.outcome),
    stages: rows(row.stages).map((stage) => {
      const context = record(stage.job_context);
      const resources = rows(stage.resources).map((resource): JobLearningResource => {
        const url = string(resource.url) || null;
        const vaultPath = relativeJobPath(resource.vault_path) || null;
        const resourceRecord: ProjectionRecord = { ...resource };
        if (url) resourceRecord.url = url;
        if (vaultPath) resourceRecord.vault_path = vaultPath;
        return {
          record: resourceRecord,
          id: string(resource.id) || null,
          kind: string(resource.kind) || 'read',
          label: string(resource.label) || 'Resource',
          locator: string(resource.locator) || null,
          sourceId: string(resource.source_id) || null,
          scopeTriage: string(resource.scope_triage) || null,
          canOpen: Boolean(url || vaultPath),
          url,
          vaultPath,
        };
      });
      return {
        id: string(stage.id),
        number: number(stage.number),
        title: string(stage.title),
        status: string(stage.status) || 'pending',
        objective: string(stage.objective),
        doneWhen: strings(stage.done_when),
        estimateMinutes: number(stage.estimate_minutes) || null,
        examCritical: stage.exam_critical === true,
        concepts: strings(stage.concepts),
        scopeTriage: string(stage.scope_triage) || 'required-now',
        resources,
        jobContext: {
          mentalModels: rows(context.mental_models).map((model) => ({
            label: string(model.label),
            text: string(model.text),
          })).filter((model) => model.label && model.text),
          readOnlyAnchor: string(context.read_only_anchor),
        },
        done: stage.done === true,
      };
    }).filter((stage) => stage.id && stage.number > 0 && stage.title),
    completedSessions: numbers(row.completed_sessions),
    lastSessionAt: string(row.last_session_at),
    sourceKind: row.source_kind === 'structured' ? 'structured' : 'legacy-markdown',
    revision: number(row.revision),
  };
}

function task(value: unknown): JobTask | null {
  const row = record(value);
  const id = string(row.id);
  const title = string(row.title);
  if (!id || !title) return null;
  return {
    id,
    title,
    details: string(row.details),
    horizon: horizon(row.horizon),
    status: row.status === 'done' ? 'done' : 'open',
    trackId: string(row.track_id),
    createdAt: string(row.created_at),
    updatedAt: string(row.updated_at),
    revision: number(row.revision),
  };
}

function layer(value: unknown): JobLayer | null {
  const row = record(value);
  const id = string(row.id);
  if (!id) return null;
  return {
    id,
    title: string(row.title) || id,
    summary: string(row.summary),
    noteIds: Array.isArray(row.note_ids)
      ? row.note_ids.filter((item): item is string => typeof item === 'string')
      : [],
  };
}

function paper(value: unknown): JobPaper | null {
  const row = record(value);
  const id = string(row.id);
  const title = string(row.title);
  const path = relativeJobPath(row.path);
  if (!id || !title || !path) return null;
  return {
    id,
    title,
    path,
    authors: strings(row.authors),
    year: row.year == null ? '' : String(row.year),
    pages: number(row.pages),
    horizon: horizon(row.horizon),
    angle: string(row.angle),
    available: row.available === true,
  };
}

function shelfSource(value: unknown): JobShelfSource | null {
  const row = record(value);
  const sourceId = string(row.source_id);
  const title = string(row.title);
  if (!sourceId || !title) return null;
  return {
    source_id: sourceId,
    title,
    authors: strings(row.authors),
    horizon: horizon(row.horizon),
    why: string(row.why),
  };
}

export function asJobDashboard(result: GatewayResultV1): JobDashboard | null {
  if (result.ok !== true || result.contract !== 'job-dashboard-v2') return null;
  const raw = record(result.dashboard);
  const workspaceRaw = record(raw.workspace);
  const workspacePath = relativeJobPath(workspaceRaw.path);
  const title = string(raw.title);
  if (!title || !workspacePath) return null;
  const noteRaw = record(raw.notes);
  return {
    id: string(raw.id) || 'job-dashboard',
    title,
    subtitle: string(raw.subtitle),
    workspace: {
      id: string(workspaceRaw.id) || 'workspace-job-deem',
      title: string(workspaceRaw.title) || title,
      status: string(workspaceRaw.status) || 'active',
      standing: workspaceRaw.standing === true,
      objective: string(workspaceRaw.objective),
      current_scope: rows(workspaceRaw.current_scope).map((scope) => ({
        label: string(scope.label),
        text: string(scope.text),
      })).filter((scope) => scope.label && scope.text),
      next_action: string(workspaceRaw.next_action),
      open_questions: strings(workspaceRaw.open_questions),
      path: workspacePath,
    },
    notes: {
      learning: rows(noteRaw.learning).map(note).filter((item): item is JobNote => item !== null),
      skrub: rows(noteRaw.skrub).map(note).filter((item): item is JobNote => item !== null),
      stratum: rows(noteRaw.stratum).map(note).filter((item): item is JobNote => item !== null),
      health: counts(noteRaw.health),
      layers: rows(noteRaw.layers).map(layer).filter((item): item is JobLayer => item !== null),
    },
    learning_tracks: rows(raw.learning_tracks)
      .map(track).filter((item): item is JobLearningTrack => item !== null),
    tasks: rows(raw.tasks).map(task).filter((item): item is JobTask => item !== null),
    papers: rows(raw.papers).map(paper).filter((item): item is JobPaper => item !== null),
    canonical_shelf: rows(raw.canonical_shelf)
      .map(shelfSource).filter((item): item is JobShelfSource => item !== null),
    counts: counts(raw.counts),
  };
}
