/**
 * Lecture · Materials (Figma OYWz… C2, C3, C4): every material of one lecture,
 * grouped by what it is for, then by what it is, best first.
 *
 * It replaces the stage × material matrix and the "full menu". Each of the
 * matrix's facts survives on the row as the stage dots; each of the menu's
 * choices survives in the opened row; the lecture's idea map and reviewed
 * comparison stay one disclosure away (decision I9).
 *
 * Structure follows volume (decision I6): up to six materials read as one
 * ranked list, up to thirty as open purpose groups, and beyond that the
 * groups fold and keep their counts until a search, a filter or a click opens
 * them. A filter narrows what each group shows, never what it counts.
 */
import { disclosure, icon } from '../../components';
import { asRecords, asString } from '../../projection/readers';
import { compareStrings } from '../../sorting';
import { renderMaterialOverview } from '../../features/unit/materials';
import { routeForResource } from '../../features/unit/material-card';
import {
  buildLectureMaterials,
  groupByPurpose,
  lectureLayout,
  matchesFilter,
  materialTypeDef,
  MATERIAL_TYPES,
  purposeDef,
  type LectureMaterial,
  type MaterialFilter,
  type MaterialTypeKey,
  type PurposeGroup,
  type PurposeKey,
  type WhereFilter,
} from '../../features/unit/material-purpose';
import type { MaterialOptionView, StudyMapView, UnitRecordView } from '../../features/unit/model';
import type { UnitScreenHost } from '../screens';
import { availabilityOf, renderMaterialRow, renderStageDots, shortTitle, type MaterialRowContext } from './material-row';
import { materialsState, setFilter, type MaterialsState } from './materials-state';
import { sideGroup, textLink } from './parts';

export interface LectureMaterialsContext {
  readonly view: UnitScreenHost;
  readonly unit: UnitRecordView;
  /** The durable plan: a sitting's temporary order never changes what the lecture holds. */
  readonly durable: StudyMapView;
  readonly options: readonly MaterialOptionView[];
  readonly expected: Readonly<Record<string, number>>;
}

/** Every material of this lecture, read once from the projection. */
export function lectureMaterialsFor(view: UnitScreenHost, unit: UnitRecordView, durable: StudyMapView, options: readonly MaterialOptionView[]): LectureMaterial[] {
  const roles = new Map<string, string | null>();
  for (const entry of asRecords(view.plugin.store.sourceMap(unit.moduleId)?.sources)) {
    const id = asString(entry.source_id);
    if (id && !roles.has(id)) roles.set(id, asString(entry.role));
  }
  return buildLectureMaterials({
    stages: durable.stages,
    options,
    routeOf: (resource) => routeForResource(resource, options),
    roleOf: (id) => roles.get(id) ?? null,
    sourceTypeOf: (id) => asString(view.plugin.store.get(id)?.source_type),
  });
}

const plural = (amount: number, noun: string) => `${amount} ${noun}${amount === 1 ? '' : 's'}`;

/** The one facts line under the title (Figma: "29 materials for 6 stages · 4 from your course · …"). */
export function lectureMaterialsFacts(materials: readonly LectureMaterial[], stages: number): string {
  const course = materials.filter((material) => material.course).length;
  const layout = lectureLayout(materials.length);
  return [
    `${plural(materials.length, 'material')} for ${plural(stages, 'stage')}`,
    course ? `${course} from your course` : '',
    layout === 'flat' ? 'best first' : layout === 'grouped'
      ? 'grouped by what they are for, then type, best first'
      : 'grouped by what they are for; search or open a group',
  ].filter(Boolean).join(' · ');
}

function whereOf(context: MaterialRowContext, material: LectureMaterial): Exclude<WhereFilter, 'anywhere'> {
  const kind = availabilityOf(context, material).kind;
  return kind === 'local' ? 'local' : kind === 'remote' ? 'web' : 'missing';
}

function haystack(context: MaterialRowContext, material: LectureMaterial): string {
  const source = material.sourceId ? context.view.plugin.store.get(material.sourceId) : null;
  return [
    material.title, asString(source?.title), material.locator, material.why,
    materialTypeDef(material.type).plural, purposeDef(material.purpose).label,
  ].filter(Boolean).join(' ');
}

/* ───────────────────────────────── screen ──────────────────────────────── */

export function renderLectureMaterials(main: HTMLElement, side: HTMLElement, context: LectureMaterialsContext): void {
  const { view, unit, durable, options } = context;
  const state = materialsState(view, unit.id);
  const all = lectureMaterialsFor(view, unit, durable, options);
  const layout = lectureLayout(all.length);
  const rowContext = (stageIndex: number | null): MaterialRowContext => ({
    view, unit, stages: durable.stages, expected: context.expected,
    stage: stageIndex === null ? null : durable.stages[stageIndex] ?? null,
    open: state.open,
    refresh: () => view.render(),
  });
  // A stage that left the plan since the filter was set stops filtering.
  if (state.filter.stage !== null && !durable.stages[state.filter.stage]) setFilter(state, { ...state.filter, stage: null });

  const toolbar = main.createDiv({ cls: 'sd-mat-toolbar', attr: { role: 'search' } });
  const field = toolbar.createEl('label', { cls: 'sd-mat-search' });
  icon(field.createSpan({ cls: 'sd-search-glyph' }), 'search');
  const input = field.createEl('input', {
    cls: 'sd-mat-search-input',
    attr: { type: 'search', placeholder: 'Find a material, a book, a page', 'aria-label': 'Find a material in this lecture' },
  });
  input.value = state.filter.query;
  const presentTypes = MATERIAL_TYPES.filter((type) => all.some((material) => material.type === type.key));
  const stageChoice = chipSelect(toolbar, 'Stage', [
    ['', `Stage: All ${durable.stages.length}`],
    ...durable.stages.map((stage, index): [string, string] => [String(index), `Stage ${index + 1}: ${stage.title}`]),
  ], state.filter.stage === null ? '' : String(state.filter.stage));
  const typeChoice = chipSelect(toolbar, 'Type', [
    ['', 'Type: All'],
    ...presentTypes.map((type): [string, string] => [type.key, `Type: ${type.plural}`]),
  ], state.filter.type ?? '');
  const whereChoice = chipSelect(toolbar, 'Where', [
    ['anywhere', 'Where: Anywhere'], ['local', 'Where: On this Mac'], ['web', 'Where: On the web'], ['missing', 'Where: Missing a copy'],
  ], state.filter.where);
  toolbar.createSpan({ cls: 'sd-mat-flex' });
  const count = toolbar.createSpan({ cls: 'sd-mat-count', attr: { 'aria-live': 'polite' } });

  const note = main.createDiv({ cls: 'sd-mat-note' });
  const sheet = main.createDiv({ cls: 'sd-sheet sd-mat-sheet' });
  const extras = main.createDiv({ cls: 'sd-mat-extras' });
  const synthesis = view.plugin.store.materialSynthesisForUnit(unit.id);
  if (unit.knowledgeNodes.length || synthesis) {
    const more = disclosure(extras, 'This lecture’s idea map and reviewed comparison', 'sd-side-disclosure');
    renderMaterialOverview(view, more, unit, [...options], synthesis, false);
  }

  const draw = () => {
    const filter = state.filter;
    const stageIndex = filter.stage;
    const context = rowContext(stageIndex);
    const universe = stageIndex === null ? all : all.filter((material) => material.uses[stageIndex]);
    const narrowed = (filter.query.trim() || filter.type || filter.where !== 'anywhere')
      ? { ...filter, stage: null } : null;
    const shown = (material: LectureMaterial) => !narrowed
      || matchesFilter(material, narrowed, (row) => whereOf(context, row), (row) => haystack(context, row));
    const visible = universe.filter(shown);
    count.setText(`${visible.length} of ${all.length}`);
    renderNote(note, state, context, universe, all.length);
    sheet.empty();
    side.empty();
    const groups = groupByPurpose(universe, stageIndex);
    if (!universe.length) {
      sheet.createEl('p', { cls: 'sd-quiet', text: 'This lecture has no materials yet: no stage places one, and the module offers none for it.' });
    } else if (layout === 'flat') {
      renderFlat(sheet, groups, context, shown, narrowed);
    } else {
      for (const group of groups) renderGroup(sheet, group, context, state, layout, shown, narrowed);
    }
    renderSide(side, state, context, groups, layout, shown, narrowed, all, durable);
  };

  input.addEventListener('input', () => { setFilter(state, { ...state.filter, query: input.value }); draw(); });
  stageChoice.addEventListener('change', () => {
    setFilter(state, { ...state.filter, stage: stageChoice.value === '' ? null : Number(stageChoice.value) });
    draw();
  });
  typeChoice.addEventListener('change', () => {
    setFilter(state, { ...state.filter, type: (typeChoice.value || null) as MaterialTypeKey | null });
    draw();
  });
  whereChoice.addEventListener('change', () => {
    setFilter(state, { ...state.filter, where: whereChoice.value as WhereFilter });
    draw();
  });
  draw();
}

/** A filter chip: a native select, so it is keyboard- and screen-reader-ready as it stands. */
/**
 * A filter chip (Figma `Chip / Filter`): it is as wide as the choice it shows.
 * A native select sizes itself to its longest option, so the chip draws the
 * chosen label itself and lays the real select over it, transparent: keyboard,
 * screen readers and the system menu still meet the native control.
 */
function chipSelect(parent: HTMLElement, label: string, choices: readonly (readonly [string, string])[], value: string): HTMLSelectElement {
  const wrap = parent.createEl('label', { cls: 'sd-chip-select' });
  const shown = wrap.createSpan({ cls: 'sd-chip-select-text', attr: { 'aria-hidden': 'true' } });
  const select = wrap.createEl('select', { cls: 'sd-chip-select-input', attr: { 'aria-label': label } });
  for (const [key, text] of choices) select.createEl('option', { text, attr: { value: key } });
  select.value = value;
  icon(wrap.createSpan({ cls: 'sd-chip-select-glyph' }), 'chevron-down');
  const sync = () => {
    shown.setText(choices.find(([key]) => key === select.value)?.[1] ?? choices[0]?.[1] ?? label);
    wrap.toggleClass('is-active', select.value !== '' && select.value !== 'anywhere');
  };
  select.addEventListener('change', sync);
  sync();
  return select;
}

/** C3's callout: what a stage filter shows, and the way back. */
function renderNote(note: HTMLElement, state: MaterialsState, context: MaterialRowContext, universe: readonly LectureMaterial[], total: number): void {
  note.empty();
  const index = state.filter.stage;
  note.toggleClass('is-empty', index === null);
  if (index === null) return;
  const uses = universe.map((material) => material.uses[index]);
  const required = uses.filter((use) => use === 'required').length;
  const helps = uses.filter((use) => use === 'helps').length;
  const kept = uses.filter((use) => use === 'deferred' || use === 'reference').length;
  icon(note.createSpan({ cls: 'sd-mat-note-glyph' }), 'info');
  const copy = note.createSpan({ cls: 'sd-mat-note-copy' });
  copy.createSpan({ text: `Showing what stage ${index + 1} uses: ${[
    required ? `${required} required` : '', helps ? `${helps} that help` : '', kept ? `${kept} kept for reference` : '',
  ].filter(Boolean).join(', ') || 'nothing yet'}. ` });
  textLink(copy, `Show all ${total}`, () => {
    setFilter(state, { ...state.filter, stage: null });
    context.refresh();
  });
}

/* ───────────────────────────────── groups ──────────────────────────────── */

type Narrowed = MaterialFilter | null;

function matchWords(filter: MaterialFilter): string {
  const query = filter.query.trim();
  return query ? `“${query}”` : 'these filters';
}

/** Purpose-group header (Figma `Data / Purpose header`, 35:642): the whole header folds the group. */
function groupHead(
  parent: HTMLElement,
  group: PurposeGroup,
  folded: boolean,
  counted: string,
  says: string,
  toggle: () => void,
): void {
  const head = parent.createEl('button', {
    cls: 'sd-purpose-head is-clickable',
    attr: { type: 'button', 'aria-expanded': String(!folded), 'aria-label': `${group.purpose.label}, ${counted}. ${folded ? 'Open' : 'Fold'} the group.` },
  });
  head.addEventListener('click', toggle);
  icon(head.createSpan({ cls: 'sd-purpose-tile' }), group.purpose.icon);
  const text = head.createSpan({ cls: 'sd-purpose-text' });
  const line = text.createSpan({ cls: 'sd-purpose-title-line' });
  line.createSpan({ cls: 'sd-purpose-title', text: group.purpose.label });
  line.createSpan({ cls: 'sd-purpose-count', text: counted });
  text.createSpan({ cls: 'sd-purpose-says', text: says });
  icon(head.createSpan({ cls: 'sd-purpose-chevron' }), folded ? 'chevron-right' : 'chevron-down');
}

function renderGroup(
  sheet: HTMLElement,
  group: PurposeGroup,
  context: MaterialRowContext,
  state: MaterialsState,
  layout: 'grouped' | 'collapsed',
  shown: (material: LectureMaterial) => boolean,
  narrowed: Narrowed,
): void {
  const key = group.purpose.key;
  const total = group.materials.length;
  const matches = group.materials.filter(shown);
  const whole = !narrowed || state.whole.has(key);
  const explicit = state.folded.get(key);
  // Folded by volume when there is nothing to show; a filter opens what it matches.
  const folded = explicit ?? (narrowed ? !matches.length && !whole : layout === 'collapsed');
  const section = sheet.createDiv({ cls: 'sd-purpose', attr: { 'data-purpose': key, id: purposeAnchor(context.unit.id, key) } });
  const best = total > 1 ? ' Best first.' : '';
  let counted = String(total);
  let says = `${group.purpose.says}${best}`;
  if (narrowed && !whole) {
    counted = matches.length === total ? String(total) : `${matches.length} of ${total}`;
    says = matches.length
      ? matches.length === total
        ? `All ${total} match ${matchWords(narrowed)}.${best}`
        : `${matches.length} match ${matchWords(narrowed)}. The other ${total - matches.length} stay one click away.${best}`
      : `No match for ${matchWords(narrowed)}. Open the group to see all of them.`;
  }
  groupHead(section, group, folded, counted, says, () => {
    if (folded && narrowed && !matches.length) state.whole.add(key);
    state.folded.set(key, !folded);
    context.refresh();
  });
  if (folded) return;
  const body = section.createDiv({ cls: 'sd-purpose-body' });
  const include = (material: LectureMaterial) => whole || shown(material);
  if (group.showTypes) {
    for (const type of group.types) {
      const rows = type.materials.filter(include);
      if (!rows.length) continue;
      const sub = body.createDiv({ cls: 'sd-type-head', attr: { role: 'heading', 'aria-level': '3' } });
      sub.createSpan({ cls: 'sd-type-label', text: type.type.plural });
      sub.createSpan({ cls: 'sd-type-count', text: rows.length === type.materials.length ? String(rows.length) : `${rows.length} of ${type.materials.length}` });
      sub.createSpan({ cls: 'sd-type-rule', attr: { 'aria-hidden': 'true' } });
      for (const material of rows) renderMaterialRow(body, material, context, { bestFit: group.bestFit === material });
    }
  } else {
    for (const material of group.materials.filter(include)) {
      renderMaterialRow(body, material, context, { bestFit: group.bestFit === material });
    }
  }
  if (narrowed && !whole && matches.length < total) {
    const more = body.createDiv({ cls: 'sd-purpose-more' });
    textLink(more, `Show all ${total} in ${group.purpose.label}`, () => {
      state.whole.add(key);
      context.refresh();
    });
  }
}

/** Six or fewer: one list, still in study order and ranked, each row saying what it is for. */
function renderFlat(
  sheet: HTMLElement,
  groups: readonly PurposeGroup[],
  context: MaterialRowContext,
  shown: (material: LectureMaterial) => boolean,
  narrowed: Narrowed,
): void {
  const list = sheet.createDiv({ cls: 'sd-mat-flat' });
  let drawn = 0;
  for (const group of groups) {
    for (const material of group.materials.filter(shown)) {
      const row = renderMaterialRow(list, material, context, { purpose: group.purpose.label });
      row.setAttr('data-purpose', group.purpose.key);
      drawn += 1;
    }
  }
  if (!drawn && narrowed) sheet.createEl('p', { cls: 'sd-quiet', text: `Nothing here matches ${matchWords(narrowed)}.` });
}

function purposeAnchor(unitId: string, key: PurposeKey): string {
  return `sd-materials-${unitId}-${key}`.replace(/[^A-Za-z0-9_-]/g, '-');
}

/* ────────────────────────────────── side ───────────────────────────────── */

function renderSide(
  side: HTMLElement,
  state: MaterialsState,
  context: MaterialRowContext,
  groups: readonly PurposeGroup[],
  layout: 'flat' | 'grouped' | 'collapsed',
  shown: (material: LectureMaterial) => boolean,
  narrowed: Narrowed,
  all: readonly LectureMaterial[],
  durable: StudyMapView,
): void {
  if (layout !== 'flat' && groups.length) {
    const index = sideGroup(side, 'On this page').createDiv({ cls: 'sd-index', attr: { role: 'list' } });
    for (const group of groups) {
      const matches = group.materials.filter(shown).length;
      const item = index.createEl('button', {
        cls: 'sd-index-item is-clickable',
        attr: { type: 'button', role: 'listitem', 'aria-label': `Go to ${group.purpose.label}` },
      });
      icon(item.createSpan({ cls: 'sd-index-glyph' }), group.purpose.icon);
      item.createSpan({ cls: 'sd-index-label', text: group.purpose.label });
      item.createSpan({ cls: 'sd-index-count', text: narrowed && matches !== group.materials.length ? `${matches} of ${group.materials.length}` : String(group.materials.length) });
      item.addEventListener('click', () => {
        state.folded.set(group.purpose.key, false);
        context.refresh();
        // The redraw replaced the sheet; find the group again by its anchor.
        const anchor = context.view.contentEl.querySelector?.(`#${purposeAnchor(context.unit.id, group.purpose.key)}`);
        (anchor as HTMLElement | null)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
      });
    }
  }

  if (narrowed && layout === 'collapsed') {
    const byStage = durable.stages
      .map((stage, index) => ({ stage, index, count: all.filter((material) => material.uses[index] && shown(material)).length }))
      .filter((row) => row.count > 0);
    const group = sideGroup(side, 'Matches by stage');
    for (const row of byStage) {
      const item = group.createEl('button', { cls: 'sd-index-item is-clickable', attr: { type: 'button', 'aria-label': `Show stage ${row.index + 1}` } });
      item.createSpan({ cls: 'sd-index-label', text: `${row.index + 1} · ${row.stage.title}` });
      item.createSpan({ cls: 'sd-index-count', text: String(row.count) });
      item.addEventListener('click', () => { setFilter(state, { ...state.filter, stage: row.index }); context.refresh(); });
    }
    const rest = durable.stages.length - byStage.length;
    if (rest) group.createDiv({ cls: 'sd-side-small', text: `${rest === durable.stages.length ? 'No' : rest} ${rest === 1 && rest !== durable.stages.length ? 'other stage has' : 'other stages have'} no match.` });
  }

  const legend = sideGroup(side, `Used in stages 1–${durable.stages.length}`).createDiv({ cls: 'sd-legend' });
  for (const [use, words] of [['required', 'Required in that stage'], ['helps', 'Helps in that stage'], ['reference', 'Kept for reference there'], [null, 'Not used in that stage']] as const) {
    const line = legend.createDiv({ cls: 'sd-legend-line' });
    renderStageDots(line, [use]);
    line.createSpan({ text: words });
  }

  if (layout === 'collapsed') {
    sideGroup(side, 'At this size').createEl('p', { cls: 'sd-note', text: 'Above 30 materials, groups open only when you search, filter or ask, and every group keeps its count. Nothing is hidden; it is folded.' });
  } else if (layout === 'grouped') {
    sideGroup(side, 'A good order').createEl('p', { cls: 'sd-note', text: 'Start with the lecture. If an idea does not click, take one Intuition source, then go straight to Practice. Theory is for when you want the full argument; Going deeper can wait for after the exam.' });
    sideGroup(side, 'How each group is ordered').createEl('p', { cls: 'sd-note', text: 'Inside each type, best first: your picks, then what this lecture’s stages require, then what more of its stages use. The best row of the whole group is marked Best fit; a tie gets no mark.' });
  } else {
    sideGroup(side, 'How this list is ordered').createEl('p', { cls: 'sd-note', text: 'In study order, the lecture first and reference last; inside each kind, your picks, then what the stages require, then what more of them use.' });
  }

  renderPicks(side, context, all);
}

/** Your picks: every choice the learner made for this lecture, matched to its row or named on its own. */
function renderPicks(side: HTMLElement, context: MaterialRowContext, all: readonly LectureMaterial[]): void {
  const group = sideGroup(side, 'Your picks');
  const picked = all.filter((material) => material.picked);
  const pickedRoutes = new Set(picked.map((material) => material.route?.routeId).filter(Boolean));
  const loose = asRecords(context.unit.record.source_selections).filter((selection) => {
    const routeId = asString(selection.route_id);
    return !routeId || !pickedRoutes.has(routeId);
  });
  if (!picked.length && !loose.length) {
    group.createEl('p', { cls: 'sd-note is-faint', text: 'None yet. “Choose for this lecture” on any material marks it as yours, and it moves to the top of its type.' });
    return;
  }
  for (const material of [...picked].sort((a, b) => compareStrings(a.title, b.title))) {
    textLink(group, material.title, () => { context.open.add(material.key); context.refresh(); }).addClass('sd-link-quiet');
  }
  for (const selection of loose) {
    const sourceId = asString(selection.source_id);
    const source = sourceId ? context.view.plugin.store.get(sourceId) : null;
    const name = source ? shortTitle(String(source.title ?? sourceId)) : sourceId ?? 'A material';
    group.createDiv({ cls: 'sd-side-small', text: [name, asString(selection.locator)].filter(Boolean).join(' · ') });
  }
}
