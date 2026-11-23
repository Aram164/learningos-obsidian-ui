import { badge, button, empty } from '../../components';
import { enableButtonGroupKeyboardNavigation } from '../../accessibility/button-group';
import {
  conceptLabel,
  strictPath,
  type AtlasEdge,
  type AtlasGraph,
  type AtlasNeighbourhood,
} from './graph';
import {
  plural,
  provenanceLine,
  relationSentences,
  subgraphSummary,
} from './narrative';
import type { AtlasHost } from './ports';

/**
 * Text-only graph navigation (P4 step 29).
 *
 * The outline and the path are complete alternatives to any picture: every
 * node and edge is a row here, with the relation type and provenance written
 * out. Spatial presentation belongs to native Canvas boards; this module is
 * what remains when no Canvas tab exists, and it carries every action.
 */

/** Inspect in place. Exploring outward is a separate, explicit action. */
export function inspectConcept(host: AtlasHost, origin: string, concept: string): void {
  host.concepts.inspections ??= new Map();
  host.concepts.inspections.set(origin, concept);
  host.edgeId = null;
  host.tab = 'summary';
  host.render();
}

/** One badge naming the layer an edge belongs to, for the inspector rows. */
export function layerBadge(parent: HTMLElement, edge: AtlasEdge): HTMLElement {
  return badge(
    parent,
    edge.layer === 'strict'
      ? 'orders learning'
      : edge.layer === 'semantic' ? 'explains only' : 'unknown type',
    edge.layer === 'strict' ? '' : 'quiet',
  );
}

function outlineRow(
  parent: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
  edge: AtlasEdge,
  focusId: string,
  position: string,
  hiddenByLens = false,
): void {
  const row = parent.createEl('button', {
    cls: 'los-atlas-outline-row is-clickable',
    attr: { type: 'button' },
  });
  row.addClass(`los-atlas-outline-row--${edge.layer}`);
  if (hiddenByLens) row.addClass('los-atlas-outline-row--hidden-by-lens');
  row.setAttribute('data-relation-id', edge.id);
  row.setAttribute('data-row-key', `relation:${edge.id}`);

  const state = hiddenByLens ? ' · hidden by the selected lens' : '';
  row.createDiv({
    cls: 'los-atlas-outline-title',
    text: `${position} · ${relationSentences(graph, edge).join(' ')}${state}`,
  });
  row.createDiv({
    cls: 'los-micro',
    text: provenanceLine(graph, edge, focusId),
  });
  row.createSpan({ cls: 'los-atlas-outline-action los-micro', text: 'Inspect connection' });
  row.setAttrs({
    'aria-label': `${relationSentences(graph, edge).join(' ')}${state}. ${provenanceLine(graph, edge, focusId)}. Inspect connection.`,
  });
  row.addEventListener('click', () => {
    host.inspectorOrigin = `relation:${edge.id}`;
    host.focusInspector = true;
    host.inspectEdge(edge.id);
  });
}

export function renderOutline(
  parent: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
  view: AtlasNeighbourhood,
): void {
  const outline = parent.createDiv({ cls: 'los-atlas-outline' });
  outline.setAttrs({
    role: 'group',
    'aria-label': `Relations of ${view.focus.label}, as text`,
  });

  const head = outline.createDiv({ cls: 'los-atlas-outline-head' });
  head.createDiv({ cls: 'los-micro los-atlas-outline-kicker', text: 'Outline' });
  head.createDiv({
    cls: 'los-atlas-outline-summary',
    text: subgraphSummary(graph, view),
  });
  head.createDiv({
    cls: 'los-micro',
    text: 'Complete authored relations at this depth, including concepts in the named remainder.',
  });

  const prerequisites = view.strictEdges;
  const authoredSemantic = graph.semanticEdges.get(view.focus.id) ?? [];
  const drawnSemantic = host.state.lens === 'semantic' ? view.semanticEdges : [];
  const drawnSemanticIds = new Set(drawnSemantic.map((edge) => edge.id));
  const hiddenSemantic = authoredSemantic
    .filter((edge) => !drawnSemanticIds.has(edge.id));

  const semanticHeading = authoredSemantic.length
    ? `Semantic · ${plural(authoredSemantic.length, 'authored', 'authored')}`
      + `, ${drawnSemantic.length} drawn by this lens`
    : 'Semantic · 0 authored';

  const list = outline.createDiv({ cls: 'los-atlas-outline-list' });
  enableButtonGroupKeyboardNavigation(list, 'vertical');

  for (const [heading, edges, absence, hidden] of [
    [
      `Visible prerequisite connections · ${plural(prerequisites.length, 'authored', 'authored')}`,
      prerequisites,
      'No authored prerequisites. Absence is not a claim that none exist; nothing is inferred to fill this row.',
      [] as readonly AtlasEdge[],
    ],
    [
      semanticHeading,
      drawnSemantic,
      'No authored semantic relations.',
      hiddenSemantic,
    ],
  ] as const) {
    if (!edges.length && !hidden.length && !absence) continue;

    list.createDiv({ cls: 'los-micro los-atlas-outline-group', text: heading });

    if (!edges.length && !hidden.length) {
      list.createDiv({ cls: 'los-atlas-outline-absence los-micro', text: absence });
      continue;
    }

    const total = edges.length + hidden.length;
    edges.forEach((edge, index) => {
      outlineRow(list, host, graph, edge, view.focus.id, `${index + 1} of ${total}`);
    });
    hidden.forEach((edge, index) => {
      outlineRow(
        list,
        host,
        graph,
        edge,
        view.focus.id,
        `${edges.length + index + 1} of ${total}`,
        true,
      );
    });
  }

  const keys = outline.createDiv({ cls: 'los-atlas-keys los-micro' });
  keys.createDiv({ text: 'Keyboard · Tab moves between search, module filter, lens, depth, the list, this outline and the inspector.' });
  keys.createDiv({ text: 'Arrow keys move within a group; Enter inspects the selected connection.' });
}

/** The strict path as an ordered text list: named steps, no picture. */
export function renderPath(
  parent: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
  focusId: string,
): void {
  const path = strictPath(graph, focusId);

  if (!path.ok) {
    const blocked = parent.createDiv({ cls: 'los-atlas-blocked' });
    blocked.setAttrs({ role: 'alert' });
    blocked.createDiv({
      cls: 'los-atlas-blocked-title',
      text: 'No learning order exists for this concept',
    });
    blocked.createDiv({
      cls: 'los-atlas-blocked-body',
      text: `These concepts require one another in a loop: ${path.cycle.join(' → ')}. A prerequisite cycle has no order, so none is shown rather than an arbitrary one.`,
    });
    button(
      blocked.createDiv({ cls: 'los-actions' }),
      'Open Diagnostics',
      () => host.go({ lens: 'diagnostics' }),
      'quiet',
    );
    return;
  }

  const wrap = parent.createDiv({ cls: 'los-atlas-path', attr: { 'data-los-scroll': `concept-path:${focusId}` } });

  if (path.total === 1) {
    empty(
      wrap,
      'Nothing has to be worked through first',
      `${conceptLabel(graph, focusId)} has no authored prerequisites, so this path has one step — the concept itself. That is a statement about the relation registry, not about how hard the concept is.`,
    );
    return;
  }

  const steps = wrap.createEl('ol', { cls: 'los-atlas-path-steps' });
  steps.setAttrs({ 'aria-label': `Study order to ${conceptLabel(graph, focusId)}` });
  path.layers.forEach((layer, index) => {
    for (const concept of layer) {
      const item = steps.createEl('li', { cls: 'los-atlas-path-step' });
      const control = item.createEl('button', {
        cls: 'los-atlas-path-step-button is-clickable',
        attr: { type: 'button' },
      });
      control.toggleClass('is-focus', concept.id === focusId);
      const inspected = host.concepts.inspections?.get(focusId) ?? focusId;
      control.toggleClass('is-selected', concept.id === inspected);
      control.setAttrs({
        'aria-pressed': String(concept.id === inspected),
        'aria-label': `Step ${index + 1}: inspect ${concept.label}`,
        'data-row-key': `concept:${concept.id}`,
      });
      control.setAttribute('data-atlas-concept', concept.id);
      control.createDiv({ cls: 'los-atlas-node-title', text: concept.label });
      const incoming = path.edges.find((edge) =>
        edge.dependentId === concept.id && edge.prerequisiteId !== concept.id);
      control.createDiv({
        cls: 'los-micro',
        text: incoming
          ? `evidence: ${incoming.evidenceState}`
          : 'the concept itself',
      });
      control.addEventListener('click', () => {
        host.inspectorOrigin = `concept:${concept.id}`;
        host.focusInspector = true;
        inspectConcept(host, focusId, concept.id);
      });
    }
  });

  wrap.createDiv({
    cls: 'los-micro',
    text: `${plural(path.total, 'concept')} in ${plural(path.layers.length, 'step')}, ordered by authored prerequisites. Related ideas do not set learning order.`,
  });

  const list = wrap.createDiv({ cls: 'los-atlas-outline-list' });
  enableButtonGroupKeyboardNavigation(list, 'vertical');
  list.createDiv({
    cls: 'los-micro los-atlas-outline-group',
    text: `Every step as text · ${plural(path.edges.length, 'authored relation')}`,
  });
  path.edges.forEach((edge, index) => {
    outlineRow(list, host, graph, edge, edge.from, `${index + 1} of ${path.edges.length}`);
  });
}
