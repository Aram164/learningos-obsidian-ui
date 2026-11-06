/**
 * The one Material row (Figma `Data / Material row`, 35:613): the same shape on
 * the lecture's materials page and in the session.
 *
 * Type icon · title · Best fit / Your pick / Course / Copy missing · one line on
 * what it is for · type, source, pages and where it is · the stages that use it.
 * The row opens the material; the chevron opens the details in place: the full
 * rationale, exact pages, where it is, its source and stages, then Open,
 * Inspect the pages, Show in Library, Choose for this lecture and, against one
 * stage, Rate.
 *
 * Every action is an existing path: `openResource`, the span read Core already
 * answers, the guarded source selection, and the stage feedback write. Nothing
 * here decides what a material is; that is `material-purpose.ts`.
 */
import { Notice } from 'obsidian';
import { button, icon, overflowMenu } from '../../components';
import type { ProjectionRecord } from '../../contracts/manifest';
import { hasDirectResourceTarget } from '../../infrastructure/resource-target';
import { asLabel, errorMessage } from '../../projection/readers';
import { safeWebUrl } from '../../security/safe-url';
import { renderMaterialCautions } from '../../features/stage-resources';
import {
  inspectRouteSpan,
  placementAvailability,
  projectedAvailability,
  renderRouteSpan,
  routeSpanStatus,
  toggleRouteChoice,
  type Availability,
  type MaterialCardDeps,
} from '../../features/unit/material-card';
import {
  materialTypeDef,
  stageRuns,
  type LectureMaterial,
  type StageUse,
} from '../../features/unit/material-purpose';
import type { StageRecordView, UnitRecordView } from '../../features/unit/model';
import { stageResourceRenderer } from '../../features/unit/stage';
import type { UnitScreenHost } from '../screens';
import { moduleShort } from './parts';

export interface MaterialRowContext {
  readonly view: UnitScreenHost;
  readonly unit: UnitRecordView;
  /** The durable plan's stages, in plan order: what the dots and "Used in" count. */
  readonly stages: readonly StageRecordView[];
  readonly expected: Readonly<Record<string, number>>;
  /** Against one stage (a Stage filter, or the session): its placement is the one rated and inspected. */
  readonly stage: StageRecordView | null;
  /** Row keys whose details are open; owned by the view (materials-state.ts). */
  readonly open: Set<string>;
  /** Redraw after an answer arrives or a row opens. */
  readonly refresh: () => void;
}

export interface MaterialRowMarks {
  readonly bestFit?: boolean;
  /** A flat list has no group headings, so each row names its purpose first. */
  readonly purpose?: string;
  /**
   * Inside one stage (the session, a stage's list on the plan; Figma D1): two
   * lines and no stage dots. The one-line why moves into the opened details.
   */
  readonly compact?: boolean;
}

/* ───────────────────────────────── words ───────────────────────────────── */

/** "Probabilistic Machine Learning" from "Probabilistic Machine Learning: An Introduction". */
export function shortTitle(title: string): string {
  const cut = title.split(/\s+[—–]\s+|:\s+|\s+\(/)[0]?.trim();
  return cut || title;
}

const FILE_NAME = /\.(?:pdf|tex|md|html?|ipynb|py|txt|epub|djvu|zip)(?=$|[\s,;:)])/i;

/**
 * The part of a locator a reader uses: "§3.5 …" from "islp.pdf §3.5 …", or the
 * file's own name when that is all it says. The exact locator stays in the
 * opened row; this only shortens the scanning line.
 */
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

/** "Required in stages 1–3, 6 · helps in 4": the dot strip in words. */
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

/* ──────────────────────────────── reading ──────────────────────────────── */

function sourceOf(context: MaterialRowContext, material: LectureMaterial): ProjectionRecord | null {
  return material.sourceId ? context.view.plugin.store.get(material.sourceId) : null;
}

export function availabilityOf(context: MaterialRowContext, material: LectureMaterial): Availability {
  const source = sourceOf(context, material);
  if (material.resource) return placementAvailability(material.resource, material.route, source);
  const projected = projectedAvailability(material.route?.record ?? {});
  return projected.kind === 'none' && source && hasDirectResourceTarget(source) ? projectedAvailability(source) : projected;
}

/** Where a material opens, in the order the classic card uses; null when it cannot. */
export function openerOf(context: MaterialRowContext, material: LectureMaterial): { readonly label: string; readonly go: () => unknown } | null {
  const { view } = context;
  const { resource, route } = material;
  const web = availabilityOf(context, material).kind === 'remote';
  if (resource?.canOpen) return { label: web ? 'Open on the web' : 'Open', go: () => view.plugin.openResource(resource.record) };
  if (route?.canOpen) return { label: web ? 'Open on the web' : 'Open', go: () => view.plugin.openResource(route.record) };
  const source = sourceOf(context, material);
  if (source && hasDirectResourceTarget(source)) return { label: 'Open the source', go: () => view.plugin.openResource(source) };
  return null;
}

/** The second word on the meta line: the course for its own files, else the source's short name, else the link's host. */
function originOf(context: MaterialRowContext, material: LectureMaterial): string | null {
  if (material.course) return moduleShort(context.view.plugin.store.get(context.unit.moduleId));
  const source = sourceOf(context, material);
  if (source) return shortTitle(asLabel(source));
  const url = safeWebUrl(material.resource?.record.url ?? material.route?.record.url);
  return url ? url.hostname.replace(/^www\./, '') : null;
}

/* ─────────────────────────────────── row ───────────────────────────────── */

function tag(parent: HTMLElement, text: string, tone: 'neutral' | 'accent' | 'warning' = 'neutral'): void {
  parent.createSpan({ cls: `sd-tag is-${tone}`, text });
}

export function renderStageDots(parent: HTMLElement, uses: readonly StageUse[]): void {
  if (uses.length > 9) {
    parent.createSpan({ cls: 'sd-mrow-stages', text: stageRuns(uses), attr: { title: usedInWords(uses) } });
    return;
  }
  const strip = parent.createSpan({ cls: 'sd-dots', attr: { role: 'img', 'aria-label': usedInWords(uses) } });
  for (const use of uses) strip.createSpan({ cls: `sd-dot is-${use ?? 'none'}` });
}

export function renderMaterialRow(
  parent: HTMLElement,
  material: LectureMaterial,
  context: MaterialRowContext,
  marks: MaterialRowMarks = {},
): HTMLElement {
  const type = materialTypeDef(material.type);
  const availability = availabilityOf(context, material);
  const opener = openerOf(context, material);
  const isOpen = context.open.has(material.key);
  const row = parent.createDiv({
    cls: `sd-mrow${isOpen ? ' is-open' : ''}${material.picked ? ' is-picked' : ''}${marks.compact ? ' is-compact' : ''}`,
    attr: { 'data-material-key': material.key },
  });
  const main = row.createDiv({ cls: 'sd-mrow-main' });
  const toggle = () => {
    if (context.open.has(material.key)) context.open.delete(material.key);
    else context.open.add(material.key);
    context.refresh();
  };
  const target = main.createEl('button', {
    cls: 'sd-mrow-open is-clickable',
    attr: {
      type: 'button',
      'aria-label': opener ? `${opener.label}: ${material.title}` : `Details for ${material.title}`,
    },
  });
  // Nothing to open: the row still answers, by opening its details.
  target.addEventListener('click', () => { if (opener) opener.go(); else toggle(); });
  icon(target.createSpan({ cls: 'sd-mrow-tile' }), type.icon);
  const body = target.createSpan({ cls: 'sd-mrow-body' });
  const titleLine = body.createSpan({ cls: 'sd-mrow-title-line' });
  titleLine.createSpan({ cls: 'sd-mrow-title', text: material.title });
  if (marks.bestFit) tag(titleLine, 'Best fit', 'accent');
  if (material.picked) tag(titleLine, 'Your pick', 'accent');
  if (material.course) tag(titleLine, 'Course');
  if (availability.kind === 'local-missing') tag(titleLine, 'Copy missing', 'warning');
  if (material.why && !marks.compact) body.createSpan({ cls: 'sd-mrow-why', text: material.why });
  const meta = [marks.purpose, type.singular, originOf(context, material), shortLocator(material.locator), whereLabel(availability)];
  body.createSpan({ cls: 'sd-mrow-meta', text: meta.filter(Boolean).join(' · ') });

  const right = main.createSpan({ cls: 'sd-mrow-right' });
  if (!marks.compact) renderStageDots(right, material.uses);
  const expand = right.createEl('button', {
    cls: 'sd-mrow-expand is-clickable',
    attr: { type: 'button', 'aria-expanded': String(isOpen), 'aria-label': `${isOpen ? 'Hide' : 'Show'} details: ${material.title}` },
  });
  icon(expand, isOpen ? 'chevron-up' : 'chevron-down');
  expand.addEventListener('click', toggle);

  if (isOpen) renderDetails(row, material, context, availability, opener, Boolean(marks.compact));
  return row;
}

/* ─────────────────────────────── details ───────────────────────────────── */

function fact(parent: HTMLElement, label: string, value: string | null): void {
  if (!value) return;
  const cell = parent.createDiv({ cls: 'sd-mrow-fact' });
  cell.createDiv({ cls: 'sd-mrow-fact-label', text: label });
  cell.createDiv({ cls: 'sd-mrow-fact-value', text: value });
}

function renderDetails(
  row: HTMLElement,
  material: LectureMaterial,
  context: MaterialRowContext,
  availability: Availability,
  opener: ReturnType<typeof openerOf>,
  compact: boolean,
): void {
  const { view, unit, stage } = context;
  const details = row.createDiv({ cls: 'sd-mrow-details', attr: { role: 'region', 'aria-label': `Details: ${material.title}` } });
  // A compact row kept its why for here; the full rationale follows when it says more.
  if (compact && material.why && !(material.detail ?? '').includes(material.why)) details.createEl('p', { cls: 'sd-mrow-rationale', text: material.why });
  if (material.detail && !(compact && material.detail === material.why)) details.createEl('p', { cls: 'sd-mrow-rationale', text: material.detail });
  renderMaterialCautions(details, material.route?.record ?? material.resource?.record ?? {});

  const facts = details.createDiv({ cls: 'sd-mrow-facts' });
  fact(facts, 'Pages', material.locator);
  const url = safeWebUrl(material.resource?.record.url ?? material.route?.record.url);
  fact(facts, 'Where', [whereLabel(availability), url?.hostname.replace(/^www\./, '')].filter(Boolean).join(' · '));
  const source = sourceOf(context, material);
  fact(facts, 'Source', source ? asLabel(source) : null);
  fact(facts, 'Used in', usedInWords(material.uses));
  if (availability.kind === 'none' || availability.kind === 'local-missing') {
    details.createDiv({ cls: 'sd-mrow-gap', text: availability.detail });
  }

  // Against one stage, that stage's own placement is the one inspected and rated.
  const placement = stage ? material.placements.find((row) => row.stageId === stage.id) ?? null : null;
  const spanPlacement = placement && placement.resource.resourceIndex !== undefined
    ? { stageId: placement.stageId, resourceIndex: placement.resource.resourceIndex } : undefined;
  const deps: MaterialCardDeps = {
    plugin: view.plugin,
    unitId: unit.id,
    ...(stage ? { stageId: stage.id } : {}),
    renderer: {},
    refresh: context.refresh,
  };
  const routeId = material.route?.routeId ?? null;
  if (routeId) renderRouteSpan(details, deps, routeId, spanPlacement);

  const actions = details.createDiv({ cls: 'sd-mrow-actions' });
  let actionCount = 0;
  if (opener) { button(actions, opener.label, () => opener.go(), 'cta'); actionCount += 1; }
  if (routeId && availability.kind === 'local') {
    const status = routeSpanStatus(deps, routeId, spanPlacement);
    const inspect = button(actions, status === 'ready' ? 'Inspect again' : 'Inspect the pages', () => inspectRouteSpan(deps, routeId, spanPlacement), 'quiet');
    inspect.disabled = status === 'loading';
    actionCount += 1;
  }
  const sourceId = material.sourceId;
  if (sourceId && source) { button(actions, 'Show in Library', () => view.plugin.nav.openLibrary(sourceId), 'quiet'); actionCount += 1; }
  const route = material.route;
  if (route?.canChoose && route.sourceId && route.locator) {
    const choice = button(actions, route.selected ? 'Remove choice' : 'Choose for this lecture', () => {
      void toggleRouteChoice(view.plugin, unit.id, route, context.expected)
        .then(() => { new Notice(route.selected ? 'Material choice removed.' : 'Material chosen for this lecture.'); })
        .catch((error: unknown) => { new Notice(errorMessage(error)); });
    }, 'quiet');
    choice.setAttr('aria-pressed', String(route.selected));
    actionCount += 1;
  }
  if (stage && placement?.resource.sourceId) {
    actions.createSpan({ cls: 'sd-mrow-actions-gap' });
    const renderer = stageResourceRenderer(view, unit, stage, context.expected, material.route ? [material.route] : []);
    const rated = placement.resource;
    const rate = (verdict: string) => renderer.rateResource?.(rated.sourceId ?? '', rated.id, verdict);
    overflowMenu(actions, [
      ['Helpful', () => rate('helpful')],
      ['Too advanced', () => rate('too-advanced')],
      ['Useful for review', () => rate('useful-for-review')],
    ], rated.id ? `Rate ${material.title}` : `Rate ${material.title} (whole source)`);
    actionCount += 1;
  }
  if (!actionCount) actions.createSpan({ cls: 'sd-quiet', text: 'Nothing to open here yet; the details above say what is missing.' });
}
