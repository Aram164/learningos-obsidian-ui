import { ItemView, Notice, type WorkspaceLeaf } from 'obsidian';
import { boundaryPolicy, button, empty, pageHeader, section } from '../components';
import { VIEW_BOUNDARY } from '../constants';
import type { ProjectionRecord } from '../contracts/manifest-v4';
import type { LearningOSUI } from '../main';
import { asLabel } from '../projection/readers';

type BoundaryPlugin = Pick<
  LearningOSUI,
  'store'
>;

interface BoundaryViewState {
  boundaryId?: string | null;
}

export class BoundaryView extends ItemView {
  private readonly plugin: BoundaryPlugin;
  private boundaryId: string | null = null;

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
      this.boundaryId = state.boundaryId;
    }

    this.render();
  }

  getState(): BoundaryViewState {
    return { boundaryId: this.boundaryId };
  }

  async onOpen(): Promise<void> {
    const boundaryId = this.leaf.state?.boundaryId;

    if (typeof boundaryId === 'string') {
      this.boundaryId = boundaryId;
    }

    this.render();
  }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-boundary-view');
    const boundary = (this.plugin.store.data?.quarantine_boundaries || [])
      .find(
        (row: ProjectionRecord) => row.id === this.boundaryId,
      );
    if (!boundary) { empty(root, 'Boundary unavailable', 'No quarantined content was loaded.'); return; }
    pageHeader(root, 'Deliberate boundary', asLabel(boundary, 'Boundary'), boundaryPolicy(boundary.description));
    const guard = section(root, 'What this means');
    if (boundary.id === 'program-job-boundary') {
      guard.createEl('p', { text: 'Job content is not indexed, searched, read, or mixed into LearningOS. Access requires a separate, explicit request.' });
      button(guard, 'Request explicit Job access', () => new Notice('Job access remains outside LearningOS. Ask Codex explicitly when needed.'), 'quiet');
    } else {
      guard.createEl('p', { text: 'Master’s planning is quarantined from current Bachelor’s work and all default search. This surface exposes only the boundary record.' });
      button(guard, 'Open Master’s Planning boundary', () => new Notice('Open the quarantined folder manually only for a deliberate planning session.'), 'quiet');
    }
  }
}
