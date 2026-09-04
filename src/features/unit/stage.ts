import type { UnitStageHost } from './ports';
import {
  button,
  chip,
  empty,
  overflowMenu,
} from '../../components';
import type { ProjectionRecord } from '../../contracts/manifest';
import {
  asString as projectedString,
} from '../../projection/readers';
import {
  type UnitRecordView,
  type StageRecordView,
  type StudyMapView,
} from './model';
import {
  currentWorkResource,
  renderResourceRow,
  triageSummary,
  type StageResourceView,
} from '../stage-resources';
import { readMaterialOptions } from './model';
import { MaterialComparisonModal } from './material-drawer';

export function renderStage(
  view: UnitStageHost,

    layout: HTMLElement,
    unit: UnitRecordView,
    studyMap: StudyMapView,
    stage: StageRecordView,
  ): void {
    const expectedRevisions = view.plugin.store.artifactGuard(
      unit.id,
      typeof studyMap.record.id === 'string' ? studyMap.record.id : null,
    );
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

    /* Figma 14:553 — one accent eyebrow carrying position and state, in that
     * order, as ` · `-joined clauses. The three separate lines this replaces
     * (kicker, title, "Selected · ordered after X") spent a third of the card
     * head restating the rail. */
    const eyebrow = [
      `Stage ${stagePosition} of ${studyMap.stages.length}`,
      stage.examCritical ? 'exam-critical' : '',
      stageState.toLowerCase(),
      stage.estimateMinutes
        ? `${stage.estimateMinutes} min`
        : '',
    ].filter(Boolean);

    headingCopy.createDiv({
      cls: 'los-kicker',
      text: eyebrow.join(' · '),
    });

    headingCopy.createEl('h2', {
      text: stage.title,
    });

    /* Not in 14:551, which goes straight from the title to the concept chips.
     * Kept as a quiet lede rather than dropped: the objective is authored
     * content, and only some plans restate it in their first done-when. */
    if (stage.objective) {
      headingCopy.createEl('p', {
        cls: 'los-stage-objective',
        text: stage.objective,
      });
    }

    /* 14:555 — "a typed pointer to another record" (Chip, 2:46). The label
     * comes from the concept record; an id with no record is not rendered,
     * because a raw `concept-foo` slug is not a name. */
    const conceptRecords = stage.concepts.flatMap(
      (conceptId) => {
        const record =
          view.plugin.store.get(conceptId);

        return record ? [record] : [];
      },
    );

    if (conceptRecords.length) {
      const concepts = center.createDiv({
        cls: 'los-stage-concepts',
      });

      for (const record of conceptRecords) {
        chip(
          concepts,
          record,
          (target) =>
            view.plugin.nav.openRecord(target),
        );
      }
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

    /* One current action, and everything else one click away.
     *
     * The screen used to expand every resource at once, so a required reading
     * and a reference book arrived at the same weight and the learner did the
     * triage the producer had already done. Figma 05 keeps the target and the
     * completion criteria, promotes the single required action, and moves the
     * catalogue into a comparison drawer. Nothing is removed: the summary line
     * below counts every material, and the drawer lists all of them.
     *
     * DESIGN.md principle 8 holds throughout — `Complete stage` is the only
     * filled action on this screen, so `Compare all` is a plain control and the
     * current-work card carries `Open` alone. */
    const resourceRenderer = {
      emptyDetail: 'Use the unit scope and ask AI for a proposal.',
      sourceRecord: (sourceId: string) => view.plugin.store.get(sourceId),
      openSource: (source: ProjectionRecord) => {
        const sourceId = projectedString(source.id);
        return sourceId ? view.plugin.nav.openLibrary(sourceId) : undefined;
      },
      openSourceResource: (source: ProjectionRecord) =>
        view.plugin.openResource(source),
      openResource: (resource: StageResourceView) =>
        view.plugin.openResource(resource.record),
      // ADR-009: when an id exists, feedback lands on the exact resource;
      // otherwise it deliberately describes the whole source.
      rateResource: (
        sourceId: string,
        resourceId: string | null,
        verdict: string,
      ) => view.mutate(
        () => view.plugin.gateway.feedback(
          unit.id,
          stage.id,
          sourceId,
          verdict,
          resourceId,
          expectedRevisions,
        ),
      ),
    };

    const current = currentWorkResource(stage.resources);
    const requiredCount = stage.resources.filter(
      (resource) =>
        resource.scopeTriage === 'required-now' || !resource.scopeTriage,
    ).length;

    const work = center.createDiv({
      cls: 'los-section los-stage-section los-current-work',
    });
    const workHeading = work.createDiv({
      cls: 'los-stage-section-heading',
    });
    workHeading.createEl('h2', { text: 'Current work' });
    if (requiredCount) {
      workHeading.createSpan({
        cls: 'los-micro los-current-work-count',
        text: `${requiredCount} required now`,
      });
    }

    if (current) {
      const card = work.createDiv({ cls: 'los-current-work-card' });
      renderResourceRow(
        card,
        current,
        current.sourceId
          ? view.plugin.store.get(current.sourceId)
          : null,
        resourceRenderer,
      );
    } else if (stage.resources.length) {
      empty(
        work,
        'Nothing is marked required for this stage',
        'The materials below are preserved for depth and reference. Open the '
        + 'comparison to choose where to start.',
      );
    } else {
      empty(
        work,
        'No source action selected',
        'Use the unit scope and ask AI for a proposal.',
      );
    }

    if (stage.resources.length) {
      const catalogue = center.createDiv({
        cls: 'los-section los-stage-materials',
      });
      const catalogueCopy = catalogue.createDiv({
        cls: 'los-stage-materials-copy',
      });
      catalogueCopy.createEl('h2', {
        text: `All ${stage.resources.length} `
          + `${stage.resources.length === 1 ? 'material' : 'materials'}`,
      });
      catalogueCopy.createSpan({
        cls: 'los-micro los-stage-materials-summary',
        text: triageSummary(stage.resources),
      });

      const catalogueActions = catalogue.createDiv({
        cls: 'los-actions los-stage-materials-actions',
      });
      button(
        catalogueActions,
        'Compare all',
        () => {
          const sourceMap = view.plugin.store.sourceMap(unit.moduleId);
          new MaterialComparisonModal(view.app, {
            plugin: view.plugin,
            unit,
            stage,
            resources: stage.resources,
            materialOptions: readMaterialOptions(
              sourceMap?.sources,
              unit.id,
              unit.record.source_selections,
            ),
            expectedRevisions,
            renderer: resourceRenderer,
            onChanged: () => view.render(),
          }).open();
        },
      );
    }

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
      expectedRevisions,
    );
  }

export function renderActionBar(
  view: UnitStageHost,

    root: HTMLElement,
    unit: UnitRecordView,
    stage: StageRecordView,
    expectedRevisions: Readonly<Record<string, number>>,
  ): void {
    const bar = root.createDiv({
      cls: 'los-unit-actionbar',
    });

    /* Figma 05 puts the completion rule beside the completion action, where it
     * is read at the moment it applies. Derived from the criteria the producer
     * authored — the interface never invents a finishing condition, and says
     * nothing at all when the stage declares none. */
    if (stage.doneWhen.length) {
      bar.createSpan({
        cls: 'los-micro los-unit-actionbar-rule',
        text: stage.doneWhen.length === 1
          ? 'Finish only when the criterion above is true.'
          : stage.doneWhen.length === 2
            ? 'Finish only when both criteria are true.'
            : `Finish only when all ${stage.doneWhen.length} criteria are true.`,
      });
    }

    /* 14:600 — the primary action and one overflow, left-aligned at the foot
     * of the stage card. It is `cta` rather than `success` because Figma's
     * Primary is bg/accent: green here would have been a second decisive
     * colour on a screen that already has one. */
    button(
      bar,
      'Complete stage',
      () => view.mutate(
        () =>
          view.plugin.gateway.progress(
            unit.id,
            stage.id,
            'complete',
            expectedRevisions,
          ),
        () =>
          view.plugin.clearDoneWhen(
            unit.id,
            stage.id,
          ),
      ),
      'cta',
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
              expectedRevisions,
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
              expectedRevisions,
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
              expectedRevisions,
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
              expectedRevisions,
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
    ];

    overflowMenu(
      bar,
      menuItems,
      'More unit actions',
    );
  }
