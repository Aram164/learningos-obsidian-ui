import { validateHealthReportV1 } from './generated/responses.validator.cjs';
import type { HealthReportV1 } from './generated/responses.types';
export type { HealthReportV1 } from './generated/responses.types';
export type HealthCheckV1 = HealthReportV1['checks'][number];

/** Shape comes from Core; the aggregate must agree with its individual checks. */
export function asHealthReport(value: unknown): HealthReportV1 | null {
  if (!validateHealthReportV1(value)) return null;
  const aggregate = value.checks.every((check) => check.status === 'ok')
    ? 'healthy' : 'attention-required';
  return value.status === aggregate ? value : null;
}
