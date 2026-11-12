import { isRecord } from '../../projection/readers';
import { SHELVING_ACTED_FIELDS, type ShelvingProposalItem } from './proposal';

/** Object keys sorted at every depth, so equal values always give equal text. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Everything Core acts on for this item, in a deterministic form. */
export function itemFingerprint(item: ShelvingProposalItem): string {
  return canonical(Object.fromEntries(SHELVING_ACTED_FIELDS.map((field) => [field, item[field] ?? null])));
}

interface ItemChoice {
  readonly fingerprint: string;
  readonly selected: boolean;
}

/**
 * The learner's ticks, per unit, for the plugin's lifetime: not in the view,
 * not on disk. A unit has an entry once the learner first touches one of its
 * boxes; from then on Core's defaults never tick an item for them again.
 */
export class ShelvingChoiceStore {
  private readonly units = new Map<string, Map<string, ItemChoice>>();

  /** The recorded choices, or null while Core's defaults still apply. */
  choicesFor(unitId: string): ReadonlyMap<string, ItemChoice> | null {
    return this.units.get(unitId) ?? null;
  }

  /**
   * Record one tick. The first touch for a unit also adopts every tick then
   * on screen, so each tick that reaches Core is one the learner saw.
   */
  choose(unitId: string, rows: readonly ReconciledItem[], itemId: string, selected: boolean): void {
    let unit = this.units.get(unitId);
    if (!unit) {
      unit = new Map(rows.filter((row) => row.approvable)
        .map((row) => [row.item.id, { fingerprint: row.fingerprint, selected: row.selected }]));
      this.units.set(unitId, unit);
    }
    const row = rows.find((candidate) => candidate.item.id === itemId);
    if (row?.approvable) unit.set(itemId, { fingerprint: row.fingerprint, selected });
  }

  /** IDs that left the proposal carry nothing forward. */
  keepOnly(unitId: string, itemIds: ReadonlySet<string>): void {
    const unit = this.units.get(unitId);
    if (!unit) return;
    for (const id of [...unit.keys()]) if (!itemIds.has(id)) unit.delete(id);
  }

  /** After a confirmed apply, its IDs carry nothing forward either. */
  forgetApplied(unitId: string, itemIds: readonly string[]): void {
    const unit = this.units.get(unitId);
    for (const id of itemIds) unit?.delete(id);
  }

  clear(): void {
    this.units.clear();
  }
}

export type ChoiceMark = 'changed' | 'new' | null;

/** Why an item offers no tick here. */
export type Unapprovable = 'unknown-fields' | 'no-content';

/**
 * Null when the item can be approved. Core's apply refuses an item whose
 * `content` is missing or blank (`review.apply.empty-content`), so the gate
 * never offers a tick for text it cannot show; Core still checks again.
 */
export function unapprovableReason(item: ShelvingProposalItem): Unapprovable | null {
  if (item.unknownFields.length) return 'unknown-fields';
  if (typeof item.content !== 'string' || !item.content.trim()) return 'no-content';
  return null;
}

export interface ReconciledItem {
  readonly item: ShelvingProposalItem;
  readonly fingerprint: string;
  readonly blocked: Unapprovable | null;
  /** True exactly when `blocked` is null. */
  readonly approvable: boolean;
  readonly selected: boolean;
  readonly mark: ChoiceMark;
  /** True when a recorded choice was carried forward unchanged. */
  readonly kept: boolean;
}

export interface Reconciliation {
  readonly rows: readonly ReconciledItem[];
  readonly kept: number;
  readonly changed: readonly string[];
  readonly added: number;
}

function reconcileItem(item: ShelvingProposalItem, choices: ReadonlyMap<string, ItemChoice> | null): ReconciledItem {
  const fingerprint = itemFingerprint(item);
  const blocked = unapprovableReason(item);
  const base = { item, fingerprint, blocked, approvable: blocked === null };
  if (!base.approvable) return { ...base, selected: false, mark: null, kept: false };
  if (!choices) return { ...base, selected: item.selected !== false, mark: null, kept: false };
  const choice = choices.get(item.id);
  if (!choice) return { ...base, selected: false, mark: 'new', kept: false };
  if (choice.fingerprint !== fingerprint) return { ...base, selected: false, mark: 'changed', kept: false };
  return { ...base, selected: choice.selected, mark: null, kept: true };
}

/** Which boxes are ticked for this proposal, and why. Pure: records nothing. */
export function reconcile(
  items: readonly ShelvingProposalItem[],
  choices: ReadonlyMap<string, ItemChoice> | null,
): Reconciliation {
  const rows = items.map((item) => reconcileItem(item, choices));
  return {
    rows,
    kept: rows.filter((row) => row.kept).length,
    changed: rows.filter((row) => row.mark === 'changed').map((row) => row.item.title),
    added: rows.filter((row) => row.mark === 'new').length,
  };
}

export function selectedIds(reconciliation: Reconciliation): string[] {
  return reconciliation.rows.filter((row) => row.approvable && row.selected).map((row) => row.item.id);
}

function count(value: number, one: string, many: string): string {
  return `${value} ${value === 1 ? one : many}`;
}

/** One line on what a refresh did to the learner's choices, or null when nothing changed. */
export function reconciliationSummary({ kept, changed, added }: Reconciliation): string | null {
  if (!changed.length && !added) return null;
  return [
    kept ? `Kept your choice on ${count(kept, 'item', 'items')}.` : '',
    changed.length
      ? `${changed.length} changed since you looked and ${changed.length === 1 ? 'is' : 'are'} now unticked: ${changed.join(', ')}.`
      : '',
    added ? `${count(added, 'new item', 'new items')} ${added === 1 ? 'is' : 'are'} unticked.` : '',
  ].filter(Boolean).join(' ');
}
