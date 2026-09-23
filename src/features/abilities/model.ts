import type {
  AbilityBridgeV1,
  AbilityBriefV1,
  AbilityCandidateV1,
  AbilityRouteV1,
  AbilityRowV1,
  AbilityStateV1,
} from '../../contracts/ability-context';
import { compareStrings } from '../../sorting';

/**
 * The Ability map's read model: separate groups, and inside each group a
 * directed preparation graph laid out left to right.
 *
 * Everything here is arrangement. Which abilities exist, what prepares what,
 * which bridges are reviewed and what state each ability is in are Core's
 * answers from one `ability.context` horizon; this file only decides where to
 * draw them. It never infers a relation, never widens a route, and never turns
 * a stage, a shared concept tag or a tentative connection into evidence.
 *
 * Two readability choices are made here and stated so they are not mistaken
 * for claims:
 *
 * - An arrow is drawn only where it is not already implied by a longer
 *   preparation path (transitive reduction). The complete route membership
 *   stays in the inspector and the ability detail, word for word.
 * - Groups are the connected pieces of preparation and bridge edges. A
 *   tentative connection never joins two groups: it carries nothing, so it
 *   must not change the shape of the map either.
 */

export interface AbilityLabels {
  /** A concept's authored title, or null when the projection has none. */
  concept(id: string): string | null;
  /** A short module label for meta lines: "AML", "M2". */
  module(id: string): string;
}

export type AbilityRole = 'foundation' | 'step' | 'extension' | 'standalone';

export type ColumnAnnotation = 'both' | 'all' | 'either' | null;

export interface PlaneNode {
  readonly id: string;
  readonly row: AbilityRowV1;
  readonly column: number;
  readonly order: number;
  readonly x: number;
  readonly y: number;
  readonly role: AbilityRole;
  /** In-group prerequisites across every route, in authored order. */
  readonly prerequisites: readonly string[];
  readonly dependents: readonly string[];
  readonly modules: readonly string[];
  readonly meta: string;
  readonly bridgeCount: number;
}

/** One drawn preparation arrow, after transitive reduction. */
export interface PlaneEdge {
  readonly from: string;
  readonly to: string;
  /** `to` has several routes and `from` is not in all of them. */
  readonly alternative: boolean;
}

/**
 * A vertical trunk in the gutter before a column. Targets that share exactly
 * the same sources share one trunk, which is what makes a join readable;
 * targets with different sources never share one, so no line suggests an
 * arrow that does not exist.
 */
export interface PlaneLane {
  readonly x: number;
  readonly sources: readonly string[];
  readonly targets: readonly string[];
  readonly alternative: boolean;
}

export interface PlaneColumn {
  readonly index: number;
  readonly label: string;
  readonly annotation: ColumnAnnotation;
  readonly x: number;
  readonly nodeIds: readonly string[];
}

export interface PlaneBridge {
  readonly key: string;
  readonly bridge: AbilityBridgeV1;
  /** Band placement below the graph: first and last column it spans. */
  readonly fromColumn: number;
  readonly toColumn: number;
  readonly band: number;
}

export interface AbilityGroup {
  readonly key: string;
  readonly title: string;
  readonly nodes: readonly PlaneNode[];
  readonly edges: readonly PlaneEdge[];
  readonly lanes: readonly PlaneLane[];
  readonly columns: readonly PlaneColumn[];
  readonly bridges: readonly PlaneBridge[];
  readonly candidates: readonly AbilityCandidateV1[];
  readonly reviewedBridgeCount: number;
  readonly width: number;
  /** Height of the node area; bands sit below it. */
  readonly graphHeight: number;
  readonly height: number;
  readonly hasEvidence: boolean;
}

export interface AbilityPlane {
  readonly groups: readonly AbilityGroup[];
  readonly groupOfAbility: ReadonlyMap<string, string>;
  readonly rowOf: ReadonlyMap<string, AbilityRowV1>;
  /** Tentative connections whose two ends sit in different groups. */
  readonly crossGroupCandidates: readonly AbilityCandidateV1[];
  readonly bridges: readonly AbilityBridgeV1[];
}

export const PLANE = {
  nodeWidth: 220,
  nodeHeight: 76,
  columnGap: 76,
  rowGap: 44,
  pad: 8,
  bandHeight: 34,
  bandGap: 8,
  bandTop: 20,
} as const;

export const STATE_LABEL: Readonly<Record<AbilityStateV1, string>> = {
  supported: 'Supported',
  nearby: 'Nearby',
  uncertain: 'Uncertain',
  unmapped: 'Unmapped',
};

export const BRIDGE_KIND_LABEL: Readonly<Record<AbilityBridgeV1['kind'], string>> = {
  equivalence: 'equivalence',
  extension: 'extension',
  connection: 'connection',
};

export function bridgeSymbol(kind: AbilityBridgeV1['kind']): string {
  return kind === 'equivalence' ? '↔' : '→';
}

export function bridgeKey(bridge: { from: string; to: string; kind: string }): string {
  return `${bridge.from}--${bridge.kind}--${bridge.to}`;
}

/** Every prerequisite a route names, in the order Core partitioned them. */
export function routeMembers(route: AbilityRouteV1): string[] {
  return [...new Set([...route.supported, ...route.missing_or_uncertain])];
}

function unique(values: Iterable<string>): string[] {
  return [...new Set(values)];
}

function byTitle(rows: ReadonlyMap<string, AbilityRowV1>) {
  return (left: string, right: string): number => {
    const a = rows.get(left)?.title ?? left;
    const b = rows.get(right)?.title ?? right;
    return compareStrings(a, b) || compareStrings(left, right);
  };
}

/** Sentence-case a concept slug for the rare concept with no projected title. */
function slugTitle(id: string): string {
  const words = id.replace(/^concept-/, '').split('-').filter(Boolean).join(' ');
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : id;
}

/**
 * A group is named after the concept most of its abilities carry — ties go to
 * the concept listed earliest — because that is the subject a learner would
 * look for. The name is a label, never a claim about the group.
 */
export function groupTitle(rows: readonly AbilityRowV1[], labels: AbilityLabels): string {
  const score = new Map<string, { count: number; position: number }>();
  for (const row of rows) {
    row.concept_ids.forEach((conceptId, position) => {
      const entry = score.get(conceptId) ?? { count: 0, position: 0 };
      entry.count += 1;
      entry.position += position;
      score.set(conceptId, entry);
    });
  }
  const best = [...score.entries()].sort(([leftId, left], [rightId, right]) =>
    right.count - left.count
    || left.position - right.position
    || compareStrings(leftId, rightId))[0];
  if (!best) return rows[0]?.title ?? 'Abilities';
  return labels.concept(best[0]) ?? slugTitle(best[0]);
}

function components(ids: readonly string[], links: ReadonlyArray<readonly [string, string]>): string[][] {
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root) ?? root;
    let walk = id;
    while (parent.get(walk) !== root) {
      const next = parent.get(walk) ?? root;
      parent.set(walk, root);
      walk = next;
    }
    return root;
  };
  for (const [left, right] of links) {
    if (!parent.has(left) || !parent.has(right)) continue;
    const a = find(left);
    const b = find(right);
    if (a !== b) parent.set(a < b ? b : a, a < b ? a : b);
  }
  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const root = find(id);
    const members = groups.get(root);
    if (members) members.push(id);
    else groups.set(root, [id]);
  }
  return [...groups.values()].map((members) => members.sort());
}

/** Longest preparation path from a foundation; cycle-guarded (Core forbids them). */
function columnsOf(ids: readonly string[], prerequisites: ReadonlyMap<string, readonly string[]>): Map<string, number> {
  const memo = new Map<string, number>();
  const visiting = new Set<string>();
  const depth = (id: string): number => {
    const known = memo.get(id);
    if (known !== undefined) return known;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const sources = prerequisites.get(id) ?? [];
    const value = sources.length ? 1 + Math.max(...sources.map(depth)) : 0;
    visiting.delete(id);
    memo.set(id, value);
    return value;
  };
  for (const id of ids) depth(id);
  return memo;
}

function ancestorsOf(ids: readonly string[], prerequisites: ReadonlyMap<string, readonly string[]>): Map<string, Set<string>> {
  const memo = new Map<string, Set<string>>();
  const visiting = new Set<string>();
  const walk = (id: string): Set<string> => {
    const known = memo.get(id);
    if (known) return known;
    if (visiting.has(id)) return new Set();
    visiting.add(id);
    const found = new Set<string>();
    for (const source of prerequisites.get(id) ?? []) {
      found.add(source);
      for (const deeper of walk(source)) found.add(deeper);
    }
    visiting.delete(id);
    memo.set(id, found);
    return found;
  };
  for (const id of ids) walk(id);
  return memo;
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

/**
 * Stack one column's nodes as close to their wanted heights as they can sit
 * without overlapping. Neighbours that collide are placed as one block
 * centred on what its members wanted, which is what keeps a join level with
 * the pair it joins.
 */
function stack(wanted: ReadonlyArray<{ id: string; y: number }>, step: number): Map<string, number> {
  let blocks = wanted.map((entry) => ({ ids: [entry.id], want: [entry.y], top: entry.y }));
  let merged = true;
  while (merged) {
    merged = false;
    for (let index = 0; index < blocks.length - 1; index += 1) {
      const upper = blocks[index];
      const lower = blocks[index + 1];
      if (!upper || !lower) continue;
      if (upper.top + upper.ids.length * step > lower.top + 0.5) {
        const ids = [...upper.ids, ...lower.ids];
        const want = [...upper.want, ...lower.want];
        const top = mean(want.map((value, position) => value - position * step));
        blocks.splice(index, 2, { ids, want, top });
        merged = true;
        break;
      }
    }
  }
  const placed = new Map<string, number>();
  for (const block of blocks) {
    block.ids.forEach((id, position) => placed.set(id, block.top + position * step));
  }
  return placed;
}

function annotate(
  columnIds: readonly string[],
  edges: readonly PlaneEdge[],
): ColumnAnnotation {
  const outgoing = edges.filter((edge) => columnIds.includes(edge.from));
  if (!outgoing.length) return null;
  if (outgoing.every((edge) => edge.alternative)) return 'either';
  if (outgoing.some((edge) => edge.alternative)) return null;
  const perTarget = new Map<string, number>();
  for (const edge of outgoing) perTarget.set(edge.to, (perTarget.get(edge.to) ?? 0) + 1);
  const joins = [...perTarget.values()];
  if (joins.every((value) => value === 2)) return 'both';
  if (joins.every((value) => value >= 2)) return 'all';
  return null;
}

export function annotationLabel(annotation: ColumnAnnotation): string {
  if (annotation === 'both') return 'both';
  if (annotation === 'all') return 'all needed';
  if (annotation === 'either') return 'either route';
  return '';
}

function columnLabel(index: number, count: number): string {
  if (count <= 1) return 'Abilities';
  if (index === 0) return 'Foundations';
  if (index === count - 1) return 'Extension';
  return `Step ${index + 1}`;
}

function nodeMeta(role: AbilityRole, modules: readonly string[]): string {
  const courses = modules.join(' · ');
  if (role === 'foundation') {
    return modules.length > 1 ? `Shared foundation · ${courses}` : `Foundation${courses ? ` · ${courses}` : ''}`;
  }
  if (role === 'extension') {
    return modules.length === 1 ? `${courses} extension` : `Extension${courses ? ` · ${courses}` : ''}`;
  }
  return courses || 'No module named';
}

function buildGroup(
  memberIds: readonly string[],
  rows: ReadonlyMap<string, AbilityRowV1>,
  bridges: readonly AbilityBridgeV1[],
  candidates: readonly AbilityCandidateV1[],
  labels: AbilityLabels,
): AbilityGroup {
  const members = new Set(memberIds);
  const prerequisites = new Map<string, string[]>();
  const routes = new Map<string, string[][]>();
  for (const id of memberIds) {
    const row = rows.get(id);
    const routeSets = (row?.preparation_routes ?? [])
      .map((route) => routeMembers(route).filter((member) => members.has(member)));
    routes.set(id, routeSets);
    prerequisites.set(id, unique(routeSets.flat()));
  }
  const dependents = new Map<string, string[]>(memberIds.map((id) => [id, []]));
  for (const [id, sources] of prerequisites) {
    for (const source of sources) dependents.get(source)?.push(id);
  }

  const column = columnsOf(memberIds, prerequisites);
  const ancestors = ancestorsOf(memberIds, prerequisites);

  const edges: PlaneEdge[] = [];
  for (const id of memberIds) {
    const sources = prerequisites.get(id) ?? [];
    const routeSets = routes.get(id) ?? [];
    for (const source of sources) {
      const implied = sources.some((other) => other !== source
        && (ancestors.get(other)?.has(source) ?? false));
      if (implied) continue;
      const alternative = routeSets.length > 1
        && routeSets.some((set) => !set.includes(source));
      edges.push({ from: source, to: id, alternative });
    }
  }

  const columnCount = memberIds.length
    ? Math.max(...memberIds.map((id) => column.get(id) ?? 0)) + 1
    : 0;
  const titleOrder = byTitle(rows);
  const byColumn: string[][] = Array.from({ length: columnCount }, () => []);
  for (const id of memberIds) byColumn[column.get(id) ?? 0]?.push(id);

  // Barycentre ordering: sources first, then one sweep back from dependents.
  const order = new Map<string, number>();
  const assign = (ids: string[]) => ids.forEach((id, index) => order.set(id, index));
  const sourcesOf = (id: string) => edges.filter((edge) => edge.to === id).map((edge) => edge.from);
  const targetsOf = (id: string) => edges.filter((edge) => edge.from === id).map((edge) => edge.to);
  byColumn[0]?.sort(titleOrder);
  if (byColumn[0]) assign(byColumn[0]);
  for (let index = 1; index < columnCount; index += 1) {
    const ids = byColumn[index] ?? [];
    const centre = (id: string) => mean(sourcesOf(id).map((source) => order.get(source) ?? 0));
    ids.sort((left, right) => centre(left) - centre(right) || titleOrder(left, right));
    assign(ids);
  }
  for (let index = columnCount - 2; index >= 0; index -= 1) {
    const ids = byColumn[index] ?? [];
    const centre = (id: string) => {
      const targets = targetsOf(id);
      return targets.length
        ? mean(targets.map((target) => order.get(target) ?? 0))
        : order.get(id) ?? 0;
    };
    ids.sort((left, right) => centre(left) - centre(right)
      || (order.get(left) ?? 0) - (order.get(right) ?? 0));
    assign(ids);
  }

  const step = PLANE.nodeHeight + PLANE.rowGap;
  const y = new Map<string, number>();
  for (let index = 0; index < columnCount; index += 1) {
    const ids = byColumn[index] ?? [];
    const wanted = ids.map((id, position) => {
      const sources = sourcesOf(id).filter((source) => y.has(source));
      return {
        id,
        y: sources.length && index > 0
          ? mean(sources.map((source) => y.get(source) ?? 0))
          : position * step,
      };
    });
    const placed = stack(wanted, step);
    for (const [id, value] of placed) y.set(id, value);
  }
  const top = Math.min(0, ...[...y.values()]);
  const columnX = (index: number) => PLANE.pad + index * (PLANE.nodeWidth + PLANE.columnGap);

  const moduleLabels = (row: AbilityRowV1 | undefined) =>
    unique((row?.module_ids ?? []).map((id) => labels.module(id)));
  const bridgeCountOf = (id: string) => bridges.filter((bridge) =>
    bridge.from === id || bridge.to === id).length;

  const nodes: PlaneNode[] = [];
  for (let index = 0; index < columnCount; index += 1) {
    for (const id of byColumn[index] ?? []) {
      const row = rows.get(id);
      if (!row) continue;
      const hasSources = (prerequisites.get(id) ?? []).length > 0;
      const hasTargets = (dependents.get(id) ?? []).length > 0;
      const role: AbilityRole = hasSources
        ? (hasTargets ? 'step' : 'extension')
        : (hasTargets ? 'foundation' : 'standalone');
      const modules = moduleLabels(row);
      nodes.push({
        id,
        row,
        column: index,
        order: order.get(id) ?? 0,
        x: columnX(index),
        y: PLANE.pad + (y.get(id) ?? 0) - top,
        role,
        prerequisites: prerequisites.get(id) ?? [],
        dependents: dependents.get(id) ?? [],
        modules,
        meta: nodeMeta(role, modules),
        bridgeCount: bridgeCountOf(id),
      });
    }
  }
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  // Lanes: one trunk per distinct source set entering a column.
  const lanes: PlaneLane[] = [];
  for (let index = 1; index < columnCount; index += 1) {
    const targets = (byColumn[index] ?? []).filter((id) => sourcesOf(id).length);
    const bySources = new Map<string, { sources: string[]; targets: string[]; alternative: boolean }>();
    for (const target of targets) {
      const incoming = edges.filter((edge) => edge.to === target);
      const sources = incoming.map((edge) => edge.from).sort();
      const alternative = incoming.every((edge) => edge.alternative);
      const key = `${sources.join('|')}#${alternative}`;
      const lane = bySources.get(key);
      if (lane) lane.targets.push(target);
      else bySources.set(key, { sources, targets: [target], alternative });
    }
    const gutterStart = columnX(index - 1) + PLANE.nodeWidth;
    const gutter = PLANE.columnGap;
    const entries = [...bySources.values()];
    entries.forEach((lane, position) => {
      lanes.push({
        x: Math.round(gutterStart + ((position + 1) * gutter) / (entries.length + 1)),
        sources: lane.sources,
        targets: lane.targets,
        alternative: lane.alternative,
      });
    });
  }

  const columns: PlaneColumn[] = Array.from({ length: columnCount }, (_unused, index) => ({
    index,
    label: columnLabel(index, columnCount),
    annotation: columnCount > 1 ? annotate(byColumn[index] ?? [], edges) : null,
    x: columnX(index),
    nodeIds: byColumn[index] ?? [],
  }));

  // Bridges sit in bands below the graph, spanning the columns they join.
  const groupBridges = bridges
    .filter((bridge) => members.has(bridge.from) && members.has(bridge.to))
    .map((bridge) => {
      const a = nodeById.get(bridge.from)?.column ?? 0;
      const b = nodeById.get(bridge.to)?.column ?? 0;
      return { bridge, fromColumn: Math.min(a, b), toColumn: Math.max(a, b) };
    })
    .sort((left, right) => left.fromColumn - right.fromColumn
      || left.toColumn - right.toColumn
      || compareStrings(bridgeKey(left.bridge), bridgeKey(right.bridge)));
  const bandEnds: number[] = [];
  const placedBridges: PlaneBridge[] = groupBridges.map((entry) => {
    let band = bandEnds.findIndex((end) => end < entry.fromColumn);
    if (band < 0) {
      band = bandEnds.length;
      bandEnds.push(entry.toColumn);
    } else {
      bandEnds[band] = entry.toColumn;
    }
    return { key: bridgeKey(entry.bridge), ...entry, band };
  });

  const graphHeight = nodes.length
    ? Math.max(...nodes.map((node) => node.y + PLANE.nodeHeight)) + PLANE.pad
    : PLANE.nodeHeight + 2 * PLANE.pad;
  const bandsHeight = bandEnds.length
    ? PLANE.bandTop + bandEnds.length * (PLANE.bandHeight + PLANE.bandGap)
    : 0;
  const width = columnCount
    ? PLANE.pad * 2 + columnCount * PLANE.nodeWidth + (columnCount - 1) * PLANE.columnGap
    : PLANE.nodeWidth + 2 * PLANE.pad;

  const groupRows = memberIds.map((id) => rows.get(id)).filter((row): row is AbilityRowV1 => Boolean(row));
  return {
    key: [...memberIds].sort()[0] ?? 'group',
    title: groupTitle(groupRows, labels),
    nodes,
    edges,
    lanes,
    columns,
    bridges: placedBridges,
    candidates: candidates.filter((row) => members.has(row.from) && members.has(row.to)),
    reviewedBridgeCount: placedBridges.filter((entry) => entry.bridge.review.state === 'reviewed').length,
    width,
    graphHeight,
    height: graphHeight + bandsHeight,
    hasEvidence: groupRows.some((row) => row.evidence.length > 0),
  };
}

/** The whole map from one horizon. Deterministic for the same input. */
export function buildAbilityPlane(brief: AbilityBriefV1, labels: AbilityLabels): AbilityPlane {
  const rows = new Map(brief.abilities.map((row) => [row.id, row]));
  const ids = [...rows.keys()].sort();
  const links: Array<readonly [string, string]> = [];
  for (const row of brief.abilities) {
    for (const route of row.preparation_routes) {
      for (const member of routeMembers(route)) links.push([member, row.id]);
    }
  }
  for (const bridge of brief.bridges) links.push([bridge.from, bridge.to]);
  const groups = components(ids, links)
    .map((members) => buildGroup(members, rows, brief.bridges, brief.candidate_connections, labels))
    .sort((left, right) => right.nodes.length - left.nodes.length
      || compareStrings(left.title, right.title)
      || compareStrings(left.key, right.key));
  const groupOfAbility = new Map<string, string>();
  for (const group of groups) {
    for (const node of group.nodes) groupOfAbility.set(node.id, group.key);
  }
  return {
    groups,
    groupOfAbility,
    rowOf: rows,
    crossGroupCandidates: brief.candidate_connections.filter((row) =>
      groupOfAbility.get(row.from) !== groupOfAbility.get(row.to)),
    bridges: brief.bridges,
  };
}

/** Plain-language list: "A", "A and B", "A, B and C". */
export function joinAnd(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * One sentence for what prepares an ability, taken straight from its routes:
 * what every route shares, then the alternatives. "A and B, then C or D."
 */
export function preparationSentence(
  row: AbilityRowV1,
  titleOf: (id: string) => string,
): string | null {
  const sets = row.preparation_routes.map(routeMembers).filter((set) => set.length);
  const first = sets[0];
  if (!first) return null;
  const common = first.filter((id) => sets.every((set) => set.includes(id)));
  const rest = sets
    .map((set) => set.filter((id) => !common.includes(id)))
    .filter((set) => set.length);
  const phrase = (ids: readonly string[]) => joinAnd(ids.map(titleOf));
  if (!rest.length) return `${phrase(common)}.`;
  const alternatives = rest.map(phrase).join(' or ');
  return common.length ? `${phrase(common)}, then ${alternatives}.` : `${alternatives}.`;
}

/** Abilities whose title, courses or concepts contain every word of the query. */
export function searchAbilities(
  plane: AbilityPlane,
  query: string,
  labels: AbilityLabels,
): string[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hits: string[] = [];
  for (const group of plane.groups) {
    for (const node of group.nodes) {
      const haystack = [
        node.row.title,
        group.title,
        ...node.modules,
        ...node.row.concept_ids.map((id) => labels.concept(id) ?? id),
      ].join(' ').toLowerCase();
      if (words.every((word) => haystack.includes(word))) hits.push(node.id);
    }
  }
  return hits;
}

/** A reason from Core, sentence-cased for display and otherwise untouched. */
export function sentence(reason: string): string {
  const trimmed = reason.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : trimmed;
}

/** The short module label used on the map: a trailing "(AML)", a code, or initials. */
export function shortModuleLabel(title: string | null, code: string | null, fallback: string): string {
  const bracket = title?.match(/\(([A-Za-z][A-Za-z0-9&]{1,7})\)\s*$/)?.[1];
  if (bracket && bracket === bracket.toUpperCase()) return bracket;
  if (code) return code;
  if (bracket) return bracket;
  const words = (title ?? '').split(/\s+/).filter((word) => /^[A-Za-z]/.test(word));
  if (words.length > 2) return words.map((word) => word.charAt(0)).join('').toUpperCase();
  return title || fallback;
}
