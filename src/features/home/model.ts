import type { ProjectionRecord } from '../../contracts/manifest';
import type { AppSurface } from '../../app/surface';
import type { AppNavigator } from '../../app/navigator';
import { compareStrings } from '../../sorting';
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
  | 'router'
  | 'store'
> & {
  readonly nav: Pick<
    AppNavigator,
    | 'openCapture'
    | 'openGlobalSearch'
    | 'openLearn'
    | 'openModule'
    | 'openModules'
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

export function candidateModules(store: {
  get(id: string): ProjectionRecord | null;
  rows(group: string): ProjectionRecord[];
}): ProjectionRecord[] {
  const seen = new Set<string>();
  const modules: ProjectionRecord[] = [];
  for (const map of store.rows('study_maps')) {
    if (map.is_study_candidate !== true) {
      continue;
    }
    const moduleId = projectedString(map.module_id);
    if (!moduleId || seen.has(moduleId)) {
      continue;
    }
    const module = store.get(moduleId);
    if (!module) {
      continue;
    }
    seen.add(moduleId);
    modules.push(module);
  }
  return modules.sort((a, b) => compareStrings(
    projectedString(a.id) ?? '',
    projectedString(b.id) ?? '',
  ));
}

export function resolveResumeTarget(store: {
  readonly data?: { readonly resume_pointer?: unknown } | null;
  get(id: string): ProjectionRecord | null;
  stage(id: string): ProjectionRecord | null;
  mapForUnit(id: string): ProjectionRecord | null;
}): ResolvedResumeTarget {
  const pointer = readResumePointer(store.data?.resume_pointer);
  const unresolved: ResolvedResumeTarget = {
    pointer, unit: null, map: null, unitMap: null, stage: null,
    moduleId: null, module: null,
  };
  // Core owns ownership coherence; UI resolves the published IDs and guards
  // against a pointer whose study map disagrees with the unit's current map.
  if (!pointer.unit_id || !pointer.study_map_id
      || !pointer.stage_id || !pointer.module_id) {
    return unresolved;
  }
  const unit = store.get(pointer.unit_id);
  const unitMap = store.mapForUnit(pointer.unit_id);
  const map = store.get(pointer.study_map_id);
  const module = store.get(pointer.module_id);
  if (!unit || !unitMap || !map || !module
      || projectedString(unitMap.id) !== pointer.study_map_id) {
    return unresolved;
  }
  // The stage every design shows is the matched row of the validated
  // ordered map — never the flat index, whose row can disagree with it.
  const stage = projectedRecords(unitMap.stages).find(
    (row) => projectedString(row.id) === pointer.stage_id) ?? null;
  if (!stage) {
    return unresolved;
  }
  return { pointer, unit, map, unitMap, stage, moduleId: pointer.module_id, module };
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

