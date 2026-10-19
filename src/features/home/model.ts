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

