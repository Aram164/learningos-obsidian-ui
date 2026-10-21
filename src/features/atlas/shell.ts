import { manifestFreshness } from '../../components';
import { button, empty, filterTabs, pageHeader } from '../../components';
import { enableButtonGroupKeyboardNavigation } from '../../accessibility/button-group';
import type { AtlasLensV1 } from '../../contracts/route-v1';
import {
  buildAtlasGraph,
  bridges,
  neighbourhood,
  type AtlasGraph,
} from './graph';
import { renderFocusedGraph, renderOutline, renderPath } from './focused-graph';
import { renderInspector } from './inspector';
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
  wrap.createDiv({ cls: 'los-micro', text: 'Depth' });

  const stepper = wrap.createDiv({ cls: 'los-atlas-stepper' });
  stepper.setAttrs({ role: 'group', 'aria-label': 'Graph depth' });
  enableButtonGroupKeyboardNavigation(stepper, 'horizontal');

  const down = button(stepper, '−', () => host.go({ depth: 1 }), 'quiet');
  down.setAttrs({ 'aria-label': 'Depth 1' });
  down.toggleClass('is-active', host.state.depth === 1);

  stepper.createSpan({
    cls: 'los-atlas-stepper-value',
    text: String(host.state.depth),
  }).setAttrs({ 'aria-hidden': 'true' });

  const up = button(stepper, '+', () => host.go({ depth: 2 }), 'quiet');
  up.setAttrs({ 'aria-label': 'Depth 2' });
  up.toggleClass('is-active', host.state.depth === 2);

  wrap.createDiv({
    cls: 'los-micro',
    text: remainder
      ? `${plural(remainder, 'concept')} beyond depth ${host.state.depth} — counted, never dropped`
      : `Nothing lies beyond depth ${host.state.depth} here`,
  });
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
      host.editor = newDraft(focusId ?? '');
      host.render();
    },
    'quiet',
  );
  control.addClass('los-atlas-connect-action');
}

export function renderAtlas(root: HTMLElement, host: AtlasHost): void {
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
  const updateSearch = () => {
    results.empty();
    if (host.query.trim()) renderConceptBrowser(results, host, graph);
    if (entryRegion) {
      entryRegion.empty();
      if (!host.query.trim()) renderConceptBrowser(entryRegion, host, graph);
    }
  };
  renderSearch(controls, host, updateSearch);
  renderConceptDomainFilter(controls, host, graph);
  renderModuleFilter(controls, host, graph);
  button(controls, 'Explore', () => host.openConceptBrowser(), 'quiet');
  results = root.createDiv({ cls: 'los-atlas-search-results' });
  results.setAttrs({ 'aria-live': 'polite' });
  updateSearch();

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
    renderAtlasTools(root, host, graph);
    return;
  }

  const workspace = root.createDiv({ cls: 'los-atlas-browser-layout los-atlas-map-workspace' });
  renderConceptRail(workspace, host, graph);
  const detail = workspace.createDiv({ cls: 'los-atlas-browser-content' });
  renderConceptBreadcrumb(detail, host);
  button(detail, 'Back to concepts', () => host.go({ concept: null, lens: 'prerequisites' }), 'quiet');
  const focusHead = detail.createDiv({ cls: 'los-atlas-focus-heading' });
  const copy = focusHead.createDiv();
  copy.createEl('h2', { text: view.focus.label });
  copy.createDiv({ cls: 'los-micro', text: `${moduleTrail(graph, view.focus.id)} · ${host.state.lens === 'prerequisites' ? 'Direct connections' : host.state.lens === 'semantic' ? 'Related ideas' : 'Learning path'}` });
  renderConnectAction(focusHead, host, view.focus.id);
  const mapControls = detail.createDiv({ cls: 'los-atlas-map-controls' });
  renderLensBar(mapControls, host);
  renderDepth(mapControls, host, view.beyond.prerequisites.length + view.beyond.dependents.length);
  const body = detail.createDiv({ cls: 'los-atlas-body' });
  const main = body.createDiv({ cls: 'los-atlas-main' });
  if (host.editor) renderRelationEditor(main, host, graph, host.editor);
  if (host.state.lens === 'path') renderPath(main, host, graph, view.focus.id);
  else renderFocusedGraph(main, host, graph, view);
  const scope = main.createDiv({ cls: 'los-atlas-focused-scope' });
  scope.createDiv({ cls: 'los-micro', attr: { role: 'status' }, text: subgraphSummary(graph, view) });
  const further = conceptDisclosure(scope, host, `${view.focus.id}:explore`, 'Explore further');
  button(further, 'Show further connections', () => host.go({ depth: 2 }), 'quiet');
  if (host.state.lens !== 'path') {
    renderOutline(conceptDisclosure(main, host, `${view.focus.id}:outline`, 'Text outline'), host, graph, view);
  }
  renderInspector(body, host, graph, view);
  renderAtlasTools(root, host, graph);
}
