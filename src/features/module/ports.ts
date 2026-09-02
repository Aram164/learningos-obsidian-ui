import type { WorkspaceLeaf } from 'obsidian';
import type {
  AcademicDeadlineView,
  ModulePlugin,
  ModuleRecordView,
  ModuleTab,
} from './model';

/** Host surface for module selection and source actions. */
export interface ModuleActionsHost {
  readonly plugin: ModulePlugin;
  readonly leaf: WorkspaceLeaf;
  readonly moduleId: string | null;
  componentId: string | null;
  tab: ModuleTab | null;
}

/** Host surface for the module detail composition. */
export interface ModuleDetailHost {
  readonly plugin: ModulePlugin;
  readonly moduleId: string | null;
  readonly componentId: string | null;
  readonly tab: ModuleTab | null;
  selectedElementId: string | null;
  deadlinesFor(
    module: ModuleRecordView,
  ): AcademicDeadlineView[];
  defaultTab(
    module: ModuleRecordView,
  ): ModuleTab;
  headline(
    module: ModuleRecordView,
  ): string;
  renderDeadlineRows(
    wrap: HTMLElement,
    module: ModuleRecordView,
    rows: readonly AcademicDeadlineView[],
  ): void;
  renderLogistics(
    root: HTMLElement,
    module: ModuleRecordView,
  ): void;
  renderOverview(
    root: HTMLElement,
    module: ModuleRecordView,
  ): void;
  renderSources(
    root: HTMLElement,
    module: ModuleRecordView,
  ): void;
  renderUnits(
    root: HTMLElement,
    module: ModuleRecordView,
  ): void;
  selectComponent(
    componentId: string | null,
  ): Promise<void>;
  selectTab(
    tab: ModuleTab,
  ): Promise<void>;
}

/** Host surface for module logistics and academic dates. */
export interface ModuleLogisticsHost {
  readonly plugin: ModulePlugin;
  deadlinesFor(
    module: ModuleRecordView,
  ): AcademicDeadlineView[];
  renderAcademicDates(
    root: HTMLElement,
    module: ModuleRecordView,
  ): void;
  renderDeadlineRows(
    wrap: HTMLElement,
    module: ModuleRecordView,
    rows: readonly AcademicDeadlineView[],
  ): void;
}

/** Host surface for module list navigation. */
export interface ModuleNavigationHost {
  readonly plugin: ModulePlugin;
  readonly groupId: string | null;
  query: string;
  selectedElementId: string | null;
  render(): void;
}
