import { button, chip, empty, icon, overflowMenu, section } from '../components';
import type { ProjectionRecord } from '../contracts/manifest';
import {
  asText as projectedText,
  isRecord,
} from '../projection/readers';
import { hasDirectResourceTarget } from '../infrastructure/resource-target';

/** Shared study-map resource shape for every learning module. */
export interface StageResourceView {
  readonly record: ProjectionRecord;
  readonly id: string | null;
  readonly kind: string;
  readonly label: string;
  readonly locator: string | null;
  readonly sourceId: string | null;
  readonly scopeTriage: string | null;
  readonly canOpen: boolean;
}

export interface StageResourceRenderer {
  readonly openResource?: (resource: StageResourceView) => unknown;
  readonly sourceRecord?: (sourceId: string) => ProjectionRecord | null;
  readonly routeRecord?: (routeId: string) => ProjectionRecord | null;
  readonly openSource?: (source: ProjectionRecord) => unknown;
  readonly openSourceResource?: (source: ProjectionRecord) => unknown;
  readonly rateResource?: (
    sourceId: string,
    resourceId: string | null,
    verdict: string,
  ) => unknown;
  readonly emptyTitle?: string;
  readonly emptyDetail?: string;
  /**
   * Heading over the resource list. The unit surface passes "Exact work" after
   * Figma 14:582 — the name WORKFLOWS.md step 8 already uses for the same
   * thing. Other compact surfaces may keep the catalogue wording, so this is an option.
   */
  readonly title?: string;
}

export const TRIAGE_ORDER = [
  'required-now',
  'helpful-now',
  'deferred',
  'reference-only',
] as const;

export type TriageRank = typeof TRIAGE_ORDER[number];

function isTriageRank(value: string | null): value is TriageRank {
  return Boolean(value) && (TRIAGE_ORDER as readonly string[]).includes(value as string);
}

export const TRIAGE_HEADING: Readonly<Record<TriageRank, string>> = {
  'required-now': 'Do this',
  'helpful-now': 'If you get stuck',
  deferred: 'Depth — not now',
  'reference-only': 'Reference — preserved, not reading for this stage',
};

/**
 * The one-line account of everything this stage points at, in the learner's
 * words rather than the schema's: "2 required now · 7 if stuck · 2 for
 * reference" (Figma B1) — the same three groups "Compare all" opens on.
 *
 * Every count is derived from the triage the producer authored. None of it is
 * a quota, and nothing is ever dropped from the total — the summary exists so
 * that collapsing the list cannot hide a source (Figma 05, non-negotiable 1).
 */
export function triageSummary(
  resources: readonly StageResourceView[],
): string {
  const count = (rank: string) => resources.filter(
    (resource) => resource.scopeTriage === rank,
  ).length;

  const required = count('required-now')
    + resources.filter((resource) => !resource.scopeTriage).length;
  const stuck = count('helpful-now');
  const preserved = count('deferred') + count('reference-only');

  const parts: string[] = [];
  if (required) parts.push(`${required} required now`);
  if (stuck) parts.push(`${stuck} if stuck`);
  if (preserved) parts.push(`${preserved} for reference`);
  return parts.join(' · ');
}

/**
 * The single resource the stage is asking for right now, or null.
 *
 * "Required now" first; an unranked pre-v2 row counts as primary, never as
 * deprioritised, which is the same rule the ordering already follows. When a
 * stage names several required resources there is no basis for preferring one,
 * so the first in authored order is used and the rest stay one click away.
 */
export function currentWorkResource(
  resources: readonly StageResourceView[],
): StageResourceView | null {
  return resources.find(
    (resource) => resource.scopeTriage === 'required-now',
  ) ?? resources.find(
    (resource) => !resource.scopeTriage,
  ) ?? null;
}

const MATERIAL_TYPE_ORDER = [
  'course-material',
  'exercise',
  'solutions',
  'exam',
  'book',
  'paper',
  'video',
  'website',
  'documentation',
  'code',
  'course',
  'article',
] as const;

type MaterialType = typeof MATERIAL_TYPE_ORDER[number];

/**
 * Every value must be a key of the Lucide registry Obsidian bundles — 1,995
 * icons in 1.13.7. `setIcon` renders NOTHING for a name it does not know: no
 * error, no fallback, just a blank gap, so a wrong name here fails silently.
 *
 * To re-verify after an Obsidian upgrade, read the registry itself — it is a
 * name-to-path map, hyphenated keys quoted:
 *
 *   strings ~/Library/Application\ Support/obsidian/obsidian-*.asar \
 *     | grep -oE '"?[a-z][a-z0-9-]{1,40}"?:\[\[' \
 *     | sed -E 's/:\[\[$//; s/"//g' | sort -u
 *
 * Do NOT grep for `lucide-<name>`: that matches only the CSS-class spellings
 * that happen to appear elsewhere in the bundle — a 235-name subset which
 * omits names that demonstrably render, and which produced a confident, wrong
 * verdict that these icons were broken.
 */
const MATERIAL_TYPE_ICON: Readonly<Record<MaterialType, string>> = {
  'course-material': 'presentation',
  exercise: 'pencil-line',
  solutions: 'clipboard-check',
  exam: 'graduation-cap',
  book: 'book-open',
  paper: 'newspaper',
  video: 'play',
  website: 'globe',
  documentation: 'file-text',
  code: 'code',
  course: 'library',
  article: 'file-text',
};

/**
 * The schema `format` value (or a working kind's fallback) mapped to one
 * precise material type. Every type keeps its own icon so the glyph answers
 * "what kind of thing is this" before a word is read.
 */
function normaliseMaterialType(declared: string): MaterialType {
  switch (declared) {
    case 'course-material': return 'course-material';
    case 'exercise':
    case 'practice':
    case 'practise':
    case 'problem-set':
    case 'homework':
    case 'quiz': return 'exercise';
    case 'solutions': return 'solutions';
    case 'exam': return 'exam';
    case 'book':
    case 'textbook': return 'book';
    case 'paper': return 'paper';
    case 'video': return 'video';
    case 'website':
    case 'web':
    case 'web-page':
    case 'webpage': return 'website';
    case 'documentation':
    case 'docs': return 'documentation';
    case 'code': return 'code';
    case 'course': return 'course';
    default: return 'article';
  }
}

/** The row icon for a media type, so other surfaces render the same card. */
export function materialTypeIcon(type: string): string {
  return MATERIAL_TYPE_ICON[normaliseMaterialType((type ?? '').toLowerCase())];
}

let angleDetailSequence = 0;

/**
 * The "Why this one" disclosure: the long authored rationale, hidden until
 * asked for.
 *
 * It lives here rather than in each surface because every place that shows a
 * material owes the learner the same gesture. Duplicating it produced the
 * defect this replaced — one surface expanded the detail inline and another
 * wrapped an already-expanded card in a second disclosure, so the same
 * sentence arrived twice at two different depths.
 *
 * `fillFoot` runs before the toggle so a caller's chips sit left of it.
 */
export function whyThisOne(
  copy: HTMLElement,
  detailText: string,
  fillFoot?: (foot: HTMLElement) => void,
): void {
  const detailId = `los-resource-angle-detail-${++angleDetailSequence}`;
  const detail = copy.createDiv({
    cls: 'los-resource-angle-detail',
    text: detailText,
    attr: { hidden: '', id: detailId },
  });
  const foot = copy.createDiv({ cls: 'los-resource-foot' });
  fillFoot?.(foot);

  let expanded = false;
  const toggle = button(
    foot,
    '▸ Why this one',
    () => {
      expanded = !expanded;
      toggle.setText(`${expanded ? '▾' : '▸'} Why this one`);
      toggle.setAttr('aria-expanded', String(expanded));
      if (expanded) detail.removeAttribute('hidden');
      else detail.setAttr('hidden', '');
    },
    'quiet',
  );
  toggle.addClass('los-resource-angle-trigger');
  toggle.setAttrs({ 'aria-controls': detailId, 'aria-expanded': 'false' });
}

function materialTypeOf(
  resource: StageResourceView,
  source: ProjectionRecord | null,
): MaterialType {
  if (resource.kind === 'practise') return 'exercise';
  if (resource.kind === 'watch') return 'video';

  const declared = (
    projectedText(resource.record.format)
    ?? projectedText(resource.record.material_type)
    ?? projectedText(source?.source_type)
    ?? projectedText(source?.format)
    ?? ''
  ).toLowerCase();

  return normaliseMaterialType(declared);
}

export interface ResourceRowExtras {
  /** Extra context chips after the locator, e.g. the owning lecture. */
  readonly badges?: readonly string[];
  /**
   * Drop the source chip. The material browser groups BY source, so repeating
   * it on every row inside that group is noise, not provenance — while the
   * source record itself is still needed for the "Open source" fallback.
   */
  readonly hideSourceChip?: boolean;
  /**
   * Carry the source chip in the meta row (urgency · source · locator).
   * Used where no group heading names the source — the purpose-first browser
   * — so provenance stays on the card without a second disclosure.
   */
  readonly sourceInMeta?: boolean;
}

/** Material-owned cautions remain visible before opening a task or its answers. */
export function renderMaterialCautions(parent: HTMLElement, record: ProjectionRecord): void {
  for (const asset of Array.isArray(record.requires_assets) ? record.requires_assets : []) {
    if (!isRecord(asset) || typeof asset.name !== 'string') continue;
    const part = projectedText(asset.needed_for);
    const origin = projectedText(asset.obtain_from);
    parent.createDiv({ cls: 'los-micro', text:
      `${asset.material_uri ? 'Required file' : 'Not registered locally'}: ${asset.name}`
      + (part ? ` — needed for ${part}` : '') + (origin ? `. Obtain from ${origin}.` : '.') });
  }
  if (Array.isArray(record.exposes_solutions_for) && record.exposes_solutions_for.length) {
    parent.createDiv({ cls: 'los-micro', text:
      'Contains related task solutions. Read after your attempt, and report prior exposure before using those tasks as independent evidence.' });
  }
}

export function renderResourceRow(
  parent: HTMLElement,
  resource: StageResourceView,
  source: ProjectionRecord | null,
  renderer: StageResourceRenderer,
  extras: ResourceRowExtras = {},
): HTMLElement {
  const materialType = materialTypeOf(resource, source);
  const row = parent.createDiv({
    cls: `los-resource-row los-triage-${resource.scopeTriage || 'unranked'}`,
  });
  icon(row.createSpan(), MATERIAL_TYPE_ICON[materialType]);

  const copy = row.createDiv({ cls: 'los-resource-copy' });
  copy.createEl('strong', { text: resource.label });

  const metadata = copy.createDiv({
    cls: 'los-resource-row-meta',
  });
  metadata.createSpan({
    cls: `los-resource-priority los-resource-priority-${resource.scopeTriage || 'unranked'}`,
    text: isTriageRank(resource.scopeTriage)
      ? TRIAGE_HEADING[resource.scopeTriage]
      : resource.scopeTriage || 'Primary · unranked',
  });
  if (extras.sourceInMeta && source && !extras.hideSourceChip) {
    chip(metadata, source, renderer.openSource);
  }
  if (resource.locator) {
    metadata.createSpan({
      cls: 'los-micro los-resource-locator',
      text: resource.locator,
    });
  }
  for (const badge of extras.badges ?? []) {
    metadata.createSpan({ cls: 'los-micro los-resource-badge', text: badge });
  }

  const angle = projectedText(resource.record.angle);
  if (angle) {
    copy.createDiv({
      cls: 'los-resource-angle',
      text: angle,
    });
  }
  const routeId = projectedText(resource.record.route_id);
  renderMaterialCautions(copy, (routeId ? renderer.routeRecord?.(routeId) : null) ?? resource.record);

  const showChip = source && !extras.hideSourceChip && !extras.sourceInMeta ? source : null;
  const angleDetail = projectedText(resource.record.angle_detail);
  if (angleDetail) {
    whyThisOne(copy, angleDetail, (foot) => {
      if (showChip) chip(foot, showChip, renderer.openSource);
    });
  } else if (showChip) {
    chip(copy, showChip, renderer.openSource);
  }

  const actions = row.createDiv({ cls: 'los-actions los-resource-actions' });
  if (resource.canOpen && renderer.openResource) {
    button(actions, 'Open', () => renderer.openResource?.(resource), 'quiet');
  } else if (
    source
    && hasDirectResourceTarget(source)
    && renderer.openSourceResource
  ) {
    button(
      actions,
      'Open source',
      () => renderer.openSourceResource?.(source),
      'quiet',
    );
  }
  if (resource.sourceId && renderer.rateResource) {
    const sourceId = resource.sourceId;
    const resourceId = resource.id;
    const rate = (verdict: string) => renderer.rateResource?.(
      sourceId,
      resourceId,
      verdict,
    );
    overflowMenu(actions, [
      ['Helpful', () => rate('helpful')],
      ['Too advanced', () => rate('too-advanced')],
      ['Useful for review', () => rate('useful-for-review')],
    ], resourceId
      ? `Rate ${resource.label}`
      : `Rate ${resource.label} (whole source)`);
  }
  return row;
}

/**
 * The complete stage menu, grouped by triage.
 *
 * Grouping used to be by media type, with triage sorted only *inside* each
 * group — so a required reading and a reference book sat at the same weight
 * two rows apart, and the learner had to reconstruct the priority the producer
 * had already authored. Triage is the axis the decision actually turns on, so
 * it is the axis the list is cut along; the media type survives as the row
 * icon, which is what it was really doing.
 *
 * Nothing is filtered. Collapsing the list on the stage screen is a disclosure
 * choice, and this is where the whole of it stays reachable and countable.
 */
export function renderStageResources(
  parent: HTMLElement,
  resourcesValue: readonly StageResourceView[],
  renderer: StageResourceRenderer,
): HTMLElement {
  const resources = section(parent, renderer.title ?? 'Material catalogue');
  resources.addClass('los-stage-resources');

  resources.createSpan({
    cls: 'los-micro los-stage-resource-count',
    text:
      `${resourcesValue.length} ${resourcesValue.length === 1 ? 'material' : 'materials'}`,
  });

  resources.createEl('p', {
    cls: 'los-stage-resource-summary',
    text:
      'Every material stays visible, grouped by what this stage asks of it. '
      + 'The angle explains what each one covers; nothing here is ranked by quality.',
  });

  if (!resourcesValue.length) {
    empty(
      resources,
      renderer.emptyTitle || 'No source action selected',
      renderer.emptyDetail || 'Add a focused source or practice action to this stage.',
    );
    return resources;
  }

  const sourceFor = (resource: StageResourceView) => (
    resource.sourceId && renderer.sourceRecord
      ? renderer.sourceRecord(resource.sourceId)
      : null
  );

  // Unranked pre-v2 records stay with the primary work. Missing priority means
  // "not yet ranked", never "deprioritised".
  const buckets = new Map<string, StageResourceView[]>();
  for (const resource of resourcesValue) {
    const key: TriageRank = isTriageRank(resource.scopeTriage)
      ? resource.scopeTriage
      : 'required-now';
    const bucket = buckets.get(key);
    if (bucket) bucket.push(resource);
    else buckets.set(key, [resource]);
  }

  for (const rank of TRIAGE_ORDER) {
    const entries = buckets.get(rank);
    if (!entries?.length) continue;

    const group = resources.createDiv({
      cls: `los-resource-triage-group los-resource-triage-${rank}`,
    });
    group.setAttr('aria-label', TRIAGE_HEADING[rank]);

    const groupHeading = group.createDiv({
      cls: 'los-resource-type-heading',
    });
    const headingCopy = groupHeading.createDiv({
      cls: 'los-resource-type-heading-copy',
    });
    headingCopy.createEl('h3', { text: TRIAGE_HEADING[rank] });
    groupHeading.createSpan({
      cls: 'los-micro',
      text: `${entries.length} ${entries.length === 1 ? 'material' : 'materials'}`,
    });

    for (const resource of entries) {
      renderResourceRow(group, resource, sourceFor(resource), renderer);
    }
  }
  return resources;
}
