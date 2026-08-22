import { button, chip, empty, icon, overflowMenu, section } from '../components';
import type { ProjectionRecord } from '../contracts/manifest';
import {
  asText as projectedText,
} from '../projection/readers';

/** Shared study-map resource shape. Job plans use this exact view contract. */
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
  readonly openSource?: (source: ProjectionRecord) => unknown;
  readonly openSourceResource?: (source: ProjectionRecord) => unknown;
  readonly rateResource?: (
    sourceId: string,
    resourceId: string | null,
    verdict: string,
  ) => unknown;
  readonly emptyTitle?: string;
  readonly emptyDetail?: string;
}

const TRIAGE_ORDER = [
  'required-now',
  'helpful-now',
  'deferred',
  'reference-only',
] as const;

const TRIAGE_HEADING: Readonly<Record<string, string>> = {
  'required-now': 'Do this',
  'helpful-now': 'If you get stuck',
  deferred: 'Depth — not now',
  'reference-only': 'Reference — preserved, not reading for this stage',
};

const MATERIAL_TYPE_ORDER = [
  'video',
  'article',
  'book',
  'exercise',
] as const;

type MaterialType = typeof MATERIAL_TYPE_ORDER[number];

const MATERIAL_TYPE_HEADING: Readonly<Record<MaterialType, string>> = {
  video: 'Videos',
  article: 'Articles',
  book: 'Books',
  exercise: 'Exercises',
};

const MATERIAL_TYPE_ICON: Readonly<Record<MaterialType, string>> = {
  video: 'play',
  article: 'file-text',
  book: 'book-open',
  exercise: 'pencil-line',
};

function rankOf(value: string | null): number {
  const index = value ? TRIAGE_ORDER.indexOf(value as typeof TRIAGE_ORDER[number]) : -1;
  return index < 0 ? 0 : index;
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

  if (
    declared === 'exercise'
    || declared === 'practice'
    || declared === 'practise'
    || declared === 'problem-set'
    || declared === 'homework'
    || declared === 'quiz'
  ) return 'exercise';
  if (declared === 'video') return 'video';
  if (declared === 'book' || declared === 'textbook') return 'book';

  // Papers, websites, documentation, lecture notes, and untyped readings are
  // all scan-friendly reading material. Source metadata can still name the
  // more precise medium inside the row without fragmenting the catalogue.
  return 'article';
}

function hasOpenTarget(record: ProjectionRecord): boolean {
  return [record.material_path, record.url, record.vault_path].some(
    (value) => typeof value === 'string' && value.trim().length > 0,
  );
}

export function renderStageResources(
  parent: HTMLElement,
  resourcesValue: readonly StageResourceView[],
  renderer: StageResourceRenderer,
): HTMLElement {
  const resources = section(parent, 'Material catalogue');
  resources.addClass(
    'los-stage-resources',
  );

  resources.createSpan({
    cls:
      'los-micro los-stage-resource-count',
    text:
      `${resourcesValue.length} ${resourcesValue.length === 1 ? 'material' : 'materials'}`,
  });

  resources.createEl('p', {
    cls: 'los-stage-resource-summary',
    text:
      'Every material stays visible, grouped by type. Priority changes the order inside each group; each angle explains what the material covers.',
  });

  if (!resourcesValue.length) {
    empty(
      resources,
      renderer.emptyTitle || 'No source action selected',
      renderer.emptyDetail || 'Add a focused source or practice action to this stage.',
    );
    return resources;
  }

  const grouped = new Map<
    MaterialType,
    Array<{
      readonly resource: StageResourceView;
      readonly source: ProjectionRecord | null;
    }>
  >();

  for (const resource of resourcesValue) {
    const source = resource.sourceId && renderer.sourceRecord
      ? renderer.sourceRecord(resource.sourceId)
      : null;
    const materialType = materialTypeOf(resource, source);
    const entries = grouped.get(materialType);
    const entry = { resource, source };
    if (entries) entries.push(entry);
    else grouped.set(materialType, [entry]);
  }

  for (const materialType of MATERIAL_TYPE_ORDER) {
    const entries = grouped.get(materialType);
    if (!entries?.length) continue;

    // Unranked pre-v2 records stay with the primary work. Missing priority
    // means "not yet ranked", never "deprioritised".
    entries.sort(
      (left, right) =>
        rankOf(left.resource.scopeTriage)
        - rankOf(right.resource.scopeTriage),
    );

    const group = resources.createDiv({
      cls: `los-resource-type-group los-resource-type-${materialType}`,
    });
    group.setAttr('aria-label', MATERIAL_TYPE_HEADING[materialType]);

    const groupHeading = group.createDiv({
      cls: 'los-resource-type-heading',
    });
    const headingCopy = groupHeading.createDiv({
      cls: 'los-resource-type-heading-copy',
    });
    icon(headingCopy.createSpan(), MATERIAL_TYPE_ICON[materialType]);
    headingCopy.createEl('h3', {
      text: MATERIAL_TYPE_HEADING[materialType],
    });
    groupHeading.createSpan({
      cls: 'los-micro',
      text: `${entries.length} ${entries.length === 1 ? 'material' : 'materials'}`,
    });

    for (const { resource, source } of entries) {
      const row = group.createDiv({
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
        text: resource.scopeTriage
          ? TRIAGE_HEADING[resource.scopeTriage] || resource.scopeTriage
          : 'Primary · unranked',
      });
      if (resource.locator) {
        metadata.createSpan({
          cls: 'los-micro los-resource-locator',
          text: resource.locator,
        });
      }

      const angle = projectedText(
        resource.record.angle,
      );

      if (angle) {
        copy.createDiv({
          cls: 'los-resource-angle',
          text: angle,
        });
      }

      if (source) chip(copy, source, renderer.openSource);

      const actions = row.createDiv({ cls: 'los-actions los-resource-actions' });
      if (resource.canOpen && renderer.openResource) {
        button(actions, 'Open', () => renderer.openResource?.(resource), 'quiet');
      } else if (source && hasOpenTarget(source) && renderer.openSourceResource) {
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
    }
  }
  return resources;
}
