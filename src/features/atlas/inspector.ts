import { button, empty, filterTabs } from '../../components';
import { enableButtonGroupKeyboardNavigation } from '../../accessibility/button-group';
import type {
  ModuleConceptEvidence,
  ProjectionRecord,
} from '../../contracts/manifest';
import {
  asLabel as projectedLabel,
  asString as projectedString,
} from '../../projection/readers';
import { buildConceptContext } from './context';
import {
  conceptLabel,
  evidenceFor,
  modulesFor,
  provenanceOf,
  type AtlasEdge,
  type AtlasGraph,
  type AtlasNeighbourhood,
} from './graph';
import { layerBadge } from './focused-graph';
import {
  collectQuestions,
  questionsForConcept,
  questionsForRelation,
  type AtlasQuestion,
} from './questions';
import { renderRemoveConnection } from './relation-editor';
import {
  contextSentence,
  edgeHeadline,
  moduleTrail,
  otherEnd,
  plural,
  provenanceSentence,
  relationSentences,
} from './narrative';
import type { AtlasHost, AtlasInspectorTab } from './ports';

/**
 * The concept inspector.
 *
 * A landmark and a live region, not a dialog. `makeModalAccessible` would be
 * wrong here twice over: it declares `role="dialog"` on the panel and marks the
 * rest of the workspace `inert`, and this panel is neither modal nor a trap —
 * the learner moves between the graph, the outline and the inspector freely,
 * and everything stays operable.
 *
 * The four tabs are attention, not navigation. They are working state on the
 * host, so switching one does not push history, while changing the lens does.
 */

const TABS: ReadonlyArray<readonly [AtlasInspectorTab, string]> = [
  ['summary', 'Summary'],
  ['connections', 'Connections'],
  ['evidence', 'Evidence'],
  ['sources', 'Sources'],
];

function aliasesOf(record: ProjectionRecord | null): readonly string[] {
  return Array.isArray(record?.aliases)
    ? record.aliases
      .map((value: unknown) => projectedString(value))
      .filter((value): value is string => Boolean(value))
    : [];
}

/**
 * One relation row: the sentence, its provenance, and exactly one action.
 *
 * The provenance line is the only place in the interface where the three
 * states are distinguished, so none of them may be softened into another.
 */
function connectionRow(
  parent: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
  edge: AtlasEdge,
  conceptId: string,
): void {
  const other = otherEnd(edge, conceptId);
  const row = parent.createDiv({ cls: 'los-atlas-connection' });
  row.setAttribute('data-relation-id', edge.id);
  row.toggleClass('is-selected', host.edgeId === edge.id);
  const copy = row.createDiv({ cls: 'los-atlas-connection-copy' });

  const headline = copy.createDiv({ cls: 'los-atlas-connection-title' });
  headline.createSpan({ text: edgeHeadline(graph, edge, conceptId) });
  layerBadge(headline, edge);

  copy.createDiv({
    cls: 'los-micro',
    text: relationSentences(graph, edge).join(' '),
  });

  const provenance = provenanceOf(graph, edge);
  const line = copy.createDiv({ cls: 'los-atlas-provenance' });
  line.addClass(`los-atlas-provenance--${provenance.state}`);
  line.createSpan({
    cls: 'los-micro',
    text: `${moduleTrail(graph, other)} · ${provenanceSentence(provenance)} · ${contextSentence(edge)}`,
  });

  if (provenance.state === 'resolved') {
    button(
      line,
      'Open source',
      () => host.plugin.nav.openRecord(provenance.record),
      'quiet',
    );
  }

  if (provenance.state === 'unresolved') {
    // Fail closed means name the identifier and stop. The relation stays
    // drawn: dropping an authored prerequisite because its citation is broken
    // would silently shorten a learning path, which is the one failure this
    // screen must never produce.
    copy.createDiv({
      cls: 'los-micro los-atlas-unresolved',
      text: `The relation is authored and still applies. No substitute source is offered for ${provenance.sourceId}.`,
    });
    button(
      line,
      'Open Diagnostics',
      () => host.go({ lens: 'diagnostics' }),
      'quiet',
    );
  }

  if (edge.context) {
    copy.createDiv({ cls: 'los-atlas-connection-context', text: edge.context });
  }

  const action = row.createDiv({ cls: 'los-atlas-connection-action' });
  button(action, 'Focus', () => host.go({ concept: other }), 'quiet');
}

function renderConnections(
  parent: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
  conceptId: string,
): void {
  const prerequisites = graph.prerequisiteEdges.get(conceptId) ?? [];
  const dependents = graph.dependentEdges.get(conceptId) ?? [];
  const semantic = graph.semanticEdges.get(conceptId) ?? [];
  const unrecognized = graph.unrecognizedEdges.get(conceptId) ?? [];
  const label = conceptLabel(graph, conceptId);

  parent.createDiv({
    cls: 'los-micro los-atlas-group-head',
    text: `Prerequisites of ${label} · ${plural(prerequisites.length, 'authored', 'authored')}`,
  });

  if (prerequisites.length) {
    const group = parent.createDiv({ cls: 'los-atlas-connections' });
    for (const edge of prerequisites) {
      connectionRow(group, host, graph, edge, conceptId);
    }
  } else {
    parent.createDiv({
      cls: 'los-atlas-absence',
      text: 'No authored prerequisites. Absence, not a claim that none exist — and never a claim that the concept is foundational.',
    });
  }

  parent.createDiv({
    cls: 'los-micro los-atlas-group-head',
    text: `Dependents · ${plural(dependents.length, 'authored', 'authored')}`,
  });

  if (dependents.length) {
    const group = parent.createDiv({ cls: 'los-atlas-connections' });
    for (const edge of dependents) {
      connectionRow(group, host, graph, edge, conceptId);
    }
  } else {
    parent.createDiv({
      cls: 'los-atlas-absence',
      text: 'No authored dependents. Nothing is inferred to fill this, and it does not mean the concept is advanced.',
    });
  }

  if (semantic.length) {
    const toggle = parent.createEl('button', {
      cls: 'los-atlas-semantic-toggle is-clickable',
      attr: { type: 'button' },
    });
    toggle.createDiv({
      cls: 'los-atlas-connection-title',
      text: plural(semantic.length, 'semantic link'),
    });
    toggle.createDiv({
      cls: 'los-micro',
      text: `${[...new Set(semantic.map((edge) => edge.type))].join(' · ')} — never in a path`,
    });
    toggle.setAttrs({ 'aria-expanded': String(host.semanticOpen) });
    toggle.addEventListener('click', () => {
      host.semanticOpen = !host.semanticOpen;
      host.render();
    });

    if (host.semanticOpen) {
      const group = parent.createDiv({ cls: 'los-atlas-connections' });
      for (const edge of semantic) {
        connectionRow(group, host, graph, edge, conceptId);
      }
    }
  }

  if (unrecognized.length) {
    parent.createDiv({
      cls: 'los-micro los-atlas-group-head',
      text: `Outside the authored vocabulary · ${plural(unrecognized.length, 'relation')}`,
    });
    const group = parent.createDiv({ cls: 'los-atlas-connections' });
    for (const edge of unrecognized) {
      connectionRow(group, host, graph, edge, conceptId);
    }
  }

  // ADR-016 decision 9 said this list was read-only and said so plainly,
  // because a dead affordance is worse than a stated absence. ADR-017 supplies
  // the governed capability that was missing, so the affordance is real now and
  // the sentence changes with it.
  parent.createDiv({
    cls: 'los-micro los-atlas-authoring',
    text: 'These are your connections. Select one to change or remove it, or connect two concepts from the graph — no AI is involved either way.',
  });
}

/**
 * The evidence drill-down: the authored tag that licenses each module chip.
 *
 * This is where an evidence claim can be interrogated. The screen makes claims
 * about how to spend weeks of study, and a claim the learner cannot open is one
 * they have to take on faith.
 */
function renderEvidenceItem(
  parent: HTMLElement,
  host: AtlasHost,
  evidence: ModuleConceptEvidence,
): void {
  const unit = host.plugin.store.get(evidence.unit_id);
  const unitLabel = unit ? projectedLabel(unit) : evidence.unit_id;

  const item = parent.createEl('button', {
    cls: 'los-item is-clickable',
    attr: { type: 'button' },
  });
  item.addEventListener(
    'click',
    evidence.kind === 'stage-concept'
      ? () => host.plugin.nav.openUnit(evidence.unit_id, evidence.stage_id)
      : () => host.plugin.nav.openUnit(evidence.unit_id),
  );

  const copy = item.createDiv({ cls: 'los-item-copy' });
  copy.createDiv({ cls: 'los-item-title', text: unitLabel });

  if (evidence.kind === 'stage-concept') {
    const stage = host.plugin.store.get(evidence.stage_id)
      ?? host.plugin.store.stage(evidence.stage_id);

    copy.createDiv({
      cls: 'los-micro',
      text: stage
        ? `Stage tag · ${projectedLabel(stage)}`
        : `Stage tag · ${evidence.stage_id}`,
    });
  } else {
    copy.createDiv({
      cls: 'los-micro',
      text: `Reviewed knowledge-map node · ${evidence.node_id}`,
    });
  }
}

function renderEvidence(
  parent: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
  conceptId: string,
): void {
  const modules = modulesFor(graph, conceptId);

  if (!modules.length) {
    parent.createDiv({
      cls: 'los-atlas-absence',
      text: 'No module publishes a stage tag or reviewed knowledge-map node for this concept. That records where teaching has been mapped, not whether the concept is relevant.',
    });
    return;
  }

  parent.createDiv({
    cls: 'los-micro los-atlas-group-head',
    text: `Taught in ${plural(modules.length, 'module')} · what exists, not what was understood`,
  });

  for (const module of modules) {
    const group = parent.createDiv({ cls: 'los-atlas-evidence' });
    const head = group.createDiv({ cls: 'los-atlas-evidence-head' });

    const moduleButton = head.createEl('button', {
      cls: 'los-atlas-evidence-module is-clickable',
      attr: { type: 'button' },
      text: module.label,
    });
    moduleButton.addEventListener(
      'click',
      () => host.plugin.nav.openModule(module.id),
    );

    if (module.actionable) {
      head.createSpan({ cls: 'los-micro', text: 'current' });
    }

    for (const evidence of evidenceFor(graph, module.id, conceptId)) {
      renderEvidenceItem(group, host, evidence);
    }
  }
}

/**
 * Provenance, gathered.
 *
 * The relation sources first — the three states kept apart — then the notes and
 * reviewed source evaluations that already point at this concept. Neither of
 * the latter licenses a relation; they are other ways into the same records.
 */
function renderSources(
  parent: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
  conceptId: string,
): void {
  const edges = [
    ...(graph.prerequisiteEdges.get(conceptId) ?? []),
    ...(graph.dependentEdges.get(conceptId) ?? []),
    ...(graph.semanticEdges.get(conceptId) ?? []),
    ...(graph.unrecognizedEdges.get(conceptId) ?? []),
  ];

  parent.createDiv({
    cls: 'los-micro los-atlas-group-head',
    text: `Where each relation comes from · ${plural(edges.length, 'relation')}`,
  });

  if (!edges.length) {
    parent.createDiv({
      cls: 'los-atlas-absence',
      text: 'No relation names this concept, so there is nothing to cite.',
    });
  }

  for (const edge of edges) {
    const provenance = provenanceOf(graph, edge);
    const row = parent.createDiv({ cls: 'los-atlas-provenance-row' });
    row.addClass(`los-atlas-provenance--${provenance.state}`);
    row.createDiv({
      cls: 'los-atlas-connection-title',
      text: edgeHeadline(graph, edge, conceptId),
    });
    row.createDiv({ cls: 'los-micro', text: provenanceSentence(provenance) });

    if (provenance.state === 'resolved') {
      button(
        row,
        'Open source',
        () => host.plugin.nav.openRecord(provenance.record),
        'quiet',
      );
    } else if (provenance.state === 'undocumented') {
      row.createDiv({
        cls: 'los-micro',
        text: 'The schema permits a relation with no source. It is undocumented, not invalid.',
      });
    } else {
      row.createDiv({
        cls: 'los-micro los-atlas-unresolved',
        text: 'The identifier is reported exactly as authored. Nothing is substituted for it.',
      });
    }
  }

  const context = buildConceptContext(host.plugin.store, conceptId);

  if (context.notes.length) {
    parent.createDiv({
      cls: 'los-micro los-atlas-group-head',
      text: `Linked notes · ${plural(context.notes.length, 'note')}`,
    });

    for (const note of context.notes) {
      const item = parent.createEl('button', {
        cls: 'los-item is-clickable',
        attr: { type: 'button' },
      });
      item.createDiv({ cls: 'los-item-title', text: projectedLabel(note) });
      item.createDiv({ cls: 'los-micro', text: 'Explicit concept backlink' });
      item.addEventListener('click', () => host.plugin.nav.openRecord(note));
    }
  }

  if (context.sources.length) {
    parent.createDiv({
      cls: 'los-micro los-atlas-group-head',
      text: `Source evaluations · ${plural(context.sources.length, 'source')}`,
    });

    for (const source of context.sources) {
      const sourceId = projectedString(source.id);
      if (!sourceId) continue;

      const item = parent.createEl('button', {
        cls: 'los-item is-clickable',
        attr: { type: 'button' },
      });
      item.createDiv({ cls: 'los-item-title', text: projectedLabel(source) });
      item.createDiv({ cls: 'los-micro', text: 'Explicit evaluation concept' });
      item.addEventListener(
        'click',
        () => host.plugin.nav.openSourceDetail(sourceId),
      );
    }
  }
}

/**
 * The questions recorded against whatever is selected.
 *
 * Absence is stated rather than left blank, and it is stated as absence of a
 * *recorded question* — not as evidence that the thing is understood. Those are
 * different facts and the interface must not let one stand for the other.
 */
function renderQuestionNote(
  parent: HTMLElement,
  host: AtlasHost,
  questions: readonly AtlasQuestion[],
  absence: string,
): void {
  const band = parent.createDiv({ cls: 'los-atlas-questions' });
  const open = questions.filter((question) => question.state === 'open');

  band.createDiv({
    cls: 'los-micro los-atlas-kicker',
    text: questions.length
      ? `My questions · ${plural(open.length, 'open')} of ${questions.length}`
      : 'My questions',
  });

  if (!questions.length) {
    band.createDiv({ cls: 'los-atlas-absence los-micro', text: absence });
    return;
  }

  const list = band.createDiv({ cls: 'los-atlas-question-list' });

  for (const question of questions) {
    const row = list.createDiv({ cls: 'los-atlas-question-row' });
    row.toggleClass('is-resolved', question.state === 'resolved');

    const open = row.createEl('button', {
      cls: 'los-atlas-question-open is-clickable',
      attr: { type: 'button' },
    });
    open.createDiv({ cls: 'los-atlas-record-title', text: question.title });
    open.createDiv({
      cls: 'los-micro',
      text: question.state === 'open' ? 'Open' : 'Resolved',
    });
    open.setAttrs({
      'aria-label': `${question.title}. ${question.state}. Open the note.`,
    });
    open.addEventListener('click', () => host.plugin.openVaultPath(question.path));

    // Resolving is Aram's statement about his own question and nothing else.
    // The wording says so, because "Done" beside a concept would read as a
    // claim about the concept.
    const actions = row.createDiv({ cls: 'los-actions' });
    const resolving = question.state === 'open';
    const control = button(
      actions,
      resolving ? 'Mark my question answered' : 'Ask it again',
      () => { void host.setQuestionState(question.noteId, resolving ? 'resolved' : 'open'); },
      'quiet',
    );
    control.addClass('los-atlas-question-action');
    control.setAttrs({
      'aria-label': resolving
        ? `Mark “${question.title}” answered`
        : `Reopen “${question.title}”`,
    });
  }
}

function renderSummary(
  parent: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
  view: AtlasNeighbourhood,
): void {
  const concept = view.focus;

  if (concept.record === null) {
    parent.createDiv({
      cls: 'los-atlas-absence',
      text: `The projection carries no concept record for ${concept.id}. It is shown under its identifier because relations name it; nothing is invented to stand in for the record.`,
    });
  }

  const facts = parent.createDiv({ cls: 'los-atlas-facts' });
  for (const [term, value] of [
    ['Taught in', moduleTrail(graph, concept.id)],
    ['Prerequisites', plural(graph.prerequisiteEdges.get(concept.id)?.length ?? 0, 'authored', 'authored')],
    ['Dependents', plural(graph.dependentEdges.get(concept.id)?.length ?? 0, 'authored', 'authored')],
    ['Semantic', plural(graph.semanticEdges.get(concept.id)?.length ?? 0, 'authored', 'authored')],
  ] as const) {
    const fact = facts.createDiv({ cls: 'los-atlas-fact' });
    fact.createDiv({ cls: 'los-micro', text: term });
    fact.createDiv({ cls: 'los-atlas-fact-value', text: value });
  }

  renderQuestionNote(
    parent,
    host,
    questionsForConcept(collectQuestions(host.plugin.store, graph), concept.id),
    `No question recorded against ${concept.label}.`,
  );

  if (concept.record) {
    const actions = parent.createDiv({ cls: 'los-actions' });
    button(
      actions,
      'Open concept',
      () => host.plugin.nav.openRecord(concept.record as ProjectionRecord),
      'quiet',
    );
  }

  parent.createDiv({
    cls: 'los-micro',
    text: 'Evidence records what exists, not what was understood.',
  });
}

export function renderInspector(
  parent: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
  view: AtlasNeighbourhood,
): void {
  const panel = parent.createEl('aside', { cls: 'los-atlas-inspector' });
  const headingId = 'los-atlas-inspector-heading';
  panel.setAttrs({ role: 'complementary', 'aria-labelledby': headingId });

  panel.createDiv({ cls: 'los-micro los-atlas-kicker', text: 'Selected concept' });
  panel.createEl('h2', { text: view.focus.label }).setAttribute('id', headingId);

  const aliases = aliasesOf(view.focus.record);
  if (aliases.length) {
    panel.createDiv({
      cls: 'los-micro',
      text: `Also called ${aliases.join(' · ')}`,
    });
  }

  filterTabs<AtlasInspectorTab>(
    panel,
    'What to inspect about this concept',
    TABS,
    host.tab,
    (value: AtlasInspectorTab) => {
      host.tab = value;
      host.render();
    },
  );

  const body = panel.createDiv({ cls: 'los-atlas-inspector-body' });
  enableButtonGroupKeyboardNavigation(body, 'vertical');

  const selectedEdge = host.edgeId ? graph.relationByIdentity.get(host.edgeId) : null;
  if (selectedEdge) {
    body.createDiv({ cls: 'los-micro', text: 'Selected connection' });
    connectionRow(body, host, graph, selectedEdge, selectedEdge.from);
    renderQuestionNote(
      body,
      host,
      questionsForRelation(collectQuestions(host.plugin.store, graph), selectedEdge.id),
      'No question recorded against this connection.',
    );
    // Editing and removing live with the selected relation, so the thing being
    // changed is the thing on screen (ADR-017 decision 1).
    renderRemoveConnection(body, host, graph, selectedEdge);
    button(body, 'Close connection', () => { host.edgeId = null; host.render(); }, 'quiet');
  }

  switch (host.tab) {
    case 'connections':
      renderConnections(body, host, graph, view.focus.id);
      break;
    case 'evidence':
      renderEvidence(body, host, graph, view.focus.id);
      break;
    case 'sources':
      renderSources(body, host, graph, view.focus.id);
      break;
    case 'summary':
    default:
      renderSummary(body, host, graph, view);
      break;
  }
}

export function renderMissingInspector(
  parent: HTMLElement,
  message: string,
): void {
  empty(parent, 'No concept selected', message);
}
