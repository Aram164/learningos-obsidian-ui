import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as nodePath from 'node:path';
import process from 'node:process';
import { runtimeSourceFingerprint } from '../build-identity';
import { TRACE_OWNERSHIP_ENV, ownershipMarkerForTraceparent } from './trace-context';

export interface PythonResolution {
  readonly path: string;
  readonly origin: string;
  readonly attempted: string[];
}

export type LosCallback = (
  error: Error | null,
  stdout: string,
  stderr: string,
) => void;

/** The environment variable naming the calling session to Core. */
export const SESSION_ID_ENV = 'LOS_SESSION_ID';

/**
 * This UI's session identity, stamped on every Core child it spawns. One
 * stable value — not per launch — so writes from an earlier launch are still
 * this session's rows when the learner reviews them, and so no UI write ever
 * lands in an agent session's ledger (or vice versa).
 */
export const UI_SESSION_ID = 'ui';

/** The environment variable naming the Core client and its build. */
export const CLIENT_ENV = 'LOS_CLIENT';

/**
 * This running bundle's client marker, stamped on every Core child it
 * spawns. The build is the compiled-in source fingerprint, so Core can
 * tell a current UI from an outdated installed build (or an unmarked
 * terminal agent) instead of guessing its identity. An unmarked call
 * stays valid — the marker is informational, never a refusal input.
 */
export function uiClientMarker(): string {
  return `obsidian-ui/${runtimeSourceFingerprint()}`;
}

const CORE_CHILD_ENV_ALLOWLIST: ReadonlySet<string> = new Set([
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'TERM',
  'TZ',
  'TMPDIR',
  'TEMP',
  'TMP',
  'LANG',
  'LANGUAGE',
  'SYSTEMROOT',
  'COMSPEC',
  'WINDIR',
  'PATHEXT',
  'APPDATA',
  'LOCALAPPDATA',
  'USERPROFILE',
  'HOMEDRIVE',
  'HOMEPATH',
  'PROGRAMDATA',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
  'REQUESTS_CA_BUNDLE',
  'CURL_CA_BUNDLE',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'ALL_PROXY',
  'XDG_CONFIG_HOME',
  'XDG_CACHE_HOME',
  'XDG_DATA_HOME',
  'XDG_RUNTIME_DIR',
  'PYTHONUTF8',
  'PYTHONIOENCODING',
  'PYTHONDONTWRITEBYTECODE',
  'PYTHONNOUSERSITE',
  'VIRTUAL_ENV',
  'SSH_AUTH_SOCK',
]);

function isAllowedCoreEnvKey(key: string): boolean {
  const upper = key.toUpperCase();
  if (upper.startsWith('LOS_') || upper.startsWith('GIT_')) return false;
  if (CORE_CHILD_ENV_ALLOWLIST.has(upper)) return true;
  return /^LC_[A-Z0-9_]+$/.test(upper);
}

/**
 * Build the strictly allowlisted child-process environment for Core.
 *
 * Ambient ``LOS_*`` variables (including ``LOS_OBSERVATIONS*``), ``GIT_*``
 * repository overrides (such as ``GIT_DIR`` and ``GIT_WORK_TREE``), and
 * ``TRACEPARENT`` are excluded before stamping the UI session identity,
 * client marker, and explicit dispatch trace context.
 */
export function buildCoreChildEnv(
  baseEnv: Record<string, string | undefined>,
  traceParent?: string,
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(baseEnv)) {
    if (value === undefined) continue;
    if (!isAllowedCoreEnvKey(key)) continue;
    env[key] = value;
  }
  env[SESSION_ID_ENV] = UI_SESSION_ID;
  env[CLIENT_ENV] = uiClientMarker();
  if (traceParent !== undefined) {
    env['TRACEPARENT'] = traceParent;
    const owned = ownershipMarkerForTraceparent(traceParent);
    if (owned !== null) {
      env[TRACE_OWNERSHIP_ENV] = owned;
    }
  }
  return env;
}

interface LosRuntimeHost {
  readonly vault: {
    readonly adapter: {
      getBasePath(): string;
    };
  };
}

/** Host-process adapter for the stable LearningOS CLI. */
export class LosRuntime {
  constructor(
    private readonly app: LosRuntimeHost,
    private readonly configuredPython: () => string,
  ) {}

  resolvePython(): PythonResolution {
    const base = this.app.vault.adapter.getBasePath();
    const configured = this.configuredPython().trim();
    const searchOrder: Array<readonly [string, string]> = [
      [configured, 'configured in settings'],
      [nodePath.join(base, '.venv', 'bin', 'python'), 'project virtual environment'],
      [nodePath.join(base, '.venv', 'Scripts', 'python.exe'), 'project virtual environment (Windows)'],
    ];
    const candidates = searchOrder.filter(([path]) => path);
    const attempted = candidates.map(([path]) => path);
    for (const [path, origin] of candidates) {
      if (fs.existsSync(path)) return { path, origin, attempted };
    }
    const fallback = process.platform === 'win32' ? 'python' : 'python3';
    return { path: fallback, origin: 'PATH fallback', attempted: [...attempted, fallback] };
  }

  /**
   * Run the CLI. Every child carries this UI's session identity and client
   * marker. `traceParent` carries one W3C traceparent for this exact
   * dispatch (research track #2, Phase 1): it travels as child-process
   * environment, never as CLI arguments or payload, and an absent value
   * leaves the child environment exactly as before. A present value also
   * carries the LearningOS-ownership marker, so Core adopts this
   * dispatch's operation as its own instead of minting a second one
   * (JF-04, Option A).
   */
  run(args: string[], callback: LosCallback, stdin?: string, traceParent?: string): void {
    const base = this.app.vault.adapter.getBasePath();
    const script = nodePath.join(base, 'tools', 'los.py');
    const child = execFile(
      this.resolvePython().path,
      [script, ...args],
      {
        cwd: base,
        timeout: 180000,
        maxBuffer: 8 * 1024 * 1024,
        env: buildCoreChildEnv(process.env, traceParent),
      },
      callback,
    );
    if (stdin !== undefined) child.stdin?.end(stdin);
  }
}
