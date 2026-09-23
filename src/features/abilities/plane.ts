import { button, empty, filterTabs } from '../../components';
import { enableButtonGroupKeyboardNavigation } from '../../accessibility/button-group';
import type {
  AbilityBridgeV1,
  AbilityBriefV1,
  AbilityRowV1,
} from '../../contracts/ability-context';
import type { AbilityLayoutV1 } from '../../contracts/route-v1';
import {
  annotationLabel,
  bridgeKey,
  bridgeSymbol,
  buildAbilityPlane,
  PLANE,
  preparationSentence,
  searchAbilities,
  sentence,
  STATE_LABEL,
  type AbilityGroup,
  type AbilityPlane,
  type PlaneNode,
} from './model';
import { clockTime, projectionLabels, recordsDate } from './labels';
import { renderAbilityDetail } from './detail';
import { renderExpansionState } from './expansion';
import type { AbilityHost } from './ports';

const SVG = 'http://www.w3.org/2000/svg';
/** Room above the nodes for the column headings. */
const HEAD = 30;

const LAYOUTS: ReadonlyArray<readonly [AbilityLayoutV1, string]> = [
  ['plane', 'Plane'],
  ['list', 'List'],
];

/**
 * The Ability map (Figma A1 / A2).
 *
 * One ability group at a time, preparation drawn left to right, reviewed
 * bridges in their own bands so they cannot be read as preparation. Selecting
 * an ability opens its inspector; the inspector opens the full detail. Nothing
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
  const selected = host.state.ability && plane?.rowOf.has(host.state.ability)
    ? host.state.ability
    : null;

  renderTopBar(root, host, plane, selected);

  if (brief && plane && selected && host.state.detail) {
    renderAbilityDetail(root, host, brief, plane, selected);
    return;
  }

  const title = root.createDiv({ cls: 'los-ability-title' });
  title.createEl('h1', { text: 'Ability map' });
  title.createEl('p', {
    text: selected
      ? 'Select an ability to see its conditions, routes and evidence.'
      : 'Explore one ability group at a time. Preparation routes are directed; reviewed bridges stay distinct.',
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

  if (host.query.trim()) renderSearchResults(root, host, plane, labels);

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
    cls: 'los-sr-only',
    text: 'Find an ability',
    attr: { for: 'los-ability-search' },
  });
  label.setAttribute('for', 'los-ability-search');
  const search = right.createEl('input', {
    cls: 'los-ability-search',
    attr: {
      id: 'los-ability-search',
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
    const replacement = (root.ownerDocument ?? globalThis.document)
      ?.getElementById?.('los-ability-search') as HTMLInputElement | null;
    if (replacement && typeof replacement.focus === 'function') {
      replacement.focus();
      const end = replacement.value.length;
      try { replacement.setSelectionRange?.(end, end); } catch { /* no selection support */ }
    }
  });
  button(right, 'Concept atlas', () => host.plugin.nav.openAtlas(), 'tertiary')
    .addClass('los-ability-concept-link');
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
  for (const id of hits.slice(0, 12)) {
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
      host.go({ group: plane.groupOfAbility.get(id) ?? null, ability: id, detail: false });
    });
  }
}

function pickGroup(host: AbilityHost, plane: AbilityPlane, selected: string | null): AbilityGroup | null {
  const fromAbility = selected ? plane.groupOfAbility.get(selected) : null;
  const key = fromAbility ?? host.state.group;
  return plane.groups.find((group) => group.key === key) ?? plane.groups[0] ?? null;
}

function renderPlane(
  root: HTMLElement,
  host: AbilityHost,
  plane: AbilityPlane,
  brief: AbilityBriefV1,
  selected: string | null,
): void {
  const group = pickGroup(host, plane, selected);
  const bridge = host.bridgeKey
    ? plane.bridges.find((row) => bridgeKey(row) === host.bridgeKey) ?? null
    : null;
  const inspecting = Boolean(selected || bridge);
  const surface = root.createDiv({ cls: `los-ability-plane${inspecting ? ' has-inspector' : ''}` });
  if (!inspecting) renderGroups(surface, host, plane, group);
  if (group) renderGraph(surface, host, plane, group, selected, inspecting);
  if (bridge) renderBridgeInspector(surface, host, plane, bridge);
  else if (selected) renderInspector(surface, host, plane, brief, selected);
  if (brief.truncated) {
    root.createDiv({
      cls: 'los-micro los-ability-truncated',
      text: `Showing ${brief.abilities.length} of ${brief.total} abilities — Core bounds one read. Search or open an ability to expand the rest.`,
    });
  }
}

function renderGroups(
  surface: HTMLElement,
  host: AbilityHost,
  plane: AbilityPlane,
  current: AbilityGroup | null,
): void {
  const rail = surface.createDiv({ cls: 'los-ability-groups' });
  rail.createEl('h2', { cls: 'los-ability-eyebrow', text: 'Ability groups' });
  const list = rail.createDiv({
    cls: 'los-ability-group-list',
    attr: { role: 'group', 'aria-label': 'Ability groups' },
  });
  enableButtonGroupKeyboardNavigation(list, 'vertical');
  for (const group of plane.groups) {
    const active = group.key === current?.key;
    const card = list.createEl('button', {
      cls: `los-ability-group is-clickable${active ? ' is-selected' : ''}`,
      attr: { type: 'button', 'aria-pressed': String(active), 'data-ability-group': group.key },
    });
    card.createSpan({ cls: 'los-ability-group-title', text: group.title });
    const bridges = group.reviewedBridgeCount;
    card.createSpan({
      cls: 'los-ability-group-meta',
      text: `${group.nodes.length} ${group.nodes.length === 1 ? 'ability' : 'abilities'}`
        + ` · ${bridges} reviewed ${bridges === 1 ? 'bridge' : 'bridges'}`,
    });
    card.addEventListener('click', () => {
      host.bridgeKey = null;
      host.go({ group: group.key, ability: null, detail: false });
    });
  }
  rail.createEl('p', {
    cls: 'los-ability-group-note',
    text: plane.groups.length > 1
      ? 'Groups are separate; no path joins them.'
      : 'Every mapped ability belongs to this one group.',
  });
  if (plane.crossGroupCandidates.length) {
    rail.createEl('p', {
      cls: 'los-ability-group-note',
      text: `${plane.crossGroupCandidates.length} tentative ${plane.crossGroupCandidates.length === 1 ? 'connection crosses' : 'connections cross'} groups. Tentative connections carry nothing and never join groups.`,
    });
  }
}

function nodeLabel(node: PlaneNode, plane: AbilityPlane): string {
  const titleOf = (id: string) => plane.rowOf.get(id)?.title ?? id;
  const parts = [`${node.row.title}. ${STATE_LABEL[node.row.state]}. ${node.meta}.`];
  const preparation = preparationSentence(node.row, titleOf);
  if (preparation) parts.push(`Prepared by: ${preparation}`);
  if (node.bridgeCount) parts.push(`${node.bridgeCount} reviewed or candidate ${node.bridgeCount === 1 ? 'bridge' : 'bridges'}.`);
  return parts.join(' ');
}

function renderGraph(
  surface: HTMLElement,
  host: AbilityHost,
  plane: AbilityPlane,
  group: AbilityGroup,
  selected: string | null,
  inspecting: boolean,
): void {
  const panel = surface.createDiv({ cls: 'los-ability-graph' });
  const head = panel.createDiv({ cls: 'los-ability-graph-head' });
  const titleRow = head.createDiv({ cls: 'los-ability-graph-title' });
  titleRow.createEl('h2', { text: group.title });
  if (inspecting) {
    button(titleRow, 'All groups', () => {
      host.bridgeKey = null;
      host.go({ ability: null, detail: false });
    }, 'tertiary').addClass('los-ability-back');
  }
  head.createEl('p', {
    text: inspecting
      ? 'Select any ability. Preparation moves left to right.'
      : 'Preparation flows left to right. Select an ability to inspect its evidence.',
  });

  const scroll = panel.createDiv({ cls: 'los-ability-canvas-scroll' });
  const canvas = scroll.createDiv({ cls: 'los-ability-canvas' });
  const height = HEAD + group.height;
  canvas.setAttr('style', `width:${group.width}px;height:${height}px`);

  for (const column of group.columns) {
    const heading = canvas.createDiv({ cls: 'los-ability-column-head' });
    heading.setAttr('style', `left:${column.x}px;width:${PLANE.nodeWidth}px`);
    const annotation = annotationLabel(column.annotation);
    heading.setText(annotation ? `${column.label} · ${annotation}` : column.label);
  }

  drawEdges(canvas, group, height);

  const nodes = canvas.createDiv({
    cls: 'los-ability-nodes',
    attr: { role: 'group', 'aria-label': `${group.title}: abilities in preparation order` },
  });
  enableButtonGroupKeyboardNavigation(nodes, 'both');
  const highlighted = new Set<string>();
  const bridge = host.bridgeKey
    ? group.bridges.find((row) => row.key === host.bridgeKey)?.bridge ?? null
    : null;
  if (bridge) { highlighted.add(bridge.from); highlighted.add(bridge.to); }
  for (const node of group.nodes) {
    const active = node.id === selected;
    const card = nodes.createEl('button', {
      cls: `los-ability-node is-clickable los-ability-state-${node.row.state}`
        + `${active ? ' is-selected' : ''}${highlighted.has(node.id) ? ' is-bridged' : ''}`,
      attr: {
        type: 'button',
        'data-ability': node.id,
        'aria-pressed': String(active),
        'aria-label': nodeLabel(node, plane),
      },
    });
    card.setAttr('style', `left:${node.x}px;top:${HEAD + node.y}px;width:${PLANE.nodeWidth}px;height:${PLANE.nodeHeight}px`);
    card.createSpan({ cls: 'los-ability-node-title', text: node.row.title });
    const meta = card.createSpan({ cls: 'los-ability-node-meta' });
    meta.createSpan({ text: active ? `Selected · ${node.meta}` : node.meta });
    // The default — uncertain, nothing recorded — is said once in the footer;
    // any other state is named on the node itself, in words.
    if (node.row.state !== 'uncertain' || node.row.evidence.length) {
      meta.createSpan({ cls: `los-ability-node-state is-${node.row.state}`, text: STATE_LABEL[node.row.state] });
    }
    if (node.bridgeCount) {
      card.createSpan({
        cls: 'los-ability-node-bridges',
        text: `↔ ${node.bridgeCount}`,
        attr: { 'aria-hidden': 'true' },
      });
    }
    card.addEventListener('click', () => {
      host.bridgeKey = null;
      host.go({ group: group.key, ability: node.id, detail: false });
    });
  }

  // Bridges in bands below the graph: never drawn as preparation.
  for (const entry of group.bridges) {
    const from = group.columns[entry.fromColumn]?.x ?? PLANE.pad;
    const toColumn = group.columns[entry.toColumn];
    const right = (toColumn?.x ?? from) + PLANE.nodeWidth;
    const top = HEAD + group.graphHeight + PLANE.bandTop + entry.band * (PLANE.bandHeight + PLANE.bandGap);
    const reviewed = entry.bridge.review.state === 'reviewed';
    const band = canvas.createEl('button', {
      cls: `los-ability-bridge is-clickable is-${entry.bridge.kind}${reviewed ? ' is-reviewed' : ' is-candidate'}`
        + `${entry.bridge.freshness === 'current' ? '' : ' is-not-current'}`
        + `${host.bridgeKey === entry.key ? ' is-selected' : ''}`,
      attr: { type: 'button', 'data-bridge': entry.key },
    });
    band.setAttr('style', `left:${from}px;top:${top}px;width:${right - from}px;height:${PLANE.bandHeight}px`);
    const fromTitle = plane.rowOf.get(entry.bridge.from)?.title ?? entry.bridge.from;
    const toTitle = plane.rowOf.get(entry.bridge.to)?.title ?? entry.bridge.to;
    const status = reviewed
      ? (entry.bridge.freshness === 'current' ? 'Reviewed' : 'Reviewed · source changed')
      : 'Candidate';
    band.createSpan({
      cls: 'los-ability-bridge-label',
      text: `${bridgeSymbol(entry.bridge.kind)}  ${status} ${entry.bridge.kind} bridge`,
    });
    band.setAttr('aria-label',
      `${status} ${entry.bridge.kind} bridge from ${fromTitle} to ${toTitle}. Open its conditions.`);
    band.addEventListener('click', () => {
      host.bridgeKey = host.bridgeKey === entry.key ? null : entry.key;
      host.render();
    });
  }

  // The same edges as text, for screen readers and for anyone checking the drawing.
  const outline = panel.createEl('ul', { cls: 'los-sr-only los-ability-edge-outline' });
  for (const edge of group.edges) {
    outline.createEl('li', {
      text: `${plane.rowOf.get(edge.from)?.title ?? edge.from} prepares ${plane.rowOf.get(edge.to)?.title ?? edge.to}${edge.alternative ? ' (one of several routes)' : ''}`,
    });
  }

  const foot = panel.createDiv({ cls: 'los-ability-graph-foot' });
  if (!group.hasEvidence) {
    foot.createEl('p', { text: 'No learner attempt recorded. Ability states stay uncertain until confirmed work exists.' });
  }
  if (group.bridges.length) {
    foot.createEl('p', { text: 'A bridge carries evidence only within its reviewed conditions and while its source is current.' });
  }
  if (group.candidates.length) {
    foot.createEl('p', {
      text: `${group.candidates.length} tentative ${group.candidates.length === 1 ? 'connection is' : 'connections are'} recorded here. They carry nothing until reviewed into a bridge.`,
    });
  }
  if (inspecting && !selected) {
    foot.createEl('p', { text: 'Choose another group from the Atlas map.' });
  }
}

/** Preparation drawn from model coordinates; purely decorative for assistive tech. */
function drawEdges(canvas: HTMLElement, group: AbilityGroup, height: number): void {
  const doc = (canvas as HTMLElement & { ownerDocument?: Document }).ownerDocument;
  if (!doc || typeof doc.createElementNS !== 'function') return;
  const svg = doc.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'los-ability-edges');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', String(group.width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${group.width} ${height}`);
  const nodes = new Map(group.nodes.map((node) => [node.id, node]));
  const centre = (node: PlaneNode) => HEAD + node.y + PLANE.nodeHeight / 2;
  const line = (d: string, cls: string) => {
    const path = doc.createElementNS(SVG, 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', cls);
    svg.append(path);
  };
  for (const lane of group.lanes) {
    const sources = lane.sources.map((id) => nodes.get(id)).filter((node): node is PlaneNode => Boolean(node));
    const targets = lane.targets.map((id) => nodes.get(id)).filter((node): node is PlaneNode => Boolean(node));
    if (!sources.length || !targets.length) continue;
    const ys = [...sources.map(centre), ...targets.map(centre)];
    const kind = lane.alternative ? ' is-alternative' : '';
    for (const source of sources) {
      line(`M ${source.x + PLANE.nodeWidth} ${centre(source)} H ${lane.x}`, `los-ability-edge${kind}`);
    }
    line(`M ${lane.x} ${Math.min(...ys)} V ${Math.max(...ys)}`, `los-ability-edge${kind}`);
    for (const target of targets) {
      const y = centre(target);
      line(`M ${lane.x} ${y} H ${target.x - 7}`, `los-ability-edge${kind}`);
      line(`M ${target.x - 8} ${y - 5} L ${target.x - 1} ${y} L ${target.x - 8} ${y + 5}`, 'los-ability-arrow');
      const dot = doc.createElementNS(SVG, 'circle');
      dot.setAttribute('cx', String(lane.x));
      dot.setAttribute('cy', String(y));
      dot.setAttribute('r', '4.5');
      dot.setAttribute('class', `los-ability-join${kind}`);
      svg.append(dot);
    }
  }
  canvas.prepend(svg);
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
  button(footer, 'Close bridge', () => { host.bridgeKey = null; host.render(); }, 'tertiary');
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
