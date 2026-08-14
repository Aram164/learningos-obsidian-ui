import type { GatewayResultV1 } from '../../contracts/gateway-v1';

export type JobHorizon = 'now' | 'next' | 'later';
export type JobTab = 'now' | 'system' | 'library';

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
  readonly kind: 'skrub' | 'stratum';
  readonly family: string;
  readonly summary: string;
  readonly path: string;
  readonly component: string;
  /** Stratum pipeline layer, derived by the core from the component path. */
  readonly layer: string;
  readonly verified_against: string;
  readonly declared_status: string;
  readonly freshness: string;
}

/** One stage of Stratum's pipeline. Published even when it holds no notes — an
 *  empty layer is the finding, so a view that dropped it would hide it. */
export interface JobLayer {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly noteIds: readonly string[];
}

export interface JobLearningSession {
  readonly number: number;
  readonly title: string;
  readonly concept: string;
  readonly source: string;
  readonly anchor: string;
  readonly practice: string;
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
  readonly sessions: readonly JobLearningSession[];
  readonly completedSessions: readonly number[];
  readonly lastSessionAt: string;
  readonly path: string;
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
    readonly skrub: readonly JobNote[];
    readonly stratum: readonly JobNote[];
    readonly health: Readonly<Record<string, number>>;
    readonly layers: readonly JobLayer[];
  };
  readonly learning_tracks: readonly JobLearningTrack[];
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
  const top = path.split('/')[0] || '';
  return ['notes', 'workspace-job-deem', 'papers', 'legacy-plans'].includes(top)
    ? path
    : '';
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
    kind: row.kind === 'stratum' ? 'stratum' : 'skrub',
    family: string(row.family),
    summary: string(row.summary),
    path,
    component: string(row.component),
    layer: string(row.layer),
    verified_against: string(row.verified_against),
    declared_status: string(row.declared_status),
    freshness: string(row.freshness) || 'unverified',
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
    sessions: rows(row.sessions).map((session) => ({
      number: number(session.number),
      title: string(session.title),
      concept: string(session.concept),
      source: string(session.source),
      anchor: string(session.anchor),
      practice: string(session.practice),
      done: session.done === true,
    })).filter((session) => session.number > 0 && session.title),
    completedSessions: numbers(row.completed_sessions),
    lastSessionAt: string(row.last_session_at),
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
  if (result.ok !== true || result.contract !== 'job-dashboard-v1') return null;
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
      skrub: rows(noteRaw.skrub).map(note).filter((item): item is JobNote => item !== null),
      stratum: rows(noteRaw.stratum).map(note).filter((item): item is JobNote => item !== null),
      health: counts(noteRaw.health),
      layers: rows(noteRaw.layers).map(layer).filter((item): item is JobLayer => item !== null),
    },
    learning_tracks: rows(raw.learning_tracks)
      .map(track).filter((item): item is JobLearningTrack => item !== null),
    papers: rows(raw.papers).map(paper).filter((item): item is JobPaper => item !== null),
    canonical_shelf: rows(raw.canonical_shelf)
      .map(shelfSource).filter((item): item is JobShelfSource => item !== null),
    counts: counts(raw.counts),
  };
}
