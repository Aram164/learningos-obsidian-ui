import type { GatewayResultV1 } from '../contracts/gateway-v1';
import {
  PLAN_TEMPLATE_CONTRACT,
  type PlanHorizon,
  type PlanTemplate,
} from '../contracts/plan-template';
import {
  asFiniteNumber,
  asRecordOrEmpty,
  asTrimmedString,
} from '../projection/readers';

function horizon(value: unknown): PlanHorizon {
  return value === 'now' || value === 'next' ? value : 'later';
}

/**
 * Narrow the `plan.template` answer at the same boundary every other producer
 * result crosses. A refusal, a wrong contract, an unknown profile, or a record
 * that does not carry the template version is not a template — the caller is
 * told so rather than being handed a half-read object it would treat as
 * authoritative and present to the learner as "the standard".
 */
export function asPlanTemplate(result: GatewayResultV1): PlanTemplate {
  if (result.ok !== true || result.contract !== PLAN_TEMPLATE_CONTRACT) {
    throw new Error('LearningOS did not answer the plan-template contract.');
  }
  const profile = result.profile === 'curriculum' || result.profile === 'job'
    ? result.profile
    : null;
  const version = asFiniteNumber(result.plan_template_version);
  const plan = asRecordOrEmpty(result.plan);
  if (!profile || version === null || version < 1) {
    throw new Error('The plan template answer named no profile or template version.');
  }
  return {
    profile,
    planTemplateVersion: version,
    schema: asTrimmedString(result.schema),
    title: asTrimmedString(plan.title),
    cadence: asTrimmedString(plan.cadence),
    outcome: asTrimmedString(plan.outcome),
    horizon: horizon(plan.horizon),
  };
}
