import { validateLegacyArchiveLockV1, validateLegacyArchiveStatusV1 } from './generated/responses.validator.cjs';
import type { LegacyArchiveLockV1, LegacyArchiveStatusV1 } from './generated/responses.types';
export type { LegacyArchiveLockV1, LegacyArchiveStatusV1 } from './generated/responses.types';
export type LegacyArchiveEntryV1 = LegacyArchiveLockV1['entries'][number];
export type LegacyArchiveDispositionV1 = LegacyArchiveEntryV1['disposition'];

export function asLegacyArchiveLock(value: unknown): LegacyArchiveLockV1 | null {
  return validateLegacyArchiveLockV1(value) ? value : null;
}

/** Availability is meaningful only when the verified lock actually exists. */
export function asLegacyArchiveStatus(value: unknown): LegacyArchiveStatusV1 | null {
  if (!validateLegacyArchiveStatusV1(value)) return null;
  return value.available === (value.lock !== null) ? value : null;
}
