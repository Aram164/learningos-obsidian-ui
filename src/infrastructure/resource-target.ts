import type { ProjectionRecord } from '../contracts/manifest';
import { safeWebUrl } from '../security/safe-url';

/**
 * Whether a projected path names one file rather than a source collection.
 * Collection directories are useful in Library, but they are never an exact
 * stage-resource target and must not masquerade as one.
 */
export function isFileShapedPath(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const path = value.trim().split(/[?#]/, 1)[0] ?? '';
  const name = path.replace(/\\/g, '/').split('/').pop() ?? '';
  return /^[^./][^/]*\.[^./]+$/.test(name);
}

export function isDirectMaterialFileTarget(
  record: ProjectionRecord,
): boolean {
  return record.material_exists === true
    && isFileShapedPath(record.material_path);
}

/**
 * A physical PDF page a stage declares, or `null`.
 *
 * Opening the CLT lecture reached the right file and showed page 1 of 38,
 * leaving the learner to rediscover pages 20–22 by hand — the stage knew, and
 * the opening path did not carry it (audit
 * `workbench/audits/synthetic-learner-2026-09-12`, F07).
 *
 * The grammar is deliberately narrow, because the wrong page is worse than no
 * page. Core's locator convention marks physical pages by qualifying them:
 * `PDF pp. 20-22`, `physical PDF pp. 214–220`, `physical pp. 14–19`. A bare
 * `pp. 20-22`, a `§4.3`, and `slides 20-38` are printed labels or section
 * numbers, and a deck's printed slide number routinely differs from its
 * position in the file — the L08 route says so itself. Those return `null`:
 * this reads a declaration, it never infers one.
 *
 * **One match, qualifier included.** The first version tested for a qualifier
 * *somewhere* in the string and then extracted with a pattern whose qualifier
 * was optional, so the two could land on different numbers. Analysis Chapter
 * 01 — which declares both numberings, exactly the case F07 said to check —
 * reads `printed p. 1 (PDF p. 11)…` and returned physical page **1**, the
 * printed label, because it matched first while the `PDF` further along
 * satisfied the guard (review `workbench/audits/repair-review-2026-09-13`,
 * R2). The qualifier is now part of the single match that produces the page.
 */
export interface PageDestination {
  /** The page to open at: the first of a declared range. */
  page: number;
  /** How to say it to a reader, e.g. "physical pages 20–22". */
  label: string;
}

/**
 * `physical p. 14`, `PDF pp. 20-22`, `physical PDF pages 214–220`.
 *
 * The qualifier is required and adjacent, and it is part of the one match that
 * yields the page — there is no optional branch that could match an
 * unqualified number. The trailing range accepts only a bare second number
 * directly after a dash, which is how a single-numbering locator writes a
 * span. A mixed-numbering locator such as `printed p. 1 (PDF p. 11)–printed
 * p. 6 (PDF p. 16)` therefore yields the opening physical page and no span:
 * page 11 is exactly right, and claiming "pages 11–16" from a string that
 * interleaves two numbering systems would be guessing again.
 */
const QUALIFIED_PAGES =
  /(?:physical\s+PDF|physical|PDF)\s+(?:p{1,2}\.|pages?)\s*(\d{1,4})(?:\s*[-–—]\s*(\d{1,4}))?/i;

export function pageDestination(record: ProjectionRecord): PageDestination | null {
  const target = typeof record.material_path === 'string' ? record.material_path
    : typeof record.vault_path === 'string' ? record.vault_path : '';
  if (!/\.pdf$/i.test(target.trim().split(/[?#]/, 1)[0] ?? '')) return null;
  const locator = typeof record.locator === 'string' ? record.locator : '';
  const match = QUALIFIED_PAGES.exec(locator);
  if (!match) return null;
  const first = Number(match[1]);
  const last = match[2] ? Number(match[2]) : null;
  if (!Number.isInteger(first) || first < 1) return null;
  // A descending or equal-bounds "range" is malformed; take the opening page
  // rather than inventing a span the locator does not describe.
  if (last !== null && (!Number.isInteger(last) || last <= first)) {
    return { page: first, label: `physical page ${first}` };
  }
  return {
    page: first,
    label: last === null
      ? `physical page ${first}`
      : `physical pages ${first}–${last}`,
  };
}

/** Keep rendered Open actions aligned with ResourceOpener's safe precedence. */
export function hasDirectResourceTarget(
  record: ProjectionRecord,
): boolean {
  if (isDirectMaterialFileTarget(record)) return true;

  const vaultPath = typeof record.vault_path === 'string'
    ? record.vault_path.trim()
    : '';
  if (
    vaultPath
    && !vaultPath.toLowerCase().startsWith('material://')
    && isFileShapedPath(vaultPath)
  ) return true;

  return safeWebUrl(record.url) !== null;
}
