import { App, Modal, Notice } from 'obsidian';
import { makeModalAccessible } from '../../accessibility/modal';
import { foldCase } from '../../sorting';
import { asText, asString } from '../../projection/readers';
import { button, chip, empty, icon, pageHeader } from '../../components';
import { materialTypeIcon, renderMaterialCautions, renderResourceRow, whyThisOne, type StageResourceRenderer, type StageResourceView } from '../stage-resources';
import { readMaterialOptions, readUnitRecord } from './model';
import type { MaterialOptionView, StageRecordView, UnitPlugin, UnitRecordView } from './model';
import { groupBySource, renderSourceGroups } from './source-browser';

type Scope = 'stage' | 'unit' | 'component';
type GroupBy = 'purpose' | 'type' | 'source';

interface PurposeDef {
  readonly value: string;
  readonly label: string;
  readonly sub: string;
}

/**
 * Level 1 of the comparison list, in fixed order so the shape of the screen
 * is learnable. These are the schema `depth` values with learner-facing
 * labels; the data is never renamed, only labelled.
 */
const PURPOSE_ORDER: readonly PurposeDef[] = [
  { value: 'course-aligned', label: 'Follow the course', sub: 'Exactly what this lecture taught' },
  { value: 'orientation', label: 'Get oriented', sub: 'The shape of the idea before the detail' },
  { value: 'intuition', label: 'Build intuition', sub: 'Why it works, in pictures and words' },
  { value: 'derivation', label: 'Derive it', sub: 'The formal argument, step by step' },
  { value: 'practice', label: 'Practise', sub: 'Problems to work, with solutions to check' },
  { value: 'implementation', label: 'Implement it', sub: 'Code it and run it' },
  { value: 'advanced-reference', label: 'Go deeper', sub: 'Beyond this stage — kept, not required' },
  { value: 'unassessed', label: 'Not on the exam', sub: 'Interesting, not assessed' },
];

const UNASSIGNED_PURPOSE: PurposeDef = {
  value: '',
  label: 'Purpose not yet assigned',
  sub: 'Shown last; never dropped',
};

interface TypeDef {
  readonly value: string;
  readonly label: string;
}

/**
 * Level 2 of the comparison list: course-first, then written, then media.
 * These are the schema `format` values with learner-facing labels, plus the
 * `course` value the schema carries, plus the trailing bucket for entries
 * that arrive without a usable format.
 */
const TYPE_ORDER: readonly TypeDef[] = [
  { value: 'course-material', label: 'Lecture material' },
  { value: 'exercise', label: 'Exercise sheets' },
  { value: 'solutions', label: 'Worked solutions' },
  { value: 'exam', label: 'Past exams' },
  { value: 'book', label: 'Textbooks' },
  { value: 'paper', label: 'Papers' },
  { value: 'video', label: 'Videos' },
  { value: 'website', label: 'Web pages' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'code', label: 'Code' },
  { value: 'course', label: 'Courses' },
];

const OTHER_TYPE: TypeDef = { value: '', label: 'Other material' };

function normalisePurpose(value: string | null): string {
  const candidate = (value ?? '').trim().toLowerCase();
  return PURPOSE_ORDER.some(def => def.value === candidate) ? candidate : '';
}

/**
 * Stage placements can arrive with a raw working kind (`read`, `practise`,
 * `watch`) instead of a format. `practise`/`practice` always means exercise
 * The authored `format` decides the type. The working kind (`practise`,
 * `watch`, `read`) speaks only where no format resolved, because it names the
 * activity rather than the material. Only a wholly absent format and kind
 * lands in the trailing bucket — nothing is dropped for lack of a facet.
 */
function normaliseType(raw: string | null, kind: string): string {
  switch ((raw ?? '').trim().toLowerCase()) {
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
    default: break;
  }
  // Only now the working kind, and only as a fallback. It describes the
  // ACTIVITY the stage asks for, not what the material IS: UE2 and UE3 are
  // placed as `practise` but are authored `format: solutions`, and letting
  // the kind win typed both as exercise sheets, so "Worked solutions" could
  // never appear for the one purpose that needs it. Authored facets win;
  // kind only speaks where no format resolved.
  const workingKind = (kind ?? '').trim().toLowerCase();
  if (workingKind === 'practise' || workingKind === 'practice') return 'exercise';
  if (workingKind === 'watch') return 'video';
  return '';
}

const TRIAGE_WEIGHT: Readonly<Record<string, number>> = {
  'required-now': 1,
  'helpful-now': 2,
  deferred: 3,
  'reference-only': 4,
};

function purposeLabel(value: string): string {
  if (!value) return UNASSIGNED_PURPOSE.label;
  return PURPOSE_ORDER.find(def => def.value === value)?.label ?? UNASSIGNED_PURPOSE.label;
}

function typeLabel(value: string): string {
  if (!value) return OTHER_TYPE.label;
  return TYPE_ORDER.find(def => def.value === value)?.label ?? OTHER_TYPE.label;
}

interface BrowserEntry {
  readonly sourceId: string | null;
  readonly title: string;
  readonly locator: string | null;
  readonly angle: string;
  /** Normalised purpose (`depth`); '' is the trailing unassigned bucket. */
  readonly purpose: string;
  /** Normalised material type (`format`); '' is the trailing other bucket. */
  readonly type: string;
  readonly depth: string;
  readonly format: string;
  /** Stage-placement urgency; null on wider scopes where routes carry none. */
  readonly triage: string | null;
  /** Whether urgency ranks exist on this entry (stage placements only). */
  readonly hasUrgency: boolean;
  /** Rank-1 urgency: required-now, or unranked where triage applies. */
  readonly required: boolean;
  readonly owner: UnitRecordView;
  readonly resource?: StageResourceView;
  readonly option?: MaterialOptionView;
}
/** One entry's urgency rank. Unranked-but-required is rank 1; no rank at all sorts last. */
function entryWeight(entry: BrowserEntry): number {
  return TRIAGE_WEIGHT[entry.triage ?? ''] ?? (entry.required ? 1 : 5);
}

/**
 * The rank a section must contain in order to open by default.
 *
 * Not "open the required-now sections" but "open the sections holding the most
 * urgent work actually present". One SaD stage — L07 geometric waiting times —
 * is authored `helpful-now` with nothing required at all, and a literal
 * required-now rule opened none of its fifteen materials: a drawer showing
 * only headings reads as empty, which is the one thing this surface must never
 * do. Degrading down TRIAGE_ORDER costs no special case and generalises — a
 * stage that is entirely reference opens in full, because there is no urgency
 * left to respect.
 *
 * Null where no entry carries urgency at all: the wider scopes, where routes
 * have no triage and hundreds of entries should stay collapsed behind the jump
 * bar until the learner narrows.
 */
function openWeight(entries: readonly BrowserEntry[]): number | null {
  const ranked = entries.filter(entry => entry.hasUrgency);
  if (!ranked.length) return null;
  return ranked.reduce((best, entry) => Math.min(best, entryWeight(entry)), Number.POSITIVE_INFINITY);
}

export interface MaterialComparisonOptions {
  readonly plugin: UnitPlugin;
  readonly unit: UnitRecordView;
  readonly stage: StageRecordView;
  readonly resources: readonly StageResourceView[];
  readonly materialOptions: readonly MaterialOptionView[];
  readonly expectedRevisions: Readonly<Record<string, number>>;
  readonly renderer: StageResourceRenderer;
  readonly onChanged: () => void;
}
export class MaterialComparisonModal extends Modal {
  private sourceScope: Scope = 'stage';
  private purpose: string = 'all';
  private materialType: string = 'all';
  private requiredOnly = false;
  private groupBy: GroupBy = 'purpose';
  private query = '';
  private restoreAccessibility: (() => void) | null = null;
  private results: HTMLElement | null = null;
  private groupNodes = new Map<string, HTMLElement>();
  constructor(app: App, private readonly options: MaterialComparisonOptions) { super(app); }
  onOpen(): void {
    const { plugin, unit, stage } = this.options;
    plugin.router.openOverlay({ kind: 'material-comparison', unitId: unit.id, stageId: stage.id });
    const root = this.contentEl;
    root.empty(); root.addClass('los-root', 'los-material-drawer');
    const header = pageHeader(root, 'Source comparison', 'Choose learning material',
      'Browse by source. Open an entry for its full description and exact work.',
      'los-material-drawer-heading') as HTMLElement;
    const heading = Array.from(header.children).find(child => child.getAttribute('id') === 'los-material-drawer-heading') as HTMLElement | undefined;
    heading?.setAttribute('tabindex', '-1');
    const controls = root.createDiv({ cls: 'los-source-controls' });
    const scopeLabel = controls.createEl('label', { text: 'Show' });
    const scope = scopeLabel.createEl('select', { cls: 'los-source-scope', attr: { 'aria-label': 'Source scope' } });
    const component = unit.componentId ? plugin.store.get(unit.componentId) : null;
    const widerLabel = unit.componentId === 'component-m2-sad' ? 'All SaD' : `All ${asString(component?.title) ?? 'module sources'}`;
    for (const [value, text] of [['stage', 'This stage'], ['unit', 'This lecture'], ['component', widerLabel]] as const) scope.createEl('option', { text, attr: { value } });
    scope.value = this.sourceScope;
    const purposeLabelEl = controls.createEl('label', { text: 'Purpose' });
    const purpose = purposeLabelEl.createEl('select', { cls: 'los-source-purpose', attr: { 'aria-label': 'Learning purpose' } });
    purpose.createEl('option', { text: 'All purposes', attr: { value: 'all' } });
    for (const def of PURPOSE_ORDER) purpose.createEl('option', { text: def.label, attr: { value: def.value } });
    purpose.value = this.purpose;
    purpose.addEventListener('change', () => { this.purpose = purpose.value; this.updateResults(); });
    const typeLabelEl = controls.createEl('label', { text: 'Type' });
    const materialType = typeLabelEl.createEl('select', { cls: 'los-source-type', attr: { 'aria-label': 'Material type' } });
    materialType.createEl('option', { text: 'All types', attr: { value: 'all' } });
    for (const def of TYPE_ORDER) materialType.createEl('option', { text: def.label, attr: { value: def.value } });
    materialType.createEl('option', { text: OTHER_TYPE.label, attr: { value: '' } });
    materialType.value = this.materialType;
    materialType.addEventListener('change', () => { this.materialType = materialType.value; this.updateResults(); });
    const requiredLabel = controls.createEl('label', { cls: 'los-source-required-label' });
    const required = requiredLabel.createEl('input', { cls: 'los-source-required', attr: { type: 'checkbox', 'aria-label': "Only what's required now" } });
    requiredLabel.createSpan({ text: "Only what's required now" });
    required.checked = this.requiredOnly;
    required.disabled = this.sourceScope !== 'stage';
    required.title = 'Urgency ranks only exist on stage placements';
    required.addEventListener('change', () => { this.requiredOnly = required.checked; this.updateResults(); });
    const searchLabel = controls.createEl('label', { text: 'Search' });
    const search = searchLabel.createEl('input', { cls: 'los-source-search', attr: { type: 'search', placeholder: 'Source, chapter or lecture', 'aria-label': 'Search sources' } });
    search.addEventListener('input', () => { this.query = search.value; this.updateResults(); });
    const groupRow = controls.createDiv({ cls: 'los-source-groupby' });
    groupRow.setAttrs({ role: 'group', 'aria-label': 'Group materials by' });
    const groupButtons = new Map<GroupBy, HTMLButtonElement>();
    for (const [value, text] of [['purpose', 'Purpose → type'], ['type', 'Type → purpose'], ['source', 'Source']] as const) {
      const control = button(groupRow, text, () => {
        this.groupBy = value;
        for (const [other, otherButton] of groupButtons) {
          otherButton.toggleClass('is-active', other === value);
          otherButton.setAttr('aria-pressed', String(other === value));
        }
        this.updateResults();
      }, 'quiet');
      control.addClass('los-groupby-btn');
      control.toggleClass('is-active', value === this.groupBy);
      control.setAttr('aria-pressed', String(value === this.groupBy));
      groupButtons.set(value, control);
    }
    button(controls, 'Reset filters', () => {
      this.purpose = 'all'; this.materialType = 'all'; this.requiredOnly = false; this.query = '';
      purpose.value = 'all'; materialType.value = 'all'; required.checked = false; search.value = '';
      this.updateResults(); search.focus();
    }, 'quiet');
    scope.addEventListener('change', () => {
      this.sourceScope = scope.value as Scope;
      // Urgency is a stage-placement rank; leaving stage scope clears the
      // toggle rather than filtering every route out from under the learner.
      if (this.sourceScope !== 'stage') { this.requiredOnly = false; required.checked = false; }
      required.disabled = this.sourceScope !== 'stage';
      this.updateResults();
    });
    this.results = root.createDiv({ cls: 'los-source-results' }); this.updateResults();
    root.createEl('p', { cls: 'los-micro los-material-drawer-note', text: 'Browsing never deletes or hides the complete source record. Choosing material is a separate action.' });
    const close = button(root.createDiv({ cls: 'los-actions' }), 'Close', () => this.close(), 'quiet');
    this.restoreAccessibility = makeModalAccessible(root, {
      close: () => this.close(), hostClass: 'los-modal--material-drawer',
      labelledBy: 'los-material-drawer-heading', initialFocus: () => heading ?? search,
    });
    (heading ?? close).focus();
  }
  onClose(): void {
    this.options.plugin.router.clearOverlay(); this.restoreAccessibility?.(); this.restoreAccessibility = null;
    this.contentEl.empty(); this.results = null;
  }
  private sourceTitle(id: string | null): string {
    return id ? asString(this.options.plugin.store.get(id)?.title) ?? id : 'Source not yet identified';
  }
  private entries(): BrowserEntry[] {
    const { plugin, unit, resources, materialOptions } = this.options;
    if (this.sourceScope === 'stage') return resources.map(resource => {
      const routeId = asString(resource.record.route_id);
      const route = routeId ? materialOptions.find(option => option.routeId === routeId) : undefined;
      const rawFormat = asString(resource.record.format) ?? route?.format ?? resource.kind;
      const depth = route?.depth ?? asString(resource.record.depth) ?? '';
      const triage = asString(resource.record.scope_triage);
      return { sourceId: resource.sourceId ?? route?.sourceId ?? null,
        title: resource.label,
        locator: resource.locator,
        angle: asText(resource.record.angle) ?? '',
        purpose: normalisePurpose(depth),
        type: normaliseType(rawFormat, resource.kind),
        depth,
        format: rawFormat,
        triage,
        hasUrgency: true,
        // An unranked pre-v2 placement counts as primary work, never as
        // deprioritised — the same rule the stage screen already follows.
        required: !triage || triage === 'required-now',
        owner: unit,
        resource,
      };
    });
    const owners = this.sourceScope === 'unit' ? [unit] : plugin.store.unitsFor(unit.moduleId, unit.componentId)
      .map(record => readUnitRecord(record, asString(record.id)))
      .filter((record): record is UnitRecordView => record !== null);
    const sourceMap = plugin.store.sourceMap(unit.moduleId);
    return owners.flatMap(owner => {
      const options = owner.id === unit.id ? materialOptions : readMaterialOptions(sourceMap?.sources, owner.id, owner.record.source_selections);
      return options.map(option => ({ ...option,
        sourceId: option.sourceId,
        title: option.title,
        locator: option.locator,
        angle: option.angle,
        purpose: normalisePurpose(option.depth),
        type: normaliseType(option.format, ''),
        triage: null,
        hasUrgency: false,
        required: false,
        owner,
        option,
      }));
    });
  }
  private updateResults(): void {
    const root = this.results; if (!root) return;
    root.empty();
    this.groupNodes.clear();
    const all = this.entries();
    const query = foldCase(this.query.trim());
    const narrowedByFilter = this.purpose !== 'all' || this.materialType !== 'all' || this.requiredOnly;
    const entries = all.filter(entry => {
      if (this.purpose !== 'all' && entry.purpose !== this.purpose) return false;
      if (this.materialType !== 'all' && entry.type !== this.materialType) return false;
      if (this.requiredOnly && !entry.required) return false;
      if (!query) return true;
      return [this.sourceTitle(entry.sourceId), entry.title, entry.locator ?? '', entry.angle,
        purposeLabel(entry.purpose), typeLabel(entry.type)]
        .some(text => foldCase(text).includes(query));
    });
    const hasUrgency = entries.some(entry => entry.hasUrgency) || all.some(entry => entry.hasUrgency);
    const required = entries.filter(entry => entry.required).length;
    if (this.groupBy === 'source') {
      const groups = groupBySource(entries).size;
      root.createDiv({ cls: 'los-source-counts', attr: { role: 'status', 'aria-live': 'polite' }, text: `${entries.length} of ${all.length} entries · ${groups} source groups` });
      if (!entries.length) {
        empty(root, 'No materials match', 'Change scope or reset the filters to see the complete list.');
        return;
      }
      // A narrowed list is already the answer; opening it costs the learner nothing.
      const narrowed = Boolean(query) || narrowedByFilter || groups === 1;
      renderSourceGroups(root, entries, id => this.sourceTitle(id), (parent, entry) => this.renderEntry(parent, entry), narrowed);
      return;
    }
    const primaryIsPurpose = this.groupBy === 'purpose';
    const primaryKeys = primaryIsPurpose
      ? [...PURPOSE_ORDER.map(def => def.value), '']
      : [...TYPE_ORDER.map(def => def.value), ''];
    const primaryCount = primaryKeys.filter(key => entries.some(entry => primaryIsPurpose ? entry.purpose === key : entry.type === key)).length;
    const kindWord = primaryIsPurpose ? 'purposes' : 'types';
    const counts = `${entries.length} of ${all.length} entries · ${primaryCount} ${kindWord}`
      + (hasUrgency ? ` · ${required} required now` : '');
    root.createDiv({ cls: 'los-source-counts', attr: { role: 'status', 'aria-live': 'polite' }, text: counts });
    if (!entries.length) {
      empty(root, 'No materials match', 'Change scope or reset the filters to see the complete list.');
      return;
    }
    this.renderJumpBar(root, entries, primaryIsPurpose);
    // A narrowed list is already the answer; opening it costs the learner nothing.
    const narrowed = Boolean(query) || narrowedByFilter || primaryCount === 1;
    const openAt = openWeight(entries);
    if (primaryIsPurpose) this.renderPurposeSections(root, entries, narrowed, hasUrgency, openAt);
    else this.renderTypeSections(root, entries, narrowed, hasUrgency, openAt);
  }
  /**
   * The primary navigation of the modal at wide scopes: one chip per purpose
   * (or type) with its live count. Empty groups stay visible but muted and
   * inert, so a collapsed section can never be mistaken for a missing one.
   * The bar sticks to the top of the scroll area.
   */
  private renderJumpBar(root: HTMLElement, entries: readonly BrowserEntry[], primaryIsPurpose: boolean): void {
    const bar = root.createDiv({ cls: 'los-jump-bar' });
    bar.setAttrs({ role: 'group', 'aria-label': primaryIsPurpose ? 'Jump to purpose' : 'Jump to material type' });
    const defs: readonly { readonly value: string; readonly label: string }[] = primaryIsPurpose
      ? [...PURPOSE_ORDER, UNASSIGNED_PURPOSE]
      : [...TYPE_ORDER, OTHER_TYPE];
    for (const def of defs) {
      const count = entries.filter(entry => primaryIsPurpose ? entry.purpose === def.value : entry.type === def.value).length;
      const jump = bar.createEl('button', {
        cls: `los-jump-chip${count ? '' : ' is-muted'}`,
        text: `${def.label} ${count}`,
        attr: { type: 'button' },
      });
      if (!count) {
        jump.disabled = true;
        continue;
      }
      jump.setAttr('aria-label', `Jump to ${def.label}, ${count} ${count === 1 ? 'entry' : 'entries'}`);
      jump.addEventListener('click', () => {
        const target = this.groupNodes.get(def.value);
        if (target) {
          target.setAttr('open', '');
          if (typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'start' });
        }
      });
    }
  }
  private sectionCounts(group: readonly BrowserEntry[], hasUrgency: boolean): string {
    const required = group.filter(entry => entry.required).length;
    const entries = `${group.length} ${group.length === 1 ? 'entry' : 'entries'}`;
    return hasUrgency ? `${entries} · ${required} required now` : entries;
  }
  /**
   * Purpose first, material type second. The type level is a lightweight
   * inline sub-heading with a count — never a second accordion. This surface
   * has a documented history of nested disclosures, and one click is the
   * maximum between opening the modal and reading any card.
   */
  private renderPurposeSections(root: HTMLElement, entries: readonly BrowserEntry[], open: boolean, hasUrgency: boolean, openAt: number | null): void {
    for (const def of [...PURPOSE_ORDER, UNASSIGNED_PURPOSE]) {
      const group = entries.filter(entry => entry.purpose === def.value);
      if (!group.length) continue;
      const details = root.createEl('details', { cls: 'los-disclosure los-purpose-group' });
      details.setAttr('data-los-group', def.value);
      this.groupNodes.set(def.value, details);
      if (open || (openAt !== null && group.some(entry => entryWeight(entry) === openAt))) details.setAttr('open', '');
      const summary = details.createEl('summary', { cls: 'los-purpose-summary' });
      summary.createEl('h2', { cls: 'los-purpose-heading', text: `${def.label} · ${this.sectionCounts(group, hasUrgency)}` });
      summary.createDiv({ cls: 'los-purpose-sub', text: def.sub });
      const body = details.createDiv({ cls: 'los-disclosure-body' });
      for (const typeDef of [...TYPE_ORDER, OTHER_TYPE]) {
        const cards = group.filter(entry => entry.type === typeDef.value);
        if (!cards.length) continue;
        const sub = body.createDiv({ cls: 'los-type-subgroup' });
        sub.createEl('h3', { cls: 'los-type-subhead', text: `${typeDef.label} (${cards.length})` });
        for (const entry of this.byUrgency(cards)) this.renderEntry(sub, entry);
      }
    }
  }
  /** Type first, purpose second — the mirror of the default partition. */
  private renderTypeSections(root: HTMLElement, entries: readonly BrowserEntry[], open: boolean, hasUrgency: boolean, openAt: number | null): void {
    for (const def of [...TYPE_ORDER, OTHER_TYPE]) {
      const group = entries.filter(entry => entry.type === def.value);
      if (!group.length) continue;
      const details = root.createEl('details', { cls: 'los-disclosure los-purpose-group' });
      details.setAttr('data-los-group', def.value);
      this.groupNodes.set(def.value, details);
      if (open || (openAt !== null && group.some(entry => entryWeight(entry) === openAt))) details.setAttr('open', '');
      const summary = details.createEl('summary', { cls: 'los-purpose-summary' });
      summary.createEl('h2', { cls: 'los-purpose-heading', text: `${def.label} · ${this.sectionCounts(group, hasUrgency)}` });
      const body = details.createDiv({ cls: 'los-disclosure-body' });
      for (const purposeDef of [...PURPOSE_ORDER, UNASSIGNED_PURPOSE]) {
        const cards = group.filter(entry => entry.purpose === purposeDef.value);
        if (!cards.length) continue;
        const sub = body.createDiv({ cls: 'los-type-subgroup' });
        sub.createEl('h3', { cls: 'los-type-subhead', text: `${purposeDef.label} (${cards.length})` });
        for (const entry of this.byUrgency(cards)) this.renderEntry(sub, entry);
      }
    }
  }
  /** Urgency is the sort key inside a sub-group; ties keep authored order. */
  private byUrgency(cards: readonly BrowserEntry[]): BrowserEntry[] {
    return [...cards].sort((left, right) => entryWeight(left) - entryWeight(right));
  }
  /**
   * One material, one card — the same card the stage screen shows.
   *
   * The group heading already names the purpose and the sub-heading the
   * material type, so neither is repeated in the card's meta row; the source
   * chip is restored onto the card now that no group heading names it.
   */
  private renderEntry(parent: HTMLElement, entry: BrowserEntry): void {
    const badges = entry.owner.id === this.options.unit.id ? [] : [entry.owner.title];
    if (entry.resource) {
      // Each placement keeps its own target, instructions and feedback identity.
      const sourceId = entry.resource.sourceId;
      const source = sourceId ? this.options.renderer.sourceRecord?.(sourceId) ?? null : null;
      const row = renderResourceRow(parent, entry.resource, source, this.options.renderer, {
        badges,
        sourceInMeta: true,
      });
      row.addClass('los-source-entry');
      return;
    }
    this.renderRouteEntry(parent, entry, badges);
  }

  /**
   * A route the owning unit offers, rendered in the resource card's shape so
   * stage placements and wider-scope routes read as one system rather than as
   * two surfaces that happen to sit in the same dialog.
   */
  private renderRouteEntry(parent: HTMLElement, entry: BrowserEntry, badges: readonly string[]): void {
    const option = entry.option!;
    const own = entry.owner.id === this.options.unit.id;
    const row = parent.createDiv({ cls: 'los-resource-row los-source-entry los-triage-unranked' });
    icon(row.createSpan(), materialTypeIcon(entry.type || option.format));

    const copy = row.createDiv({ cls: 'los-resource-copy' });
    copy.createEl('strong', { text: entry.title });
    const metadata = copy.createDiv({ cls: 'los-resource-row-meta' });
    const source = entry.sourceId ? this.options.renderer.sourceRecord?.(entry.sourceId) ?? null : null;
    if (source) chip(metadata, source, this.options.renderer.openSource);
    if (entry.locator) metadata.createSpan({ cls: 'los-micro los-resource-locator', text: entry.locator });
    for (const badge of badges) metadata.createSpan({ cls: 'los-micro los-resource-badge', text: badge });
    if (option.selected) metadata.createSpan({ cls: 'los-micro los-resource-chosen', text: 'Chosen for this lecture' });

    if (option.angle) copy.createDiv({ cls: 'los-resource-angle', text: option.angle });
    renderMaterialCautions(copy, option.record);

    // Coverage belongs with the rationale, not on its own line: both answer
    // "why this one", and the owning unit's labels are what make it readable.
    const labels = option.covers
      .map(id => entry.owner.knowledgeNodes.find(node => node.id === id)?.title)
      .filter((title): title is string => Boolean(title));
    const rationale = [asText(option.record.angle_detail), labels.length ? `Covers: ${labels.join(' · ')}` : '']
      .filter(Boolean).join('\n\n');
    if (rationale) whyThisOne(copy, rationale);

    const actions = row.createDiv({ cls: 'los-actions los-resource-actions' });
    if (option.canOpen) button(actions, 'Open', () => this.options.plugin.openResource(option.record), 'quiet');
    if (own) this.renderChoose(actions, option);
    else {
      button(actions, 'Go to lecture', () => {
        this.close();
        this.options.plugin.nav.openUnit(entry.owner.id);
      }, 'quiet');
    }
  }
  private renderChoose(actions: HTMLElement, option: MaterialOptionView): void {
    if (!option.canChoose || !option.sourceId || !option.locator) return;
    const { plugin, unit, expectedRevisions, onChanged } = this.options;
    const choice = button(actions, option.selected ? 'Remove choice' : 'Choose', () => {
      void plugin.mutate(() => plugin.gateway.sourceSelection(unit.id, option.routeId, option.sourceId ?? '', option.locator ?? '', option.angle, !option.selected, expectedRevisions))
        .then(() => { new Notice(option.selected ? 'Material choice removed.' : 'Material chosen for this lecture.'); onChanged(); this.close(); })
        .catch((error: unknown) => { new Notice(error instanceof Error ? error.message : String(error)); });
    }, 'choice');
    choice.setAttr('aria-pressed', String(option.selected));
  }
}
