import type { UnitView } from '../../views/unit-view';
import {
  button,
  disclosure,
  empty,
  pageHeader,
  section,
} from '../../components';
import {
  asLabel as projectedLabel,
  asString as projectedString,
} from '../../projection/readers';
import {
  type UnitRecordView,
  type StageRecordView,
  type StudyMapView,
  readUnitRecord,
  readStudyMap,
  readMaterialOptions,
} from './model';
import { renderMaterialOverview } from './materials';

export function render(
  view: UnitView,
): void {
    const root = view.contentEl;

    root.empty();
    root.addClass(
      'los-root',
      'los-unit-view',
    );

    const routeUnitId =
      view.unitId;

    const projectedUnit =
      routeUnitId
        ? view.plugin.store.get(
          routeUnitId,
        )
        : null;

    const unit = readUnitRecord(
      projectedUnit,
      routeUnitId,
    );

    if (!unit) {
      empty(
        root,
        'Unit unavailable',
        'Return to its module.',
      );

      return;
    }

    const module =
      view.plugin.store.get(
        unit.moduleId,
      );

    const project =
      view.plugin.store.projectForUnit(
        unit.record,
      );

    const ownerLabel =
      projectedLabel(
        project,
        projectedLabel(
          module,
          unit.moduleId,
        ),
      );

    const header = pageHeader(
      root,
      `${ownerLabel} · ${unit.kind}`,
      unit.title,
      unit.scope,
    );

    const headerActions =
      header.createDiv({
        cls: 'los-actions',
      });

    if (project) {
      button(
        headerActions,
        'Back to project',
        () => view.plugin.nav.back(),
        'quiet',
      );
    } else {
      button(
        headerActions,
        'Back to module',
        () => view.plugin.nav.openModule(
          unit.moduleId,
        ),
        'quiet',
      );
    }

    const sourceMap =
      view.plugin.store.sourceMap(
        unit.moduleId,
      );

    const materialOptions =
      readMaterialOptions(
        sourceMap?.sources,
        unit.id,
        unit.record.source_selections,
      );

    const hasMaterialOverview =
      unit.knowledgeNodes.length > 0
      && materialOptions.length > 0;

    if (hasMaterialOverview) {
      renderMaterialOverview(
        view,
        root,
        unit,
        materialOptions,
      );
    }

    const projectedStudyMap =
      view.plugin.store.mapForUnit(
        unit.id,
      );

    if (!projectedStudyMap) {
      const missing = section(
        root,
        hasMaterialOverview
          ? 'Personal study path (optional)'
          : 'Study map needed',
      );

      const projectId =
        projectedString(project?.id)
        ?? undefined;

      const componentId =
        unit.componentId
        ?? undefined;

      empty(
        missing,
        hasMaterialOverview
          ? 'No personal path selected'
          : 'This unit has no current study script',
        hasMaterialOverview
          ? 'The material menu above is complete. Create a path only when you want progress tracking for choices you make.'
          : 'AI may propose a scoped map; the core imports it only after review.',
        hasMaterialOverview
          ? 'Build optional path with AI'
          : 'Create map with AI',
        () => view.plugin.askAiScoped(
          hasMaterialOverview
            ? 'Propose an optional personal study-map JSON document using only materials I choose from this unit material overview. Do not replace or summarize the overview, and do not write files; include exact source actions and done-when criteria.'
            : 'Propose one study-map JSON document for this unit. Do not write files; include exact source actions and done-when criteria.',
          {
            moduleId: unit.moduleId,
            projectId,
            unitId: unit.id,
            componentId,
          },
        ),
      );

      view.renderArtifacts(
        root,
        unit,
      );

      return;
    }

    const studyMap =
      readStudyMap(
        projectedStudyMap,
      );

    /* Deriving the first stage here rather than testing `.length` is what lets
     * the compiler carry "this map has stages" through the rest of the render;
     * the two conditions are equivalent. */
    const firstStage = studyMap.stages[0];

    if (!firstStage) {
      const bare = section(
        root,
        'Study map needs stages',
      );

      empty(
        bare,
        'This study map has no stages yet',
        'Stage authoring belongs to the core — import a map or add stages there, then rebuild views.',
      );

      view.renderArtifacts(
        root,
        unit,
      );

      return;
    }

    const stageIds = new Set(
      studyMap.stages.map(
        (stage) => stage.id,
      ),
    );

    if (
      !view.stageId
      || !stageIds.has(view.stageId)
    ) {
      view.stageId =
        (
          studyMap.currentStageId
          && stageIds.has(
            studyMap.currentStageId,
          )
        )
          ? studyMap.currentStageId
          : firstStage.id;

      view.plugin.setSelectedStage(
        unit.id,
        view.stageId,
      );
    }

    const stage =
      studyMap.stages.find(
        (candidate) =>
          candidate.id
          === view.stageId,
      )
      ?? firstStage;

    const completeStageCount =
      studyMap.stages.filter(
        (candidate) =>
          candidate.status === 'complete',
      ).length;

    header.createDiv({
      cls: 'los-unit-route-summary',
      text:
        `${studyMap.stages.length} ordered stages · ${completeStageCount} complete · Current focus: ${stage.title}`,
    });

    const layout = root.createDiv({
      cls: 'los-unit-layout',
    });

    view.renderRail(
      layout,
      unit,
      studyMap,
      stage,
    );

    view.renderStage(
      layout,
      unit,
      studyMap,
      stage,
    );

    const more = disclosure(
      root,
      'Unit artifacts and evidence',
      'los-unit-extras',
    );

    view.renderArtifacts(
      more,
      unit,
    );
  }

export function renderRail(
  view: UnitView,

    layout: HTMLElement,
    unit: UnitRecordView,
    studyMap: StudyMapView,
    current: StageRecordView,
  ): void {
    const rail = layout.createDiv({
      cls: 'los-stage-rail',
    });

    rail.setAttr(
      'aria-label',
      'Ordered learning stages',
    );

    const completedCount =
      studyMap.stages.filter(
        (stage) =>
          stage.status === 'complete',
      ).length;

    const progressPercent =
      Math.round(
        (
          completedCount
          / studyMap.stages.length
        ) * 100,
      );

    const summary = rail.createDiv({
      cls: 'los-stage-rail-summary',
    });

    summary.createEl('h2', {
      text: 'Learning route',
    });

    const progressCopy = summary.createDiv({
      cls: 'los-stage-progress-copy',
    });

    progressCopy.createSpan({
      text:
        `${completedCount} of ${studyMap.stages.length} complete`,
    });

    progressCopy.createSpan({
      cls: 'los-micro',
      text: `${progressPercent}%`,
    });

    const progress = summary.createDiv({
      cls: 'los-stage-progress',
      attr: {
        role: 'progressbar',
        'aria-label': 'Overall learning route progress',
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-valuenow': String(
          progressPercent,
        ),
      },
    });

    const progressValue = progress.createDiv({
      cls: 'los-stage-progress-value',
    });

    progressValue.style.width =
      `${progressPercent}%`;

    const stageList = rail.createDiv({
      cls: 'los-stage-list',
      attr: {
        role: 'list',
      },
    });

    const currentIndex = studyMap.stages.findIndex(
      (stage) => stage.id === current.id,
    );

    for (
      const [index, stage]
      of studyMap.stages.entries()
    ) {
      const selected =
        stage.id === current.id;

      const row = stageList.createEl(
        'button',
        {
          cls:
            `los-stage-row los-s-${stage.status} ${
              selected
                ? 'is-selected'
                : index > currentIndex
                  ? 'is-upcoming'
                  : 'is-before'
            } is-clickable`,
          attr: {
            type: 'button',
            role: 'listitem',
            'aria-posinset': String(
              index + 1,
            ),
            'aria-setsize': String(
              studyMap.stages.length,
            ),
            'aria-current':
              selected
                ? 'step'
                : 'false',
          },
        },
      );

      row.createSpan({
        cls: 'los-stage-index',
        text:
          String(index + 1)
            .padStart(2, '0'),
      });

      const copy = row.createSpan({
        cls: 'los-stage-copy',
      });

      copy.createSpan({
        text: stage.title,
      });

      const marker =
        stage.status === 'complete'
          ? 'Complete'
          : stage.status === 'skipped'
            ? 'Skipped'
            : index === currentIndex
              ? `Done when · ${stage.doneWhen.length} criteria`
              : index > currentIndex
                ? 'Not started'
                : '';

      if (marker) {
        copy.createSpan({
          cls: 'los-micro',
          text: marker,
        });
      }

      row.addEventListener(
        'click',
        () => {
          void view.selectStage(
            stage.id,
          );
        },
      );
    }

    const stageRecords =
      studyMap.stages.map(
        (stage) => stage.record,
      );

    const add = button(
      rail,
      'Add note',
      () => view.plugin.openUnitNote(
        unit.record,
        studyMap.record,
      ),
      'quiet',
    );

    add.addClass(
      'los-add-unit-note',
    );

    const draft =
      view.plugin.getUnitNoteDraft(
        unit.id,
        stageRecords,
      );

    if (
      typeof draft.text === 'string'
      && draft.text.trim()
    ) {
      rail.createDiv({
        cls:
          'los-micro los-unit-note-draft',
        text:
          'Unsaved unit-note draft kept locally.',
      });
    }
  }
