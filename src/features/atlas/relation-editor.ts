import { button, empty } from '../../components';
import { enableButtonGroupKeyboardNavigation } from '../../accessibility/button-group';
import { asString as projectedString } from '../../projection/readers';
import {
  conceptLabel,
  relationLayer,
  relationPhrase,
  SEMANTIC_RELATION_TYPES,
  STRICT_RELATION_TYPES,
  type AtlasEdge,
  type AtlasGraph,
} from './graph';
import type {
  AtlasHost,
  RelationDraft,
  RelationOperation,
  RelationRow,
} from './ports';

/**
 * Aram authors the graph (ADR-017 decision 2).
 *
 * This is the editor that makes that true rather than aspirational: create,
 * change and remove a connection, with no AI in the path, no YAML, and no
 * second application. It is the mandatory half of the Atlas — a read-only
 * graph shows connections somebody else entered.
 *
 * Three rules shape the whole form:
 *
 * 1. **The sentence is the assertion.** The preview is not decoration; it is
 *    what will be written, spelled out subject-verb-object before the save.
 *    Swapping the endpoints changes the claim, so it changes the preview
 *    visibly rather than being normalized away to suit the layout.
 * 2. **Nothing is invented.** An absent source stays absent and says so; the
 *    schema permits it. The explanation is his wording, stored as typed.
 * 3. **The visible form is the authorization.** Save acts on exactly what is
 *    on screen, and an edit binds the exact previous row. There is no second
 *    "are you sure" on an ordinary save, because a confirmation nobody reads
 *    is not consent.
 */

export type { RelationDraft, RelationOperation, RelationRow };

export const RELATION_TYPES: readonly string[] = [
  ...STRICT_RELATION_TYPES, ...SEMANTIC_RELATION_TYPES,
];

/**
 * The row exactly as Core holds it.
 *
 * The projection turns an absent `context` or `source` into null; the YAML has
 * no key at all. An edit has to name the previous row precisely, so this drops
 * what the projection added rather than sending a null Core never wrote.
 */
export function rowOf(edge: AtlasEdge): RelationRow {
  const row: RelationRow = { from: edge.from, type: edge.type, to: edge.to };
  return {
    ...row,
    ...(edge.context ? { context: edge.context } : {}),
    ...(edge.source ? { source: edge.source } : {}),
  };
}

export function draftRow(draft: RelationDraft): RelationRow {
  const context = draft.context.trim();
  const source = draft.source.trim();
  return {
    from: draft.from,
    type: draft.type,
    to: draft.to,
    ...(context ? { context } : {}),
    ...(source ? { source } : {}),
  };
}

/**
 * A blank connection. From a focused concept the known end is filled in and the
 * picker opens on the other; from the entry state neither is known yet.
 */
export function newDraft(from = '', to = ''): RelationDraft {
  return {
    mode: 'add',
    from,
    to,
    type: 'requires',
    context: '',
    source: '',
    original: null,
    picking: from ? (to ? null : 'to') : 'from',
    search: '',
    error: null,
  };
}

export function editDraft(edge: AtlasEdge): RelationDraft {
  return {
    mode: 'edit',
    from: edge.from,
    type: edge.type,
    to: edge.to,
    context: edge.context ?? '',
    source: edge.source ?? '',
    original: rowOf(edge),
    picking: null,
    search: '',
    error: null,
  };
}

/** The assertion in words, from a draft rather than a stored edge. */
export function draftSentence(graph: AtlasGraph, draft: RelationDraft): string {
  const name = (id: string, placeholder: string) => (id
    ? conceptLabel(graph, id)
    : placeholder);
  return `${name(draft.from, 'The concept you choose')} ${relationPhrase(draft.type)} ${name(draft.to, 'the concept you choose')}.`;
}

/** The study-order consequence, or null when the type claims no order. */
export function draftOrder(graph: AtlasGraph, draft: RelationDraft): string | null {
  if (relationLayer(draft.type) !== 'strict' || !draft.to || !draft.from) return null;
  return `Learn ${conceptLabel(graph, draft.to)} before ${conceptLabel(graph, draft.from)}.`;
}

/**
 * What this repository already refuses, said before the write rather than
 * after. Core validates all of it again — this exists so the answer arrives
 * while the form is still on screen, not so the check lives here.
 */
export function draftRefusal(
  graph: AtlasGraph,
  draft: RelationDraft,
): string | null {
  if (!draft.from) return 'Choose the concept this claim is about.';
  if (!draft.to) return 'Choose the concept at the other end.';
  if (draft.from === draft.to) {
    return 'A concept cannot be connected to itself.';
  }
  if (!graph.conceptById.has(draft.to) || !graph.conceptById.has(draft.from)) {
    return 'Both ends must be concepts that already exist.';
  }

  const row = draftRow(draft);
  const identity = `${row.from}--${row.type}--${row.to}`;
  // An edit replaces one row. Everything below is evaluated against the graph
  // that replacement produces — the old row removed, the new one added — not
  // against the graph plus the new row. Testing an edit as if it were an
  // addition refused a plain reversal of a single edge as a loop, because the
  // edge being reversed was still in the traversal (2026-09-05 audit, F11).
  const replaced = draft.original
    ? `${draft.original.from}--${draft.original.type}--${draft.original.to}`
    : null;
  const existing = graph.relationByIdentity.get(identity);
  if (existing && identity !== replaced) {
    return 'That connection is already authored.';
  }

  if (relationLayer(row.type) === 'strict') {
    // `requires` runs dependent → prerequisite, so a cycle is a chain of
    // prerequisites that comes back. Core owns REL-PREREQ-CYCLE; this only
    // avoids sending a write that is certain to be refused.
    const seen = new Set<string>([row.from]);
    const frontier = [row.to];
    while (frontier.length) {
      const id = frontier.pop() as string;
      if (id === row.from) return 'That would make a loop of prerequisites.';
      if (seen.has(id)) continue;
      seen.add(id);
      for (const edge of graph.prerequisiteEdges.get(id) ?? []) {
        if (replaced && `${edge.from}--${edge.type}--${edge.to}` === replaced) continue;
        frontier.push(edge.to);
      }
    }
  }

  if (row.source && !graph.conceptById.has(row.source)
    && !graph.resolvedSources.has(row.source)
    && !/^(note|source)-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.source)) {
    return 'A source must be an existing note or source identifier.';
  }

  return null;
}

/* -------------------------------------------------------------------------
 * The form
 * ---------------------------------------------------------------------- */

function renderEndpoint(
  parent: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
  draft: RelationDraft,
  end: 'from' | 'to',
): void {
  const field = parent.createDiv({ cls: 'los-atlas-editor-endpoint' });
  field.createDiv({
    cls: 'los-micro',
    text: end === 'from' ? 'Subject' : 'Object',
  });

  const chosen = draft[end];
  const control = button(
    field,
    chosen ? conceptLabel(graph, chosen) : 'Choose a concept',
    () => {
      draft.picking = draft.picking === end ? null : end;
      draft.search = '';
      host.render();
    },
    'quiet',
  );
  control.addClass('los-atlas-editor-endpoint-button');
  control.setAttrs({ 'aria-expanded': String(draft.picking === end) });

  if (draft.picking !== end) return;

  const picker = field.createDiv({ cls: 'los-atlas-editor-picker' });
  const input = picker.createEl('input', {
    cls: 'los-atlas-editor-search',
    attr: {
      type: 'search',
      placeholder: 'Search concepts by name or alias',
      value: draft.search,
    },
  });

  const results = picker.createDiv({ cls: 'los-atlas-editor-results' });
  const paint = () => {
    results.empty();
    const query = draft.search.trim();
    const matches = (query
      ? host.plugin.store.search(query, ['concept'])
        .map((record) => projectedString(record.id))
        .filter((id): id is string => Boolean(id))
      : graph.concepts.map((concept) => concept.id))
      .filter((id) => id !== draft[end === 'from' ? 'to' : 'from'])
      .slice(0, 12);

    if (!matches.length) {
      results.createDiv({
        cls: 'los-atlas-absence los-micro',
        text: `Nothing matches “${query}”. Both ends must already be registered concepts; this never creates one.`,
      });
      return;
    }

    enableButtonGroupKeyboardNavigation(results, 'vertical');
    for (const id of matches) {
      const row = results.createEl('button', {
        cls: 'los-atlas-editor-result is-clickable',
        attr: { type: 'button' },
        text: conceptLabel(graph, id),
      });
      row.addEventListener('click', () => {
        if (end === 'from') draft.from = id; else draft.to = id;
        draft.picking = null;
        draft.error = null;
        host.render();
      });
    }
  };

  input.addEventListener('input', () => {
    draft.search = input.value;
    paint();
  });
  paint();
}

export function renderRelationEditor(
  parent: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
  draft: RelationDraft,
): void {
  const panel = parent.createEl('section', { cls: 'los-atlas-editor' });
  panel.setAttrs({ role: 'region', 'aria-label': 'Connection editor' });

  panel.createDiv({
    cls: 'los-micro los-atlas-kicker',
    text: draft.mode === 'add' ? 'Connect concepts' : 'Change this connection',
  });

  const ends = panel.createDiv({ cls: 'los-atlas-editor-ends' });
  renderEndpoint(ends, host, graph, draft, 'from');

  const types = panel.createDiv({ cls: 'los-atlas-editor-types' });
  types.createDiv({ cls: 'los-micro', text: 'Relationship' });
  const group = types.createDiv({ cls: 'los-atlas-editor-typegroup' });
  group.setAttrs({ role: 'group', 'aria-label': 'Relationship type' });
  enableButtonGroupKeyboardNavigation(group, 'horizontal');
  for (const type of RELATION_TYPES) {
    const control = button(group, relationPhrase(type), () => {
      draft.type = type;
      draft.error = null;
      host.render();
    }, 'quiet');
    control.addClass('los-atlas-editor-type');
    control.toggleClass('is-active', draft.type === type);
    control.toggleClass('is-strict', relationLayer(type) === 'strict');
    control.setAttrs({ 'aria-pressed': String(draft.type === type) });
  }

  renderEndpoint(ends, host, graph, draft, 'to');

  const swap = button(ends, 'Swap ends', () => {
    const from = draft.from;
    draft.from = draft.to;
    draft.to = from;
    draft.error = null;
    host.render();
  }, 'quiet');
  swap.addClass('los-atlas-editor-swap');
  swap.setAttrs({ 'aria-label': 'Swap subject and object — this changes the claim' });

  // The assertion, in the words it will be stored and read in.
  const preview = panel.createDiv({ cls: 'los-atlas-editor-preview' });
  preview.setAttrs({ role: 'status' });
  preview.createDiv({
    cls: 'los-atlas-editor-sentence',
    text: draftSentence(graph, draft),
  });
  // Three cases, not two. A strict type with the far end still unchosen has an
  // order — it just cannot be stated yet, and saying "no study order" there
  // would describe the relation type wrongly.
  const order = draftOrder(graph, draft);
  const strict = relationLayer(draft.type) === 'strict';
  preview.createDiv({
    cls: 'los-micro',
    text: order
      ? `${order} The arrow points that way in the graph.`
      : strict
        ? 'This orders study. Which way becomes visible once both ends are chosen.'
        : 'A semantic relation states no study order, and never reorders a path.',
  });

  if (draft.mode === 'edit' && draft.original) {
    preview.createDiv({
      cls: 'los-micro los-atlas-editor-was',
      text: `Was: ${conceptLabel(graph, draft.original.from)} ${relationPhrase(draft.original.type)} ${conceptLabel(graph, draft.original.to)}.`,
    });
  }

  const explanation = panel.createDiv({ cls: 'los-atlas-editor-field' });
  explanation.createEl('label', { cls: 'los-micro', text: 'Why, in your words (optional)' })
    .setAttribute('for', 'los-atlas-editor-context');
  const context = explanation.createEl('textarea', {
    cls: 'los-atlas-editor-context',
    attr: { id: 'los-atlas-editor-context', rows: '2' },
  });
  context.value = draft.context;
  context.addEventListener('input', () => { draft.context = context.value; });

  const citation = panel.createDiv({ cls: 'los-atlas-editor-field' });
  citation.createEl('label', { cls: 'los-micro', text: 'Source or note (optional)' })
    .setAttribute('for', 'los-atlas-editor-source');
  const source = citation.createEl('input', {
    cls: 'los-atlas-editor-source',
    attr: {
      id: 'los-atlas-editor-source',
      type: 'text',
      placeholder: 'note-… or source-…',
      value: draft.source,
    },
  });
  source.addEventListener('input', () => { draft.source = source.value; });
  citation.createDiv({
    cls: 'los-micro',
    text: draft.source.trim()
      ? 'Cited evidence is recorded exactly as given.'
      : 'No source recorded. The schema allows that, and nothing is invented to fill it.',
  });

  const refusal = draft.error ?? draftRefusal(graph, draft);
  if (refusal) {
    panel.createDiv({ cls: 'los-atlas-editor-refusal los-micro', text: refusal })
      .setAttrs({ role: 'alert' });
  }

  const actions = panel.createDiv({ cls: 'los-actions' });
  const save = button(
    actions,
    draft.mode === 'add' ? 'Save this connection' : 'Save the change',
    () => {
      const row = draftRow(draft);
      void host.changeRelations([draft.mode === 'add'
        ? { action: 'add', new: row }
        : { action: 'replace', old: draft.original as RelationRow, new: row }]);
    },
  );
  save.addClass('los-atlas-editor-save');
  if (refusal) save.setAttrs({ disabled: 'true', 'aria-disabled': 'true' });

  button(actions, 'Cancel', () => {
    host.editor = null;
    host.render();
  }, 'quiet').addClass('los-atlas-editor-cancel');
}

/** The removal confirmation names the exact assertion being removed. */
export function renderRemoveConnection(
  parent: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
  edge: AtlasEdge,
): void {
  const wrap = parent.createDiv({ cls: 'los-actions' });

  button(wrap, 'Change', () => {
    host.editor = editDraft(edge);
    host.render();
  }, 'quiet').addClass('los-atlas-edit-connection');

  button(wrap, 'Remove', () => {
    void host.changeRelations([{ action: 'remove', old: rowOf(edge) }]);
  }, 'quiet').addClass('los-atlas-remove-connection');

  parent.createDiv({
    cls: 'los-micro',
    text: `Removing takes away the claim that ${conceptLabel(graph, edge.from)} ${relationPhrase(edge.type)} ${conceptLabel(graph, edge.to)}. Both concepts, their notes, materials and any question recorded about them stay exactly as they are.`,
  });
}

/** Shown when the Atlas has no concepts to connect at all. */
export function renderEditorUnavailable(parent: HTMLElement): void {
  empty(
    parent,
    'Nothing to connect yet',
    'A connection joins two registered concepts. None are published, so there is nothing to join.',
  );
}
