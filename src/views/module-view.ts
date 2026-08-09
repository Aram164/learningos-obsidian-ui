import { selectTab, selectComponent, renderSources } from '../features/module/actions';
import { renderLogistics, deadlinesFor, renderAcademicDates, renderDeadlineRows } from '../features/module/logistics';
import { renderModuleDetail, headline, renderOverview, renderUnits } from '../features/module/detail';
import { renderGroups, renderGroupList } from '../features/module/navigation';
import {
  ItemView,
  type WorkspaceLeaf,
} from 'obsidian';
import {
  badge,
  button,
  chip,
  disclosure,
  empty,
  pageHeader,
  section,
  workspaceCard,
} from '../components';
import {
  STATUS_ORDER,
  VIEW_MODULE,
} from '../constants';
import type {
  ProjectionRecord,
} from '../contracts/manifest-v4';
import type { LearningOSUI } from '../main';
import {
  asCount as projectedCount,
  asRecords as projectedRecords,
  asString as projectedString,
  asStrings as projectedStrings,
  asText as projectedText,
  isRecord,
} from '../projection/readers';

import {
  MODULE_TABS,
  ModuleScreen,
  ModuleTab,
  ModuleViewState,
  ParsedModuleViewState,
  ThematicGroupView,
  ModuleComponentView,
  ModuleExaminationView,
  ModuleRecordView,
  UnitRecordView,
  ModuleProgressView,
  DeadlineModuleView,
  AcademicDeadlineView,
  SourceEntryView,
  ModulePlugin,
  nonNull,
  isModuleScreen,
  isModuleTab,
  readModuleViewState,
  readThematicGroup,
  readComponents,
  readExamination,
  readModuleRecord,
  normalizeUnitRecord,
  normalizeWorkspaceRecord,
  readProgress,
  readDeadlineModules,
  readAcademicDeadline,
  readSourceEntries,
} from '../features/module/model';

/**
 * Four tabs, because a module page was four pages wearing one coat: learning
 * work, resources, and administration each have their own reading mode. Units
 * is the default — the learner is here to study, not to check a credit count.
 */
export class ModuleView extends ItemView {
  readonly plugin: ModulePlugin;

  screen: ModuleScreen;
  groupId: string | null;
  query: string;
  moduleId: string | null;
  componentId: string | null;
  tab: ModuleTab | null;

  selectedElementId: string | null;

  constructor(
    leaf: WorkspaceLeaf,
    plugin: ModulePlugin,
  ) {
    super(leaf);

    this.plugin = plugin;
    this.screen = 'groups';
    this.groupId = null;
    this.query = '';
    this.moduleId = null;
    this.componentId = null;
    this.tab = null;
    this.selectedElementId = null;
  }

  getViewType(): string {
    return VIEW_MODULE;
  }

  getDisplayText(): string {
    return 'LearningOS · Modules';
  }

  async setState(
    state: unknown = {},
  ): Promise<void> {
    const parsed =
      readModuleViewState(state);

    const nextModuleId =
      parsed.moduleId;

    if (nextModuleId !== this.moduleId) {
      this.componentId = null;
      this.tab = null;
    }

    this.screen = parsed.screen;
    this.groupId = parsed.groupId;
    this.query = parsed.query;
    this.moduleId = nextModuleId;

    if (parsed.hasComponentId) {
      this.componentId =
        parsed.componentId
        ?? null;
    }

    if (parsed.hasTab) {
      this.tab =
        parsed.tab
        ?? null;
    }

    this.render();
  }

  getState(): ModuleViewState {
    return {
      screen: this.screen,
      groupId: this.groupId,
      query: this.query,
      moduleId: this.moduleId,
      componentId: this.componentId,
      tab: this.tab,
    };
  }

  async onOpen(): Promise<void> {
    await this.setState(
      this.leaf.state,
    );
  }

  /** Units unless there is nothing to study yet. */
  defaultTab(
    module: ModuleRecordView,
  ): ModuleTab {
    return this.plugin.store
      .unitsFor(module.id)
      .length
      ? 'units'
      : 'overview';
  }

  render(): void {
    const root = this.contentEl;

    root.empty();
    root.addClass(
      'los-root',
      'los-module-view',
    );

    if (this.screen === 'list') {
      this.renderGroupList(root);
      return;
    }

    if (this.screen === 'detail') {
      this.renderModuleDetail(root);
      return;
    }

    this.renderGroups(root);
  }

    renderGroups(
    root: HTMLElement,
  ): void {
    renderGroups(this, root);
  }

    renderGroupList(
    root: HTMLElement,
  ): void {
    renderGroupList(this, root);
  }

    renderModuleDetail(
    root: HTMLElement,
  ): void {
    renderModuleDetail(this, root);
  }

  /** One line instead of six labelled facts; the rest is in Logistics. */
    headline(
    module: ModuleRecordView,
  ): string {
    return headline(this, module);
  }

    renderOverview(
    root: HTMLElement,
    module: ModuleRecordView,
  ): void {
    renderOverview(this, root, module);
  }

    renderUnits(
    root: HTMLElement,
    module: ModuleRecordView,
  ): void {
    renderUnits(this, root, module);
  }

    renderLogistics(
    root: HTMLElement,
    module: ModuleRecordView,
  ): void {
    renderLogistics(this, root, module);
  }

    deadlinesFor(
    module: ModuleRecordView,
  ): AcademicDeadlineView[] {
    return deadlinesFor(this, module);
  }

    renderAcademicDates(
    root: HTMLElement,
    module: ModuleRecordView,
  ): void {
    renderAcademicDates(this, root, module);
  }

    renderDeadlineRows(
    wrap: HTMLElement,
    module: ModuleRecordView,
    rows: readonly AcademicDeadlineView[],
  ): void {
    renderDeadlineRows(this, wrap, module, rows);
  }

    async selectTab(
    tab: ModuleTab,
  ): Promise<void> {
    await selectTab(this, tab);
  }

    async selectComponent(
    componentId: string | null,
  ): Promise<void> {
    await selectComponent(this, componentId);
  }

    renderSources(
    root: HTMLElement,
    module: ModuleRecordView,
  ): void {
    renderSources(this, root, module);
  }
}
