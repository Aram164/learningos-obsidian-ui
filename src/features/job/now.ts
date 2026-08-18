import { badge, button, section } from '../../components';
import { cardTop, factList, noteCard } from './cards';
import type { JobDashboardHost } from './host';
import type { JobDashboard, JobLearningTrack } from './model';

/** The next stage is the first one not yet recorded as done. */
function nextStage(dashboard: JobDashboard) {
  for (const track of dashboard.learning_tracks) {
    const stage = track.stages.find((item) => !item.done);
    if (stage) return { track, stage };
  }
  return null;
}

function renderScope(
  root: HTMLElement,
  host: JobDashboardHost,
  dashboard: JobDashboard,
): void {
  const { workspace } = dashboard;
  const required = workspace.current_scope.find((item) => item.label === 'required-now');
  const scope = section(root, 'Required now');
  scope.createEl('p', {
    text: required ? required.text : workspace.next_action || 'No required-now scope is recorded.',
  });
  button(scope, 'Open workspace context', () => host.openJobPath(workspace.path), 'quiet');
}

function renderNextStage(
  root: HTMLElement,
  host: JobDashboardHost,
  dashboard: JobDashboard,
): void {
  const upcoming = nextStage(dashboard);
  if (!upcoming) return;
  const { track, stage } = upcoming;

  const wrap = section(root, 'Next stage');
  const card = wrap.createDiv({ cls: 'los-card' });
  const top = cardTop(
    card,
    stage.title,
    `${track.title} · stage ${String(stage.number).padStart(2, '0')}`,
  );
  badge(top, `${track.completedSessions.length}/${track.stages.length} done`, track.status);
  if (stage.objective) card.createEl('p', { text: stage.objective });

  factList(card, [
    ['Learn from', stage.resources.slice(0, 3).map((item) => item.label).join(' · ')],
    ['Read-only anchor', stage.jobContext.readOnlyAnchor],
    ['Done when', stage.doneWhen[0] || 'Stage evidence is recorded.'],
  ]);

  const actions = card.createDiv({ cls: 'los-actions' });
  if (host.logJobSession) {
    button(actions, 'Log this stage', () => host.logJobSession?.(track.id, stage.number), 'cta');
  }
  if (host.setJobSessionState) {
    button(
      actions,
      'Mark done',
      () => host.setJobSessionState?.(track.id, stage.number, 'done', track.revision),
      'quiet',
    );
  }
  if (host.openJobPlan) {
    button(
      actions,
      'Open this stage',
      () => host.openJobPlan?.(track.id, stage.number),
      'quiet',
    );
  }
}

function renderTaskPreview(
  root: HTMLElement,
  host: JobDashboardHost,
  dashboard: JobDashboard,
): void {
  const tasks = dashboard.tasks
    .filter((task) => task.status === 'open')
    .sort((left, right) => ['now', 'next', 'later'].indexOf(left.horizon)
      - ['now', 'next', 'later'].indexOf(right.horizon))
    .slice(0, 4);
  const wrap = section(root, 'To do', tasks.length
    ? `${tasks.length} next action${tasks.length === 1 ? '' : 's'}`
    : 'Nothing is waiting on you.');
  const actions = wrap.createDiv({ cls: 'los-job-section-actions' });
  if (host.editTask) button(actions, 'Add task', () => host.editTask?.(), 'quiet');
  for (const task of tasks) {
    const row = wrap.createDiv({ cls: 'los-job-task-row los-job-task-row--compact' });
    const toggle = row.createEl('input', {
      attr: { type: 'checkbox', 'aria-label': `Complete ${task.title}` },
    });
    toggle.addEventListener('change', () => host.setTaskState?.(task, 'done'));
    const copy = row.createDiv({ cls: 'los-job-task-copy' });
    copy.createEl('strong', { text: task.title });
    copy.createDiv({ cls: 'los-micro', text: task.horizon });
  }
}

function planRunwayRow(
  parent: HTMLElement,
  host: JobDashboardHost,
  plan: JobLearningTrack,
): void {
  const total = plan.stages.length;
  const completed = plan.completedSessions.length;
  const row = parent.createDiv({ cls: 'los-job-runway-row' });
  const copy = row.createDiv({ cls: 'los-job-runway-copy' });
  copy.createEl('strong', { text: plan.title });
  copy.createDiv({ cls: 'los-micro', text: plan.outcome || plan.cadence });
  badge(row, `${completed}/${total}`, plan.horizon);
  const progress = row.createDiv({ cls: 'los-job-plan-progress' });
  progress.setAttrs({
    role: 'progressbar',
    'aria-valuemin': '0',
    'aria-valuemax': String(total),
    'aria-valuenow': String(completed),
    'aria-label': `${plan.title}: ${completed} of ${total} stages complete`,
  });
  const fill = progress.createDiv({ cls: 'los-job-plan-progress-fill' });
  fill.style.width = `${total ? Math.round((completed / total) * 100) : 0}%`;
  if (host.openJobPlan) {
    const next = plan.stages.find((stage) => !stage.done) || plan.stages[0];
    button(
      row,
      'Open plan',
      () => host.openJobPlan?.(plan.id, next?.number),
      'tertiary',
    );
  }
}

function renderPlanRunway(
  root: HTMLElement,
  host: JobDashboardHost,
  dashboard: JobDashboard,
): void {
  if (!dashboard.learning_tracks.length) return;
  const wrap = section(
    root,
    'Plan runway',
    'Long-term plans stay visible without competing with the next stage.',
  );
  const runway = wrap.createDiv({ cls: 'los-job-runway' });
  for (const plan of dashboard.learning_tracks.slice(0, 3)) planRunwayRow(runway, host, plan);
}

function renderNotePreview(
  root: HTMLElement,
  host: JobDashboardHost,
  dashboard: JobDashboard,
): void {
  const wrap = section(root, 'Learning notes');
  const actions = wrap.createDiv({ cls: 'los-job-section-actions' });
  if (host.editNote) button(actions, 'New note', () => host.editNote?.(), 'quiet');
  const note = dashboard.notes.learning[0];
  if (note) noteCard(wrap, host, note);
  else wrap.createEl('p', { cls: 'los-muted', text: 'Capture the first note from a study session.' });
}

/**
 * Notes whose recorded commit no longer matches the code they describe. Whether
 * the prose still holds is a judgement, so the queue reports and does not sort.
 */
function renderDrift(
  root: HTMLElement,
  host: JobDashboardHost,
  dashboard: JobDashboard,
): void {
  const drifted = dashboard.notes.stratum.filter((note) => note.freshness !== 'current');
  if (!drifted.length) return;
  const queue = section(
    root,
    'Needs re-verifying',
    'These notes describe code that has changed since they were last verified.',
  );
  const list = queue.createDiv({ cls: 'los-job-notes' });
  for (const note of drifted) noteCard(list, host, note);
}

function renderQuestions(
  root: HTMLElement,
  dashboard: JobDashboard,
): void {
  const { open_questions: questions } = dashboard.workspace;
  if (!questions.length) return;
  const wrap = section(root, 'Open questions');
  const list = wrap.createEl('ul', { cls: 'los-job-questions' });
  for (const question of questions) list.createEl('li', { text: question });
}

export function renderNow(
  root: HTMLElement,
  host: JobDashboardHost,
  dashboard: JobDashboard,
): void {
  const grid = root.createDiv({ cls: 'los-job-today-grid' });
  const focus = grid.createDiv({ cls: 'los-job-today-focus' });
  const side = grid.createDiv({ cls: 'los-job-today-side' });
  renderNextStage(focus, host, dashboard);
  renderPlanRunway(focus, host, dashboard);
  renderTaskPreview(side, host, dashboard);
  renderNotePreview(side, host, dashboard);
  renderDrift(side, host, dashboard);
  renderScope(root, host, dashboard);
  renderQuestions(root, dashboard);
}
