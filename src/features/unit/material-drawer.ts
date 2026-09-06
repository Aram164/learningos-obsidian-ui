import { App, Modal, Notice } from 'obsidian';
import { makeModalAccessible } from '../../accessibility/modal';
import { foldCase } from '../../sorting';
import { asText, asString } from '../../projection/readers';
import { button, empty, pageHeader } from '../../components';
import { TRIAGE_HEADING, renderStageResources, type TriageRank, type StageResourceRenderer, type StageResourceView } from '../stage-resources';
import { readMaterialOptions, readUnitRecord } from './model';
import type { MaterialOptionView, StageRecordView, UnitPlugin, UnitRecordView } from './model';
import { groupBySource, renderSourceGroups } from './source-browser';

type Scope = 'stage' | 'unit' | 'component';
type Purpose = 'all' | 'derivation' | 'intuition' | 'practice';
interface BrowserEntry {
  readonly sourceId: string | null;
  readonly title: string;
  readonly locator: string | null;
  readonly depth: string;
  readonly format: string;
  readonly angle: string;
  readonly owner: UnitRecordView;
  readonly resource?: StageResourceView;
  readonly option?: MaterialOptionView;
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
  private scope: Scope = 'stage';
  private purpose: Purpose = 'all';
  private query = '';
  private restoreAccessibility: (() => void) | null = null;
  private results: HTMLElement | null = null;
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
    scope.value = this.scope;
    scope.addEventListener('change', () => { this.scope = scope.value as Scope; this.updateResults(); });
    const purposeLabel = controls.createEl('label', { text: 'Purpose' });
    const purpose = purposeLabel.createEl('select', { cls: 'los-source-purpose', attr: { 'aria-label': 'Learning purpose' } });
    for (const [value, text] of [['all', 'All purposes'], ['derivation', 'Derivation'], ['intuition', 'Intuition'], ['practice', 'Practice']] as const) purpose.createEl('option', { text, attr: { value } });
    purpose.value = this.purpose;
    purpose.addEventListener('change', () => { this.purpose = purpose.value as Purpose; this.updateResults(); });
    const searchLabel = controls.createEl('label', { text: 'Search' });
    const search = searchLabel.createEl('input', { cls: 'los-source-search', attr: { type: 'search', placeholder: 'Source, chapter or lecture', 'aria-label': 'Search sources' } });
    search.addEventListener('input', () => { this.query = search.value; this.updateResults(); });
    button(controls, 'Reset filters', () => {
      this.purpose = 'all'; this.query = ''; purpose.value = 'all'; search.value = '';
      this.updateResults(); search.focus();
    }, 'quiet');
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
    if (this.scope === 'stage') return resources.map(resource => {
      const routeId = asString(resource.record.route_id);
      const route = routeId ? materialOptions.find(option => option.routeId === routeId) : undefined;
      return { sourceId: resource.sourceId ?? route?.sourceId ?? null,
        title: resource.label, locator: resource.locator, owner: unit, resource,
        depth: asString(resource.record.depth) ?? route?.depth ?? '',
        format: resource.kind === 'practise' ? 'practice' : asString(resource.record.format) ?? route?.format ?? resource.kind,
        angle: asText(resource.record.angle) ?? '' };
    });
    const owners = this.scope === 'unit' ? [unit] : plugin.store.unitsFor(unit.moduleId, unit.componentId)
      .map(record => readUnitRecord(record, asString(record.id)))
      .filter((record): record is UnitRecordView => record !== null);
    const sourceMap = plugin.store.sourceMap(unit.moduleId);
    return owners.flatMap(owner => {
      const options = owner.id === unit.id ? materialOptions : readMaterialOptions(sourceMap?.sources, owner.id, owner.record.source_selections);
      return options.map(option => ({ ...option, owner, option }));
    });
  }
  private updateResults(): void {
    const root = this.results; if (!root) return;
    root.empty();
    const all = this.entries(); const query = foldCase(this.query.trim());
    const entries = all.filter(entry => {
      const purpose = this.purpose === 'all' || entry.depth.toLowerCase().includes(this.purpose)
        || (this.purpose === 'practice' && ['practice', 'practise', 'exercise', 'problem-set', 'homework', 'quiz'].includes(entry.format));
      return purpose && (!query || [this.sourceTitle(entry.sourceId), entry.title, entry.locator ?? '', entry.angle].some(text => foldCase(text).includes(query)));
    });
    root.createDiv({ cls: 'los-source-counts', attr: { role: 'status', 'aria-live': 'polite' }, text: `${entries.length} of ${all.length} entries · ${groupBySource(entries).size} source groups` });
    if (!entries.length) empty(root, 'No materials match', 'Change scope or reset the filters to see the complete list.');
    renderSourceGroups(root, entries, id => this.sourceTitle(id), (parent, entry) => this.renderEntry(parent, entry));
  }
  private renderEntry(parent: HTMLElement, entry: BrowserEntry): void {
    const details = parent.createEl('details', { cls: 'los-disclosure los-source-entry' });
    const summary = details.createEl('summary');
    summary.createSpan({ text: entry.title });
    const triage = entry.resource?.scopeTriage;
    const status = triage ? TRIAGE_HEADING[triage as TriageRank] ?? triage : entry.option?.scope;
    if (status) summary.createSpan({ cls: 'los-micro los-source-locator', text: status });
    if (entry.locator) summary.createSpan({ cls: 'los-micro los-source-locator', text: entry.locator });
    if (entry.owner.id !== this.options.unit.id) summary.createSpan({ cls: 'los-micro', text: entry.owner.title });
    const body = details.createDiv({ cls: 'los-source-entry-body' });
    if (entry.resource) {
      // Each placement retains its own target, instructions and feedback identity.
      renderStageResources(body, [entry.resource], { ...this.options.renderer, title: 'Details' });
      return;
    }
    const option = entry.option!;
    body.createEl('p', { text: option.angle });
    const detail = asText(option.record.angle_detail); if (detail) body.createEl('p', { text: detail });
    body.createDiv({ cls: 'los-micro', text: `${option.format} · ${option.depth} · ${option.scope}` });
    const labels = option.covers.map(id => entry.owner.knowledgeNodes.find(node => node.id === id)?.title).filter(Boolean);
    if (labels.length) body.createDiv({ cls: 'los-micro', text: `Covers: ${labels.join(' · ')}` });
    const actions = body.createDiv({ cls: 'los-actions' });
    if (entry.owner.id === this.options.unit.id) this.renderChoose(actions, option);
    else button(actions, 'Go to lecture', () => { this.close(); this.options.plugin.nav.openUnit(entry.owner.id); }, 'quiet');
    if (option.selected) body.createDiv({ cls: 'los-micro', text: 'Chosen for this lecture' });
    if (option.canOpen) button(actions, 'Open', () => this.options.plugin.openResource(option.record), 'info');
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
