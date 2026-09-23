import type {
  AbilityClaimDraft,
  AbilityConnectionDraft,
  AbilityDraft,
} from '../../application/ability-drafts';
import type { AbilityBriefV1, AbilityRowV1 } from '../../contracts/ability-context';
import type { ProjectionRecord } from '../../contracts/manifest';

/**
 * Review's queue: one short list of things that need a decision.
 *
 * Membership comes from three places and nowhere else. Core's `review_items`
 * (planning, inbox, shelving, Garden) exactly as projected; Core's ability
 * horizon, where an ability's own reasons say its recorded work conflicts;
 * and Aram's own ability drafts, which are his and are labelled as drafts
 * until he confirms them. Nothing is synthesized from counts, stage status,
 * file layout or age, and no entry is ever an example.
 */
export type ReviewEntry =
  | {
    readonly kind: 'core';
    readonly key: string;
    readonly item: ProjectionRecord;
    readonly category: string;
    readonly title: string;
    readonly context: string;
    readonly reason: string;
  }
  | {
    readonly kind: 'claim-draft';
    readonly key: string;
    readonly draft: AbilityClaimDraft;
    readonly title: string;
    readonly context: string;
  }
  | {
    readonly kind: 'connection-draft';
    readonly key: string;
    readonly draft: AbilityConnectionDraft;
    readonly title: string;
    readonly context: string;
  }
  | {
    readonly kind: 'ability-conflict';
    readonly key: string;
    readonly row: AbilityRowV1;
    readonly title: string;
    readonly context: string;
  };

export interface ReviewSources {
  readonly items: readonly ProjectionRecord[];
  readonly drafts: readonly AbilityDraft[];
  readonly horizon: AbilityBriefV1 | null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Core's own words for a conflict: later comparable work disagrees. */
export function hasConflictingWork(row: AbilityRowV1): boolean {
  return row.reasons.some((reason) => /conflicting/i.test(reason));
}

export function categoryLabel(category: string): string {
  const words = category.replace(/-/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Review';
}

export function buildReviewQueue(sources: ReviewSources): ReviewEntry[] {
  const entries: ReviewEntry[] = [];
  for (const draft of sources.drafts) {
    if (draft.kind === 'claim') {
      entries.push({
        kind: 'claim-draft',
        key: draft.id,
        draft,
        title: 'Worked attempt',
        context: `${draft.abilityTitle} · draft, not recorded`,
      });
    } else {
      entries.push({
        kind: 'connection-draft',
        key: draft.id,
        draft,
        title: 'Possible connection',
        context: `${draft.fromTitle} ${draft.connection === 'equivalence' ? '↔' : '→'} ${draft.toTitle} · draft`,
      });
    }
  }
  for (const row of sources.horizon?.abilities ?? []) {
    if (!hasConflictingWork(row)) continue;
    entries.push({
      kind: 'ability-conflict',
      key: `ability-conflict:${row.id}`,
      row,
      title: 'Conflicting attempts',
      context: row.title,
    });
  }
  sources.items.forEach((item, index) => {
    const id = text(item.id) || `review-item-${index}`;
    const category = text(item.category) || 'review';
    entries.push({
      kind: 'core',
      key: id,
      item,
      category,
      title: text(item.title) || id,
      context: [categoryLabel(category), text(item.context)].filter(Boolean).join(' · '),
      reason: text(item.reason),
    });
  });
  return entries;
}

/** The count the navigator shows beside Review. */
export function reviewQueueCount(sources: ReviewSources): number {
  return buildReviewQueue(sources).length;
}
