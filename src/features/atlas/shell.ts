import { button, empty, filterTabs, pageHeader } from '../../components';
import { enableButtonGroupKeyboardNavigation } from '../../accessibility/button-group';
import type { AtlasLensV1 } from '../../contracts/route-v1';
import { asString as projectedString } from '../../projection/readers';
import {
  buildAtlasGraph,
  bridges,
  conceptOf,
  diagnostics,
  neighbourhood,
  summarize,
  type AtlasGraph,
} from './graph';
import { renderFocusedGraph, renderOutline, renderPath } from './focused-graph';
import { renderInspector } from './inspector';
import { renderBridges, renderDiagnostics } from './lenses';
import { focusQuestion, moduleTrail, plural, subgraphSummary } from './narrative';
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

/**
 * The Atlas shell (ADR-016).
 *
 * The screen opens on search and recently visited concepts, with the two
 * corpus lenses named beside them — not on the corpus, and not on a blank
 * canvas. Opening on a list of thirty-six bridges answers a question before it
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
  ['prerequisites', 'Prerequisites'],
  ['path', 'Path to concept'],
  ['semantic', 'Semantic context'],
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

/**
 * Where the caret was when a redraw took the field away.
 *
 * A manifest refresh is not a reason to interrupt a half-typed query. The
 * shell rebuilds its whole root, so the input the learner is typing into is a
 * different element afterwards; without this, focus lands back on the document
 * and the caret jumps to the end of whatever survived.
 */
interface SearchCaret {
  readonly start: number | null;
  readonly end: number | null;
}

function capturedCaret(): SearchCaret | null {
  const active = typeof document === 'undefined'
    ? null
    : document.activeElement as HTMLInputElement | null;

  if (!active?.classList?.contains('los-atlas-search-input')) return null;

  return { start: active.selectionStart, end: active.selectionEnd };
}

function restoreCaret(input: HTMLInputElement, caret: SearchCaret | null): void {
  if (!caret) return;

  input.focus();
  // `setSelectionRange` is absent on some hosts and throws on input types that
  // carry no selection. Focus alone is still the larger half of the repair.
  const start = caret.start ?? input.value.length;
  const end = caret.end ?? start;
  try {
    input.setSelectionRange?.(start, end);
  } catch {
    /* a host without selection support keeps focus and loses only the caret */
  }
}

function renderSearch(
  parent: HTMLElement,
  host: AtlasHost,
  update: () => void,
): HTMLInputElement {
  const field = parent.createDiv({ cls: 'los-atlas-search' });
  const label = field.createEl('label', {
    cls: 'los-micro',
    text: 'Search concepts',
  });
  label.setAttribute('for', 'los-atlas-search-input');

  const input = field.createEl('input', {
    cls: 'los-atlas-search-input',
    attr: {
      type: 'search',
      id: 'los-atlas-search-input',
      placeholder: 'Search concepts, e.g. logistic regression',
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

  const wrap = parent.createDiv({ cls: 'los-atlas-modules' });
  wrap.createDiv({ cls: 'los-micro', text: 'Modules' });

  const row = wrap.createDiv({ cls: 'los-atlas-module-chips' });
  row.setAttrs({ role: 'group', 'aria-label': 'Filter by module' });
  enableButtonGroupKeyboardNavigation(row, 'horizontal');

  for (const module of publishing) {
    const active = host.state.module === module.id;
    const chip = row.createEl('button', {
      cls: 'los-atlas-module-chip is-clickable',
      attr: { type: 'button' },
      text: `${module.shortLabel} ${module.conceptCount}`,
    });
    chip.toggleClass('is-active', active);
    chip.toggleClass('is-actionable', module.actionable);
    chip.setAttrs({
      'aria-pressed': String(active),
      'aria-label': `${module.label} — ${plural(module.conceptCount, 'concept')}`,
    });
    chip.addEventListener('click', () => host.go({
      module: active ? null : module.id,
    }));
  }

  wrap.createDiv({
    cls: 'los-micro',
    text: host.state.module
      ? 'Marks concepts this module evidences. It filters lists; it never removes a relation from the graph.'
      : 'A module says where a concept is taught. It is never an axis of the graph.',
  });
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

function renderLensBar(
  parent: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
): void {
  const bar = parent.createDiv({ cls: 'los-atlas-lensbar' });

  const concept = bar.createDiv({ cls: 'los-atlas-lensgroup' });
  concept.createDiv({ cls: 'los-micro', text: 'Lens' });
  filterTabs<AtlasLensV1>(
    concept,
    'Which question to ask about the selected concept',
    CONCEPT_LENSES,
    isCorpusLens(host.state.lens) ? 'prerequisites' : host.state.lens,
    (value: AtlasLensV1) => host.go({ lens: value }),
  );

  const corpus = bar.createDiv({ cls: 'los-atlas-lensgroup' });
  corpus.createDiv({ cls: 'los-micro', text: 'Corpus' });

  const group = corpus.createDiv({ cls: 'los-atlas-corpus-lenses' });
  group.setAttrs({ role: 'group', 'aria-label': 'Corpus lenses' });
  enableButtonGroupKeyboardNavigation(group, 'horizontal');

  for (const [lens, label, count] of [
    ['bridges', 'Cross-module bridges', bridges(graph).length],
    ['diagnostics', 'Diagnostics', diagnostics(graph).filter((entry) => entry.count > 0).length],
  ] as const) {
    const active = host.state.lens === lens;
    const control = button(
      group,
      `${label} ${count}`,
      () => host.go({ lens: active ? 'prerequisites' : lens }),
      'quiet',
    );
    control.addClass('los-atlas-corpus-lens');
    control.toggleClass('is-active', active);
    control.setAttrs({ 'aria-pressed': String(active) });
  }

  corpus.createDiv({
    cls: 'los-micro',
    text: 'Same route, same screen — not a separate view.',
  });
}

function renderQuestion(
  parent: HTMLElement,
  host: AtlasHost,
  label: string | null,
): void {
  const band = parent.createDiv({ cls: 'los-atlas-question' });
  band.createDiv({ cls: 'los-micro los-atlas-kicker', text: 'This view answers' });
  band.createEl('p', {
    cls: 'los-atlas-question-text',
    text: focusQuestion(host.state.lens, label),
  });
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
  const summary = summarize(graph);

  if (!searchOnly) entry.createDiv({
    cls: 'los-atlas-lens-lead',
    text: `${plural(summary.concepts, 'concept')} · ${plural(summary.relations, 'authored relation')} · ${summary.strictRelations} of them order learning. Choose one concept to focus.`,
  });

  const query = host.query.trim();

  if (query && searchOnly) {
    const results = host.plugin.store
      .search(query, ['concept'])
      .filter((record) => {
        const id = projectedString(record.id);
        if (!id) return false;
        if (!host.state.module) return true;
        return (graph.modulesByConcept.get(id) ?? []).includes(host.state.module);
      });

    const group = entry.createDiv({ cls: 'los-atlas-entry-group' });
    group.createDiv({
      cls: 'los-micro los-atlas-group-head',
      text: `Concept results · ${plural(results.length, 'concept')}`,
    });

    if (!results.length) {
      group.createDiv({
        cls: 'los-atlas-absence',
        text: `Nothing matches “${query}”. Search returns concepts only — modules and notes become filters and evidence after a concept is chosen, never competing results.`,
      });
    } else {
      const list = group.createDiv({ cls: 'los-atlas-records' });
      enableButtonGroupKeyboardNavigation(list, 'vertical');

      for (const record of results.slice(0, 20)) {
        const id = projectedString(record.id);
        if (!id) continue;
        renderConceptSeed(list, host, graph, id);
      }
    }
  }

  if (searchOnly) return;

  const recents = host.plugin.settings.atlasRecentConcepts
    .filter((id) => graph.conceptById.has(id));

  const recentGroup = entry.createDiv({ cls: 'los-atlas-entry-group' });
  recentGroup.createDiv({
    cls: 'los-micro los-atlas-group-head',
    text: 'Recently visited',
  });

  if (!recents.length) {
    recentGroup.createDiv({
      cls: 'los-atlas-absence',
      text: 'Nothing visited yet in this vault. Search above, or start from one of the corpus lenses.',
    });
  } else {
    const list = recentGroup.createDiv({ cls: 'los-atlas-records' });
    enableButtonGroupKeyboardNavigation(list, 'vertical');
    for (const id of recents) renderConceptSeed(list, host, graph, id);
  }

  renderOpenQuestions(entry, host, graph);
  renderConnectAction(entry, host, null);

  const entries = entry.createDiv({ cls: 'los-atlas-entry-group' });
  entries.createDiv({
    cls: 'los-micro los-atlas-group-head',
    text: 'Or start from the corpus',
  });

  const seeds = entries.createDiv({ cls: 'los-atlas-records' });
  enableButtonGroupKeyboardNavigation(seeds, 'vertical');

  for (const [lens, title, detail] of [
    [
      'bridges',
      `Cross-module bridges · ${bridges(graph).length}`,
      'Concepts carrying evidence from more than one module.',
    ],
    [
      'diagnostics',
      'Diagnostics',
      'What the relation registry has not yet been told, with every count opening its records.',
    ],
  ] as const) {
    const row = seeds.createEl('button', {
      cls: 'los-atlas-record is-clickable',
      attr: { type: 'button' },
    });
    row.createDiv({ cls: 'los-atlas-record-title', text: title });
    row.createDiv({ cls: 'los-micro', text: detail });
    row.addEventListener('click', () => host.go({ lens }));
  }
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
  const prerequisites = graph.prerequisiteEdges.get(conceptId)?.length ?? 0;
  const dependents = graph.dependentEdges.get(conceptId)?.length ?? 0;

  const row = parent.createEl('button', {
    cls: 'los-atlas-record is-clickable',
    attr: { type: 'button' },
  });
  row.createDiv({ cls: 'los-atlas-record-title', text: concept.label });
  row.createDiv({
    cls: 'los-micro',
    text: `${moduleTrail(graph, conceptId)} · ${plural(prerequisites, 'prerequisite')} · ${plural(dependents, 'dependent')}`,
  });
  row.addEventListener('click', () => host.go({ concept: conceptId }));
}

export function renderAtlas(root: HTMLElement, host: AtlasHost): void {
  const caret = capturedCaret();

  root.empty();
  root.addClass('los-root', 'los-atlas-view');

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

  pageHeader(
    root,
    'Reach',
    'Concept atlas',
    'One concept at a time: what it requires, what builds on it, and the authored relation that says so.',
  );

  const controls = root.createDiv({ cls: 'los-atlas-controls' });
  let results: HTMLElement;
  const updateSearch = () => {
    results.empty();
    if (host.query.trim()) renderEntry(results, host, graph, true);
  };
  const input = renderSearch(controls, host, updateSearch);
  renderModuleFilter(controls, host, graph);
  results = root.createDiv({ cls: 'los-atlas-search-results' });
  results.setAttrs({ 'aria-live': 'polite' });
  updateSearch();
  restoreCaret(input, caret);

  if (!graph.concepts.length) {
    empty(
      root,
      'No concepts are published yet',
      'A concept appears once it is registered in the knowledge tree. An empty Atlas means nothing has been authored, not that nothing is being studied.',
    );
    return;
  }

  const focusId = host.state.concept;
  const corpusLens = isCorpusLens(host.state.lens);
  const view = focusId && !corpusLens
    ? neighbourhood(graph, focusId, {
      depth: host.state.depth,
      includeSemanticNeighbours: host.state.lens === 'semantic',
    })
    : null;

  if (view) {
    renderDepth(
      controls,
      host,
      view.beyond.prerequisites.length + view.beyond.dependents.length,
    );
  }

  renderLensBar(root, host, graph);
  renderQuestion(root, host, focusId ? conceptOf(graph, focusId).label : null);

  if (corpusLens) {
    if (host.state.lens === 'bridges') renderBridges(root, host, graph);
    else renderDiagnostics(root, host, graph);
    return;
  }

  if (!view) {
    renderEntry(root, host, graph);
    return;
  }

  // One string, three consumers: this band, the outline heading, and the live
  // announcement. Built once in the read model so they cannot drift apart.
  const band = root.createDiv({ cls: 'los-atlas-summary' });
  band.setAttrs({ role: 'status' });
  band.setText(subgraphSummary(graph, view));

  const body = root.createDiv({ cls: 'los-atlas-body' });
  const main = body.createDiv({ cls: 'los-atlas-main' });

  // Authoring sits with the graph it changes, not behind a separate mode.
  if (host.editor) renderRelationEditor(main, host, graph, host.editor);
  else renderConnectAction(main, host, view.focus.id);

  if (host.state.lens === 'path') {
    renderPath(main, host, graph, view.focus.id);
  } else {
    renderFocusedGraph(main, host, graph, view);
  }

  if (host.state.lens !== 'path') renderOutline(main, host, graph, view);
  renderInspector(body, host, graph, view);
}
