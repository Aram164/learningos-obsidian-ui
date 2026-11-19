/**
 * Focus 2.0 material row & purpose-first lists:
 * - Expandable rows with Best fit / Course / Your pick / Copy missing badges,
 * - S1..SN Stage-Usage Matrix indicators (● Required, ◐ Helps, ○ Reference, · Unused),
 * - Inline If you get stuck Purpose tabs and Folded Kept for reference in Session.
 */
import { Notice } from 'obsidian';
import { badge, button, filterTabs, icon, overflowMenu, plural } from '../../components';
import type { ProjectionRecord } from '../../contracts/manifest';
import { renderMaterialCautions } from '../../features/stage-resources';
import {
  materialAvailability,
  materialOpener,
  materialOrigin,
  namesOf,
  shortLocator,
  usedInWords,
  whereLabel,
} from '../../features/unit/lecture-materials';
import {
  inspectRouteSpan,
  renderRouteSpan,
  routeSpanStatus,
  toggleRouteChoice,
  type Availability,
  type MaterialCardDeps,
} from '../../features/unit/material-card';
import {
  groupByPurpose,
  materialTypeDef,
  purposeDef,
  stageRuns,
  type LectureMaterial,
  type PurposeKey,
  type StageUse,
} from '../../features/unit/material-purpose';
import { keepFold, openInStage, type MaterialsState } from '../../features/unit/materials-state';
import type { StageRecordView, StudyMapView, UnitRecordView } from '../../features/unit/model';
import { stageResourceRenderer } from '../../features/unit/stage';
import { asLabel, errorMessage } from '../../projection/readers';
import { safeWebUrl } from '../../security/safe-url';
import type { UnitScreenHost } from '../screens';

export interface FocusMaterialRowContext {
  readonly view: UnitScreenHost;
  readonly unit: UnitRecordView;
  readonly stages: readonly StageRecordView[];
  readonly expected: Readonly<Record<string, number>>;
  readonly stage: StageRecordView | null;
  readonly open: Set<string>;
  readonly refresh: () => void;
}

const USE_GLYPH: Readonly<Record<Exclude<StageUse, null>, string>> = {
  required: '●',
  helps: '◐',
  reference: '○',
  deferred: '·',
};

function renderStageMatrix(parent: HTMLElement, uses: readonly StageUse[]): void {
  if (uses.length > 9) {
    parent.createSpan({ cls: 'focus-muted focus-mono', text: stageRuns(uses), attr: { title: usedInWords(uses) } });
    return;
  }
  const matrix = parent.createSpan({
    cls: 'focus-stage-matrix',
    attr: { role: 'img', 'aria-label': usedInWords(uses), title: usedInWords(uses) },
  });
  uses.forEach((use, idx) => {
    const tone = use ?? 'none';
    const cell = matrix.createSpan({ cls: `focus-stage-cell is-${tone}` });
    cell.createSpan({ cls: 'focus-mono', text: `S${idx + 1}` });
    cell.createSpan({ text: use ? USE_GLYPH[use] : '·' });
  });
}

function renderRowDetails(
  rowEl: HTMLElement,
  material: LectureMaterial,
  ctx: FocusMaterialRowContext,
  availability: Availability,
  opener: ReturnType<typeof materialOpener>,
  source: ProjectionRecord | null,
  compact: boolean,
): void {
  const { view, unit, stage } = ctx;
  const details = rowEl.createDiv({
    cls: 'focus-mrow-detail',
    attr: { role: 'region', 'aria-label': `Details: ${material.title}` },
  });
  if (compact && material.why && !(material.detail ?? '').includes(material.why)) {
    details.createEl('p', { cls: 'focus-muted', text: material.why });
  }
  if (material.detail && !(compact && material.detail === material.why)) {
    details.createEl('p', { cls: 'focus-muted', text: material.detail });
  }
  renderMaterialCautions(details, material.route?.record ?? material.resource?.record ?? {});

  const facts = details.createDiv({ cls: 'focus-mrow-facts' });
  if (material.locator) facts.createSpan({ text: `Pages: ${material.locator}` });
  const url = safeWebUrl(material.resource?.record.url ?? material.route?.record.url);
  facts.createSpan({ text: `Where: ${[whereLabel(availability), url?.hostname.replace(/^www\./, '')].filter(Boolean).join(' · ')}` });
  if (source) facts.createSpan({ text: `Source: ${asLabel(source)}` });
  facts.createSpan({ text: usedInWords(material.uses) });
  if (availability.kind === 'none' || availability.kind === 'local-missing') {
    details.createDiv({ cls: 'focus-muted', text: availability.detail });
  }

  const placement = stage ? material.placements.find((entry) => entry.stageId === stage.id) ?? null : null;
  const spanPlacement = placement && placement.resource.resourceIndex !== undefined
    ? { stageId: placement.stageId, resourceIndex: placement.resource.resourceIndex }
    : undefined;
  const deps: MaterialCardDeps = {
    plugin: view.plugin,
    unitId: unit.id,
    ...(stage ? { stageId: stage.id } : {}),
    renderer: {},
    refresh: ctx.refresh,
  };
  const routeId = material.route?.routeId ?? null;
  if (routeId) renderRouteSpan(details, deps, routeId, spanPlacement);

  const actions = details.createDiv({ cls: 'focus-mrow-actions' });
  let count = 0;
  if (opener) {
    button(actions, opener.label, () => opener.go(), 'cta');
    count += 1;
  }
  if (routeId && availability.kind === 'local') {
    const spanState = routeSpanStatus(deps, routeId, spanPlacement);
    const inspectBtn = button(
      actions,
      spanState === 'ready' ? 'Inspect again' : 'Inspect the pages',
      () => inspectRouteSpan(deps, routeId, spanPlacement),
      'quiet',
    );
    inspectBtn.disabled = spanState === 'loading';
    count += 1;
  }
  if (material.sourceId && source) {
    button(actions, 'Show in Library', () => view.plugin.nav.openLibrary(material.sourceId ?? undefined), 'quiet');
    count += 1;
  }
  const route = material.route;
  if (route?.canChoose && route.sourceId && route.locator) {
    const choice = button(actions, route.selected ? 'Remove choice' : 'Choose for this lecture', () => {
      void toggleRouteChoice(view.plugin, unit.id, route, ctx.expected)
        .then(() => { new Notice(route.selected ? 'Material choice removed.' : 'Material chosen for this lecture.'); })
        .catch((error: unknown) => { new Notice(errorMessage(error)); });
    }, 'quiet');
    choice.setAttr('aria-pressed', String(route.selected));
    count += 1;
  }
  if (stage && placement?.resource.sourceId) {
    const renderer = stageResourceRenderer(view, unit, stage, ctx.expected, material.route ? [material.route] : []);
    const rated = placement.resource;
    const rate = (verdict: string) => renderer.rateResource?.(rated.sourceId ?? '', rated.id, verdict);
    overflowMenu(actions, [
      ['Helpful', () => rate('helpful')],
      ['Too advanced', () => rate('too-advanced')],
      ['Useful for review', () => rate('useful-for-review')],
    ], rated.id ? `Rate ${material.title}` : `Rate ${material.title} (whole source)`);
    count += 1;
  }
  if (!count) details.createSpan({ cls: 'focus-muted', text: 'Nothing to open here yet.' });
}

export function renderFocusMaterialRow(
  parent: HTMLElement,
  material: LectureMaterial,
  ctx: FocusMaterialRowContext,
  options: { readonly bestFit?: boolean; readonly compact?: boolean } = {},
): HTMLElement {
  const compact = Boolean(options.compact);
  const { store } = ctx.view.plugin;
  const availability = materialAvailability(store, material);
  const opener = materialOpener(ctx.view.plugin, material);
  const source = material.sourceId ? store.get(material.sourceId) : null;
  const isOpen = ctx.open.has(material.key);
  const typeDef = materialTypeDef(material.type);

  const rowEl = parent.createDiv({ cls: `focus-mrow${isOpen ? ' is-open' : ''}` });
  const bar = rowEl.createDiv({ cls: 'focus-mrow-bar' });
  const toggleOpen = () => {
    if (isOpen) ctx.open.delete(material.key);
    else ctx.open.add(material.key);
    ctx.refresh();
  };

  const mainBtn = bar.createEl('button', {
    cls: 'focus-mrow-open is-clickable',
    attr: { type: 'button', 'aria-label': `${opener ? opener.label : 'Inspect'}: ${material.title}` },
  });
  icon(mainBtn.createSpan({ cls: 'focus-mrow-icon', attr: { 'aria-hidden': 'true' } }), typeDef.icon);
  const copy = mainBtn.createDiv({ cls: 'focus-mrow-copy' });
  const titleLine = copy.createDiv({ cls: 'focus-mrow-title-line' });
  titleLine.createSpan({ cls: 'focus-mrow-title', text: material.title });
  if (options.bestFit && !material.picked) titleLine.createSpan({ cls: 'focus-pill is-accent', text: 'Best fit' });
  if (material.picked) badge(titleLine, 'Your pick', 'accent');
  if (material.course) titleLine.createSpan({ cls: 'focus-pill is-info', text: 'Course' });
  if (availability.kind === 'local-missing') titleLine.createSpan({ cls: 'focus-pill is-warning', text: 'Copy missing' });
  if (!compact && material.why) copy.createDiv({ cls: 'focus-mrow-why', text: material.why });

  const origin = materialOrigin(store, ctx.unit.moduleId, material);
  const metaParts = [
    typeDef.singular,
    origin,
    shortLocator(material.locator),
    whereLabel(availability),
  ].filter(Boolean);
  copy.createDiv({ cls: 'focus-mrow-meta', text: metaParts.join(' · ') });

  mainBtn.addEventListener('click', () => {
    if (opener) opener.go();
    else toggleOpen();
  });

  if (!compact) renderStageMatrix(bar, material.uses);

  const detailsBtn = bar.createEl('button', {
    cls: `focus-mrow-chevron${isOpen ? ' is-open' : ''}`,
    attr: {
      type: 'button',
      'aria-expanded': String(isOpen),
      'aria-label': `Details for ${material.title}`,
    },
  });
  icon(detailsBtn, 'chevron-right');
  detailsBtn.addEventListener('click', toggleOpen);

  if (isOpen) renderRowDetails(rowEl, material, ctx, availability, opener, source, compact);
  return rowEl;
}

/** Inline Session "If you get stuck" Purpose-segmented helper tabs. */
export function renderStuckHelpers(
  parent: HTMLElement,
  helps: readonly LectureMaterial[],
  stageIndex: number,
  state: MaterialsState,
  ctx: Omit<FocusMaterialRowContext, 'open'>,
): void {
  if (!helps.length || !ctx.stage) return;
  const stage = ctx.stage;
  const groups = groupByPurpose(helps, stageIndex);
  if (!groups.length) return;

  const panel = parent.createDiv({ cls: 'focus-stuck-panel' });
  const head = panel.createDiv({ cls: 'focus-section-head' });
  head.createEl('h3', { text: 'If you get stuck' });
  head.createSpan({ cls: 'focus-muted', text: `${plural(helps.length, 'helper')} across ${groups.length} purposes` });

  const remembered = state.stuck.get(stage.id);
  const activeKey: PurposeKey = groups.some((group) => group.purpose.key === remembered) ? remembered! : groups[0]!.purpose.key;
  const headerSlot = panel.createDiv();
  const listSlot = panel.createDiv({ cls: 'focus-mrows' });
  const rowCtx: FocusMaterialRowContext = { ...ctx, open: openInStage(state, stage.id) };

  const renderGroup = (key: PurposeKey) => {
    listSlot.empty();
    const active = groups.find((group) => group.purpose.key === key) ?? groups[0]!;
    for (const material of active.materials) {
      renderFocusMaterialRow(listSlot, material, rowCtx, {
        compact: true,
        bestFit: active.bestFit === material,
      });
    }
  };

  if (groups.length > 1) {
    filterTabs<PurposeKey>(
      headerSlot,
      'Helpful material purpose',
      groups.map((group) => [group.purpose.key, `${group.purpose.label} · ${group.materials.length}`] as const),
      activeKey,
      (next) => {
        state.stuck.set(stage.id, next);
        renderGroup(next);
      },
    );
  } else {
    headerSlot.createDiv({ cls: 'focus-eyebrow', text: groups[0]!.purpose.label });
  }
  renderGroup(activeKey);
}

/** Folded Session "Kept for reference" disclosure. */
export function renderKeptReference(
  parent: HTMLElement,
  kept: readonly LectureMaterial[],
  state: MaterialsState,
  ctx: Omit<FocusMaterialRowContext, 'open'>,
): void {
  if (!kept.length || !ctx.stage) return;
  const rowOpen = openInStage(state, ctx.stage.id);
  const fold = parent.createEl('details', { cls: 'focus-kept' });
  keepFold(fold, state, `kept:${ctx.stage.id}`, kept.some((material) => rowOpen.has(material.key)));
  const summary = fold.createEl('summary', { cls: 'focus-kept-summary' });
  icon(summary.createSpan({ attr: { 'aria-hidden': 'true' } }), 'archive');
  summary.createSpan({ cls: 'focus-kept-copy', text: `Kept for reference · ${kept.length} — ${namesOf(kept)}` });
  icon(summary.createSpan({ cls: 'focus-kept-chevron', attr: { 'aria-hidden': 'true' } }), 'chevron-down');
  const rows = fold.createDiv({ cls: 'focus-mrows' });
  const rowCtx: FocusMaterialRowContext = { ...ctx, open: rowOpen };
  for (const material of kept) renderFocusMaterialRow(rows, material, rowCtx, { compact: true });
}

/** Purpose-first Lecture Materials list with Best fit, Course, and S1..SN stage matrix. */
export function renderPurposeGroupedMaterials(
  parent: HTMLElement,
  visible: readonly LectureMaterial[],
  durable: StudyMapView,
  state: MaterialsState,
  ctx: Omit<FocusMaterialRowContext, 'open' | 'stage'>,
): void {
  if (!visible.length) {
    parent.createEl('p', { cls: 'focus-muted', text: 'No lecture material matches these filters.' });
    return;
  }
  const activeIdx = Math.max(0, durable.stages.findIndex((item) => item.id === durable.currentStageId));
  const groups = groupByPurpose(visible, activeIdx);
  const rowCtx: FocusMaterialRowContext = { ...ctx, stage: null, open: state.open };

  const stack = parent.createDiv({ cls: 'focus-module-groups' });
  for (const group of groups) {
    const def = purposeDef(group.purpose.key);
    const box = stack.createDiv({ cls: 'focus-mgroup' });
    const head = box.createDiv({ cls: 'focus-mgroup-head' });
    head.createEl('strong', { text: `${group.purpose.label} · ${group.materials.length}` });
    head.createSpan({ cls: 'focus-muted', text: def.says });
    const rows = box.createDiv({ cls: 'focus-mrows' });
    for (const material of group.materials) {
      renderFocusMaterialRow(rows, material, rowCtx, {
        compact: false,
        bestFit: group.bestFit === material,
      });
    }
  }
}
