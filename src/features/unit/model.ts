import type { ProjectionRecord } from '../../contracts/manifest';
import type { AppSurface } from '../../app/surface';
import type { AppNavigator } from '../../app/navigator';
import type { StageResourceView } from '../stage-resources';
import {
  asFiniteNumber,
  asRecords as projectedRecords,
  asString as projectedString,
  asStrings as projectedStrings,
  asText as projectedText,
  isRecord,
} from '../../projection/readers';

export const ARTIFACT_LABELS = [
  [
    'ultimate_reference',
    'Ultimate Reference',
  ],
  [
    'exercise_bank',
    'Exercise Bank',
  ],
  [
    'mock_exam',
    'Mock Exam',
  ],
] as const;

export interface ParsedUnitViewState {
  readonly unitId?: string | undefined;
  readonly stageId?: string | null | undefined;
  readonly hasStageId: boolean;
}

export interface UnitRecordView {
  readonly record: ProjectionRecord;
  readonly id: string;
  readonly moduleId: string;
  readonly componentId: string | null;
  readonly kind: string;
  readonly title: string;
  readonly scope: string;
  readonly knowledgeSummary: string;
  readonly knowledgeNodes: KnowledgeNodeView[];
  /**
   * Whether the producer still owes this unit an ordered study map
   * (OPERATOR.md rule 6). Derived core-side from module and unit status, never
   * re-derived here — the interface reports the obligation, it does not decide
   * it, so the badge, the count and the Review queue cannot drift apart.
   */
  readonly needsStudyMap: boolean;
}

export interface KnowledgeNodeView {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly buildsOn: string[];
}

export interface MaterialOptionView {
  readonly record: ProjectionRecord;
  readonly title: string;
  readonly format: string;
  readonly angle: string;
  readonly covers: string[];
  readonly depth: string;
  readonly scope: string;
  readonly locator: string | null;
  readonly sourceId: string | null;
  readonly canOpen: boolean;
  readonly canChoose: boolean;
  readonly selected: boolean;
}

export interface StageRecordView {
  readonly record: ProjectionRecord;
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly scopeTriage: string;
  readonly objective: string | null;
  readonly estimateMinutes: string | null;
  readonly examCritical: boolean;
  readonly resources: ResourceRecordView[];
  readonly doneWhen: string[];
  readonly attachments: StageAttachmentView[];
  readonly sourceFeedback: ProjectionRecord[];
}

export type ResourceRecordView = StageResourceView;

export interface StudyMapView {
  readonly record: ProjectionRecord;
  readonly currentStageId: string | null;
  readonly stages: StageRecordView[];
  readonly detours: ProjectionRecord[];
  /**
   * The creation template this map was authored from, or `null` for one that
   * predates plan-template v1. Null rather than 0: "no template" and
   * "template zero" are different claims and the label depends on it.
   */
  readonly planTemplateVersion: number | null;
}

export interface StageAttachmentView {
  readonly path: string;
  readonly label: string;
}

export interface ArtifactSet {
  readonly named: ReadonlyArray<
    readonly [string, string]
  >;
  readonly other: string[];
}

export type UnitPlugin = Pick<
  AppSurface,
  | 'askAiScoped'
  | 'clearDoneWhen'
  | 'gateway'
  | 'getDoneWhen'
  | 'getSelectedStage'
  | 'getUnitNoteDraft'
  | 'mutate'
  | 'openAuthoredPath'
  | 'openResource'
  | 'openUnitNote'
  | 'reviewSessionEnd'
  | 'setDoneWhen'
  | 'setSelectedStage'
  | 'settings'
  | 'store'
> & {
  readonly nav: Pick<
    AppNavigator,
    | 'back'
    | 'openLibrary'
    | 'openModule'
    | 'openRecord'
    | 'openShelving'
  >;
};

export function errorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : String(error);
}

export function readUnitViewState(
  value: unknown,
): ParsedUnitViewState {
  if (!isRecord(value)) {
    return {
      hasStageId: false,
    };
  }

  const hasStageId =
    Object.prototype.hasOwnProperty.call(
      value,
      'stageId',
    );

  const unitId =
    projectedString(value.unitId)
    ?? undefined;

  const stageId = !hasStageId
    ? undefined
    : value.stageId === null
      ? null
      : projectedString(value.stageId);

  return {
    unitId,
    stageId,
    hasStageId,
  };
}

export function readUnitRecord(
  record: ProjectionRecord | null,
  fallbackId: string | null,
): UnitRecordView | null {
  if (!record) {
    return null;
  }

  const id =
    projectedString(record.id)
    ?? fallbackId;

  const moduleId =
    projectedString(record.module_id);

  if (!id || !moduleId) {
    return null;
  }

  const knowledgeMap = isRecord(
    record.knowledge_map,
  )
    ? record.knowledge_map
    : null;

  const knowledgeNodes = projectedRecords(
    knowledgeMap?.nodes,
  )
    .map((node): KnowledgeNodeView | null => {
      const nodeId = projectedString(node.id);
      const title = projectedString(node.title);
      const summary = projectedText(node.summary);

      if (!nodeId || !title || !summary) {
        return null;
      }

      return {
        id: nodeId,
        title,
        summary,
        buildsOn: projectedStrings(
          node.builds_on,
        ),
      };
    })
    .filter(
      (
        node,
      ): node is KnowledgeNodeView =>
        node !== null,
    );

  return {
    record,
    id,
    moduleId,
    componentId:
      projectedString(record.component_id),
    kind:
      projectedString(record.kind)
      ?? 'unit',
    title:
      projectedString(record.title)
      ?? id,
    scope:
      projectedText(record.scope)
      ?? '',
    knowledgeSummary:
      projectedText(
        knowledgeMap?.summary,
      )
      ?? '',
    knowledgeNodes,
    needsStudyMap:
      record.needs_study_map === true,
  };
}

export function readMaterialOptions(
  value: unknown,
  unitId: string,
  selectionsValue: unknown,
): MaterialOptionView[] {
  const options: MaterialOptionView[] = [];
  const selectionKeys = new Set(
    projectedRecords(selectionsValue)
      .flatMap((selection) => {
        const sourceId = projectedString(selection.source_id);
        const locator = projectedText(selection.locator);
        return sourceId && locator
          ? [`${sourceId}\u0000${locator}`]
          : [];
      }),
  );

  for (const entry of projectedRecords(value)) {
    for (
      const route
      of projectedRecords(entry.unit_routes)
    ) {
      if (
        projectedString(route.unit_id)
        !== unitId
      ) {
        continue;
      }

      const title = projectedString(route.title);
      const format = projectedString(route.format);
      const angle = projectedText(route.angle);

      if (!title || !format || !angle) {
        continue;
      }

      const sourceId =
        projectedString(route.source_id)
        ?? projectedString(entry.source_id);
      const locator =
        projectedText(route.locator);

      options.push({
        record: route,
        title,
        format,
        angle,
        covers:
          projectedStrings(route.covers),
        depth:
          projectedString(route.depth)
          ?? 'course-aligned',
        scope:
          projectedString(route.scope)
          ?? 'complementary',
        locator,
        sourceId,
        canOpen: Boolean(
          projectedString(
            route.material_path,
          )
          ?? projectedString(route.url)
          ?? projectedString(
            route.vault_path,
          ),
        ),
        canChoose: Boolean(sourceId && locator),
        selected: Boolean(
          sourceId
          && locator
          && selectionKeys.has(
            `${sourceId}\u0000${locator}`,
          ),
        ),
      });
    }
  }

  return options;
}

export function readResource(
  record: ProjectionRecord,
): ResourceRecordView {
  const label =
    projectedString(record.label)
    ?? projectedString(record.title)
    ?? projectedString(record.source_id)
    ?? 'Resource';

  return {
    record,
    id:
      projectedString(record.id),
    kind:
      projectedString(record.kind)
      ?? 'read',
    label,
    locator:
      projectedText(record.locator),
    sourceId:
      projectedString(record.source_id),
    scopeTriage:
      projectedString(record.scope_triage),
    canOpen: Boolean(
      projectedString(record.material_path)
      ?? projectedString(record.url)
      ?? projectedString(record.vault_path),
    ),
  };
}

export function readStageAttachment(
  value: unknown,
): StageAttachmentView | null {
  if (typeof value === 'string') {
    if (!value.length) {
      return null;
    }

    return {
      path: value,
      label:
        value.split('/').pop()
        || value,
    };
  }

  if (!isRecord(value)) {
    return null;
  }

  const path =
    projectedString(value.path)
    ?? projectedString(value.vault_path);

  if (!path) {
    return null;
  }

  return {
    path,
    label:
      projectedString(value.label)
      ?? path,
  };
}

export function readStage(
  record: ProjectionRecord,
): StageRecordView | null {
  const id =
    projectedString(record.id);

  if (!id) {
    return null;
  }

  const attachments = Array.isArray(
    record.attachments,
  )
    ? record.attachments
      .map(readStageAttachment)
      .filter(
        (
          attachment,
        ): attachment is StageAttachmentView =>
          attachment !== null,
      )
    : [];

  return {
    record,
    id,
    title:
      projectedString(record.title)
      ?? id,
    status:
      projectedString(record.status)
      ?? 'active',
    scopeTriage:
      projectedText(record.scope_triage)
      ?? '',
    objective:
      projectedText(record.objective),
    estimateMinutes:
      projectedText(record.estimate_minutes),
    examCritical:
      record.exam_critical === true,
    resources:
      projectedRecords(
        record.resources,
      ).map(readResource),
    doneWhen:
      projectedStrings(
        record.done_when,
      ).filter(
        (criterion) =>
          Boolean(criterion.trim()),
      ),
    attachments,
    sourceFeedback:
      projectedRecords(
        record.source_feedback,
      ),
  };
}

export function readStudyMap(
  record: ProjectionRecord,
): StudyMapView {
  const stages = projectedRecords(
    record.stages,
  )
    .map(readStage)
    .filter(
      (
        stage,
      ): stage is StageRecordView =>
        stage !== null,
    );

  return {
    record,
    currentStageId:
      projectedString(
        record.current_stage,
      ),
    stages,
    detours:
      projectedRecords(record.detours),
    planTemplateVersion:
      asFiniteNumber(
        record.plan_template_version,
      ),
  };
}

export function readArtifacts(
  value: unknown,
): ArtifactSet {
  if (!isRecord(value)) {
    return {
      named: [],
      other: [],
    };
  }

  const named: Array<
    readonly [string, string]
  > = [];

  for (
    const [key] of ARTIFACT_LABELS
  ) {
    const id =
      projectedString(value[key]);

    if (id) {
      named.push([key, id]);
    }
  }

  return {
    named,
    other:
      projectedStrings(value.other),
  };
}

export function artifactLabel(
  key: string,
): string {
  return (
    ARTIFACT_LABELS.find(
      ([candidate]) =>
        candidate === key,
    )?.[1]
    ?? key
  );
}

export function fallbackRecord(
  id: string,
): ProjectionRecord {
  return {
    id,
    type: 'record',
    title: id,
  };
}
