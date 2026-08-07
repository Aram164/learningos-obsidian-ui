import {
  ItemView,
  type WorkspaceLeaf,
} from 'obsidian';
import {
  button,
  empty,
  pageHeader,
  projectedExcerpt,
  section,
} from '../components';
import { VIEW_HOME } from '../constants';
import type {
  ProjectionRecord,
} from '../contracts/manifest-v2';
import type {
  LearningOSUI,
} from '../main';

interface HomeItem {
  readonly title: string;
  readonly detail: string;
  readonly actionLabel: string;
  readonly action: (() => unknown) | null;
}

interface ElsewhereRow {
  readonly record: ProjectionRecord;
  readonly type: string;
  readonly open: () => unknown;
}

interface HomeResumePointer {
  readonly unit_id?: string;
  readonly study_map_id?: string;
  readonly stage_id?: string;
  readonly module_id?: string;
}

type HomePlugin = Pick<
  LearningOSUI,
  | 'generate'
  | 'openCapture'
  | 'openGarden'
  | 'openGlobalSearch'
  | 'openLearn'
  | 'openModule'
  | 'openProject'
  | 'openReview'
  | 'openUnit'
  | 'store'
>;

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
  );
}

function projectedString(
  value: unknown,
): string | null {
  return typeof value === 'string' && value
    ? value
    : null;
}

function projectedText(
  value: unknown,
): string | null {
  if (
    typeof value === 'string'
    || typeof value === 'number'
  ) {
    const text = String(value);

    return text
      ? text
      : null;
  }

  return null;
}

function projectedLabel(
  record: ProjectionRecord,
): string {
  return (
    projectedString(record.title)
    ?? projectedString(record.label)
    ?? projectedString(record.id)
    ?? 'Untitled'
  );
}

function projectedRecords(
  value: unknown,
): ProjectionRecord[] {
  return Array.isArray(value)
    ? value.filter(
      (
        candidate,
      ): candidate is ProjectionRecord =>
        isRecord(candidate),
    )
    : [];
}

function projectedStrings(
  value: unknown,
): string[] {
  return Array.isArray(value)
    ? value.filter(
      (
        candidate,
      ): candidate is string =>
        typeof candidate === 'string',
    )
    : [];
}

function projectedCount(
  value: unknown,
): number {
  return (
    typeof value === 'number'
    && Number.isFinite(value)
  )
    ? value
    : 0;
}

function readResumePointer(
  value: unknown,
): HomeResumePointer {
  if (!isRecord(value)) {
    return {};
  }

  return {
    unit_id:
      projectedString(value.unit_id)
      ?? undefined,
    study_map_id:
      projectedString(value.study_map_id)
      ?? undefined,
    stage_id:
      projectedString(value.stage_id)
      ?? undefined,
    module_id:
      projectedString(value.module_id)
      ?? undefined,
  };
}

function firstProjectedModuleId(
  value: unknown,
): string | null {
  for (
    const candidate of
    projectedRecords(value)
  ) {
    const moduleId =
      projectedString(candidate.module_id);

    if (moduleId) {
      return moduleId;
    }
  }

  return null;
}

/**
 * Home is the quiet starting point for a real working day.
 *
 * It deliberately avoids a catalogue, progress dashboard, or coordination
 * report. One resumable session is primary; a few time-sensitive items and a
 * few other places to continue remain reachable underneath it.
 */
export class HomeView extends ItemView {
  private readonly plugin: HomePlugin;

  constructor(
    leaf: WorkspaceLeaf,
    plugin: HomePlugin,
  ) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_HOME;
  }

  getDisplayText(): string {
    return 'LearningOS · Home';
  }

  getIcon(): string {
    return 'home';
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  greeting(): string {
    const hour = new Date().getHours();

    if (hour < 12) {
      return 'Good morning';
    }

    if (hour < 18) {
      return 'Good afternoon';
    }

    return 'Good evening';
  }

  render(): void {
    const root = this.contentEl;

    root.empty();
    root.addClass(
      'los-root',
      'los-home',
    );

    if (!this.plugin.store.ready) {
      pageHeader(
        root,
        'LearningOS',
        'Projection unavailable',
      );

      empty(
        root,
        'The interface contract could not be loaded',
        this.plugin.store.error,
        'Rebuild views',
        () => this.plugin.generate(),
      );

      return;
    }

    const header = pageHeader(
      root,
      'Home',
      this.greeting(),
      'Resume what matters without rebuilding the context first.',
    );

    header.addClass('los-home-header');

    const actions = header.createDiv({
      cls:
        'los-actions los-home-header-actions',
    });

    button(
      actions,
      'Capture',
      () => this.plugin.openCapture(),
      'quiet',
    );

    const search = button(
      actions,
      'Search',
      () => this.plugin.openGlobalSearch(),
      'quiet',
    );

    search.setAttribute(
      'aria-label',
      'Search LearningOS',
    );

    this.renderContinue(root);
    this.renderToday(root);
    this.renderElsewhere(root);
  }

  /** The one filled action on Home. */
  renderContinue(
    root: HTMLElement,
  ): void {
    const pointer = readResumePointer(
      this.plugin.store.data?.resume_pointer,
    );

    const unit = pointer.unit_id
      ? this.plugin.store.get(pointer.unit_id)
      : null;

    const map = pointer.study_map_id
      ? this.plugin.store.get(
        pointer.study_map_id,
      )
      : null;

    const stage = pointer.stage_id
      ? this.plugin.store.stage(
        pointer.stage_id,
      )
      : null;

    const wrap = root.createDiv({
      cls: 'los-continue',
    });

    if (
      !unit
      || !stage
      || !pointer.unit_id
      || !pointer.stage_id
    ) {
      empty(
        wrap,
        'Nothing to resume yet',
        'Open Learn and choose a module or project.',
        'Open Learn',
        () => this.plugin.openLearn(),
      );

      return;
    }

    wrap.createDiv({
      cls: 'los-kicker',
      text: 'Continue learning',
    });

    const body = wrap.createDiv({
      cls: 'los-continue-body',
    });

    const copy = body.createDiv({
      cls: 'los-continue-copy',
    });

    const unitModuleId =
      projectedString(unit.module_id);

    const module = unitModuleId
      ? this.plugin.store.get(unitModuleId)
      : null;

    copy.createDiv({
      cls: 'los-continue-module',
      text: `${
        module
          ? projectedLabel(module)
          : unitModuleId ?? 'Unknown module'
      } · ${projectedLabel(unit)}`,
    });

    copy.createEl('h2', {
      text: projectedLabel(stage),
    });

    const stages =
      projectedRecords(map?.stages);

    const position = stages.findIndex(
      (row: ProjectionRecord) =>
        projectedString(row.id)
        === pointer.stage_id,
    );

    const meta = copy.createDiv({
      cls: 'los-continue-meta',
    });

    if (stages.length) {
      meta.createSpan({
        text:
          `Stage ${
            position >= 0
              ? position + 1
              : 1
          } of ${stages.length}`,
      });
    }

    const estimate = projectedText(
      stage.estimate_minutes,
    );

    if (estimate) {
      meta.createSpan({
        text: `${estimate} min planned`,
      });
    }

    copy.createDiv({
      cls: 'los-continue-context',
      text:
        'Your selected stage, exact resources, and open working state are kept together.',
    });

    const actions = body.createDiv({
      cls: 'los-actions',
    });

    button(
      actions,
      'Continue session',
      () =>
        this.plugin.openUnit(
          pointer.unit_id as string,
          pointer.stage_id as string,
        ),
      'cta',
    );
  }

  renderToday(
    root: HTMLElement,
  ): void {
    const sectionEl = section(
      root,
      'Today',
      'Only items likely to affect the next decision.',
    );

    const items: HomeItem[] = [];

    const today =
      new Date().toISOString().slice(0, 10);

    const upcoming =
      this.plugin.store
        .rows('academic_deadlines')
        .filter(
          (row: ProjectionRecord) => {
            const boundary =
              projectedString(row.end_date)
              ?? projectedString(
                row.start_date,
              )
              ?? '';

            return boundary >= today;
          },
        )
        .sort(
          (
            left: ProjectionRecord,
            right: ProjectionRecord,
          ) => {
            const leftDate =
              projectedString(
                left.start_date,
              )
              ?? projectedString(
                left.end_date,
              )
              ?? '';

            const rightDate =
              projectedString(
                right.start_date,
              )
              ?? projectedString(
                right.end_date,
              )
              ?? '';

            return leftDate.localeCompare(
              rightDate,
            );
          },
        );

    for (
      const deadline of upcoming.slice(0, 2)
    ) {
      const moduleId =
        projectedString(deadline.module_id)
        ?? firstProjectedModuleId(
          deadline.modules,
        );

      const kind =
        projectedString(deadline.kind);

      const label =
        projectedString(deadline.label);

      const title =
        kind === 'registration-window'
          ? label
            ?? projectedLabel(deadline)
          : projectedString(deadline.title)
            ?? label
            ?? projectedLabel(deadline);

      const startDate =
        projectedString(deadline.start_date);

      const endDate =
        projectedString(deadline.end_date);

      const date =
        endDate
        && startDate
        && endDate !== startDate
          ? `${startDate} → ${endDate}`
          : startDate
            ?? endDate
            ?? 'Date pending';

      const registrationState =
        projectedString(
          deadline.registration_state,
        );

      const registrationDetail =
        registrationState
        && registrationState !== 'registered'
          ? ` · ${registrationState}`
          : '';

      items.push({
        title,
        detail:
          `${date}${registrationDetail}`,
        actionLabel:
          moduleId
            ? 'Open module'
            : '',
        action:
          moduleId
            ? () =>
              this.plugin.openModule(
                moduleId,
              )
            : null,
      });
    }

    const inbox = projectedCount(
      this.plugin.store.data?.counts
        ?.inbox_items,
    );

    const shelving =
      this.plugin.store
        .units()
        .filter(
          (row: ProjectionRecord) =>
            projectedString(row.status)
            === 'ready-to-shelve',
        )
        .length;

    const needsMap =
      this.plugin.store
        .units()
        .filter(
          (row: ProjectionRecord) => {
            const unitId =
              projectedString(row.id);

            return (
              Boolean(unitId)
              && !this.plugin.store.mapForUnit(
                unitId as string,
              )
            );
          },
        )
        .length;

    const reviewCount =
      inbox + shelving + needsMap;

    if (reviewCount) {
      const details: string[] = [];

      if (inbox) {
        details.push(`${inbox} inbox`);
      }

      if (shelving) {
        details.push(
          `${shelving} ready to shelve`,
        );
      }

      if (needsMap) {
        details.push(
          `${needsMap} without a map`,
        );
      }

      items.push({
        title:
          `${reviewCount} decision${
            reviewCount === 1
              ? ''
              : 's'
          } waiting`,
        detail: details.join(' · '),
        actionLabel: 'Open review',
        action:
          () => this.plugin.openReview(),
      });
    }

    const garden =
      this.plugin.store.gardenEntries()[0];

    if (garden) {
      items.push({
        title: projectedLabel(garden),
        detail: 'Recent Garden capture',
        actionLabel: 'Open Garden',
        action:
          () => this.plugin.openGarden(),
      });
    }

    if (!items.length) {
      empty(
        sectionEl,
        'Nothing time-sensitive',
        'Continue the active learning session when you are ready.',
      );

      return;
    }

    const list = sectionEl.createDiv({
      cls: 'los-home-list',
    });

    for (
      const item of items.slice(0, 4)
    ) {
      this.renderHomeRow(
        list,
        item,
      );
    }
  }

  renderElsewhere(
    root: HTMLElement,
  ): void {
    const sectionEl = section(
      root,
      'Continue elsewhere',
      'Other active modules and projects, kept secondary to the current session.',
    );

    const pointer = readResumePointer(
      this.plugin.store.data?.resume_pointer,
    );

    const rows: ElsewhereRow[] = [];

    for (
      const record of
      this.plugin.store.modules()
    ) {
      const recordId =
        projectedString(record.id);

      if (
        !recordId
        || recordId === pointer.module_id
      ) {
        continue;
      }

      const status =
        projectedString(record.status);

      if (
        status
        && ['complete', 'archived']
          .includes(status)
      ) {
        continue;
      }

      rows.push({
        record,
        type:
          projectedString(record.kind)
          === 'skill'
            ? 'Skill'
            : 'Module',
        open:
          () =>
            this.plugin.openModule(
              recordId,
            ),
      });
    }

    for (
      const record of
      this.plugin.store.projects()
    ) {
      const recordId =
        projectedString(record.id);

      if (!recordId) {
        continue;
      }

      const status =
        projectedString(record.status);

      if (
        status
        && ['completed', 'archived']
          .includes(status)
      ) {
        continue;
      }

      rows.push({
        record,
        type: 'Project',
        open:
          () =>
            this.plugin.openProject(
              recordId,
            ),
      });
    }

    const visibleRows = rows.slice(0, 5);

    if (!visibleRows.length) {
      empty(
        sectionEl,
        'No other active work',
        'New modules and projects will appear here when projected.',
      );

      return;
    }

    const list = sectionEl.createDiv({
      cls: 'los-home-list',
    });

    for (const row of visibleRows) {
      const nextAction =
        row.type === 'Project'
          ? ''
          : this.moduleNextAction(
            row.record,
          );

      this.renderHomeRow(
        list,
        {
          title: projectedLabel(
            row.record,
          ),
          detail:
            `${row.type}${
              nextAction
                ? ` · ${nextAction}`
                : ''
            }`,
          actionLabel: 'Open',
          action: row.open,
        },
      );
    }
  }

  renderHomeRow(
    parent: HTMLElement,
    item: HomeItem,
  ): HTMLElement {
    const row = parent.createDiv({
      cls: 'los-home-row',
    });

    const copy = row.createDiv({
      cls: 'los-home-row-copy',
    });

    copy.createEl('strong', {
      text: item.title,
    });

    if (item.detail) {
      copy.createDiv({
        cls: 'los-micro',
        text: item.detail,
      });
    }

    if (
      item.actionLabel
      && item.action
    ) {
      button(
        row,
        item.actionLabel,
        item.action,
        'tertiary',
      );
    }

    return row;
  }

  nextWorkspaceDate(
    workspace: ProjectionRecord,
  ): string {
    const directDeadline =
      projectedString(workspace.deadline);

    if (directDeadline) {
      return directDeadline;
    }

    const moduleIds = new Set<string>(
      projectedStrings(
        workspace.module_ids,
      ),
    );

    const dates: string[] = [];

    for (
      const row of
      this.plugin.store.rows(
        'academic_deadlines',
      )
    ) {
      const kind =
        projectedString(row.kind);

      const moduleId =
        projectedString(row.module_id);

      const startDate =
        projectedString(row.start_date);

      if (
        kind === 'exam'
        && moduleId
        && startDate
        && moduleIds.has(moduleId)
      ) {
        dates.push(startDate);
      }

      if (
        kind === 'registration-window'
        && startDate
        && projectedRecords(
          row.modules,
        ).some(
          (module: ProjectionRecord) => {
            const nestedModuleId =
              projectedString(
                module.module_id,
              );

            return (
              Boolean(nestedModuleId)
              && moduleIds.has(
                nestedModuleId as string,
              )
            );
          },
        )
      ) {
        dates.push(startDate);
      }
    }

    return (
      dates.sort()[0]
      ?? '9999'
    );
  }

  moduleNextAction(
    module: ProjectionRecord,
  ): string {
    const moduleId =
      projectedString(module.id);

    if (!moduleId) {
      return '';
    }

    const workspace =
      this.plugin.store
        .of('workspace')
        .filter(
          (row: ProjectionRecord) => {
            const status =
              projectedString(row.status);

            return (
              row.archived !== true
              && status !== 'complete'
              && projectedStrings(
                row.module_ids,
              ).includes(moduleId)
            );
          },
        )
        .sort(
          (
            left: ProjectionRecord,
            right: ProjectionRecord,
          ) =>
            this.nextWorkspaceDate(left)
              .localeCompare(
                this.nextWorkspaceDate(
                  right,
                ),
              ),
        )[0];

    if (workspace?.next_action) {
      return projectedExcerpt(
        workspace.next_action,
        100,
      );
    }

    for (
      const unit of
      this.plugin.store.unitsFor(moduleId)
    ) {
      const unitId =
        projectedString(unit.id);

      if (!unitId) {
        continue;
      }

      const map =
        this.plugin.store.mapForUnit(
          unitId,
        );

      if (!map) {
        continue;
      }

      const stages =
        projectedRecords(map.stages);

      const currentStageId =
        projectedString(
          map.current_stage,
        );

      const stage =
        (
          currentStageId
            ? stages.find(
              (row: ProjectionRecord) =>
                projectedString(row.id)
                === currentStageId,
            )
            : undefined
        )
        ?? stages.find(
          (row: ProjectionRecord) =>
            projectedString(row.status)
            === 'active',
        )
        ?? stages.find(
          (row: ProjectionRecord) =>
            projectedString(row.status)
            !== 'complete',
        );

      const stageTitle =
        stage
          ? projectedString(stage.title)
          : null;

      if (stageTitle) {
        return stageTitle;
      }
    }

    return '';
  }
}
