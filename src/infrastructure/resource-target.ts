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
