import {
  LEARN_AREAS, VIEW_ATLAS, VIEW_BOUNDARY, VIEW_DIAGNOSTICS, VIEW_GARDEN,
  VIEW_HOME, VIEW_LIBRARY, VIEW_MODULE, VIEW_NAV, VIEW_PROGRAM, VIEW_PROJECT,
  VIEW_REVIEW, VIEW_SHELVING, VIEW_UNIT,
} from '../constants';
import type {
  ApplicationRouteV1,
  NavigationStateV1,
  OverlayStateV1,
} from '../contracts/route-v1';
import {
  asLibraryCollection,
  asLibrarySourceFilters,
  asProjectDetailTab,
} from '../contracts/route-v1';

/*
 * Legacy migration input.
 *
 * Persisted Obsidian view state predates the route contract, so it arrives
 * loosely shaped. It stays loose up to `fromLegacy`/`libraryRouteFromState`,
 * which are the only places allowed to turn it into a strict
 * `ApplicationRouteV1`. Everything downstream of them is contract-typed.
 */
type LegacyRouteState = Record<string, unknown>;

interface LegacyViewState {
  type?: unknown;
  state?: unknown;
}

function asLegacyState(value: unknown): LegacyRouteState {
  return value && typeof value === 'object' ? value as LegacyRouteState : {};
}

/** Loose value → required route string. */
function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value ? value : fallback;
}

/** Loose value → nullable route string. */
function asNullableText(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

interface RouteDescriptor {
  type: string;
  state: Record<string, unknown>;
  nav: string;
  pin?: boolean;
}

interface NavigationOptions {
  preserveOverlay?: boolean;
  remember?: boolean;
  pushHistory?: boolean;
  scrollTop?: number;
  selectedElementId?: string | undefined;
  restoreScrollTop?: number;
  restoreSelectedElementId?: string | undefined;
}

/**
 * The only parts of a leaf's view the router reads or restores.
 * `selectedElementId` is an application-owned property on Learning OS views,
 * not part of the host API — the router treats it as optional for that reason.
 */
interface RouterViewSurface {
  contentEl?: {
    scrollTop: number;
  };
  selectedElementId?: string | null;
}

interface RouterLeaf {
  setViewState(state: {
    type: string;
    active: boolean;
    state?: Record<string, unknown>;
  }): void | Promise<void>;
  setPinned?(value: boolean): void;
  view?: RouterViewSurface;
}

interface RouterHost {
  app: {
    workspace: {
      getLeavesOfType(type: string): RouterLeaf[];
      getLeaf(newLeaf?: boolean | string): RouterLeaf;
      getLeftLeaf?(split?: boolean): RouterLeaf | null;
      revealLeaf(leaf: RouterLeaf): void;
      setActiveLeaf?(leaf: RouterLeaf, options?: { focus?: boolean }): void;
      active?: {
        view?: RouterViewSurface;
      };
    };
  };
  settings: {
    navigation?: NavigationStateV1;
    lastView?: unknown;
    pinHome?: boolean;
  };
  store?: {
    get?(id: string): {
      type?: string;
    } | null;
  };
  saveData<T>(data: T): Promise<void>;
  setActiveNav(nav: string): void;
}

/**
 * Explicit application router introduced as a compatibility layer.
 * Product features navigate with route records; only this adapter knows leaves.
 */
export class ApplicationRouter {
  private readonly plugin: RouterHost;
  navigation: NavigationStateV1;
  overlay: OverlayStateV1;
  constructor(plugin: RouterHost) {
    this.plugin = plugin;
    const saved = plugin.settings.navigation;
    this.navigation = saved?.version === 1 && saved.current
      ? saved
      : { version: 1, current: this.fromLegacy(plugin.settings.lastView), history: [] };
    this.overlay = null;
  }

  fromLegacy(legacy: unknown): ApplicationRouteV1 {
    const input: LegacyViewState = legacy && typeof legacy === 'object' ? legacy as LegacyViewState : {};
    const type = asText(input.type);
    const state = asLegacyState(input.state);
    if (type === VIEW_PROGRAM) {
      return state.programId === 'inbox'
        ? { name: 'capture' }
        : { name: 'learn', programId: asText(state.programId, LEARN_AREAS[0][0]) };
    }
    if (type === VIEW_MODULE) {
      if (state.screen === 'groups') return { name: 'module-groups' };
      if (state.screen === 'list') return { name: 'module-list', groupId: asText(state.groupId), query: asText(state.query) };
      return {
        name: 'module-detail',
        moduleId: asText(state.moduleId),
        componentId: asNullableText(state.componentId),
        tab: asNullableText(state.tab),
      };
    }
    if (type === VIEW_UNIT) return { name: 'unit', unitId: asText(state.unitId), stageId: asNullableText(state.stageId) };
    if (type === VIEW_PROJECT) return state.projectId
      ? { name: 'project-detail', projectId: asText(state.projectId), tab: asProjectDetailTab(state.tab) }
      : { name: 'project-list', query: asText(state.query) };
    if (type === VIEW_LIBRARY) return this.libraryRouteFromState(state);
    if (type === VIEW_ATLAS) return { name: 'atlas', domain: asNullableText(state.domain) };
    if (type === VIEW_SHELVING) return { name: 'shelving', unitId: asNullableText(state.unitId) };
    if (type === VIEW_BOUNDARY) return { name: 'boundary', boundaryId: asText(state.boundaryId) };
    if (type === VIEW_REVIEW) return { name: 'review' };
    if (type === VIEW_GARDEN) return { name: 'garden' };
    if (type === VIEW_DIAGNOSTICS) return { name: 'diagnostics' };
    return { name: 'home' };
  }

  libraryRouteFromState(state: LegacyRouteState = {}): ApplicationRouteV1 {
    if (state.screen === 'group') return {
      name: 'library-group',
      collection: asLibraryCollection(state.collection),
      groupId: asText(state.groupId),
      query: asText(state.query),
      facet: asText(state.facet, 'all'),
      filters: asLibrarySourceFilters(state.filters),
    };
    if (state.screen === 'source-detail') return {
      name: 'source-detail',
      resourceId: asText(state.resourceId),
      fromGroupId: asNullableText(state.fromGroupId),
      query: asText(state.query),
      facet: asText(state.facet, 'all'),
      filters: asLibrarySourceFilters(state.filters),
    };
    if (state.screen === 'topic-pack-detail') return {
      name: 'topic-pack-detail', topicPackId: asText(state.topicPackId),
      fromGroupId: asNullableText(state.fromGroupId), query: asText(state.query),
    };
    if (state.screen === 'catalogue-detail') return { name: 'catalogue-detail', catalogueId: asText(state.catalogueId) };
    const recordType = asText(state.recordType);
    if (state.screen === 'legacy-list') return {
      name: 'legacy-library-list', recordType: recordType || 'note',
      query: asText(state.query), domain: asText(state.domain),
    };
    const recordId = asText(state.recordId);
    if (recordId) {
      const record = this.plugin.store?.get?.(recordId);
      if (record?.type === 'source' || recordType === 'source') {
        return { name: 'source-detail', resourceId: recordId };
      }
      if (record?.type === 'topic-pack') return { name: 'topic-pack-detail', topicPackId: recordId };
      if (record?.type === 'collection' || recordType === 'collection') {
        return { name: 'catalogue-detail', catalogueId: recordId };
      }
    }
    if (recordType && !['source', 'topic-pack'].includes(recordType)) {
      return { name: 'legacy-library-list', recordType, query: asText(state.query), domain: asText(state.domain) };
    }
    return {
      name: 'library-home',
      collection: recordType === 'topic-pack'
        ? 'topic-packs'
        : 'sources',
      query: asText(state.query),
      filters: asLibrarySourceFilters(state.filters),
    };
  }

  descriptor(route: ApplicationRouteV1): RouteDescriptor {
    switch (route?.name) {
      case 'home': return { type: VIEW_HOME, state: {}, nav: 'home', pin: true };
      case 'learn': return { type: VIEW_PROGRAM, state: { programId: route.programId }, nav: 'learn' };
      case 'capture': return { type: VIEW_PROGRAM, state: { programId: 'inbox' }, nav: 'capture' };
      case 'review': return { type: VIEW_REVIEW, state: {}, nav: 'review' };
      case 'garden': return { type: VIEW_GARDEN, state: {}, nav: 'garden' };
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
      case 'module-detail': return {
        type: VIEW_MODULE,
        state: {
          screen: 'detail', moduleId: route.moduleId,
          componentId: route.componentId || null,
          tab: route.tab || null,
        },
        nav: 'modules',
      };
      case 'project-list': return { type: VIEW_PROJECT, state: { screen: 'list', query: route.query || '' }, nav: 'projects' };
      case 'project-detail': return {
        type: VIEW_PROJECT, state: { screen: 'detail', projectId: route.projectId, tab: route.tab || 'structure' }, nav: 'projects',
      };
      case 'unit': return {
        type: VIEW_UNIT,
        state: { unitId: route.unitId, stageId: route.stageId || null },
        nav: 'learn',
      };
      case 'library-home': return {
        type: VIEW_LIBRARY,
        state: {
          screen: 'home',
          collection: route.collection || 'sources',
          query: route.query || '',
          filters: route.filters || asLibrarySourceFilters(null),
        },
        nav: 'library',
      };
      case 'library-group': return {
        type: VIEW_LIBRARY,
        state: {
          screen: 'group',
          collection: route.collection || 'sources',
          groupId: route.groupId,
          query: route.query || '',
          facet: route.facet || 'all',
          filters: route.filters || asLibrarySourceFilters(null),
        },
        nav: 'library',
      };
      case 'source-detail': return {
        type: VIEW_LIBRARY,
        state: {
          screen: 'source-detail',
          resourceId: route.resourceId,
          fromGroupId: route.fromGroupId || null,
          query: route.query || '',
          facet: route.facet || 'all',
          filters: route.filters || asLibrarySourceFilters(null),
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
    state: Record<string, unknown> = {},
    side: 'main' | 'left' = 'main',
  ): Promise<RouterLeaf> {
    let leaf = this.plugin.app.workspace.getLeavesOfType(type)[0];
    if (!leaf) {
      leaf = side === 'left'
        ? this.plugin.app.workspace.getLeftLeaf?.(false) ?? this.plugin.app.workspace.getLeaf(true)
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

  openOverlay(overlay: Exclude<OverlayStateV1, null>) {
    this.overlay = { ...overlay };
    return this.overlay;
  }
  updateOverlay(patch: Partial<Record<string, unknown>>) {
    if (!this.overlay) return null;
    this.overlay = { ...this.overlay, ...patch };
    return this.overlay;
  }
  clearOverlay() { this.overlay = null; }

  /** Replace restorable route state without opening a leaf or adding history. */
  async remember(route: ApplicationRouteV1): Promise<ApplicationRouteV1> {
    this.navigation.current = route;
    await this.persist();
    return route;
  }

  async navigate(route: ApplicationRouteV1, options: NavigationOptions = {}) {
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
