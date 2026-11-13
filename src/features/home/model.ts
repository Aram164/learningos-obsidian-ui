import type { ProjectionRecord } from '../../contracts/manifest';
import type { AppSurface } from '../../app/surface';
import type { AppNavigator } from '../../app/navigator';
import {
  asRecords as projectedRecords,
  asString as projectedString,
  isRecord,
} from '../../projection/readers';

export interface HomeItem {
  readonly title: string;
  readonly detail: string;
  readonly actionLabel: string;
  readonly action: (() => unknown) | null;
}

export interface ElsewhereRow {
  readonly record: ProjectionRecord;
  readonly type: string;
  readonly open: () => unknown;
}

export interface HomeResumePointer {
  readonly unit_id?: string | undefined;
  readonly study_map_id?: string | undefined;
  readonly stage_id?: string | undefined;
  readonly module_id?: string | undefined;
}

export type HomePlugin = Pick<
  AppSurface,
  | 'generate'
  | 'settings'
  | 'store'
> & {
  readonly nav: Pick<
    AppNavigator,
    | 'openCapture'
    | 'openGlobalSearch'
    | 'openLearn'
    | 'openModule'
    | 'openProject'
    | 'openReview'
    | 'openUnit'
  >;
};

export function readResumePointer(
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

export interface ResolvedResumeTarget {
  readonly pointer: HomeResumePointer;
  readonly unit: ProjectionRecord | null;
  readonly map: ProjectionRecord | null;
  readonly unitMap: ProjectionRecord | null;
  readonly stage: ProjectionRecord | null;
  readonly moduleId: string | null;
  readonly module: ProjectionRecord | null;
}

export function resolveResumeTarget(store: {
  readonly data?: { readonly resume_pointer?: unknown } | null;
  get(id: string): ProjectionRecord | null;
  stage(id: string): ProjectionRecord | null;
  mapForUnit(id: string): ProjectionRecord | null;
}): ResolvedResumeTarget {
  const pointer = readResumePointer(store.data?.resume_pointer);
  const unit = pointer.unit_id ? store.get(pointer.unit_id) : null;
  const map = pointer.study_map_id ? store.get(pointer.study_map_id) : null;
  const unitMap = pointer.unit_id ? store.mapForUnit(pointer.unit_id) : null;
  const stage = pointer.stage_id ? store.stage(pointer.stage_id) : null;
  const moduleId = unit ? projectedString(unit.module_id) : null;
  const module = moduleId ? store.get(moduleId) : null;
  return { pointer, unit, map, unitMap, stage, moduleId, module };
}

export function firstProjectedModuleId(
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

