#!/usr/bin/env node
/*
 * Read-only live-Obsidian verification (release-hardening Phase 7).
 *
 * Everything a headless test can prove, it already does. What none of them
 * can prove is that the actual, currently-running Obsidian process — the one
 * a real session would use — is running the exact clean pair this release
 * built and is free of new JavaScript errors. This script asks the free CLI
 * Obsidian 1.12.7 ships (https://obsidian.md/help/cli) to answer exactly
 * that, using only the commands in HARD_ALLOWED_COMMANDS below. It never
 * creates, edits, or deletes a note or a setting.
 *
 * It is strictly an observer, and that is a correction: it used to reload the
 * plugin and navigate to each view. Reloading runs startup recovery, which
 * can replay a prepared Gateway envelope — a real canonical write performed
 * by a verification script — and navigating persists UI route state. So the
 * operator opens Diagnostics in the target vault first, and this script only
 * reads what is already on screen.
 *
 * It also proves identity rather than restating it. It used to copy the
 * caller's own --core-sha/--ui-sha into an {ok:true} result and emit a
 * hardcoded manifest contract, so an arbitrary wrong pair could be reported
 * as verified. Every value it now reports is extracted from the live
 * Diagnostics DOM and compared against the requested pair.
 *
 * KNOWN PLAN DEFECT THIS FIXES: earlier drafts ran the CLI from wherever this
 * script happened to be invoked (typically `obsidian-ui/`, which is not a
 * vault at all). The Obsidian CLI resolves an unspecified vault from
 * whichever vault the GUI currently has open — silently the wrong one on any
 * machine running more than one vault, or simply undefined when none is
 * frontmost. Every invocation below is therefore run with `cwd` set to the
 * Core vault root, and an explicit `--vault-name` also appends `vault=<name>`
 * to each command as a second, independent way of naming the target — so
 * naming the vault does not depend on npm's working directory or on the GUI's
 * current focus.
 *
 * The exact flag names and output shapes of `obsidian-cli` could not be
 * verified while writing this: the CLI is disabled on this machine (Settings
 * → General → Command line interface), which is itself the command-resolution
 * fallback this script is written to respect rather than bypass. The pure
 * logic below (allowlist enforcement, command-id resolution, DOM-count
 * assertion, error-buffer diffing, metadata redaction) is fully unit-tested
 * in tests/test-live-app-check.js against synthetic CLI output shaped to the
 * plan's own description of the CLI. The thin `spawnSync` glue that actually
 * shells out is the one part that may need adjustment once this runs against
 * the real CLI for the first time (Phase 15) — expect to iterate here.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REQUIRED_APP_VERSION = '1.12.7';
export const REQUIRED_PLUGIN_ID = 'learningos-ui';
export const REQUIRED_PLUGIN_VERSION = '2.0.0';

// Every command this driver may ever pass to obsidian-cli. Nothing outside
// this set is dispatched, regardless of what a caller or a discovery result
// asks for.
//
// `plugin:reload` and `command` are deliberately absent. Reloading the plugin
// runs startup recovery, which can replay a prepared Gateway envelope — an
// actual canonical write performed by a script whose entire purpose is to
// observe. Navigating persists UI route state. Neither is read-only, so this
// driver does not get to do either: the operator opens Diagnostics in the
// target vault first, and inspection here is pure observation.
export const HARD_ALLOWED_COMMANDS = new Set([
  'version', 'plugins', 'plugins:enabled', 'commands',
  'dev:dom', 'dev:errors', 'dev:screenshot',
]);

// Substrings that must never appear anywhere in a dispatched command line —
// including inside an argument, such as an Obsidian command id passed to
// `command`. Matched case-insensitively.
const HARD_FORBIDDEN_TOKENS = [
  'eval', 'create', 'append', 'prepend', 'move', 'rename', 'delete',
  'sync', 'publish',
];

export class LiveAppCheckError extends Error {}

/**
 * Command-resolution order (plan §Phase 7): explicit override, then an
 * already-registered `obsidian` on PATH, then the bundled CLI binary Obsidian
 * 1.12.7 ships, then refuse. Never installs a CLI or creates a symlink.
 */
export function resolveObsidianCli(env = process.env) {
  if (env.OBSIDIAN_CLI) {
    return fs.existsSync(env.OBSIDIAN_CLI) ? env.OBSIDIAN_CLI : null;
  }
  const onPath = spawnSync('command', ['-v', 'obsidian'], { shell: true, encoding: 'utf8' });
  if (onPath.status === 0 && onPath.stdout.trim()) return onPath.stdout.trim();
  const bundled = '/Applications/Obsidian.app/Contents/MacOS/obsidian-cli';
  return fs.existsSync(bundled) ? bundled : null;
}

/** Refuse anything not on the hard allowlist, or shaped like a write. */
export function assertAllowedCommand(args) {
  const [command, ...rest] = args;
  if (!HARD_ALLOWED_COMMANDS.has(command)) {
    throw new LiveAppCheckError(`refusing a command not on the live-check allowlist: ${command}`);
  }
  const joined = args.join(' ').toLowerCase();
  const hit = HARD_FORBIDDEN_TOKENS.find((token) => joined.includes(token));
  if (hit) {
    throw new LiveAppCheckError(
      `refusing a write-shaped obsidian-cli invocation (matched "${hit}"): ${args.join(' ')}`,
    );
  }
}

/**
 * `commands` is expected to report every registered command id and name.
 * Accepts either a JSON array of `{id, name}` or one `id<TAB>name` per line —
 * whichever shape the real CLI turns out to use, this survives.
 */
export function parseCommandList(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry) => ({ id: String(entry.id ?? ''), name: String(entry.name ?? '') }))
        .filter((entry) => entry.id);
    }
  } catch (_) {
    // Not JSON — fall through to line parsing.
  }
  return trimmed.split('\n')
    .map((line) => line.split('\t'))
    .filter((parts) => parts[0] && parts[0].trim())
    .map(([id, name = '']) => ({ id: id.trim(), name: name.trim() }));
}

/**
 * Count occurrences of each required CSS class in a DOM snapshot.
 *
 * `dev:dom` is assumed to return serialized HTML (a `class="…"` attribute
 * grammar), which is the only shape a `class` selector can be verified
 * against without adding an HTML-parsing dependency to a release-safety
 * script. Class names inside a `class` attribute are matched as whole tokens,
 * never as a substring of a longer class name.
 */
export function countDomClass(html, className) {
  const attributeValues = [...html.matchAll(/class="([^"]*)"/g)].map((match) => match[1]);
  return attributeValues.filter((value) => value.split(/\s+/).includes(className)).length;
}

export function assertExactlyOne(html, className) {
  const count = countDomClass(html, className);
  if (count !== 1) {
    throw new LiveAppCheckError(`expected exactly one .${className}, found ${count}`);
  }
}

/**
 * New errors, counted by multiplicity rather than by set membership.
 *
 * Set membership silently hid a real regression: an error that had already
 * happened once and then happened *again* was reported as nothing new, even
 * though a second identical failure is exactly the signal this check exists to
 * catch. Each occurrence beyond the count already present in `before` is
 * returned.
 */
export function newErrors(before, after) {
  const remaining = new Map();
  for (const entry of before) remaining.set(entry, (remaining.get(entry) ?? 0) + 1);
  const introduced = [];
  for (const entry of after) {
    const budget = remaining.get(entry) ?? 0;
    if (budget > 0) remaining.set(entry, budget - 1);
    else introduced.push(entry);
  }
  return introduced;
}

/**
 * The manifest contract this build declares, as a string.
 *
 * Read from the built `plugin/build-info.json` rather than repeated as a
 * literal here: the version already lives in Core's manifest-contract.yaml and
 * in the UI's own constant, and a third hand-maintained copy would silently
 * keep demanding the old number the next time the contract is bumped.
 * build-info.json is generated from Core's declaration, so it cannot drift.
 */
export function declaredManifestContract(root) {
  const buildInfoPath = path.join(root, 'plugin', 'build-info.json');
  let parsed = null;
  try {
    parsed = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
  } catch (error) {
    throw new LiveAppCheckError(`cannot read ${buildInfoPath}: ${error.message}`);
  }
  if (!Number.isInteger(parsed?.manifest_contract_version)) {
    throw new LiveAppCheckError(
      `${buildInfoPath} declares no integer manifest_contract_version`,
    );
  }
  return String(parsed.manifest_contract_version);
}

/** A full 40-character lowercase hex commit SHA, or a refusal. */
export function requireFullSha(value, label) {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/.test(value)) {
    throw new LiveAppCheckError(
      `--${label} must be exactly 40 lowercase hexadecimal characters`,
    );
  }
  return value;
}

/**
 * Every machine-readable Diagnostics attribute, read out of a DOM snapshot.
 *
 * This is the driver's only source of truth about what is actually running.
 * It deliberately does not accept caller-supplied values as evidence: the
 * defect this replaces copied `--core-sha`/`--ui-sha` straight into an
 * `{ok:true}` result, so any pair of wrong SHAs could be attested as verified.
 */
export const DIAGNOSTICS_ATTRIBUTES = {
  manifestContract: 'data-los-manifest-contract',
  runtimeFingerprintMatches: 'data-los-runtime-fingerprint-matches',
  coreRevision: 'data-los-core-revision',
  uiRevision: 'data-los-ui-revision',
  coreDirty: 'data-los-core-dirty',
  sourceDirty: 'data-los-ui-dirty',
  gatewayRecoveryClear: 'data-los-gateway-recovery-clear',
};

export function extractDiagnostics(html) {
  const found = {};
  for (const [field, attribute] of Object.entries(DIAGNOSTICS_ATTRIBUTES)) {
    const matches = [...html.matchAll(
      new RegExp(`${attribute}="([^"]*)"`, 'g'),
    )].map((match) => match[1]);
    if (matches.length === 0) {
      throw new LiveAppCheckError(
        `Diagnostics did not report ${attribute}; open Diagnostics in the target vault first`,
      );
    }
    if (matches.length > 1) {
      throw new LiveAppCheckError(
        `Diagnostics reported ${attribute} ${matches.length} times; the DOM is ambiguous`,
      );
    }
    found[field] = matches[0];
  }
  return found;
}

/**
 * The live app must be the exact clean pair the caller named, on the current
 * contract, with nothing unresolved. Each condition refuses on its own; an
 * "unknown" dirty flag is a refusal too, because unknown is never clean.
 */
export function assertLiveIdentity(diagnostics, { coreSha, uiSha, manifestContract }) {
  if (diagnostics.coreRevision !== coreSha) {
    throw new LiveAppCheckError(
      'the running app reports a different Core revision than the one requested',
    );
  }
  if (diagnostics.uiRevision !== uiSha) {
    throw new LiveAppCheckError(
      'the running app reports a different UI revision than the one requested',
    );
  }
  if (diagnostics.runtimeFingerprintMatches !== 'yes') {
    throw new LiveAppCheckError(
      'the running code does not match the installed build-info; reload learningos-ui',
    );
  }
  if (diagnostics.coreDirty !== 'false') {
    throw new LiveAppCheckError(
      `the Core working tree is not proven clean (reported ${diagnostics.coreDirty})`,
    );
  }
  if (diagnostics.sourceDirty !== 'false') {
    throw new LiveAppCheckError(
      `the UI working tree is not proven clean (reported ${diagnostics.sourceDirty})`,
    );
  }
  if (diagnostics.manifestContract !== manifestContract) {
    throw new LiveAppCheckError(
      `the running app reports manifest contract ${diagnostics.manifestContract}, `
      + `expected ${manifestContract}`,
    );
  }
  if (diagnostics.gatewayRecoveryClear !== 'yes') {
    throw new LiveAppCheckError(
      'the running app has an unresolved Gateway recovery record',
    );
  }
}

/** Semver-lite: major.minor.patch, no pre-release/build metadata. */
function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(value ?? '').trim());
  if (!match) return null;
  return match.slice(1, 4).map(Number);
}

export function versionAtLeast(actual, required) {
  const a = parseVersion(actual);
  const r = parseVersion(required);
  if (!a || !r) return false;
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== r[i]) return a[i] > r[i];
  }
  return true;
}

export function versionExactly(actual, required) {
  return String(actual ?? '').trim() === String(required ?? '').trim();
}

/**
 * Diagnostics reports safe metadata only. This is the redaction boundary for
 * this driver's own JSON result — it must never carry captured text, a local
 * file path, or any field this allowlist does not name, no matter what the
 * live DOM actually contained.
 */
const SAFE_DIAGNOSTICS_FIELDS = [
  'manifestContract', 'runtimeFingerprintMatches', 'coreRevision', 'uiRevision',
  'coreDirty', 'sourceDirty', 'gatewayRecoveryClear',
];

export function redactDiagnostics(value) {
  const safe = {};
  for (const field of SAFE_DIAGNOSTICS_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(value ?? {}, field)) safe[field] = value[field];
  }
  return safe;
}

function runCli(binary, args, { cwd, vaultName, timeout = 30000 } = {}) {
  assertAllowedCommand(args);
  const finalArgs = vaultName ? [`vault=${vaultName}`, ...args] : args;
  const result = spawnSync(binary, finalArgs, { cwd, encoding: 'utf8', timeout });
  if (result.error) {
    throw new LiveAppCheckError(`obsidian-cli could not be run: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new LiveAppCheckError(
      `obsidian-cli ${finalArgs.join(' ')} exited ${result.status}: ${result.stderr || result.stdout}`,
    );
  }
  return result.stdout;
}

async function main() {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const args = process.argv.slice(2);
  const flag = (name) => {
    const index = args.indexOf(`--${name}`);
    return index === -1 ? null : args[index + 1];
  };
  const coreSha = requireFullSha(flag('core-sha'), 'core-sha');
  const uiSha = requireFullSha(flag('ui-sha'), 'ui-sha');
  const evidenceDir = flag('evidence-dir');
  const vaultPath = path.resolve(flag('vault') || path.join(path.dirname(root), 'repository'));
  const vaultName = path.basename(vaultPath);

  const binary = resolveObsidianCli();
  if (!binary) {
    console.log('check-live-app: the Obsidian CLI is not available.');
    console.log('check-live-app: enable it in Obsidian: Settings → General → Command line interface.');
    console.log('check-live-app: this script never installs a CLI or creates a symlink automatically.');
    process.exitCode = 2;
    return;
  }
  console.log(
    'check-live-app: open Diagnostics in the target vault before running this — '
    + 'this check only observes and will not navigate or reload for you.',
  );
  const cliOptions = { cwd: vaultPath, vaultName };

  const version = runCli(binary, ['version'], cliOptions).trim();
  if (!versionAtLeast(version, REQUIRED_APP_VERSION)) {
    throw new LiveAppCheckError(`Obsidian ${version} does not meet the required ${REQUIRED_APP_VERSION}`);
  }

  const enabledPlugins = parseCommandList(runCli(binary, ['plugins:enabled'], cliOptions));
  const learningos = enabledPlugins.find((entry) => entry.id === REQUIRED_PLUGIN_ID);
  if (!learningos) {
    throw new LiveAppCheckError(`${REQUIRED_PLUGIN_ID} is not installed and enabled`);
  }
  if (!versionExactly(learningos.name, REQUIRED_PLUGIN_VERSION)) {
    throw new LiveAppCheckError(
      `${REQUIRED_PLUGIN_ID} is at ${learningos.name}, expected exactly ${REQUIRED_PLUGIN_VERSION}`,
    );
  }

  // No reload and no navigation: the operator must already have Diagnostics
  // open in the target vault. Both of those commands change state — a reload
  // can replay a prepared Gateway envelope into a real canonical write, and
  // navigating persists route state — and this driver only observes.
  const errorsBefore = parseCommandList(runCli(binary, ['dev:errors'], cliOptions)).map((e) => e.id);

  const diagnosticsDom = runCli(binary, ['dev:dom'], cliOptions);
  assertExactlyOne(diagnosticsDom, 'los-diagnostics-view');
  const diagnostics = extractDiagnostics(diagnosticsDom);
  assertLiveIdentity(diagnostics, {
    coreSha, uiSha, manifestContract: declaredManifestContract(root),
  });
  if (evidenceDir) {
    fs.mkdirSync(evidenceDir, { recursive: true });
    runCli(binary, ['dev:screenshot', path.join(evidenceDir, 'diagnostics.png')], cliOptions);
  }

  const errorsAfter = parseCommandList(runCli(binary, ['dev:errors'], cliOptions)).map((e) => e.id);
  const introduced = newErrors(errorsBefore, errorsAfter);
  if (introduced.length) {
    throw new LiveAppCheckError(`new JavaScript error(s) during the check: ${introduced.join('; ')}`);
  }

  // The extracted live values, never the caller's arguments: echoing the
  // inputs back would make any wrong pair look verified.
  const result = redactDiagnostics(diagnostics);
  console.log(JSON.stringify({ ok: true, appVersion: version, plugin: learningos, ...result }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`check-live-app: ${error.message}`);
    process.exitCode = 1;
  });
}
