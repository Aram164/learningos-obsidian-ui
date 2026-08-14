import { ItemView, Notice, type WorkspaceLeaf } from 'obsidian';
import { boundaryPolicy, button, empty, pageHeader, section } from '../components';
import { VIEW_BOUNDARY } from '../constants';
import type { ProjectionRecord } from '../contracts/manifest-v5';
import { renderJobDashboard } from '../features/job/dashboard';
import { JobSessionModal } from '../features/job/session-modal';
import {
  asJobDashboard,
  type JobDashboard,
  type JobTab,
} from '../features/job/model';
import type { LearningOSUI } from '../main';
import { asLabel } from '../projection/readers';

type BoundaryPlugin = Pick<
  LearningOSUI,
  'store' | 'gateway' | 'resources' | 'openSourceDetail'
>;

interface BoundaryViewState {
  boundaryId?: string | null;
  tab?: JobTab | null;
}

export class BoundaryView extends ItemView {
  private readonly plugin: BoundaryPlugin;
  private boundaryId: string | null = null;
  private tab: JobTab = 'now';
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
    if (['now', 'system', 'library'].includes(String(state.tab))) {
      this.tab = state.tab as JobTab;
    }

    this.render();
    if (this.boundaryId === 'program-job-boundary') void this.loadJobDashboard();
  }

  getState(): BoundaryViewState {
    return { boundaryId: this.boundaryId, tab: this.tab };
  }

  async onOpen(): Promise<void> {
    const boundaryId = this.leaf.state?.boundaryId;

    if (typeof boundaryId === 'string') {
      this.boundaryId = boundaryId;
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

  /** The core refuses an empty entry, so the text is collected before writing. */
  private openSessionLog(track: string, session: number): void {
    const title = this.dashboard?.learning_tracks.find((item) => item.id === track)?.title || track;
    new JobSessionModal(this.app, {
      trackTitle: title,
      sessionNumber: session,
      submit: async (text: string) => {
        await this.plugin.gateway.logJobSession(text, { track, session });
        this.dashboard = null;
        await this.loadJobDashboard();
      },
    }).open();
  }

  /**
   * Run one bounded Job write, then reload the dashboard so the view reflects
   * what the core actually recorded rather than an optimistic local guess —
   * the response is ephemeral and the core owns the merge (ADR-010).
   */
  private async runJobWrite(write: () => Promise<unknown>): Promise<void> {
    try {
      await write();
      this.dashboard = null;
      await this.loadJobDashboard();
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : String(error);
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
            openSourceDetail: (sourceId: string) => this.plugin.openSourceDetail(sourceId),
            logJobSession: (track: string, session: number) => this.openSessionLog(track, session),
            markJobSessionDone: (track: string, session: number) =>
              this.runJobWrite(() => this.plugin.gateway.recordJobTrackSession(track, session)),
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
        empty(root, 'Job workspace is sealed', 'Opening this destination is the explicit access gesture for an ephemeral, read-only Job session.', 'Open confidential workspace', () => void this.loadJobDashboard());
      }
      return;
    }
    pageHeader(root, 'Deliberate boundary', asLabel(boundary, 'Boundary'), boundaryPolicy(boundary.description));
    const guard = section(root, 'What this means');
    guard.createEl('p', { text: 'Master’s planning is quarantined from current Bachelor’s work and all default search. This surface exposes only the boundary record.' });
    button(guard, 'Open Master’s Planning boundary', () => new Notice('Open the quarantined folder manually only for a deliberate planning session.'), 'quiet');
  }
}
