import type { JobLearningTrack, JobNote, JobTask } from './model';

/**
 * What a Job destination is allowed to ask of its host.
 *
 * It lives in its own module so the three destinations and the shell can all
 * depend on the contract without depending on each other — `shell.ts` imports
 * the destinations, so a destination importing the shell back for this type
 * would close the loop.
 */
export interface JobDashboardHost {
  openJobPath(path: string): unknown;
  openSourceDetail(sourceId: string): unknown;
  /** In-app plan navigation. A session number deep-links to one plan stage. */
  openJobPlan?(trackId: string, session?: number): unknown;
  closeJobPlan?(): unknown;
  readonly selectedPlanId?: string | null;
  readonly selectedPlanSession?: number | null;
  /** Links published by the bounded Job dashboard still cross an allowlist. */
  openJobUrl?(url: string): unknown;
  openJobLearningPath?(path: string): unknown;
  /**
   * Bounded Job writes (ADR-010). Optional so a read-only host — a preview, a
   * test double — stays valid and simply renders no write affordances.
   */
  logJobSession?(track: string, session: number): unknown;
  setJobSessionState?(track: string, session: number, state: 'done' | 'open', revision: number): unknown;
  editTask?(task?: JobTask): unknown;
  setTaskState?(task: JobTask, state: 'open' | 'done'): unknown;
  editPlan?(plan?: JobLearningTrack): unknown;
  editNote?(note?: JobNote): unknown;
}
