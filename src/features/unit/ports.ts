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
  /** Modal host. The comparison drawer is an Obsidian `Modal`, like the unit
   *  note and map-import dialogs already in this feature. */
  readonly app: App;
  /** Redraw after a confirmed source selection, so the promoted current-work
   *  card reflects the choice the learner just made. */
  render(): void;
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
