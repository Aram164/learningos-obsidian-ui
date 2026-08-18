import {
  Plugin,
  Notice,
  type WorkspaceLeaf,
} from 'obsidian';

import { GlobalSearchModal } from './app/global-search';
import { detachApplication, registerApplication } from './app/registration';
import { ApplicationRouter } from './app/router';
import { UnitNoteModal } from './app/unit-note-modal';
import {
  DraftStore,
  normalizeUiDrafts,
  type LearningOSUiDrafts,
  type UnitNoteDraft,
} from './application/draft-store';
import { button } from './components';
import { asSessionReview, isProjectionConflict } from './contracts/gateway-v1';
import {
  asLibraryCollection,
  asProjectDetailTab,
  type LibrarySourceFiltersV1,
} from './contracts/route-v1';
import {
  DEFAULT_SETTINGS, LEARN_AREAS, VIEW_NAV,
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
import type { ProjectionRecord } from './contracts/manifest-v5';
import { asString } from './projection/readers';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type LearningOSSettings = typeof DEFAULT_SETTINGS & {
  uiDrafts: LearningOSUiDrafts;
};

export class LearningOSUI extends Plugin {
  declare store: ManifestStore;
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

  stageDraftKey(unitId: string, stageId: string): string { return this.drafts.stageKey(unitId, stageId); }
  getStageDraft(
    unitId: string,
    stageId: string,
    savedText = '',
  ): { text: string; dirty: boolean } {
    return this.drafts.getStage(unitId, stageId, savedText);
  }
  setStageDraft(
    unitId: string,
    stageId: string,
    text: string,
    savedText = '',
  ): void {
    this.drafts.setStage(unitId, stageId, text, savedText);
  }
  clearStageDraft(unitId: string, stageId: string): void {
    this.drafts.clearStage(unitId, stageId);
  }
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
  ): void {
    this.drafts.setUnitNote(unitId, title, text);
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

  async openNav() { return this.router.openNavigator(); }
  async openHome() { return this.router.navigate({ name: 'home' }); }
  /** Learn is one destination; the areas are sub-areas inside it. */
  openLearn(programId: string | null = null) {
    const area = programId || this.settings.learnArea || LEARN_AREAS[0][0];
    this.settings.learnArea = area;
    this.scheduleDraftSave();
    return this.router.navigate({ name: 'learn', programId: area });
  }
  openCapture() { return this.router.navigate({ name: 'capture' }); }
  openReview() { return this.router.navigate({ name: 'review' }); }
  openGarden() { return this.router.navigate({ name: 'garden' }); }
  openDiagnostics() { return this.router.navigate({ name: 'diagnostics' }); }
  openGlobalSearch(query = '') {
    const modal = new GlobalSearchModal(this.app, this, query);
    modal.open();
    return modal;
  }
  openProgram(programId: string) {
    return this.router.navigate({ name: 'program', programId });
  }
  openModules() { return this.router.navigate({ name: 'module-groups' }); }
  openProjects(query = '') { return this.router.navigate({ name: 'project-list', query }); }
  openProject(projectId: string, tab = 'structure') {
    const current = this.router.snapshot().current;
    const changingTab = current?.name === 'project-detail' && current.projectId === projectId;
    return this.router.navigate(
      { name: 'project-detail', projectId, tab: asProjectDetailTab(tab) },
      { pushHistory: !changingTab },
    );
  }
  openModuleGroup(groupId: string, query = '') {
    return this.router.navigate({ name: 'module-list', groupId, query });
  }
  openModuleDetail(
    moduleId: string,
    componentId: string | null = null,
    tab: string | null = null,
  ) {
    return this.router.navigate({ name: 'module-detail', moduleId, componentId, tab });
  }
  /** Compatibility alias used by Learn, Home and existing deep links. */
  openModule(moduleId: string, componentId: string | null = null) {
    return this.openModuleDetail(moduleId, componentId);
  }
  openUnit(unitId: string, stageId: string | null = null) {
    const selectedStage = stageId || this.getSelectedStage(unitId);
    if (selectedStage) this.setSelectedStage(unitId, selectedStage);
    return this.router.navigate({ name: 'unit', unitId, stageId: selectedStage });
  }
  openLibrary(
    recordId: string | null | undefined = undefined,
    recordType: string | undefined = undefined,
  ) {
    if (recordId === undefined || recordId === null) {
      return this.openLibraryHome(recordType === 'topic-pack' ? 'topic-packs' : 'sources');
    }
    const record = this.store.get(recordId);
    if (record?.type === 'source' || recordType === 'source') return this.openSourceDetail(recordId);
    if (record?.type === 'topic-pack' || recordType === 'topic-pack') return this.openTopicPackDetail(recordId);
    if (record?.type === 'collection' || recordType === 'collection') return this.openCatalogueDetail(recordId);
    return this.router.navigate({ name: 'legacy-library-list', recordType: recordType || record?.type || 'note', query: '' });
  }
  openLibraryHome(
    collection = 'sources',
    query = '',
    filters?: LibrarySourceFiltersV1,
  ) {
    return this.router.navigate({
      name: 'library-home',
      collection: asLibraryCollection(collection),
      query,
      ...(filters ? { filters } : {}),
    });
  }
  openLibraryGroup(
    collection: string,
    groupId: string,
    query = '',
    facet = 'all',
    filters?: LibrarySourceFiltersV1,
  ) {
    return this.router.navigate({
      name: 'library-group',
      collection: asLibraryCollection(collection),
      groupId,
      query,
      facet,
      ...(filters ? { filters } : {}),
    });
  }
  openSourceDetail(
    resourceId: string,
    fromGroupId: string | null = null,
    query = '',
    facet = 'all',
    filters?: LibrarySourceFiltersV1,
  ) {
    return this.router.navigate({
      name: 'source-detail',
      resourceId,
      fromGroupId,
      query,
      facet,
      ...(filters ? { filters } : {}),
    });
  }
  openTopicPackDetail(
    topicPackId: string,
    fromGroupId: string | null = null,
    query = '',
  ) {
    return this.router.navigate({ name: 'topic-pack-detail', topicPackId, fromGroupId, query });
  }
  openCatalogueDetail(catalogueId: string) {
    return this.router.navigate({ name: 'catalogue-detail', catalogueId });
  }
  /** Hidden compatibility surface used by Atlas and pre-migration deep links. */
  openLibraryFiltered(recordType: string, domain = '') {
    return this.router.navigate({ name: 'legacy-library-list', recordType, domain, query: '' });
  }
  openAtlas(domain: string | null = null) {
    return this.router.navigate({ name: 'atlas', domain });
  }
  openShelving(unitId: string | null = null) {
    return this.router.navigate({ name: 'shelving', unitId });
  }
  openBoundary(boundaryId: string) {
    return this.router.navigate({ name: 'boundary', boundaryId });
  }
  back() { return this.router.back(); }
  openResume() {
    const pointer = this.store.data?.resume_pointer;
    return pointer ? this.openUnit(pointer.unit_id, pointer.stage_id) : this.openHome();
  }
  openFullTextSearch(query = ''): void {
    const ok = this.app.commands?.executeCommandById?.('omnisearch:show-modal');
    if (!ok) new Notice('Omnisearch is unavailable; structural Library search still works.');
    else if (query.trim()) {
      let attempts = 0;
      const transfer = () => {
        const input = [...document.querySelectorAll<HTMLInputElement>('.prompt-input')]
          .find((candidate) => candidate.offsetParent !== null);
        if (!input && attempts++ < 20) { setTimeout(transfer, 50); return; }
        if (!input || input.value) return;
        input.value = query;
        input.dispatchEvent(new InputEvent('input', {
          bubbles: true, inputType: 'insertText', data: query,
        }));
        input.focus();
      };
      setTimeout(transfer, 50);
    }
  }

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
        if (reload) await this.reloadStore();
        return result;
      } catch (error: unknown) {
        if (!healStaleProjection || !isProjectionConflict(error)) throw error;
        return this.rebuildAndRetry(action, reload);
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
   * Retrying is safe because a conflict is refused whole — partial application
   * of a validated transaction is a forbidden operation in the core's
   * capability contract, so nothing was written to repeat.
   */
  private async rebuildAndRetry<T>(
    action: () => T | PromiseLike<T>,
    reload: boolean,
  ): Promise<T> {
    new Notice('Canonical files changed since this view loaded — rebuilding the projection, then retrying.');
    await this.gateway.call(['generate'], { expectJson: false });
    await this.reloadStore();
    const result = await action();   // re-read snapshot: `capability()` takes it at call time
    if (reload) await this.reloadStore();
    return result;
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

  /**
   * Hard rule 10 (core CLAUDE.md §13): `Job/` is quarantined. This is its
   * mechanical enforcement. A `Job/…` path never leaves the vault, so the
   * escape checks in the open helpers below cannot catch it — and every open
   * funnels through one of them.
   */
  isQuarantinedPath(path: string): boolean {
    return this.resources.isQuarantinedPath(path);
  }
  refuseQuarantined(path: string): boolean {
    return this.resources.refuseQuarantined(path);
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
  openJobPath(path: string) {
    return this.resources.openJobPath(path);
  }
  openRecord(record: ProjectionRecord | null | undefined) {
    if (!record) return;
    const recordId = asString(record.id);
    if (record.type === 'unit' && recordId) return this.openUnit(recordId);
    if (record.type === 'module' && recordId) return this.openModule(recordId);
    if (record.type === 'project' && recordId) return this.openProject(recordId);
    if (record.type === 'program' && recordId) return this.openProgram(recordId);
    if (record.type === 'source' && recordId) return this.openSourceDetail(recordId);
    if (record.type === 'topic-pack' && recordId) return this.openTopicPackDetail(recordId);
    if (record.type === 'collection' && recordId) return this.openCatalogueDetail(recordId);
    if (record.type === 'note' || record.type === 'concept') {
      if (record.path) return this.openAuthoredPath(record.path);
      return this.openLibraryFiltered(record.type);
    }
    if (record.type === 'workspace') {
      if (record.project_id) return this.openProject(record.project_id);
      const unit = (record.unit_ids || [])
        .map((id: string) => this.store.get(id))
        .find(Boolean);
      if (unit?.id) return this.openUnit(unit.id);
      const module = (record.module_ids || [])
        .map((id: string) => this.store.get(id))
        .find(Boolean);
      return module?.id ? this.openModule(module.id) : this.openHome();
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
