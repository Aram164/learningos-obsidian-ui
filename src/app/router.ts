import {
  LEARN_AREAS, VIEW_ATLAS, VIEW_BOUNDARY, VIEW_DIAGNOSTICS, VIEW_GARDEN,
  VIEW_HOME, VIEW_LIBRARY, VIEW_MODULE, VIEW_NAV, VIEW_PROGRAM, VIEW_PROJECT,
  VIEW_REVIEW, VIEW_SHELVING, VIEW_UNIT,
} from '../constants';

/**
 * Explicit application router introduced as a compatibility layer.
 * Product features navigate with route records; only this adapter knows leaves.
 */
export class ApplicationRouter {
  private readonly plugin: any;
  navigation: any;
  overlay: any;
  constructor(plugin: any) {
    this.plugin = plugin;
    const saved = plugin.settings.navigation;
    this.navigation = saved?.version === 1 && saved.current
      ? saved
      : { version: 1, current: this.fromLegacy(plugin.settings.lastView), history: [] };
    this.overlay = null;
  }

  fromLegacy(legacy: any): any {
    const type = legacy?.type;
    const state = legacy?.state || {};
    if (type === VIEW_PROGRAM) {
      return state.programId === 'inbox'
        ? { name: 'capture' }
        : { name: 'learn', programId: state.programId || LEARN_AREAS[0][0] };
    }
    if (type === VIEW_MODULE) {
      if (state.screen === 'groups') return { name: 'module-groups' };
      if (state.screen === 'list') return { name: 'module-list', groupId: state.groupId, query: state.query || '' };
      return { name: 'module-detail', moduleId: state.moduleId, componentId: state.componentId || null, tab: state.tab || null };
    }
    if (type === VIEW_UNIT) return { name: 'unit', unitId: state.unitId, stageId: state.stageId || null };
    if (type === VIEW_PROJECT) return state.projectId
      ? { name: 'project-detail', projectId: state.projectId, tab: state.tab || 'overview' }
      : { name: 'project-list', query: state.query || '' };
    if (type === VIEW_LIBRARY) return this.libraryRouteFromState(state);
    if (type === VIEW_ATLAS) return { name: 'atlas', domain: state.domain || null };
    if (type === VIEW_SHELVING) return { name: 'shelving', unitId: state.unitId || null };
    if (type === VIEW_BOUNDARY) return { name: 'boundary', boundaryId: state.boundaryId };
    if (type === VIEW_REVIEW) return { name: 'review' };
    if (type === VIEW_GARDEN) return { name: 'garden' };
    if (type === VIEW_DIAGNOSTICS) return { name: 'diagnostics' };
    return { name: 'home' };
  }

  libraryRouteFromState(state: any = {}) {
    if (state.screen === 'group') return {
      name: 'library-group', collection: state.collection || 'sources', groupId: state.groupId,
      query: state.query || '', facet: state.facet || 'all',
    };
    if (state.screen === 'source-detail') return {
      name: 'source-detail', resourceId: state.resourceId, fromGroupId: state.fromGroupId || null,
      query: state.query || '', facet: state.facet || 'all',
    };
    if (state.screen === 'topic-pack-detail') return {
      name: 'topic-pack-detail', topicPackId: state.topicPackId,
      fromGroupId: state.fromGroupId || null, query: state.query || '',
    };
    if (state.screen === 'catalogue-detail') return { name: 'catalogue-detail', catalogueId: state.catalogueId };
    if (state.screen === 'legacy-list') return {
      name: 'legacy-library-list', recordType: state.recordType || 'note',
      query: state.query || '', domain: state.domain || '',
    };
    if (state.recordId) {
      const record = this.plugin.store?.get?.(state.recordId);
      if (record?.type === 'source' || state.recordType === 'source') {
        return { name: 'source-detail', resourceId: state.recordId };
      }
      if (record?.type === 'topic-pack') return { name: 'topic-pack-detail', topicPackId: state.recordId };
      if (record?.type === 'collection' || state.recordType === 'collection') {
        return { name: 'catalogue-detail', catalogueId: state.recordId };
      }
    }
    if (state.recordType && !['source', 'topic-pack'].includes(state.recordType)) {
      return { name: 'legacy-library-list', recordType: state.recordType, query: state.query || '', domain: state.domain || '' };
    }
    return { name: 'library-home', collection: state.recordType === 'topic-pack' ? 'topic-packs' : 'sources' };
  }

  descriptor(route: any): any {
    switch (route?.name) {
      case 'home': return { type: VIEW_HOME, state: {}, nav: 'home', pin: true };
      case 'learn': return { type: VIEW_PROGRAM, state: { programId: route.programId }, nav: 'learn' };
      case 'capture': return { type: VIEW_PROGRAM, state: { programId: 'inbox' }, nav: 'capture' };
      case 'review': return { type: VIEW_REVIEW, state: {}, nav: 'review' };
      case 'garden': return { type: VIEW_GARDEN, state: {}, nav: 'review' };
      case 'diagnostics': return { type: VIEW_DIAGNOSTICS, state: {}, nav: 'diagnostics' };
      case 'program': return {
        type: VIEW_PROGRAM, state: { programId: route.programId },
        nav: route.programId === 'queue-needs-map' ? 'review' : 'learn',
      };
      case 'module-groups': return { type: VIEW_MODULE, state: { screen: 'groups' }, nav: 'modules' };
      case 'module-list': return {
        type: VIEW_MODULE,
        state: { screen: 'list', groupId: route.groupId, query: route.query || '' },
        nav: 'modules',
      };
      case 'module':
      case 'module-detail': return {
        type: VIEW_MODULE,
        state: {
          screen: 'detail', moduleId: route.moduleId,
          componentId: route.componentId || null, tab: route.tab || null,
        },
        nav: 'modules',
      };
      case 'project-list': return { type: VIEW_PROJECT, state: { screen: 'list', query: route.query || '' }, nav: 'projects' };
      case 'project-detail': return {
        type: VIEW_PROJECT, state: { screen: 'detail', projectId: route.projectId, tab: route.tab || 'overview' }, nav: 'projects',
      };
      case 'unit': return {
        type: VIEW_UNIT,
        state: { unitId: route.unitId, stageId: route.stageId || null },
        nav: 'learn',
      };
      case 'library-home': return {
        type: VIEW_LIBRARY, state: { screen: 'home', collection: route.collection || 'sources' }, nav: 'library',
      };
      case 'library-group': return {
        type: VIEW_LIBRARY,
        state: {
          screen: 'group', collection: route.collection || 'sources', groupId: route.groupId,
          query: route.query || '', facet: route.facet || 'all',
        },
        nav: 'library',
      };
      case 'source-detail': return {
        type: VIEW_LIBRARY,
        state: {
          screen: 'source-detail', resourceId: route.resourceId,
          fromGroupId: route.fromGroupId || null, query: route.query || '', facet: route.facet || 'all',
        },
        nav: 'library',
      };
      case 'topic-pack-detail': return {
        type: VIEW_LIBRARY,
        state: {
          screen: 'topic-pack-detail', topicPackId: route.topicPackId,
          fromGroupId: route.fromGroupId || null, query: route.query || '',
        },
        nav: 'library',
      };
      case 'catalogue-detail': return {
        type: VIEW_LIBRARY, state: { screen: 'catalogue-detail', catalogueId: route.catalogueId }, nav: 'library',
      };
      case 'legacy-library-list': return {
        type: VIEW_LIBRARY,
        state: { screen: 'legacy-list', recordType: route.recordType, query: route.query || '', domain: route.domain || '' },
        nav: 'library',
      };
      case 'library': {
        const compatible = this.libraryRouteFromState(route);
        return this.descriptor(compatible);
      }
      case 'atlas': return { type: VIEW_ATLAS, state: { domain: route.domain || null }, nav: 'atlas' };
      case 'shelving': return { type: VIEW_SHELVING, state: { unitId: route.unitId || null }, nav: 'review' };
      case 'boundary': return {
        type: VIEW_BOUNDARY, state: { boundaryId: route.boundaryId },
        nav: route.boundaryId === 'program-job-boundary' ? 'job' : 'masters',
      };
      default: return { type: VIEW_HOME, state: {}, nav: 'home', pin: true };
    }
  }

  sameRoute(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  async openLeaf(
    type: string,
    state: Record<string, any> = {},
    side: 'main' | 'left' = 'main',
  ): Promise<any> {
    let leaf = this.plugin.app.workspace.getLeavesOfType(type)[0];
    if (!leaf) {
      leaf = side === 'left'
        ? this.plugin.app.workspace.getLeftLeaf(false)
        : this.plugin.app.workspace.getLeaf(true);
    }
    await leaf.setViewState({ type, active: true, state });
    this.plugin.app.workspace.revealLeaf(leaf);
    this.plugin.app.workspace.setActiveLeaf?.(leaf, { focus: true });
    return leaf;
  }

  async openNavigator() { return this.openLeaf(VIEW_NAV, {}, 'left'); }

  async persist() {
    this.plugin.settings.navigation = this.navigation;
    delete this.plugin.settings.lastView;
    await this.plugin.saveData(this.plugin.settings);
  }

  openOverlay(overlay: Record<string, any>) {
    this.overlay = { ...overlay };
    return this.overlay;
  }
  updateOverlay(patch: Record<string, any>) {
    if (!this.overlay) return null;
    this.overlay = { ...this.overlay, ...patch };
    return this.overlay;
  }
  clearOverlay() { this.overlay = null; }

  /** Replace restorable route state without opening a leaf or adding history. */
  async remember(route: any) {
    this.navigation.current = route;
    await this.persist();
    return route;
  }

  async navigate(route: any, options: any = {}) {
    if (!options.preserveOverlay) this.clearOverlay();
    const descriptor = this.descriptor(route);
    const remember = options.remember !== false;
    const pushHistory = options.pushHistory !== false;
    const prior = this.navigation.current;
    if (remember && pushHistory && prior && !this.sameRoute(prior, route)) {
      const activeView = this.plugin.app.workspace.active?.view;
      const currentScroll = Number(options.scrollTop ?? activeView?.contentEl?.scrollTop ?? 0);
      const selectedElementId = options.selectedElementId || activeView?.selectedElementId || undefined;
      this.navigation.history.push({ route: prior, scrollTop: currentScroll, selectedElementId });
      this.navigation.history = this.navigation.history.slice(-50);
    }
    if (remember) {
      this.navigation.current = route;
      await this.persist();
    }
    this.plugin.setActiveNav(descriptor.nav);
    const leaf = await this.openLeaf(descriptor.type, descriptor.state);
    if (Number.isFinite(options.restoreScrollTop) && leaf?.view?.contentEl) {
      leaf.view.contentEl.scrollTop = Number(options.restoreScrollTop);
    }
    if (options.restoreSelectedElementId && leaf?.view) {
      leaf.view.selectedElementId = options.restoreSelectedElementId;
    }
    if (descriptor.pin && this.plugin.settings.pinHome) leaf.setPinned?.(true);
    return leaf;
  }

  async restore() {
    this.clearOverlay();
    const route = this.navigation.current || { name: 'home' };
    if (route.name !== 'home' && this.plugin.settings.pinHome) {
      const home = await this.navigate({ name: 'home' }, { remember: false, pushHistory: false });
      home.setPinned?.(true);
    }
    return this.navigate(route, { remember: true, pushHistory: false });
  }

  async back() {
    const entry = this.navigation.history.pop();
    if (!entry) return this.navigate({ name: 'home' }, { pushHistory: false });
    this.navigation.current = entry.route;
    await this.persist();
    return this.navigate(entry.route, {
      remember: false, pushHistory: false, restoreScrollTop: entry.scrollTop || 0,
      restoreSelectedElementId: entry.selectedElementId,
    });
  }

  snapshot() { return JSON.parse(JSON.stringify({ ...this.navigation, overlay: this.overlay })); }
}
