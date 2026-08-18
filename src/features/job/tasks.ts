import { badge, button, empty, section } from '../../components';
import type { JobDashboardHost } from './host';
import type { JobDashboard, JobHorizon, JobTask } from './model';

const HORIZONS: ReadonlyArray<readonly [JobHorizon, string]> = [
  ['now', 'Today / now'],
  ['next', 'Next'],
  ['later', 'Later'],
];

function taskRow(parent: HTMLElement, host: JobDashboardHost, task: JobTask): void {
  const row = parent.createDiv({ cls: 'los-job-task-row' });
  const toggle = row.createEl('input', {
    attr: { type: 'checkbox', 'aria-label': `Complete ${task.title}` },
  });
  toggle.checked = task.status === 'done';
  toggle.addEventListener('change', () => {
    host.setTaskState?.(task, toggle.checked ? 'done' : 'open');
  });
  const copy = row.createDiv({ cls: 'los-job-task-copy' });
  copy.createEl('strong', { text: task.title });
  if (task.details) copy.createDiv({ cls: 'los-micro', text: task.details });
  if (task.trackId) badge(copy, task.trackId, 'role');
  button(row, 'Edit', () => host.editTask?.(task), 'tertiary');
  row.toggleClass('is-done', task.status === 'done');
}

export function renderTasks(
  root: HTMLElement,
  host: JobDashboardHost,
  dashboard: JobDashboard,
): void {
  const wrap = section(root, 'Tasks', 'A small Job-only action list, separate from the academic work graph.');
  const top = wrap.createDiv({ cls: 'los-job-section-actions' });
  if (host.editTask) button(top, 'Add task', () => host.editTask?.(), 'cta');
  if (!dashboard.tasks.length) {
    empty(wrap, 'No Job tasks yet', 'Add the first concrete action for this workspace.');
    return;
  }
  for (const [horizon, label] of HORIZONS) {
    const tasks = dashboard.tasks.filter((task) => task.horizon === horizon);
    if (!tasks.length) continue;
    const group = wrap.createDiv({ cls: 'los-job-task-group' });
    const head = group.createDiv({ cls: 'los-card-top' });
    head.createEl('h3', { text: label });
    badge(head, String(tasks.length), horizon);
    for (const task of tasks) taskRow(group, host, task);
  }
}
