import fs from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const entry = 'src/main.ts';

const NODE_BUILTINS = new Set([
  'assert',
  'async_hooks',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'diagnostics_channel',
  'dns',
  'domain',
  'events',
  'fs',
  'fs/promises',
  'http',
  'http2',
  'https',
  'inspector',
  'module',
  'net',
  'os',
  'path',
  'path/posix',
  'path/win32',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'sys',
  'timers',
  'tls',
  'trace_events',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'wasi',
  'worker_threads',
  'zlib',
  ...builtinModules,
]);

const NO_VIEW_IMPORT_PREFIXES = [
  'src/contracts/',
  'src/projection/',
  'src/application/',
  'src/designs/',
  'src/features/',
];

function isNodeBuiltinSpecifier(specifier) {
  if (specifier.startsWith('node:')) return true;
  if (NODE_BUILTINS.has(specifier)) return true;
  const bare = specifier.split('/')[0];
  return NODE_BUILTINS.has(bare);
}

function isHostAdapterModule(source) {
  return (
    source === 'src/main.ts'
    || source === 'src/gateway-client.ts'
    || source.startsWith('src/infrastructure/')
  );
}

function sourceModules(targetRoot, directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entryValue) => {
      const absolute = path.join(directory, entryValue.name);
      if (entryValue.isDirectory()) return sourceModules(targetRoot, absolute);
      if (!entryValue.isFile()) return [];
      if (entryValue.name.endsWith('.d.ts') || entryValue.name.endsWith('.d.cts')) return [];
      const relative = path.relative(targetRoot, absolute).split(path.sep).join('/');
      // The generated contract metadata module is a build-time/verification constant
      // emitter not imported by the runtime entrypoint. Exclude only this exact
      // generated file; any other *.meta.ts source file must remain strictly
      // subject to source-graph reachability and boundary enforcement.
      if (relative === 'src/contracts/generated/manifest.meta.ts') return [];
      if (!entryValue.name.endsWith('.ts') && !entryValue.name.endsWith('.cjs')) return [];
      return [relative];
    });
}

function resolveInternal(targetRoot, importer, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.posix.normalize(
    path.posix.join(path.posix.dirname(importer), specifier),
  );
  const candidates = base.endsWith('.ts') || base.endsWith('.cjs')
    ? [base]
    : [`${base}.ts`, path.posix.join(base, 'index.ts'), `${base}.cjs`];
  const resolved = candidates.find((candidate) =>
    fs.existsSync(path.join(targetRoot, candidate)));
  if (!resolved) {
    throw new Error(`Cannot resolve ${JSON.stringify(specifier)} from ${importer}.`);
  }
  if (!resolved.startsWith('src/')) {
    throw new Error(`${importer} imports source outside src/: ${resolved}.`);
  }
  return resolved;
}

function dependencyCycles(dependencies) {
  let nextIndex = 0;
  const indexes = new Map();
  const lowlinks = new Map();
  const stack = [];
  const onStack = new Set();
  const cycles = [];

  function visit(source) {
    indexes.set(source, nextIndex);
    lowlinks.set(source, nextIndex);
    nextIndex += 1;
    stack.push(source);
    onStack.add(source);

    for (const dependency of [...(dependencies.get(source) ?? [])].sort()) {
      if (!indexes.has(dependency)) {
        visit(dependency);
        lowlinks.set(
          source,
          Math.min(lowlinks.get(source), lowlinks.get(dependency)),
        );
      } else if (onStack.has(dependency)) {
        lowlinks.set(
          source,
          Math.min(lowlinks.get(source), indexes.get(dependency)),
        );
      }
    }

    if (lowlinks.get(source) !== indexes.get(source)) return;
    const component = [];
    while (stack.length) {
      const dependency = stack.pop();
      onStack.delete(dependency);
      component.push(dependency);
      if (dependency === source) break;
    }
    if (component.length > 1) cycles.push(component.sort());
  }

  for (const source of [...dependencies.keys()].sort()) {
    if (!indexes.has(source)) visit(source);
  }
  return cycles.sort((left, right) => left[0].localeCompare(right[0]));
}

export function checkSourceGraph(targetRoot = root) {
  const sourceRoot = path.join(targetRoot, 'src');
  // Declaration files are compiler-owned host augmentation. Every other source
  // module, including a type-only feature port, must have an explicit path from
  // the application entrypoint.
  const sources = sourceModules(targetRoot, sourceRoot).sort();
  const sourceSet = new Set(sources);
  if (!sourceSet.has(entry)) {
    throw new Error(`Runtime entrypoint ${entry} is missing.`);
  }

  const graph = new Map();
  const forbidden = [];
  const disallowedNodeImports = [];

  for (const source of sources) {
    const text = fs.readFileSync(path.join(targetRoot, source), 'utf8');
    const importedFiles = ts.preProcessFile(text, true, true).importedFiles;
    const dependencies = importedFiles
      .map(({ fileName }) => resolveInternal(targetRoot, source, fileName))
      .filter((value) => value !== null);
    const uniqueDependencies = [...new Set(dependencies)];
    graph.set(source, uniqueDependencies);

    if (!isHostAdapterModule(source)) {
      const nodeBuiltins = [...new Set(
        importedFiles
          .map(({ fileName }) => fileName)
          .filter((fileName) => isNodeBuiltinSpecifier(fileName)),
      )];
      if (nodeBuiltins.length > 0) {
        for (const specifier of nodeBuiltins) {
          disallowedNodeImports.push(`${source} imports ${specifier}`);
        }
      }
    }

    if (NO_VIEW_IMPORT_PREFIXES.some((prefix) => source.startsWith(prefix))) {
      for (const dependency of uniqueDependencies) {
        if (dependency.startsWith('src/views/')) {
          forbidden.push(`${source} -> ${dependency}`);
        }
      }
    }
  }

  const reachable = new Set();
  const pending = [entry];
  while (pending.length) {
    const source = pending.pop();
    if (!source || reachable.has(source)) continue;
    reachable.add(source);
    for (const dependency of graph.get(source) ?? []) {
      if (!reachable.has(dependency)) pending.push(dependency);
    }
  }

  const unreachable = sources.filter((source) => !reachable.has(source));
  const cycles = dependencyCycles(graph);
  const failures = [];
  if (unreachable.length) {
    failures.push(
      `Unreachable non-declaration TypeScript:\n${unreachable.map((source) => `  ${source}`).join('\n')}`,
    );
  }
  if (forbidden.length) {
    failures.push(
      `Pure and feature layers must not import concrete views:\n${forbidden.map((edge) => `  ${edge}`).join('\n')}`,
    );
  }
  if (disallowedNodeImports.length) {
    failures.push(
      `Only host adapter modules (src/main.ts, src/gateway-client.ts, src/infrastructure/*) may import Node builtins:\n${disallowedNodeImports.map((edge) => `  ${edge}`).join('\n')}`,
    );
  }
  if (cycles.length) {
    failures.push(
      `Runtime dependency cycles:\n${cycles.map((cycle) => `  ${cycle.join(' <-> ')}`).join('\n')}`,
    );
  }

  return {
    ok: failures.length === 0,
    reachableCount: reachable.size,
    failures,
    forbidden,
    disallowedNodeImports,
    unreachable,
    cycles,
  };
}

const isMain = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = checkSourceGraph(root);
  if (!result.ok) {
    console.error(result.failures.join('\n\n'));
    process.exitCode = 1;
  } else {
    console.log(
      `Source graph OK: ${result.reachableCount} TypeScript source modules reachable; 0 dependency cycles; 0 disallowed view imports; 0 disallowed Node builtin imports.`,
    );
  }
}
