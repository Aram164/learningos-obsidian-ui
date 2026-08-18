import { button, empty, section } from '../../components';
import { noteCard } from './cards';
import type { JobDashboardHost } from './host';
import type { JobDashboard } from './model';
import { renderSystem } from './system';

export function renderNotes(
  root: HTMLElement,
  host: JobDashboardHost,
  dashboard: JobDashboard,
): void {
  const learning = section(
    root,
    'Learning notes',
    'Capture in your own words, update when your understanding changes, and keep source verification separate.',
  );
  const actions = learning.createDiv({ cls: 'los-job-section-actions' });
  if (host.editNote) button(actions, 'New note', () => host.editNote?.(), 'cta');
  if (!dashboard.notes.learning.length) {
    empty(learning, 'No learning notes yet', 'Create the first note from a study session.');
  } else {
    const list = learning.createDiv({ cls: 'los-job-note-grid' });
    for (const note of dashboard.notes.learning) noteCard(list, host, note);
  }

  renderSystem(root, host, dashboard);
}
