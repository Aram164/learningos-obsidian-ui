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

/**
 * Documented CLI exit codes (`los.py --help`): 0 ok · 1 validation errors ·
 * 2 usage/environment error · 3 optimistic-concurrency conflict.
 *
 * 3 is the one the interface has to understand rather than merely report: it
 * means the authored tree moved on since the projection the app is holding was
 * built — normally because a Claude session, or the learner in the editor,
 * changed canonical files. Matching on the code rather than the message keeps
 * this bound to the CLI's stated contract instead of its prose.
 */
export const EXIT_PROJECTION_CONFLICT = 3;

/**
 * A refusal carries its reason on stdout as JSON, even when the process exits
 * non-zero. Keeping the exit code alongside the message is what lets the caller
 * tell "this write was refused because the projection is behind" apart from
 * "the interpreter is missing" — the first is recoverable, the second is not.
 */
export class GatewayError extends Error {
  readonly exitCode: number | null;
  constructor(message: string, exitCode: number | null = null) {
    super(message);
    this.name = 'GatewayError';
    this.exitCode = exitCode;
  }
  get isProjectionConflict(): boolean {
    return this.exitCode === EXIT_PROJECTION_CONFLICT;
  }
}

/** True for the one failure the app can recover from on the learner's behalf. */
export function isProjectionConflict(error: unknown): boolean {
  return error instanceof GatewayError && error.isProjectionConflict;
}

/**
 * `execFile` reports a non-zero exit as an `Error` whose `code` is that exit
 * status. It is `unknown` to this layer, so read it defensively.
 */
export function exitCodeOf(error: unknown): number | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'number' ? code : null;
}

/**
 * The CLI answers a refusal with a JSON body on stdout and, in the common
 * case, nothing on stderr. Preferring stderr therefore discarded the only
 * useful sentence and surfaced Node's generic "Command failed: python …"
 * instead. Read the body first; fall back only when there is no body to read.
 */
export function structuredError(stdout: string): string {
  const raw = String(stdout ?? '').trim();
  if (!raw) return '';
  try {
    const parsed: unknown = JSON.parse(raw);
    const message = (parsed as { error?: unknown } | null)?.error;
    return typeof message === 'string' ? message.trim() : '';
  } catch (_) {
    return '';
  }
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
