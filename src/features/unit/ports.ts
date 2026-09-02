import type { App } from 'obsidian';
import type {
  StageRecordView,
  StudyMapView,
  UnitPlugin,
  UnitRecordView,
} from './model';

export interface UnitContextHost {
  readonly plugin: UnitPlugin;
  mutate(
    action: () => Promise<unknown>,
    onConfirmed?: (() => void) | null,
  ): Promise<void>;
}

export interface UnitMaterialsHost {
  readonly plugin: UnitPlugin;
}

export interface UnitStageHost
  extends UnitContextHost {
  renderActionBar(
    root: HTMLElement,
    unit: UnitRecordView,
    stage: StageRecordView,
    expectedRevisions: Readonly<Record<string, number>>,
  ): void;
  renderStageContext(
    center: HTMLElement,
    unit: UnitRecordView,
    studyMap: StudyMapView,
    stage: StageRecordView,
  ): void;
}

export interface UnitShellHost
  extends UnitMaterialsHost {
  readonly app: App;
  readonly contentEl: HTMLElement;
  unitId: string | null;
  stageId: string | null;
  renderArtifacts(
    root: HTMLElement,
    unit: UnitRecordView,
  ): void;
  renderRail(
    layout: HTMLElement,
    unit: UnitRecordView,
    studyMap: StudyMapView,
    current: StageRecordView,
  ): void;
  renderStage(
    layout: HTMLElement,
    unit: UnitRecordView,
    studyMap: StudyMapView,
    stage: StageRecordView,
  ): void;
  selectStage(
    stageId: string,
  ): Promise<void>;
}
