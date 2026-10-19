import type {
  AbilityClaimDraft,
  AbilityConnectionDraft,
} from '../../application/ability-drafts';
import type {
  AbilityBriefV1,
  AbilityDefinitionV1,
  AbilityResultV1,
} from '../../contracts/ability-context';
import {
  appConfirmationRef,
  DISCOVERY_REF_PREFIXES,
  hasAcceptedPrefix,
  WORK_REF_PREFIXES,
  type AbilityCandidatePayloadV1,
  type AbilityObservationPayloadV1,
} from '../../contracts/ability-writes';

/**
 * What a draft needs before Review may offer "Confirm & record", and the exact
 * payload it becomes.
 *
 * These checks are only the shape Core states in its payload schema and CLI
 * (a result, a work pointer with an accepted prefix, a claim). They are not a
 * second implementation of Core's rules: Core checks the ability's review,
 * its definition hash, the workspace, the correction target and every guard
 * again, and its refusal is what the learner sees if it disagrees.
 */

export const RESULT_LABEL: Readonly<Record<AbilityResultV1, string>> = {
  correct: 'Correct',
  partial: 'Partial',
  incorrect: 'Incorrect',
  abandoned: 'Abandoned',
};

/** Assistance "none" is the only value Core treats as independent work. */
export function isUnassisted(assistance: string): boolean {
  return assistance.trim().toLowerCase() === 'none';
}

/** Conditions the learner has neither marked met nor marked not met. */
export function unresolvedConditions(
  draft: Pick<AbilityClaimDraft, 'conditionsMet' | 'conditionsNotMet'>,
  ability: Pick<AbilityDefinitionV1, 'conditions'> | null,
): string[] {
  return (ability?.conditions ?? []).filter((condition) =>
    !draft.conditionsMet.includes(condition) && !draft.conditionsNotMet.includes(condition));
}

/**
 * A default claim assembled from what the draft already states — result,
 * assistance and conditions — so the sentence Aram confirms can never say
 * more than the fields under it. He can rewrite it; Review shows the final
 * text, and that text is what is recorded.
 */
export function composedClaim(
  draft: Pick<AbilityClaimDraft, 'result' | 'assistance' | 'conditionsMet' | 'conditionsNotMet'>,
  ability: Pick<AbilityDefinitionV1, 'conditions'> | null,
): string {
  const parts: string[] = [];
  if (draft.result) parts.push(`${RESULT_LABEL[draft.result]} attempt`);
  const assistance = draft.assistance.trim();
  if (assistance) parts.push(isUnassisted(assistance) ? 'no assistance' : assistance);
  const conditions = ability?.conditions ?? [];
  if (conditions.length && conditions.every((condition) => draft.conditionsMet.includes(condition))) {
    parts.push('every stated condition met');
  } else {
    for (const condition of draft.conditionsNotMet) parts.push(`not met: ${condition}`);
    for (const condition of unresolvedConditions(draft, ability)) parts.push(`not sure: ${condition}`);
  }
  return parts.join(' · ');
}

export interface ClaimContext {
  /** The reviewed identity, when the horizon or an expansion has it. */
  readonly ability: Pick<AbilityDefinitionV1, 'id' | 'conditions' | 'evidence_spec' | 'review' | 'lifecycle'> | null;
  /** Active workspaces Aram may record into. */
  readonly workspaces: readonly string[];
}

/** Why a claim draft cannot be confirmed yet; empty when it can. */
export function claimProblems(draft: AbilityClaimDraft, context: ClaimContext): string[] {
  const problems: string[] = [];
  if (!context.ability) {
    problems.push('This ability is not in the current ability map, so there is nothing to record against.');
  } else if (context.ability.review.state !== 'reviewed') {
    problems.push('This ability is still a candidate; evidence needs a reviewed ability.');
  } else if (context.ability.lifecycle === 'retired') {
    problems.push('This ability is retired; its earlier work remains readable, but it cannot receive new evidence.');
  }
  if (!draft.workspace || !context.workspaces.includes(draft.workspace)) {
    problems.push('Choose the active workspace this work belongs to.');
  }
  if (!draft.result) problems.push('Choose what the attempt produced.');
  if (!draft.activity.trim()) problems.push('Say what you did — the activity.');
  if (!draft.assistance.trim()) problems.push('Say what help you had, or “none”.');
  if (!hasAcceptedPrefix(draft.workRef, WORK_REF_PREFIXES)) {
    problems.push('Point at the work itself: a curriculum/ path, or a note://, conversation:// or project:// pointer.');
  }
  if (!draft.claim.trim()) problems.push('Write the claim you are confirming.');
  const overlap = draft.conditionsMet.filter((condition) => draft.conditionsNotMet.includes(condition));
  if (overlap.length) problems.push('A condition cannot be both met and not met.');
  return problems;
}

/** The exact payload "Confirm & record" sends. */
export function observationPayload(
  draft: AbilityClaimDraft,
  idempotencyKey: string,
): AbilityObservationPayloadV1 {
  if (!draft.result) throw new Error('A claim without a result cannot be recorded.');
  return {
    workspace: draft.workspace,
    ability: draft.abilityId,
    claim: draft.claim.trim(),
    work_ref: draft.workRef.trim(),
    confirmation_ref: appConfirmationRef(idempotencyKey),
    activity: draft.activity.trim(),
    result: draft.result,
    assistance: draft.assistance.trim(),
    condition: [...draft.conditionsMet],
    condition_not_met: [...draft.conditionsNotMet],
    evidence_tag: [...draft.evidenceTags],
    ...(draft.supersedes ? { supersedes: draft.supersedes } : {}),
  };
}

/** Why a connection draft cannot be confirmed yet; empty when it can. */
export function connectionProblems(
  draft: AbilityConnectionDraft,
  brief: Pick<AbilityBriefV1, 'abilities'> | null,
): string[] {
  const problems: string[] = [];
  const known = new Set((brief?.abilities ?? [])
    .filter((row) => row.lifecycle === 'active').map((row) => row.id));
  if (!known.has(draft.fromAbility) || !known.has(draft.toAbility)) {
    problems.push('Both abilities must be active in the current ability map.');
  }
  if (draft.fromAbility === draft.toAbility) problems.push('Choose two different abilities.');
  if (!draft.carries.trim()) problems.push('Say what you think carries over.');
  if (!draft.changes.trim()) problems.push('Say what still differs.');
  if (draft.sourceRef.trim() && !hasAcceptedPrefix(draft.sourceRef, DISCOVERY_REF_PREFIXES)) {
    problems.push('Where you noticed it must be a note://, conversation:// or project:// pointer — or left empty.');
  }
  return problems;
}

/** The exact payload "Confirm & record" sends for a tentative connection. */
export function candidatePayload(
  draft: AbilityConnectionDraft,
  idempotencyKey: string,
): AbilityCandidatePayloadV1 {
  return {
    from_ability: draft.fromAbility,
    to_ability: draft.toAbility,
    kind: draft.connection,
    carries: draft.carries.trim(),
    changes: draft.changes.trim(),
    condition: draft.conditions.map((condition) => condition.trim()).filter(Boolean),
    // Noticed in the app unless Aram named another discovery: the request
    // that records it is then its own provenance.
    source_ref: draft.sourceRef.trim() || appConfirmationRef(idempotencyKey),
  };
}
