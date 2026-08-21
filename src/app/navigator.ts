/**
 * Every destination the application can open.
 *
 * These twenty-eight methods lived on `LearningOSUI` until 2026-08-21, where
 * they made up the largest part of a 523-line file that the engineering review
 * described as "almost none of it behaviour". They were not behaviourless —
 * `openLearn` remembers the area, `openUnit` restores the selected stage,
 * `openLibrary` and `openRecord` dispatch on record type — but that behaviour
 * belongs to navigation, not to being an Obsidian plugin, and putting it here
 * is what lets a view depend on navigation without depending on the plugin.
 *
 * The dependency list is deliberately explicit rather than "the plugin": the
 * router to move, the store to resolve a record into a destination, settings
 * and drafts for the two destinations that remember something, and the
 * resource opener for the one record type that opens a file instead of a view.
 * Six collaborators is not narrow, but each one is here because a named method
 * below needs it, which is the property the plugin reference never had.
 *
 * It also satisfies `GlobalSearchPlugin` on its own — that modal wants the
 * router, the store, and five open methods — so the extraction needed no
 * back-reference to the plugin. That was the test of whether this seam was
 * real: a facade that has to be handed the whole object it was carved out of
 * has not been carved out of anything.
 */
import { Notice, type App } from 'obsidian';
import { GlobalSearchModal } from './global-search';
import type { ApplicationRouter } from './router';
import type { DraftStore } from '../application/draft-store';
import { LEARN_AREAS } from '../constants';
import type { ProjectionRecord } from '../contracts/manifest';
import {
  asLibraryCollection,
  asProjectDetailTab,
  type LibrarySourceFiltersV1,
} from '../contracts/route-v1';
import type { ResourceOpener } from '../infrastructure/resource-opener';
import type { ManifestStore } from '../manifest-store';
import { asString } from '../projection/readers';
import type { LearningOSSettings } from './surface';

export class AppNavigator {
  constructor(
    private readonly app: App,
    readonly router: ApplicationRouter,
    readonly store: ManifestStore,
    private readonly settings: LearningOSSettings,
    private readonly drafts: DraftStore,
    private readonly resources: ResourceOpener,
  ) {}

  async openNavigator() { return this.router.openNavigator(); }
  async openHome() { return this.router.navigate({ name: 'home' }); }

  /** Learn is one destination; the areas are sub-areas inside it. */
  openLearn(programId: string | null = null) {
    const area = programId || this.settings.learnArea || LEARN_AREAS[0][0];
    this.settings.learnArea = area;
    this.drafts.scheduleSave();
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
    const selectedStage = stageId || this.drafts.getSelectedStage(unitId);
    if (selectedStage) this.drafts.setSelectedStage(unitId, selectedStage);
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
      if (record.path) return this.resources.openAuthoredPath(record.path);
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
    if (record.path) return this.resources.openAuthoredPath(record.path);
  }

  /**
   * Omnisearch's modal is another plugin's DOM, and this is the only place in
   * the UI that reaches into one. It fires the command, then polls for a
   * visible `.prompt-input` to seed. It will break silently on any Omnisearch
   * DOM change and no test can catch that; it is acceptable only because it
   * degrades to "modal opens, query not transferred".
   */
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
}
