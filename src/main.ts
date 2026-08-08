import {
  Plugin,
  Notice,
  type WorkspaceLeaf,
} from 'obsidian';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as nodePath from 'node:path';
import process from 'node:process';
import { shell } from 'electron';

import { GlobalSearchModal } from './app/global-search';
import { ApplicationRouter } from './app/router';
import { UnitNoteModal } from './app/unit-note-modal';
import { button, safeWebUrl } from './components';
import { asSessionReview, isProjectionConflict } from './contracts/gateway-v1';
import {
  asLibraryCollection,
  asProjectDetailTab,
  type LibrarySourceFiltersV1,
} from './contracts/route-v1';
import {
  DEFAULT_SETTINGS, LEARN_AREAS, LEGACY_VIEW_TYPES, VIEW_ATLAS, VIEW_BOUNDARY,
  VIEW_DIAGNOSTICS, VIEW_GARDEN, VIEW_HOME, VIEW_LIBRARY, VIEW_MODULE, VIEW_NAV,
  VIEW_PROGRAM, VIEW_PROJECT, VIEW_REVIEW, VIEW_SHELVING, VIEW_UNIT,
} from './constants';
import { GatewayClient, explicitAiContext } from './gateway-client';
import { AIActionClient } from './infrastructure/ai-action-client';
import { ManifestStore } from './manifest-store';
import { LearningOSSettingsTab, SessionEndModal } from './settings';
import { AtlasView } from './views/atlas-view';
import { BoundaryView } from './views/boundary-view';
import { GardenView } from './views/garden-view';
import { HomeView } from './views/home-view';
import { LibraryView } from './views/library-view';
import { ModuleView } from './views/module-view';
import { NavView } from './views/nav-view';
import { ProgramView } from './views/program-view';
import { ProjectView } from './views/project-view';
import { DiagnosticsView, ReviewView } from './views/review-view';
import { ShelvingView } from './views/shelving-view';
import { UnitView } from './views/unit-view';
import type { ProjectionRecord } from './contracts/manifest-v2';

interface RecoveredStageDraft {
  id: string;
  title: string;
  text: string;
}

interface UnitNoteDraft {
  title: string;
  text: string;
  recoveredStageIds: string[];
}

interface PythonResolution {
  path: string;
  origin: string;
  attempted: string[];
}

type LosCallback = (
  error: Error | null,
  stdout: string,
  stderr: string,
) => void;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface LearningOSStageDraft {
  text: string;
}

interface LearningOSUnitNoteDraft {
  title: string;
  text: string;
}

interface LearningOSInboxDraft {
  title: string;
  text: string;
}

interface LearningOSUiDrafts {
  stages: Record<string, LearningOSStageDraft>;
  unitNotes: Record<string, LearningOSUnitNoteDraft>;
  selectedStages: Record<string, string>;
  inbox: LearningOSInboxDraft;
  doneWhen: Record<string, boolean[]>;
}

type LearningOSSettings = typeof DEFAULT_SETTINGS & {
  uiDrafts: LearningOSUiDrafts;
};

export class LearningOSUI extends Plugin {
  declare store: ManifestStore;
  declare router: ApplicationRouter;
  declare gateway: GatewayClient;
  declare aiActions: AIActionClient;
  declare settings: LearningOSSettings;
  declare activeNav: string;

  private draftSaveTimer:
    ReturnType<typeof setTimeout> | null = null;

  lastAiPrompt = '';

  async onload(): Promise<void> {
    const loadedSettings = await this.loadData<
      Partial<LearningOSSettings> | null
    >();
    const savedSettings = loadedSettings ?? {};

    this.settings = {
      ...DEFAULT_SETTINGS,
      ...savedSettings,
      uiDrafts: savedSettings.uiDrafts ?? {
        stages: {},
        unitNotes: {},
        selectedStages: {},
        inbox: {
          title: '',
          text: '',
        },
        doneWhen: {},
      },
    };
    this.settings.uiDrafts ||= { stages: {}, unitNotes: {}, selectedStages: {}, inbox: { title: '', text: '' }, doneWhen: {} };
    this.settings.uiDrafts.stages ||= {};
    this.settings.uiDrafts.unitNotes ||= {};
    this.settings.uiDrafts.selectedStages ||= {};
    this.settings.uiDrafts.inbox ||= { title: '', text: '' };
    this.settings.uiDrafts.doneWhen ||= {};
    this.draftSaveTimer = null;
    for (const type of LEGACY_VIEW_TYPES) this.app.workspace.detachLeavesOfType(type);
    this.store = new ManifestStore(this.app);
    this.gateway = new GatewayClient(this);
    this.aiActions = new AIActionClient(this);
    this.router = new ApplicationRouter(this);
    await this.store.load();
    this.registerView(VIEW_HOME, (leaf: WorkspaceLeaf) => new HomeView(leaf, this));
    this.registerView(VIEW_NAV, (leaf: WorkspaceLeaf) => new NavView(leaf, this));
    this.registerView(VIEW_PROGRAM, (leaf: WorkspaceLeaf) => new ProgramView(leaf, this));
    this.registerView(VIEW_MODULE, (leaf: WorkspaceLeaf) => new ModuleView(leaf, this));
    this.registerView(VIEW_PROJECT, (leaf: WorkspaceLeaf) => new ProjectView(leaf, this));
    this.registerView(VIEW_UNIT, (leaf: WorkspaceLeaf) => new UnitView(leaf, this));
    this.registerView(VIEW_LIBRARY, (leaf: WorkspaceLeaf) => new LibraryView(leaf, this));
    this.registerView(VIEW_ATLAS, (leaf: WorkspaceLeaf) => new AtlasView(leaf, this));
    this.registerView(VIEW_SHELVING, (leaf: WorkspaceLeaf) => new ShelvingView(leaf, this));
    this.registerView(VIEW_BOUNDARY, (leaf: WorkspaceLeaf) => new BoundaryView(leaf, this));
    this.registerView(VIEW_REVIEW, (leaf: WorkspaceLeaf) => new ReviewView(leaf, this));
    this.registerView(VIEW_GARDEN, (leaf: WorkspaceLeaf) => new GardenView(leaf, this));
    this.registerView(VIEW_DIAGNOSTICS, (leaf: WorkspaceLeaf) => new DiagnosticsView(leaf, this));
    this.addSettingTab(new LearningOSSettingsTab(this.app, this));
    this.addRibbonIcon('route', 'Open LearningOS', () => this.openHome());
    this.addCommand({ id: 'open-home', name: 'Open Home', callback: () => this.openHome() });
    this.addCommand({ id: 'open-current-stage', name: 'Open current stage', callback: () => this.openResume() });
    this.addCommand({ id: 'open-modules', name: 'Open Modules', callback: () => this.openModules() });
    this.addCommand({ id: 'open-projects', name: 'Open Projects', callback: () => this.openProjects() });
    this.addCommand({ id: 'open-library', name: 'Open Library', callback: () => this.openLibrary() });
    this.addCommand({ id: 'open-global-search', name: 'Search LearningOS', callback: () => this.openGlobalSearch() });
    this.addCommand({ id: 'open-atlas', name: 'Open Domain atlas', callback: () => this.openAtlas() });
    this.addCommand({ id: 'open-garden', name: 'Open Garden', callback: () => this.openGarden() });
    this.addCommand({ id: 'rebuild-projection', name: 'Validate and rebuild projection', callback: () => this.generate() });
    this.addCommand({ id: 'end-learning-session', name: 'End learning session safely', callback: () => this.reviewSessionEnd() });
    this.app.workspace.onLayoutReady(async () => {
      for (const type of LEGACY_VIEW_TYPES) this.app.workspace.detachLeavesOfType(type);
      await this.router.openNavigator();
      if (this.settings.collapseSidebars) this.app.workspace.rightSplit?.collapse();
      if (this.settings.openHomeOnStartup) await this.router.restore();
    });
  }

  onunload(): void {
    if (this.draftSaveTimer) clearTimeout(this.draftSaveTimer);
    void this.saveData(this.settings);
    for (const type of [VIEW_HOME, VIEW_NAV, VIEW_PROGRAM, VIEW_MODULE, VIEW_PROJECT, VIEW_UNIT,
      VIEW_LIBRARY, VIEW_ATLAS, VIEW_SHELVING, VIEW_BOUNDARY, VIEW_REVIEW,
      VIEW_GARDEN, VIEW_DIAGNOSTICS]) this.app.workspace.detachLeavesOfType(type);
  }

  scheduleDraftSave(): void {
    if (this.draftSaveTimer) clearTimeout(this.draftSaveTimer);
    this.draftSaveTimer = setTimeout(() => {
      this.draftSaveTimer = null;
      void this.saveData(this.settings);
    }, 250);
  }

  stageDraftKey(unitId: string, stageId: string): string { return `${unitId}::${stageId}`; }
  getStageDraft(
    unitId: string,
    stageId: string,
    savedText = '',
  ): { text: string; dirty: boolean } {
    const key = this.stageDraftKey(unitId, stageId);
    const entry = this.settings.uiDrafts.stages[key];
    return { text: entry?.text ?? savedText, dirty: entry != null && entry.text !== savedText };
  }
  setStageDraft(
    unitId: string,
    stageId: string,
    text: string,
    savedText = '',
  ): void {
    const key = this.stageDraftKey(unitId, stageId);
    if (text === savedText) delete this.settings.uiDrafts.stages[key];
    else this.settings.uiDrafts.stages[key] = { text };
    this.scheduleDraftSave();
  }
  clearStageDraft(unitId: string, stageId: string): void {
    delete this.settings.uiDrafts.stages[this.stageDraftKey(unitId, stageId)];
    this.scheduleDraftSave();
  }
  getUnitNoteDraft(
    unitId: string,
    stages: ProjectionRecord[] = [],
  ): UnitNoteDraft {
    const saved = this.settings.uiDrafts.unitNotes[unitId];
    const recovered: RecoveredStageDraft[] = [];
    for (const stage of stages || []) {
      const entry = this.settings.uiDrafts.stages[this.stageDraftKey(unitId, stage.id)];
      if (entry?.text?.trim()) recovered.push({ id: stage.id, title: stage.title || stage.id, text: entry.text });
    }
    const recoveredText = recovered
      .map((row) => `### ${row.title}\n\n${row.text.trim()}`).join('\n\n');
    const savedText = String(saved?.text || '').trim();
    return {
      title: saved?.title || (recovered.length ? 'Recovered stage drafts' : ''),
      text: [savedText, recoveredText].filter(Boolean).join('\n\n'),
      recoveredStageIds: recovered.map((row) => row.id),
    };
  }
  setUnitNoteDraft(
    unitId: string,
    title: string,
    text: string,
  ): void {
    if (!String(title || '').trim() && !String(text || '').trim()) delete this.settings.uiDrafts.unitNotes[unitId];
    else this.settings.uiDrafts.unitNotes[unitId] = { title, text };
    this.scheduleDraftSave();
  }
  clearUnitNoteDraft(
    unitId: string,
    recoveredStageIds: readonly string[] = [],
  ): void {
    delete this.settings.uiDrafts.unitNotes[unitId];
    for (const stageId of recoveredStageIds || []) {
      delete this.settings.uiDrafts.stages[this.stageDraftKey(unitId, stageId)];
    }
    this.scheduleDraftSave();
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
    return this.settings.uiDrafts.selectedStages[unitId] || null;
  }
  setSelectedStage(
    unitId: string,
    stageId: string | null,
  ): void {
    if (stageId) this.settings.uiDrafts.selectedStages[unitId] = stageId;
    else delete this.settings.uiDrafts.selectedStages[unitId];
    this.scheduleDraftSave();
  }
  /** Done-when ticks are UI-owned working state: they help the learner see how
   *  far through a stage's criteria they are, and are never a second record of
   *  completion. The core still learns only "complete" from `stage-progress`. */
  getDoneWhen(unitId: string, stageId: string): boolean[] {
    return this.settings.uiDrafts.doneWhen[this.stageDraftKey(unitId, stageId)] || [];
  }
  setDoneWhen(
    unitId: string,
    stageId: string,
    index: number,
    checked: boolean,
  ): void {
    const key = this.stageDraftKey(unitId, stageId);
    const marks: boolean[] = [
      ...(this.settings.uiDrafts.doneWhen[key] || []),
    ];
    marks[index] = checked;
    if (marks.some(Boolean)) this.settings.uiDrafts.doneWhen[key] = marks;
    else delete this.settings.uiDrafts.doneWhen[key];
    this.scheduleDraftSave();
  }
  clearDoneWhen(unitId: string, stageId: string): void {
    delete this.settings.uiDrafts.doneWhen[this.stageDraftKey(unitId, stageId)];
    this.scheduleDraftSave();
  }
  getInboxDraft() { return { ...this.settings.uiDrafts.inbox }; }
  setInboxDraft(title: string, text: string): void {
    this.settings.uiDrafts.inbox = { title, text };
    this.scheduleDraftSave();
  }
  clearInboxDraft(): void {
    this.settings.uiDrafts.inbox = { title: '', text: '' };
    this.scheduleDraftSave();
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
    const base = this.app.vault.adapter.getBasePath();
    const configured = String(this.settings.pythonPath || '').trim();
    const searchOrder: Array<readonly [string, string]> = [
      [configured, 'configured in settings'],
      [nodePath.join(base, '.venv', 'bin', 'python'), 'project virtual environment'],
      [nodePath.join(base, '.venv', 'Scripts', 'python.exe'), 'project virtual environment (Windows)'],
    ];
    const candidates = searchOrder.filter(([path]) => path);
    const attempted = candidates.map(([path]) => path);
    for (const [path, origin] of candidates) {
      if (fs.existsSync(path)) return { path, origin, attempted };
    }
    const fallback = process?.platform === 'win32' ? 'python' : 'python3';
    return { path: fallback, origin: 'PATH fallback', attempted: [...attempted, fallback] };
  }

  /**
   * Run the CLI. `stdin` carries a capability envelope when there is one.
   *
   * Envelopes go down stdin rather than a `--payload-file` temp file: a temp
   * file would put canonical intent on disk on every write, including the
   * ones that fail, leaving cleanup as a thing that can be forgotten.
   */
  runLos(args: string[], callback: LosCallback, stdin?: string): void {
    const base = this.app.vault.adapter.getBasePath();
    const python = this.resolvePython().path;
    const script = nodePath.join(base, 'tools', 'los.py');
    const child = execFile(
      python, [script, ...args],
      { cwd: base, timeout: 180000, maxBuffer: 8 * 1024 * 1024 },
      callback,
    );
    if (stdin !== undefined) {
      child.stdin?.end(stdin);
    }
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
  openProject(projectId: string, tab = 'overview') {
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
    const posix = String(path || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
    return posix === 'Job' || posix.startsWith('Job/') || posix.includes('/Job/');
  }
  refuseQuarantined(path: string): boolean {
    if (!this.isQuarantinedPath(path)) return false;
    new Notice('Job/ is quarantined — LearningOS never opens or displays it.');
    return true;
  }

  async openVaultPath(path: string) {
    if (this.refuseQuarantined(path)) return;
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file) { new Notice(`File unavailable: ${path}`); return; }
    let existing: WorkspaceLeaf | null = null;
    this.app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
      if (!existing && leaf.view?.file?.path === path) existing = leaf;
    });
    if (existing) {
      this.app.workspace.revealLeaf(existing);
      this.app.workspace.setActiveLeaf?.(existing, { focus: true });
      return existing;
    }
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.openFile(file);
    return leaf;
  }
  async openExternalPath(
    path: string,
    successMessage = 'Opened in the default app.',
  ): Promise<boolean> {
    if (this.refuseQuarantined(path)) return false;
    if (!path || !fs.existsSync(path)) { new Notice(`File unavailable: ${path || 'unknown path'}`); return false; }
    const error = await shell.openPath(path);
    if (error) { new Notice(`Could not open file: ${error}`); return false; }
    new Notice(successMessage);
    return true;
  }
  openMaterialPath(path: string) {
    const vault = this.app.vault.adapter.getBasePath();
    const learningRoot = nodePath.dirname(vault);
    const materialsRoot = nodePath.resolve(learningRoot, 'materials');
    const fullPath = nodePath.resolve(learningRoot, path || '');
    const relative = nodePath.relative(materialsRoot, fullPath);
    if (!path || relative.startsWith('..') || nodePath.isAbsolute(relative)) {
      new Notice(`Unsafe material path refused: ${path || 'unknown path'}`); return false;
    }
    return this.openExternalPath(fullPath, 'Opened the local material in its default app.');
  }
  openAuthoredPath(path: string) {
    if (this.refuseQuarantined(path)) return false;
    const extension = nodePath.extname(path || '').toLocaleLowerCase();
    if (['.md', '.pdf', '.canvas', '.base'].includes(extension)) return this.openVaultPath(path);
    const base = this.app.vault.adapter.getBasePath();
    const fullPath = nodePath.resolve(base, path || '');
    const relative = nodePath.relative(base, fullPath);
    if (!path || relative.startsWith('..') || nodePath.isAbsolute(relative)) {
      new Notice(`Unsafe vault path refused: ${path || 'unknown path'}`); return false;
    }
    return this.openExternalPath(fullPath, 'Opened the authored file in its default app.');
  }
  openRecord(record: ProjectionRecord | null | undefined) {
    if (!record) return;
    if (record.type === 'unit') return this.openUnit(record.id);
    if (record.type === 'module') return this.openModule(record.id);
    if (record.type === 'project') return this.openProject(record.id);
    if (record.type === 'program') return this.openProgram(record.id);
    if (record.type === 'source') return this.openSourceDetail(record.id);
    if (record.type === 'topic-pack') return this.openTopicPackDetail(record.id);
    if (record.type === 'collection') return this.openCatalogueDetail(record.id);
    if (record.type === 'note' || record.type === 'concept') {
      if (record.path) return this.openAuthoredPath(record.path);
      return this.openLibraryFiltered(record.type);
    }
    if (record.type === 'workspace') {
      if (record.project_id) return this.openProject(record.project_id);
      const unit = (record.unit_ids || [])
        .map((id: string) => this.store.get(id))
        .find(Boolean);
      if (unit) return this.openUnit(unit.id);
      const module = (record.module_ids || [])
        .map((id: string) => this.store.get(id))
        .find(Boolean);
      return module ? this.openModule(module.id) : this.openHome();
    }
    if (record.path) return this.openAuthoredPath(record.path);
  }
  openResource(resource: ProjectionRecord) {
    const materialPath = typeof resource.material_path === 'string'
      ? resource.material_path
      : '';
    if (materialPath.trim()) return this.openMaterialPath(materialPath);

    const vaultPath = typeof resource.vault_path === 'string'
      ? resource.vault_path
      : '';
    if (vaultPath.trim()) {
      if (vaultPath.trim().toLowerCase().startsWith('material://')) {
        new Notice(`Refused an unresolved material link: ${vaultPath.trim().slice(0, 80)}`);
        return false;
      }
      return this.openVaultPath(vaultPath);
    }

    if (resource.url) {
      // A projected URL is still untrusted input to a viewer: `javascript:`,
      // `data:` and `file:` never reach Electron.
      const url = safeWebUrl(resource.url);
      if (!url) { new Notice(`Refused an unsupported link: ${String(resource.url).slice(0, 80)}`); return false; }
      const leaf = this.app.workspace.getLeaf(true);
      return leaf.setViewState({ type: 'webviewer', active: true, state: { url: url.href } });
    }
  }
  copyText(value: string): void {
    try { navigator.clipboard.writeText(value); new Notice(`Copied ${value}`); }
    catch (_) { new Notice(value); }
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
