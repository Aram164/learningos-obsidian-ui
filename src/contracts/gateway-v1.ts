/**
 * Contract for what the `los.py` CLI answers back.
 *
 * Everything here is untrusted input in the same sense that persisted
 * Obsidian state is: it arrives as parsed JSON from a separate process, so the
 * UI may not assume any field is present or well-typed. The readers at the
 * bottom are the sanctioned way to turn a result into something the product
 * layer can rely on.
 */

/** A parsed, non-refused CLI answer. Named fields are the ones every command shares. */
export interface GatewayResultV1 {
  ok?: boolean;
  error?: string;
  /** Populated only for the text-reporting commands invoked with `expectJson: false`. */
  stdout?: string;
  [key: string]: unknown;
}

/** The `session-end` answer, after narrowing. */
export interface SessionReviewV1 {
  owned_changes: string[];
  unrelated_changes: string[];
  pushed: boolean;
}

/** Keep only the strings; a malformed row must not reach the modal as `undefined`. */
export function asStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

/**
 * `session-end` decides what the learner is shown before a commit, so a
 * missing or malformed field must read as "nothing owned" rather than
 * silently rendering an empty section that looks authoritative.
 */
export function asSessionReview(result: GatewayResultV1): SessionReviewV1 {
  return {
    owned_changes: asStringList(result.owned_changes),
    unrelated_changes: asStringList(result.unrelated_changes),
    pushed: result.pushed === true,
  };
}
