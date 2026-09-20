import type { ProjectionRecord } from '../../contracts/manifest';
import type { MaterialEntry } from '../../infrastructure/material-tree';
import { formatBytes } from '../../infrastructure/material-tree';
import { compareStrings, foldCase, upperCase } from '../../sorting';
import {
  asString as projectedString,
  asStrings as projectedStrings,
  asText as projectedText,
} from '../../projection/readers';

/**
 * The Library as a folder tree.
 *
 * The faceted browser (ADR-009) answers "how do I find a source when I do not
 * know its name" by projecting the same sources five ways and letting the
 * counts overlap. That is true, and it is not navigable: five dropdowns have no
 * *place* in them, so there is nowhere to stand, nothing to walk down, and no
 * way to see that a module has exercise sheets but no past exams.
 *
 * This module supplies the place. The folders are computed, never stored — one
 * more projection over the same records — but shaped like the thing every
 * learner already knows how to operate.
 *
 * Three properties hold it together, and they are the whole design:
 *
 *  1. **Partition where a partition is meaningful.** Inside one domain the nine
 *     material-type folders are disjoint and exhaustive over that domain's
 *     sources: `source_type` is a single value and a missing one lands in
 *     `Other`. Inside one module the nine study buckets are likewise disjoint,
 *     because `bucketFor` takes the FIRST match in a fixed priority order
 *     rather than filing a source under every bucket it could satisfy. So a
 *     folder's count is a count, and adding counts up means something.
 *
 *  2. **Aliases where overlap is the truth.** Across domains a source may
 *     appear more than once, because `thematic_group_ids` is genuinely a set:
 *     Mitzenmacher & Upfal is probability AND randomized algorithms, and making
 *     it pick one would throw away half the answer — the objection ADR-009
 *     raised against folders in the first place. Finder has the same thing and
 *     calls it an alias; the answer to "it cannot be a folder" is that one
 *     source is allowed in several folders. Each such entry carries `alsoIn`
 *     so the learner can see it is one object seen twice, not two copies.
 *
 *  3. **Totality.** Every source is reachable. A source with no thematic group,
 *     or only groups the projection does not define, is not silently dropped;
 *     it lands in `Unfiled`, which is the only reason that folder exists.
 *     `reachableSourceIds` walks the tree and is asserted against the real
 *     projection, so this is a test rather than a promise in a comment.
 *
 * Below the registry the tree keeps descending into the physical material
 * directory, because `lecture-slides/` and `exercise-slides/` differ only
 * there (see `infrastructure/material-tree.ts`).
 *
 * Every folder is derived from a `FinderIndex` built once per render by
 * `createFinderContext`. Deriving it per folder instead — the obvious way —
 * costs a full pass over the registry for each row drawn, and the columns
 * layout draws one folder per level of depth, so the obvious way is quadratic
 * in the deepest thing the learner can open.
 */

export interface FinderStore {
  get(id: string): ProjectionRecord | null;
  thematicGroups(): ProjectionRecord[];
  sources(): ProjectionRecord[];
  modules(): ProjectionRecord[];
  topicPacks(): ProjectionRecord[];
  catalogues(): ProjectionRecord[];
  useModules(sourceId: string): ProjectionRecord[];
}

export interface FinderMaterials {
  isDirectory(path: string): boolean;
  list(path: string): MaterialEntry[];
  /** Immediate item count, without stat-ing or listing each child. */
  count(path: string): number;
}

export type FinderEntryKind =
  | 'domain'
  | 'shelf'
  | 'module'
  | 'bucket'
  | 'source'
  | 'directory'
  | 'file';

export interface FinderEntry {
  /** Identifies this entry inside its parent; a route path is a list of these. */
  readonly segment: string;
  readonly kind: FinderEntryKind;
  readonly name: string;
  readonly icon: string;
  /** The "Kind" column: what this thing is, in one noun phrase. */
  readonly kindLabel: string;
  readonly isFolder: boolean;
  /** Items for a folder, null for a leaf. */
  readonly count: number | null;
  /** The secondary line: authors, host, size — whatever locates the thing. */
  readonly detail: string;
  readonly sourceId: string | null;
  /** A projected `materials/…` path, for entries backed by a real file. */
  readonly materialPath: string | null;
  readonly url: string | null;
  /** How many domains hold this same source; >1 means the entry is an alias. */
  readonly alsoIn: number;
}

export interface FinderFolder {
  /** Route path of this folder; empty at the Library root. */
  readonly path: readonly string[];
  readonly name: string;
  readonly icon: string;
  readonly kindLabel: string;
  /** What this folder is for, in the learner's terms. Empty when self-evident. */
  readonly description: string;
  readonly entries: readonly FinderEntry[];
  /** True when the requested path did not resolve; `entries` is then empty. */
  readonly missing: boolean;
  /** Set when this folder IS a source, so the inspector can offer its actions. */
  readonly sourceId: string | null;
}

/** The nine material types, in the order the Library shows them. */
export const MATERIAL_TYPES: ReadonlyArray<
  readonly [type: string, label: string, icon: string]
> = [
  ['lecture', 'Lecture Slides', 'presentation'],
  ['book', 'Books', 'book'],
  ['course', 'Courses', 'graduation-cap'],
  ['video', 'Videos', 'monitor-play'],
  ['paper', 'Papers', 'newspaper'],
  ['documentation', 'Documentation', 'file-code'],
  ['website', 'Websites & Links', 'globe'],
  ['software', 'Software & Tools', 'wrench'],
  ['other', 'Other', 'file-question'],
];

/**
 * The study buckets inside a module, in priority order.
 *
 * Order is semantics, not presentation: `bucketFor` returns the first match, so
 * a past-paper collection whose roles also include `exercise` files under
 * `Past Exams & Mocks` — the more specific claim — and files there only.
 * `Lecture Slides` leads because a module's own decks are reached for by form
 * rather than by purpose.
 */
export const MODULE_BUCKETS: ReadonlyArray<
  readonly [bucket: string, label: string, icon: string]
> = [
  ['lecture-slides', 'Lecture Slides', 'presentation'],
  ['past-exams', 'Past Exams & Mocks', 'clipboard-list'],
  ['exercises', 'Exercise Sheets', 'pen-tool'],
  ['recordings', 'Recordings', 'monitor-play'],
  ['reading', 'Books & Reading', 'book'],
  ['courses', 'Courses', 'graduation-cap'],
  ['reference', 'Documentation & Tools', 'file-code'],
  ['links', 'Websites & Links', 'globe'],
  ['other', 'Other', 'file-question'],
];

interface Labelled {
  readonly label: string;
  readonly icon: string;
}

const MATERIAL_TYPE_BY_ID: ReadonlyMap<string, Labelled> = new Map(
  MATERIAL_TYPES.map(([type, label, icon]) => [type, { label, icon }]),
);

const MODULE_BUCKET_BY_ID: ReadonlyMap<string, Labelled> = new Map(
  MODULE_BUCKETS.map(([bucket, label, icon]) => [bucket, { label, icon }]),
);

const FILE_KINDS: Readonly<Record<string, readonly [string, string]>> = {
  pdf: ['PDF document', 'file-text'],
  djvu: ['Scanned document', 'file-text'],
  epub: ['E-book', 'book'],
  md: ['Markdown', 'file-text'],
  txt: ['Plain text', 'file-text'],
  tex: ['LaTeX source', 'file-code'],
  html: ['Web page', 'globe'],
  htm: ['Web page', 'globe'],
  ipynb: ['Notebook', 'file-code'],
  py: ['Python source', 'file-code'],
  ts: ['TypeScript source', 'file-code'],
  js: ['JavaScript source', 'file-code'],
  rs: ['Rust source', 'file-code'],
  json: ['JSON data', 'file-code'],
  yaml: ['YAML data', 'file-code'],
  yml: ['YAML data', 'file-code'],
  csv: ['Table', 'table-2'],
  tsv: ['Table', 'table-2'],
  xlsx: ['Spreadsheet', 'table-2'],
  zip: ['Archive', 'archive'],
  tar: ['Archive', 'archive'],
  gz: ['Archive', 'archive'],
  png: ['Image', 'image'],
  jpg: ['Image', 'image'],
  jpeg: ['Image', 'image'],
  svg: ['Image', 'image'],
  gif: ['Image', 'image'],
  mp4: ['Video', 'monitor-play'],
  mkv: ['Video', 'monitor-play'],
  mp3: ['Audio', 'monitor-play'],
};

export const ROOT_SHELVES = {
  skills: 'shelf:skills',
  packs: 'shelf:packs',
  catalogues: 'shelf:catalogues',
  unfiled: 'shelf:unfiled',
  unregistered: 'shelf:unregistered',
} as const;

/*
 * Files `materials/` carries for its own bookkeeping rather than as material.
 * `build_materials_tree.py` writes a SOURCES.md into each module folder, and
 * the catalogue writes FILES.txt and INDEX.html; listing those as unregistered
 * material would report the tooling to the learner as a gap.
 */
const MATERIAL_BOOKKEEPING: ReadonlySet<string> = new Set([
  'sources.md', 'readme.md', 'files.txt', 'index.html',
]);

/** Bounds resolution against a malformed or hand-edited route path. */
const MAX_DEPTH = 12;

const NO_RECORDS: readonly ProjectionRecord[] = [];

// ------------------------------------------------------------------ vocabulary

function segment(prefix: string, value: string): string {
  return `${prefix}:${value}`;
}

/** Splits on the FIRST colon only, so a material path may contain colons. */
function parseSegment(value: string): readonly [string, string] {
  const at = value.indexOf(':');
  return at < 0 ? [value, ''] : [value.slice(0, at), value.slice(at + 1)];
}

function titleOf(record: ProjectionRecord | null): string {
  if (!record) return 'Unknown';
  return projectedText(record.title) ?? projectedString(record.id) ?? 'Unknown';
}

function byTitle(left: ProjectionRecord, right: ProjectionRecord): number {
  return compareStrings(titleOf(left), titleOf(right));
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch (_) {
    return url;
  }
}

function fileKind(name: string): readonly [string, string] {
  const dot = name.lastIndexOf('.');
  const extension = dot > 0 ? foldCase(name.slice(dot + 1)) : '';
  const known = FILE_KINDS[extension];
  if (known) return known;
  return extension ? [`${upperCase(extension)} file`, 'file'] : ['Document', 'file'];
}

function sourceRoles(source: ProjectionRecord): Set<string> {
  const roles = new Set(projectedStrings(source.roles));
  const evaluations = Array.isArray(source.evaluations) ? source.evaluations : [];
  for (const evaluation of evaluations) {
    if (!evaluation || typeof evaluation !== 'object') continue;
    for (const role of projectedStrings((evaluation as ProjectionRecord).roles)) {
      roles.add(role);
    }
  }
  return roles;
}

/** The one material type a source has. Total: an unknown type is `other`. */
export function sourceTypeOf(source: ProjectionRecord): string {
  const type = foldCase(projectedString(source.source_type) ?? '');
  return MATERIAL_TYPE_BY_ID.has(type) ? type : 'other';
}

/** The one module bucket a source belongs to. First match wins; see MODULE_BUCKETS. */
export function bucketFor(source: ProjectionRecord): string {
  const type = sourceTypeOf(source);
  if (type === 'lecture') return 'lecture-slides';
  const roles = sourceRoles(source);
  if (roles.has('mock-exam')) return 'past-exams';
  if (roles.has('exercise') || roles.has('practice')) return 'exercises';
  if (type === 'video') return 'recordings';
  if (type === 'book' || type === 'paper') return 'reading';
  if (type === 'course') return 'courses';
  if (type === 'documentation' || type === 'software') return 'reference';
  if (type === 'website') return 'links';
  return 'other';
}

function authorLine(source: ProjectionRecord): string {
  const authors = projectedStrings(source.authors);
  const who = authors.length
    ? authors.length > 2 ? `${authors[0]} et al.` : authors.join(' & ')
    : projectedText(source.organization) ?? '';
  const year = projectedText(source.year) ?? '';
  return [who, year].filter(Boolean).join(' · ');
}

// ----------------------------------------------------------------------- index

/**
 * Everything the folders need, keyed for O(1) lookup.
 *
 * `typeOf` and `bucketOf` are memoised per source rather than recomputed per
 * row: `bucketFor` reads every evaluation's roles, and a domain listing asks
 * the same question of the same source once per folder it draws.
 */
interface FinderIndex {
  readonly groups: readonly ProjectionRecord[];
  readonly groupById: ReadonlyMap<string, ProjectionRecord>;
  readonly sourcesByGroup: ReadonlyMap<string, readonly ProjectionRecord[]>;
  readonly unfiled: readonly ProjectionRecord[];
  readonly modulesByGroup: ReadonlyMap<string, readonly ProjectionRecord[]>;
  readonly ungroupedModules: readonly ProjectionRecord[];
  readonly sourcesByModule: ReadonlyMap<string, readonly ProjectionRecord[]>;
  readonly typeOf: ReadonlyMap<string, string>;
  readonly bucketOf: ReadonlyMap<string, string>;
  readonly domainsOf: ReadonlyMap<string, number>;
  readonly sourceCount: number;
  /** Every `materials/…` path a source record claims, and their ancestors. */
  readonly claimedMaterial: ReadonlySet<string>;
  /** The directories those claims sit in — where an unclaimed sibling can hide. */
  readonly materialParents: readonly string[];
}

export interface FinderContext {
  readonly store: FinderStore;
  readonly materials: FinderMaterials;
  readonly index: FinderIndex;
  /**
   * Memo for the one answer that costs disk reads: the unregistered material.
   *
   * Finding it means listing every directory a claimed material path sits in,
   * so it is computed at most once per context — which is once per render —
   * rather than once per folder that happens to mention it.
   */
  unregistered?: FinderEntry[];
}

function push<T>(map: Map<string, T[]>, key: string, value: T): void {
  const current = map.get(key);
  if (current) current.push(value);
  else map.set(key, [value]);
}

function buildIndex(store: FinderStore): FinderIndex {
  const groups = store.thematicGroups();
  const groupById = new Map<string, ProjectionRecord>();
  for (const group of groups) {
    const id = projectedString(group.id);
    if (id) groupById.set(id, group);
  }

  const sourcesByGroup = new Map<string, ProjectionRecord[]>();
  const sourcesByModule = new Map<string, ProjectionRecord[]>();
  const typeOf = new Map<string, string>();
  const bucketOf = new Map<string, string>();
  const domainsOf = new Map<string, number>();
  const unfiled: ProjectionRecord[] = [];
  const claimedMaterial = new Set<string>();
  const materialParents = new Set<string>();

  // Sorted once here, so every folder that slices this list inherits the order
  // instead of sorting its own copy.
  for (const source of store.sources().slice().sort(byTitle)) {
    const id = projectedString(source.id);
    if (!id) continue;
    typeOf.set(id, sourceTypeOf(source));
    bucketOf.set(id, bucketFor(source));

    const claim = (projectedString(source.material_path) ?? '').replace(/\/+$/, '');
    if (claim && source.material_exists === true) {
      // The claim itself, and every directory above it: a folder that CONTAINS
      // a claimed path is reached through that claim, so it is not unclaimed.
      claimedMaterial.add(claim);
      const parts = claim.split('/');
      for (let cut = parts.length - 1; cut > 0; cut -= 1) {
        claimedMaterial.add(parts.slice(0, cut).join('/'));
      }
      materialParents.add(parts.slice(0, -1).join('/'));
    }

    const own = projectedStrings(source.thematic_group_ids)
      .filter((groupId) => groupById.has(groupId));
    domainsOf.set(id, own.length);
    if (own.length) {
      for (const groupId of own) push(sourcesByGroup, groupId, source);
    } else {
      unfiled.push(source);
    }

    for (const module of store.useModules(id)) {
      const moduleId = projectedString(module.id);
      if (moduleId) push(sourcesByModule, moduleId, source);
    }
  }

  const modulesByGroup = new Map<string, ProjectionRecord[]>();
  const ungroupedModules: ProjectionRecord[] = [];
  for (const module of store.modules().slice().sort(byTitle)) {
    const own = projectedStrings(module.thematic_group_ids)
      .filter((groupId) => groupById.has(groupId));
    if (own.length) {
      for (const groupId of own) push(modulesByGroup, groupId, module);
    } else {
      ungroupedModules.push(module);
    }
  }

  return {
    groups,
    groupById,
    sourcesByGroup,
    unfiled,
    modulesByGroup,
    ungroupedModules,
    sourcesByModule,
    typeOf,
    bucketOf,
    domainsOf,
    sourceCount: typeOf.size,
    claimedMaterial,
    materialParents: [...materialParents].sort(compareStrings),
  };
}

/**
 * Material on disk that no source record claims.
 *
 * The registry addresses material one URI per source, and a URI can point at a
 * subdirectory: `source-aml-ss26-lectures` claims `…/aml-ss26-lectures/
 * lecture-slides`, so the `exercise-slides/` and `bonus-exercises/` sitting
 * beside it belong to no record and would be invisible in a Library that only
 * ever renders records. They are this semester's exercise sheets.
 *
 * Rather than guess a source into existence for them — inventing a judgment
 * nobody made, and one only the core may record — the browser shows them for
 * what they are: files that are here, and are not in the registry yet.
 *
 * Only the directories that already hold a claim are examined, so this reports
 * a sibling of something registered and never tries to audit `materials/` as a
 * whole. A folder containing a claim is itself reached through that claim, so
 * it is not reported; `materials/machine-learning/classical/` is therefore not
 * listed just because it holds registered source folders.
 */
export function unregisteredMaterial(context: FinderContext): FinderEntry[] {
  if (context.unregistered) return context.unregistered;
  const { index, materials } = context;
  const found: FinderEntry[] = [];
  for (const parent of index.materialParents) {
    // Out of its folder, a name like `exercise-slides` says nothing about WHOSE
    // exercise slides it is, and this shelf is precisely where things appear
    // out of their folder. So each entry carries where it came from.
    const where = parent.replace(/^materials\//, '');
    for (const entry of materials.list(parent)) {
      if (index.claimedMaterial.has(entry.path)) continue;
      if (MATERIAL_BOOKKEEPING.has(foldCase(entry.name))) continue;
      const base = materialEntry(entry);
      found.push({
        ...base,
        detail: [where, base.detail].filter(Boolean).join(' · '),
      });
    }
  }
  // Ordered by path, not by name, so siblings arrive together: the three
  // unclaimed folders of one course read as one gap rather than three.
  found.sort((left, right) => compareStrings(
    left.materialPath ?? left.name,
    right.materialPath ?? right.name,
  ));
  context.unregistered = found;
  return found;
}

/**
 * One context per render. Building it is a single pass over the registry, and
 * every folder below is then map lookups — so opening a folder six levels deep
 * costs the same as opening the root.
 */
export function createFinderContext(
  store: FinderStore,
  materials: FinderMaterials,
): FinderContext {
  return { store, materials, index: buildIndex(store) };
}

function sourcesInGroup(
  index: FinderIndex,
  groupId: string,
): readonly ProjectionRecord[] {
  return index.sourcesByGroup.get(groupId) ?? NO_RECORDS;
}

function modulesInGroup(
  index: FinderIndex,
  groupId: string,
): readonly ProjectionRecord[] {
  return index.modulesByGroup.get(groupId) ?? NO_RECORDS;
}

function sourcesInModule(
  index: FinderIndex,
  moduleId: string,
): readonly ProjectionRecord[] {
  return index.sourcesByModule.get(moduleId) ?? NO_RECORDS;
}

function typeIdOf(index: FinderIndex, source: ProjectionRecord): string {
  const id = projectedString(source.id);
  return (id ? index.typeOf.get(id) : undefined) ?? 'other';
}

function bucketIdOf(index: FinderIndex, source: ProjectionRecord): string {
  const id = projectedString(source.id);
  return (id ? index.bucketOf.get(id) : undefined) ?? 'other';
}

/** How many of each key, in one pass. */
function tally(
  sources: readonly ProjectionRecord[],
  keyOf: (source: ProjectionRecord) => string,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const source of sources) {
    const key = keyOf(source);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

// --------------------------------------------------------------------- entries

function folderEntry(options: {
  segment: string;
  kind: FinderEntryKind;
  name: string;
  icon: string;
  kindLabel: string;
  count: number;
  detail?: string;
}): FinderEntry {
  return {
    segment: options.segment,
    kind: options.kind,
    name: options.name,
    icon: options.icon,
    kindLabel: options.kindLabel,
    isFolder: true,
    count: options.count,
    detail: options.detail ?? '',
    sourceId: null,
    materialPath: null,
    url: null,
    alsoIn: 0,
  };
}

function sourceEntry(
  context: FinderContext,
  source: ProjectionRecord,
): FinderEntry {
  const { index, materials } = context;
  const id = projectedString(source.id) ?? '';
  const materialPath = projectedString(source.material_path);
  const url = projectedString(source.url);
  const hasLocal = Boolean(materialPath) && source.material_exists === true;
  const isFolder = hasLocal && materials.isDirectory(materialPath ?? '');
  const typeLabel = MATERIAL_TYPE_BY_ID.get(typeIdOf(index, source))?.label ?? 'Other';
  const [fileLabel, fileIcon] = fileKind(materialPath ?? '');

  return {
    segment: segment('source', id),
    kind: 'source',
    name: titleOf(source),
    icon: isFolder ? 'folder' : hasLocal ? fileIcon : url ? 'globe' : 'file-question',
    kindLabel: isFolder
      ? `${typeLabel.replace(/s$/, '')} collection`
      : hasLocal ? fileLabel : url ? 'Web link' : 'Registry entry',
    isFolder,
    count: isFolder ? materials.count(materialPath ?? '') : null,
    detail: [
      authorLine(source),
      isFolder ? 'local collection' : hasLocal ? 'local copy' : url ? hostOf(url) : '',
    ].filter(Boolean).join(' · '),
    sourceId: id,
    materialPath,
    url,
    alsoIn: index.domainsOf.get(id) ?? 0,
  };
}

function materialEntry(entry: MaterialEntry): FinderEntry {
  const [kindLabel, iconName] = entry.isDirectory
    ? (['Folder', 'folder'] as const)
    : fileKind(entry.name);
  return {
    segment: segment('at', entry.path),
    kind: entry.isDirectory ? 'directory' : 'file',
    name: entry.name,
    icon: iconName,
    kindLabel,
    isFolder: entry.isDirectory,
    count: entry.isDirectory ? entry.childCount : null,
    detail: entry.isDirectory ? '' : formatBytes(entry.size),
    sourceId: null,
    materialPath: entry.path,
    url: null,
    alsoIn: 0,
  };
}

function moduleEntry(
  context: FinderContext,
  module: ProjectionRecord,
): FinderEntry {
  const { index } = context;
  const id = projectedString(module.id) ?? '';
  const sources = sourcesInModule(index, id);
  return folderEntry({
    segment: segment('module', id),
    kind: 'module',
    name: titleOf(module),
    icon: 'book-open',
    kindLabel: projectedText(module.kind) === 'skill' ? 'Skill track' : 'Module',
    count: tally(sources, (source) => bucketIdOf(index, source)).size,
    detail: [
      projectedText(module.code) ?? '',
      projectedText(module.semester) ?? '',
      `${sources.length} source${sources.length === 1 ? '' : 's'}`,
    ].filter(Boolean).join(' · '),
  });
}

/**
 * A shelf's sources, in the shelf's own order.
 *
 * Not re-sorted: for a curated pack the sequence IS the argument being made,
 * and alphabetising it would delete that. Duplicate entries collapse, because
 * a shelf listing the same source twice is a bookkeeping accident rather than
 * a claim that there are two of it.
 */
function shelfSources(
  store: FinderStore,
  shelf: ProjectionRecord,
): ProjectionRecord[] {
  const entries = Array.isArray(shelf.entries) ? shelf.entries : [];
  const sources: ProjectionRecord[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const id = typeof entry === 'string'
      ? entry
      : entry && typeof entry === 'object'
        ? projectedString((entry as ProjectionRecord).source)
        : null;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const source = store.get(id);
    if (source?.type === 'source') sources.push(source);
  }
  return sources;
}

// ------------------------------------------------------------------- traversal

function folder(options: {
  path: readonly string[];
  name: string;
  icon: string;
  kindLabel: string;
  description?: string;
  entries: readonly FinderEntry[];
  sourceId?: string | null;
}): FinderFolder {
  return {
    path: options.path,
    name: options.name,
    icon: options.icon,
    kindLabel: options.kindLabel,
    description: options.description ?? '',
    entries: options.entries,
    missing: false,
    sourceId: options.sourceId ?? null,
  };
}

function unavailable(path: readonly string[]): FinderFolder {
  return {
    path,
    name: 'Folder unavailable',
    icon: 'file-question',
    kindLabel: 'Folder',
    description: 'This path is not in the current projection. '
      + 'Go back up, or rebuild the views.',
    entries: [],
    missing: true,
    sourceId: null,
  };
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function rootEntries(context: FinderContext): FinderEntry[] {
  const { index, store } = context;
  const entries: FinderEntry[] = [];

  for (const group of index.groups) {
    const id = projectedString(group.id);
    if (!id) continue;
    const sources = sourcesInGroup(index, id);
    const modules = modulesInGroup(index, id);
    entries.push(folderEntry({
      segment: segment('domain', id),
      kind: 'domain',
      name: titleOf(group),
      icon: 'folder',
      kindLabel: 'Domain',
      count: tally(sources, (source) => typeIdOf(index, source)).size
        + (modules.length ? 1 : 0),
      detail: [
        plural(sources.length, 'source'),
        modules.length ? plural(modules.length, 'module') : '',
      ].filter(Boolean).join(' · '),
    }));
  }

  if (index.ungroupedModules.length) {
    entries.push(folderEntry({
      segment: ROOT_SHELVES.skills,
      kind: 'shelf',
      name: 'Skill Tracks',
      icon: 'wrench',
      kindLabel: 'Shelf',
      count: index.ungroupedModules.length,
      detail: 'modules that carry no domain',
    }));
  }

  const packs = store.topicPacks();
  if (packs.length) {
    entries.push(folderEntry({
      segment: ROOT_SHELVES.packs,
      kind: 'shelf',
      name: 'Curated Packs',
      icon: 'notebook-tabs',
      kindLabel: 'Shelf',
      count: packs.length,
      detail: 'hand-ordered, purpose-built',
    }));
  }

  const catalogues = store.catalogues();
  if (catalogues.length) {
    entries.push(folderEntry({
      segment: ROOT_SHELVES.catalogues,
      kind: 'shelf',
      name: 'Catalogues',
      icon: 'library-big',
      kindLabel: 'Shelf',
      count: catalogues.length,
      detail: 'standing shelves across domains',
    }));
  }

  const unregistered = unregisteredMaterial(context);
  if (unregistered.length) {
    entries.push(folderEntry({
      segment: ROOT_SHELVES.unregistered,
      kind: 'shelf',
      name: 'Not in the registry',
      icon: 'hard-drive',
      kindLabel: 'Shelf',
      count: unregistered.length,
      detail: 'on disk, claimed by no source',
    }));
  }

  if (index.unfiled.length) {
    entries.push(folderEntry({
      segment: ROOT_SHELVES.unfiled,
      kind: 'shelf',
      name: 'Unfiled',
      icon: 'file-question',
      kindLabel: 'Shelf',
      count: index.unfiled.length,
      detail: 'no domain recorded yet',
    }));
  }

  return entries;
}

function domainEntries(context: FinderContext, groupId: string): FinderEntry[] {
  const { index } = context;
  const modules = modulesInGroup(index, groupId);
  const entries: FinderEntry[] = [];

  if (modules.length) {
    entries.push(folderEntry({
      segment: 'modules',
      kind: 'bucket',
      name: 'Modules',
      icon: 'graduation-cap',
      kindLabel: 'Folder',
      count: modules.length,
      detail: 'what is taught from this domain',
    }));
  }

  const counts = tally(
    sourcesInGroup(index, groupId),
    (source) => typeIdOf(index, source),
  );
  for (const [type, label, icon] of MATERIAL_TYPES) {
    const count = counts.get(type) ?? 0;
    if (!count) continue;
    entries.push(folderEntry({
      segment: segment('type', type),
      kind: 'bucket',
      name: label,
      icon,
      kindLabel: 'Folder',
      count,
    }));
  }

  return entries;
}

function moduleBucketEntries(
  context: FinderContext,
  moduleId: string,
): FinderEntry[] {
  const { index } = context;
  const counts = tally(
    sourcesInModule(index, moduleId),
    (source) => bucketIdOf(index, source),
  );
  const entries: FinderEntry[] = [];
  for (const [bucket, label, icon] of MODULE_BUCKETS) {
    const count = counts.get(bucket) ?? 0;
    if (!count) continue;
    entries.push(folderEntry({
      segment: segment('bucket', bucket),
      kind: 'bucket',
      name: label,
      icon,
      kindLabel: 'Folder',
      count,
    }));
  }
  return entries;
}

/**
 * Resolves a route path to a folder, one segment at a time.
 *
 * Children are re-derived from the context's index on every call rather than
 * cached across renders, so a rebuilt manifest is visible immediately and a
 * path that no longer exists reports `missing` instead of a stale folder.
 */
export function folderAt(
  context: FinderContext,
  path: readonly string[],
): FinderFolder {
  if (path.length > MAX_DEPTH) return unavailable(path);

  if (!path.length) {
    return folder({
      path,
      name: 'Library',
      icon: 'library',
      kindLabel: 'Library',
      description: 'Everything you possess, one folder per domain. A source may '
        + 'sit in more than one folder — that is one record seen from two '
        + 'domains, not a copy.',
      entries: rootEntries(context),
    });
  }

  const [head = '', ...rest] = path;
  const [prefix, value] = parseSegment(head);

  if (prefix === 'domain') {
    if (!context.index.groupById.has(value)) return unavailable(path);
    return domainFolder(context, value, rest, path);
  }
  if (prefix === 'shelf') return shelfFolder(context, value, rest, path);
  return unavailable(path);
}

function domainFolder(
  context: FinderContext,
  groupId: string,
  rest: readonly string[],
  full: readonly string[],
): FinderFolder {
  const { index } = context;
  const group = index.groupById.get(groupId) ?? null;
  const title = group ? titleOf(group) : groupId;

  if (!rest.length) {
    return folder({
      path: full,
      name: title,
      icon: 'folder-open',
      kindLabel: 'Domain',
      description: projectedText(group?.description) ?? '',
      entries: domainEntries(context, groupId),
    });
  }

  const [head = '', ...tail] = rest;
  const [prefix, value] = parseSegment(head);

  if (head === 'modules') {
    if (!tail.length) {
      return folder({
        path: full,
        name: 'Modules',
        icon: 'graduation-cap',
        kindLabel: 'Folder',
        description: `What ${title} is taught as. Each module holds only the `
          + 'sources actually routed to it.',
        entries: modulesInGroup(index, groupId)
          .map((module) => moduleEntry(context, module)),
      });
    }
    return moduleFolder(context, tail, full);
  }

  if (prefix === 'type') {
    const definition = MATERIAL_TYPE_BY_ID.get(value);
    if (!definition) return unavailable(full);
    if (!tail.length) {
      return folder({
        path: full,
        name: definition.label,
        icon: definition.icon,
        kindLabel: 'Folder',
        description: `${definition.label} in ${title}.`,
        entries: sourcesInGroup(index, groupId)
          .filter((source) => typeIdOf(index, source) === value)
          .map((source) => sourceEntry(context, source)),
      });
    }
    return sourceFolder(context, tail, full);
  }

  return unavailable(full);
}

function moduleFolder(
  context: FinderContext,
  rest: readonly string[],
  full: readonly string[],
): FinderFolder {
  const { index, store } = context;
  const [head = '', ...tail] = rest;
  const [prefix, moduleId] = parseSegment(head);
  if (prefix !== 'module') return unavailable(full);
  const module = store.get(moduleId);
  if (module?.type !== 'module') return unavailable(full);

  if (!tail.length) {
    return folder({
      path: full,
      name: titleOf(module),
      icon: 'book-open',
      kindLabel: 'Module',
      description: 'Its own material, split the way a semester is: slides, '
        + 'exams, exercises, then everything it reads from.',
      entries: moduleBucketEntries(context, moduleId),
    });
  }

  const [next = '', ...deeper] = tail;
  const [nextPrefix, bucket] = parseSegment(next);
  if (nextPrefix !== 'bucket') return unavailable(full);
  const definition = MODULE_BUCKET_BY_ID.get(bucket);
  if (!definition) return unavailable(full);

  if (!deeper.length) {
    return folder({
      path: full,
      name: definition.label,
      icon: definition.icon,
      kindLabel: 'Folder',
      description: `${definition.label} for ${titleOf(module)}.`,
      entries: sourcesInModule(index, moduleId)
        .filter((source) => bucketIdOf(index, source) === bucket)
        .map((source) => sourceEntry(context, source)),
    });
  }

  return sourceFolder(context, deeper, full);
}

function shelfFolder(
  context: FinderContext,
  shelf: string,
  rest: readonly string[],
  full: readonly string[],
): FinderFolder {
  const { index, store } = context;

  if (shelf === 'skills') {
    if (!rest.length) {
      return folder({
        path: full,
        name: 'Skill Tracks',
        icon: 'wrench',
        kindLabel: 'Shelf',
        description: 'Modules with no thematic group of their own. They are here '
          + 'rather than guessed into a domain; their sources still appear under '
          + 'every domain they are registered in.',
        entries: index.ungroupedModules
          .map((module) => moduleEntry(context, module)),
      });
    }
    return moduleFolder(context, rest, full);
  }

  if (shelf === 'unfiled') {
    if (!rest.length) {
      return folder({
        path: full,
        name: 'Unfiled',
        icon: 'file-question',
        kindLabel: 'Shelf',
        description: 'Sources with no thematic group recorded. Nothing is lost '
          + 'here — this folder is what lets the tree hold everything, and it '
          + 'empties as domains are recorded.',
        entries: index.unfiled.map((source) => sourceEntry(context, source)),
      });
    }
    return sourceFolder(context, rest, full);
  }

  if (shelf === 'unregistered') {
    if (!rest.length) {
      return folder({
        path: full,
        name: 'Not in the registry',
        icon: 'hard-drive',
        kindLabel: 'Shelf',
        description: 'Files sitting beside registered material that no source '
          + 'record claims — most often a sibling folder, such as the exercise '
          + 'slides next to a lecture deck. They are browsable here so nothing '
          + 'on disk is invisible, but they carry no evaluation, no domain and '
          + 'no module until a source is recorded for them, which is a change '
          + 'only the core can make.',
        entries: unregisteredMaterial(context),
      });
    }
    // Below the shelf this is an ordinary walk of the physical tree.
    const [lastPrefix, path] = parseSegment(rest[rest.length - 1] ?? '');
    if (lastPrefix !== 'at' || !context.materials.isDirectory(path)) {
      return unavailable(full);
    }
    return folder({
      path: full,
      name: path.split('/').pop() || path,
      icon: 'folder-open',
      kindLabel: 'Folder',
      entries: context.materials.list(path).map(materialEntry),
    });
  }

  if (shelf !== 'packs' && shelf !== 'catalogues') return unavailable(full);

  const isPacks = shelf === 'packs';
  const prefix = isPacks ? 'pack' : 'catalogue';
  const iconName = isPacks ? 'notebook-tabs' : 'library-big';

  if (!rest.length) {
    const shelves = (isPacks ? store.topicPacks() : store.catalogues())
      .slice().sort(byTitle);
    return folder({
      path: full,
      name: isPacks ? 'Curated Packs' : 'Catalogues',
      icon: iconName,
      kindLabel: 'Shelf',
      description: isPacks
        ? 'Narrow, manually ordered collections. The order is the argument.'
        : 'Standing shelves that cut across domains.',
      entries: shelves.map((record) => folderEntry({
        segment: segment(prefix, projectedString(record.id) ?? ''),
        kind: 'bucket',
        name: titleOf(record),
        icon: iconName,
        kindLabel: isPacks ? 'Pack' : 'Catalogue',
        count: shelfSources(store, record).length,
        detail: projectedText(record.purpose) ?? '',
      })),
    });
  }

  const [head = '', ...tail] = rest;
  const [headPrefix, id] = parseSegment(head);
  if (headPrefix !== prefix) return unavailable(full);
  const record = store.get(id);
  if (!record) return unavailable(full);

  if (!tail.length) {
    return folder({
      path: full,
      name: titleOf(record),
      icon: iconName,
      kindLabel: isPacks ? 'Pack' : 'Catalogue',
      description: projectedText(record.purpose) ?? '',
      entries: shelfSources(store, record)
        .map((source) => sourceEntry(context, source)),
    });
  }

  return sourceFolder(context, tail, full);
}

/**
 * A source folder, and everything below it.
 *
 * The first segment names the source; each further `at:` segment is one step
 * into its real material directory. Only the LAST segment is resolved, because
 * it already carries the whole `materials/…` path — so a folder six levels down
 * costs one containment check rather than six.
 */
function sourceFolder(
  context: FinderContext,
  rest: readonly string[],
  full: readonly string[],
): FinderFolder {
  const { store, materials } = context;
  const [head = '', ...tail] = rest;
  const [prefix, sourceId] = parseSegment(head);
  if (prefix !== 'source') return unavailable(full);
  const source = store.get(sourceId);
  if (source?.type !== 'source') return unavailable(full);

  if (!tail.length) {
    const materialPath = projectedString(source.material_path);
    if (!materialPath || source.material_exists !== true
      || !materials.isDirectory(materialPath)) {
      return unavailable(full);
    }
    return folder({
      path: full,
      name: titleOf(source),
      icon: 'folder-open',
      kindLabel: 'Local collection',
      description: authorLine(source),
      entries: materials.list(materialPath).map(materialEntry),
      sourceId,
    });
  }

  const [lastPrefix, path] = parseSegment(tail[tail.length - 1] ?? '');
  if (lastPrefix !== 'at' || !materials.isDirectory(path)) return unavailable(full);
  return folder({
    path: full,
    name: path.split('/').pop() || path,
    icon: 'folder-open',
    kindLabel: 'Folder',
    entries: materials.list(path).map(materialEntry),
    sourceId,
  });
}

// ---------------------------------------------------------------- the invariant

/**
 * Every source id the folder tree can actually reach, by walking it.
 *
 * Deliberately a traversal and not a restatement of the filing rules: a check
 * that recomputed "which domain is this source in" would agree with `folderAt`
 * by construction and would therefore prove nothing. Walking the real folders
 * means a source that becomes unreachable — a type bucket that stops being
 * total, a shelf that drops an entry, a domain missing from the group list —
 * shows up as a missing id.
 *
 * Material directories are not descended into: files are not sources, and the
 * invariant under test is registry coverage.
 */
export function reachableSourceIds(context: FinderContext): Set<string> {
  const reached = new Set<string>();
  const visited = new Set<string>();

  const walk = (path: readonly string[], depth: number): void => {
    if (depth > MAX_DEPTH) return;
    const key = path.join('/');
    if (visited.has(key)) return;
    visited.add(key);
    for (const entry of folderAt(context, path).entries) {
      if (entry.sourceId) reached.add(entry.sourceId);
      if (!entry.isFolder) continue;
      if (entry.kind === 'source' || entry.kind === 'directory') continue;
      walk([...path, entry.segment], depth + 1);
    }
  };

  walk([], 0);
  return reached;
}

/** How many sources the projection holds, for the coverage line. */
export function totalSourceCount(context: FinderContext): number {
  return context.index.sourceCount;
}

/** The breadcrumb trail for a path: one folder per ancestor, root first. */
export function trailFor(
  context: FinderContext,
  path: readonly string[],
): FinderFolder[] {
  const trail: FinderFolder[] = [];
  for (let depth = 0; depth <= path.length; depth += 1) {
    trail.push(folderAt(context, path.slice(0, depth)));
  }
  return trail;
}
