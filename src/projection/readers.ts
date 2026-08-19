import type { ProjectionRecord } from '../contracts/manifest';

/** Runtime boundary for values arriving through the generated projection. */
export function isRecord(value: unknown): value is ProjectionRecord {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value);
}

export function asRecord(value: unknown): ProjectionRecord | null {
  return isRecord(value) ? value : null;
}

export function asRecordOrEmpty(value: unknown): ProjectionRecord {
  return asRecord(value) ?? {};
}

export function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function asText(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value);
  return text.length > 0 ? text : null;
}

export function asBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === 'true';
}

export function asRecords(value: unknown): ProjectionRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export function asStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
}

export function asTrimmedStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(asTrimmedString).filter(Boolean)
    : [];
}

export function asCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}

export function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function asNumber(value: unknown): number {
  return asFiniteNumber(value) ?? 0;
}

export function asNumbers(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((item): item is number => asFiniteNumber(item) !== null)
    : [];
}

export function asNumberRecord(value: unknown): Record<string, number> {
  const result: Record<string, number> = {};
  if (!isRecord(value)) return result;
  for (const [key, entry] of Object.entries(value)) {
    const number = asFiniteNumber(entry);
    if (number !== null) result[key] = number;
  }
  return result;
}

export function asListLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

export function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function asLabel(
  record: ProjectionRecord | null | undefined,
  fallback = 'Untitled',
): string {
  if (!record) return fallback;
  return asString(record.title)
    ?? asString(record.label)
    ?? asString(record.name)
    ?? asString(record.id)
    ?? fallback;
}

export function projectedString(
  record: ProjectionRecord | null | undefined,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export function projectedText(
  record: ProjectionRecord | null | undefined,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (Array.isArray(value)) {
      const text = value.filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim()).filter(Boolean).join(' · ');
      if (text) return text;
    }
  }
  return '';
}

export function projectedLabel(
  record: ProjectionRecord | null | undefined,
  fallback = 'Untitled',
): string {
  return projectedString(record, 'title', 'label', 'name', 'id') || fallback;
}

export function projectedRecords(
  record: ProjectionRecord | null | undefined,
  key: string,
): ProjectionRecord[] {
  const value = record?.[key];
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export function projectedStrings(
  record: ProjectionRecord | null | undefined,
  key: string,
): string[] {
  const value = record?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function projectedCount(
  record: ProjectionRecord | null | undefined,
  ...keys: string[]
): number | null {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

export function projectedFlag(
  record: ProjectionRecord | null | undefined,
  key: string,
): boolean {
  return record?.[key] === true;
}

export function projectedListLength(
  record: ProjectionRecord | null | undefined,
  key: string,
): number {
  const value = record?.[key];
  return Array.isArray(value) ? value.length : 0;
}
