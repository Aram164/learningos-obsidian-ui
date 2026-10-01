import { button, empty, filterTabs, pageHeader } from '../../components';
import { enableButtonGroupKeyboardNavigation } from '../../accessibility/button-group';
import type { AtlasLensV1 } from '../../contracts/route-v1';
import { asString as projectedString } from '../../projection/readers';
import {
  buildAtlasGraph,
  bridges,
  conceptOf,
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
import { linkedConceptNotes } from './context';
import { conceptDisclosure } from './disclosure';
import { compareStrings } from '../../sorting';

/**
 * The Atlas shell (ADR-016).
 *
 * The screen opens on search and recently visited concepts, with the two
 * corpus lenses named beside them — not on the corpus, and not on a blank
 * canvas. Opening on a list of every bridge answers a question before it
 * has been asked; opening on nothing asks the learner to re-supply context the
 * system already had.
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

  const wrap = conceptDisclosure(parent, host, 'module-filter',
    host.state.module
      ? graph.modules.find((module) => module.id === host.state.module)?.shortLabel ?? 'Selected module'
      : 'All modules', 'los-atlas-module-filter');
  const row = wrap.createDiv({ cls: 'los-atlas-module-chips' });
  row.setAttrs({ role: 'group', 'aria-label': 'Filter by module' });
  enableButtonGroupKeyboardNavigation(row, 'horizontal');
  button(row, 'All modules', () => host.go({ module: null }), 'quiet')
    .setAttribute('aria-pressed', String(host.state.module === null));
  for (const module of publishing) {
    const active = host.state.module === module.id;
    const chip = row.createEl('button', {
      cls: 'los-atlas-module-chip is-clickable',
      attr: { type: 'button' },
      text: `${module.shortLabel} ${module.conceptCount}`,
    });
    chip.toggleClass('is-active', active);
    chip.setAttrs({ 'aria-pressed': String(active),
      'aria-label': `${module.label} — ${plural(module.conceptCount, 'concept')}` });
    chip.addEventListener('click', () => host.go({ module: active ? null : module.id }));
  }
  wrap.createDiv({ cls: 'los-micro',
    text: 'Filters concept lists. Authored graph connections stay complete across modules.' });

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
  button(tools, 'Source folders', () => host.plugin.nav.openLibraryHome(), 'quiet');
  renderOpenQuestions(conceptDisclosure(tools, host, 'open-questions', 'My open questions'), host, graph);
  if (!host.state.concept) renderConnectAction(tools, host, null);
}

/**
 * The entry state: search, recent focuses, and the two corpus lenses.
 *
 * Never the whole corpus and never an empty canvas. A concept the learner has
 * already visited is context the system was given; asking for it again is the
 * cost this state exists to remove.
 */
function renderEntry(
  parent: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
  searchOnly = false,
): void {
  const entry = parent.createDiv({ cls: 'los-atlas-entry' });
  const query = host.query.trim();
  const browsing = host.concepts.browseAll;

  if (query || browsing) {
    const candidates = query
      ? host.plugin.store.search(query, ['concept'])
      : graph.concepts.flatMap((concept) => concept.record ? [concept.record] : []);
    const results = candidates.filter((record) => {
      const id = projectedString(record.id);
      return Boolean(id) && (!host.state.module
        || (graph.modulesByConcept.get(id as string) ?? []).includes(host.state.module));
    }).sort((left, right) => compareStrings(
      conceptOf(graph, projectedString(left.id) as string).label,
      conceptOf(graph, projectedString(right.id) as string).label)
      || compareStrings(projectedString(left.id) as string, projectedString(right.id) as string));
    const group = entry.createDiv({ cls: 'los-atlas-entry-group' });
    group.createEl('h2', { text: browsing ? 'Browse concepts' : 'Concept results' });
    const shown = Math.min(host.concepts.visibleLimit, results.length);
    group.createDiv({ cls: 'los-micro los-atlas-browser-scope',
      text: `${shown} of ${plural(results.length, 'concept')} shown${host.state.module ? ' in this module' : ''}` });
    if (!results.length) {
      group.createDiv({ cls: 'los-atlas-absence', text: query
        ? `Nothing matches “${query}”. Try another concept or module.`
        : 'No concepts are published for this module.' });
    } else {
      const list = group.createDiv({ cls: 'los-atlas-records' });
      list.setAttribute('aria-label', 'Concept results');
      enableButtonGroupKeyboardNavigation(list, 'vertical');
      for (const record of results.slice(0, shown)) {
        renderConceptSeed(list, host, graph, projectedString(record.id) as string);
      }
      if (shown < results.length) {
        button(group, `Show more · ${results.length - shown} remaining`, () => {
          host.concepts.visibleLimit += 30;
          host.render();
        }, 'quiet').addClass('los-atlas-show-more');
      }
    }
    if (browsing) button(group, 'Close browser', () => {
      host.concepts.browseAll = false;
      host.query = '';
      host.concepts.visibleLimit = 30;
      host.render();
    }, 'quiet');
    return;
  }
  if (searchOnly) return;
  entry.createEl('h2', { text: 'Choose a concept' });
  entry.createDiv({ cls: 'los-atlas-entry-lead', text: 'Open a concept’s map and linked notes.' });
  const recents = host.plugin.settings.atlasRecentConcepts.filter((id) => graph.conceptById.has(id)
    && (!host.state.module || (graph.modulesByConcept.get(id) ?? []).includes(host.state.module)));
  const group = entry.createDiv({ cls: 'los-atlas-entry-group' });
  group.createDiv({ cls: 'los-micro los-atlas-group-head', text: 'Recently visited' });
  if (!recents.length) group.createDiv({ cls: 'los-micro', text: 'No concepts visited yet. Search above or browse all concepts.' });
  else {
    const list = group.createDiv({ cls: 'los-atlas-records' });
    enableButtonGroupKeyboardNavigation(list, 'vertical');
    for (const id of recents) renderConceptSeed(list, host, graph, id);
  }
  button(entry, `Browse all ${graph.concepts.filter((concept) => concept.record).length} concepts`, () => {
    host.concepts.browseAll = true;
    host.concepts.visibleLimit = 30;
    host.render();
  }, 'quiet').addClass('los-atlas-browse-all');
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

function renderConceptSeed(
  parent: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
  conceptId: string,
): void {
  const concept = conceptOf(graph, conceptId);
  const notes = linkedConceptNotes(host.plugin.store, conceptId);
  const row = parent.createEl('button', {
    cls: 'los-atlas-record los-atlas-concept-seed is-clickable', attr: { type: 'button' },
  });
  row.setAttribute('data-concept-id', conceptId);
  row.setAttribute('data-linked-note-count', String(notes.length));
  const copy = row.createDiv({ cls: 'los-atlas-record-copy' });
  copy.createDiv({ cls: 'los-atlas-record-title', text: concept.label });
  copy.createDiv({ cls: 'los-micro', text: plural(notes.length, 'linked note') });
  row.createSpan({ cls: 'los-atlas-record-open', text: 'Open' });
  row.addEventListener('click', () => host.go({ concept: conceptId,
    lens: isCorpusLens(host.state.lens) ? 'prerequisites' : host.state.lens }));

}

export function renderAtlas(root: HTMLElement, host: AtlasHost): void {
  const domainLens = host.state.lens === 'domains';

  root.empty();
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
  heading.createEl('h1', { text: 'Atlas' });
  const about = conceptDisclosure(heading, host, 'atlas-about', 'About Atlas');
  about.createDiv({ text: 'Explore authored concepts, their linked notes and learning order. Modules show where teaching is mapped. Semantic connections explain related ideas; only prerequisites order learning.' });
  renderAtlasVariants(root, host.plugin.nav, 'concepts');

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
    if (host.query.trim()) renderEntry(results, host, graph, true);
    if (entryRegion) {
      entryRegion.empty();
      if (!host.query.trim()) renderEntry(entryRegion, host, graph);
    }
  };
  renderSearch(controls, host, updateSearch);
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
    if (!host.query.trim()) renderEntry(entryRegion, host, graph);
    if (host.editor) renderRelationEditor(root, host, graph, host.editor);
    renderAtlasTools(root, host, graph);
    return;
  }

  const focusHead = root.createDiv({ cls: 'los-atlas-focus-heading' });
  const copy = focusHead.createDiv();
  copy.createEl('h2', { text: view.focus.label });
  copy.createDiv({ cls: 'los-micro', text: `${moduleTrail(graph, view.focus.id)} · ${host.state.lens === 'prerequisites' ? 'Direct connections' : host.state.lens === 'semantic' ? 'Related ideas' : 'Learning path'}` });
  renderConnectAction(focusHead, host, view.focus.id);
  const body = root.createDiv({ cls: 'los-atlas-body' });
  const main = body.createDiv({ cls: 'los-atlas-main' });
  if (host.editor) renderRelationEditor(main, host, graph, host.editor);
  if (host.state.lens === 'path') renderPath(main, host, graph, view.focus.id);
  else renderFocusedGraph(main, host, graph, view);
  const scope = main.createDiv({ cls: 'los-atlas-focused-scope' });
  scope.createDiv({ cls: 'los-micro', attr: { role: 'status' }, text: subgraphSummary(graph, view) });
  const further = conceptDisclosure(scope, host, `${view.focus.id}:explore`, 'Explore further');
  renderDepth(further, host, view.beyond.prerequisites.length + view.beyond.dependents.length);
  renderLensBar(main, host);
  if (host.state.lens !== 'path') {
    renderOutline(conceptDisclosure(main, host, `${view.focus.id}:outline`, 'Text outline'), host, graph, view);
  }
  renderInspector(body, host, graph, view);
  renderAtlasTools(root, host, graph);
}
