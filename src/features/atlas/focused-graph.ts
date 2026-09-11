import { badge, button, empty } from '../../components';
import { enableButtonGroupKeyboardNavigation } from '../../accessibility/button-group';
import {
  conceptLabel,
  relationPhrase,
  strictPath,
  type AtlasConcept,
  type AtlasEdge,
  type AtlasGraph,
  type AtlasNeighbourhood,
  type AtlasNode,
} from './graph';
import {
  edgeHeadline,
  moduleTrail,
  otherEnd,
  plural,
  provenanceLine,
  relationSentences,
  subgraphSummary,
} from './narrative';
import type { AtlasHost } from './ports';
import { mountEdges } from './edge-layer';

/**
 * The focused graph and its outline — two renderings of one neighbourhood.
 *
 * They are in the same file because they must not drift. The outline is a
 * *complete alternative*, not a fallback summary: every node and every edge
 * the picture draws is a row here, with the relation type and the provenance
 * written out. That is what lets the picture carry meaning in position, weight
 * and dash without any of those being the only carrier (WCAG 2.2 §1.4.1).
 *
 * The layout is deterministic and in-house. Nodes are laid out in columns by
 * their distance from the focus, which the read model has already computed; no
 * geometry is solved, so no layout library is needed and the same manifest
 * revision always draws the same picture. Connectors are decoration: they are
 * `aria-hidden`, outside the tab order, and every relationship they suggest is
 * also stated in the text on the node itself.
 */

const COLUMN_HEADINGS: Readonly<Record<string, string>> = {
  prerequisite: 'Prerequisites',
  focus: 'Selected concept',
  dependent: 'Dependents',
  related: 'Semantic neighbours',
};

function nodeAttachment(
  graph: AtlasGraph,
  view: AtlasNeighbourhood,
  node: AtlasNode,
): string {
  if (node.direction === 'focus') return moduleTrail(graph, node.concept.id);

  // Which authored relation put this node on the screen, and to what. At depth
  // 1 the far end is always the focus; past that it is another drawn node, and
  // saying so is the difference between a picture and a decorated list.
  const edges = view.strictEdges.filter((edge) =>
    edge.from === node.concept.id || edge.to === node.concept.id);
  const toward = edges.filter((edge) =>
    otherEnd(edge, node.concept.id) !== node.concept.id);
  const nearest = toward.find((edge) => {
    const other = otherEnd(edge, node.concept.id);
    const otherNode = view.nodes.find((row) => row.concept.id === other);
    return (otherNode?.distance ?? Number.MAX_SAFE_INTEGER) < node.distance;
  }) ?? toward[0];

  if (node.direction === 'related') {
    const semantic = view.semanticEdges.find((edge) =>
      edge.from === node.concept.id || edge.to === node.concept.id);
    const type = semantic ? relationPhrase(semantic.type) : 'related';
    return `${type} · ${moduleTrail(graph, node.concept.id)}`;
  }

  if (!nearest) return moduleTrail(graph, node.concept.id);

  return `${relationSentences(graph, nearest)[0]} · ${moduleTrail(graph, node.concept.id)}`;
}

function renderNode(
  parent: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
  view: AtlasNeighbourhood,
  node: AtlasNode,
): void {
  const control = parent.createEl('button', {
    cls: 'los-atlas-node is-clickable',
    attr: { type: 'button' },
  });
  control.addClass(`los-atlas-node--${node.direction}`);
  control.setAttribute('data-atlas-concept', node.concept.id);
  control.toggleClass('is-focus', node.direction === 'focus');

  if (node.concept.record === null) {
    control.addClass('is-unresolved');
  }

  control.createDiv({
    cls: 'los-atlas-node-title',
    text: node.concept.label,
  });
  control.createDiv({
    cls: 'los-micro los-atlas-node-trail',
    text: nodeAttachment(graph, view, node),
  });

  if (node.concept.record === null) {
    control.createDiv({
      cls: 'los-micro',
      text: 'No concept record — shown under its identifier',
    });
  }

  control.setAttrs({
    'aria-label':
      `${node.concept.label} — ${COLUMN_HEADINGS[node.direction] ?? 'Concept'}. ${nodeAttachment(graph, view, node)}`,
  });

  if (node.direction === 'focus') {
    control.setAttrs({ 'aria-current': 'true' });
  }

  control.addEventListener('click', () => {
    if (node.direction === 'focus') return;
    host.go({ concept: node.concept.id });
  });
}

/**
 * What the depth bound left out, named.
 *
 * A bare "+2 more" tells a learner that something is missing without telling
 * them whether it matters. Expanding names them and offers the depth control;
 * it never re-orders what is already drawn, because position is the spatial
 * memory this layout relies on.
 */
function renderRemainder(
  parent: HTMLElement,
  host: AtlasHost,
  view: AtlasNeighbourhood,
  concepts: readonly AtlasConcept[],
  noun: string,
): void {
  if (!concepts.length) return;

  const card = parent.createDiv({ cls: 'los-atlas-remainder' });
  const summary = card.createEl('button', {
    cls: 'los-atlas-remainder-toggle is-clickable',
    attr: { type: 'button' },
  });
  summary.createDiv({
    cls: 'los-atlas-remainder-title',
    text: `+ ${plural(concepts.length, `more ${noun}`, `more ${noun}s`)}`,
  });
  summary.createDiv({
    cls: 'los-micro',
    text: host.remainderOpen
      ? `beyond depth ${view.depth} · counted, never dropped`
      : `beyond depth ${view.depth} · expand to name them`,
  });
  summary.setAttrs({ 'aria-expanded': String(host.remainderOpen) });
  summary.addEventListener('click', () => {
    host.remainderOpen = !host.remainderOpen;
    host.render();
  });

  if (!host.remainderOpen) return;

  const list = card.createDiv({ cls: 'los-atlas-remainder-list' });
  enableButtonGroupKeyboardNavigation(list, 'vertical');

  for (const concept of concepts) {
    const row = list.createEl('button', {
      cls: 'los-atlas-remainder-item is-clickable',
      attr: { type: 'button' },
      text: concept.label,
    });
    row.addEventListener('click', () => host.go({ concept: concept.id }));
  }
}

export function renderFocusedGraph(
  parent: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
  view: AtlasNeighbourhood,
): void {
  const canvas = parent.createDiv({ cls: 'los-atlas-canvas' });
  const lanes = canvas.createDiv({ cls: 'los-atlas-lanes' });
  lanes.setAttrs({
    role: 'group',
    'aria-label': `Concepts around ${view.focus.label}`,
  });
  enableButtonGroupKeyboardNavigation(lanes, 'both');

  const strictNodes = view.nodes.filter((node) => node.direction !== 'related');
  const columns = [...new Set(strictNodes.map((node) => node.column))]
    .sort((left, right) => left - right);

  // Absence is absence. A root has no authored prerequisites; that is a fact
  // about the registry, and calling it "foundational" would turn a gap in what
  // has been written into a claim about the concept.
  //
  // It is emitted BEFORE the column loop because prerequisites are the
  // leftmost lane (ADR-016 decision 1): arrows read prerequisite → dependent,
  // so "left" means "comes first". Emitted after the loop it landed right of
  // the focus, and the screen then said the opposite of what it means for
  // exactly those concepts that have nothing before them.
  if (!strictNodes.some((node) => node.direction === 'prerequisite')) {
    const lane = lanes.createDiv({ cls: 'los-atlas-lane los-atlas-lane--prerequisite' });
    lane.createDiv({ cls: 'los-atlas-lane-head los-micro', text: COLUMN_HEADINGS.prerequisite as string });
    const card = lane.createDiv({ cls: 'los-atlas-absence' });
    card.createDiv({ cls: 'los-atlas-absence-title', text: 'No authored prerequisites' });
    card.createDiv({ cls: 'los-micro', text: 'Absence, not a claim that none exist.' });
    renderRemainder(lane, host, view, view.beyond.prerequisites, 'prerequisite');
  }

  for (const column of columns) {
    const nodes = strictNodes.filter((node) => node.column === column);
    const first = nodes[0];
    if (!first) continue;

    const lane = lanes.createDiv({ cls: 'los-atlas-lane' });
    lane.addClass(`los-atlas-lane--${first.direction}`);
    lane.createDiv({
      cls: 'los-atlas-lane-head los-micro',
      text: column === 0
        ? COLUMN_HEADINGS.focus as string
        : `${COLUMN_HEADINGS[first.direction] as string}${Math.abs(column) > 1 ? ` · depth ${Math.abs(column)}` : ''}`,
    });

    for (const node of nodes) renderNode(lane, host, graph, view, node);

    if (column === Math.min(...columns) && column < 0) {
      renderRemainder(lane, host, view, view.beyond.prerequisites, 'prerequisite');
    }
    if (column === Math.max(...columns) && column > 0) {
      renderRemainder(lane, host, view, view.beyond.dependents, 'dependent');
    }
  }

  if (!strictNodes.some((node) => node.direction === 'dependent')) {
    const lane = lanes.createDiv({ cls: 'los-atlas-lane los-atlas-lane--dependent' });
    lane.createDiv({ cls: 'los-atlas-lane-head los-micro', text: COLUMN_HEADINGS.dependent as string });
    const card = lane.createDiv({ cls: 'los-atlas-absence' });
    card.createDiv({ cls: 'los-atlas-absence-title', text: 'No authored dependents' });
    card.createDiv({ cls: 'los-micro', text: 'Absence, not a claim that none exist.' });
    renderRemainder(lane, host, view, view.beyond.dependents, 'dependent');
  }

  const related = view.nodes.filter((node) => node.direction === 'related');

  if (related.length || view.semanticEdges.length || view.beyond.semantic.length) {
    const band = canvas.createDiv({ cls: 'los-atlas-semantic' });
    band.createDiv({
      cls: 'los-atlas-lane-head los-micro',
      text: 'Semantic context · excluded from path order',
    });

    if (related.length) {
      const row = band.createDiv({ cls: 'los-atlas-semantic-row' });
      enableButtonGroupKeyboardNavigation(row, 'horizontal');
      for (const node of related) renderNode(row, host, graph, view, node);
    }

    band.createDiv({
      cls: 'los-micro',
      text: view.beyond.semantic.length
        ? `${plural(view.beyond.semantic.length, 'semantic link')} not drawn by this lens: ${view.beyond.semantic.map((concept) => concept.label).join(' · ')}`
        : 'Turning this layer off removes nothing from a path, because it was never in one; turning it on never reorders a prerequisite.',
    });
  }

  if (view.beyond.unrecognized.length) {
    const note = canvas.createDiv({ cls: 'los-atlas-unrecognized' });
    note.createDiv({
      cls: 'los-atlas-absence-title',
      text: `${plural(view.beyond.unrecognized.length, 'relation')} outside the authored vocabulary`,
    });
    note.createDiv({
      cls: 'los-micro',
      text: `Neither strict nor semantic, so nothing traverses it: ${view.beyond.unrecognized.map((concept) => concept.label).join(' · ')}. Listed in Diagnostics.`,
    });
  }

  mountEdges(canvas, host, graph, [
    ...view.strictEdges,
    ...(host.state.lens === 'semantic' ? view.semanticEdges : []),
  ]);
  renderLegend(canvas);
}

/**
 * The legend states what the picture's visual distinctions mean — and says, in
 * the same breath, that none of them is the only carrier of that meaning.
 */
function renderLegend(parent: HTMLElement): void {
  const legend = parent.createDiv({ cls: 'los-atlas-legend' });
  legend.createDiv({ cls: 'los-micro los-atlas-legend-kicker', text: 'Legend' });

  const items = legend.createDiv({ cls: 'los-atlas-legend-items' });
  for (const [key, text] of [
    ['requires', 'requires'],
    ['builds-on', 'builds on'],
    ['semantic', 'semantic — never in a path'],
    ['order', 'arrows show study order: prerequisite → dependent'],
    ['unauthored', 'dotted — not authored'],
  ] as const) {
    const item = items.createDiv({ cls: 'los-atlas-legend-item' });
    item.createSpan({ cls: `los-atlas-legend-mark los-atlas-legend-mark--${key}` })
      .setAttrs({ 'aria-hidden': 'true' });
    item.createSpan({ text });
  }

  legend.createDiv({
    cls: 'los-micro',
    text: 'Every distinction above is also written on the node and in the outline. None of them is carried by colour, weight, or dash alone.',
  });
}

/* -------------------------------------------------------------------------
 * The outline — the same data as the graph, not a summary of it
 * ---------------------------------------------------------------------- */

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
  row.addEventListener('click', () => host.inspectEdge(edge.id));
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
    text: 'The same data as the graph, not a summary of it.',
  });

  const prerequisites = view.strictEdges;
  // Three different quantities, and conflating them is how the outline came to
  // say "No authored semantic relations" about a concept whose own header
  // reported three of them hidden by the lens (2026-09-05 audit, F10):
  // what is authored, what this lens draws, and what is genuinely absent.
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

    // Absence is only claimed when nothing is authored at all. A relation the
    // lens filters out is listed, marked as hidden, and still inspectable.
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
  keys.createDiv({ text: 'Keyboard · Tab moves between search, module filter, lens, depth, the graph, this outline and the inspector.' });
  keys.createDiv({ text: 'Arrow keys move within a group; Enter inspects the selected connection.' });
}

/* -------------------------------------------------------------------------
 * The path lens
 * ---------------------------------------------------------------------- */

export function renderPath(
  parent: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
  focusId: string,
): void {
  const path = strictPath(graph, focusId);

  if (!path.ok) {
    // Core's REL-PREREQ-CYCLE makes this unreachable on a valid registry. If it
    // is ever reached, the honest response is to refuse to present an order
    // that does not exist, and to name the concepts that make it impossible.
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

  const canvas = parent.createDiv({ cls: 'los-atlas-canvas los-atlas-canvas--path' });

  if (path.total === 1) {
    empty(
      canvas,
      'Nothing has to be worked through first',
      `${conceptLabel(graph, focusId)} has no authored prerequisites, so this path has one step — the concept itself. That is a statement about the relation registry, not about how hard the concept is.`,
    );
    return;
  }

  const lanes = canvas.createDiv({ cls: 'los-atlas-lanes los-atlas-lanes--path' });
  lanes.setAttrs({
    role: 'group',
    'aria-label': `Study order to ${conceptLabel(graph, focusId)}`,
  });
  enableButtonGroupKeyboardNavigation(lanes, 'both');

  path.layers.forEach((layer, index) => {
    const lane = lanes.createDiv({ cls: 'los-atlas-lane' });
    lane.createDiv({
      cls: 'los-atlas-lane-head los-micro',
      text: index === path.layers.length - 1
        ? 'Then the concept itself'
        : `Step ${index + 1}`,
    });

    for (const concept of layer) {
      const control = lane.createEl('button', {
        cls: 'los-atlas-node is-clickable',
        attr: { type: 'button' },
      });
      control.toggleClass('is-focus', concept.id === focusId);
      control.setAttribute('data-atlas-concept', concept.id);
      control.createDiv({ cls: 'los-atlas-node-title', text: concept.label });
      control.createDiv({
        cls: 'los-micro los-atlas-node-trail',
        text: moduleTrail(graph, concept.id),
      });
      control.addEventListener('click', () => host.go({ concept: concept.id }));
    }
  });

  mountEdges(canvas, host, graph, path.edges);

  const note = canvas.createDiv({ cls: 'los-atlas-path-note' });
  note.createDiv({
    cls: 'los-micro',
    text: `${plural(path.total, 'concept')} in ${plural(path.layers.length, 'step')}, ordered by the strict layer alone. Semantic relations are not in this order and never were.`,
  });

  const list = canvas.createDiv({ cls: 'los-atlas-outline-list' });
  enableButtonGroupKeyboardNavigation(list, 'vertical');
  list.createDiv({
    cls: 'los-micro los-atlas-outline-group',
    text: `Every step as text · ${plural(path.edges.length, 'authored relation')}`,
  });

  path.edges.forEach((edge, index) => {
    outlineRow(list, host, graph, edge, edge.from, `${index + 1} of ${path.edges.length}`);
  });
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

export { edgeHeadline };
