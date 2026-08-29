#!/usr/bin/env node
/*
 * Read-only live-Obsidian verification (release-hardening Phase 7).
 *
 * Everything a headless test can prove, it already does. What none of them
 * can prove is that the actual, currently-running Obsidian process — the one
 * a real session would use — has reloaded the exact clean pair this release
 * built, is free of new JavaScript errors, and renders Home and Diagnostics
 * once each. This script asks the free CLI Obsidian 1.12.7 ships
 * (https://obsidian.md/help/cli) to answer exactly that, using only the
 * commands in HARD_ALLOWED_COMMANDS below. It never creates, edits, or
 * deletes a note or a setting.
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
export const HARD_ALLOWED_COMMANDS = new Set([
  'version', 'plugins', 'plugins:enabled', 'commands',
  'plugin:reload', 'command', 'dev:dom', 'dev:errors', 'dev:screenshot',
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

/** Exactly one command must match `id`. Ambiguous or missing both refuse. */
export function resolveCommandId(commands, id) {
  const matches = commands.filter((entry) => entry.id === id);
  if (matches.length === 0) {
    throw new LiveAppCheckError(`no registered command has id "${id}"`);
  }
  if (matches.length > 1) {
    throw new LiveAppCheckError(`command id "${id}" is ambiguous (${matches.length} matches)`);
  }
  return matches[0].id;
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

/** Only entries present in `after` but not in `before` are "new". */
export function newErrors(before, after) {
  const seen = new Set(before);
  return after.filter((entry) => !seen.has(entry));
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
  const finalArgs = vaultName ? [...args, `vault=${vaultName}`] : args;
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
  const coreSha = flag('core-sha');
  const uiSha = flag('ui-sha');
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

  const commands = parseCommandList(runCli(binary, ['commands'], cliOptions));
  const homeCommand = resolveCommandId(commands, 'open-home');
  const diagnosticsCommand = resolveCommandId(commands, 'open-diagnostics');

  const errorsBefore = parseCommandList(runCli(binary, ['dev:errors'], cliOptions)).map((e) => e.id);
  runCli(binary, ['plugin:reload', REQUIRED_PLUGIN_ID], cliOptions);

  runCli(binary, ['command', homeCommand], cliOptions);
  const homeDom = runCli(binary, ['dev:dom'], cliOptions);
  assertExactlyOne(homeDom, 'los-home');
  assertExactlyOne(homeDom, 'los-app-nav');
  if (evidenceDir) {
    fs.mkdirSync(evidenceDir, { recursive: true });
    runCli(binary, ['dev:screenshot', path.join(evidenceDir, 'home.png')], cliOptions);
  }

  runCli(binary, ['command', diagnosticsCommand], cliOptions);
  const diagnosticsDom = runCli(binary, ['dev:dom'], cliOptions);
  assertExactlyOne(diagnosticsDom, 'los-diagnostics-view');
  if (evidenceDir) {
    runCli(binary, ['dev:screenshot', path.join(evidenceDir, 'diagnostics.png')], cliOptions);
  }

  const errorsAfter = parseCommandList(runCli(binary, ['dev:errors'], cliOptions)).map((e) => e.id);
  const introduced = newErrors(errorsBefore, errorsAfter);
  if (introduced.length) {
    throw new LiveAppCheckError(`new JavaScript error(s) after reload: ${introduced.join('; ')}`);
  }

  const result = redactDiagnostics({
    manifestContract: 8,
    coreRevision: coreSha ?? null,
    uiRevision: uiSha ?? null,
  });
  console.log(JSON.stringify({ ok: true, appVersion: version, plugin: learningos, ...result }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`check-live-app: ${error.message}`);
    process.exitCode = 1;
  });
}
