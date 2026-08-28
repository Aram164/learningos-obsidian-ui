export type LegacyArchiveDispositionV1 =
  | 'canonicalized'
  | 'byte-preserved'
  | 'superseded-system'
  | 'historical-only'
  | 'unresolved';

export interface LegacyArchiveEntryV1 {
  readonly relative_path: string;
  readonly size: number;
  readonly sha256: string;
  readonly category: string;
  readonly disposition: LegacyArchiveDispositionV1;
  readonly canonical_targets: readonly {
    readonly path: string;
    readonly exists: boolean;
    readonly checksum_matches: boolean | null;
    readonly sha256?: string | null;
  }[];
}

export interface LegacyArchiveLockV1 {
  readonly schema_version: 1;
  readonly id: 'legacy-archive-lock';
  readonly type: 'legacy-archive-lock';
  readonly created_at: string;
  readonly entries: readonly LegacyArchiveEntryV1[];
  readonly excluded: {
    readonly count: number;
    readonly status: 'sealed-not-inspected';
  };
  readonly verification: {
    readonly verified_at: string;
    readonly status: 'verified' | 'attention-required';
    readonly issues?: readonly string[];
  };
}

export interface LegacyArchiveStatusV1 {
  readonly schema_version: 1;
  readonly type: 'legacy-archive-status';
  readonly available: boolean;
  readonly lock: LegacyArchiveLockV1 | null;
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function exact(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key))
    && Object.keys(value).every((key) => allowed.has(key));
}

const sha256 = (value: unknown): value is string =>
  typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value);
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const dateTime = (value: unknown): value is string =>
  typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && Number.isFinite(Date.parse(value));
const natural = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;
const relativePath = (value: unknown): value is string =>
  text(value) && !value.startsWith('/') && !value.split('/').includes('..');

/** Strict decoder for system/schema/legacy-archive-lock.schema.json. */
export function asLegacyArchiveLock(value: unknown): LegacyArchiveLockV1 | null {
  const lock = record(value);
  if (!lock || !exact(lock, [
    'schema_version', 'id', 'type', 'created_at', 'entries', 'excluded', 'verification',
  ]) || lock.schema_version !== 1 || lock.id !== 'legacy-archive-lock'
    || lock.type !== 'legacy-archive-lock' || !dateTime(lock.created_at)
    || !Array.isArray(lock.entries)) return null;

  const dispositions: readonly LegacyArchiveDispositionV1[] = [
    'canonicalized', 'byte-preserved', 'superseded-system', 'historical-only', 'unresolved',
  ];
  const entries: LegacyArchiveEntryV1[] = [];
  for (const valueEntry of lock.entries) {
    const entry = record(valueEntry);
    if (!entry || !exact(entry, [
      'relative_path', 'size', 'sha256', 'category', 'disposition', 'canonical_targets',
    ]) || !relativePath(entry.relative_path) || !natural(entry.size)
      || !sha256(entry.sha256) || !text(entry.category)
      || !dispositions.includes(entry.disposition as LegacyArchiveDispositionV1)
      || !Array.isArray(entry.canonical_targets)) return null;
    const targets: LegacyArchiveEntryV1['canonical_targets'][number][] = [];
    for (const valueTarget of entry.canonical_targets) {
      const target = record(valueTarget);
      if (!target || !exact(
        target,
        ['path', 'exists', 'checksum_matches'],
        ['sha256'],
      ) || !relativePath(target.path) || typeof target.exists !== 'boolean'
        || !(typeof target.checksum_matches === 'boolean' || target.checksum_matches === null)
        || ('sha256' in target && target.sha256 !== null && !sha256(target.sha256))) return null;
      targets.push({
        path: target.path,
        exists: target.exists,
        checksum_matches: target.checksum_matches,
        ...('sha256' in target ? { sha256: target.sha256 as string | null } : {}),
      });
    }
    entries.push({
      relative_path: entry.relative_path,
      size: entry.size,
      sha256: entry.sha256,
      category: entry.category,
      disposition: entry.disposition as LegacyArchiveDispositionV1,
      canonical_targets: targets,
    });
  }

  const excluded = record(lock.excluded);
  const verification = record(lock.verification);
  if (!excluded || !exact(excluded, ['count', 'status'])
    || !natural(excluded.count) || excluded.status !== 'sealed-not-inspected'
    || !verification || !exact(verification, ['verified_at', 'status'], ['issues'])
    || !dateTime(verification.verified_at)
    || !['verified', 'attention-required'].includes(String(verification.status))
    || ('issues' in verification && (!Array.isArray(verification.issues)
      || !verification.issues.every(text)))) return null;

  return {
    schema_version: 1,
    id: 'legacy-archive-lock',
    type: 'legacy-archive-lock',
    created_at: lock.created_at,
    entries,
    excluded: { count: excluded.count, status: 'sealed-not-inspected' },
    verification: {
      verified_at: verification.verified_at,
      status: verification.status as 'verified' | 'attention-required',
      ...(Array.isArray(verification.issues)
        ? { issues: verification.issues as string[] }
        : {}),
    },
  };
}

/** Strict decoder for system/schema/legacy-archive-status.schema.json. */
export function asLegacyArchiveStatus(value: unknown): LegacyArchiveStatusV1 | null {
  const status = record(value);
  if (!status || !exact(status, ['schema_version', 'type', 'available', 'lock'])
    || status.schema_version !== 1 || status.type !== 'legacy-archive-status'
    || typeof status.available !== 'boolean') return null;
  const lock = status.lock === null ? null : asLegacyArchiveLock(status.lock);
  if (status.lock !== null && lock === null) return null;
  if (status.available !== (lock !== null)) return null;
  return {
    schema_version: 1,
    type: 'legacy-archive-status',
    available: status.available,
    lock,
  };
}
