import { renderPracticeReview } from './practice';
import { button, empty } from '../../components';
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
  canonicalSentence,
  conceptLabel,
  evidenceFor,
  modulesFor,
  provenanceOf,
  relationPhrase,
  strictPath,
  type AtlasEdge,
  type AtlasGraph,
  type AtlasNeighbourhood,
} from './graph';
import { layerBadge } from './text-navigation';
import {
  collectQuestions,
  questionsForConcept,
  questionsForRelation,
  type AtlasQuestion,
} from './questions';
import { conceptDisclosure } from './disclosure';
import {
  relationEligibility,
  rowOf,
} from './relation-editor';
import {
  contextSentence,
  edgeHeadline,
  moduleTrail,
  otherEnd,
  plural,
  provenanceSentence,
} from './narrative';
import type { AtlasHost } from './ports';

/**
 * The concept and relation inspectors (P4 step 26).
 *
 * A landmark and a live region, not a dialog. The concept inspector is one
 * ordered list of sections — Definition, Prerequisites, Dependents, Related
 * concepts, Path, Sources, Practice, Questions, History — so every essential
 * fact is reachable by keyboard without a Canvas tab. The relation inspector
 * offers exactly the lifecycle actions Core admits for that row, and no
 * impossible control is ever rendered.
 */

function aliasesOf(record: ProjectionRecord | null): readonly string[] {
  return Array.isArray(record?.aliases)
    ? record.aliases
      .map((value: unknown) => projectedString(value))
      .filter((value): value is string => Boolean(value))
    : [];
}

function section(parent: HTMLElement, title: string): HTMLElement {
  const wrap = parent.createDiv({ cls: 'los-atlas-inspector-section' });
  wrap.createEl('h3', { cls: 'los-atlas-section-title', text: title });
  return wrap;
}

function absence(parent: HTMLElement, text: string): void {
  parent.createDiv({ cls: 'los-atlas-absence', text });
}

/** One relation row: a keyboard button that opens the relation inspector. */
function relationRow(
  parent: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
  edge: AtlasEdge,
  conceptId: string,
): void {
  const row = parent.createEl('button', {
    cls: 'los-atlas-connection is-clickable',
    attr: { type: 'button' },
  });
  row.setAttribute('data-relation-id', edge.id);
  row.setAttribute('data-row-key', `relation:${edge.id}`);
  row.toggleClass('is-selected', host.edgeId === edge.id);

  const headline = row.createDiv({ cls: 'los-atlas-connection-title' });
  headline.createSpan({ text: edgeHeadline(graph, edge, conceptId) });
  layerBadge(headline, edge);

  row.createDiv({
    cls: 'los-micro',
    text: `${moduleTrail(graph, otherEnd(edge, conceptId))} · ${provenanceSentence(provenanceOf(graph, edge))} · ${contextSentence(edge)} · evidence: ${edge.evidenceState}`,
  });
  if (edge.context) {
    row.createDiv({ cls: 'los-atlas-connection-context', text: edge.context });
  }
  row.setAttrs({
    'aria-label': `Inspect connection: ${canonicalSentence(graph, edge)}. Evidence ${edge.evidenceState}.`,
  });
  row.addEventListener('click', () => {
    host.inspectorOrigin = `relation:${edge.id}`;
    host.focusInspector = true;
    host.inspectEdge(edge.id);
  });
}

function renderRelationGroup(
  parent: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
  conceptId: string,
  edges: readonly AtlasEdge[],
  emptyText: string,
): void {
  if (!edges.length) {
    absence(parent, emptyText);
    return;
  }
  const group = parent.createDiv({ cls: 'los-atlas-connections' });
  enableButtonGroupKeyboardNavigation(group, 'vertical');
  for (const edge of edges) relationRow(group, host, graph, edge, conceptId);
}

/**
 * The evidence drill-down: the authored tag that licenses each module chip.
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

function renderModuleEvidence(
  parent: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
  conceptId: string,
): void {
  const modules = modulesFor(graph, conceptId);

  if (!modules.length) {
    absence(parent, 'No module publishes a stage tag or reviewed knowledge-map node for this concept. That records where teaching has been mapped, not whether the concept is relevant.');
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

function renderRelationSources(
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
    absence(parent, 'No relation names this concept, so there is nothing to cite.');
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
      item.setAttribute('data-note-id', projectedString(note.id) ?? '');
      item.createDiv({ cls: 'los-item-title', text: projectedLabel(note) });
      item.createDiv({
        cls: 'los-micro',
        text: [noteMetadata(note), 'Explicit concept backlink'].filter(Boolean).join(' · '),
      });
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
 * *recorded question* — not as evidence that the thing is understood.
 */
function renderQuestionNote(
  parent: HTMLElement,
  host: AtlasHost,
  questions: readonly AtlasQuestion[],
  absenceText: string,
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
    band.createDiv({ cls: 'los-atlas-absence los-micro', text: absenceText });
    return;
  }

  const list = band.createDiv({ cls: 'los-atlas-question-list' });

  for (const question of questions) {
    const row = list.createDiv({ cls: 'los-atlas-question-row' });
    row.toggleClass('is-resolved', question.state === 'resolved');

    const openButton = row.createEl('button', {
      cls: 'los-atlas-question-open is-clickable',
      attr: { type: 'button' },
    });
    openButton.createDiv({ cls: 'los-atlas-record-title', text: question.title });
    openButton.createDiv({
      cls: 'los-micro',
      text: question.state === 'open' ? 'Open' : 'Resolved',
    });
    openButton.setAttrs({
      'aria-label': `${question.title}. ${question.state}. Open the note.`,
    });
    openButton.addEventListener('click', () => host.plugin.openVaultPath(question.path));

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

function noteMetadata(note: ProjectionRecord): string {
  const labels: Record<string, string> = {
    reference: 'Reference', 'exercise-bank': 'Exercise bank', 'mock-exam': 'Mock exam',
    question: 'Question', synthesis: 'Synthesis', derivation: 'Derivation',
    crosswalk: 'Crosswalk', implementation: 'Implementation',
    user: 'User authored', mixed: 'Mixed authorship', 'operator-drafted': 'Operator draft',
  };
  return [projectedString(note.role), projectedString(note.authorship)]
    .filter((value): value is string => Boolean(value))
    .map((value) => labels[value] ?? value).join(' · ');
}

function renderLinkedNote(parent: HTMLElement, host: AtlasHost, note: ProjectionRecord): void {
  const row = parent.createEl('button', {
    cls: 'los-atlas-record los-atlas-linked-note is-clickable', attr: { type: 'button' },
  });
  row.setAttribute('data-note-id', projectedString(note.id) ?? '');
  const copy = row.createDiv({ cls: 'los-atlas-record-copy' });
  copy.createDiv({ cls: 'los-atlas-record-title', text: projectedLabel(note) });
  copy.createDiv({ cls: 'los-micro', text: noteMetadata(note) });
  row.createSpan({ cls: 'los-atlas-record-open', text: 'Open' });
  row.addEventListener('click', () => host.plugin.nav.openRecord(note));
}

/** Practice notes explicitly linked to the concept. */
function renderPractice(
  parent: HTMLElement,
  host: AtlasHost,
  conceptId: string,
): void {
  const context = buildConceptContext(host.plugin.store, conceptId);
  const practice = context.notes.filter((note) => {
    const role = projectedString(note.role);
    return role === 'exercise-bank' || role === 'mock-exam';
  });
  if (!practice.length) {
    absence(parent, 'No exercise bank or mock exam is linked to this concept. Practice stays reachable from its source note; nothing is inferred from tags or titles.');
    return;
  }
  const list = parent.createDiv({ cls: 'los-atlas-records' });
  enableButtonGroupKeyboardNavigation(list, 'vertical');
  for (const note of practice) {
    const entry = list.createDiv();
    renderLinkedNote(entry, host, note);
    renderPracticeReview(entry, host.plugin, note);
  }
  parent.createDiv({
    cls: 'los-micro',
    text: 'Practice links back to the source note. No answer text, key or mastery score is shown here.',
  });
}

function renderPathSection(
  parent: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
  conceptId: string,
): void {
  const path = strictPath(graph, conceptId);
  if (!path.ok) {
    const blocked = parent.createDiv({ cls: 'los-atlas-blocked' });
    blocked.setAttrs({ role: 'alert' });
    blocked.createDiv({
      cls: 'los-atlas-blocked-title',
      text: 'No learning order exists for this concept',
    });
    blocked.createDiv({
      cls: 'los-atlas-blocked-body',
      text: `These concepts require one another in a loop: ${path.cycle.join(' → ')}.`,
    });
    return;
  }
  if (path.total === 1) {
    absence(parent, 'No authored prerequisites, so the path is this concept alone. That is a statement about the registry, not about difficulty.');
    return;
  }
  const steps = parent.createEl('ol', { cls: 'los-atlas-path-steps' });
  for (const layer of path.layers) {
    for (const concept of layer) {
      const item = steps.createEl('li', { cls: 'los-atlas-path-step' });
      const control = item.createEl('button', {
        cls: 'los-atlas-path-step-button is-clickable',
        attr: { type: 'button' },
        text: concept.label,
      });
      control.setAttribute('data-row-key', `concept:${concept.id}`);
      const incoming = path.edges.find((edge) => edge.dependentId === concept.id);
      item.createDiv({
        cls: 'los-micro',
        text: incoming ? `evidence: ${incoming.evidenceState}` : 'the concept itself',
      });
      control.addEventListener('click', () => {
        host.inspectorOrigin = `concept:${concept.id}`;
        host.focusInspector = true;
        host.go({ concept: concept.id });
      });
    }
  }
}

/* -------------------------------------------------------------------------
 * The relation inspector
 * ---------------------------------------------------------------------- */

function renderRelationActionForm(
  parent: HTMLElement,
  host: AtlasHost,
  edge: AtlasEdge,
): void {
  const action = host.relationAction;
  if (!action || action.edgeId !== edge.id) return;
  const form = parent.createDiv({ cls: 'los-atlas-action-form' });
  form.setAttrs({ role: 'group', 'aria-label': `${action.kind} this connection` });
  form.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation?.();
      host.relationAction = null;
      host.restoreFocus = true;
      host.render();
    }
  });

  if (action.kind === 'veto' || action.kind === 'retract') {
    form.createEl('label', { cls: 'los-micro', text: `Why is this connection being ${action.kind === 'veto' ? 'vetoed' : 'retracted'}? (1–400 characters)` });
    const reason = form.createEl('textarea', {
      cls: 'los-atlas-action-reason',
      attr: { rows: '2', maxlength: '400' },
    });
    reason.value = action.reason;
    reason.addEventListener('input', () => { action.reason = reason.value; });
  } else if (edge.status === 'vetoed') {
    form.createDiv({
      cls: 'los-micro',
      text: 'Restoring a vetoed connection needs fresh evidence from a previously unused registered source.',
    });
    const fields: Array<[string, string, (value: string) => void]> = [
      ['Source ID', action.sourceId, (value) => { action.sourceId = value; }],
      ['Material path (under materials/)', action.materialRelpath, (value) => { action.materialRelpath = value; }],
      ['File SHA-256', action.fileSha256, (value) => { action.fileSha256 = value; }],
      ['Physical PDF page', action.page, (value) => { action.page = value; }],
      ['Quote (1–240 characters)', action.quote, (value) => { action.quote = value; }],
    ];
    for (const [label, value, set] of fields) {
      form.createEl('label', { cls: 'los-micro', text: label });
      const input = form.createEl('input', { cls: 'los-atlas-action-field', attr: { type: 'text', value } });
      input.addEventListener('input', () => set(input.value));
    }
  } else {
    form.createDiv({ cls: 'los-micro', text: 'This restores the connection as active. Its history stays recorded.' });
  }

  if (action.error) {
    form.createDiv({ cls: 'los-atlas-editor-refusal los-micro', text: action.error })
      .setAttrs({ role: 'alert' });
  }

  const actions = form.createDiv({ cls: 'los-actions' });
  button(actions, action.kind === 'restore' ? 'Restore this connection' : `${action.kind === 'veto' ? 'Veto' : 'Retract'} this connection`,
    () => { void host.submitRelationAction(); }, 'quiet');
  button(actions, 'Cancel', () => {
    host.relationAction = null;
    host.restoreFocus = true;
    host.render();
  }, 'tertiary');
}

function renderRelationInspector(
  panel: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
  edge: AtlasEdge,
): void {
  panel.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !host.relationAction) {
      host.inspectorOrigin = `relation:${edge.id}`;
      host.edgeId = null;
      host.restoreFocus = true;
      host.render();
    }
  });
  panel.createDiv({ cls: 'los-micro', text: 'Selected connection' });
  const heading = panel.createEl('h2', { text: canonicalSentence(graph, edge) });
  heading.setAttrs({ tabindex: '-1', 'data-atlas-inspector-heading': 'true' });
  layerBadge(panel, edge);

  const facts = panel.createDiv({ cls: 'los-atlas-facts' });
  const fact = (term: string, value: string) => {
    const row = facts.createDiv({ cls: 'los-atlas-fact' });
    row.createDiv({ cls: 'los-micro', text: term });
    row.createDiv({ cls: 'los-atlas-fact-value', text: value });
  };

  const endpoint = (term: string, conceptId: string) => {
    const row = facts.createDiv({ cls: 'los-atlas-fact' });
    row.createDiv({ cls: 'los-micro', text: term });
    const control = button(row, conceptLabel(graph, conceptId), () => {
      host.inspectorOrigin = `concept:${conceptId}`;
      host.focusInspector = true;
      host.go({ concept: conceptId });
    }, 'quiet');
    control.setAttribute('data-row-key', `concept:${conceptId}`);
  };
  endpoint('From', edge.from);
  fact('Type', `${relationPhrase(edge.type)} (${edge.type})`);
  endpoint('To', edge.to);
  fact('Context', edge.context ?? 'No context recorded. The schema permits that, and nothing is invented to fill it.');
  // The Atlas is agent-run (ADR-024 amendment): Aram reviews the keeper's
  // relations after the fact, so who added each one has to be visible.
  fact('Added by', edge.origin === 'aram'
    ? 'You, in the app'
    : 'An agent (the Atlas keeper, or the earlier pilot). Veto or pin it here.');
  const scopes = new Set([
    ...modulesFor(graph, edge.from).map((module) => module.label),
    ...modulesFor(graph, edge.to).map((module) => module.label),
  ]);
  fact('Affected scopes', scopes.size ? [...scopes].join(' · ') : 'No module evidence recorded for either endpoint');
  fact('Status', edge.status === 'active'
    ? 'active'
    : `${edge.status}${edge.statusReason ? ` — ${edge.statusReason}` : ''}`);
  if (edge.pinned) fact('Pinned', 'Only an exact unpin is accepted');
  fact('Evidence', edge.evidenceDisputed
    ? 'disputed' : edge.evidenceState);

  if (edge.evidence.length) {
    const bindings = panel.createDiv({ cls: 'los-atlas-bindings' });
    bindings.createDiv({ cls: 'los-micro los-atlas-group-head', text: 'Evidence bindings' });
    edge.evidence.forEach((binding, ordinal) => {
      const item = bindings.createDiv({ cls: 'los-atlas-binding' });
      item.createDiv({ cls: 'los-atlas-binding-quote', text: `“${binding.quote}”` });
      item.createDiv({
        cls: 'los-micro',
        text: `${binding.source_id} · physical page ${binding.page}`,
      });
      button(item, 'Open evidence', () => host.openEvidence(edge.id, ordinal), 'quiet');
    });
  }

  renderQuestionNote(
    conceptDisclosure(panel, host, `${edge.id}:questions`, 'Questions about this connection'),
    host,
    questionsForRelation(collectQuestions(host.plugin.store, graph), edge.id),
    'No question recorded against this connection.',
  );

  const eligibility = relationEligibility(edge);
  const actions = panel.createDiv({ cls: 'los-actions los-atlas-relation-actions' });
  if (eligibility.edit) {
    const editBtn = button(actions, 'Edit', () => {
      host.inspectorOrigin = 'edit-connection';
      host.editRelation(edge);
    }, 'quiet');
    editBtn.addClass('los-atlas-edit-connection');
    editBtn.setAttrs({ 'data-row-key': 'edit-connection' });
  }
  if (eligibility.pin) {
    button(actions, 'Pin', () => { void host.togglePin(edge); }, 'quiet');
  }
  if (eligibility.unpin) {
    button(actions, 'Unpin', () => { void host.togglePin(edge); }, 'quiet');
  }
  if (eligibility.veto) {
    button(actions, 'Veto', () => {
      host.inspectorOrigin = 'relation-action:veto';
      host.startRelationAction(edge, 'veto');
    }, 'quiet').setAttrs({ 'data-row-key': 'relation-action:veto' });
  }
  if (eligibility.retract) {
    button(actions, 'Retract', () => {
      host.inspectorOrigin = 'relation-action:retract';
      host.startRelationAction(edge, 'retract');
    }, 'quiet').setAttrs({ 'data-row-key': 'relation-action:retract' });
  }
  if (eligibility.restore) {
    button(actions, 'Restore', () => {
      host.inspectorOrigin = 'relation-action:restore';
      host.startRelationAction(edge, 'restore');
    }, 'quiet').setAttrs({ 'data-row-key': 'relation-action:restore' });
  }
  if (eligibility.remove) {
    button(actions, 'Remove', () => {
      void host.changeRelations([{ action: 'remove', old: rowOf(edge) }]);
    }, 'quiet').addClass('los-atlas-remove-connection');
  }
  renderRelationActionForm(panel, host, edge);
  panel.createDiv({
    cls: 'los-micro',
    text: `Removing or retiring takes away the claim that ${canonicalSentence(graph, edge)}. Both concepts, their notes, materials and any question recorded about them stay exactly as they are.`,
  });
  button(panel, 'Close connection', () => {
    host.inspectorOrigin = `relation:${edge.id}`;
    host.edgeId = null;
    host.relationAction = null;
    host.restoreFocus = true;
    host.render();
  }, 'quiet');
}

/* -------------------------------------------------------------------------
 * The concept inspector: sections in the specified order
 * ---------------------------------------------------------------------- */

export function renderInspector(
  parent: HTMLElement, host: AtlasHost, graph: AtlasGraph, view: AtlasNeighbourhood,
): void {
  const panel = parent.createEl('aside', { cls: 'los-atlas-inspector' });
  panel.setAttrs({ role: 'complementary', 'aria-label': `Notes and details for ${view.focus.label}` });
  const selectedEdge = host.edgeId ? graph.relationByIdentity.get(host.edgeId) : null;
  if (selectedEdge) {
    renderRelationInspector(panel, host, graph, selectedEdge);
    return;
  }

  const concept = view.focus;
  panel.createDiv({ cls: 'los-micro', text: 'Selected concept' });
  const heading = panel.createEl('h2', { text: concept.label });
  heading.setAttrs({ tabindex: '-1', 'data-atlas-inspector-heading': 'true' });

  const definition = section(panel, 'Definition');
  if (concept.record === null) {
    absence(definition, `The projection carries no concept record for ${concept.id}. It is shown under its identifier because relations name it; nothing is invented to stand in for the record.`);
  } else {
    const description = projectedString(concept.record.description);
    definition.createDiv({
      text: description ?? 'No definition is recorded for this concept. Its label and linked notes are what exists.',
    });
    const aliases = aliasesOf(concept.record);
    if (aliases.length) {
      definition.createDiv({ cls: 'los-micro', text: `Also called ${aliases.join(' · ')}` });
    }
    const actions = definition.createDiv({ cls: 'los-actions' });
    button(
      actions,
      'Open card',
      () => host.plugin.nav.openRecord(concept.record as ProjectionRecord),
      'quiet',
    );
  }

  const prerequisites = section(panel, 'Prerequisites');
  renderRelationGroup(prerequisites, host, graph, concept.id,
    graph.prerequisiteEdges.get(concept.id) ?? [],
    'No authored prerequisites. Absence, not a claim that none exist — and never a claim that the concept is foundational.');

  const dependents = section(panel, 'Dependents');
  renderRelationGroup(dependents, host, graph, concept.id,
    graph.dependentEdges.get(concept.id) ?? [],
    'No authored dependents. Nothing is inferred to fill this, and it does not mean the concept is advanced.');

  const related = section(panel, 'Related concepts');
  const relatedEdges = [
    ...(graph.semanticEdges.get(concept.id) ?? []),
    ...(graph.unrecognizedEdges.get(concept.id) ?? []),
  ];
  renderRelationGroup(related, host, graph, concept.id, relatedEdges,
    'No related concepts are recorded. Semantic relations explain; they never order learning.');

  const pathSection = section(panel, 'Path');
  renderPathSection(pathSection, host, graph, concept.id);

  const sources = section(panel, 'Sources');
  renderModuleEvidence(sources, host, graph, concept.id);
  renderRelationSources(sources, host, graph, concept.id);

  const practice = section(panel, 'Practice');
  renderPractice(practice, host, concept.id);

  const questions = section(panel, 'Questions');
  renderQuestionNote(questions, host,
    questionsForConcept(collectQuestions(host.plugin.store, graph), concept.id),
    `No question recorded against ${concept.label}.`);

  const history = section(panel, 'History');
  renderRelationGroup(history, host, graph, concept.id,
    graph.historyEdges.get(concept.id) ?? [],
    'No retracted or vetoed connection touches this concept.');

  panel.createDiv({
    cls: 'los-micro',
    text: 'Evidence records what exists, not what was understood.',
  });
}

export function renderMissingInspector(
  parent: HTMLElement,
  message: string,
): void {
  empty(parent, 'No concept selected', message);
}
