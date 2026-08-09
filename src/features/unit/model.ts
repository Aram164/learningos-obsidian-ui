import type { ProjectionRecord } from '../../contracts/manifest-v4';
import type { LearningOSUI } from '../../main';
import {
  asCount as projectedCount,
  asLabel as projectedLabel,
  asListLength as projectedListLength,
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

export interface ResourceRecordView {
  readonly record: ProjectionRecord;
  readonly id: string | null;
  readonly kind: string;
  readonly label: string;
  readonly locator: string | null;
  readonly sourceId: string | null;
  readonly scopeTriage: string | null;
  readonly canOpen: boolean;
}

export interface StudyMapView {
  readonly record: ProjectionRecord;
  readonly currentStageId: string | null;
  readonly stages: StageRecordView[];
  readonly detours: ProjectionRecord[];
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
  LearningOSUI,
  | 'askAiScoped'
  | 'back'
  | 'clearDoneWhen'
  | 'gateway'
  | 'getDoneWhen'
  | 'getSelectedStage'
  | 'getUnitNoteDraft'
  | 'mutate'
  | 'openAuthoredPath'
  | 'openLibrary'
  | 'openModule'
  | 'openRecord'
  | 'openResource'
  | 'openShelving'
  | 'openUnitNote'
  | 'reviewSessionEnd'
  | 'setDoneWhen'
  | 'setSelectedStage'
  | 'settings'
  | 'store'
>;

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
  };
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

