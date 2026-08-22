import { ItemView, Notice, type WorkspaceLeaf } from 'obsidian';
import { boundaryPolicy, button, empty, pageHeader, section } from '../components';
import { VIEW_BOUNDARY } from '../constants';
import type { ProjectionRecord } from '../contracts/manifest';
import { isProjectionConflict } from '../contracts/gateway-v1';
import { renderJobDashboard } from '../features/job/shell';
import { JobSessionModal } from '../features/job/session-modal';
import {
  JobNoteModal,
  JobPlanModal,
  JobTaskModal,
} from '../features/job/editor-modals';
import {
  asJobDashboard,
  asPlanTemplate,
  type JobDashboard,
  type JobLearningTrack,
  type JobNote,
  type JobTab,
  type JobTask,
} from '../features/job/model';
import type { AppSurface } from '../app/surface';
import type { AppNavigator } from '../app/navigator';
import { asLabel } from '../projection/readers';

type BoundaryPlugin = Pick<
  AppSurface,
  'store' | 'gateway' | 'resources'
> & {
  readonly nav: Pick<AppNavigator, 'openSourceDetail'>;
};

interface BoundaryViewState {
  boundaryId?: string | null;
  /** `system` is accepted only to migrate persisted pre-v2 workspace state. */
  tab?: JobTab | 'system' | null;
  planId?: string | null;
  planSession?: number | null;
}

export class BoundaryView extends ItemView {
  private readonly plugin: BoundaryPlugin;
  private boundaryId: string | null = null;
  private tab: JobTab = 'now';
  private planId: string | null = null;
  private planSession: number | null = null;
  private dashboard: JobDashboard | null = null;
  private loading = false;
  private error = '';

  constructor(
    leaf: WorkspaceLeaf,
    plugin: BoundaryPlugin,
  ) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() { return VIEW_BOUNDARY; }
  getDisplayText() { return 'LearningOS · Boundary'; }
  async setState(
    state: BoundaryViewState = {},
  ): Promise<void> {
    if (typeof state.boundaryId === 'string') {
      if (state.boundaryId !== this.boundaryId) {
        this.dashboard = null;
        this.error = '';
      }
      this.boundaryId = state.boundaryId;
    }
    if (state.tab === 'system') {
      this.tab = 'notes';
    } else if (['now', 'tasks', 'plans', 'notes', 'library'].includes(String(state.tab))) {
      this.tab = state.tab as JobTab;
    }
    if ('planId' in state) {
      this.planId = typeof state.planId === 'string' && state.planId.trim()
        ? state.planId.trim()
        : null;
    }
    if ('planSession' in state) {
      this.planSession = typeof state.planSession === 'number'
        && Number.isInteger(state.planSession) && state.planSession > 0
        ? state.planSession
        : null;
    }

    this.render();
    if (this.boundaryId === 'program-job-boundary') void this.loadJobDashboard();
  }

  getState(): BoundaryViewState {
    return {
      boundaryId: this.boundaryId,
      tab: this.tab,
      planId: this.planId,
      planSession: this.planSession,
    };
  }

  async onOpen(): Promise<void> {
    const boundaryId = this.leaf.state?.boundaryId;

    if (typeof boundaryId === 'string') {
      this.boundaryId = boundaryId;
    }
    const planId = this.leaf.state?.planId;
    const planSession = this.leaf.state?.planSession;
    if (typeof planId === 'string' && planId.trim()) this.planId = planId.trim();
    if (typeof planSession === 'number' && Number.isInteger(planSession) && planSession > 0) {
      this.planSession = planSession;
    }

    this.render();
    if (this.boundaryId === 'program-job-boundary') void this.loadJobDashboard();
  }

  private async loadJobDashboard(): Promise<void> {
    if (this.loading || this.dashboard || this.boundaryId !== 'program-job-boundary') return;
    this.loading = true;
    this.error = '';
    this.render();
    try {
      const result = await this.plugin.gateway.jobDashboard();
      const dashboard = asJobDashboard(result);
      if (!dashboard || !this.plugin.resources.grantJobAccess(result.access)) {
        throw new Error('LearningOS refused an invalid Job dashboard response.');
      }
      this.dashboard = dashboard;
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.loading = false;
      this.render();
    }
  }

  private chooseTab(tab: JobTab): void {
    this.tab = tab;
    this.render();
  }

  private openJobPlan(trackId: string, session?: number): void {
    const plan = this.dashboard?.learning_tracks.find((item) => item.id === trackId);
    if (!plan) {
      new Notice('That study plan is no longer available.');
      return;
    }
    const requested = typeof session === 'number'
      ? plan.stages.find((item) => item.number === session)
      : null;
    const selected = requested || plan.stages.find((item) => !item.done) || plan.stages[0];
    this.planId = plan.id;
    this.planSession = selected?.number || null;
    this.tab = 'plans';
    this.render();
  }

  private closeJobPlan(): void {
    this.planId = null;
    this.planSession = null;
    this.render();
  }

  /** The core refuses an empty entry, so the text is collected before writing. */
  private openSessionLog(track: string, session: number): void {
    const title = this.dashboard?.learning_tracks.find((item) => item.id === track)?.title || track;
    new JobSessionModal(this.app, {
      trackTitle: title,
      sessionNumber: session,
      submit: async (text: string) => {
        await this.commitJobWrite(() => this.plugin.gateway.logJobSession(text, { track, session }));
      },
    }).open();
  }

  private openTaskEditor(task?: JobTask): void {
    new JobTaskModal(this.app, {
      ...(task ? { task } : {}),
      tracks: this.dashboard?.learning_tracks || [],
      submit: (value, revision) => this.commitJobWrite(
        () => this.plugin.gateway.saveJobTask(value, revision),
      ),
    }).open();
  }

  private openPlanEditor(plan?: JobLearningTrack): void {
    new JobPlanModal(this.app, {
      ...(plan ? { plan } : {}),
      // Read-only, so it does not join the write chain: queuing it behind a
      // pending save would leave the dialog waiting on an unrelated write.
      template: async (title: string) => asPlanTemplate(
        await this.plugin.gateway.planTemplate('job', title),
      ),
      submit: (value, revision) => this.commitJobWrite(
        () => this.plugin.gateway.saveJobPlan(value, revision),
      ),
    }).open();
  }

  private openNoteEditor(note?: JobNote): void {
    new JobNoteModal(this.app, {
      ...(note ? { note } : {}),
      submit: (noteId, title, body, revision) => this.commitJobWrite(
        () => this.plugin.gateway.saveJobNote(noteId, title, body, revision),
      ),
    }).open();
  }

  private async commitJobWrite(write: () => Promise<unknown>): Promise<void> {
    try {
      await this.plugin.gateway.enqueue(write);
    } catch (error: unknown) {
      // A Job conflict refreshes only the ephemeral Job read model. The draft
      // stays in its modal and the rejected mutation is never retried for the
      // learner, because the new state may change what they meant to write.
      if (isProjectionConflict(error)) {
        this.dashboard = null;
        await this.loadJobDashboard();
      }
      throw error;
    }
    this.dashboard = null;
    await this.loadJobDashboard();
  }

  /**
   * Run one bounded Job write, then reload the dashboard so the view reflects
   * what the core actually recorded rather than an optimistic local guess —
   * the response is ephemeral and the core owns the merge (ADR-010).
   */
  private async runJobWrite(write: () => Promise<unknown>): Promise<void> {
    try {
      await this.commitJobWrite(write);
    } catch (error: unknown) {
      new Notice(error instanceof Error ? error.message : String(error));
      this.error = '';
      this.render();
    }
  }

  render() {
    const root = this.contentEl; root.empty(); root.removeClass('los-job-view'); root.addClass('los-root', 'los-boundary-view');
    const boundary = (this.plugin.store.data?.quarantine_boundaries || [])
      .find(
        (row: ProjectionRecord) => row.id === this.boundaryId,
      );
    if (!boundary) { empty(root, 'Boundary unavailable', 'No quarantined content was loaded.'); return; }
    if (boundary.id === 'program-job-boundary') {
      root.addClass('los-job-view');
      if (this.dashboard) {
        renderJobDashboard(
          root,
          {
            openJobPath: (path: string) => this.plugin.resources.openJobPath(path),
            openSourceDetail: (sourceId: string) => this.plugin.nav.openSourceDetail(sourceId),
            openJobPlan: (trackId: string, session?: number) => this.openJobPlan(trackId, session),
            closeJobPlan: () => this.closeJobPlan(),
            selectedPlanId: this.planId,
            selectedPlanSession: this.planSession,
            openJobUrl: (url: string) => this.plugin.resources.openJobUrl(url),
            openJobLearningPath: (path: string) => this.plugin.resources.openJobLearningPath(path),
            logJobSession: (track: string, session: number) => this.openSessionLog(track, session),
            setJobSessionState: (track, session, state, revision) => this.runJobWrite(
              () => this.plugin.gateway.recordJobTrackSession(track, session, state, revision),
            ),
            editTask: (task) => this.openTaskEditor(task),
            setTaskState: (task, state) => this.runJobWrite(
              () => this.plugin.gateway.saveJobTask({
                id: task.id,
                title: task.title,
                details: task.details,
                horizon: task.horizon,
                status: state,
                track_id: task.trackId,
              }, task.revision),
            ),
            editPlan: (plan) => this.openPlanEditor(plan),
            editNote: (note) => this.openNoteEditor(note),
          },
          this.dashboard,
          this.tab,
          (tab: JobTab) => this.chooseTab(tab),
        );
        return;
      }
      pageHeader(
        root,
        'Job · confidential workspace',
        asLabel(boundary, 'Job'),
        boundaryPolicy(boundary.description),
      );
      if (this.loading) {
        empty(root, 'Opening the confidential workspace', 'Reading only the bounded Job dashboard. Nothing is being added to LearningOS search or the manifest.');
      } else if (this.error) {
        empty(root, 'Job workspace unavailable', this.error, 'Try again', () => void this.loadJobDashboard());
      } else {
        empty(root, 'Job workspace is sealed', 'Opening this destination creates an ephemeral Job session. Notes, plans, tasks, and progress can then be saved only through the guarded gateway.', 'Open confidential workspace', () => void this.loadJobDashboard());
      }
      return;
    }
    pageHeader(root, 'Deliberate boundary', asLabel(boundary, 'Boundary'), boundaryPolicy(boundary.description));
    const guard = section(root, 'What this means');
    guard.createEl('p', { text: 'Master’s planning is quarantined from current Bachelor’s work and all default search. This surface exposes only the boundary record.' });
    button(guard, 'Open Master’s Planning boundary', () => new Notice('Open the quarantined folder manually only for a deliberate planning session.'), 'warm');
  }
}
