import { badge, button, cardTop, empty, section } from '../../components';
import type { JobDashboardHost } from './host';
import type {
  JobDashboard,
  JobLearningStage,
  JobLearningTrack,
} from './model';
import { renderStageResources } from '../stage-resources';
import { renderLearningProgress, renderLearningRouteRail } from '../learning-route';

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
  renderLearningProgress(
    card,
    completed,
    total,
    `${plan.title}: overall learning route progress`,
  );

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
  const block = parent.createDiv({ cls: 'los-section los-stage-section los-job-stage-block' });
  const mirrored = stage.jobContext.mentalModels.some(
    (model) => model.label === 'Pandas baseline' || model.label === 'Polars mirror',
  );
  block.createEl('h2', { text: mirrored ? 'Concept mirror' : 'Mental model' });
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
  const workspace = parent.createEl('article', { cls: 'los-stage-workspace' });
  const heading = workspace.createDiv({ cls: 'los-stage-heading' });
  const headingRow = heading.createDiv({ cls: 'los-stage-heading-row' });
  const copy = headingRow.createDiv({ cls: 'los-stage-heading-copy' });
  copy.createDiv({
    cls: 'los-kicker',
    text: stage.examCritical
      ? `Exam-critical · Stage ${String(stage.number).padStart(2, '0')} of ${plan.stages.length}`
      : `Stage ${String(stage.number).padStart(2, '0')} of ${plan.stages.length}`,
  });
  copy.createEl('h2', { text: stage.title });
  copy.createDiv({
    cls: 'los-stage-order-context',
    text: `${stage.done ? 'Complete' : 'Selected'} · ${plan.title}`,
  });
  if (stage.estimateMinutes) badge(headingRow, `${stage.estimateMinutes} min`, 'role');

  if (stage.objective) {
    const goal = workspace.createDiv({ cls: 'los-stage-goal' });
    goal.createDiv({ cls: 'los-kicker', text: 'Goal' });
    goal.createEl('p', { text: stage.objective });
  }
  if (stage.doneWhen.length) {
    const done = workspace.createDiv({ cls: 'los-section los-stage-section' });
    const doneHeading = done.createDiv({ cls: 'los-stage-section-heading' });
    doneHeading.createEl('h2', { text: 'Done when' });
    doneHeading.createSpan({
      cls: 'los-micro',
      text: `${stage.doneWhen.length} ${stage.doneWhen.length === 1 ? 'criterion' : 'criteria'}`,
    });
    const list = done.createEl('ul', { cls: 'los-donewhen-list' });
    for (const criterion of stage.doneWhen) {
      list.createEl('li', { cls: 'los-donewhen-row', text: criterion });
    }
  }
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
  renderMentalModels(workspace, stage);
  if (stage.jobContext.readOnlyAnchor) {
    const anchor = workspace.createDiv({
      cls: 'los-section los-stage-section los-job-stage-block los-job-stratum-reference',
    });
    const heading = anchor.createEl('h3', { text: 'Stratum read-only reference' });
    // The same badge the note cards use, for the same reason: a stage read in
    // month fourteen should say out loud whether the code it describes has
    // moved since anyone last checked.
    if (stage.jobContext.freshness) {
      badge(heading, stage.jobContext.freshness, stage.jobContext.freshness);
    }
    anchor.createEl('p', { text: stage.jobContext.readOnlyAnchor });
    if (stage.jobContext.component.length) {
      anchor.createSpan({
        cls: 'los-micro',
        text: stage.jobContext.verifiedAgainst
          ? `Verified ${stage.jobContext.verifiedAgainst} — ${stage.jobContext.component.join(', ')}`
          : `Not yet stamped — ${stage.jobContext.component.join(', ')}`,
      });
    }
  }

  const actions = workspace.createDiv({ cls: 'los-unit-actionbar' });
  actions.createDiv({
    cls: 'los-unit-action-note',
    text: 'Job learning progress stays inside the quarantined workspace.',
  });
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
  renderLearningProgress(
    header,
    completed,
    plan.stages.length,
    `${plan.title}: overall learning route progress`,
    false,
  );
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
  const selectedIndex = plan.stages.findIndex((stage) => stage.id === selected.id);
  renderLearningRouteRail(layout, {
    title: 'Learning route',
    ariaLabel: `${plan.title} stages`,
    progressLabel: `${plan.title}: overall learning route progress`,
    completed: plan.completedSessions.length,
    selectedId: selected.id,
    items: plan.stages.map((stage, index) => ({
      id: stage.id,
      number: stage.number,
      title: stage.title,
      state: stage.done ? 'complete' : 'pending',
      marker: stage.done
        ? 'Complete'
        : index === selectedIndex
          ? `Done when · ${stage.doneWhen.length} criteria`
          : index > selectedIndex
            ? 'Not started'
            : 'Open',
    })),
    select: (stageId) => {
      const stage = plan.stages.find((item) => item.id === stageId);
      if (stage) host.openJobPlan?.(plan.id, stage.number);
    },
  });
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
