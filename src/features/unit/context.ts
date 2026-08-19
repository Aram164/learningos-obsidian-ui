import { Notice } from 'obsidian';
import type { UnitView } from '../../views/unit-view';
import {
  badge,
  button,
  chip,
  disclosure,
  empty,
  icon,
  overflowMenu,
  pageHeader,
  section,
} from '../../components';
import type { ProjectionRecord } from '../../contracts/manifest';
import {
  asLabel as projectedLabel,
  asRecords as projectedRecords,
  asString as projectedString,
  asStrings as projectedStrings,
  asText as projectedText,
  isRecord,
} from '../../projection/readers';
import {
  type UnitRecordView,
  type StageRecordView,
  type ResourceRecordView,
  type StudyMapView,
  readUnitRecord,
  readStage,
  readStudyMap,
  readArtifacts,
  artifactLabel,
  fallbackRecord,
  errorMessage,
} from './model';

export function renderStageContext(
  view: UnitView,

    center: HTMLElement,
    unit: UnitRecordView,
    studyMap: StudyMapView,
    stage: StageRecordView,
  ): void {
    const detours =
      studyMap.detours.filter(
        (row) =>
          projectedString(
            row.spawned_by_stage,
          ) === stage.id
          && projectedString(
            row.status,
          ) !== 'resolved'
          && projectedString(
            row.id,
          ) !== null,
      );

    if (
      !stage.attachments.length
      && !detours.length
      && !stage.sourceFeedback.length
    ) {
      return;
    }

    const detail = disclosure(
      center,
      'Stage context',
    );

    for (
      const attachment
      of stage.attachments
    ) {
      button(
        detail,
        attachment.label,
        () =>
          view.plugin.openAuthoredPath(
            attachment.path,
          ),
        'quiet',
      );
    }

    for (const detour of detours) {
      const detourId =
        projectedString(detour.id);

      if (!detourId) {
        continue;
      }

      const title =
        projectedString(detour.title)
        ?? 'Prerequisite detour';

      const classification =
        projectedString(
          detour.classification,
        )
        ?? 'required-now';

      const row = detail.createDiv({
        cls: 'los-detour-row',
      });

      row.createEl('strong', {
        text:
          'Open prerequisite detour',
      });

      row.createEl('p', {
        text:
          `${title} · ${
            classification
          } · returns here`,
      });

      button(
        row,
        'Resolve and return',
        () => view.mutate(
          () =>
            view.plugin.gateway
              .resolveDetour(
                unit.id,
                detourId,
                'Resolved from the unit workspace.',
              ),
        ),
        'quiet',
      );
    }

    for (
      const feedback
      of stage.sourceFeedback
    ) {
      const sourceId =
        projectedString(
          feedback.source_id,
        )
        ?? 'Unknown source';

      const value =
        projectedText(
          feedback.feedback,
        )
        ?? 'Feedback recorded';

      detail.createDiv({
        cls: 'los-row',
        text:
          `${sourceId} · ${value}`,
      });
    }
  }

export function renderArtifacts(
  view: UnitView,

    root: HTMLElement,
    unit: UnitRecordView,
  ): void {
    const wrap = section(
      root,
      'Unit artifacts',
      'Durable notes remain globally canonical; this unit owns stable references.',
    );

    const artifacts =
      readArtifacts(
        unit.record.artifacts,
      );

    let count = 0;

    for (
      const [key, id]
      of artifacts.named
    ) {
      count += 1;

      const card = wrap.createDiv({
        cls: 'los-artifact-card',
      });

      card.createEl('h3', {
        text: artifactLabel(key),
      });

      const record =
        view.plugin.store.get(id)
        ?? fallbackRecord(id);

      chip(
        card,
        record,
        (
          selected: ProjectionRecord,
        ) =>
          view.plugin.openRecord(
            selected,
          ),
      );
    }

    for (const id of artifacts.other) {
      count += 1;

      const record =
        view.plugin.store.get(id)
        ?? fallbackRecord(id);

      chip(
        wrap,
        record,
        (
          selected: ProjectionRecord,
        ) =>
          view.plugin.openRecord(
            selected,
          ),
      );
    }

    if (!count) {
      empty(
        wrap,
        'No durable artifact linked yet',
        'Working notes stay with the stage until shelving is approved.',
      );
    }
  }
