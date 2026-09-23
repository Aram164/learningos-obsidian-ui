import type {
  AbilityBridgeKindV1,
  AbilityResultV1,
} from '../contracts/ability-context';

/**
 * Ability drafts: UI-owned working state for the two records Review confirms.
 *
 * A draft is what Aram has written and not yet confirmed. It is never a
 * learner attempt — nothing about it reaches Core until he presses
 * "Confirm & record" on the exact record in Review — and it is never shown as
 * one: every surface that lists it says "draft · not recorded".
 *
 * Persisted beside the other drafts in `data.json` so a restart does not lose
 * what he typed. Anything read back that is not a well-formed draft is
 * dropped on read rather than rendered half-way.
 */
export interface AbilityClaimDraft {
  readonly kind: 'claim';
  readonly id: string;
  readonly abilityId: string;
  /** Kept so a draft still reads sensibly if the ability is renamed or gone. */
  readonly abilityTitle: string;
  readonly workspace: string;
  readonly activity: string;
  /** '' until chosen: the interface never presumes an outcome. */
  readonly result: AbilityResultV1 | '';
  readonly assistance: string;
  readonly conditionsMet: readonly string[];
  readonly conditionsNotMet: readonly string[];
  readonly evidenceTags: readonly string[];
  readonly workRef: string;
  readonly claim: string;
  /** The observation this one corrects; the earlier row stays visible. */
  readonly supersedes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AbilityConnectionDraft {
  readonly kind: 'connection';
  readonly id: string;
  readonly fromAbility: string;
  readonly fromTitle: string;
  readonly toAbility: string;
  readonly toTitle: string;
  readonly connection: AbilityBridgeKindV1;
  readonly carries: string;
  readonly changes: string;
  readonly conditions: readonly string[];
  /** '' records the app request itself as where it was noticed. */
  readonly sourceRef: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type AbilityDraft = AbilityClaimDraft | AbilityConnectionDraft;

const RESULTS: ReadonlySet<string> = new Set(['', 'correct', 'incorrect', 'partial', 'abandoned']);
const KINDS: ReadonlySet<string> = new Set(['equivalence', 'extension', 'connection']);

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function strs(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? [...value as string[]]
    : null;
}

let draftSequence = 0;

export function newAbilityDraftId(kind: AbilityDraft['kind']): string {
  draftSequence += 1;
  return `ability-${kind}-draft-${Date.now().toString(36)}-${draftSequence}`;
}

/** A persisted value as a draft, or null when it is not one. */
export function asAbilityDraft(value: unknown): AbilityDraft | null {
  const item = record(value);
  if (!item) return null;
  const id = str(item.id);
  const createdAt = str(item.createdAt);
  const updatedAt = str(item.updatedAt);
  if (!id || !createdAt || !updatedAt) return null;
  if (item.kind === 'claim') {
    const abilityId = str(item.abilityId);
    const met = strs(item.conditionsMet);
    const notMet = strs(item.conditionsNotMet);
    const tags = strs(item.evidenceTags);
    const fields = ['abilityTitle', 'workspace', 'activity', 'assistance', 'workRef', 'claim']
      .map((key) => str(item[key]));
    if (!abilityId || !met || !notMet || !tags || fields.some((field) => field === null)
      || !RESULTS.has(String(item.result))) return null;
    const [abilityTitle, workspace, activity, assistance, workRef, claim] = fields as string[];
    return {
      kind: 'claim',
      id,
      abilityId,
      abilityTitle: abilityTitle ?? abilityId,
      workspace: workspace ?? '',
      activity: activity ?? '',
      result: item.result as AbilityClaimDraft['result'],
      assistance: assistance ?? '',
      conditionsMet: met,
      conditionsNotMet: notMet,
      evidenceTags: tags,
      workRef: workRef ?? '',
      claim: claim ?? '',
      supersedes: str(item.supersedes) || null,
      createdAt,
      updatedAt,
    };
  }
  if (item.kind === 'connection') {
    const from = str(item.fromAbility);
    const to = str(item.toAbility);
    const conditions = strs(item.conditions);
    const fields = ['fromTitle', 'toTitle', 'carries', 'changes', 'sourceRef']
      .map((key) => str(item[key]));
    if (!from || !to || !conditions || fields.some((field) => field === null)
      || !KINDS.has(String(item.connection))) return null;
    const [fromTitle, toTitle, carries, changes, sourceRef] = fields as string[];
    return {
      kind: 'connection',
      id,
      fromAbility: from,
      fromTitle: fromTitle ?? from,
      toAbility: to,
      toTitle: toTitle ?? to,
      connection: item.connection as AbilityBridgeKindV1,
      carries: carries ?? '',
      changes: changes ?? '',
      conditions,
      sourceRef: sourceRef ?? '',
      createdAt,
      updatedAt,
    };
  }
  return null;
}
