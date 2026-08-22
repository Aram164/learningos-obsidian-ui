import type { UnitView } from '../../views/unit-view';
import {
  badge,
  button,
  overflowMenu,
} from '../../components';
import {
  asString as projectedString,
} from '../../projection/readers';
import {
  type UnitRecordView,
  type StageRecordView,
  type StudyMapView,
} from './model';
import { renderStageResources } from '../stage-resources';

export function renderStage(
  view: UnitView,

    layout: HTMLElement,
    unit: UnitRecordView,
    studyMap: StudyMapView,
    stage: StageRecordView,
  ): void {
    const center = layout.createDiv({
      cls: 'los-stage-workspace',
    });

    const top = center.createDiv({
      cls: 'los-stage-heading',
    });

    const stageIndex =
      studyMap.stages.findIndex(
        (candidate) =>
          candidate.id === stage.id,
      );

    const stagePosition =
      Math.max(stageIndex, 0) + 1;

    const previousStage =
      stageIndex > 0
        ? studyMap.stages[
          stageIndex - 1
        ]
        : null;

    const stageState =
      stage.status === 'complete'
        ? 'Complete'
        : stage.status === 'skipped'
          ? 'Skipped'
          : stage.id
              === studyMap.currentStageId
            ? 'Current'
            : 'Selected';

    const headingRow = top.createDiv({
      cls: 'los-stage-heading-row',
    });

    const headingCopy = headingRow.createDiv({
      cls: 'los-stage-heading-copy',
    });

    headingCopy.createDiv({
      cls: 'los-kicker',
      text:
        stage.examCritical
          ? `Exam-critical · Stage ${String(stagePosition).padStart(2, '0')} of ${studyMap.stages.length}`
          : `Stage ${String(stagePosition).padStart(2, '0')} of ${studyMap.stages.length}`,
    });

    headingCopy.createEl('h2', {
      text: stage.title,
    });

    headingCopy.createDiv({
      cls: 'los-stage-order-context',
      text:
        previousStage
          ? `${stageState} · ordered after ${previousStage.title}`
          : `${stageState} · first stage in the ordered route`,
    });

    if (stage.estimateMinutes) {
      badge(
        headingRow,
        `${stage.estimateMinutes} min`,
        'role',
      );
    }

    if (stage.objective) {
      const goal = center.createDiv({
        cls: 'los-stage-goal',
      });

      goal.createDiv({
        cls: 'los-kicker',
        text: 'Goal',
      });

      goal.createEl('p', {
        text: stage.objective,
      });
    }

    if (stage.doneWhen.length) {
      const marks =
        view.plugin.getDoneWhen(
          unit.id,
          stage.id,
        );

      const checkedCount =
        stage.doneWhen.reduce(
          (
            count,
            _criterion,
            index,
          ) =>
            count
            + (
              marks[index]
                ? 1
                : 0
            ),
          0,
        );

      const done = center.createDiv({
        cls:
          'los-section los-stage-section',
      });

      const doneHeading = done.createDiv({
        cls: 'los-stage-section-heading',
      });

      doneHeading.createEl('h2', {
        text: 'Done when',
      });

      doneHeading.createSpan({
        cls: 'los-micro',
        text:
          `${checkedCount} of ${stage.doneWhen.length}`,
      });

      const list = done.createDiv({
        cls: 'los-donewhen-list',
      });

      for (
        const [index, criterion]
        of stage.doneWhen.entries()
      ) {
        const row = list.createEl(
          'label',
          {
            cls: 'los-donewhen-row',
          },
        );

        const box = row.createEl(
          'input',
          {
            attr: {
              type: 'checkbox',
              'aria-label': criterion,
            },
          },
        );

        const checked =
          Boolean(marks[index]);

        if (checked) {
          box.setAttr(
            'checked',
            'checked',
          );
        }

        box.checked = checked;

        box.addEventListener(
          'change',
          () => {
            const nextChecked =
              Boolean(box.checked);

            view.plugin.setDoneWhen(
              unit.id,
              stage.id,
              index,
              nextChecked,
            );

            row.toggleClass(
              'is-checked',
              nextChecked,
            );
          },
        );

        row.toggleClass(
          'is-checked',
          checked,
        );

        row.createSpan({
          text: criterion,
        });
      }
    }

    renderStageResources(center, stage.resources, {
      emptyDetail: 'Use the unit scope and ask AI for a proposal.',
      sourceRecord: (sourceId) => view.plugin.store.get(sourceId),
      openSource: (source) => {
        const sourceId = projectedString(source.id);
        return sourceId ? view.plugin.nav.openLibrary(sourceId) : undefined;
      },
      openSourceResource: (source) => view.plugin.openResource(source),
      openResource: (resource) => view.plugin.openResource(resource.record),
      // ADR-009: when an id exists, feedback lands on the exact resource;
      // otherwise it deliberately describes the whole source.
      rateResource: (sourceId, resourceId, verdict) => view.mutate(
        () => view.plugin.gateway.feedback(
          unit.id,
          stage.id,
          sourceId,
          verdict,
          resourceId,
        ),
      ),
    });

    view.renderStageContext(
      center,
      unit,
      studyMap,
      stage,
    );

    view.renderActionBar(
      center,
      unit,
      stage,
    );
  }

export function renderActionBar(
  view: UnitView,

    root: HTMLElement,
    unit: UnitRecordView,
    stage: StageRecordView,
  ): void {
    const bar = root.createDiv({
      cls: 'los-unit-actionbar',
    });

    bar.createDiv({
      cls: 'los-unit-action-note',
      text:
        'Progress saves locally until the stage is completed.',
    });

    button(
      bar,
      'Mark complete',
      () => view.mutate(
        () =>
          view.plugin.gateway.progress(
            unit.id,
            stage.id,
            'complete',
          ),
        () =>
          view.plugin.clearDoneWhen(
            unit.id,
            stage.id,
          ),
      ),
      'success',
    );

    const menuItems: Array<
      [string, () => unknown] | false
    > = [
      stage.status !== 'active'
      && [
        'Revisit stage',
        () => view.mutate(
          () =>
            view.plugin.gateway.progress(
              unit.id,
              stage.id,
              'revisit',
            ),
        ),
      ],
      [
        'Pause unit',
        () => view.mutate(
          () =>
            view.plugin.gateway.progress(
              unit.id,
              stage.id,
              'paused',
            ),
        ),
      ],
      [
        'Skip stage',
        () => view.mutate(
          () =>
            view.plugin.gateway.progress(
              unit.id,
              stage.id,
              'skipped',
            ),
        ),
      ],
      [
        'Report prerequisite gap',
        () => view.mutate(
          () =>
            view.plugin.gateway.detour(
              unit.id,
              stage.id,
              'Prerequisite gap',
              'required-now',
            ),
        ),
      ],
      [
        'Prepare shelving',
        () =>
          view.plugin.nav.openShelving(
            unit.id,
          ),
      ],
      view.plugin.settings
        .showAiRecommendation
      && [
        'Ask AI with stage context',
        () => {
          const project =
            view.plugin.store
              .projectForUnit(
                unit.record,
              );

          const projectId =
            projectedString(project?.id)
            ?? undefined;

          return view.plugin.askAiScoped(
            'Help with this stage. Treat the active file as supplementary context only.',
            {
              moduleId:
                unit.moduleId,
              projectId,
              unitId:
                unit.id,
              stageId:
                stage.id,
            },
          );
        },
      ],
      [
        'End learning session',
        () =>
          view.plugin
            .reviewSessionEnd(),
      ],
    ];

    overflowMenu(
      bar,
      menuItems,
      'More unit actions',
    );
  }
