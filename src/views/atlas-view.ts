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
import type {
  RelationDraft,
  RelationOperation,
} from '../features/atlas/relation-editor';

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
  readonly tab: AtlasInspectorTab;
  readonly semanticOpen: boolean;
  readonly remainderOpen: boolean;
  readonly edgeId: string | null;
  readonly disclosures: ReadonlyMap<string, boolean>;
}

/**
 * The Concept Atlas leaf (ADR-016).
 *
 * This shell owns exactly two things: the route state Obsidian persists, and
 * the working state that must not enter a route — the search text, the
 * inspector tab, and two disclosure flags. Everything else belongs to the
 * Atlas feature.
 *
 * The distinction is not cosmetic. Route state is what Back restores and what a
 * shared link reproduces, so a change to it pushes history; the inspector tab
 * is a change of attention inside one answer and must not. Keeping the two in
 * different places is what stops that rule from being merely a convention.
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
  readonly concepts: ConceptAtlasState = { browseAll: false, visibleLimit: 30, disclosures: new Map() };
  tab: AtlasInspectorTab = 'summary';
  semanticOpen = false;
  remainderOpen = false;
  edgeId: string | null = null;
  editor: RelationDraft | null = null;
  private mutationPending = false;
  private renderCleanups: Array<() => void> = [];
  private conceptAttention = new Map<string | null, ConceptAttention>();
  private pendingConceptBrowse = false;

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
    });
  }

  openConceptBrowser(): void {
    this.pendingConceptBrowse = true;
    this.go({ concept: null, lens: 'prerequisites' });
  }

  /**
   * Adopt one route state. Unknown lens and depth values are coerced by the
   * route contract rather than refused, so a stale deep link opens the Atlas on
   * its default instead of failing to open it (ADR-016 decision 8).
   */
  private adopt(state: AtlasViewState): void {
    const previous = this.concept;
    const attention: ConceptAttention = {
      query: this.query, browseAll: this.concepts.browseAll, visibleLimit: this.concepts.visibleLimit,
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
      this.conceptAttention.set(previous, attention);
      const restored = this.conceptAttention.get(this.concept);
      // Attention belongs to the inspected record (or the entry browser), so
      // Back restores its search/disclosures while a new neighbour starts quiet.
      this.query = restored?.query ?? '';
      this.concepts.browseAll = restored?.browseAll ?? false;
      this.concepts.visibleLimit = restored?.visibleLimit ?? 30;
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
    // Explicit exploration takes precedence over remembered entry attention.
    // Applying it before adopting the route would be overwritten on re-centre.
    if (this.pendingConceptBrowse && this.concept === null && this.lens === 'prerequisites') {
      this.pendingConceptBrowse = false;
      this.query = '';
      this.concepts.browseAll = true;
      this.concepts.visibleLimit = 30;
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
    withRenderFocus(this.contentEl, () => this.renderContent());
  }

  private renderContent(): void {
    this.clearRenderEffects();
    renderAtlas(this.contentEl, this);
  }
}
