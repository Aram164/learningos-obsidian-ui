import { renderStageContext, renderArtifacts } from '../features/unit/context';
import { renderStage, renderActionBar } from '../features/unit/stage';
import { render, renderRail } from '../features/unit/shell';
import {
  ItemView,
  Notice,
  type WorkspaceLeaf,
} from 'obsidian';
import {
  badge,
  button,
  chip,
  disclosure,
  empty,
  icon,
  overflowMenu,
  pageHeader,
  section,
} from '../components';
import { VIEW_UNIT } from '../constants';
import type {
  ProjectionRecord,
} from '../contracts/manifest-v5';
import type { LearningOSUI } from '../main';
import {
  asLabel as projectedLabel,
  asRecords as projectedRecords,
  asString as projectedString,
  asStrings as projectedStrings,
  asText as projectedText,
  isRecord,
} from '../projection/readers';

import {
  ARTIFACT_LABELS,
  ParsedUnitViewState,
  UnitRecordView,
  KnowledgeNodeView,
  MaterialOptionView,
  StageRecordView,
  ResourceRecordView,
  StudyMapView,
  StageAttachmentView,
  ArtifactSet,
  UnitPlugin,
  errorMessage,
  readUnitViewState,
  readUnitRecord,
  readResource,
  readStageAttachment,
  readStage,
  readStudyMap,
  readMaterialOptions,
  readArtifacts,
  artifactLabel,
  fallbackRecord,
} from '../features/unit/model';

/**
 * The Unit is where learning actually happens, so it gets the strictest
 * discipline: a stage rail and one current-work panel. Notes are added once
 * after a learning session from the action at the end of the rail; they never
 * occupy a permanent panel or become mandatory per stage.
 */
export class UnitView extends ItemView {
  readonly plugin: UnitPlugin;

  unitId: string | null;

  stageId: string | null;

  constructor(
    leaf: WorkspaceLeaf,
    plugin: UnitPlugin,
  ) {
    super(leaf);

    this.plugin = plugin;
    this.unitId = null;
    this.stageId = null;
  }

  getViewType(): string {
    return VIEW_UNIT;
  }

  getDisplayText(): string {
    return 'LearningOS · Unit';
  }

  async setState(
    state: unknown = {},
  ): Promise<void> {
    const parsed =
      readUnitViewState(state);

    const nextUnitId =
      parsed.unitId
      ?? this.unitId;

    if (nextUnitId !== this.unitId) {
      this.stageId = null;
    }

    this.unitId = nextUnitId;

    const requestedStageId =
      parsed.hasStageId
        ? parsed.stageId ?? null
        : null;

    const selectedStageId =
      this.unitId
        ? this.plugin.getSelectedStage(
          this.unitId,
        )
        : null;

    this.stageId =
      selectedStageId
      ?? requestedStageId
      ?? this.stageId;

    this.render();
  }

  getState(): {
    unitId: string | null;
    stageId: string | null;
  } {
    return {
      unitId: this.unitId,
      stageId: this.stageId,
    };
  }

  async onOpen(): Promise<void> {
    const state =
      readUnitViewState(
        this.leaf.state,
      );

    this.unitId =
      state.unitId
      ?? this.unitId;

    const selectedStageId =
      this.unitId
        ? this.plugin.getSelectedStage(
          this.unitId,
        )
        : null;

    this.stageId =
      selectedStageId
      ?? (
        state.hasStageId
          ? state.stageId ?? null
          : null
      )
      ?? this.stageId;

    this.render();
  }

    render(): void {
    render(this);
  }

    renderRail(
    layout: HTMLElement,
    unit: UnitRecordView,
    studyMap: StudyMapView,
    current: StageRecordView,
  ): void {
    renderRail(this, layout, unit, studyMap, current);
  }

    renderStage(
    layout: HTMLElement,
    unit: UnitRecordView,
    studyMap: StudyMapView,
    stage: StageRecordView,
  ): void {
    renderStage(this, layout, unit, studyMap, stage);
  }

  /**
   * One primary action and one menu. The primary is filled; nothing else on
   * this screen may be.
   */
    renderActionBar(
    root: HTMLElement,
    unit: UnitRecordView,
    stage: StageRecordView,
  ): void {
    renderActionBar(this, root, unit, stage);
  }

    renderStageContext(
    center: HTMLElement,
    unit: UnitRecordView,
    studyMap: StudyMapView,
    stage: StageRecordView,
  ): void {
    renderStageContext(this, center, unit, studyMap, stage);
  }

    renderArtifacts(
    root: HTMLElement,
    unit: UnitRecordView,
  ): void {
    renderArtifacts(this, root, unit);
  }

  /**
   * Every write goes through the plugin-wide queue, so two clicks in two views
   * can no longer race the same `--expected-snapshot`.
   */
  async mutate(
    action: () => Promise<unknown>,
    onConfirmed:
      (() => void) | null = null,
  ): Promise<void> {
    if (this.plugin.gateway.isBusy) {
      new Notice(
        'A LearningOS write is already running.',
      );

      return;
    }

    try {
      await this.plugin.mutate(
        action,
      );

      onConfirmed?.();
      this.render();
    } catch (error: unknown) {
      new Notice(
        errorMessage(error),
      );
    }
  }

  async selectStage(
    stageId: string,
  ): Promise<void> {
    const unitId =
      this.unitId;

    if (!unitId) {
      new Notice(
        'This unit is no longer available.',
      );

      return;
    }

    this.stageId = stageId;

    this.plugin.setSelectedStage(
      unitId,
      stageId,
    );

    await this.leaf.setViewState({
      type: VIEW_UNIT,
      active: true,
      state: {
        unitId,
        stageId,
      },
    });
  }
}
