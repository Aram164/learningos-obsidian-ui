import type { ProjectionRecord } from './manifest';

/** Producer-owned query result. Its JSON Schema is mirrored in
 * ``contracts/job-dashboard-v2.lock.json`` and checked against Core in CI. */
export const JOB_DASHBOARD_CONTRACT = 'job-dashboard-v2' as const;

export type JobHorizon = 'now' | 'next' | 'later';
/** Empty means the stage names no source file, so nothing could drift. */
export type JobAnchorFreshness = '' | 'current' | 'drifting' | 'stale' | 'unverified';
export type JobTab = 'now' | 'tasks' | 'plans' | 'notes' | 'library';

export interface JobStratumAccess {
  readonly mode: 'read-only';
  readonly worktree_writes_allowed: false;
  readonly git_metadata_writes_allowed: false;
}

export interface JobDashboardAccess {
  readonly scope: 'job-dashboard';
  readonly read_only: true;
  readonly ephemeral: true;
  readonly excluded_from_manifest: true;
  readonly excluded_from_search: true;
  readonly excluded_from_ai: true;
  readonly writes_through_gateway: true;
  readonly stratum: JobStratumAccess;
  readonly allowed_roots: readonly (
    'legacy-plans' | 'notes' | 'papers' | 'plans' | 'workspace-job-deem'
  )[];
  readonly snapshot_id: string;
}

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
  readonly layer: string;
  readonly verified_against: string;
  readonly declared_status: string;
  readonly freshness: string;
  readonly revision: number;
}

export interface JobLayer {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly noteIds: readonly string[];
}

export interface JobLearningResource {
  readonly record: ProjectionRecord;
  readonly id: string | null;
  readonly kind: string;
  readonly label: string;
  readonly locator: string | null;
  readonly sourceId: string | null;
  readonly scopeTriage: string | null;
  readonly canOpen: boolean;
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
    /** Stratum files the anchor is about, repo-root-relative. Authored. */
    readonly component: readonly string[];
    /** `<sha> (YYYY-MM-DD)` the anchor prose was last read against. Authored. */
    readonly verifiedAgainst: string;
    /**
     * Producer-computed, never authored and never sent back on save. Empty when
     * the stage names no source file; `unverified` when it names one but the
     * checkout could not be asked — which is not a synonym for `current`.
     */
    readonly freshness: JobAnchorFreshness;
  };
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
  readonly type: string;
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
