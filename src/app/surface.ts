/**
 * What the application exposes to views and feature modules.
 *
 * Every view and five feature packages used to reach this surface by importing
 * `LearningOSUI` from `../main` and narrowing it with `Pick<>`. The narrowing
 * was real and deliberate — a view that needs two methods asked for two — but
 * the *dependency* was not narrowed at all: the declared type of a feature
 * module's host was the plugin class, so the module could not be read, typed or
 * tested without the entire plugin, and nothing stopped the next edit from
 * widening the Pick.
 *
 * The members below are exactly the union of what those `Pick<>` lists already
 * asked for — 58 of them, derived from the source rather than chosen, by
 * `scripts/emit-app-surface.mjs`. Nothing was added for symmetry, and the
 * things only the composition root needs (`registerView`, `addCommand`,
 * `addRibbonIcon`, `addSettingTab`) are deliberately absent: `app/registration.ts`
 * still takes the concrete `LearningOSUI`, which is correct, because wiring the
 * Obsidian host together is the one job that legitimately knows the whole thing.
 *
 * `LearningOSUI implements AppSurface` in main.ts is what keeps the two in
 * step. Remove a method the class still needs and the class stops compiling;
 * add one here that the class does not have and the same. That check is the
 * point of the file — a port nothing verifies is just a second place to edit.
 *
 * Navigation returns are `unknown` on purpose: callers navigate for the effect,
 * and a view that cannot see the leaf it opened cannot start depending on it.
 */
import type { UnitNoteModal } from './unit-note-modal';
import type { AppNavigator } from './navigator';
import type { ApplicationRouter } from './router';
import type { UnitNoteDraft } from '../application/draft-store';
import type { DEFAULT_SETTINGS } from '../constants';
import type { ProjectionRecord } from '../contracts/manifest';
import type { GatewayClient } from '../gateway-client';
import type { AIActionClient } from '../infrastructure/ai-action-client';
import type { PythonResolution } from '../infrastructure/los-runtime';
import type { ResourceOpener } from '../infrastructure/resource-opener';
import type { ManifestStore } from '../manifest-store';
import type { LearningOSUiDrafts } from '../application/draft-store';

/** Persisted plugin settings, including the UI's own working drafts. */
export type LearningOSSettings = typeof DEFAULT_SETTINGS & {
  uiDrafts: LearningOSUiDrafts;
};

export interface AppSurface {
  // ------------------------------------------------------------ collaborators
  readonly store: ManifestStore;
  readonly gateway: GatewayClient;
  readonly aiActions: AIActionClient;
  readonly resources: ResourceOpener;
  readonly router: ApplicationRouter;
  /**
   * Every destination the app can open. A module that navigates declares
   * `Pick<AppNavigator, …>` here rather than inheriting twenty-eight methods
   * it does not use — which is the whole point of item 11.
   */
  readonly nav: AppNavigator;
  readonly settings: LearningOSSettings;
  /**
   * Obsidian's own plugin manifest — read for the version in Diagnostics.
   * Optional at both levels because that is how the host declares it
   * (`runtime.d.ts`: `readonly manifest?: PluginManifest`). Declaring it
   * required was the first thing the `implements` clause rejected, which is a
   * fair demonstration of why the clause is there: the previous `Pick<>` had
   * inherited the optionality silently and Diagnostics already handles absence.
   */
  readonly manifest?: { version?: string };

  // ------------------------------------------------------------- the write path
  mutate<T>(
    action: () => T | PromiseLike<T>,
    options?: { reload?: boolean; healStaleProjection?: boolean },
  ): Promise<T>;
  generate(): Promise<void>;
  reviewSessionEnd(): Promise<unknown>;
  askAiScoped(
    request: string,
    context?: Record<string, string | undefined>,
  ): Promise<string>;

  // -------------------------------------------------------------- diagnostics
  uiVersion(): string;
  resolvePython(): PythonResolution;

  // ------------------------------------------ opening things outside the app
  openResource(resource: ProjectionRecord): unknown;
  openVaultPath(path: string): unknown;
  openAuthoredPath(path: string): unknown;
  openMaterialPath(path: string): unknown;
  copyText(value: string): void;

  // ------------------------------------------------------------------- drafts
  scheduleDraftSave(): void;
  getSelectedStage(unitId: string): string | null;
  setSelectedStage(unitId: string, stageId: string | null): void;
  getDoneWhen(unitId: string, stageId: string): boolean[];
  setDoneWhen(
    unitId: string,
    stageId: string,
    index: number,
    checked: boolean,
  ): void;
  clearDoneWhen(unitId: string, stageId: string): void;
  getUnitNoteDraft(unitId: string, stages?: ProjectionRecord[]): UnitNoteDraft;
  setUnitNoteDraft(
    unitId: string,
    title: string,
    text: string,
    expectedRevisions?: Readonly<Record<string, number>>,
  ): void;
  clearUnitNoteDraft(unitId: string, recoveredStageIds?: readonly string[]): void;
  openUnitNote(
    unit: ProjectionRecord,
    studyMap: ProjectionRecord | null,
  ): UnitNoteModal;
  getInboxDraft(): { title: string; text: string };
  setInboxDraft(title: string, text: string): void;
  clearInboxDraft(): void;
}
