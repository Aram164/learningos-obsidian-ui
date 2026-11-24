import { manifestFreshness } from '../../components';
import { button, empty, filterTabs, pageHeader } from '../../components';
import { enableButtonGroupKeyboardNavigation } from '../../accessibility/button-group';
import type { AtlasLensV1 } from '../../contracts/route-v1';
import {
  ALL_RELATION_TYPES,
  buildAtlasGraph,
  bridges,
  canonicalSentence,
  filterConcepts,
  filterRelations,
  filtersActive,
  neighbourhood,
  relationPhrase,
  type AtlasGraph,
} from './graph';
import { renderOutline, renderPath } from './text-navigation';
import { renderInspector } from './inspector';
import { defaultBoardEntry } from './board-controller';
import { renderBridges, renderDiagnostics } from './lenses';
import { renderDomains, renderAtlasVariants } from './domains';
import { moduleTrail, plural, subgraphSummary } from './narrative';
import {
  collectQuestions,
  openQuestions,
  questionDestination,
  targetSentence,
  type AtlasQuestion,
} from './questions';
import {
  newDraft,
  renderRelationEditor,
} from './relation-editor';
import type { AtlasHost } from './ports';
import { conceptDisclosure } from './disclosure';
import { renderConceptBrowser, renderConceptRail, renderConceptBreadcrumb, renderConceptDomainFilter } from './browser';

/**
 * The Atlas shell (ADR-016).
 *
 * The screen opens on domains and recently visited concepts. Browse aliases
 * come from explicit note links and folders; they never become graph edges.
 * Search and complete browsing remain available beside the two corpus lenses.
 *
 * The order below is the order the accessible shell was built in: controls,
 * then the question this view answers, then the summary of what is and is not
 * shown, then the graph beside its outline, then the inspector. Every one of
 * those exists before a single edge is drawn, because the picture is the part
 * a reader can most easily be denied.
 */

const CONCEPT_LENSES: ReadonlyArray<readonly [AtlasLensV1, string]> = [
  ['prerequisites', 'Direct connections'],
  ['semantic', 'Related ideas'],
  ['path', 'Learning path'],
];

const RECENT_LIMIT = 8;

function isCorpusLens(lens: AtlasLensV1): boolean {
  return lens === 'bridges' || lens === 'diagnostics';
}

/**
 * Remember one focus. Working state that survives a restart, so a learner
 * returns to what they were reading rather than to an empty screen.
 */
export function rememberConcept(
  recents: readonly string[],
  conceptId: string,
): string[] {
  return [conceptId, ...recents.filter((id) => id !== conceptId)]
    .slice(0, RECENT_LIMIT);
}

function renderSearch(
  parent: HTMLElement,
  host: AtlasHost,
  update: () => void,
): HTMLInputElement {
  const field = parent.createDiv({ cls: 'los-atlas-search' });
  const label = field.createEl('label', {
    cls: 'los-atlas-search-label',
  });
  label.createSpan({ cls: 'los-sr-only', text: 'Find a concept' });

  const input = label.createEl('input', {
    cls: 'los-atlas-search-input',
    attr: {
      type: 'search',
      placeholder: 'Find a concept',
      value: host.query,
    },
  });
  // Only the results region is redrawn while typing. Rebuilding the field on
  // its own input event is what made the caret jump mid-word.
  input.addEventListener('input', () => {
    host.query = input.value;
    update();
  });

  return input;
}

/**
 * The module chips.
 *
 * A filter over lists and a marker on the graph — never a subtraction from it.
 * Hiding an authored prerequisite because it is taught elsewhere would make the
 * module an axis of the graph, which ADR-016 decision 5 forbids for exactly
 * this reason: the concept would still be required, and the screen would have
 * stopped saying so.
 */
function renderModuleFilter(
  parent: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
): void {
  const publishing = graph.modules.filter((module) => module.conceptCount > 0);
  if (!publishing.length) return;

  const select = parent.createEl('select', { cls: 'los-atlas-module-filter', attr: { 'aria-label': 'Filter by module' } });
  select.createEl('option', { text: 'All modules', attr: { value: '' } });
  for (const module of publishing) select.createEl('option', { text: `${module.shortLabel} · ${module.conceptCount}`, attr: { value: module.id } });
  select.value = host.state.module ?? '';
  select.addEventListener('change', () => host.go({ module: select.value || null }));

}

function renderDepth(
  parent: HTMLElement,
  host: AtlasHost,
  remainder: number,
): void {
  const wrap = parent.createDiv({ cls: 'los-atlas-depth' });
  wrap.createDiv({ cls: 'los-micro', text: 'Connection depth' });

  const stepper = wrap.createDiv({ cls: 'los-atlas-stepper' });
  stepper.setAttrs({ role: 'group', 'aria-label': 'Graph depth' });
  enableButtonGroupKeyboardNavigation(stepper, 'horizontal');

  const down = button(stepper, '−', () => host.go({ depth: 1 }), 'quiet');
  down.setAttrs({ 'aria-label': 'Depth 1', 'aria-pressed': String(host.state.depth === 1) });
  down.toggleClass('is-active', host.state.depth === 1);

  stepper.createSpan({
    cls: 'los-atlas-stepper-value',
    text: String(host.state.depth),
  }).setAttrs({ 'aria-hidden': 'true' });

  const up = button(stepper, '+', () => host.go({ depth: 2 }), 'quiet');
  up.setAttrs({ 'aria-label': 'Depth 2', 'aria-pressed': String(host.state.depth === 2) });
  up.toggleClass('is-active', host.state.depth === 2);

  wrap.createDiv({
    cls: 'los-micro',
    text: remainder
      ? `${plural(remainder, 'concept')} beyond depth ${host.state.depth} — counted, never dropped`
      : `Nothing lies beyond depth ${host.state.depth} here`,
  });
}

function renderMapMeaning(parent: HTMLElement, host: AtlasHost, graph: AtlasGraph, focus: string): void {
  const meaning = parent.createDiv({ cls: 'los-atlas-mode-meaning', attr: { role: 'status' } });
  const semanticCount = graph.semanticEdges.get(focus)?.length ?? 0;
  meaning.createDiv({ text: host.state.lens === 'path'
    ? 'Learning path follows the complete authored prerequisite order leading to this concept.'
    : host.state.lens === 'semantic'
      ? semanticCount
        ? 'Related ideas adds authored associations to the prerequisite context. Associations do not set learning order.'
        : 'No additional related-idea connections are recorded for this concept. Its prerequisite context remains visible.'
      : 'Direct connections shows what comes before this concept and what builds on it.' });
  meaning.createDiv({ cls: 'los-micro', text: host.state.lens === 'path'
    ? 'Select a concept to inspect it. Explore from here changes the centre of exploration.'
    : `Depth ${host.state.depth} includes ${host.state.depth === 1 ? 'immediate connections' : 'connections up to two steps away'}. Depth changes which neighbours are included. Select a concept to inspect it without moving the map.` });
  if (host.state.module) {
    meaning.createDiv({ cls: 'los-micro', text: 'The module choice filters browsing lists and marks teaching context. Authored connections across modules remain on the map.' });
  }
}

function renderLensBar(parent: HTMLElement, host: AtlasHost): void {
  filterTabs<AtlasLensV1>(parent, 'Which question to ask about the selected concept',
    CONCEPT_LENSES, host.state.lens,
    (value: AtlasLensV1) => host.go({ lens: value }));
}

function renderAtlasTools(parent: HTMLElement, host: AtlasHost, graph: AtlasGraph): void {
  const actions = parent.createDiv({ cls: 'los-actions los-atlas-secondary-actions' });
  button(actions, `Across modules · ${bridges(graph).length}`,
    () => host.go({ lens: 'bridges' }), 'quiet');
  const tools = conceptDisclosure(actions, host, 'atlas-tools', 'Atlas tools');
  button(tools, 'Diagnostics', () => host.go({ lens: 'diagnostics' }), 'quiet');
  button(tools, 'Open generated domain map',
    () => host.plugin.openVaultPath('generated/domain-atlas.md'), 'quiet');
  button(tools, 'Source folders', () => host.plugin.nav.openLibraryFolder([]), 'quiet');
  renderOpenQuestions(conceptDisclosure(tools, host, 'open-questions', 'My open questions'), host, graph);
  if (!host.state.concept) renderConnectAction(tools, host, null);
}

/**
 * My open questions.
 *
 * A question Aram recorded is his, and it survives on the note that carries it.
 * It appears here by the target he named — never inferred, never widened to a
 * neighbouring concept, and never treated as a claim about the graph. A
 * question about two concepts is not a relation between them, and a question
 * about a relation is not a doubt the relation is registered.
 */
function renderOpenQuestions(
  parent: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
): void {
  const open = openQuestions(collectQuestions(host.plugin.store, graph));
  if (!open.length) return;

  const group = parent.createDiv({ cls: 'los-atlas-entry-group' });
  group.createDiv({
    cls: 'los-micro los-atlas-group-head',
    text: `My open questions · ${plural(open.length, 'question')}`,
  });

  const list = group.createDiv({ cls: 'los-atlas-records' });
  enableButtonGroupKeyboardNavigation(list, 'vertical');
  for (const question of open) renderQuestionRow(list, host, graph, question);

  group.createDiv({
    cls: 'los-micro',
    text: 'Recording a question says you have one. It does not add a connection, remove one, or claim anything about what you understand.',
  });
}

function renderQuestionRow(
  parent: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
  question: AtlasQuestion,
): void {
  const destination = question.targetPresent
    ? questionDestination(question.target)
    : null;

  // A question whose target is gone keeps the target it was asked about. It is
  // shown, not hidden and not re-pointed at something that survived.
  const row = destination
    ? parent.createEl('button', {
      cls: 'los-atlas-record los-atlas-question-row is-clickable',
      attr: { type: 'button' },
    })
    : parent.createDiv({ cls: 'los-atlas-record los-atlas-question-row is-orphaned' });

  row.createDiv({ cls: 'los-atlas-record-title', text: question.title });
  row.createDiv({
    cls: 'los-micro',
    text: question.targetPresent
      ? `${question.target.kind === 'relation' ? 'On the connection' : 'On'} ${targetSentence(graph, question.target)}`
      : `Recorded on ${targetSentence(graph, question.target)} — no longer authored`,
  });

  if (destination) {
    row.setAttrs({
      'aria-label': `${question.title}. ${targetSentence(graph, question.target)}.`,
    });
    row.addEventListener('click', () => host.go({ concept: destination }));
  }
}

/**
 * The way in to authoring (ADR-017 decision 3).
 *
 * Present from a focused concept and from the entry state, because a
 * connection Aram wants to record does not always start from the screen he
 * happens to be on. It never requires AI, and it is the same control in both
 * places.
 */
function renderConnectAction(
  parent: HTMLElement,
  host: AtlasHost,
  focusId: string | null,
): void {
  if (host.editor) return;

  const actions = parent.createDiv({ cls: 'los-actions los-atlas-connect' });
  const control = button(
    actions,
    focusId ? 'Connect this concept' : 'Connect concepts',
    () => {
      host.inspectorOrigin = 'connect-action';
      host.editor = newDraft(focusId ?? '');
      host.render();
    },
    'quiet',
  );
  control.addClass('los-atlas-connect-action');
  control.setAttrs({ 'data-row-key': 'connect-action' });
}

/** Editable-board controls (ADR-024, P3; scope default P4 step 23). */
function renderBoardControls(root: HTMLElement, host: AtlasHost): void {
  const catalog = host.boardCatalog();
  if (!catalog.length) return;
  const row = root.createDiv({ cls: 'los-atlas-board-controls' });
  const select = row.createEl('select', {
    cls: 'los-atlas-board-scope',
    attr: { 'aria-label': 'Board scope' },
  });
  select.createEl('option', { text: 'Choose a board', attr: { value: '' } });
  for (const entry of catalog) {
    select.createEl('option', {
      text: `${entry.kind} · ${entry.title ?? entry.id}`,
      attr: { value: `${entry.kind}/${entry.id}` },
    });
  }
  // The named module wins; otherwise the one current program/semester.
  // No unambiguous scope leaves the explicit "Choose a board" state.
  const desired = defaultBoardEntry(
    catalog, host.state.module, host.plugin.store.currentSemester());
  if (!host.boardScope && desired) {
    host.boardScope = `${desired.kind}/${desired.id}`;
  }
  select.value = host.boardScope ?? '';
  select.addEventListener('change', () => { host.boardScope = select.value || null; host.render(); });
  const selected = catalog.find(
    (entry) => `${entry.kind}/${entry.id}` === host.boardScope);
  const open = button(row, 'Open board', () => { if (selected) void host.openAtlasBoard(selected); }, 'quiet');
  const refresh = button(row, 'Refresh board', () => { if (selected) void host.refreshAtlasBoard(selected); }, 'quiet');
  open.disabled = !selected;
  refresh.disabled = !selected;
  if (host.plugin.settings.atlasAdvancedCanvas) {
    const advanced = button(row, 'Advanced board',
      () => { if (selected) void host.openAtlasBoard(selected, true); }, 'quiet');
    advanced.disabled = !selected;
    advanced.setAttrs({ title: 'Open this board with the installed Advanced Canvas plugin' });
  }
  if (selected?.parent_kind && host.plugin.settings.atlasAdvancedCanvas) {
    button(row, 'Use editable child in portals',
      () => { void host.usePortalChild(selected); }, 'quiet');
  }
}

/**
 * Search + Layer/Type/Evidence filters (P4 step 25).
 *
 * AND-composed over the graph read model; the count states concepts and
 * relations separately so a learner can tell which kind matched.
 */
function renderFilters(parent: HTMLElement, host: AtlasHost): void {
  const wrap = parent.createDiv({ cls: 'los-atlas-filters' });
  wrap.setAttrs({ role: 'group', 'aria-label': 'Filter concepts and connections' });

  const addSelect = (
    key: 'layer' | 'type' | 'evidence',
    label: string,
    options: ReadonlyArray<readonly [string, string]>,
  ): void => {
    const field = wrap.createEl('label', { cls: 'los-atlas-filter' });
    field.createSpan({ cls: 'los-micro', text: label });
    const select = field.createEl('select', {
      cls: 'los-atlas-filter-select',
      attr: { 'aria-label': label, 'data-atlas-filter': key },
    });
    for (const [value, text] of options) {
      select.createEl('option', { text, attr: { value } });
    }
    select.value = host.filters[key];
    select.addEventListener('change', () => {
      host.filters = { ...host.filters, [key]: select.value };
      host.render();
    });
  };

  addSelect('layer', 'Layer', [
    ['all', 'All layers'], ['strict', 'Strict'], ['semantic', 'Semantic'],
  ]);
  addSelect('type', 'Type', [
    ['all', 'All types'],
    ...ALL_RELATION_TYPES.map((type) => [type, relationPhrase(type)] as const),
  ]);
  addSelect('evidence', 'Evidence', [
    ['all', 'All evidence'], ['verified', 'Verified'], ['missing', 'Missing'],
    ['stale', 'Stale'], ['disputed', 'Disputed'],
  ]);

  const clear = button(wrap, 'Clear filters', () => {
    host.filters = { layer: 'all', type: 'all', evidence: 'all' };
    host.query = '';
    host.render();
  }, 'tertiary');
  clear.disabled = !filtersActive(host.filters) && !host.query.trim();
}

/** The filtered concept/relation results list (P4 steps 24–25). */
function renderResultsInto(
  container: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
): void {
  container.empty();
  if (!host.query.trim() && !filtersActive(host.filters)) return;

  const concepts = filterConcepts(graph, host.query, host.filters);
  const relations = filterRelations(graph, host.query, host.filters);

  // A selection the new filters eliminate is cleared and announced, never
  // left pointing at a row that no longer exists (step 27).
  let cleared = '';
  if (host.edgeId && !relations.some((edge) => edge.id === host.edgeId)) {
    host.edgeId = null;
    host.relationAction = null;
    cleared = ' The selected connection no longer matches the filters.';
  }
  if (host.concepts.selected
    && !concepts.some((concept) => concept.id === host.concepts.selected)) {
    host.concepts.selected = null;
    cleared += ' The selected concept no longer matches the filters.';
  }

  const status = container.createDiv({
    cls: 'los-atlas-match-count los-micro',
    attr: { role: 'status' },
    text: `${plural(concepts.length, 'concept')} · ${plural(relations.length, 'connection')} match.${cleared}`,
  });
  void status;

  const shown = Math.min(host.concepts.visibleLimit, concepts.length + relations.length);
  let rendered = 0;

  const list = container.createDiv({
    cls: 'los-atlas-results',
    attr: { role: 'group', 'aria-label': 'Matching concepts and connections' },
  });
  enableButtonGroupKeyboardNavigation(list, 'vertical');

  for (const concept of concepts) {
    if (rendered >= shown) break;
    rendered += 1;
    const row = button(list, concept.label, () => {
      host.inspectorOrigin = `concept:${concept.id}`;
      host.focusInspector = true;
      host.go({ concept: concept.id });
    }, 'row');
    row.setAttribute('data-row-key', `concept:${concept.id}`);
    row.createSpan({
      cls: 'los-micro',
      text: modulesLine(graph, concept.id),
    });
  }

  for (const edge of relations) {
    if (rendered >= shown) break;
    rendered += 1;
    const row = button(list, canonicalSentence(graph, edge), () => {
      host.inspectorOrigin = `relation:${edge.id}`;
      host.focusInspector = true;
      host.inspectEdge(edge.id);
    }, 'row');
    row.setAttribute('data-row-key', `relation:${edge.id}`);
    row.setAttribute('data-relation-id', edge.id);
    row.createSpan({
      cls: 'los-micro',
      text: `${relationPhrase(edge.type)} · evidence: ${edge.evidenceState}`,
    });
  }

  const total = concepts.length + relations.length;
  if (rendered < total) {
    button(container, `Show more · ${total - rendered} remaining`, () => {
      host.concepts.visibleLimit += 30;
      host.render();
    }, 'quiet').addClass('los-atlas-show-more');
  }
  if (!total) {
    container.createDiv({
      cls: 'los-atlas-absence',
      text: 'Nothing matches. Clear a filter or try another search.',
    });
  }
}

function modulesLine(graph: AtlasGraph, conceptId: string): string {
  const modules = graph.modules
    .filter((module) => (graph.modulesByConcept.get(conceptId) ?? []).includes(module.id))
    .map((module) => module.shortLabel);
  return modules.length ? modules.join(' · ') : 'No module evidence recorded';
}

/** Focus the inspector heading, or return focus to the originating row. */
function applyFocus(root: HTMLElement, host: AtlasHost): void {
  const focusable = (el: HTMLElement | null | undefined) => {
    if (el && typeof el.focus === 'function') el.focus({ preventScroll: true });
  };
  if (host.focusInspector) {
    host.focusInspector = false;
    host.restoreFocus = false;
    const heading = typeof root.querySelectorAll === 'function'
      ? Array.from(root.querySelectorAll<HTMLElement>('h2'))
        .find((node) => node.getAttribute('data-atlas-inspector-heading') === 'true')
      : null;
    focusable(heading);
    return;
  }
  if (host.restoreFocus) {
    host.restoreFocus = false;
    if (host.inspectorOrigin && typeof root.querySelectorAll === 'function') {
      const row = Array.from(root.querySelectorAll<HTMLElement>('[data-row-key]'))
        .find((node) => node.getAttribute('data-row-key') === host.inspectorOrigin);
      focusable(row);
    }
  }
}

export function renderAtlas(root: HTMLElement, host: AtlasHost): void {
  renderAtlasView(root, host);
  applyFocus(root, host);
}

function renderAtlasView(root: HTMLElement, host: AtlasHost): void {
  const domainLens = host.state.lens === 'domains';

  root.empty();
    manifestFreshness(root, host.plugin.store);
  root.addClass('los-root', 'los-atlas-view');
  root.toggleClass('los-domain-view', domainLens);
  if (domainLens) {
    renderDomains(root, host);
    return;
  }

  if (!host.plugin.store.ready) {
    pageHeader(root, 'Reach', 'Atlas unavailable');
    empty(
      root,
      'The interface contract could not be loaded',
      host.plugin.store.error,
      'Rebuild views',
      () => host.plugin.generate(),
    );
    return;
  }

  const graph = buildAtlasGraph(host.plugin.store);

  const heading = root.createDiv({ cls: 'los-atlas-heading' });
  const headingCopy = heading.createDiv();
  headingCopy.createEl('h1', { text: 'Atlas' });
  headingCopy.createDiv({ cls: 'los-micro', text: 'Browse your knowledge, then explore its connections.' });
  const about = conceptDisclosure(heading, host, 'atlas-about', 'About Atlas');
  about.createDiv({ text: 'Explore authored concepts, their linked notes and learning order. Modules show where teaching is mapped. Semantic connections explain related ideas; only prerequisites order learning.' });
  renderAtlasVariants(root, host.plugin.nav, 'concepts', (target) => host.go(target));
  renderBoardControls(root, host);

  const controls = root.createDiv({ cls: 'los-atlas-controls' });
  const history = controls.createDiv({ cls: 'los-atlas-concept-history', attr: {
    role: 'group', 'aria-label': 'Concept history',
  } });
  enableButtonGroupKeyboardNavigation(history, 'horizontal');
  const back = button(history, 'Back', () => host.conceptBack(), 'quiet');
  back.setAttrs({ 'aria-label': 'Back to previous concept', 'data-los-tab': 'concept-back' });
  back.disabled = !host.canConceptBack;
  const forward = button(history, 'Forward', () => host.conceptForward(), 'quiet');
  forward.setAttrs({ 'aria-label': 'Forward to next concept', 'data-los-tab': 'concept-forward' });
  forward.disabled = !host.canConceptForward;
  let results: HTMLElement;
  let entryRegion: HTMLElement | null = null;
  let filterResults: HTMLElement | null = null;
  const updateSearch = () => {
    results.empty();
    if (host.query.trim()) renderConceptBrowser(results, host, graph);
    if (filterResults) renderResultsInto(filterResults, host, graph);
    if (entryRegion) {
      entryRegion.empty();
      if (!host.query.trim()) renderConceptBrowser(entryRegion, host, graph);
    }
  };
  renderSearch(controls, host, updateSearch);
  renderConceptDomainFilter(controls, host, graph);
  renderModuleFilter(controls, host, graph);
  renderFilters(controls, host);
  button(controls, 'Explore', () => host.openConceptBrowser(), 'quiet');
  if (host.query.trim() || host.state.module || host.concepts.domain) {
    button(controls, 'Reset browsing', () => {
      host.query = '';
      Object.assign(host.concepts, { domain: null, subdomain: null, recentsOnly: false, browseAll: true });
      host.go({ module: null });
    }, 'tertiary');
  }
  results = root.createDiv({ cls: 'los-atlas-search-results' });
  results.setAttrs({ 'aria-live': 'polite' });
  filterResults = root.createDiv({ cls: 'los-atlas-filter-results' });
  filterResults.setAttrs({ 'aria-live': 'polite' });
  updateSearch();

  if (graph.deprecatedConceptIds.length) {
    const warning = root.createDiv({
      cls: 'los-callout los-atlas-deprecated-warning',
      attr: { role: 'note' },
    });
    warning.createEl('strong', {
      text: `${plural(graph.deprecatedConceptIds.length, 'deprecated concept')} excluded from Atlas: `,
    });
    warning.createSpan({ text: graph.deprecatedConceptIds.join(', ') });
    if (host.state.lens !== 'diagnostics') {
      button(warning, 'Inspect in Diagnostics', () => host.go({ lens: 'diagnostics', concept: null }), 'tertiary');
    }
  }

  if (!graph.concepts.length) {
    empty(root, 'No concepts are published yet', 'Register a concept to make it available here.');
    return;
  }
  const focusId = host.state.concept;
  const corpusLens = isCorpusLens(host.state.lens);
  const view = focusId && !corpusLens ? neighbourhood(graph, focusId, {
    depth: host.state.depth, includeSemanticNeighbours: host.state.lens === 'semantic',
  }) : null;
  if (corpusLens) {
    button(root, 'Choose a concept', () => host.go({ concept: null, lens: 'prerequisites' }), 'quiet');
    if (host.state.lens === 'bridges') renderBridges(root, host, graph);
    else renderDiagnostics(root, host, graph);
    renderAtlasTools(root, host, graph);
    return;
  }
  if (!view) {
    entryRegion = root.createDiv({ cls: 'los-atlas-entry-region' });
    if (!host.query.trim()) renderConceptBrowser(entryRegion, host, graph);
    if (host.editor) renderRelationEditor(root, host, graph, host.editor);
    if (host.edgeId) {
      // A relation chosen from the results list inspects here too: the list
      // is complete without a selected concept or a Canvas tab.
      const edge = graph.relationByIdentity.get(host.edgeId);
      if (edge) {
        const region = root.createDiv({ cls: 'los-atlas-inspection-region' });
        renderInspector(region, host, graph, neighbourhood(graph, edge.from, {
          depth: host.state.depth, includeSemanticNeighbours: true,
        }));
      }
    }
    renderAtlasTools(root, host, graph);
    return;
  }

  const workspace = root.createDiv({ cls: 'los-atlas-browser-layout los-atlas-map-workspace' });
  renderConceptRail(workspace, host, graph);
  const detail = workspace.createDiv({ cls: 'los-atlas-browser-content' });
  renderConceptBreadcrumb(detail, host);
  button(detail, 'Back to concepts', () => host.go({ concept: null, lens: 'prerequisites' }), 'quiet').addClass('los-atlas-back');
  const focusHead = detail.createDiv({ cls: 'los-atlas-focus-heading' });
  const copy = focusHead.createDiv();
  copy.createEl('h2', { text: view.focus.label });
  copy.createDiv({ cls: 'los-micro', text: `${moduleTrail(graph, view.focus.id)} · ${host.state.lens === 'prerequisites' ? 'Direct connections' : host.state.lens === 'semantic' ? 'Related ideas' : 'Learning path'}` });
  renderConnectAction(focusHead, host, view.focus.id);
  const mapControls = detail.createDiv({ cls: 'los-atlas-map-controls' });
  renderLensBar(mapControls, host);
  if (host.state.lens !== 'path') renderDepth(mapControls, host, view.beyond.prerequisites.length + view.beyond.dependents.length);
  renderMapMeaning(detail, host, graph, view.focus.id);
  const body = detail.createDiv({ cls: 'los-atlas-body' });
  const main = body.createDiv({ cls: 'los-atlas-main' });
  if (host.editor) renderRelationEditor(main, host, graph, host.editor);
  // Text is the graph presentation here (step 29): the outline and path are
  // complete, keyboard-complete alternatives; spatial layout is the board's.
  if (host.state.lens === 'path') renderPath(main, host, graph, view.focus.id);
  else renderOutline(main, host, graph, view);
  if (host.state.lens !== 'path') {
    const scope = main.createDiv({ cls: 'los-atlas-focused-scope' });
    scope.createDiv({ cls: 'los-micro', attr: { role: 'status' }, text: subgraphSummary(graph, view) });
    const further = conceptDisclosure(scope, host, `${view.focus.id}:explore`, 'Explore further');
    button(further, 'Show further connections', () => host.go({ depth: 2 }), 'quiet');
  }
  const inspectedId = host.concepts.inspections?.get(view.focus.id);
  const inspected = inspectedId && graph.conceptById.has(inspectedId)
    ? neighbourhood(graph, inspectedId, { depth: host.state.depth, includeSemanticNeighbours: host.state.lens === 'semantic' })
    : view;
  const inspectorRegion = body.createDiv({ cls: 'los-atlas-inspection-region' });
  if (inspected.focus.id !== view.focus.id) {
    const actions = inspectorRegion.createDiv({ cls: 'los-atlas-inspection-actions', attr: { role: 'group', 'aria-label': 'Inspection and exploration' } });
    actions.createDiv({ cls: 'los-micro', attr: { role: 'status' }, text: `Inspecting ${inspected.focus.label} · map centred on ${view.focus.label}` });
    button(actions, 'Explore from here', () => host.go({ concept: inspected.focus.id }), 'quiet');
    button(actions, 'Return to centre', () => {
      host.concepts.inspections?.delete(view.focus.id);
      host.edgeId = null;
      host.render();
    }, 'tertiary');
  }
  renderInspector(inspectorRegion, host, graph, inspected);
  renderAtlasTools(root, host, graph);
}
