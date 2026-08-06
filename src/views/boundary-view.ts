import { ItemView, Notice } from 'obsidian';
import { boundaryPolicy, button, empty, pageHeader, section } from '../components';
import { VIEW_BOUNDARY } from '../constants';
import type { ProjectionRecord } from '../contracts/manifest-v2';

export class BoundaryView extends ItemView {
  [key: string]: any;
  constructor(leaf: any, plugin: any) {
    super(leaf);
    this.plugin = plugin;
    this.boundaryId = null;
  }
  getViewType() { return VIEW_BOUNDARY; }
  getDisplayText() { return 'LearningOS · Boundary'; }
  async setState(
    state: Record<string, any> = {},
  ): Promise<void> {
    this.boundaryId = state?.boundaryId || this.boundaryId;
    this.render();
  }
  getState() { return { boundaryId: this.boundaryId }; }
  async onOpen() { this.boundaryId = this.leaf.state?.boundaryId || this.boundaryId; this.render(); }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-boundary-view');
    const boundary = (this.plugin.store.data?.quarantine_boundaries || [])
      .find(
        (row: ProjectionRecord) => row.id === this.boundaryId,
      );
    if (!boundary) { empty(root, 'Boundary unavailable', 'No quarantined content was loaded.'); return; }
    pageHeader(root, 'Deliberate boundary', boundary.title, boundaryPolicy(boundary.description));
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
