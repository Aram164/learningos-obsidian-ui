import type { HomeView } from '../../views/home-view';
import {
  button,
  empty,
  icon,
  pageHeader,
  projectedExcerpt,
  section,
} from '../../components';
import type { ProjectionRecord } from '../../contracts/manifest-v4';
import {
  asLabel as projectedLabel,
  asRecords as projectedRecords,
  asString as projectedString,
  asStrings as projectedStrings,
  asText as projectedText,
  isRecord,
} from '../../projection/readers';
import {
  type HomeItem,
  type ElsewhereRow,
  readResumePointer,
  firstProjectedModuleId,
} from './model';

export function renderElsewhere(
  view: HomeView,

    root: HTMLElement,
  ): void {
    const sectionEl = section(
      root,
      'Continue elsewhere',
      'Other active modules and projects, kept secondary to the current session.',
    );

    const pointer = readResumePointer(
      view.plugin.store.data?.resume_pointer,
    );

    const rows: ElsewhereRow[] = [];

    for (
      const record of
      view.plugin.store.currentSemesterModules()
    ) {
      const recordId =
        projectedString(record.id);

      if (
        !recordId
        || recordId === pointer.module_id
      ) {
        continue;
      }

      /*
       * `module.status` answers an administrative question — what the
       * university thinks — so reading it here listed dropped Algo 2 and
       * grade-pending PPDS as current work. It was also comparing against
       * 'complete' while module records use 'completed', so the filter had
       * never excluded anything at all.
       *
       * Core now derives operational state from the units and projects
       * `is_actionable`. Consuming it keeps the semantics where they belong
       * (engineering audit 2026-08-08, finding 4).
       */
      if (record.is_actionable !== true) {
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
            view.plugin.openModule(
              recordId,
            ),
      });
    }

    for (
      const record of
      view.plugin.store.projects()
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
            view.plugin.openProject(
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
          : view.moduleNextAction(
            row.record,
          );

      view.renderHomeRow(
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

export function renderHomeRow(
  view: HomeView,

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

export function nextWorkspaceDate(
  view: HomeView,

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
      view.plugin.store.rows(
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

export function moduleNextAction(
  view: HomeView,

    module: ProjectionRecord,
  ): string {
    const moduleId =
      projectedString(module.id);

    if (!moduleId) {
      return '';
    }

    const workspace =
      view.plugin.store
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
            view.nextWorkspaceDate(left)
              .localeCompare(
                view.nextWorkspaceDate(
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
      view.plugin.store.unitsFor(moduleId)
    ) {
      const unitId =
        projectedString(unit.id);

      if (!unitId) {
        continue;
      }

      const map =
        view.plugin.store.mapForUnit(
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
