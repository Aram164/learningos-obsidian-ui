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

export const PROJECT_TABS = [
  ['structure', 'Structure'],
  ['decisions', 'Decisions'],
  ['linked-materials', 'Materials'],
  ['files', 'Files'],
  ['overview', 'Logistics'],
] as const;

export type ProjectScreen =
  | 'list'
  | 'detail';

export type ProjectTab =
  (typeof PROJECT_TABS)[number][0];

export interface ProjectViewState {
  readonly screen?: ProjectScreen | undefined;
  readonly projectId?: string | null | undefined;
  readonly tab?: ProjectTab | undefined;
  readonly query?: string | undefined;
}

export interface ProjectBoundaries {
  readonly confidentiality: string;
  readonly externalCodeAccess: string;
  readonly notes: string | null;
}

export interface ProjectStructure {
  readonly kind: string;
  readonly nodes: ProjectionRecord[];
}

export interface ProjectRelationship {
  readonly id: string;
  readonly toId: string;
  readonly toType: string;
  readonly relationType: string;
  readonly reason: string;
  readonly contribution: string;
  readonly path: string | null;
}

export type ProjectPlugin = Pick<
  LearningOSUI,
  | 'back'
  | 'openAuthoredPath'
  | 'openProject'
  | 'openProjects'
  | 'openRecord'
  | 'openUnit'
  | 'router'
  | 'store'
>;

export type ProjectLinkPlugin = Pick<
  ProjectPlugin,
  | 'openAuthoredPath'
  | 'openRecord'
  | 'router'
  | 'store'
>;

export function isProjectTab(
  value: unknown,
): value is ProjectTab {
  return PROJECT_TABS.some(
    ([tab]) => tab === value,
  );
}

export function readProjectViewState(
  value: unknown,
): ProjectViewState {
  if (!isRecord(value)) {
    return {};
  }

  const screen: ProjectScreen | undefined =
    value.screen === 'detail'
      ? 'detail'
      : value.screen === 'list'
        ? 'list'
        : undefined;

  const projectId =
    value.projectId === null
      ? null
      : projectedString(value.projectId)
        ?? undefined;

  const tab = isProjectTab(value.tab)
    ? value.tab
    : undefined;

  const query =
    typeof value.query === 'string'
      ? value.query
      : undefined;

  return {
    screen,
    projectId,
    tab,
    query,
  };
}

export function readProjectBoundaries(
  value: unknown,
): ProjectBoundaries {
  const boundaries = isRecord(value)
    ? value
    : {};

  return {
    confidentiality:
      projectedString(
        boundaries.confidentiality,
      )
      ?? 'unspecified',
    externalCodeAccess:
      projectedString(
        boundaries.external_code_access,
      )
      ?? 'unspecified',
    notes:
      projectedString(boundaries.notes),
  };
}

export function readProjectStructure(
  value: unknown,
): ProjectStructure {
  const structure = isRecord(value)
    ? value
    : {};

  return {
    kind:
      projectedString(structure.kind)
      ?? 'none',
    nodes:
      projectedRecords(structure.nodes),
  };
}

export function readProjectRelationship(
  value: ProjectionRecord,
): ProjectRelationship | null {
  const id = projectedString(value.id);
  const toId = projectedString(value.to_id);

  if (!id || !toId) {
    return null;
  }

  return {
    id,
    toId,
    toType:
      projectedString(value.to_type)
      ?? 'record',
    relationType:
      projectedString(value.relation_type)
      ?? 'linked',
    reason:
      projectedString(value.reason)
      ?? 'No rationale was projected.',
    contribution:
      projectedString(value.contribution)
      ?? 'No contribution was projected.',
    path:
      projectedString(value.path),
  };
}

