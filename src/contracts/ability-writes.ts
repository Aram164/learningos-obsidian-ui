import type { AbilityBridgeKindV1, AbilityResultV1 } from './ability-context';

/**
 * Payloads for the two ability writes the app may send after Review shows the
 * exact record (Core `UI_REVIEWED_ALLOWLIST`, admitted over `channel: "ui"`).
 * Both mirror the generated payload schemas under
 * `system/schema/capabilities/`; Core validates them again and is the only
 * authority on whether they are acceptable.
 */
export interface AbilityObservationPayloadV1 {
  readonly workspace: string;
  readonly ability: string;
  readonly claim: string;
  readonly work_ref: string;
  readonly confirmation_ref: string;
  readonly activity: string;
  readonly result: AbilityResultV1;
  readonly assistance: string;
  readonly condition?: readonly string[];
  readonly condition_not_met?: readonly string[];
  readonly evidence_tag?: readonly string[];
  readonly supersedes?: string;
}

export interface AbilityCandidatePayloadV1 {
  readonly from_ability: string;
  readonly to_ability: string;
  readonly kind: AbilityBridgeKindV1;
  readonly carries: string;
  readonly changes: string;
  readonly condition?: readonly string[];
  readonly source_ref: string;
}

/**
 * The confirmation pointer for a claim confirmed in this app.
 *
 * Core requires one (`conversation://` or `note://`). The confirmation *is*
 * the Review gesture, and the only durable trace of that gesture is its
 * Gateway request, so the pointer names the request's idempotency key — the
 * key Core's idempotency ledger and V2 receipt are filed under.
 */
export const APP_CONFIRMATION_PREFIX = 'conversation://learningos-app/';

export function appConfirmationRef(idempotencyKey: string): string {
  return `${APP_CONFIRMATION_PREFIX}${idempotencyKey}`;
}

/** Where Core accepts the actual work to live (`work-ref`). */
export const WORK_REF_PREFIXES: readonly string[] = [
  'conversation://', 'note://', 'project://', 'curriculum/',
];

/** Where Core accepts a tentative connection's discovery to be named. */
export const DISCOVERY_REF_PREFIXES: readonly string[] = [
  'conversation://', 'note://', 'project://',
];

export function hasAcceptedPrefix(value: string, prefixes: readonly string[]): boolean {
  const trimmed = value.trim();
  if (/\s/.test(trimmed)
    || !prefixes.some((prefix) => trimmed.startsWith(prefix) && trimmed.length > prefix.length)) return false;
  if (trimmed.startsWith('curriculum/')) {
    const path = trimmed.split('#', 1)[0] ?? '';
    return !path.includes('\\') && path.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
  }
  return true;
}
