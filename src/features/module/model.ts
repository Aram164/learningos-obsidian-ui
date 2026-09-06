import { compareStrings } from '../../sorting';
import type { ProjectionRecord } from '../../contracts/manifest';
import type { AppSurface } from '../../app/surface';
import type { AppNavigator } from '../../app/navigator';
import {
  asCount as projectedCount,
  asRecords as projectedRecords,
  asString as projectedString,
  asStrings as projectedStrings,
  asText as projectedText,
  isRecord,
} from '../../projection/readers';

export const MODULE_TABS = [
  ['overview', 'Overview'],
  ['units', 'Units'],
  ['resources', 'Resources'],
  ['logistics', 'Logistics'],
] as const;

export type ModuleScreen =
  | 'groups'
  | 'list'
  | 'detail';

export type ModuleTab =
  (typeof MODULE_TABS)[number][0];

export interface ModuleViewState {
  readonly screen: ModuleScreen;
  readonly groupId: string | null;
  readonly query: string;
  readonly moduleId: string | null;
  readonly componentId: string | null;
  readonly tab: ModuleTab | null;
}

export interface ParsedModuleViewState {
  readonly screen: ModuleScreen;
  readonly groupId: string | null;
  readonly query: string;
  readonly moduleId: string | null;
  readonly componentId?: string | null | undefined;
  readonly tab?: ModuleTab | null | undefined;
  readonly hasComponentId: boolean;
  readonly hasTab: boolean;
}

export interface ThematicGroupView {
  readonly id: string;
  readonly title: string;
  readonly description: string;
}

export interface ModuleComponentView {
  readonly id: string;
  readonly title: string;
}

export interface ModuleExaminationView {
  readonly type: string | null;
  readonly notes: string | null;
}

export interface ModuleRecordView {
  readonly record: ProjectionRecord;
  readonly id: string;
  readonly areaId: string;
  readonly title: string;
  readonly kind: string;
  readonly code: string;
  readonly semester: string;
  readonly status: string;
  readonly institution: string;
  readonly credits: string | null;
  readonly examination: ModuleExaminationView;
  readonly components: ModuleComponentView[];
  readonly unitOrder: string[];
}

export interface UnitRecordView {
  readonly record: ProjectionRecord;
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly order: number;
}

export interface ModuleProgressView {
  readonly stagesComplete: number;
  readonly stagesTotal: number;
  readonly unitsTotal: number;
}

export interface DeadlineModuleView {
  readonly moduleId: string;
  readonly action: string | null;
}

export interface AcademicDeadlineView {
  readonly record: ProjectionRecord;
  readonly kind: string;
  readonly label: string;
  readonly title: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly time: string | null;
  readonly registrationState: string;
  readonly directModuleId: string | null;
  readonly modules: DeadlineModuleView[];
}

export interface SourceEntryView {
  readonly record: ProjectionRecord;
  readonly role: string;
  readonly sourceId: string | null;
  readonly why: string;
  readonly unitRouteCount: number;
}

export type ModulePlugin = Pick<
  AppSurface,
  | 'router'
  | 'store'
> & {
  readonly nav: Pick<
    AppNavigator,
    | 'back'
    | 'openLibrary'
    | 'openModule'
    | 'openModuleDetail'
    | 'openUnit'
  >;
};

export function nonNull<T>(
  value: T | null,
): value is T {
  return value !== null;
}

export function isModuleScreen(
  value: unknown,
): value is ModuleScreen {
  return (
    value === 'groups'
    || value === 'list'
    || value === 'detail'
  );
}

export function isModuleTab(
  value: unknown,
): value is ModuleTab {
  return MODULE_TABS.some(
    ([tab]) => tab === value,
  );
}

export function readModuleViewState(
  value: unknown,
): ParsedModuleViewState {
  if (!isRecord(value)) {
    return {
      screen: 'groups',
      groupId: null,
      query: '',
      moduleId: null,
      hasComponentId: false,
      hasTab: false,
    };
  }

  const moduleId =
    projectedString(value.moduleId);

  const screen = isModuleScreen(
    value.screen,
  )
    ? value.screen
    : moduleId
      ? 'detail'
      : 'groups';

  const hasComponentId =
    Object.prototype.hasOwnProperty.call(
      value,
      'componentId',
    );

  const hasTab =
    Object.prototype.hasOwnProperty.call(
      value,
      'tab',
    );

  const componentId =
    !hasComponentId
      ? undefined
      : value.componentId === null
        ? null
        : projectedString(
          value.componentId,
        );

  const tab =
    !hasTab
      ? undefined
      : value.tab === null
        ? null
        : isModuleTab(value.tab)
          ? value.tab
          : null;

  return {
    screen,
    groupId:
      projectedString(value.groupId),
    query:
      typeof value.query === 'string'
        ? value.query
        : '',
    moduleId,
    componentId,
    tab,
    hasComponentId,
    hasTab,
  };
}

export function readThematicGroup(
  record: ProjectionRecord | null,
): ThematicGroupView | null {
  if (!record) {
    return null;
  }

  const id = projectedString(record.id);

  if (!id) {
    return null;
  }

  return {
    id,
    title:
      projectedString(record.title)
      ?? projectedString(record.label)
      ?? id,
    description:
      projectedText(record.description)
      ?? '',
  };
}

export function readComponents(
  value: unknown,
): ModuleComponentView[] {
  return projectedRecords(value)
    .map((record): ModuleComponentView | null => {
      const id = projectedString(record.id);

      if (!id) {
        return null;
      }

      return {
        id,
        title:
          projectedString(record.short_title)
          ?? projectedString(record.title)
          ?? id,
      };
    })
    .filter(nonNull);
}

export function readExamination(
  value: unknown,
): ModuleExaminationView {
  const examination = isRecord(value)
    ? value
    : {};

  return {
    type:
      projectedString(examination.type),
    notes:
      projectedText(examination.notes),
  };
}

export function readModuleRecord(
  record: ProjectionRecord | null,
  fallbackId: string | null = null,
): ModuleRecordView | null {
  if (!record) {
    return null;
  }

  const id =
    projectedString(record.id)
    ?? fallbackId;

  if (!id) {
    return null;
  }

  return {
    record,
    id,
    areaId:
      projectedString(record.area_id)
      ?? '',
    title:
      projectedString(record.title)
      ?? id,
    kind:
      projectedString(record.kind)
      ?? 'Module',
    code:
      projectedText(record.code)
      ?? '',
    semester:
      projectedText(record.semester)
      ?? '',
    status:
      projectedString(record.status)
      ?? 'unspecified',
    institution:
      projectedText(record.institution)
      ?? '',
    credits:
      projectedText(record.credits),
    examination:
      readExamination(record.examination),
    components:
      readComponents(record.components),
    unitOrder:
      projectedStrings(record.unit_order),
  };
}

export function normalizeUnitRecord(
  record: ProjectionRecord,
): UnitRecordView | null {
  const id = projectedString(record.id);

  if (!id) {
    return null;
  }

  const title =
    projectedString(record.title)
    ?? id;

  const status =
    projectedString(record.status)
    ?? 'unspecified';

  const order =
    projectedCount(record.order);

  const normalized: ProjectionRecord = {
    ...record,
    id,
    title,
    status,
    scope:
      projectedText(record.scope)
      ?? '',
  };

  return {
    record: normalized,
    id,
    title,
    status,
    order,
  };
}

export function orderModuleUnits(
  module: ModuleRecordView,
  units: readonly UnitRecordView[],
): UnitRecordView[] {
  const authoredOrder = new Map(
    module.unitOrder.map(
      (unitId, index) => [unitId, index],
    ),
  );

  return [...units].sort(
    (left, right) => {
      const leftRank = authoredOrder.get(left.id);
      const rightRank = authoredOrder.get(right.id);

      if (
        leftRank !== undefined
        || rightRank !== undefined
      ) {
        return (
          (leftRank ?? Number.MAX_SAFE_INTEGER)
          - (rightRank ?? Number.MAX_SAFE_INTEGER)
        );
      }

      return (
        left.order - right.order
        || compareStrings(left.title, right.title)
      );
    },
  );
}

export function normalizeWorkspaceRecord(
  record: ProjectionRecord,
): ProjectionRecord {
  return {
    ...record,
    id:
      projectedString(record.id)
      ?? '',
    title:
      projectedString(record.title)
      ?? projectedString(record.id)
      ?? 'Workspace',
    status:
      projectedString(record.status)
      ?? 'unspecified',
    objective:
      projectedText(record.objective)
      ?? '',
    next_action:
      projectedText(record.next_action)
      ?? '',
    deadline:
      projectedText(record.deadline)
      ?? '',
    standing:
      record.standing === true,
    module_ids:
      projectedStrings(record.module_ids),
    unit_ids:
      projectedStrings(record.unit_ids),
  };
}

export function readProgress(
  value: unknown,
): ModuleProgressView {
  const progress = isRecord(value)
    ? value
    : {};

  return {
    stagesComplete:
      projectedCount(
        progress.stages_complete,
      ),
    stagesTotal:
      projectedCount(
        progress.stages_total,
      ),
    unitsTotal:
      projectedCount(
        progress.units_total,
      ),
  };
}

export function readDeadlineModules(
  value: unknown,
): DeadlineModuleView[] {
  return projectedRecords(value)
    .map((record): DeadlineModuleView | null => {
      const moduleId =
        projectedString(record.module_id);

      if (!moduleId) {
        return null;
      }

      return {
        moduleId,
        action:
          projectedText(record.action),
      };
    })
    .filter(nonNull);
}

export function readAcademicDeadline(
  record: ProjectionRecord,
): AcademicDeadlineView {
  const startDate =
    projectedString(record.start_date)
    ?? '';

  const endDate =
    projectedString(record.end_date)
    ?? '';

  return {
    record,
    kind:
      projectedString(record.kind)
      ?? 'academic-date',
    label:
      projectedString(record.label)
      ?? projectedString(record.title)
      ?? 'Academic date',
    title:
      projectedString(record.title)
      ?? '',
    startDate,
    endDate,
    time:
      projectedText(record.time),
    registrationState:
      projectedString(
        record.registration_state,
      )
      ?? 'unregistered',
    directModuleId:
      projectedString(record.module_id),
    modules:
      readDeadlineModules(record.modules),
  };
}

export function readSourceEntries(
  value: unknown,
): SourceEntryView[] {
  return projectedRecords(value)
    .map((record): SourceEntryView => ({
      record,
      role:
        projectedString(record.role)
        ?? 'unassigned',
      sourceId:
        projectedString(record.source_id),
      why:
        projectedText(record.why)
        ?? '',
      unitRouteCount:
        Array.isArray(record.unit_routes)
          ? record.unit_routes.length
          : 0,
    }));
}
