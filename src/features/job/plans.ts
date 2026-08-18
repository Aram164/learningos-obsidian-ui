import { badge, button, empty, section } from '../../components';
import { cardTop } from './cards';
import type { JobDashboardHost } from './host';
import type {
  JobDashboard,
  JobLearningStage,
  JobLearningTrack,
} from './model';
import { renderStageResources } from '../stage-resources';

function planProgress(parent: HTMLElement, plan: JobLearningTrack): void {
  const total = plan.stages.length;
  const completed = plan.completedSessions.length;
  const progress = parent.createDiv({ cls: 'los-job-plan-progress' });
  progress.setAttrs({
    role: 'progressbar',
    'aria-valuemin': '0',
    'aria-valuemax': String(total),
    'aria-valuenow': String(completed),
    'aria-label': `${plan.title}: ${completed} of ${total} stages complete`,
  });
  const fill = progress.createDiv({ cls: 'los-job-plan-progress-fill' });
  fill.style.width = `${total ? Math.round((completed / total) * 100) : 0}%`;
}

function planCard(
  parent: HTMLElement,
  host: JobDashboardHost,
  plan: JobLearningTrack,
): void {
  const total = plan.stages.length;
  const completed = plan.completedSessions.length;
  const card = parent.createDiv({ cls: 'los-card los-job-plan-card' });
  const top = cardTop(card, plan.title, `${total} stage${total === 1 ? '' : 's'}`);
  badge(top, plan.horizon, plan.horizon);
  if (plan.outcome) card.createEl('p', { text: plan.outcome });
  planProgress(card, plan);
  card.createDiv({ cls: 'los-micro', text: `${completed} of ${total} stages complete` });

  const next = plan.stages.find((stage) => !stage.done) || plan.stages[0];
  if (next) {
    const preview = card.createDiv({ cls: 'los-job-plan-next' });
    preview.createDiv({ cls: 'los-kicker', text: next.done ? 'Review' : 'Next stage' });
    preview.createEl('strong', {
      text: `${String(next.number).padStart(2, '0')} · ${next.title}`,
    });
  }

  const actions = card.createDiv({ cls: 'los-actions' });
  if (host.openJobPlan) {
    button(actions, 'Open plan', () => host.openJobPlan?.(plan.id, next?.number), 'cta');
  }
  if (host.editPlan) {
    button(
      actions,
      plan.sourceKind === 'structured' ? 'Edit plan' : 'Make editable',
      () => host.editPlan?.(plan),
      'quiet',
    );
  }
}

function renderMentalModels(parent: HTMLElement, stage: JobLearningStage): void {
  if (!stage.jobContext.mentalModels.length) return;
  const block = parent.createDiv({ cls: 'los-job-stage-block' });
  const mirrored = stage.jobContext.mentalModels.some(
    (model) => model.label === 'Pandas baseline' || model.label === 'Polars mirror',
  );
  block.createEl('h3', { text: mirrored ? 'Concept mirror' : 'Mental model' });
  const grid = block.createDiv({ cls: 'los-job-concept-grid' });
  for (const model of stage.jobContext.mentalModels) {
    const item = grid.createEl('article', { cls: 'los-job-concept-part' });
    item.createDiv({ cls: 'los-kicker', text: model.label });
    item.createEl('p', { text: model.text });
  }
}

function renderStage(
  parent: HTMLElement,
  host: JobDashboardHost,
  dashboard: JobDashboard,
  plan: JobLearningTrack,
  stage: JobLearningStage,
): void {
  const workspace = parent.createEl('article', { cls: 'los-job-stage-reader' });
  const heading = workspace.createDiv({ cls: 'los-job-stage-heading' });
  const copy = heading.createDiv({ cls: 'los-job-stage-heading-copy' });
  copy.createDiv({
    cls: 'los-kicker',
    text: `Stage ${String(stage.number).padStart(2, '0')} of ${plan.stages.length}`,
  });
  copy.createEl('h2', { text: stage.title });
  badge(heading, stage.done ? 'Done' : 'Open', stage.done ? 'complete' : 'ready');
  if (stage.estimateMinutes) badge(heading, `${stage.estimateMinutes} min`, 'role');

  if (stage.objective) {
    const goal = workspace.createDiv({ cls: 'los-stage-goal' });
    goal.createDiv({ cls: 'los-kicker', text: 'Goal' });
    goal.createEl('p', { text: stage.objective });
  }
  renderMentalModels(workspace, stage);
  renderStageResources(workspace, stage.resources, {
    sourceRecord: (sourceId) => {
      const source = dashboard.canonical_shelf.find((item) => item.source_id === sourceId);
      return source ? { id: source.source_id, type: 'source', title: source.title } : null;
    },
    openSource: (source) => host.openSourceDetail(String(source.id || '')),
    openResource: (resource) => {
      const jobResource = stage.resources.find((item) => item.id === resource.id
        && item.label === resource.label);
      if (jobResource?.url) return host.openJobUrl?.(jobResource.url);
      if (jobResource?.vaultPath) return host.openJobLearningPath?.(jobResource.vaultPath);
      return undefined;
    },
  });
  if (stage.jobContext.readOnlyAnchor) {
    const anchor = workspace.createDiv({ cls: 'los-job-stage-block los-job-stratum-reference' });
    anchor.createEl('h3', { text: 'Stratum read-only reference' });
    anchor.createEl('p', { text: stage.jobContext.readOnlyAnchor });
  }
  if (stage.doneWhen.length) {
    const done = section(workspace, 'Done when');
    const list = done.createEl('ul', { cls: 'los-donewhen-list' });
    for (const criterion of stage.doneWhen) {
      list.createEl('li', { cls: 'los-donewhen-row', text: criterion });
    }
  }

  const actions = workspace.createDiv({ cls: 'los-actions los-job-stage-actions' });
  if (host.logJobSession) {
    button(actions, 'Log this stage', () => host.logJobSession?.(plan.id, stage.number), 'cta');
  }
  if (host.setJobSessionState) {
    button(
      actions,
      stage.done ? 'Reopen stage' : 'Mark stage done',
      () => host.setJobSessionState?.(
        plan.id,
        stage.number,
        stage.done ? 'open' : 'done',
        plan.revision,
      ),
      'quiet',
    );
  }
}

function renderPlanDetail(
  root: HTMLElement,
  host: JobDashboardHost,
  dashboard: JobDashboard,
  plan: JobLearningTrack,
): void {
  const page = root.createDiv({ cls: 'los-section los-job-plan-page' });
  if (host.closeJobPlan) button(page, '← All plans', () => host.closeJobPlan?.(), 'tertiary');

  const header = page.createDiv({ cls: 'los-job-plan-detail-header' });
  const top = header.createDiv({ cls: 'los-card-top' });
  const copy = top.createDiv({ cls: 'los-card-copy' });
  copy.createDiv({ cls: 'los-kicker', text: 'Study plan' });
  copy.createEl('h1', { text: plan.title });
  badge(top, plan.horizon, plan.horizon);
  if (plan.outcome) header.createEl('p', { cls: 'los-job-plan-outcome', text: plan.outcome });
  const completed = plan.completedSessions.length;
  header.createDiv({
    cls: 'los-micro',
    text: `${completed} of ${plan.stages.length} stages complete`,
  });
  planProgress(header, plan);
  if (plan.cadence) {
    const cadence = header.createDiv({ cls: 'los-job-plan-cadence' });
    cadence.createDiv({ cls: 'los-kicker', text: 'Cadence' });
    cadence.createEl('p', { text: plan.cadence });
  }
  if (host.editPlan) {
    button(
      header.createDiv({ cls: 'los-actions' }),
      plan.sourceKind === 'structured' ? 'Edit plan' : 'Make editable',
      () => host.editPlan?.(plan),
      'quiet',
    );
  }

  if (!plan.stages.length) {
    empty(page, 'No stages yet', 'Edit this plan to add its first learning stage.');
    return;
  }
  const selected = plan.stages.find(
    (stage) => stage.number === host.selectedPlanSession,
  ) || plan.stages.find((stage) => !stage.done) || plan.stages[0];
  if (!selected) {
    empty(page, 'No stage selected', 'Return to the plan and choose a stage.');
    return;
  }

  const layout = page.createDiv({ cls: 'los-job-plan-layout' });
  const rail = layout.createEl('nav', { cls: 'los-job-stage-rail' });
  rail.setAttrs({ 'aria-label': `${plan.title} stages` });
  rail.createEl('h2', { text: 'Stages' });
  for (const stage of plan.stages) {
    const control = button(
      rail,
      '',
      () => host.openJobPlan?.(plan.id, stage.number),
      'row',
    );
    control.addClass('los-job-stage-row');
    control.toggleClass('is-selected', stage.number === selected.number);
    control.toggleClass('is-done', stage.done);
    control.setAttrs({
      'aria-label': `Open stage ${stage.number}: ${stage.title}`,
      'aria-pressed': String(stage.number === selected.number),
    });
    control.createSpan({
      cls: 'los-job-stage-number',
      text: String(stage.number).padStart(2, '0'),
    });
    const stageCopy = control.createSpan({ cls: 'los-job-stage-copy' });
    stageCopy.createSpan({ text: stage.title });
    stageCopy.createSpan({ cls: 'los-micro', text: stage.done ? 'Done' : 'Open' });
  }
  renderStage(layout, host, dashboard, plan, selected);
}

export function renderPlans(
  root: HTMLElement,
  host: JobDashboardHost,
  dashboard: JobDashboard,
): void {
  const selected = host.selectedPlanId
    ? dashboard.learning_tracks.find((plan) => plan.id === host.selectedPlanId)
    : null;
  if (selected) {
    renderPlanDetail(root, host, dashboard, selected);
    return;
  }

  const wrap = section(
    root,
    'Study plans',
    'Open a plan, then work through one focused stage at a time.',
  );
  const top = wrap.createDiv({ cls: 'los-job-section-actions' });
  if (host.editPlan) button(top, 'New plan', () => host.editPlan?.(), 'cta');
  if (!dashboard.learning_tracks.length) {
    empty(wrap, 'No study plans yet', 'Create a path from a job requirement to proof you can show.');
    return;
  }
  const grid = wrap.createDiv({ cls: 'los-job-plan-grid' });
  for (const plan of dashboard.learning_tracks) planCard(grid, host, plan);
}
