/**
 * Headless Atlas map layout and region models over the published graph and notes.
 */
import type { ProjectionRecord } from '../../contracts/manifest';
import { asStrings } from '../../projection/readers';
import { compareStrings } from '../../sorting';
import { domainLabel, domainRank, noteDomain, type DomainCatalog } from './domain-model';
import type { AtlasEdge, AtlasGraph } from './graph';

export const UNGROUPED = 'ungrouped';

export interface Region {
  readonly id: string;
  readonly title: string;
  readonly concepts: readonly string[];
  /** How many of them carry at least one authored relation. */
  readonly linked: number;
}

export interface RegionLink {
  readonly a: string;
  readonly b: string;
  readonly count: number;
}

export interface ConceptMap {
  readonly regions: readonly Region[];
  readonly regionOf: ReadonlyMap<string, string>;
  /** Browsing membership: every published domain a concept's notes live in. */
  readonly memberships: ReadonlyMap<string, ReadonlySet<string>>;
  readonly links: readonly RegionLink[];
}

const regionTitle = (catalog: DomainCatalog, id: string) => id === UNGROUPED ? 'Not yet grouped'
  : domainLabel(catalog, id);

export function buildConceptMap(catalog: DomainCatalog, notes: readonly ProjectionRecord[], graph: AtlasGraph): ConceptMap {
  const tally = new Map<string, Map<string, number>>();
  for (const note of notes) {
    const bucket = noteDomain(note);
    for (const id of asStrings(note.concepts)) {
      if (!graph.conceptById.get(id)?.record) continue;
      const counts = tally.get(id) ?? new Map<string, number>();
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
      tally.set(id, counts);
    }
  }
  const rank = domainRank(catalog);
  const regionOf = new Map<string, string>();
  for (const concept of graph.concepts) {
    if (!concept.record) continue;
    const counts = tally.get(concept.id);
    const best = counts && [...counts.entries()]
      .sort(([a, x], [b, y]) => y - x || rank(a) - rank(b) || compareStrings(a, b))[0]?.[0];
    regionOf.set(concept.id, best ?? UNGROUPED);
  }
  const touched = new Set(graph.edges.flatMap((edge) => [edge.from, edge.to]));
  const members = new Map<string, string[]>();
  for (const row of catalog) members.set(row.id, []);
  for (const [concept, region] of regionOf) {
    if (!members.has(region)) members.set(region, []);
    members.get(region)!.push(concept);
  }
  const labelOf = (id: string) => graph.conceptById.get(id)?.label ?? id;
  const regions = [...members.entries()].map(([id, concepts]) => ({
    id,
    title: regionTitle(catalog, id),
    concepts: [...concepts].sort((a, b) => compareStrings(labelOf(a), labelOf(b))),
    linked: concepts.filter((concept) => touched.has(concept)).length,
  }));
  const pairs = new Map<string, RegionLink>();
  for (const edge of graph.edges) {
    if (edge.layer === 'unrecognized') continue;
    const from = regionOf.get(edge.from), to = regionOf.get(edge.to);
    if (!from || !to || from === to) continue;
    const [a, b] = [from, to].sort(compareStrings) as [string, string];
    const key = `${a}\u0000${b}`;
    pairs.set(key, { a, b, count: (pairs.get(key)?.count ?? 0) + 1 });
  }
  return { regions, regionOf, memberships: new Map([...tally].map(([id, counts]) => [id, new Set(counts.keys())])), links: [...pairs.values()] };
}

/**
 * The region as browsing sees it: every concept with at least one linked note
 * published into this domain, whether or not drawing places it here.
 */
export function browsingRegion(map: ConceptMap, graph: AtlasGraph, id: string): Region | null {
  const drawing = map.regions.find((row) => row.id === id);
  if (!drawing) return null;
  if (id === UNGROUPED) return drawing;
  const labelOf = (concept: string) => graph.conceptById.get(concept)?.label ?? concept;
  const concepts = [...map.memberships].filter(([, domains]) => domains.has(id)).map(([concept]) => concept)
    .sort((a, b) => compareStrings(labelOf(a), labelOf(b)));
  const touched = new Set(graph.edges.flatMap((edge) => [edge.from, edge.to]));
  return { id, title: drawing.title, concepts, linked: concepts.filter((concept) => touched.has(concept)).length };
}

export interface PlacedConcept {
  readonly id: string;
  readonly column: number;
  readonly row: number;
  readonly visiting: boolean;
}

export interface StudyOrderLayout {
  readonly placed: readonly PlacedConcept[];
  readonly edges: readonly AtlasEdge[];
  readonly columns: number;
  readonly beyond: number | null;
  readonly unlinked: readonly string[];
}

export function studyOrderLayout(members: readonly string[], graph: AtlasGraph): StudyOrderLayout {
  const inside = new Set(members);
  const edges = graph.edges.filter((edge) => edge.layer === 'strict'
    && (inside.has(edge.studyFrom) || inside.has(edge.studyTo)));
  const nodes = new Set(edges.flatMap((edge) => [edge.studyFrom, edge.studyTo]));
  const beyondOnly = new Set([...nodes].filter((id) => !inside.has(id)
    && edges.every((edge) => edge.studyFrom !== id)));
  const column = new Map<string, number>([...nodes].map((id) => [id, 0]));
  const orderable = edges.filter((edge) => !beyondOnly.has(edge.studyTo));
  for (let pass = 0; pass <= nodes.size; pass += 1) {
    let moved = false;
    for (const edge of orderable) {
      const next = (column.get(edge.studyFrom) ?? 0) + 1;
      if (next > (column.get(edge.studyTo) ?? 0) && next < nodes.size) {
        column.set(edge.studyTo, next);
        moved = true;
      }
    }
    if (!moved) break;
  }
  for (let pass = 0; pass <= nodes.size; pass += 1) {
    let moved = false;
    for (const id of nodes) {
      if (beyondOnly.has(id)) continue;
      const after = orderable.filter((edge) => edge.studyFrom === id).map((edge) => column.get(edge.studyTo) ?? 0);
      const incoming = orderable.some((edge) => edge.studyTo === id);
      if (after.length && !incoming) {
        const next = Math.min(...after) - 1;
        if (next > (column.get(id) ?? 0)) { column.set(id, next); moved = true; }
      }
    }
    if (!moved) break;
  }
  const internalMax = Math.max(0, ...[...nodes].filter((id) => !beyondOnly.has(id)).map((id) => column.get(id) ?? 0));
  const beyond = beyondOnly.size ? internalMax + 1 : null;
  if (beyond !== null) for (const id of beyondOnly) column.set(id, beyond);

  const lanes: string[][] = [];
  const labelOf = (id: string) => graph.conceptById.get(id)?.label ?? id;
  for (const id of [...nodes].sort((a, b) => compareStrings(labelOf(a), labelOf(b)))) {
    const at = column.get(id) ?? 0;
    (lanes[at] ??= []).push(id);
  }
  const rowOf = new Map<string, number>();
  const place = () => lanes.forEach((lane) => lane?.forEach((id, index) => rowOf.set(id, index)));
  const pull = (lane: string[] | undefined, neighbours: (id: string) => string[]) => {
    if (!lane) return;
    const weight = new Map(lane.map((id) => {
      const rows = neighbours(id).map((other) => rowOf.get(other) ?? 0);
      return [id, rows.length ? rows.reduce((sum, value) => sum + value, 0) / rows.length : (rowOf.get(id) ?? 0)] as const;
    }));
    lane.sort((a, b) => (weight.get(a) ?? 0) - (weight.get(b) ?? 0));
    lane.forEach((id, index) => rowOf.set(id, index));
  };
  const before = (id: string) => edges.filter((edge) => edge.studyTo === id).map((edge) => edge.studyFrom);
  const after = (id: string) => edges.filter((edge) => edge.studyFrom === id).map((edge) => edge.studyTo);
  place();
  for (let sweep = 0; sweep < 4; sweep += 1) {
    for (let index = 1; index < lanes.length; index += 1) pull(lanes[index], before);
    for (let index = lanes.length - 2; index >= 0; index -= 1) pull(lanes[index], after);
  }
  const finalRow = new Map<string, number>();
  lanes.forEach((lane) => {
    let floor = 0;
    lane?.forEach((id) => {
      const rows = before(id).map((other) => finalRow.get(other)).filter((row): row is number => row !== undefined);
      const wanted = rows.length ? Math.round(rows.reduce((sum, value) => sum + value, 0) / rows.length) : floor;
      const row = Math.max(floor, wanted);
      finalRow.set(id, row);
      floor = row + 1;
    });
  });
  return {
    placed: [...nodes].map((id) => ({
      id, column: column.get(id) ?? 0, row: finalRow.get(id) ?? 0, visiting: !inside.has(id),
    })),
    edges,
    columns: lanes.length,
    beyond,
    unlinked: members.filter((id) => !nodes.has(id)),
  };
}

/** Shared concepts between each pair of modules. */
export function moduleOverlap(graph: AtlasGraph): Map<string, string[]> {
  const shared = new Map<string, string[]>();
  for (const [concept, modules] of graph.modulesByConcept) {
    if (!graph.conceptById.get(concept)?.record) continue;
    for (const a of modules) {
      for (const b of modules) {
        if (a >= b) continue;
        const key = `${a}\u0000${b}`;
        shared.set(key, [...(shared.get(key) ?? []), concept]);
      }
    }
  }
  return shared;
}

export const overlapKey = (a: string, b: string) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);

export interface LectureIdea {
  readonly id: string;
  readonly title: string;
  readonly buildsOn: readonly string[];
}

export interface LectureMapLayout {
  readonly columns: readonly (readonly string[])[];
  readonly links: readonly { readonly from: string; readonly to: string }[];
}

/** Lay one lecture's idea map out left to right by `buildsOn`. */
export function layoutLectureMap(ideas: readonly LectureIdea[]): LectureMapLayout {
  const order = new Map(ideas.map((idea, index) => [idea.id, index]));
  const links = ideas.flatMap((idea) => [...new Set(idea.buildsOn)]
    .filter((from) => from !== idea.id && order.has(from))
    .map((from) => ({ from, to: idea.id })));
  const column = new Map(ideas.map((idea) => [idea.id, 0]));
  for (let pass = 0; pass < ideas.length; pass += 1) {
    let moved = false;
    for (const link of links) {
      const next = (column.get(link.from) ?? 0) + 1;
      if (next > (column.get(link.to) ?? 0) && next < ideas.length) {
        column.set(link.to, next);
        moved = true;
      }
    }
    if (!moved) break;
  }
  const width = ideas.length ? Math.max(...column.values()) + 1 : 0;
  const row = new Map<string, number>();
  const columns: string[][] = [];
  for (let at = 0; at < width; at += 1) {
    const weight = (id: string) => {
      const rows = links.filter((link) => link.to === id).map((link) => row.get(link.from))
        .filter((value): value is number => value !== undefined);
      return rows.length ? rows.reduce((sum, value) => sum + value, 0) / rows.length : 0;
    };
    const here = ideas.filter((idea) => column.get(idea.id) === at)
      .sort((a, b) => weight(a.id) - weight(b.id) || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    here.forEach((idea, index) => row.set(idea.id, index));
    columns.push(here.map((idea) => idea.id));
  }
  return { columns, links };
}
