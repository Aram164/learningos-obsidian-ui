import { App, Modal, Notice } from 'obsidian';
import { makeModalAccessible } from '../../accessibility/modal';
import { enableButtonGroupKeyboardNavigation } from '../../accessibility/button-group';
import { foldCase } from '../../sorting';
import { asString, asText } from '../../projection/readers';
import { button, empty } from '../../components';
import type { StageResourceRenderer, StageResourceView } from '../stage-resources';
import { readMaterialOptions, readUnitRecord } from './model';
import type { MaterialOptionView, StageRecordView, UnitPlugin, UnitRecordView } from './model';
import {
  normalisePurpose,
  PURPOSES,
  renderPlacementCard,
  renderRouteCard,
  routeForResource,
  UNASSIGNED_PURPOSE,
  type MaterialCardDeps,
} from './material-card';

/** The left rail: what the stage needs, then everything beyond it. */
type GroupKey = 'required' | 'stuck' | 'reference' | 'lecture' | 'course';

interface GroupDef {
  readonly key: GroupKey;
  readonly label: string;
  readonly description: string;
}

const STAGE_GROUPS: readonly GroupDef[] = [
  { key: 'required', label: 'Required now', description: 'What this stage needs you to work through to finish it.' },
  { key: 'stuck', label: 'If stuck', description: 'Another explanation when the required work does not land.' },
  { key: 'reference', label: 'For reference', description: 'Kept for depth and reference — not reading for this stage.' },
];

/** Stage placements keep the producer's triage; an unranked row counts as required. */
export function triageGroup(resource: StageResourceView): 'required' | 'stuck' | 'reference' {
  const rank = resource.scopeTriage;
  if (!rank || rank === 'required-now') return 'required';
  if (rank === 'helpful-now') return 'stuck';
  return 'reference';
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

interface CourseRoute {
  readonly owner: UnitRecordView;
  readonly option: MaterialOptionView;
}

/**
 * "Compare all" (Figma B1a): a short list of groups on the left, one group's
 * materials on the right.
 *
 * The stage's own placements come first, cut by the triage the producer
 * authored — required now, if stuck, for reference — and every count on the
 * left reconciles with the stage total, so choosing a group never hides a
 * source. Below them the rest of the lecture's menu and the rest of the course
 * stay one click away; choosing among the lecture's routes is still
 * `unit.source-selection.set` under the snapshot guard, and nothing else here
 * writes. Cross-course relationships are not offered here: they live in the
 * Atlas.
 */
export class MaterialComparisonModal extends Modal {
  private group: GroupKey = 'required';
  private query = '';
  private restoreAccessibility: (() => void) | null = null;
  private body: HTMLElement | null = null;
  private rail: HTMLElement | null = null;
  constructor(app: App, private readonly options: MaterialComparisonOptions) { super(app); }

  private get deps(): MaterialCardDeps {
    return {
      plugin: this.options.plugin,
      unitId: this.options.unit.id,
      renderer: this.options.renderer,
      refresh: () => this.renderBody(),
    };
  }

  private stageEntries(key: GroupKey): StageResourceView[] {
    return this.options.resources.filter((resource) => triageGroup(resource) === key);
  }

  private courseRoutes(): CourseRoute[] {
    const { plugin, unit } = this.options;
    const sourceMap = plugin.store.sourceMap(unit.moduleId);
    return plugin.store.unitsFor(unit.moduleId, unit.componentId)
      .map((record) => readUnitRecord(record, asString(record.id)))
      .filter((owner): owner is UnitRecordView => owner !== null && owner.id !== unit.id)
      .flatMap((owner) => readMaterialOptions(sourceMap?.sources, owner.id, owner.record.source_selections)
        .map((option) => ({ owner, option })));
  }

  private courseLabel(): string {
    const { plugin, unit } = this.options;
    const component = unit.componentId ? plugin.store.get(unit.componentId) : null;
    const module = plugin.store.get(unit.moduleId);
    return asString(component?.title) ?? asString(module?.title) ?? 'this course';
  }

  onOpen(): void {
    const { plugin, unit, stage, resources } = this.options;
    plugin.router.openOverlay({ kind: 'material-comparison', unitId: unit.id, stageId: stage.id });
    const first = STAGE_GROUPS.find((def) => this.stageEntries(def.key).length);
    this.group = first?.key ?? (this.options.materialOptions.length ? 'lecture' : 'required');
    const root = this.contentEl;
    root.empty();
    root.addClass('los-root', 'los-material-drawer');
    const header = root.createDiv({ cls: 'los-compare-head' });
    const heading = header.createEl('h1', {
      text: 'Compare materials',
      attr: { id: 'los-material-drawer-heading', tabindex: '-1' },
    });
    header.createEl('p', {
      cls: 'los-micro',
      text: `${stage.title} · ${unit.title} · ${resources.length} ${resources.length === 1 ? 'source' : 'sources'} on this stage`,
    });
    const layout = root.createDiv({ cls: 'los-compare-layout' });
    this.rail = layout.createDiv({ cls: 'los-compare-groups' });
    this.body = layout.createDiv({ cls: 'los-compare-body' });
    this.renderRail();
    this.renderBody();
    root.createEl('p', {
      cls: 'los-micro los-material-drawer-note',
      text: 'Browsing never deletes or hides the complete source record. Choosing material is a separate action.',
    });
    const close = button(root.createDiv({ cls: 'los-actions' }), 'Close', () => this.close(), 'quiet');
    this.restoreAccessibility = makeModalAccessible(root, {
      close: () => this.close(), hostClass: 'los-modal--material-drawer',
      labelledBy: 'los-material-drawer-heading', initialFocus: () => heading,
    });
    (heading ?? close).focus();
  }

  onClose(): void {
    this.options.plugin.router.clearOverlay();
    this.restoreAccessibility?.();
    this.restoreAccessibility = null;
    this.contentEl.empty();
    this.body = null;
    this.rail = null;
  }

  private count(key: GroupKey): number {
    if (key === 'lecture') return this.options.materialOptions.length;
    if (key === 'course') return this.courseRoutes().length;
    return this.stageEntries(key).length;
  }

  private renderRail(): void {
    const rail = this.rail;
    if (!rail) return;
    rail.empty();
    rail.createEl('h2', { cls: 'los-compare-eyebrow', text: 'What you need' });
    const stageList = rail.createDiv({ cls: 'los-compare-group-list', attr: { role: 'group', 'aria-label': 'Stage materials by need' } });
    enableButtonGroupKeyboardNavigation(stageList, 'vertical');
    for (const def of STAGE_GROUPS) this.railButton(stageList, def.key, def.label);
    rail.createEl('h2', { cls: 'los-compare-eyebrow', text: 'Beyond this stage' });
    const wider = rail.createDiv({ cls: 'los-compare-group-list', attr: { role: 'group', 'aria-label': 'Wider material' } });
    enableButtonGroupKeyboardNavigation(wider, 'vertical');
    this.railButton(wider, 'lecture', 'This lecture’s full menu');
    this.railButton(wider, 'course', `All of ${this.courseLabel()}`);
    const total = this.options.resources.length;
    const split = STAGE_GROUPS.map((def) => this.count(def.key));
    rail.createEl('p', {
      cls: 'los-micro los-compare-reconcile',
      text: `${split.join(' + ')} = ${total} on this stage. Choose a group to reveal its materials; source details stay in each card.`,
    });
  }

  private railButton(parent: HTMLElement, key: GroupKey, label: string): void {
    const count = this.count(key);
    const active = this.group === key;
    const control = parent.createEl('button', {
      cls: `los-compare-group is-clickable${active ? ' is-selected' : ''}${count ? '' : ' is-empty'}`,
      attr: { type: 'button', 'aria-pressed': String(active), 'data-compare-group': key },
    });
    control.createSpan({ cls: 'los-compare-group-title', text: label });
    control.createSpan({
      cls: 'los-compare-group-count',
      text: `${count} ${key === 'lecture' || key === 'course' ? (count === 1 ? 'route' : 'routes') : (count === 1 ? 'material' : 'materials')}`,
    });
    control.addEventListener('click', () => {
      this.group = key;
      this.query = '';
      this.renderRail();
      this.renderBody();
    });
  }

  private matches(texts: ReadonlyArray<string | null | undefined>): boolean {
    const query = foldCase(this.query.trim());
    if (!query) return true;
    return texts.some((text) => text && foldCase(text).includes(query));
  }

  private renderBody(): void {
    const body = this.body;
    if (!body) return;
    body.empty();
    const def = STAGE_GROUPS.find((row) => row.key === this.group);
    if (def) {
      this.renderStageGroup(body, def);
      return;
    }
    this.renderRouteGroup(body);
  }

  private renderStageGroup(body: HTMLElement, def: GroupDef): void {
    const entries = this.stageEntries(def.key);
    body.createEl('h2', { text: def.label });
    body.createEl('p', { cls: 'los-micro', text: def.description });
    if (!entries.length) {
      empty(body, `Nothing on this stage is ${def.label.toLowerCase()}`,
        'The other groups on the left hold every material this stage names.');
      return;
    }
    const list = body.createDiv({ cls: 'los-compare-cards', attr: { 'aria-live': 'polite' } });
    for (const resource of entries) {
      const route = routeForResource(resource, this.options.materialOptions);
      const source = resource.sourceId ? this.options.renderer.sourceRecord?.(resource.sourceId) ?? null : null;
      renderPlacementCard(list, resource, route, source, this.deps).addClass('los-source-entry');
    }
  }

  private renderRouteGroup(body: HTMLElement): void {
    const lecture = this.group === 'lecture';
    body.createEl('h2', { text: lecture ? 'This lecture’s full menu' : `All of ${this.courseLabel()}` });
    body.createEl('p', {
      cls: 'los-micro',
      text: lecture
        ? 'Every route this lecture offers, by purpose. Choosing one records your selection; the others stay listed.'
        : 'Routes from the other lectures of this course. Choose them from their own lecture.',
    });
    const label = body.createEl('label', { cls: 'los-compare-search-label', text: 'Search' });
    const search = label.createEl('input', {
      cls: 'los-source-search',
      attr: { type: 'search', placeholder: 'Source, chapter or lecture', 'aria-label': 'Search materials', value: this.query },
    });
    search.value = this.query;
    const results = body.createDiv({ cls: 'los-compare-cards', attr: { 'aria-live': 'polite' } });
    const draw = () => {
      results.empty();
      const rows: CourseRoute[] = lecture
        ? this.options.materialOptions.map((option) => ({ owner: this.options.unit, option }))
        : this.courseRoutes();
      const visible = rows.filter(({ owner, option }) => this.matches([
        option.title, option.locator, option.angle, owner.title,
        option.sourceId ? asString(this.options.plugin.store.get(option.sourceId)?.title) : null,
      ]));
      results.createDiv({
        cls: 'los-source-counts',
        attr: { role: 'status' },
        text: `${visible.length} of ${rows.length} ${rows.length === 1 ? 'route' : 'routes'}`,
      });
      if (!visible.length) {
        empty(results, 'No material matches', 'Clear the search to see the complete list.');
        return;
      }
      for (const purpose of [...PURPOSES, UNASSIGNED_PURPOSE]) {
        const group = visible.filter(({ option }) => normalisePurpose(option.depth) === purpose.value);
        if (!group.length) continue;
        const section = results.createDiv({ cls: 'los-type-subgroup' });
        section.createEl('h3', { cls: 'los-type-subhead', text: `${purpose.label} (${group.length})` });
        for (const { owner, option } of group) {
          const source = option.sourceId ? this.options.renderer.sourceRecord?.(option.sourceId) ?? null : null;
          renderRouteCard(section, option, source, { ...this.deps, unitId: owner.id }, {
            badges: owner.id === this.options.unit.id ? [] : [owner.title],
            coverage: option.covers
              .map((id) => owner.knowledgeNodes.find((node) => node.id === id)?.title)
              .filter((title): title is string => Boolean(title)),
            actions: (actions) => {
              if (owner.id === this.options.unit.id) this.renderChoose(actions, option);
              else {
                button(actions, 'Go to lecture', () => {
                  this.close();
                  this.options.plugin.nav.openUnit(owner.id);
                }, 'quiet');
              }
            },
          });
        }
      }
    };
    search.addEventListener('input', () => {
      this.query = search.value;
      draw();
    });
    draw();
  }

  private renderChoose(actions: HTMLElement, option: MaterialOptionView): void {
    if (!option.canChoose || !option.sourceId || !option.locator) return;
    const { plugin, unit, expectedRevisions, onChanged } = this.options;
    const choice = button(actions, option.selected ? 'Remove choice' : 'Choose', () => {
      void plugin.mutate(() => plugin.gateway.sourceSelection(unit.id, option.routeId, option.sourceId ?? '', option.locator ?? '', asText(option.angle) ?? option.angle, !option.selected, expectedRevisions))
        .then(() => { new Notice(option.selected ? 'Material choice removed.' : 'Material chosen for this lecture.'); onChanged(); this.close(); })
        .catch((error: unknown) => { new Notice(error instanceof Error ? error.message : String(error)); });
    }, 'choice');
    choice.setAttr('aria-pressed', String(option.selected));
  }
}
