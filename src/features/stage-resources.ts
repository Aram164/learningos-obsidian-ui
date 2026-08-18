import { button, chip, empty, icon, overflowMenu, section } from '../components';
import type { ProjectionRecord } from '../contracts/manifest-v5';

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

function rankOf(value: string | null): number {
  const index = value ? TRIAGE_ORDER.indexOf(value as typeof TRIAGE_ORDER[number]) : -1;
  return index < 0 ? 0 : index;
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
  const resources = section(parent, 'Exact work');
  if (!resourcesValue.length) {
    empty(
      resources,
      renderer.emptyTitle || 'No source action selected',
      renderer.emptyDetail || 'Add a focused source or practice action to this stage.',
    );
    return resources;
  }

  // Unranked pre-v2 records stay with the primary work. Missing priority means
  // "not yet ranked", never "deprioritised".
  const ordered = [...resourcesValue].sort(
    (left, right) => rankOf(left.scopeTriage) - rankOf(right.scopeTriage),
  );
  const anyRanked = ordered.some((item) => Boolean(item.scopeTriage));
  let renderedHeading: string | null = null;

  for (const resource of ordered) {
    if (anyRanked) {
      const heading = resource.scopeTriage
        ? TRIAGE_HEADING[resource.scopeTriage] || resource.scopeTriage
        : TRIAGE_HEADING['required-now'] || 'Do this';
      if (heading !== renderedHeading) {
        resources.createDiv({ cls: 'los-kicker los-resource-tier', text: heading });
        renderedHeading = heading;
      }
    }

    const row = resources.createDiv({
      cls: `los-resource-row los-triage-${resource.scopeTriage || 'unranked'}`,
    });
    const iconName = resource.kind === 'watch'
      ? 'play'
      : resource.kind === 'practise' ? 'pencil-line' : 'book-open';
    icon(row.createSpan(), iconName);

    const copy = row.createDiv({ cls: 'los-resource-copy' });
    copy.createEl('strong', { text: resource.label });
    if (resource.locator) copy.createDiv({ cls: 'los-micro', text: resource.locator });

    const source = resource.sourceId && renderer.sourceRecord
      ? renderer.sourceRecord(resource.sourceId)
      : null;
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
  return resources;
}
