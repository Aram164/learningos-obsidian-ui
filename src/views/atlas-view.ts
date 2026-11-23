import { withRenderFocus } from '../accessibility/render-focus';
import {
  ItemView,
  Notice,
  type WorkspaceLeaf,
} from 'obsidian';
import { errorMessage } from '../projection/readers';
import { VIEW_ATLAS } from '../constants';
import {
  asAtlasDepth,
  asAtlasLens,
  type AtlasDepthV1,
  type AtlasLensV1,
} from '../contracts/route-v1';
import type {
  AtlasHost,
  DomainAtlasState,
  ConceptAtlasState,
  AtlasInspectorTab,
  AtlasPlugin,
  AtlasRouteState,
} from '../features/atlas/ports';
import { renderAtlas, rememberConcept } from '../features/atlas/shell';
import {
  BoardController, advancedBoardAvailable,
  type BoardCatalogEntry,
} from '../features/atlas/board-controller';
import { AtlasBoardVault } from '../infrastructure/atlas-board-vault';
import { drawDesignScreen } from '../designs/registry';
import {
  editDraft,
  isDecorated,
  rowOf,
  type RelationDraft,
  type RelationOperation,
  type RelationRow,
} from '../features/atlas/relation-editor';
import {
  buildAtlasGraph,
  EMPTY_FILTERS,
  type AtlasEdge,
  type AtlasFilters,
} from '../features/atlas/graph';
import type { RelationActionState } from '../features/atlas/ports';
import { openEvidenceBinding } from '../features/atlas/evidence';

/** The artifact every relation change is guarded against, as Core names it. */
const RELATION_REGISTRY = 'registry-concept-relations';

interface AtlasViewState {
  concept?: string | null;
  module?: string | null;
  lens?: AtlasLensV1;
  depth?: AtlasDepthV1;
}

interface ConceptAttention {
  readonly query: string;
  readonly browseAll: boolean;
  readonly visibleLimit: number;
  readonly domain: string | null;
  readonly subdomain: string | null;
  readonly selected: string | null;
  readonly recentsOnly: boolean;
  readonly tab: AtlasInspectorTab;
  readonly semanticOpen: boolean;
  readonly remainderOpen: boolean;
  readonly edgeId: string | null;
  readonly disclosures: ReadonlyMap<string, boolean>;
}

/**
 * The Concept Atlas leaf (ADR-016).
 *
 * This shell owns persisted route fields and per-leaf attention. Application
 * navigation replaces Atlas selections; the concept trail supplies Back and
 * Forward within this leaf without changing that navigation contract. Search,
 * disclosures and inspector attention stay outside both histories.
 */
export class AtlasView extends ItemView implements AtlasHost {
  readonly plugin: AtlasPlugin;
  private concept: string | null = null;
  private module: string | null = null;
  private lens: AtlasLensV1 = 'prerequisites';
  private depth: AtlasDepthV1 = 1;

  query = '';
  readonly domains: DomainAtlasState = {
    query: '', selected: null, collection: 'notes', role: null, authorship: null,
    selectedNote: null, selectedShelf: null, limits: new Map(), disclosures: new Map(),
  };
  readonly concepts: ConceptAtlasState = {
    browseAll: false, visibleLimit: 30, domain: null, subdomain: null,
    selected: null, recentsOnly: false, disclosures: new Map(),
  };
  boardScope: string | null = null;

  boardCatalog(): readonly BoardCatalogEntry[] {
    return this.plugin.store.atlasBoards();
  }

  private boardController(): BoardController {
    return new BoardController(new AtlasBoardVault(this.app));
  }

  async openAtlasBoard(entry: BoardCatalogEntry, advanced = false): Promise<void> {
    if (advanced) {
      const installed = await this.app.vault.adapter.exists(
        '.obsidian/plugins/advanced-canvas/manifest.json');
      if (!advancedBoardAvailable(this.plugin.settings.atlasAdvancedCanvas, installed)) {
        new Notice('Advanced board needs the atlasAdvancedCanvas setting and the pinned Advanced Canvas plugin.');
        return;
      }
    }
    const vault = new AtlasBoardVault(this.app);
    const template = await vault.read(entry.template_path);
    if (template === null) { new Notice('Board unavailable. Rebuild views and try again.'); return; }
    const result = await this.boardController().openBoard(entry, template);
    if (!result.ok) new Notice(result.reason);
  }

  async usePortalChild(child: BoardCatalogEntry): Promise<void> {
    const parent = this.boardCatalog().find(
      (entry) => entry.kind === child.parent_kind && entry.id === child.parent_id);
    if (!parent) {
      new Notice('This scope has no parent board to point at it.');
      return;
    }
    const result = await this.boardController().useEditableChild(parent, child);
    new Notice(result.ok
      ? 'Portals on the parent board now open the editable child.'
      : result.reason);
    this.render();
  }

  async refreshAtlasBoard(entry: BoardCatalogEntry): Promise<void> {
    const vault = new AtlasBoardVault(this.app);
    const [template, preview] = [await vault.read(entry.template_path),
      await vault.read(entry.working_path)];
    if (template === null || preview === null) {
      new Notice('Board unavailable. Reopen it and review before refreshing.');
      return;
    }
    const result = await this.boardController().refreshBoard(entry, template, preview);
    new Notice(result.ok ? 'Board refreshed.' : result.reason);
    this.render();
  }

  tab: AtlasInspectorTab = 'summary';
  semanticOpen = false;
  remainderOpen = false;
  edgeId: string | null = null;
  editor: RelationDraft | null = null;
  filters: AtlasFilters = { ...EMPTY_FILTERS };
  relationAction: RelationActionState | null = null;
  inspectorOrigin: string | null = null;
  focusInspector = false;
  restoreFocus = false;

  openEvidence(relationId: string, ordinal: number): void {
    openEvidenceBinding({
      store: this.plugin.store,
      openMaterialPath: (path, destination) => this.plugin.openMaterialPath(path, destination),
      notify: (message) => new Notice(message),
    }, relationId, ordinal);
  }

  /** The exact stored row for one projected edge, via `atlas.context`. */
  private async exactRow(edge: AtlasEdge): Promise<RelationRow | null> {
    try {
      const value = await this.plugin.gateway.atlasContext(edge.from, {
        expectedSnapshot: this.plugin.store.snapshotId,
      }) as { relations?: unknown };
      const rows = Array.isArray(value?.relations) ? value.relations : [];
      const match = rows.find((row): row is RelationRow => {
        const candidate = row as RelationRow | null;
        return Boolean(candidate)
          && candidate?.from === edge.from
          && candidate?.type === edge.type
          && candidate?.to === edge.to;
      });
      return match ?? null;
    } catch {
      return null;
    }
  }

  editRelation(edge: AtlasEdge): void {
    void (async () => {
      const exact = await this.exactRow(edge);
      if (!exact && isDecorated(edge)) {
        new Notice('The exact stored connection could not be read, so it was not opened for editing.');
        return;
      }
      this.editor = editDraft(edge, exact ?? undefined);
      this.render();
    })();
  }

  async togglePin(edge: AtlasEdge): Promise<void> {
    const exact = await this.exactRow(edge);
    if (!exact && isDecorated(edge)) {
      new Notice('The exact stored connection could not be read, so nothing was pinned or unpinned.');
      return;
    }
    const old = exact ?? rowOf(edge);
    await this.changeRelations([{
      action: 'replace', old, new: { ...old, pinned: !edge.pinned },
    }]);
  }

  startRelationAction(edge: AtlasEdge, kind: 'veto' | 'retract' | 'restore'): void {
    this.edgeId = edge.id;
    this.relationAction = {
      edgeId: edge.id, kind, reason: '', sourceId: '', materialRelpath: '',
      fileSha256: '', page: '', quote: '', error: null,
    };
    this.render();
  }

  async submitRelationAction(): Promise<void> {
    const action = this.relationAction;
    if (!action) return;
    // The projected edge, for status and endpoint identity.
    const graph = buildAtlasGraph(this.plugin.store);
    const projected = graph.relationByIdentity.get(action.edgeId);
    if (!projected) {
      this.relationAction = { ...action, error: 'That connection is no longer published.' };
      this.render();
      return;
    }
    const reason = action.reason.trim();
    if ((action.kind === 'veto' || action.kind === 'retract')
      && (reason.length < 1 || reason.length > 400)) {
      this.relationAction = { ...action, error: 'Give a reason of 1–400 characters.' };
      this.render();
      return;
    }
    const needsBinding = action.kind === 'restore' && projected.status === 'vetoed';
    const page = Number(action.page);
    if (needsBinding && (!action.sourceId.trim() || !action.materialRelpath.trim()
      || !/^[0-9a-f]{64}$/.test(action.fileSha256.trim())
      || !Number.isInteger(page) || page < 1 || !action.quote.trim())) {
      this.relationAction = {
        ...action,
        error: 'Restoring a vetoed connection needs one complete evidence binding from a previously unused source.',
      };
      this.render();
      return;
    }
    const exact = await this.exactRow(projected);
    if (!exact && isDecorated(projected)) {
      this.relationAction = { ...action, error: 'The exact stored connection could not be read.' };
      this.render();
      return;
    }
    const old = exact ?? rowOf(projected);
    const next: Record<string, unknown> = { ...old };
    if (action.kind === 'veto') {
      next.status = 'vetoed';
      next.status_reason = reason;
    } else if (action.kind === 'retract') {
      next.status = 'retracted';
      next.status_reason = reason;
    } else {
      next.status = 'active';
      delete next.status_reason;
      if (needsBinding) {
        const evidence = Array.isArray(old.evidence) ? [...old.evidence] : [];
        evidence.push({
          source_id: action.sourceId.trim(),
          material_relpath: action.materialRelpath.trim(),
          file_sha256: action.fileSha256.trim(),
          page,
          quote: action.quote.trim(),
        });
        next.evidence = evidence;
      }
    }
    const applied = await this.write(
      () => this.plugin.gateway.changeConceptRelations(
        [{ action: 'replace', old, new: next as unknown as RelationRow }],
        this.plugin.store.artifactGuard(RELATION_REGISTRY),
      ),
      (message) => {
        if (this.relationAction) this.relationAction.error = message;
      },
    );
    if (applied) {
      this.relationAction = null;
      this.edgeId = action.edgeId;
      this.render();
    } else {
      this.render();
    }
  }
  private mutationPending = false;
  private renderCleanups: Array<() => void> = [];
  private conceptAttention = new Map<string | null, ConceptAttention>();
  private pendingConceptBrowse = false;
  private pendingConceptPlace: { domain: string | null; browseAll: boolean; recentsOnly: boolean } | null = null;
  private routeAdopted = false;
  private readonly conceptPast: AtlasRouteState[] = [];
  private readonly conceptFuture: AtlasRouteState[] = [];
  private pendingConceptTraversal: { direction: 'back' | 'forward'; target: AtlasRouteState } | null = null;

  addRenderCleanup(cleanup: () => void): void {
    this.renderCleanups.push(cleanup);
  }

  inspectEdge(id: string): void {
    this.edgeId = id;
    this.tab = 'connections';
    this.render();
  }

  private clearRenderEffects(): void {
    for (const cleanup of this.renderCleanups.splice(0)) cleanup();
  }

  async onClose(): Promise<void> {
    this.clearRenderEffects();
  }

  constructor(
    leaf: WorkspaceLeaf,
    plugin: AtlasPlugin,
  ) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_ATLAS;
  }

  getDisplayText() {
    // Both variants share one native view; the in-pane heading names its lens.
    return 'LearningOS · Atlas';
  }

  getIcon() {
    return 'map';
  }

  get state(): AtlasRouteState {
    return {
      concept: this.concept,
      module: this.module,
      lens: this.lens,
      depth: this.depth,
    };
  }

  go(target: Partial<AtlasRouteState>): void {
    const next = { ...this.state, ...target };
    void this.plugin.nav.openAtlas({
      concept: next.concept,
      module: next.module,
      lens: next.lens,
      depth: next.depth,
    }, this.leaf);
  }

  openConceptBrowser(): void {
    this.pendingConceptBrowse = true;
    this.go({ concept: null, lens: 'prerequisites' });
  }

  showConceptOverview(domain: string | null, browseAll = false, recentsOnly = false): void {
    this.pendingConceptPlace = { domain, browseAll, recentsOnly };
    this.go({ concept: null, lens: 'prerequisites' });
  }

  get canConceptBack(): boolean { return !this.pendingConceptTraversal && this.conceptPast.length > 0; }
  get canConceptForward(): boolean { return !this.pendingConceptTraversal && this.conceptFuture.length > 0; }

  conceptBack(): void { this.traverseConcept('back'); }
  conceptForward(): void { this.traverseConcept('forward'); }

  private traverseConcept(direction: 'back' | 'forward'): void {
    if (this.pendingConceptTraversal) return;
    const target = (direction === 'back' ? this.conceptPast : this.conceptFuture).at(-1);
    if (!target) return;
    this.pendingConceptTraversal = { direction, target };
    this.go(target);
  }

  /**
   * Adopt one route state. Unknown lens and depth values are coerced by the
   * route contract rather than refused, so a stale deep link opens the Atlas on
   * its default instead of failing to open it (ADR-016 decision 8).
   */
  private adopt(state: AtlasViewState): void {
    const previousRoute = this.state;
    const previous = this.concept;
    const attention: ConceptAttention = {
      query: this.query, browseAll: this.concepts.browseAll, visibleLimit: this.concepts.visibleLimit,
      domain: this.concepts.domain, subdomain: this.concepts.subdomain,
      selected: this.concepts.selected, recentsOnly: this.concepts.recentsOnly,
      tab: this.tab, semanticOpen: this.semanticOpen, remainderOpen: this.remainderOpen,
      edgeId: this.edgeId, disclosures: new Map(this.concepts.disclosures),
    };

    if (typeof state.concept === 'string' || state.concept === null) {
      this.concept = state.concept;
    }
    if (typeof state.module === 'string' || state.module === null) {
      this.module = state.module;
    }
    this.lens = asAtlasLens(state.lens);
    this.depth = asAtlasDepth(state.depth);

    if (this.concept !== previous) {
      if (this.routeAdopted) {
        const traversal = this.pendingConceptTraversal;
        if (traversal && this.concept === traversal.target.concept
          && this.module === traversal.target.module && this.lens === traversal.target.lens
          && this.depth === traversal.target.depth) {
          if (traversal.direction === 'back') {
            this.conceptPast.pop();
            this.conceptFuture.push(previousRoute);
          } else {
            this.conceptFuture.pop();
            this.conceptPast.push(previousRoute);
          }
        } else {
          this.conceptPast.push(previousRoute);
          this.conceptFuture.length = 0;
        }
      }
      this.conceptAttention.set(previous, attention);
      const restored = this.conceptAttention.get(this.concept);
      // Attention belongs to the inspected record (or the entry browser), so
      // Back restores its search/disclosures while a new neighbour starts quiet.
      this.query = restored?.query ?? '';
      this.concepts.browseAll = restored?.browseAll ?? false;
      this.concepts.visibleLimit = restored?.visibleLimit ?? 30;
      this.concepts.domain = restored ? restored.domain : attention.domain;
      this.concepts.subdomain = restored ? restored.subdomain : attention.subdomain;
      this.concepts.selected = restored?.selected ?? this.concept;
      this.concepts.recentsOnly = restored?.recentsOnly ?? false;
      this.concepts.disclosures.clear();
      for (const [key, open] of restored?.disclosures ?? []) this.concepts.disclosures.set(key, open);
      this.edgeId = restored?.edgeId ?? null;
      this.tab = restored?.tab ?? 'summary';
      this.semanticOpen = restored?.semanticOpen ?? false;
      this.remainderOpen = restored?.remainderOpen ?? false;
      this.editor = null;
      if (this.concept) this.plugin.settings.atlasRecentConcepts = rememberConcept(
        this.plugin.settings.atlasRecentConcepts, this.concept,
      );
    }
    this.routeAdopted = true;
    this.pendingConceptTraversal = null;
    if (this.pendingConceptPlace && this.concept === null) {
      const place = this.pendingConceptPlace;
      this.pendingConceptPlace = null;
      Object.assign(this.concepts, place, { selected: null, visibleLimit: 30 });
      if (!place.browseAll) this.concepts.subdomain = null;
      this.query = '';
    }
    // Explicit exploration takes precedence over remembered entry attention.
    // Applying it before adopting the route would be overwritten on re-centre.
    if (this.pendingConceptBrowse && this.concept === null && this.lens === 'prerequisites') {
      this.pendingConceptBrowse = false;
      this.query = '';
      this.concepts.browseAll = true;
      this.concepts.visibleLimit = 30;
      this.concepts.domain = null;
      this.concepts.subdomain = null;
      this.concepts.selected = null;
      this.concepts.recentsOnly = false;
    }
  }

  async setState(
    state: AtlasViewState = {},
  ): Promise<void> {
    this.adopt(state);
    this.render();
  }

  getState(): AtlasViewState {
    return {
      concept: this.concept,
      module: this.module,
      lens: this.lens,
      depth: this.depth,
    };
  }

  async onOpen(): Promise<void> {
    this.adopt(this.leaf.getViewState().state ?? {});
    this.render();
  }

  /**
   * The Atlas's one write, routed like every other write in the app.
   *
   * It goes through the plugin-wide queue rather than straight to the gateway,
   * so two clicks in two views cannot race the same `--expected-snapshot`, and
   * it carries the note's current revision so a stale screen is refused instead
   * of overwriting a change made elsewhere. On confirmation `mutate` reloads
   * the projection, so the redraw shows what Core actually recorded rather than
   * what this view assumed.
   */
  async setQuestionState(
    noteId: string,
    state: 'open' | 'resolved',
  ): Promise<void> {
    await this.write(() => this.plugin.gateway.saveAtlasQuestion(
      { id: noteId, state },
      this.plugin.store.artifactGuard(noteId),
    ));
  }

  /**
   * Apply exactly the operations Aram authored (ADR-017 decision 1).
   *
   * A refusal keeps the draft on screen. A stale edit and a rejected cycle are
   * both things he should be able to correct without retyping his explanation,
   * so the error is shown against the form rather than replacing it.
   */
  async changeRelations(
    operations: readonly RelationOperation[],
  ): Promise<void> {
    const applied = await this.write(
      () => this.plugin.gateway.changeConceptRelations(
        operations,
        this.plugin.store.artifactGuard(RELATION_REGISTRY),
      ),
      (message) => {
        if (this.editor) this.editor.error = message;
      },
    );
    if (!applied) return;

    // Show the result rather than announcing it: the connection just authored
    // is the one selected, and a removed one selects nothing.
    const [operation] = operations;
    this.editor = null;
    this.edgeId = operation && 'new' in operation
      ? `${operation.new.from}--${operation.new.type}--${operation.new.to}`
      : null;
    if (this.edgeId) this.tab = 'connections';
    this.render();
  }

  /**
   * One write, routed like every other write in the app: through the
   * plugin-wide queue, so two clicks in two views cannot race the same
   * `--expected-snapshot`. Resolves true only when Core confirmed.
   */
  private async write(
    action: () => Promise<unknown>,
    onRefusal?: (message: string) => void,
  ): Promise<boolean> {
    if (this.mutationPending) {
      new Notice('A LearningOS write is already running.');
      return false;
    }

    if (this.plugin.gateway.isBusy) {
      new Notice('Queued behind the running LearningOS write.');
    }

    this.mutationPending = true;
    try {
      await this.plugin.mutate(action);
      this.render();
      return true;
    } catch (error: unknown) {
      const message = errorMessage(error);
      onRefusal?.(message);
      new Notice(message);
      this.render();
      return false;
    } finally {
      this.mutationPending = false;
    }
  }

  render(): void {
    const doc = this.contentEl.ownerDocument ?? globalThis.document;
    const focused = doc?.activeElement as HTMLElement | null;
    const historyKey = focused && this.contentEl.contains(focused)
      ? focused.getAttribute('data-los-tab') : null;
    const filterKey = focused && this.contentEl.contains(focused)
      ? focused.getAttribute('data-atlas-filter') : null;
    withRenderFocus(this.contentEl, () => this.renderContent());
    // Filter selects are native controls outside the search/button-group
    // focus machinery: keep the learner on the filter they just changed.
    if (filterKey) {
      const now = doc.activeElement;
      if (!now || now === doc.body || !now.isConnected) {
        const replacement = Array.from(
          this.contentEl.querySelectorAll<HTMLElement>('[data-atlas-filter]'),
        ).find((node) => node.getAttribute('data-atlas-filter') === filterKey);
        replacement?.focus({ preventScroll: true });
      }
    }
    // Exhausting one direction disables its native button. Keep keyboard
    // attention on the remaining direction rather than a removed control.
    if (historyKey === 'concept-back' || historyKey === 'concept-forward') {
      const now = doc.activeElement;
      if (!now || now === focused || now === doc.body || !now.isConnected) {
        const fallback = Array.from(this.contentEl.querySelectorAll<HTMLButtonElement>('button'))
          .find((node) => !node.disabled && node.getAttribute('data-los-tab')
            === (historyKey === 'concept-back' ? 'concept-forward' : 'concept-back'));
        fallback?.focus({ preventScroll: true });
      }
    }
  }

  private renderContent(): void {
    this.clearRenderEffects();
    if (drawDesignScreen(this.plugin, 'atlas', this)) return;
    renderAtlas(this.contentEl, this);
  }
}
