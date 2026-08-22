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
import { renderLearningRouteRail } from '../learning-route';
import { UnitMapImportModal } from './map-import';
import { asPlanTemplate } from '../plan-template';

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
      /* The producer decides whether this unit is owed a map; the interface
       * only reports it. A complete material menu says what may be used, not
       * in what order or against what proof, so it never discharges the
       * obligation (OPERATOR.md rule 6). */
      const owed = unit.needsStudyMap;

      const missing = section(
        root,
        owed ? 'Study map required' : 'Personal study path (optional)',
      );

      const projectId =
        projectedString(project?.id)
        ?? undefined;

      const componentId =
        unit.componentId
        ?? undefined;

      empty(
        missing,
        owed
          ? 'This unit has no ordered study map'
          : 'No personal path selected',
        owed
          ? (hasMaterialOverview
            ? 'The material menu above says what may be used. A map says in what order and against what proof, and it is what makes progress trackable. AI may propose one; the core imports it only after review.'
            : 'AI may propose a scoped map; the core imports it only after review.')
          : 'This unit is complete, archived, or belongs to a module you are no longer studying. Create a path only if you want progress tracking anyway.',
        owed ? 'Create map with AI' : 'Build optional path with AI',
        () => view.plugin.askAiScoped(
          owed
            ? 'Propose one study-map JSON document for this unit, ordered over the materials in its overview. Do not replace or summarize the overview, and do not write files; include exact source actions and done-when criteria.'
            : 'Propose an optional personal study-map JSON document using only materials I choose from this unit material overview. Do not replace or summarize the overview, and do not write files; include exact source actions and done-when criteria.',
          {
            moduleId: unit.moduleId,
            projectId,
            unitId: unit.id,
            componentId,
          },
        ),
      );

      /* The other half of "the core imports it only after review": the place
       * to apply a map that has already been through the audit. Authoring
       * happens elsewhere; this is the gate, and it refuses anything that is
       * not on the current creation template. */
      openMapImport(
        view,
        missing,
        unit,
        false,
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

    const provenance = more.createDiv({
      cls: 'los-map-provenance',
    });

    /* A map that predates the creation template is labelled rather than shown
     * as though it conformed — the same distinction the Job plan cards make,
     * because it is the same field and the same claim. */
    provenance.createSpan({
      cls: 'los-micro',
      text:
        studyMap.planTemplateVersion === null
          ? 'This study map predates plan template v1. It stays readable; a replacement is imported from the current template.'
          : `Study map on plan template v${studyMap.planTemplateVersion}.`,
    });

    openMapImport(
      view,
      provenance,
      unit,
      true,
    );

    view.renderArtifacts(
      more,
      unit,
    );
  }

/**
 * The one place the interface applies a reviewed study map.
 *
 * It carries the file's path to `unit.map.import` and nothing else: Core reads
 * the file, checks it against the creation template and the study-map schema,
 * and refuses it whole. The SOP's coverage audit is unchanged and still
 * happens before this point.
 */
function openMapImport(
  view: UnitView,
  parent: HTMLElement,
  unit: UnitRecordView,
  replacing: boolean,
): void {
  const actions = parent.createDiv({
    cls: 'los-actions',
  });

  button(
    actions,
    replacing
      ? 'Replace with reviewed map'
      : 'Import reviewed map',
    () => new UnitMapImportModal(
      view.app,
      {
        unitId: unit.id,
        unitTitle: unit.title,
        replacing,
        template: async () => asPlanTemplate(
          await view.plugin.gateway.planTemplate(
            'curriculum',
            unit.title,
            {
              unitId: unit.id,
              moduleId: unit.moduleId,
            },
          ),
        ),
        submit: (file, replace) => view.plugin.mutate(
          () => view.plugin.gateway.importUnitMap(
            unit.id,
            file,
            replace,
          ),
        ),
      },
    ).open(),
    replacing ? 'quiet' : 'cta',
  );
}

export function renderRail(
  view: UnitView,

    layout: HTMLElement,
    unit: UnitRecordView,
    studyMap: StudyMapView,
    current: StageRecordView,
  ): void {
    const completedCount =
      studyMap.stages.filter(
        (stage) =>
          stage.status === 'complete',
      ).length;

    const currentIndex = studyMap.stages.findIndex(
      (stage) => stage.id === current.id,
    );
    const rail = renderLearningRouteRail(layout, {
      title: 'Learning route',
      ariaLabel: 'Ordered learning stages',
      progressLabel: 'Overall learning route progress',
      completed: completedCount,
      selectedId: current.id,
      items: studyMap.stages.map((stage, index) => ({
        id: stage.id,
        number: index + 1,
        title: stage.title,
        state: stage.status,
        marker: stage.status === 'complete'
          ? 'Complete'
          : stage.status === 'skipped'
            ? 'Skipped'
            : index === currentIndex
              ? `Done when · ${stage.doneWhen.length} criteria`
              : index > currentIndex
                ? 'Not started'
                : '',
      })),
      select: (stageId) => { void view.selectStage(stageId); },
    });

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
