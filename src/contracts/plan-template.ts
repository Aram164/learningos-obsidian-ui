/**
 * Producer-owned answer to the read-only `plan.template` query.
 *
 * Core owns the curriculum creation standard so the Unit surface never carries
 * a second, drift-prone copy of the defaults.
 */
export const PLAN_TEMPLATE_CONTRACT = 'plan-template-v1' as const;

export type PlanProfile = 'curriculum';

export type PlanHorizon = 'now' | 'next' | 'later';

/**
 * A freshly generated starting record. Core is the only generator: the app
 * asks for the template rather than carrying its own copy of the defaults,
 * because a second copy is exactly the drift the standard removes.
 */
export interface PlanTemplate {
  readonly profile: PlanProfile;
  readonly planTemplateVersion: number;
  /** The domain schema Core validated the record against before answering. */
  readonly schema: string;
  readonly title: string;
  readonly cadence: string;
  readonly outcome: string;
  readonly horizon: PlanHorizon;
}
