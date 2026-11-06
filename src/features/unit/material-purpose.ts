/**
 * What each of a lecture's materials is for, what it is, and which one to try
 * first (Study Desk v2, Figma OYWz… C2–C4; BRIEF §6 and decisions D1, D13).
 *
 * Presentation only. Core owns what a material is for; until it publishes a
 * `purpose` (BRIEF D1) this reads one from fields Core already projects:
 * provenance, the route's depth, format and scope, the module source map's
 * role, and each placement's working kind and triage. It never reads titles or
 * prose. Nothing here is written back, and every placement and every route of
 * the lecture stays in the result, so a collapsed group can never hide one.
 *
 * Pure functions over plain values, so tests load this file directly.
 */
import type { ProjectionRecord } from '../../contracts/manifest';
import type { StageResourceView } from '../stage-resources';
import type { MaterialOptionView, StageRecordView } from './model';
import { asString, asText } from '../../projection/readers';
import { foldCase } from '../../sorting';

/* ──────────────────────────────── purposes ─────────────────────────────── */

export type PurposeKey = 'lecture' | 'intuition' | 'theory' | 'practice' | 'build' | 'deeper' | 'reference';

export interface PurposeDef {
  readonly key: PurposeKey;
  readonly label: string;
  /** One sentence under the group heading: what the group is for. */
  readonly says: string;
  /** A Lucide name Obsidian bundles. Purposes get icons, never colours (D7). */
  readonly icon: string;
}

/** Always in this order: the order a study session uses them in. */
export const MATERIAL_PURPOSES: readonly PurposeDef[] = [
  { key: 'lecture', label: 'The lecture', says: 'What your course gave you for this lecture.', icon: 'presentation' },
  { key: 'intuition', label: 'Intuition', says: 'Why it works, in pictures and plain words. Take one when an idea does not click.', icon: 'lightbulb' },
  { key: 'theory', label: 'Theory', says: 'The textbook account and the formal argument, when you want it exact.', icon: 'sigma' },
  { key: 'practice', label: 'Practice', says: 'Problems to work, with solutions to check yourself against.', icon: 'pencil-line' },
  { key: 'build', label: 'Build it', says: 'Code it and run it.', icon: 'code-xml' },
  { key: 'deeper', label: 'Going deeper', says: 'Beyond this lecture. Kept for later, never required.', icon: 'telescope' },
  { key: 'reference', label: 'Reference', says: 'Look things up. Earlier versions stay here, so nothing is lost.', icon: 'book-marked' },
];

export function purposeDef(key: PurposeKey): PurposeDef {
  return MATERIAL_PURPOSES.find((purpose) => purpose.key === key) ?? MATERIAL_PURPOSES[0]!;
}

/* ─────────────────────────────────── types ─────────────────────────────── */

export type MaterialTypeKey =
  | 'slides' | 'scripts' | 'recordings' | 'exercise-sheets' | 'solutions' | 'past-exams' | 'problem-sets' | 'tasks'
  | 'videos' | 'web-pages' | 'articles' | 'textbooks' | 'notes-docs' | 'papers' | 'courses'
  | 'code' | 'older' | 'other';

export interface MaterialTypeDef {
  readonly key: MaterialTypeKey;
  /** The sub-heading: "Textbooks". */
  readonly plural: string;
  /** The word on the row: "Textbook". */
  readonly singular: string;
  readonly icon: string;
}

/**
 * One fixed order for every purpose (decision I3): the course's own files
 * first, then what you watch, read and work, then the rest. A learner meets
 * the same type in the same place in every group and every lecture.
 */
export const MATERIAL_TYPES: readonly MaterialTypeDef[] = [
  { key: 'slides', plural: 'Slides', singular: 'Slides', icon: 'presentation' },
  { key: 'scripts', plural: 'Scripts', singular: 'Script', icon: 'book-text' },
  { key: 'recordings', plural: 'Recordings', singular: 'Recording', icon: 'circle-play' },
  { key: 'exercise-sheets', plural: 'Exercise sheets', singular: 'Exercise sheet', icon: 'clipboard-list' },
  { key: 'solutions', plural: 'Solutions', singular: 'Solutions', icon: 'clipboard-check' },
  { key: 'past-exams', plural: 'Past exams', singular: 'Past exam', icon: 'graduation-cap' },
  { key: 'problem-sets', plural: 'Problem sets', singular: 'Problem set', icon: 'list-checks' },
  { key: 'tasks', plural: 'Tasks', singular: 'Task', icon: 'list-checks' },
  { key: 'videos', plural: 'Videos', singular: 'Video', icon: 'circle-play' },
  { key: 'web-pages', plural: 'Web pages', singular: 'Web page', icon: 'globe' },
  { key: 'articles', plural: 'Articles', singular: 'Article', icon: 'file-text' },
  { key: 'textbooks', plural: 'Textbooks', singular: 'Textbook', icon: 'book-open' },
  { key: 'notes-docs', plural: 'Notes & docs', singular: 'Notes & docs', icon: 'book-text' },
  { key: 'papers', plural: 'Papers', singular: 'Paper', icon: 'newspaper' },
  { key: 'courses', plural: 'Courses', singular: 'Course', icon: 'library-big' },
  { key: 'code', plural: 'Code', singular: 'Code', icon: 'code' },
  { key: 'older', plural: 'Older versions', singular: 'Older version', icon: 'history' },
  { key: 'other', plural: 'Other', singular: 'Material', icon: 'file-text' },
];

export function materialTypeDef(key: MaterialTypeKey): MaterialTypeDef {
  return MATERIAL_TYPES.find((type) => type.key === key) ?? MATERIAL_TYPES[MATERIAL_TYPES.length - 1]!;
}

const TYPE_ORDER = new Map(MATERIAL_TYPES.map((type, index) => [type.key, index]));

/* ──────────────────────────────── resolution ───────────────────────────── */

/** The projected facts a purpose and a type are read from. Lower-case values. */
export interface MaterialFacts {
  /** The route's format, else the placement's own. */
  readonly format: string | null;
  readonly depth: string | null;
  readonly scope: string | null;
  /** The module source map's role for this material's source. */
  readonly role: string | null;
  readonly sourceType: string | null;
  /** The working kind of the first placement in plan order. */
  readonly kind: string | null;
  /** One triage per placement; an empty list for a route no stage uses. */
  readonly triages: readonly (string | null)[];
  /** Whether a registered source stands behind it. */
  readonly hasSource: boolean;
  /** What it points at: a link, a vault note, a registered file, or nothing. */
  readonly target: 'web' | 'vault' | 'file' | 'none';
}

const PRACTICE_FORMATS = new Set(['exercise', 'solutions', 'exam']);

/** Course provenance: the course's own files, whatever they are. */
export function isCourseMaterial(facts: MaterialFacts): boolean {
  return facts.role === 'course-material' || facts.sourceType === 'lecture' || facts.format === 'course-material';
}

function practiceLike(facts: MaterialFacts): boolean {
  return facts.kind === 'practise' || facts.depth === 'practice' || PRACTICE_FORMATS.has(facts.format ?? '');
}

function keptOnlyFor(facts: MaterialFacts, triage: string): boolean {
  return facts.triages.length > 0 && facts.triages.every((value) => value === triage);
}

/**
 * First match wins: provenance → route depth → route format → practising →
 * source role → triage → working kind (BRIEF §6, decisions I1 and I1b). "unassessed" depth and an
 * unknown role fall through; nothing is dropped, and a placement with nothing
 * to go on reads as Theory, the way an unlabelled `read` would.
 */
export function resolvePurpose(facts: MaterialFacts): PurposeKey {
  if (isCourseMaterial(facts)) {
    if (facts.scope === 'prior-year' || keptOnlyFor(facts, 'reference-only')) return 'reference';
    return practiceLike(facts) ? 'practice' : 'lecture';
  }
  switch (facts.depth) {
    case 'intuition': case 'orientation': return 'intuition';
    case 'derivation': case 'course-aligned': return 'theory';
    case 'practice': return 'practice';
    case 'implementation': return 'build';
    case 'advanced-reference': return 'deeper';
    default: break;
  }
  if (PRACTICE_FORMATS.has(facts.format ?? '')) return 'practice';
  if (facts.format === 'code' || facts.format === 'notebook') return 'build';
  // What the plan asks you to do with it outranks what its source is generally
  // for: a spine textbook's exercises are practice (decision I1b). Practising
  // from an implementation source is building it.
  if (facts.kind === 'practise' || facts.kind === 'practice') return facts.role === 'implementation' ? 'build' : 'practice';
  switch (facts.role) {
    case 'intuition': case 'first-exposure': return 'intuition';
    case 'spine': case 'derivation': return 'theory';
    case 'practice': case 'exam-preparation': return 'practice';
    case 'implementation': return 'build';
    case 'optional-depth': return 'deeper';
    case 'reference': case 'candidate': return 'reference';
    default: break;
  }
  if (keptOnlyFor(facts, 'deferred')) return 'deeper';
  if (keptOnlyFor(facts, 'reference-only')) return 'reference';
  switch (facts.kind) {
    case 'practise': case 'practice': return 'practice';
    case 'reference': return 'reference';
    case 'watch': return 'intuition';
    default: return 'theory';
  }
}

const FORMAT_TYPE: Readonly<Record<string, MaterialTypeKey>> = {
  exam: 'past-exams',
  solutions: 'solutions',
  exercise: 'problem-sets',
  video: 'videos',
  book: 'textbooks',
  textbook: 'textbooks',
  paper: 'papers',
  article: 'articles',
  documentation: 'notes-docs',
  docs: 'notes-docs',
  course: 'courses',
  website: 'web-pages',
  web: 'web-pages',
  'web-page': 'web-pages',
  webpage: 'web-pages',
  code: 'code',
  notebook: 'code',
  software: 'code',
};

/**
 * What it is, from structured fields only (decision I2): the route's format,
 * then the working kind, then the source's type. A course file is told apart
 * by the same fields: practice, solutions, an exam, a prior year, a recording.
 */
export function resolveType(facts: MaterialFacts): MaterialTypeKey {
  if (isCourseMaterial(facts)) {
    if (facts.format === 'solutions') return 'solutions';
    if (facts.format === 'exam') return 'past-exams';
    if (practiceLike(facts)) return 'exercise-sheets';
    if (facts.scope === 'prior-year') return 'older';
    if (facts.kind === 'watch' || facts.format === 'video') return 'recordings';
    // A course's own documentation is its script (M2's "Skript"); a lecture
    // source's other files are its decks.
    return facts.sourceType === 'documentation' ? 'scripts' : 'slides';
  }
  const byFormat = facts.format ? FORMAT_TYPE[facts.format] : undefined;
  if (byFormat) return byFormat;
  const practise = facts.kind === 'practise' || facts.kind === 'practice';
  // Work the plan names with no source and nothing to open is a task.
  if (practise && !facts.hasSource && facts.target === 'none') return 'tasks';
  if (practise) return 'problem-sets';
  if (facts.kind === 'watch') return 'videos';
  const bySource = facts.sourceType ? FORMAT_TYPE[facts.sourceType] : undefined;
  if (bySource) return bySource;
  if (!facts.hasSource && facts.target === 'web') return 'web-pages';
  if (!facts.hasSource && facts.target === 'vault') return 'notes-docs';
  return 'other';
}

/** What a projected record points at, from its own target fields. */
export function targetOf(record: ProjectionRecord | null | undefined): MaterialFacts['target'] {
  if (!record) return 'none';
  if (asString(record.url)) return 'web';
  const vault = asString(record.vault_path);
  if (vault && !foldCase(vault).startsWith('material://')) return 'vault';
  if (asString(record.material_uri) ?? asString(record.material_path)) return 'file';
  return 'none';
}

/* ─────────────────────────────── the lecture ───────────────────────────── */

/** How one stage of the plan uses a material, or that it does not. */
export type StageUse = 'required' | 'helps' | 'deferred' | 'reference' | null;

export function stageUseOf(triage: string | null): Exclude<StageUse, null> {
  if (triage === 'helpful-now') return 'helps';
  if (triage === 'deferred') return 'deferred';
  if (triage === 'reference-only') return 'reference';
  // An unranked pre-v2 placement counts as required, never as deprioritised.
  return 'required';
}

export interface LectureMaterial {
  /** The route id when one is known, else source + locator + label. */
  readonly key: string;
  readonly title: string;
  /** The first placement in plan order; null for a route no stage uses. */
  readonly resource: StageResourceView | null;
  readonly route: MaterialOptionView | null;
  readonly sourceId: string | null;
  readonly locator: string | null;
  readonly purpose: PurposeKey;
  readonly type: MaterialTypeKey;
  readonly course: boolean;
  readonly picked: boolean;
  /** One entry per stage of the plan, in plan order. */
  readonly uses: readonly StageUse[];
  /** First appearance in the plan, then the unplaced routes in source-map order. */
  readonly order: number;
  /** A short "what it is for", for the row. */
  readonly why: string | null;
  /** The full rationale, for the opened row. */
  readonly detail: string | null;
  /** Every placement, for opening and feedback against its own stage. */
  readonly placements: readonly { readonly stageId: string; readonly resource: StageResourceView }[];
}

export interface LectureMaterialInputs {
  /** The durable plan's stages, in plan order. */
  readonly stages: readonly StageRecordView[];
  /** Every route Core projects for this unit, placed or not. */
  readonly options: readonly MaterialOptionView[];
  /** The route a placement points at, if one is known (`routeForResource`). */
  readonly routeOf: (resource: StageResourceView) => MaterialOptionView | null;
  /** The module source map's role for a source. */
  readonly roleOf: (sourceId: string) => string | null;
  /** A source record's `source_type`. */
  readonly sourceTypeOf: (sourceId: string) => string | null;
}

function lower(value: string | null | undefined): string | null {
  const text = (value ?? '').trim();
  return text ? foldCase(text) : null;
}

function placementKey(resource: StageResourceView, route: MaterialOptionView | null): string {
  return route?.routeId
    ?? asString(resource.record.route_id)
    ?? `${resource.sourceId ?? ''}\u0000${resource.locator ?? ''}\u0000${resource.label}`;
}

/**
 * Every material of one lecture, once: each distinct placement target across
 * the plan, then each route of the unit that no stage uses (decision I5).
 */
export function buildLectureMaterials(inputs: LectureMaterialInputs): LectureMaterial[] {
  const { stages, options, routeOf, roleOf, sourceTypeOf } = inputs;
  interface Draft {
    key: string;
    first: StageResourceView | null;
    route: MaterialOptionView | null;
    sourceId: string | null;
    uses: StageUse[];
    triages: (string | null)[];
    placements: { stageId: string; resource: StageResourceView }[];
    order: number;
  }
  const drafts = new Map<string, Draft>();
  let order = 0;
  stages.forEach((stage, index) => {
    for (const resource of stage.resources) {
      const route = routeOf(resource);
      const key = placementKey(resource, route);
      let draft = drafts.get(key);
      if (!draft) {
        draft = {
          key, first: resource, route, sourceId: resource.sourceId ?? route?.sourceId ?? null,
          uses: stages.map(() => null), triages: [], placements: [], order: order++,
        };
        drafts.set(key, draft);
      }
      draft.route ??= route;
      draft.triages.push(resource.scopeTriage);
      draft.placements.push({ stageId: stage.id, resource });
      const use = stageUseOf(resource.scopeTriage);
      const before = draft.uses[index] ?? null;
      // Two placements in one stage: the stronger one speaks for the stage.
      if (!before || USE_STRENGTH[use] < USE_STRENGTH[before]) draft.uses[index] = use;
    }
  });
  for (const option of options) {
    if (drafts.has(option.routeId)) continue;
    drafts.set(option.routeId, {
      key: option.routeId, first: null, route: option, sourceId: option.sourceId,
      uses: stages.map(() => null), triages: [], placements: [], order: order++,
    });
  }
  return [...drafts.values()].map((draft): LectureMaterial => {
    const { first, route } = draft;
    // Read the route record itself: the option view fills a missing depth or
    // scope with a default, and a default is not evidence of a purpose.
    const facts: MaterialFacts = {
      format: lower(asString(route?.record.format) ?? asString(first?.record.format)),
      depth: lower(asString(route?.record.depth) ?? asString(first?.record.depth)),
      scope: lower(asString(route?.record.scope) ?? asString(first?.record.scope)),
      role: lower(draft.sourceId ? roleOf(draft.sourceId) : null),
      sourceType: lower(draft.sourceId ? sourceTypeOf(draft.sourceId) : null),
      kind: lower(first?.kind),
      triages: draft.triages,
      hasSource: Boolean(draft.sourceId),
      target: first && targetOf(first.record) !== 'none' ? targetOf(first.record) : targetOf(route?.record),
    };
    const why = asText(first?.record.angle) ?? route?.angle ?? null;
    return {
      key: draft.key,
      title: first?.label ?? route?.title ?? 'Untitled material',
      resource: first,
      route,
      sourceId: draft.sourceId,
      locator: first?.locator ?? route?.locator ?? null,
      purpose: resolvePurpose(facts),
      type: resolveType(facts),
      course: isCourseMaterial(facts),
      picked: Boolean(route?.selected),
      uses: draft.uses,
      order: draft.order,
      why,
      detail: asText(first?.record.angle_detail) ?? asText(route?.record.angle_detail) ?? why,
      placements: draft.placements,
    };
  });
}

const USE_STRENGTH: Readonly<Record<Exclude<StageUse, null>, number>> = {
  required: 0, helps: 1, deferred: 2, reference: 3,
};

/* ─────────────────────────────────── rank ──────────────────────────────── */

export interface RankKey {
  /** Under a Stage filter: that stage's own triage, strongest first (0–3). */
  readonly stage: number;
  readonly picked: boolean;
  /** Stages that require it. */
  readonly required: number;
  /** Stages that use it now, required or helping. */
  readonly using: number;
  /** Stages that keep it deferred or for reference. */
  readonly kept: number;
  readonly order: number;
}

export function rankKey(material: LectureMaterial, stageIndex: number | null = null): RankKey {
  const count = (test: (use: StageUse) => boolean) => material.uses.filter(test).length;
  const own = stageIndex === null ? null : material.uses[stageIndex] ?? null;
  return {
    stage: own ? USE_STRENGTH[own] : 4,
    picked: material.picked,
    required: count((use) => use === 'required'),
    using: count((use) => use === 'required' || use === 'helps'),
    kept: count((use) => use === 'deferred' || use === 'reference'),
    order: material.order,
  };
}

/** Negative when `a` ranks above `b`, ignoring plan order (the tie-breaker). */
function compareMerit(a: RankKey, b: RankKey): number {
  return (a.stage - b.stage)
    || (Number(b.picked) - Number(a.picked))
    || (b.required - a.required)
    || (b.using - a.using)
    || (b.kept - a.kept);
}

/**
 * Best first (D13): your picks, then what this lecture's stages require, then
 * what more of its stages use, then what they keep for reference, then plan
 * order. Under a Stage filter that stage's own triage comes first.
 */
export function compareRank(a: RankKey, b: RankKey): number {
  return compareMerit(a, b) || (a.order - b.order);
}

export function rankMaterials(materials: readonly LectureMaterial[], stageIndex: number | null = null): LectureMaterial[] {
  return materials
    .map((material) => ({ material, key: rankKey(material, stageIndex) }))
    .sort((a, b) => compareRank(a.key, b.key))
    .map(({ material }) => material);
}

/**
 * The row that gets Best fit, or null: the top of a group of two or more that
 * strictly leads the next one, in a group where the learner has no pick (D13).
 * A tie gets no mark; a group of one has nothing to be best among.
 */
export function bestFitOf(materials: readonly LectureMaterial[], stageIndex: number | null = null): LectureMaterial | null {
  if (materials.length < 2 || materials.some((material) => material.picked)) return null;
  const [first, second] = rankMaterials(materials, stageIndex);
  if (!first || !second) return null;
  return compareMerit(rankKey(first, stageIndex), rankKey(second, stageIndex)) < 0 ? first : null;
}

/* ───────────────────────────────── structure ───────────────────────────── */

export interface TypeGroup {
  readonly type: MaterialTypeDef;
  readonly materials: readonly LectureMaterial[];
}

export interface PurposeGroup {
  readonly purpose: PurposeDef;
  /** Ranked best first across the whole group. */
  readonly materials: readonly LectureMaterial[];
  /** Ranked inside each type, types in the fixed order. */
  readonly types: readonly TypeGroup[];
  /** Whether the types get their own sub-headings (decision I6). */
  readonly showTypes: boolean;
  readonly bestFit: LectureMaterial | null;
}

/** Structure follows volume (BRIEF rule 4, decision I6). */
export type LectureLayout = 'flat' | 'grouped' | 'collapsed';

export function lectureLayout(total: number): LectureLayout {
  if (total <= 6) return 'flat';
  return total <= 30 ? 'grouped' : 'collapsed';
}

/** Type sub-headings help only when a group is long and mixed. */
export function showsTypeHeadings(materials: readonly LectureMaterial[]): boolean {
  return materials.length >= 4 && new Set(materials.map((material) => material.type)).size >= 2;
}

/** Purpose groups in study order, each ranked inside its types; empty purposes are left out. */
export function groupByPurpose(materials: readonly LectureMaterial[], stageIndex: number | null = null): PurposeGroup[] {
  return MATERIAL_PURPOSES.flatMap((purpose): PurposeGroup[] => {
    const members = materials.filter((material) => material.purpose === purpose.key);
    if (!members.length) return [];
    const ranked = rankMaterials(members, stageIndex);
    const types = MATERIAL_TYPES.flatMap((type): TypeGroup[] => {
      const ofType = ranked.filter((material) => material.type === type.key);
      return ofType.length ? [{ type, materials: ofType }] : [];
    });
    return [{
      purpose, materials: ranked, types,
      showTypes: showsTypeHeadings(ranked),
      bestFit: bestFitOf(ranked, stageIndex),
    }];
  });
}

/** The order a flat list or a group without sub-headings reads in. */
export function compareTypes(a: MaterialTypeKey, b: MaterialTypeKey): number {
  return (TYPE_ORDER.get(a) ?? 0) - (TYPE_ORDER.get(b) ?? 0);
}

/* ──────────────────────────────── filtering ────────────────────────────── */

export type WhereFilter = 'anywhere' | 'local' | 'web' | 'missing';

export interface MaterialFilter {
  readonly query: string;
  /** A stage index into the plan, or null for every stage. */
  readonly stage: number | null;
  readonly type: MaterialTypeKey | null;
  readonly where: WhereFilter;
}

export const NO_FILTER: MaterialFilter = { query: '', stage: null, type: null, where: 'anywhere' };

export function isFiltered(filter: MaterialFilter): boolean {
  return Boolean(filter.query.trim()) || filter.stage !== null || filter.type !== null || filter.where !== 'anywhere';
}

/**
 * Whether a material passes the filter. `whereOf` says where it is (the
 * caller reads availability from the projection); `haystack` is the text the
 * search box matches: title, source, locator and why.
 */
export function matchesFilter(
  material: LectureMaterial,
  filter: MaterialFilter,
  whereOf: (material: LectureMaterial) => Exclude<WhereFilter, 'anywhere'> | null,
  haystack: (material: LectureMaterial) => string,
): boolean {
  if (filter.stage !== null && !material.uses[filter.stage]) return false;
  if (filter.type !== null && material.type !== filter.type) return false;
  if (filter.where !== 'anywhere' && whereOf(material) !== filter.where) return false;
  const words = foldCase(filter.query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = foldCase(haystack(material));
  return words.every((word) => text.includes(word));
}

/** "Stages 2, 5–6": the used-in strip in words, for lectures beyond nine stages. */
export function stageRuns(uses: readonly StageUse[]): string {
  const used = uses.flatMap((use, index) => (use ? [index + 1] : []));
  if (!used.length) return 'No stage yet';
  const runs: string[] = [];
  let start = used[0]!;
  let previous = start;
  for (const value of [...used.slice(1), Number.NaN]) {
    if (value === previous + 1) { previous = value; continue; }
    runs.push(start === previous ? String(start) : `${start}–${previous}`);
    start = value; previous = value;
  }
  return `${used.length === 1 ? 'Stage' : 'Stages'} ${runs.join(', ')}`;
}
