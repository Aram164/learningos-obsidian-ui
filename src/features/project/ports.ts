import type { ProjectionRecord } from '../../contracts/manifest';
import type {
  ProjectPlugin,
  ProjectTab,
} from './model';

/** Host surface for project-owned file references. */
export interface ProjectFilesHost {
  readonly plugin: ProjectPlugin;
}

/** Host surface for the project browser. */
export interface ProjectListHost {
  readonly plugin: ProjectPlugin;
  query: string;
  selectedElementId: string | null;
}

/** Host surface for the project detail composition. */
export interface ProjectDetailHost {
  readonly plugin: ProjectPlugin;
  readonly projectId: string | null;
  readonly tab: ProjectTab;
  renderBoundaryBanner(
    root: HTMLElement,
    project: ProjectionRecord,
  ): void;
  renderDecisions(
    root: HTMLElement,
    project: ProjectionRecord,
  ): void;
  renderFiles(
    root: HTMLElement,
    project: ProjectionRecord,
  ): void;
  renderLinked(
    root: HTMLElement,
    project: ProjectionRecord,
  ): void;
  renderOverview(
    root: HTMLElement,
    project: ProjectionRecord,
  ): void;
  renderStructure(
    root: HTMLElement,
    project: ProjectionRecord,
  ): void;
}
