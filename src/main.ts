import {
  Plugin,
  Notice,
  type WorkspaceLeaf,
} from 'obsidian';

import { detachApplication, registerApplication } from './app/registration';
import { AppNavigator } from './app/navigator';
import { ApplicationRouter } from './app/router';
import { UnitNoteModal } from './app/unit-note-modal';
import {
  DraftStore,
  normalizeUiDrafts,
  type UnitNoteDraft,
} from './application/draft-store';
import type { AppSurface, LearningOSSettings } from './app/surface';
import { asSessionReview, isProjectionConflict } from './contracts/gateway-v1';
import {
  assertGatewaySnapshotObserved,
  isGatewaySuccessV2,
} from './contracts/gateway-v2';
import {
  DEFAULT_SETTINGS, VIEW_NAV,
} from './constants';
import { GatewayClient, explicitAiContext } from './gateway-client';
import { AIActionClient } from './infrastructure/ai-action-client';
import {
  LosRuntime,
  type LosCallback,
  type PythonResolution,
} from './infrastructure/los-runtime';
import { ResourceOpener } from './infrastructure/resource-opener';
import { ManifestStore } from './manifest-store';
import { SessionEndModal } from './settings';
import type { ProjectionRecord } from './contracts/manifest';
import { asString } from './projection/readers';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * `implements AppSurface` is load-bearing, not decoration. Views and feature
 * modules now depend on that interface instead of on this class, so it is the
 * declared contract between them; this clause is what fails the build if the
 * two drift apart in either direction.
 */
export class LearningOSUI extends Plugin implements AppSurface {
  declare store: ManifestStore;
  declare nav: AppNavigator;
  declare router: ApplicationRouter;
  declare gateway: GatewayClient;
  declare aiActions: AIActionClient;
  declare drafts: DraftStore;
  declare runtime: LosRuntime;
  declare resources: ResourceOpener;
  declare settings: LearningOSSettings;
  declare activeNav: string;

  lastAiPrompt = '';

  async onload(): Promise<void> {
    const loadedSettings = await this.loadData<
      Partial<LearningOSSettings> | null
    >();
    const savedSettings = loadedSettings ?? {};

    this.settings = {
      ...DEFAULT_SETTINGS,
      ...savedSettings,
      uiDrafts: normalizeUiDrafts(savedSettings.uiDrafts),
    };
    this.drafts = new DraftStore(this.settings, () => this.saveData(this.settings));
    this.store = new ManifestStore(this.app);
    this.runtime = new LosRuntime(this.app, () => this.settings.pythonPath);
    this.resources = new ResourceOpener(this.app);
    this.gateway = new GatewayClient(this);
    this.aiActions = new AIActionClient(this);
    this.router = new ApplicationRouter(this);
    this.nav = new AppNavigator(
      this.app,
      this.router,
      this.store,
      this.settings,
      this.drafts,
      this.resources,
    );
    await this.store.load();
    registerApplication(this);
  }

  onunload(): void {
    this.drafts.dispose();
    void this.saveData(this.settings);
    detachApplication(this);
  }

  scheduleDraftSave(): void {
    this.drafts.scheduleSave();
  }

  /*
   * `stageDraftKey`, `getStageDraft`, `setStageDraft` and `clearStageDraft`
   * were four pass-throughs to DraftStore that nothing called — no view, no
   * feature module, no test, and no entry in any host `Pick<>`. Removed
   * 2026-08-21 (item 11).
   *
   * Worth knowing what their absence reveals rather than just deleting them:
   * they were the only callers of `DraftStore.getStage/setStage/clearStage`,
   * so nothing in the app writes a stage draft any more. `getUnitNote` still
   * reads `uiDrafts.stages` to recover unsaved stage text into a unit note,
   * which means that recovery path now reads a bag that is always empty. That
   * is either a feature that was retired without removing its reader, or a
   * regression from an earlier extraction. It is a behavioural question, not a
   * mechanical one, so it is left for Aram rather than guessed at here.
   */
  getUnitNoteDraft(
    unitId: string,
    stages: ProjectionRecord[] = [],
  ): UnitNoteDraft {
    return this.drafts.getUnitNote(unitId, stages);
  }
  setUnitNoteDraft(
    unitId: string,
    title: string,
    text: string,
    expectedRevisions: Readonly<Record<string, number>> = {},
  ): void {
    this.drafts.setUnitNote(unitId, title, text, expectedRevisions);
  }
  clearUnitNoteDraft(
    unitId: string,
    recoveredStageIds: readonly string[] = [],
  ): void {
    this.drafts.clearUnitNote(unitId, recoveredStageIds);
  }
  openUnitNote(
    unit: ProjectionRecord,
    studyMap: ProjectionRecord | null,
  ): UnitNoteModal {
    const modal = new UnitNoteModal(this.app, this, unit, studyMap);
    modal.open();
    return modal;
  }
  getSelectedStage(unitId: string): string | null {
    return this.drafts.getSelectedStage(unitId);
  }
  setSelectedStage(
    unitId: string,
    stageId: string | null,
  ): void {
    this.drafts.setSelectedStage(unitId, stageId);
  }
  /** Done-when ticks are UI-owned working state: they help the learner see how
   *  far through a stage's criteria they are, and are never a second record of
   *  completion. The core still learns only "complete" from `stage-progress`. */
  getDoneWhen(unitId: string, stageId: string): boolean[] {
    return this.drafts.getDoneWhen(unitId, stageId);
  }
  setDoneWhen(
    unitId: string,
    stageId: string,
    index: number,
    checked: boolean,
  ): void {
    this.drafts.setDoneWhen(unitId, stageId, index, checked);
  }
  clearDoneWhen(unitId: string, stageId: string): void {
    this.drafts.clearDoneWhen(unitId, stageId);
  }
  getInboxDraft() { return this.drafts.getInbox(); }
  setInboxDraft(title: string, text: string): void {
    this.drafts.setInbox(title, text);
  }
  clearInboxDraft(): void {
    this.drafts.clearInbox();
  }

  /**
   * Interpreter resolution, in order: an explicitly configured path, the POSIX
   * venv, the Windows venv, then the PATH names. Reported rather than guessed —
   * when a write button dies, Diagnostics has to be able to say which binary
   * was tried and where it looked.
   */
  /** The plugin's own version, kept off the `manifest.` access path so the
   *  contract-key test cannot mistake it for a projection field. */
  uiVersion(): string {
    const info = this.manifest;
    return info?.version || 'unknown';
  }

  resolvePython(): PythonResolution {
    return this.runtime.resolvePython();
  }

  /**
   * Run the CLI. `stdin` carries a capability envelope when there is one.
   *
   * Envelopes go down stdin rather than a `--payload-file` temp file: a temp
   * file would put canonical intent on disk on every write, including the
   * ones that fail, leaving cleanup as a thing that can be forgotten.
   */
  runLos(args: string[], callback: LosCallback, stdin?: string): void {
    this.runtime.run(args, callback, stdin);
  }

  async reloadStore() {
    const ok = await this.store.load();
    if (!ok) throw new Error(this.store.error);
    this.app.workspace.iterateAllLeaves(
      (leaf: WorkspaceLeaf) => leaf.view?.render?.(),
    );
  }

  /** The active destination is a display fact, so the Navigator is the only
   *  thing it redraws — never the working view the learner is reading. */
  setActiveNav(key: string): void {
    this.activeNav = key;
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_NAV)) leaf.view?.render?.();
  }

  /**
   * Navigation moved to `AppNavigator` on 2026-08-21 (engineering review item
   * 11). What stood here was twenty-eight methods, most of them one line into
   * `this.router.navigate(...)`, and they were the reason every view held the
   * whole plugin: a view that wanted one destination had to declare a
   * dependency on the class that owned all of them. `this.nav` is that
   * collaborator; views now take it (or a `Pick<>` of it) instead.
   */

  /**
   * One transaction at a time, across every view. A per-view `busy` flag only
   * ever protected the view that owned it — a stage completion and an inbox
   * capture started from different leaves could still overlap, each carrying an
   * `--expected-snapshot` the other had already invalidated.
   */
  async mutate<T>(
    action: () => T | PromiseLike<T>,
    { reload = true, healStaleProjection = true }:
      { reload?: boolean; healStaleProjection?: boolean } = {},
  ): Promise<T> {
    return this.gateway.enqueue(async () => {
      try {
        const result = await action();
        if (reload) {
          await this.reloadStore();
          if (isGatewaySuccessV2(result)) {
            assertGatewaySnapshotObserved(result, this.store.snapshotId);
          }
        }
        return result;
      } catch (error: unknown) {
        if (!healStaleProjection || !isProjectionConflict(error)) throw error;
        await this.refreshAfterConflict();
        throw error;
      }
    });
  }

  /**
   * The core refuses a write whose snapshot is behind the authored tree and
   * says "reload before writing" — but the app's reload re-reads
   * `generated/manifest.json`, which is exactly as stale as the snapshot that
   * was just refused. Only rebuilding the projection moves it forward.
   *
   * This is the normal case, not an edge one: planning happens in Claude, so
   * canonical files change between app sessions by design. Without this the
   * first write after any authoring session fails, and the advice on screen
   * does not fix it.
   *
   * Refresh only. Exit code 3 also represents an artifact-revision conflict;
   * automatically replaying the write after adopting fresh revisions would
   * defeat that guard and could overwrite concurrent work. The learner's
   * draft stays intact for one deliberate reconciliation and retry.
   */
  private async refreshAfterConflict(): Promise<void> {
    new Notice('Canonical files changed since this view loaded — refreshing them. Your draft was kept; review it before retrying.');
    await this.gateway.call(['generate'], { expectJson: false });
    await this.reloadStore();
  }

  async generate() {
    try {
      await this.mutate(async () => {
        await this.gateway.call(['validate'], { expectJson: false });
        await this.gateway.call(['generate'], { expectJson: false });
      });
      new Notice('LearningOS projection rebuilt.');
    } catch (error: unknown) {
      new Notice(errorMessage(error));
    }
  }

  async reviewSessionEnd() {
    try {
      const review = asSessionReview(await this.gateway.endSession());
      new SessionEndModal(this.app, this, review).open();
      return review;
    } catch (error: unknown) {
      new Notice(errorMessage(error));
      return null;
    }
  }

  async openVaultPath(path: string) {
    return this.resources.openVaultPath(path);
  }
  async openExternalPath(
    path: string,
    successMessage = 'Opened in the default app.',
  ): Promise<boolean> {
    return this.resources.openExternalPath(path, successMessage);
  }
  openMaterialPath(path: string) {
    return this.resources.openMaterialPath(path);
  }
  openAuthoredPath(path: string) {
    return this.resources.openAuthoredPath(path);
  }
  openRecord(record: ProjectionRecord | null | undefined) {
    if (!record) return;
    const recordId = asString(record.id);
    if (record.type === 'unit' && recordId) return this.nav.openUnit(recordId);
    if (record.type === 'module' && recordId) return this.nav.openModule(recordId);
    if (record.type === 'project' && recordId) return this.nav.openProject(recordId);
    if (record.type === 'program' && recordId) return this.nav.openProgram(recordId);
    if (record.type === 'source' && recordId) return this.nav.openSourceDetail(recordId);
    if (record.type === 'topic-pack' && recordId) return this.nav.openTopicPackDetail(recordId);
    if (record.type === 'collection' && recordId) return this.nav.openCatalogueDetail(recordId);
    if (record.type === 'note' || record.type === 'concept') {
      if (record.path) return this.openAuthoredPath(record.path);
      return this.nav.openLibraryFiltered(record.type);
    }
    if (record.type === 'workspace') {
      if (record.project_id) return this.nav.openProject(record.project_id);
      const unit = (record.unit_ids || [])
        .map((id: string) => this.store.get(id))
        .find(Boolean);
      if (unit?.id) return this.nav.openUnit(unit.id);
      const module = (record.module_ids || [])
        .map((id: string) => this.store.get(id))
        .find(Boolean);
      return module?.id ? this.nav.openModule(module.id) : this.nav.openHome();
    }
    if (record.path) return this.openAuthoredPath(record.path);
  }
  openResource(resource: ProjectionRecord) {
    return this.resources.openResource(resource, this);
  }
  copyText(value: string): void {
    this.resources.copyText(value);
  }

  async askAiScoped(
    request: string,
    context: Record<string, string | undefined> = {},
  ): Promise<string> {
    const envelope = explicitAiContext(this, context);
    const prompt = `${request}\n\nLearningOS explicit context (authoritative):\n${JSON.stringify(envelope, null, 2)}\n\nThe active file is supplementary context only. Use only action-specific LearningOS capabilities for writes; never infer a global course or learning path.`;
    this.lastAiPrompt = prompt;
    const agent = this.app.plugins?.plugins?.['agentic-copilot'];
    if (agent?.sendToChat) await agent.sendToChat(prompt);
    else { this.copyText(prompt); new Notice('Scoped prompt copied. Open Agentic Copilot to continue.'); }
    return prompt;
  }
}

export default LearningOSUI;
