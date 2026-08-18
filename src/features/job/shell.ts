import { button, filterTabs, pageHeader } from '../../components';
import type { JobDashboardHost } from './host';
import { renderLibrary } from './library';
import type { JobDashboard, JobTab } from './model';
import { renderNow } from './now';
import { renderNotes } from './notes';
import { renderPlans } from './plans';
import { renderTasks } from './tasks';

export type { JobDashboardHost } from './host';

/**
 * Today is a digest; the other destinations are the durable workspaces that
 * own tasks, plans, notes, and reference material.
 */
const TABS: ReadonlyArray<readonly [JobTab, string]> = [
  ['now', 'Today'],
  ['tasks', 'Tasks'],
  ['plans', 'Plans'],
  ['notes', 'Notes'],
  ['library', 'Library'],
];

const DESTINATIONS: Record<
  JobTab,
  (root: HTMLElement, host: JobDashboardHost, dashboard: JobDashboard) => void
> = {
  now: renderNow,
  tasks: renderTasks,
  plans: renderPlans,
  notes: renderNotes,
  library: renderLibrary,
};

export function renderJobDashboard(
  root: HTMLElement,
  host: JobDashboardHost,
  dashboard: JobDashboard,
  active: JobTab,
  choose: (tab: JobTab) => void,
): void {
  const header = pageHeader(root, 'Job workspace', dashboard.title, dashboard.subtitle);
  const actions = header.createDiv({ cls: 'los-actions los-job-header-actions' });
  if (host.editTask) button(actions, 'Add task', () => host.editTask?.(), 'quiet');
  if (host.editNote) button(actions, 'New note', () => host.editNote?.(), 'cta');
  filterTabs(root, 'Job workspace sections', TABS, active, choose);
  (DESTINATIONS[active] || renderNow)(root, host, dashboard);
}
