/** Operations renders Core resolver verdicts; it never reconstructs them. */
import { validateOperationsListV1, validateOperationDetailV1 } from './generated/responses.validator.cjs';
import type { OperationsListV1, OperationDetailV1 } from './generated/responses.types';
export type { OperationRowV1, OperationsListV1, OperationAttemptV1,
  OperationDiagnosisV1, OperationTimelineRowV1, OperationFactsV1,
  OperationDetailV1 } from './generated/responses.types';

export function asOperationsList(value: unknown): OperationsListV1 | null {
  return validateOperationsListV1(value) ? value : null;
}
export function asOperationDetail(value: unknown): OperationDetailV1 | null {
  return validateOperationDetailV1(value) ? value : null;
}
