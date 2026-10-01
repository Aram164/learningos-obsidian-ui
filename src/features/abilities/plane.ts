import { button, empty, filterTabs } from '../../components';
import { renderAtlasVariants } from '../atlas/domains';
import { enableButtonGroupKeyboardNavigation } from '../../accessibility/button-group';
import type {
  AbilityBridgeV1,
  AbilityBriefV1,
  AbilityRowV1,
} from '../../contracts/ability-context';
import type { AbilityLayoutV1 } from '../../contracts/route-v1';
import {
  annotationLabel,
  abilityOverview,
  boundsOfNodes,
  foldedVisibility,
  preparationNeighbours,
  bridgeKey,
  bridgeSymbol,
  buildAbilityPlane,
  PLANE,
  preparationSentence,
  searchAbilities,
  sentence,
  STATE_LABEL,
  type AbilityOverview,
  type PlaneBounds,
  type AbilityPlane,
  type PlaneNode,
} from './model';
import { clockTime, projectionLabels, recordsDate } from './labels';
import { renderAbilityDetail } from './detail';
import { renderExpansionState } from './expansion';
import type { AbilityHost } from './ports';
import { mountAbilityViewport } from './viewport';

const SVG = 'http://www.w3.org/2000/svg';

const LAYOUTS: ReadonlyArray<readonly [AbilityLayoutV1, string]> = [
  ['plane', 'Plane'],
  ['list', 'List'],
];

/**
 * The Ability map (Figma A1 / A2).
 *
 * All loaded groups share one plane. Preparation flows left to right; reviewed
 * bridges occupy a separately disclosed layer. Selection shows one-hop attention;
 * Details opens explicitly. Nothing
 * on this screen writes: drafting happens in a modal and confirmation happens
 * in Review.
 */
export function renderAbilityMap(root: HTMLElement, host: AbilityHost): void {
  root.empty();
  root.addClass('los-root', 'los-ability-view');
  const { plugin } = host;

  if (!plugin.store.ready) {
    root.createEl('h1', { text: 'Ability map' });
    empty(root, 'The interface contract could not be loaded', plugin.store.error,
      'Rebuild views', () => plugin.generate());
    return;
  }

  const horizon = plugin.abilityHorizon;
  horizon.ensure();
  const brief = horizon.current();
  const labels = projectionLabels(plugin.store);
  const plane = brief ? buildAbilityPlane(brief, labels) : null;
  if (brief && plane) reconcileAttention(host, plane, brief.snapshot_id);
  const selected = host.state.ability && plane?.rowOf.has(host.state.ability)
    ? host.state.ability
    : null;

  renderTopBar(root, host, plane, selected);

  if (brief && plane && host.state.ability && !selected && host.state.detail) {
    const requested = host.state.ability;
    horizon.ensureExpansion(requested);
    const focused = horizon.expansion(requested);
    if (focused && 'ability' in focused && focused.snapshot_id === brief.snapshot_id) {
      // A focused detail remains separate from the bounded graph. Never stitch
      // independently read records into the horizon's layout or counts.
      const detailPlane = { ...plane, rowOf: new Map([...plane.rowOf, [requested, focused.ability]]) };
      renderAbilityDetail(root, host, brief, detailPlane, requested);
    } else {
      const requestedPanel = root.createDiv({ cls: 'los-ability-detail' });
      requestedPanel.createEl('h1', { text: 'Requested ability' });
      if (focused && focused.snapshot_id !== brief.snapshot_id) {
        requestedPanel.createEl('p', { text: 'The focused record belongs to another snapshot. Read the horizon again before opening it.' });
        button(requestedPanel, 'Read again', () => void horizon.refresh(), 'quiet');
      } else renderExpansionState(requestedPanel, host, requested);
      button(requestedPanel, 'Back to map', () => host.go({ detail: false }), 'tertiary');
    }
    return;
  }

  if (brief && plane && selected && host.state.detail) {
    renderAbilityDetail(root, host, brief, plane, selected);
    return;
  }

  const title = root.createDiv({ cls: 'los-ability-title' });
  title.createEl('h1', { text: 'Atlas' });
  title.createEl('p', {
    text: selected
      ? 'The selected ability and its immediate preparation neighbours are highlighted.'
      : 'Select an ability to highlight its immediate neighbours. Details and complete routes open on request.',
  });

  renderToolbar(root, host, plane);

  if (!brief || !plane) {
    renderUnread(root, host);
    return;
  }
  if (!brief.abilities.length) {
    empty(root, 'No abilities are mapped yet',
      'Reviewed ability identities appear here once Core records them. An empty map says nothing about what you know.');
    return;
  }

  if (host.state.ability && !selected) {
    const outside = root.createDiv({ cls: 'los-ability-search-results' });
    outside.createEl('p', { cls: 'los-micro', text: 'The requested ability is outside this loaded horizon. Its focused detail can be read without adding records to the plane.' });
    button(outside, 'Read requested ability', () => host.go({ detail: true }), 'quiet');
  }

  if (host.query.trim()) renderSearchResults(root, host, plane, labels);

  root.createDiv({ cls: 'los-micro los-ability-scope', text: `${brief.abilities.length} of ${brief.total} abilities loaded${brief.truncated ? ' · bounded horizon' : ''}${horizon.recordsAhead ? ' · projection is behind the records' : ''}` });
  if (host.state.layout === 'list') {
    renderList(root, host, plane, brief);
    return;
  }
  renderPlane(root, host, plane, brief, selected);
}

function renderTopBar(
  root: HTMLElement,
  host: AbilityHost,
  plane: AbilityPlane | null,
  selected: string | null,
): void {
  const bar = root.createDiv({ cls: 'los-ability-topbar' });
  const crumbs = bar.createEl('nav', { cls: 'los-ability-crumbs', attr: { 'aria-label': 'Breadcrumb' } });
  const atlas = crumbs.createEl('button', {
    cls: 'los-ability-crumb is-clickable',
    text: 'Atlas',
    attr: { type: 'button' },
  });
  atlas.addEventListener('click', () => host.go({ ability: null, detail: false }));
  crumbs.createSpan({ cls: 'los-ability-crumb-sep', text: '›', attr: { 'aria-hidden': 'true' } });
  const row = selected ? plane?.rowOf.get(selected) : null;
  if (host.state.detail && row) {
    const back = crumbs.createEl('button', {
      cls: 'los-ability-crumb is-clickable',
      text: host.state.layout === 'list' ? 'List' : 'Plane',
      attr: { type: 'button' },
    });
    back.addEventListener('click', () => host.go({ detail: false }));
    crumbs.createSpan({ cls: 'los-ability-crumb-sep', text: '›', attr: { 'aria-hidden': 'true' } });
    crumbs.createSpan({ cls: 'los-ability-crumb is-current', text: row.title });
  } else {
    crumbs.createSpan({
      cls: 'los-ability-crumb is-current',
      text: host.state.layout === 'list' ? 'List' : 'Plane',
    });
  }
  renderStamp(bar, host);
}

/**
 * The context stamp (Figma 5:38): when this map was read, from which records,
 * and whether those records have moved on since the projection was built.
 */
function renderStamp(parent: HTMLElement, host: AbilityHost): void {
  const horizon = host.plugin.abilityHorizon;
  const stamp = parent.createDiv({ cls: 'los-context-stamp', attr: { role: 'status' } });
  const dot = stamp.createSpan({ cls: 'los-context-dot', attr: { 'aria-hidden': 'true' } });
  const records = recordsDate(host.plugin.store.data?._generated?.generated_at);
  const read = horizon.readTime;
  if (horizon.loading && !read) {
    dot.addClass('is-pending');
    stamp.createSpan({ text: 'Reading the ability map from Core…' });
    return;
  }
  if (!read) {
    dot.addClass('is-stale');
    stamp.createSpan({ text: horizon.error ? 'Ability map unavailable' : 'Ability map not read yet' });
    return;
  }
  const base = `Read ${clockTime(read)}${records ? ` from records of ${records}` : ''}`;
  if (horizon.recordsAhead) {
    dot.addClass('is-stale');
    stamp.createSpan({ text: `${base} · records changed since the projection` });
    const rebuild = button(stamp, 'Rebuild', () => host.plugin.generate(), 'tertiary');
    rebuild.addClass('los-context-action');
    return;
  }
  dot.addClass('is-fresh');
  stamp.createSpan({ text: `${base} · current` });
}

function renderToolbar(root: HTMLElement, host: AbilityHost, plane: AbilityPlane | null): void {
  renderAtlasVariants(root, host.plugin.nav, 'abilities');
  const bar = root.createDiv({ cls: 'los-ability-toolbar' });
  const left = bar.createDiv({ cls: 'los-ability-toolbar-left' });
  const switcher = filterTabs<AbilityLayoutV1>(
    left,
    'Ability map layout',
    LAYOUTS,
    host.state.layout,
    (value) => host.go({ layout: value, detail: false }),
  );
  switcher.addClass('los-ability-layout-switch');

  const right = bar.createDiv({ cls: 'los-ability-toolbar-right' });
  const label = right.createEl('label', {
    cls: 'los-ability-search-label',
  });
  label.createSpan({ cls: 'los-sr-only', text: 'Find an ability' });
  const search = label.createEl('input', {
    cls: 'los-ability-search',
    attr: {
      type: 'search',
      placeholder: 'Find an ability',
      value: host.query,
    },
  });
  search.value = host.query;
  search.disabled = !plane;
  search.addEventListener('input', () => {
    host.query = search.value;
    host.render();

  });
}

function renderUnread(root: HTMLElement, host: AbilityHost): void {
  const horizon = host.plugin.abilityHorizon;
  const panel = root.createDiv({ cls: 'los-ability-plane is-unread' });
  if (horizon.error) {
    empty(panel, 'The ability map could not be read', horizon.error,
      'Read again', () => void horizon.refresh());
    return;
  }
  panel.createDiv({
    cls: 'los-ability-loading',
    text: 'Reading abilities, preparation routes and bridges from Core…',
  });
}

function renderSearchResults(
  root: HTMLElement,
  host: AbilityHost,
  plane: AbilityPlane,
  labels: ReturnType<typeof projectionLabels>,
): void {
  const hits = searchAbilities(plane, host.query, labels);
  const box = root.createDiv({ cls: 'los-ability-search-results', attr: { 'aria-live': 'polite' } });
  if (!hits.length) {
    box.createDiv({ cls: 'los-micro', text: `No ability matches “${host.query.trim()}”.` });
    return;
  }
  box.createDiv({ cls: 'los-micro', text: `${hits.length} ${hits.length === 1 ? 'ability matches' : 'abilities match'}` });
  const list = box.createDiv({ cls: 'los-ability-search-list', attr: { role: 'group', 'aria-label': 'Matching abilities' } });
  enableButtonGroupKeyboardNavigation(list, 'vertical');
  for (const id of hits) {
    const row = plane.rowOf.get(id);
    if (!row) continue;
    const hit = list.createEl('button', {
      cls: 'los-ability-search-hit is-clickable',
      attr: { type: 'button' },
    });
    hit.createSpan({ cls: 'los-ability-search-title', text: row.title });
    hit.createSpan({ cls: 'los-micro', text: STATE_LABEL[row.state] });
    hit.addEventListener('click', () => {
      host.query = '';
      host.attention.retained.clear();
      host.attention.retained.add(id);
      const neighbours = preparationNeighbours(plane.groups.flatMap((group) => [...group.edges]), id);
      for (const peer of [...neighbours.prerequisites, ...neighbours.dependents]) host.attention.retained.add(peer);
      host.attention.folded.delete(id);
      host.attention.fitRequest = 'reveal';
      host.go({ group: plane.groupOfAbility.get(id) ?? null, ability: id, detail: false });
    });
  }
}

function reconcileAttention(host: AbilityHost, plane: AbilityPlane, snapshot: string): void {
  const attention = host.attention;
  const ids = new Set(plane.rowOf.keys());
  if (attention.snapshot !== snapshot) {
    if (attention.ids.size && ![...ids].some((id) => attention.ids.has(id))) attention.camera = null;
    for (const id of attention.folded) if (!ids.has(id)) attention.folded.delete(id);
    for (const id of attention.retained) if (!ids.has(id)) attention.retained.delete(id);
    if (host.bridgeKey && !plane.bridges.some((bridge) => bridgeKey(bridge) === host.bridgeKey)) host.bridgeKey = null;
    attention.snapshot = snapshot;
    attention.ids = ids;
  }
}

function renderPlane(
  root: HTMLElement, host: AbilityHost, plane: AbilityPlane, brief: AbilityBriefV1, selected: string | null,
): void {
  const overview = abilityOverview(plane);
  const visibility = foldedVisibility(overview, host.attention.folded, selected, host.attention.retained);
  const bridge = host.attention.bridgesVisible && host.bridgeKey
    ? plane.bridges.find((row) => bridgeKey(row) === host.bridgeKey) ?? null : null;
  const inspecting = Boolean(bridge || (selected && (host.attention.inspector || host.attention.routes)));
  const surface = root.createDiv({ cls: `los-ability-plane${inspecting ? ' has-inspector' : ''}` });
  const panel = surface.createDiv({ cls: 'los-ability-graph' });
  const controls = panel.createDiv({ cls: 'los-ability-camera-controls', attr: { role: 'group', 'aria-label': 'Ability camera' } });
  const overviewNav = panel.createDiv({ cls: 'los-ability-overview-nav', attr: { role: 'group', 'aria-label': 'Ability groups at overview scale' } });
  overviewNav.createDiv({ cls: 'los-micro los-ability-overview-hint', text: 'Overview · fit a group to read its abilities' });
  enableButtonGroupKeyboardNavigation(overviewNav, 'both');
  for (const region of overview.regions) {
    const fit = button(overviewNav, region.group.title, () => {
      camera.fit(region);
      if (overviewNav.hidden) viewport.focus({ preventScroll: true });
    }, 'quiet');
    fit.addClass('los-ability-overview-group');
    fit.setAttrs({ 'data-los-tab': `overview-${region.group.key}`, 'data-overview-group': region.group.key });
    fit.createSpan({ cls: 'los-micro', text: `${region.nodes.length} abilities · ${region.group.edges.length} preparation connections` });
  }
  const viewport = panel.createDiv({ cls: 'los-ability-viewport', attr: {
    tabindex: '0', role: 'region', 'aria-label': 'Ability preparation canvas. Drag the background or use the focused wheel to pan. Pinch or Ctrl plus wheel zooms at the pointer. Plus and minus zoom; F fits all; arrow keys pan.',
  } });
  const canvas = viewport.createDiv({ cls: 'los-ability-canvas' });
  canvas.setAttr('style', `width:${overview.width}px;height:${overview.height}px`);
  const neighbours = preparationNeighbours(overview.edges, selected);
  const bridgePeers = new Set<string>();
  if (selected && host.attention.bridgesVisible) for (const row of plane.bridges) {
    if (row.review.state !== 'reviewed') continue;
    if (row.from === selected) bridgePeers.add(row.to);
    if (row.to === selected) bridgePeers.add(row.from);
  }
  const highlighted = new Set([...neighbours.prerequisites, ...neighbours.dependents]);
  for (const region of overview.regions) {
    const group = region.group;
    const heading = canvas.createDiv({ cls: 'los-ability-region-head', attr: { 'data-ability-group': group.key } });
    heading.setAttr('style', `left:${region.x}px;top:${region.y}px`);
    heading.createEl('h2', { text: group.title });
    heading.createSpan({ cls: 'los-micro', text: `${group.nodes.length} abilities` });
    for (const column of group.columns) {
      if (!group.edges.length) continue;
      const head = canvas.createDiv({ cls: 'los-ability-column-head' });
      const annotation = annotationLabel(column.annotation);
      head.setText(annotation ? `${column.label} · ${annotation}` : column.label);
      head.setAttr('style', `left:${region.x + column.x}px;top:${region.y + 46}px;width:${PLANE.nodeWidth}px`);
    }
  }
  drawEdges(canvas, overview, visibility.edges, selected);
  const nodes = canvas.createDiv({ cls: 'los-ability-nodes', attr: { role: 'group', 'aria-label': 'Loaded abilities in preparation order' } });
  const cards = new Map<string, HTMLElement>();
  for (const node of overview.nodes.values()) {
    if (!visibility.nodes.has(node.id)) continue;
    const active = node.id === selected;
    const near = highlighted.has(node.id);
    const peer = bridgePeers.has(node.id);
    const attention = active ? 'Selected' : neighbours.prerequisites.has(node.id) ? 'Immediate prerequisite'
      : neighbours.dependents.has(node.id) ? 'Immediate dependent' : peer ? 'Reviewed bridge peer' : '';
    const card = nodes.createEl('button', {
      cls: `los-ability-node is-clickable los-ability-state-${node.row.state}${active ? ' is-selected' : near ? ' is-neighbour' : peer ? ' is-bridged' : selected ? ' is-muted' : ''}`,
      attr: { type: 'button', 'data-ability': node.id, 'data-los-tab': `ability-${node.id}`, 'aria-pressed': String(active),
        'aria-label': `${attention ? attention + '. ' : ''}${nodeLabel(node, plane)}`, title: `${node.row.title} · ${STATE_LABEL[node.row.state]}` },
    });
    card.setAttr('style', `left:${node.x}px;top:${node.y}px;width:${PLANE.nodeWidth}px;height:${PLANE.nodeHeight}px`);
    card.createSpan({ cls: 'los-ability-node-title', text: node.row.title });
    if (node.row.state !== 'uncertain' || node.row.evidence.length) card.createSpan({ cls: 'los-sr-only', text: STATE_LABEL[node.row.state] });
    cards.set(node.id, card);
    card.addEventListener('click', (event) => {
      if (camera.suppressClick()) return;
      const previous = host.attention.lastActivation;
      const now = Date.now();
      host.attention.lastActivation = { id: node.id, at: now };
      if (event.detail === 2 || (event.detail !== 0 && previous?.id === node.id && now - previous.at < 450)) {
        camera.fit(selectionBounds(node.id));
        host.attention.lastActivation = null;
        return;
      }
      host.bridgeKey = null;
      host.go({ group: plane.groupOfAbility.get(node.id) ?? null, ability: node.id, detail: false });
    });
    card.addEventListener('dblclick', (event) => { event.preventDefault(); camera.fit(selectionBounds(node.id)); });
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); host.go({ ability: null, detail: false }); }
      if (event.key.toLowerCase() === 'd') { event.preventDefault(); host.go({ ability: node.id, detail: true }); }
      if (event.key.toLowerCase() === 'e') {
        event.preventDefault();
        if (host.attention.folded.has(node.id)) host.attention.folded.delete(node.id); else host.attention.folded.add(node.id);
        host.render();
      }
      if (event.key.toLowerCase() === 'f') { event.preventDefault(); camera.fit(selectionBounds(node.id)); }
      if (!event.key.startsWith('Arrow')) return;
      const adjacent = preparationNeighbours(overview.edges, node.id);
      const desired = event.key === 'ArrowLeft' ? [...adjacent.prerequisites]
        : event.key === 'ArrowRight' ? [...adjacent.dependents] : [...adjacent.prerequisites, ...adjacent.dependents];
      const targets = desired.map((id) => overview.nodes.get(id)).filter((other): other is PlaneNode => Boolean(other && cards.has(other.id)))
        .sort((left, right) => Math.abs(left.y - node.y) - Math.abs(right.y - node.y));
      if (targets[0]) { event.preventDefault(); event.stopPropagation(); cards.get(targets[0].id)?.focus(); camera.reveal(boundsOfNodes([targets[0]])); }
    });
    const outgoing = overview.edges.filter((edge) => edge.from === node.id);
    if (outgoing.length) {
      const folded = host.attention.folded.has(node.id);
      const endcap = nodes.createEl('button', { cls: `los-ability-endcap${folded ? ' is-folded' : ''}`, text: folded ? '+' : '‹', attr: {
        type: 'button', 'data-fold-ability': node.id, 'data-los-tab': `fold-${node.id}`, 'aria-expanded': String(!folded),
        'aria-label': `${folded ? 'Expand' : 'Fold'} ${outgoing.length} outgoing connections from ${node.row.title}`,
      } });
      endcap.setAttr('style', `left:${node.x + PLANE.nodeWidth + 4}px;top:${node.y}px`);
      endcap.addEventListener('click', () => {
        if (camera.suppressClick()) return;
        if (folded) host.attention.folded.delete(node.id); else host.attention.folded.add(node.id);
        host.render();
      });
    }
    const hidden = visibility.hiddenIncident.get(node.id) ?? 0;
    if (hidden) {
      const count = nodes.createDiv({ cls: 'los-ability-fold-count', text: `${hidden} folded`, attr: { 'aria-label': `${hidden} incident preparation connections are folded` } });
      count.setAttr('style', `left:${node.x}px;top:${node.y + PLANE.nodeHeight + 4}px`);
    }
  }
  if (host.attention.bridgesVisible) renderBridgeBands(canvas, host, plane, overview, visibility.nodes, () => camera.suppressClick());
  const outline = panel.createEl('details', { cls: 'los-ability-outline-disclosure' });
  outline.createEl('summary', { text: 'Preparation connections as text' });
  const outlineList = outline.createEl('ul', { cls: 'los-ability-edge-outline' });
  for (const edge of overview.edges) outlineList.createEl('li', { text: `${plane.rowOf.get(edge.from)?.title ?? edge.from} prepares ${plane.rowOf.get(edge.to)?.title ?? edge.to}${edge.alternative ? ' (one of several routes)' : ''}${visibility.edges.includes(edge) ? '' : ' · folded'}` });
  const percentage = controls.createSpan({ cls: 'los-ability-zoom-percentage', attr: { 'aria-live': 'polite' } });
  const camera = mountAbilityViewport({ element: viewport, world: canvas, bounds: overview,
    camera: () => host.attention.camera, changed: (value) => {
      host.attention.camera = value;
      const distant = value.scale < 0.65;
      viewport.toggleClass('is-distant', distant);
      overviewNav.hidden = !distant;
    }, percentage });
  host.ownInteraction(() => camera.dispose());
  button(controls, 'Fit all', () => camera.fit(overview), 'quiet');
  button(controls, '+', () => camera.zoom(1.2), 'quiet').setAttr('aria-label', 'Zoom in');
  button(controls, '−', () => camera.zoom(1 / 1.2), 'quiet').setAttr('aria-label', 'Zoom out');
  const groupChoice = controls.createEl('select', { cls: 'los-ability-fit-group', attr: { 'aria-label': 'Group to fit' } });
  for (const region of overview.regions) groupChoice.createEl('option', { text: region.group.title, attr: { value: region.group.key } });
  groupChoice.value = host.attention.fitGroup && overview.regions.some((region) => region.group.key === host.attention.fitGroup)
    ? host.attention.fitGroup : overview.regions[0]?.group.key ?? '';
  groupChoice.addEventListener('change', () => { host.attention.fitGroup = groupChoice.value; });
  button(controls, 'Fit group', () => {
    const region = overview.regions.find((region) => region.group.key === groupChoice.value);
    if (region) camera.fit(region);
  }, 'quiet');
  const fitSelection = button(controls, 'Fit selection', () => { if (selected) camera.fit(selectionBounds(selected)); }, 'quiet');
  fitSelection.disabled = !selected;
  const bridges = button(controls, `Bridges · ${plane.bridges.filter((row) => row.review.state === 'reviewed').length}`, () => {
    host.attention.bridgesVisible = !host.attention.bridgesVisible;
    if (!host.attention.bridgesVisible) host.bridgeKey = null;
    host.render();
  }, 'quiet');
  bridges.setAttr('aria-pressed', String(host.attention.bridgesVisible));
  function selectionBounds(id: string): PlaneBounds {
    const near = preparationNeighbours(overview.edges, id);
    return boundsOfNodes([id, ...near.prerequisites, ...near.dependents].map((key) => overview.nodes.get(key)).filter((node): node is PlaneNode => Boolean(node && visibility.nodes.has(node.id))));
  }
  if (host.attention.fitRequest) {
    const request = host.attention.fitRequest; host.attention.fitRequest = null;
    if (request === 'all') camera.fit(overview);
    if (selected && request === 'selection') camera.fit(selectionBounds(selected));
    if (selected && request === 'reveal') { const node = overview.nodes.get(selected); if (node) camera.reveal(boundsOfNodes([node])); }
    if (request === 'group') { const group = overview.regions.find((region) => region.group.key === host.attention.fitGroup); if (group) camera.fit(group); }
  }
  viewport.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !event.defaultPrevented) { host.bridgeKey = null; host.go({ ability: null, detail: false }); }
  });
  if (selected) renderSelectionDock(panel, host, plane, selected, neighbours, bridgePeers, visibility.hiddenIncident.get(selected) ?? 0, visibility.nodes);
  const foot = panel.createDiv({ cls: 'los-ability-graph-foot' });
  if (![...plane.rowOf.values()].some((row) => row.evidence.length)) foot.createEl('p', { text: 'No learner attempt recorded. Ability states stay uncertain until confirmed work exists.' });
  if (plane.crossGroupCandidates.length) foot.createEl('p', { text: `${plane.crossGroupCandidates.length} tentative connection${plane.crossGroupCandidates.length === 1 ? '' : 's'} crosses groups; tentative connections carry nothing.` });
  foot.createDiv({ cls: 'los-micro', text: `${visibility.nodes.size} visible of ${brief.abilities.length} loaded abilities · ${overview.edges.length - visibility.edges.length} folded preparation connections` });
  if (host.attention.bridgesVisible) {
    const omitted = plane.bridges.filter((row) => !visibility.nodes.has(row.from) || !visibility.nodes.has(row.to)).length;
    if (omitted) foot.createDiv({ cls: 'los-micro', text: `${omitted} bridge connections omitted by folding; bridges never retain preparation paths.` });
  }
  if (bridge) renderBridgeInspector(surface, host, plane, bridge);
  else if (selected && inspecting) {
    if (host.attention.routes) renderRoutes(surface, host, plane, selected);
    else renderInspector(surface, host, plane, brief, selected);
  }
  if (brief.truncated) root.createDiv({ cls: 'los-micro los-ability-truncated', text: `Showing ${brief.abilities.length} of ${brief.total} abilities. Search locates loaded records; Details explicitly expands one record under this snapshot. Unloaded prerequisites remain named in Routes.` });
}

function nodeLabel(node: PlaneNode, plane: AbilityPlane): string {
  const parts = [`${node.row.title}. ${STATE_LABEL[node.row.state]}. ${node.meta}.`];
  const preparation = preparationSentence(node.row, (id) => plane.rowOf.get(id)?.title ?? id);
  if (preparation) parts.push(`Complete preparation routes: ${preparation}`);
  if (node.bridgeCount) parts.push(`${node.bridgeCount} bridge connections, separately disclosed.`);
  return parts.join(' ');
}

function drawEdges(canvas: HTMLElement, overview: AbilityOverview, edges: readonly import('./model').PlaneEdge[], selected: string | null): void {
  const doc = canvas.ownerDocument;
  if (!doc || typeof doc.createElementNS !== 'function') return;
  const svg = doc.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'los-ability-edges'); svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', String(overview.width)); svg.setAttribute('height', String(overview.height));
  svg.setAttribute('viewBox', `0 0 ${overview.width} ${overview.height}`);
  for (const edge of edges) {
    const from = overview.nodes.get(edge.from); const to = overview.nodes.get(edge.to);
    if (!from || !to) continue;
    const x1 = from.x + PLANE.nodeWidth + 24; const x2 = to.x - 8;
    const y1 = from.y + PLANE.nodeHeight / 2; const y2 = to.y + PLANE.nodeHeight / 2;
    const bend = Math.max(40, (x2 - x1) * 0.55);
    const active = edge.from === selected || edge.to === selected;
    const path = doc.createElementNS(SVG, 'path');
    path.setAttribute('class', `los-ability-edge${edge.alternative ? ' is-alternative' : ''}${active ? ' is-incident' : selected ? ' is-muted' : ''}`);
    path.setAttribute('data-preparation-from', edge.from); path.setAttribute('data-preparation-to', edge.to);
    path.setAttribute('d', `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`);
    svg.append(path);
    const arrow = doc.createElementNS(SVG, 'path'); arrow.setAttribute('class', `los-ability-arrow${active ? ' is-incident' : ''}`);
    arrow.setAttribute('d', `M ${x2 - 5} ${y2 - 4} L ${x2} ${y2} L ${x2 - 5} ${y2 + 4}`); svg.append(arrow);
  }
  canvas.prepend(svg);
}

function renderBridgeBands(canvas: HTMLElement, host: AbilityHost, plane: AbilityPlane, overview: AbilityOverview, visible: ReadonlySet<string>, suppressClick: () => boolean): void {
  const layer = canvas.createDiv({ cls: 'los-ability-bridge-bands', attr: { role: 'group', 'aria-label': 'Bridge connections' } });
  enableButtonGroupKeyboardNavigation(layer, 'both');
  for (const region of overview.regions) for (const entry of region.group.bridges) {
    if (!visible.has(entry.bridge.from) || !visible.has(entry.bridge.to)) continue;
    const from = overview.nodes.get(entry.bridge.from); const to = overview.nodes.get(entry.bridge.to);
    if (!from || !to) continue;
    const x = Math.min(from.x, to.x); const right = Math.max(from.x, to.x) + PLANE.nodeWidth;
    const top = Math.max(...region.nodes.map((node) => node.y + PLANE.nodeHeight)) + PLANE.bandTop + entry.band * (PLANE.bandHeight + PLANE.bandGap);
    const reviewed = entry.bridge.review.state === 'reviewed';
    const band = layer.createEl('button', { cls: `los-ability-bridge is-clickable is-${entry.bridge.kind}${reviewed ? ' is-reviewed' : ' is-candidate'}${entry.bridge.freshness === 'current' ? '' : ' is-not-current'}${host.bridgeKey === entry.key ? ' is-selected' : ''}`,
      attr: { type: 'button', 'data-bridge': entry.key, 'data-los-tab': `bridge-${entry.key}`, 'aria-label': `${reviewed ? 'Reviewed' : 'Candidate'} ${entry.bridge.kind} bridge from ${from.row.title} to ${to.row.title}. Open conditions.` } });
    band.setAttr('style', `left:${x}px;top:${top}px;width:${right - x}px;height:${PLANE.bandHeight}px`);
    band.createSpan({ cls: 'los-ability-bridge-label', text: `${bridgeSymbol(entry.bridge.kind)} ${reviewed ? 'Reviewed' : 'Candidate'} ${entry.bridge.kind} bridge${entry.bridge.freshness === 'current' ? '' : ' · source not current'}` });
    band.addEventListener('click', () => { if (suppressClick()) return; host.bridgeKey = host.bridgeKey === entry.key ? null : entry.key; host.render(); });
  }
  void plane;
}

function renderSelectionDock(parent: HTMLElement, host: AbilityHost, plane: AbilityPlane, selected: string,
  neighbours: ReturnType<typeof preparationNeighbours>, bridgePeers: ReadonlySet<string>, hidden: number, visible: ReadonlySet<string>): void {
  const row = plane.rowOf.get(selected); if (!row) return;
  const dock = parent.createDiv({ cls: 'los-ability-selection-dock', attr: { role: 'group', 'aria-label': 'Selected ability actions' } });
  const info = dock.createDiv(); info.createEl('strong', { text: row.title });
  const outside = new Set(row.preparation_routes.flatMap((route) => [...route.supported, ...route.missing_or_uncertain]).filter((id) => !plane.rowOf.has(id)));
  const hiddenPeers = [...bridgePeers].filter((id) => !visible.has(id)).length;
  info.createDiv({ cls: 'los-micro', text: `${neighbours.prerequisites.size} loaded immediate prerequisites · ${neighbours.dependents.size} loaded immediate dependents${host.attention.bridgesVisible ? ` · ${bridgePeers.size} reviewed bridge peers${hiddenPeers ? ` (${hiddenPeers} hidden by folding)` : ''}` : ''}${hidden ? ` · ${hidden} folded incident connections` : ''}${outside.size ? ` · ${outside.size} complete route members outside loaded horizon` : ''}` });
  button(dock, 'Details', () => { host.attention.inspector = !host.attention.inspector; host.attention.routes = false; host.render(); }, 'quiet')
    .setAttr('aria-expanded', String(host.attention.inspector));
  button(dock, 'Routes', () => { host.attention.routes = !host.attention.routes; host.attention.inspector = false; host.render(); }, 'quiet')
    .setAttr('aria-expanded', String(host.attention.routes));
  button(dock, 'Clear selection', () => { host.bridgeKey = null; host.go({ ability: null, detail: false }); }, 'tertiary');
}

function renderRoutes(surface: HTMLElement, host: AbilityHost, plane: AbilityPlane, selected: string): void {
  const row = plane.rowOf.get(selected); if (!row) return;
  const panel = surface.createEl('aside', { cls: 'los-ability-inspector', attr: { 'aria-label': `Complete preparation routes: ${row.title}` } });
  panel.createEl('h2', { text: 'Complete preparation routes' }); panel.createEl('p', { text: row.title });
  panel.createEl('p', { cls: 'los-micro', text: 'All members of a route are required together. Separate routes are alternatives. Folding changes only the drawing.' });
  for (const [index, route] of row.preparation_routes.entries()) {
    const block = panel.createDiv({ cls: 'los-ability-route' }); block.createEl('h3', { text: `Route ${index + 1}${row.preparation_routes.length > 1 ? ' · alternative' : ''}` });
    const list = block.createEl('ul');
    for (const id of [...new Set([...route.supported, ...route.missing_or_uncertain])]) list.createEl('li', { text: `${plane.rowOf.get(id)?.title ?? id}${plane.rowOf.has(id) ? '' : ' · outside loaded horizon'}${route.supported.includes(id) ? ' · supported' : ' · missing or uncertain'}` });
    block.createEl('p', { text: route.reason });
    if (route.source) button(block, route.source, () => host.plugin.openAuthoredPath((route.source ?? '').split('#')[0] ?? ''), 'tertiary').addClass('los-ability-source-link');
  }
  if (!row.preparation_routes.length) panel.createEl('p', { text: 'No reviewed preparation route is recorded.' });
  button(panel, 'Close routes', () => { host.attention.routes = false; host.render(); }, 'tertiary');
  button(panel, 'Open full ability detail →', () => host.go({ detail: true }), 'tertiary').addClass('los-ability-detail-link');
}

function draftsFor(host: AbilityHost, abilityId: string): number {
  return host.plugin.listAbilityDrafts().filter((draft) => draft.kind === 'claim'
    ? draft.abilityId === abilityId
    : draft.fromAbility === abilityId || draft.toAbility === abilityId).length;
}

/** The ability inspector (Figma A2, 65:1137). */
function renderInspector(
  surface: HTMLElement,
  host: AbilityHost,
  plane: AbilityPlane,
  brief: AbilityBriefV1,
  abilityId: string,
): void {
  const row = plane.rowOf.get(abilityId);
  if (!row) return;
  const horizon = host.plugin.abilityHorizon;
  horizon.ensureExpansion(abilityId);
  const expansion = horizon.expansion(abilityId);
  const focus = expansion && 'ability' in expansion ? expansion : null;
  const labels = projectionLabels(host.plugin.store);
  const titleOf = (id: string) => plane.rowOf.get(id)?.title ?? id;

  const panel = surface.createEl('aside', {
    cls: 'los-ability-inspector',
    attr: { 'aria-label': `Selected ability: ${row.title}` },
  });
  button(panel, 'Close details', () => { host.attention.inspector = false; host.render(); }, 'tertiary');
  const modules = row.module_ids.map((id) => labels.module(id)).join(' · ');
  panel.createDiv({ cls: 'los-ability-eyebrow is-accent', text: `Selected ability${modules ? ` · ${modules}` : ''}` });
  panel.createEl('h2', { text: row.title });
  renderStatus(panel, row);

  const counts = section(panel, 'What counts');
  if (focus) {
    counts.createEl('p', { text: focus.ability.claim });
    if (focus.ability.conditions.length) {
      counts.createEl('p', {
        cls: 'los-micro',
        text: `Under: ${focus.ability.conditions.join('; ')}.`,
      });
    }
  } else {
    renderExpansionState(counts, host, abilityId);
  }

  const preparation = section(panel, 'Preparation');
  const sentenceText = preparationSentence(row, titleOf);
  preparation.createEl('p', {
    text: sentenceText ?? 'No reviewed preparation route. This is where the group starts.',
  });
  const nearest = row.preparation_routes.find((route) => route.supported.length);
  if (nearest) {
    preparation.createEl('p', {
      cls: 'los-micro',
      text: `Remaining on the closest route: ${nearest.remaining_work.map(titleOf).join(', ')}.`,
    });
  }

  const evidence = section(panel, 'Evidence');
  if (!row.evidence.length) {
    evidence.createEl('p', { text: 'No learner attempt has been recorded. Confirmed work can change this state.' });
  } else {
    evidence.createEl('p', {
      text: `${row.evidence.length} recorded ${row.evidence.length === 1 ? 'attempt' : 'attempts'} shown here; the full ledger is in the detail.`,
    });
    for (const item of row.evidence) {
      evidence.createDiv({ cls: 'los-micro', text: `${item.result} · ${item.work_ref}` });
    }
  }
  if (row.transfer.length) {
    for (const transfer of row.transfer) {
      evidence.createDiv({
        cls: 'los-micro',
        text: `Supported through a reviewed equivalence from ${titleOf(transfer.from)}.`,
      });
    }
  }
  const pending = draftsFor(host, abilityId);
  if (pending) {
    const drafts = evidence.createDiv({ cls: 'los-ability-draft-note' });
    drafts.createSpan({ text: `${pending} ${pending === 1 ? 'draft' : 'drafts'} · not recorded. ` });
    button(drafts, 'Open Review', () => host.plugin.nav.openReview(), 'tertiary');
  }
  void brief;

  const footer = panel.createDiv({ cls: 'los-ability-inspector-foot' });
  const open = button(footer, 'Open full ability detail →', () => host.go({ detail: true }), 'tertiary');
  open.addClass('los-ability-detail-link');
}

function renderStatus(parent: HTMLElement, row: AbilityRowV1): void {
  const status = parent.createDiv({ cls: `los-ability-status is-${row.state}` });
  const headline = row.evidence.length || row.state !== 'uncertain'
    ? STATE_LABEL[row.state]
    : `${STATE_LABEL[row.state]} · no attempt recorded`;
  status.createEl('strong', { text: headline });
  for (const reason of row.reasons) status.createDiv({ cls: 'los-micro', text: sentence(reason) });
}

function section(parent: HTMLElement, title: string): HTMLElement {
  const block = parent.createDiv({ cls: 'los-ability-inspector-section' });
  block.createEl('h3', { text: title });
  return block;
}

/** A bridge's own inspector: what carries, what changes, under what, and whether it is current. */
function renderBridgeInspector(
  surface: HTMLElement,
  host: AbilityHost,
  plane: AbilityPlane,
  bridge: AbilityBridgeV1,
): void {
  const titleOf = (id: string) => plane.rowOf.get(id)?.title ?? id;
  const panel = surface.createEl('aside', {
    cls: 'los-ability-inspector',
    attr: { 'aria-label': 'Selected bridge' },
  });
  const reviewed = bridge.review.state === 'reviewed';
  panel.createDiv({
    cls: 'los-ability-eyebrow is-accent',
    text: `${reviewed ? 'Reviewed' : 'Candidate'} ${bridge.kind} bridge`,
  });
  panel.createEl('h2', { text: `${titleOf(bridge.from)} ${bridgeSymbol(bridge.kind)} ${titleOf(bridge.to)}` });
  const freshness = panel.createDiv({ cls: `los-ability-status is-${bridge.freshness === 'current' ? 'nearby' : 'uncertain'}` });
  freshness.createEl('strong', {
    text: bridge.freshness === 'current'
      ? 'Source current'
      : bridge.freshness === 'stale'
        ? 'Source changed — carries nothing until re-reviewed'
        : bridge.freshness === 'not-reviewed'
          ? 'Not reviewed — carries nothing'
          : 'Source unavailable — carries nothing',
  });
  const carries = section(panel, 'Carries over');
  carries.createEl('p', { text: bridge.carries });
  const changes = section(panel, 'Still differs');
  changes.createEl('p', { text: bridge.changes });
  const conditions = section(panel, 'Only under');
  if (bridge.conditions.length) {
    const list = conditions.createEl('ul');
    for (const condition of bridge.conditions) list.createEl('li', { text: condition });
  } else {
    conditions.createEl('p', { cls: 'los-micro', text: 'No conditions stated.' });
  }
  const source = section(panel, 'Source');
  const path = bridge.source.split('#')[0] ?? bridge.source;
  button(source, bridge.source, () => host.plugin.openAuthoredPath(path), 'tertiary')
    .addClass('los-ability-source-link');
  if (bridge.review.reviewed_by || bridge.review.reviewed_on) {
    source.createDiv({
      cls: 'los-micro',
      text: `Reviewed${bridge.review.reviewed_by ? ` by ${bridge.review.reviewed_by}` : ''}${bridge.review.reviewed_on ? ` on ${bridge.review.reviewed_on}` : ''}.`,
    });
  }
  const footer = panel.createDiv({ cls: 'los-ability-inspector-foot' });
  button(footer, 'Close bridge', () => {
    const key = host.bridgeKey;
    const container = surface.parentElement;
    host.bridgeKey = null;
    host.render();
    if (container) Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .find((control) => control.getAttribute('data-bridge') === key)?.focus({ preventScroll: true });
  }, 'tertiary');
}

function renderList(
  root: HTMLElement,
  host: AbilityHost,
  plane: AbilityPlane,
  brief: AbilityBriefV1,
): void {
  const table = root.createDiv({ cls: 'los-ability-list' });
  for (const group of plane.groups) {
    const block = table.createDiv({ cls: 'los-ability-list-group' });
    block.createEl('h2', { text: group.title });
    block.createDiv({
      cls: 'los-micro',
      text: `${group.nodes.length} ${group.nodes.length === 1 ? 'ability' : 'abilities'} · ${group.reviewedBridgeCount} reviewed ${group.reviewedBridgeCount === 1 ? 'bridge' : 'bridges'}`,
    });
    const rows = block.createDiv({
      cls: 'los-ability-list-rows',
      attr: { role: 'group', 'aria-label': `${group.title} abilities` },
    });
    enableButtonGroupKeyboardNavigation(rows, 'vertical');
    for (const node of group.nodes) {
      const row = rows.createEl('button', {
        cls: 'los-ability-list-row is-clickable',
        attr: { type: 'button', 'data-ability': node.id },
      });
      row.createSpan({ cls: 'los-ability-list-title', text: node.row.title });
      row.createSpan({ cls: 'los-ability-list-meta', text: node.meta });
      row.createSpan({ cls: `los-ability-list-state is-${node.row.state}`, text: STATE_LABEL[node.row.state] });
      row.createSpan({
        cls: 'los-ability-list-meta',
        text: `${node.row.preparation_routes.length} ${node.row.preparation_routes.length === 1 ? 'route' : 'routes'} · ${node.bridgeCount} ${node.bridgeCount === 1 ? 'bridge' : 'bridges'}`,
      });
      row.addEventListener('click', () => host.go({ group: group.key, ability: node.id, detail: true }));
    }
  }
  if (brief.truncated) {
    table.createDiv({
      cls: 'los-micro',
      text: `Showing ${brief.abilities.length} of ${brief.total} abilities.`,
    });
  }
}
