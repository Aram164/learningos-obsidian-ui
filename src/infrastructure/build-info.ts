import * as fs from 'node:fs';
import * as nodePath from 'node:path';
import { CONTRACT_VERSION } from '../constants';
import { isRecord } from '../projection/readers';

export interface BuildInfo {
  readonly ui_version: string;
  readonly manifest_contract_version: number;
  readonly source_revision: string;
  /** null when the build could not ask Git — "unknown", not "clean". */
  readonly source_dirty: boolean | null;
  readonly source_committed_at: string;
  readonly source_fingerprint: string;
  readonly bundle_sha256: string;
  readonly node_version: string;
}

export interface ReadBuildInfoOptions {
  readonly basePath: string;
  readonly pluginDir?: string | undefined;
  readonly pluginId?: string | undefined;
  readonly uiVersion: string;
}

export function fallbackBuildInfo(uiVersion: string): BuildInfo {
  return {
    ui_version: uiVersion,
    manifest_contract_version: CONTRACT_VERSION,
    source_revision: 'unavailable',
    source_dirty: null,
    source_committed_at: 'unavailable',
    source_fingerprint: 'unavailable',
    bundle_sha256: 'unavailable',
    node_version: 'unavailable',
  };
}

/**
 * Read installed `build-info.json` beside the plugin bundle.
 *
 * Returns `'unavailable'` sentinels (and `source_dirty: null`, never false)
 * whenever the file is absent, unreadable, or malformed so Diagnostics stays
 * operational without guessing clean provenance.
 */
export function readBuildInfo(options: ReadBuildInfoOptions): BuildInfo {
  const fallback = fallbackBuildInfo(options.uiVersion);
  try {
    if (!options.basePath) return fallback;
    const directory = options.pluginDir
      || nodePath.join('.obsidian', 'plugins', options.pluginId || 'learningos-ui');
    const target = nodePath.join(options.basePath, directory, 'build-info.json');
    if (!fs.existsSync(target)) return fallback;

    const parsed: unknown = JSON.parse(fs.readFileSync(target, 'utf8'));
    if (!isRecord(parsed)) return fallback;

    return {
      ui_version:
        typeof parsed.ui_version === 'string'
          ? parsed.ui_version
          : fallback.ui_version,
      manifest_contract_version:
        typeof parsed.manifest_contract_version === 'number'
          ? parsed.manifest_contract_version
          : fallback.manifest_contract_version,
      source_revision:
        typeof parsed.source_revision === 'string'
          ? parsed.source_revision
          : fallback.source_revision,
      // A missing flag stays null: an older build-info predates the field,
      // and reading that absence as "clean" is the exact false reassurance
      // this row exists to remove.
      source_dirty:
        typeof parsed.source_dirty === 'boolean'
          ? parsed.source_dirty
          : fallback.source_dirty,
      source_committed_at:
        typeof parsed.source_committed_at === 'string'
          ? parsed.source_committed_at
          : fallback.source_committed_at,
      source_fingerprint:
        typeof parsed.source_fingerprint === 'string'
          ? parsed.source_fingerprint
          : fallback.source_fingerprint,
      bundle_sha256:
        typeof parsed.bundle_sha256 === 'string'
          ? parsed.bundle_sha256
          : fallback.bundle_sha256,
      node_version:
        typeof parsed.node_version === 'string'
          ? parsed.node_version
          : fallback.node_version,
    };
  } catch (_) {
    return fallback;
  }
}
