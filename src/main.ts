import {
  Plugin,
  Notice,
  type WorkspaceLeaf,
} from 'obsidian';

import { detachApplication, registerApplication } from './app/registration';
import { AppNavigator } from './app/navigator';
import { ApplicationRouter } from './app/router';
import { UnitNoteModal } from './app/unit-note-modal';
import { runtimeContractVersion, runtimeSourceFingerprint } from './build-identity';
import {
  DraftStore,
  normalizeUiDrafts,
  type ComposerDraft,
  type UnitNoteDraft,
} from './application/draft-store';
import {
  SettingsGatewayRecoveryStore,
  type GatewayRecoveryState,
} from './application/gateway-recovery';
import type { AppSurface, LearningOSSettings } from './app/surface';
import {
  GatewayError,
  asSessionReview,
  isProjectionConflict,
} from './contracts/gateway-v1';
import type { GatewaySuccessV2 } from './contracts/gateway-v2';
import {
  DEFAULT_SETTINGS, VIEW_NAV,
} from './constants';
import {
  GATEWAY_RECOVERY_BLOCKED,
  GATEWAY_RECOVERY_NOTICE,
  GatewayClient,
  explicitAiContext,
} from './gateway-client';
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

interface SettingsSaveCoordinator {
  generation: number;
  tail: Promise<void>;
}

interface LearningOSProcessState {
  __learningosUiSettingsCoordinators?: Map<string, SettingsSaveCoordinator>;
}

/*
 * Plugin instances overlap during disable/re-enable: an old child callback can
 * arrive after a new instance has loaded.  Keep one process-wide save queue
 * and lease per vault so the old instance cannot write stale `data.json` over
 * the new one.  `globalThis` deliberately survives a bundle reload in the same
 * Obsidian process; a module-local map would not.
 */
const processState = globalThis as typeof globalThis & LearningOSProcessState;
const settingsCoordinators = processState.__learningosUiSettingsCoordinators
  ?? new Map<string, SettingsSaveCoordinator>();
processState.__learningosUiSettingsCoordinators = settingsCoordinators;

function settingsCoordinator(vaultRoot: string): SettingsSaveCoordinator {
  const existing = settingsCoordinators.get(vaultRoot);
  if (existing) return existing;
  const created = { generation: 0, tail: Promise.resolve() };
  settingsCoordinators.set(vaultRoot, created);
  return created;
}

function cloneSettings(settings: LearningOSSettings): LearningOSSettings {
  return JSON.parse(JSON.stringify(settings)) as LearningOSSettings;
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
  declare recovery: SettingsGatewayRecoveryStore;

  lastAiPrompt = '';
  /** Set when startup found an unusable record; the app registers read-only. */
  recoveryBlocked = false;

  /**
   * One writer for `data.json`, in arrival order and across plugin instances.
   *
   * Drafts, navigation, settings toggles and now the recovery record all live
   * in the same file, and each used to call `saveData(this.settings)` on its
   * own. Two of those in flight together is a lost update: whichever `await`
   * resolved last wrote the object it had captured. For a debounced draft save
   * that is a mild annoyance; for the record that says a write may be in
   * flight, it is the difference between recovering and duplicating.
   *
   * Each queued task calls `saveData` only when its turn begins, so it
   * serializes the newest in-memory settings rather than an old snapshot — the
   * queue orders the writes without freezing what they contain.
   */
  private settingsCoordinator: SettingsSaveCoordinator | null = null;
  private lifecycleGeneration = 0;
  private lifecycleLive = false;

  isLifecycleActive(): boolean {
    return this.lifecycleLive
      && this.settingsCoordinator?.generation === this.lifecycleGeneration;
  }

  private enqueueSettingsSave(
    value: LearningOSSettings,
    { requireOwner = true }: { requireOwner?: boolean } = {},
  ): Promise<void> {
    const coordinator = this.settingsCoordinator;
    if (!coordinator) return Promise.resolve();
    const generation = this.lifecycleGeneration;
    const save = () => {
      if (requireOwner && (!this.lifecycleLive || coordinator.generation !== generation)) {
        return Promise.resolve();
      }
      return this.saveData(value);
    };
    const run = coordinator.tail.then(save, save);
    coordinator.tail = run.then(() => undefined, () => undefined);
    return run;
  }

  persistSettings(): Promise<void> {
    if (!this.isLifecycleActive()) return Promise.resolve();
    // The settings object is deliberately read when this queued task starts,
    // so two rapid saves serialize the newest state instead of old snapshots.
    return this.enqueueSettingsSave(this.settings);
  }

  async onload(): Promise<void> {
    const coordinator = settingsCoordinator(
      this.app.vault.adapter.getBasePath(),
    );
    this.settingsCoordinator = coordinator;
    this.lifecycleGeneration = coordinator.generation + 1;
    coordinator.generation = this.lifecycleGeneration;
    this.lifecycleLive = true;
    // A prior instance may still have one physical save in progress.  It owns
    // the queue position before this load, so wait for it rather than reading
    // and later overwriting a half-settled settings file.
    await coordinator.tail;
    if (!this.isLifecycleActive()) return;
    const loadedSettings = await this.loadData<
      Partial<LearningOSSettings> | null
    >();
    const savedSettings = loadedSettings ?? {};

    this.settings = {
      ...DEFAULT_SETTINGS,
      ...savedSettings,
      uiDrafts: normalizeUiDrafts(savedSettings.uiDrafts),
    };
    this.drafts = new DraftStore(this.settings, () => this.persistSettings());
    this.recovery = new SettingsGatewayRecoveryStore(
      this.settings,
      () => this.persistSettings(),
    );
    const recoveryState = await this.recovery.load();
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
    await this.resumeInterruptedWrite(recoveryState);
  }

  /** Every Notice the gateway and recovery paths raise goes through here. */
  notify(message: string): void {
    if (!this.isLifecycleActive()) return;
    new Notice(message);
  }

  /**
   * Finish, or refuse to finish, whatever the last session left in flight.
   *
   * The order is deliberate: settings, then the recovery record, then the
   * projection, and only then a replay — a replay decided before the projection
   * loaded could not reconcile its own receipt.
   */
  private async resumeInterruptedWrite(state: GatewayRecoveryState): Promise<void> {
    if (state.kind === 'clear') return;
    if (state.kind === 'malformed') {
      this.recoveryBlocked = true;
      this.notify('LearningOS found an unreadable record of an unfinished write and will not send anything until it is reviewed. Open Diagnostics → Gateway recovery.');
      return;
    }
    const phase = state.entry.record.phase;
    if (phase === 'blocked' || phase === 'recovering') {
      // `recovering` was persisted before the automatic replay started. If the
      // process then died, another automatic replay on every launch would make
      // the promised one-retry limit unbounded. Both states wait for the
      // learner's explicit Diagnostics action; the original bytes remain.
      this.recoveryBlocked = true;
      this.notify(GATEWAY_RECOVERY_BLOCKED);
      return;
    }
    if (phase === 'confirmed') {
      // Settings JSON is evidence, not authority.  Ask Core's idempotency
      // ledger for the exact committed receipt without running the handler;
      // only then may projection reconciliation clear the record and draft.
      try {
        const confirmation = await this.gateway.settle(
          await this.gateway.verifyConfirmedEnvelope(),
        );
        await this.finishConfirmedWrite(confirmation);
      } catch (error: unknown) {
        // A failed projection must not reject plugin startup: Diagnostics is
        // the recovery surface, so it has to remain registered and reachable.
        this.recoveryBlocked = this.recovery.unresolved;
        this.notify(errorMessage(error));
      }
      return;
    }
    this.notify(GATEWAY_RECOVERY_NOTICE);
    try {
      await this.gateway.enqueue(async () => {
        const outcome = await this.gateway.recoverPreparedEnvelope();
        const confirmation = await this.gateway.settle(outcome);
        await this.finishConfirmedWrite(confirmation);
      });
    } catch (error: unknown) {
      this.recoveryBlocked = this.recovery.unresolved;
      this.notify(errorMessage(error));
    }
  }

  onunload(): void {
    this.drafts?.dispose();
    if (this.isLifecycleActive() && this.settings) {
      // This final snapshot is already ordered before any replacement
      // instance's load.  It is allowed to finish even if that instance claims
      // the lease meanwhile; the replacement waits for the shared tail.
      void this.enqueueSettingsSave(cloneSettings(this.settings), {
        requireOwner: false,
      }).catch(() => undefined);
    }
    this.lifecycleLive = false;
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
    match: { title: string; text: string } | null = null,
  ): void {
    this.drafts.clearUnitNote(unitId, recoveredStageIds, match);
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
  clearInboxDraft(match: ComposerDraft | null = null): void {
    this.drafts.clearInbox(match);
  }
  getGardenDraft() { return this.drafts.getGarden(); }
  setGardenDraft(title: string, text: string): void {
    this.drafts.setGarden(title, text);
  }
  clearGardenDraft(match: ComposerDraft | null = null): void {
    this.drafts.clearGarden(match);
  }
  /** Metadata about an unresolved write, for Diagnostics. Never payload text. */
  gatewayRecoveryState(): GatewayRecoveryState {
    return this.recovery.state;
  }
  /**
   * Retry the *same* request from Diagnostics. It never creates a new one:
   * the stored envelope is the only thing that can be sent, which is why the
   * screen offers no discard.
   */
  async retryRecoveredWrite(): Promise<void> {
    if (!this.recovery.unresolved) {
      new Notice('There is no unresolved Gateway write.');
      return;
    }
    if (this.recovery.state.kind === 'malformed') {
      new Notice('The stored record is unreadable, so LearningOS cannot replay it. It is kept exactly as written.');
      return;
    }
    try {
      await this.gateway.enqueue(async () => {
        const stored = this.recovery.replayable();
        const outcome = stored?.record.confirmation
          ? await this.gateway.verifyConfirmedEnvelope()
          : await this.gateway.recoverPreparedEnvelope();
        const confirmation = await this.gateway.settle(outcome);
        await this.finishConfirmedWrite(confirmation);
      });
      this.recoveryBlocked = this.recovery.unresolved;
      new Notice('The recovered Gateway write is settled.');
    } catch (error: unknown) {
      this.recoveryBlocked = this.recovery.unresolved;
      new Notice(errorMessage(error));
    }
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

  /** The identity compiled into *this* running bundle — see build-identity.ts. */
  runtimeBuildIdentity(): { fingerprint: string; contractVersion: number } {
    return {
      fingerprint: runtimeSourceFingerprint(),
      contractVersion: runtimeContractVersion(),
    };
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

  /** Reload without throwing: the snapshot now visible, or null. */
  private async observedSnapshot(): Promise<string | null> {
    const ok = await this.store.load();
    this.app.workspace.iterateAllLeaves(
      (leaf: WorkspaceLeaf) => leaf.view?.render?.(),
    );
    return ok ? this.store.snapshotId : null;
  }

  /**
   * Turn a receipt into an observation, then retire the record.
   *
   * A receipt says Core committed. It does not say this vault can see the
   * result — the projection is a separate artifact, and a write recovered after
   * a crash is very likely to be looking at a stale one. So the manifest is
   * reloaded, rebuilt once if it disagrees, and only a manifest that actually
   * loads retires the record. If it never does, the record stays and blocks:
   * an unobservable write is not a finished one, and starting a new write on
   * top of it is how the duplicate would come back.
   */
  private async finishConfirmedWrite(
    confirmation: GatewaySuccessV2 | null,
  ): Promise<void> {
    if (!confirmation) return;
    this.gateway.assertLifecycleActive();
    let observed = await this.observedSnapshot();
    this.gateway.assertLifecycleActive();
    let rebuildSucceeded = false;
    let rebuildError: unknown = null;
    if (observed !== confirmation.snapshot_after) {
      new Notice('LearningOS is rebuilding the projection so the confirmed write becomes visible.');
      try {
        await this.gateway.call(['generate'], { expectJson: false });
        rebuildSucceeded = true;
      } catch (error: unknown) {
        rebuildError = error;
        // Reload once anyway: another process may already have published the
        // receipt's snapshot while this rebuild was failing.
      }
      observed = await this.observedSnapshot();
      this.gateway.assertLifecycleActive();
    }
    const failedToEstablishCurrentProjection = observed === null
      || (observed !== confirmation.snapshot_after && !rebuildSucceeded);
    if (failedToEstablishCurrentProjection) {
      const detail = observed === null
        ? (this.store.error || 'the projection could not be reloaded')
        : `the projection rebuild failed and the readable manifest is still at ${observed}: ${errorMessage(rebuildError)}`;
      await this.recovery.markBlocked({
        code: 'PROJECTION_FAILED',
        message: detail,
      });
      this.recoveryBlocked = true;
      throw new GatewayError(
        'LearningOS committed the write but cannot load a projection that shows it. Your draft was kept. Open Diagnostics → Gateway recovery.',
        null,
        { code: 'PROJECTION_FAILED', retryable: true },
      );
    }
    if (observed !== confirmation.snapshot_after) {
      new Notice('Recovered the prior write; newer canonical changes are also present.');
    }
    await this.recovery.settleConfirmed();
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
        this.gateway.assertMutationAllowed();
        const result = await action();
        this.gateway.assertLifecycleActive();
        /*
         * Reconciliation is keyed on the record, not on what the action
         * happened to return. Several call sites wrap the capability call in
         * something larger — the inbox capture follows its write with a
         * `generate` — so the confirmation never reaches this line, and a
         * value-based check silently skipped reconciliation and left the next
         * write refused. The record is the fact; the return value is an
         * accident of how the caller composed its action.
         */
        const pending = this.recovery.replayable();
        if (pending?.record.phase === 'confirmed') {
          await this.finishConfirmedWrite(pending.record.confirmation);
        } else if (reload) {
          await this.reloadStore();
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
      const review = asSessionReview(await this.mutate(
        () => this.gateway.endSession(),
      ));
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
