/**
 * One stage's materials, drawn with the one Material row (BRIEF §10 step 1):
 * in the session (Figma D1) and in each stage's list on the plan.
 *
 * Triage first. What the stage requires comes first; what helps follows, by
 * what it is for (D1's purpose tabs), then type, best first; what the stage
 * keeps for reference waits in one folded line at the end. Inside each part the
 * order is the lecture page's D13 rank with this stage's own triage first, so a
 * material ranks the same way wherever its row appears.
 */
import { filterTabs, icon, plural } from '../../components';
import {
  groupByPurpose,
  rankMaterials,
  type LectureMaterial,
  type StageUse,
} from '../../features/unit/material-purpose';
import type { StageResourceView } from '../../features/stage-resources';
import type { StageRecordView, StudyMapView, UnitRecordView } from '../../features/unit/model';
import type { UnitScreenHost } from '../screens';
import { renderMaterialRow, type MaterialRowContext } from './material-row';
import { keepFold, materialsState, openInStage, type MaterialsState } from './materials-state';

export interface StageMaterialsContext {
  readonly view: UnitScreenHost;
  readonly unit: UnitRecordView;
  /** The durable plan: what every material's `uses` is indexed by. */
  readonly durable: StudyMapView;
  readonly stage: StageRecordView;
  /** Every material of the lecture, built once per render. */
  readonly materials: readonly LectureMaterial[];
  readonly expected: Readonly<Record<string, number>>;
}

export interface StageSplit {
  /** The stage's place in the durable plan, or -1 when it is not there. */
  readonly index: number;
  readonly required: readonly LectureMaterial[];
  readonly helps: readonly LectureMaterial[];
  /** Deferred and kept for reference: nothing this stage asks you to read now. */
  readonly kept: readonly LectureMaterial[];
}

/** A stage's materials by its own triage, each part ranked with that triage first. */
export function splitStage(materials: readonly LectureMaterial[], durable: StudyMapView, stage: StageRecordView): StageSplit {
  // A sitting reorders the durable stages themselves, so the id always finds it.
  const index = durable.stages.findIndex((row) => row.id === stage.id);
  const where = (...uses: StageUse[]) => (index < 0 ? []
    : rankMaterials(materials.filter((material) => uses.includes(material.uses[index] ?? null)), index));
  return { index, required: where('required'), helps: where('helps'), kept: where('deferred', 'reference') };
}

function rowContext(context: StageMaterialsContext, state: MaterialsState): MaterialRowContext {
  return {
    view: context.view,
    unit: context.unit,
    stages: context.durable.stages,
    expected: context.expected,
    stage: context.stage,
    open: openInStage(state, context.stage.id),
    refresh: () => context.view.render(),
  };
}

function rows(parent: HTMLElement, materials: readonly LectureMaterial[], context: MaterialRowContext, bestFit: LectureMaterial | null = null): void {
  const list = parent.createDiv({ cls: 'sd-stage-rows' });
  for (const material of materials) renderMaterialRow(list, material, context, { compact: true, bestFit: material === bestFit });
}

/**
 * "Older L02 lecture variant and CS229 lecture 10": what a folded line holds, by
 * full title. Cutting a title short would keep only its first words, and many
 * Job labels begin with role words ("Official reference — …"), so it would say
 * nothing about which material is inside.
 */
export function namesOf(materials: readonly LectureMaterial[]): string {
  const titles = materials.map((material) => material.title);
  if (titles.length <= 2) return titles.join(' and ');
  return `${titles.slice(0, 2).join(', ')} and ${titles.length - 2} more`;
}

/** D1's last line: what the stage keeps for reference, one click away and never in the way. */
function renderKept(parent: HTMLElement, kept: readonly LectureMaterial[], context: MaterialRowContext, state: MaterialsState): void {
  if (!kept.length) return;
  const fold = parent.createEl('details', { cls: 'sd-kept' });
  keepFold(fold, state, `kept:${context.stage?.id ?? ''}`, kept.some((material) => context.open.has(material.key)));
  const summary = fold.createEl('summary', { cls: 'sd-kept-summary' });
  icon(summary.createSpan({ cls: 'sd-kept-glyph', attr: { 'aria-hidden': 'true' } }), 'archive');
  summary.createSpan({ cls: 'sd-kept-copy', text: `Kept for reference · ${kept.length} — ${namesOf(kept)}` });
  icon(summary.createSpan({ cls: 'sd-kept-chevron', attr: { 'aria-hidden': 'true' } }), 'chevron-down');
  rows(fold, kept, context);
}

function isCurrent(material: LectureMaterial, stageId: string, current: StageResourceView | null): boolean {
  return Boolean(current) && material.placements.some((placement) => placement.stageId === stageId
    && (placement.resource === current || placement.resource.record === current?.record));
}

/**
 * The session's list (Figma D1), under "Start here": the rest of what the stage
 * requires, then "If you get stuck" by purpose, then what it keeps for reference.
 */
export function renderSessionMaterials(
  parent: HTMLElement,
  context: StageMaterialsContext,
  current: StageResourceView | null,
  links: (parent: HTMLElement) => void,
): void {
  const { view, unit, stage } = context;
  const state = materialsState(view, unit.id);
  const row = rowContext(context, state);
  const split = splitStage(context.materials, context.durable, stage);
  const also = split.required.filter((material) => !isCurrent(material, stage.id, current));
  if (also.length) {
    const title = parent.createDiv({ cls: 'sd-section-title' });
    title.createEl('h2', { cls: 'sd-heading', text: current ? 'Also required' : 'Required for this stage' });
    title.createSpan({ cls: 'sd-row-facts', text: current ? `${also.length} more this stage asks for` : plural(also.length, 'material') });
    rows(parent, also, row);
  }

  const head = parent.createDiv({ cls: 'sd-section-head' });
  const title = head.createDiv({ cls: 'sd-section-title' });
  title.createEl('h2', { cls: 'sd-heading', text: 'If you get stuck' });
  title.createSpan({
    cls: 'sd-row-facts',
    text: split.helps.length ? `${split.helps.length} that ${split.helps.length === 1 ? 'helps' : 'help'}, by what they are for` : 'Nothing else is placed to help with this stage',
  });
  links(head.createDiv({ cls: 'sd-section-links' }));
  if (split.helps.length) {
    const groups = groupByPurpose(split.helps, split.index);
    const chosen = state.stuck.get(stage.id);
    const active = groups.find((group) => group.purpose.key === chosen) ?? groups[0]!;
    if (groups.length > 1) {
      filterTabs(parent, 'What the helping materials are for',
        groups.map((group) => [group.purpose.key, `${group.purpose.label} · ${group.materials.length}`] as const),
        active.purpose.key,
        (key) => { state.stuck.set(stage.id, key); view.render(); });
    } else {
      parent.createDiv({ cls: 'sd-stage-part', text: `${active.purpose.label} · ${active.materials.length}` });
    }
    // Inside a purpose, type then rank (D1): the row's first meta word names the type.
    rows(parent, active.types.flatMap((type) => type.materials), row, active.bestFit);
  }
  renderKept(parent, split.kept, row, state);
}

/** One stage's list on the plan: counted, triage first, every material once. */
export function renderStageMaterialList(parent: HTMLElement, context: StageMaterialsContext): void {
  const { view, unit, stage } = context;
  const split = splitStage(context.materials, context.durable, stage);
  const total = split.required.length + split.helps.length + split.kept.length;
  if (!total) return;
  const state = materialsState(view, unit.id);
  const row = rowContext(context, state);
  const fold = parent.createEl('details', { cls: 'sd-stop-materials' });
  keepFold(fold, state, `stage:${stage.id}`, [...split.required, ...split.helps, ...split.kept].some((material) => row.open.has(material.key)));
  fold.createEl('summary', { cls: 'sd-stop-summary', text: `Materials for this stage · ${total}` });
  const part = (label: string, materials: readonly LectureMaterial[]) => {
    if (!materials.length) return;
    fold.createDiv({ cls: 'sd-stage-part', text: `${label} · ${materials.length}` });
    rows(fold, materials, row);
  };
  part('Required', split.required);
  part('Helps', split.helps);
  renderKept(fold, split.kept, row, state);
}
