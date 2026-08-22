/**
 * Producer-owned answer to the read-only `plan.template` query.
 *
 * It lives outside `job-dashboard.ts` on purpose. The template is the one
 * creation standard both authoring surfaces share, so the Unit surface must be
 * able to name it without importing anything from the quarantined Job feature.
 * No Job data passes through here: this describes a record Core generates on
 * request and has written nowhere.
 */
export const PLAN_TEMPLATE_CONTRACT = 'plan-template-v1' as const;

export type PlanProfile = 'curriculum' | 'job';

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
