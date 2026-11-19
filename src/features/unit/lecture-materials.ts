/**
 * Pure material-presentation helpers shared across interface designs:
 * building a lecture's deduplicated material list, splitting one stage's
 * triage buckets, formatting readable locators/stages, and resolving open targets.
 */
import { plural } from '../../components';
import { hasDirectResourceTarget } from '../../infrastructure/resource-target';
import { asLabel, asRecords, asString } from '../../projection/readers';
import { safeWebUrl } from '../../security/safe-url';
import type { ManifestStore } from '../../manifest-store';
import { moduleShort } from '../module/labels';
import {
  placementAvailability,
  projectedAvailability,
  routeForResource,
  type Availability,
} from './material-card';
import {
  buildLectureMaterials,
  lectureLayout,
  rankMaterials,
  stageRuns,
  type LectureMaterial,
  type StageUse,
} from './material-purpose';
import type { MaterialOptionView, StageRecordView, StudyMapView, UnitPlugin, UnitRecordView } from './model';

export interface StageSplit {
  /** The stage's place in the durable plan, or -1 when it is not there. */
  readonly index: number;
  readonly required: readonly LectureMaterial[];
  readonly helps: readonly LectureMaterial[];
  /** Deferred and kept for reference: nothing this stage asks you to read now. */
  readonly kept: readonly LectureMaterial[];
}

/** Build every material of one lecture, ordered and role-tagged from the projection. */
export function lectureMaterialsFor(
  store: ManifestStore,
  unit: UnitRecordView,
  durable: StudyMapView,
  options: readonly MaterialOptionView[],
): LectureMaterial[] {
  const roles = new Map<string, string | null>();
  for (const entry of asRecords(store.sourceMap(unit.moduleId)?.sources)) {
    const id = asString(entry.source_id);
    if (id && !roles.has(id)) roles.set(id, asString(entry.role));
  }
  return buildLectureMaterials({
    stages: durable.stages,
    options,
    routeOf: (resource) => routeForResource(resource, options),
    roleOf: (id) => roles.get(id) ?? null,
    sourceTypeOf: (id) => asString(store.get(id)?.source_type),
  });
}

/** One-line facts summary for a lecture's full material collection. */
export function lectureMaterialsFacts(materials: readonly LectureMaterial[], stages: number): string {
  const course = materials.filter((material) => material.course).length;
  const layout = lectureLayout(materials.length);
  return [
    `${plural(materials.length, 'material')} for ${plural(stages, 'stage')}`,
    course ? `${course} from your course` : '',
    layout === 'flat' ? 'best first' : 'grouped by what they are for, then type, best first',
  ].filter(Boolean).join(' · ');
}

/** Split a stage's materials by triage bucket, ranked best-first within each. */
export function splitStage(
  materials: readonly LectureMaterial[],
  durable: StudyMapView,
  stage: StageRecordView,
): StageSplit {
  const index = durable.stages.findIndex((row) => row.id === stage.id);
  const where = (...uses: StageUse[]) => (index < 0 ? []
    : rankMaterials(materials.filter((material) => uses.includes(material.uses[index] ?? null)), index));
  return { index, required: where('required'), helps: where('helps'), kept: where('deferred', 'reference') };
}

/** Format a compact title list such as "A and B" or "A, B and 2 more". */
export function namesOf(materials: readonly LectureMaterial[]): string {
  const titles = materials.map((material) => material.title);
  if (titles.length <= 2) return titles.join(' and ');
  return `${titles.slice(0, 2).join(', ')} and ${titles.length - 2} more`;
}

export function shortTitle(title: string): string {
  const cut = title.split(/\s+[—–]\s+|:\s+|\s+\(/)[0]?.trim();
  return cut || title;
}

const FILE_NAME = /\.(?:pdf|tex|md|html?|ipynb|py|txt|epub|djvu|zip)(?=$|[\s,;:)])/i;

export function shortLocator(locator: string | null): string | null {
  const text = locator?.trim();
  if (!text) return null;
  const match = FILE_NAME.exec(text);
  if (!match) return text;
  const rest = text.slice(match.index + match[0].length).replace(/^[\s,;:)]+/, '').trim();
  if (rest && !/^(?:and|&|\+)\s/i.test(rest)) return rest;
  if (rest) return text;
  return text.slice(0, match.index).split('/').pop()?.trim() || text;
}

export function whereLabel(availability: Availability): string {
  switch (availability.kind) {
    case 'local': return 'On this Mac';
    case 'remote': return 'Web';
    case 'local-missing': return 'Copy missing';
    default: return 'No copy or link';
  }
}

const USE_WORDS: Readonly<Record<Exclude<StageUse, null>, string>> = {
  required: 'required in',
  helps: 'helps in',
  deferred: 'deferred in',
  reference: 'kept for reference in',
};

/** Describe stage usage bits in readable words for summaries and screen readers. */
export function usedInWords(uses: readonly StageUse[]): string {
  const parts = (Object.keys(USE_WORDS) as Exclude<StageUse, null>[]).flatMap((kind) => {
    const only = uses.map((use) => (use === kind ? use : null));
    if (!only.some(Boolean)) return [];
    return [`${USE_WORDS[kind]} ${stageRuns(only).replace(/^Stages? /, (word) => word.toLowerCase())}`];
  });
  if (!parts.length) return 'Not used in any stage yet';
  const text = parts.join(' · ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function materialAvailability(store: ManifestStore, material: LectureMaterial): Availability {
  const source = material.sourceId ? store.get(material.sourceId) : null;
  if (material.resource) return placementAvailability(material.resource, material.route, source);
  const projected = projectedAvailability(material.route?.record ?? {});
  return projected.kind === 'none' && source && hasDirectResourceTarget(source) ? projectedAvailability(source) : projected;
}

/** Resolve how to open a material using the shared consumer contract order. */
export function materialOpener(
  plugin: Pick<UnitPlugin, 'store' | 'openResource'>,
  material: LectureMaterial,
): { readonly label: string; readonly go: () => unknown } | null {
  const { resource, route } = material;
  const web = materialAvailability(plugin.store, material).kind === 'remote';
  if (resource?.canOpen) return { label: web ? 'Open on the web' : 'Open', go: () => plugin.openResource(resource.record) };
  if (route?.canOpen) return { label: web ? 'Open on the web' : 'Open', go: () => plugin.openResource(route.record) };
  const source = material.sourceId ? plugin.store.get(material.sourceId) : null;
  if (source && hasDirectResourceTarget(source)) return { label: 'Open the source', go: () => plugin.openResource(source) };
  return null;
}

export function materialOrigin(
  store: ManifestStore,
  moduleId: string,
  material: LectureMaterial,
): string | null {
  if (material.course) return moduleShort(store.get(moduleId));
  const source = material.sourceId ? store.get(material.sourceId) : null;
  if (source) return shortTitle(asLabel(source));
  const url = safeWebUrl(material.resource?.record.url ?? material.route?.record.url);
  return url ? url.hostname.replace(/^www\./, '') : null;
}
