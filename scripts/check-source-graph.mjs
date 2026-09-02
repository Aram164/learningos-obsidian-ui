import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourceRoot = path.join(root, 'src');
const entry = 'src/main.ts';

function sourceModules(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entryValue) => {
      const absolute = path.join(directory, entryValue.name);
      if (entryValue.isDirectory()) return sourceModules(absolute);
      if (!entryValue.isFile() || !entryValue.name.endsWith('.ts')
          || entryValue.name.endsWith('.d.ts')) return [];
      return [path.relative(root, absolute).split(path.sep).join('/')];
    });
}

function resolveInternal(importer, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.posix.normalize(
    path.posix.join(path.posix.dirname(importer), specifier),
  );
  const candidates = base.endsWith('.ts')
    ? [base]
    : [`${base}.ts`, path.posix.join(base, 'index.ts')];
  const resolved = candidates.find((candidate) =>
    fs.existsSync(path.join(root, candidate)));
  if (!resolved) {
    throw new Error(`Cannot resolve ${JSON.stringify(specifier)} from ${importer}.`);
  }
  if (!resolved.startsWith('src/')) {
    throw new Error(`${importer} imports source outside src/: ${resolved}.`);
  }
  return resolved;
}

// Declaration files are compiler-owned host augmentation. Every other source
// module, including a type-only feature port, must have an explicit path from
// the application entrypoint.
const sources = sourceModules(sourceRoot).sort();
const sourceSet = new Set(sources);
if (!sourceSet.has(entry)) {
  throw new Error(`Runtime entrypoint ${entry} is missing.`);
}

const graph = new Map();
const forbidden = [];

for (const source of sources) {
  const text = fs.readFileSync(path.join(root, source), 'utf8');
  const dependencies = ts.preProcessFile(text, true, true).importedFiles
    .map(({ fileName }) => resolveInternal(source, fileName))
    .filter((value) => value !== null);
  const uniqueDependencies = [...new Set(dependencies)];
  graph.set(source, uniqueDependencies);

  if (source.startsWith('src/features/')) {
    for (const dependency of uniqueDependencies) {
      if (dependency.startsWith('src/views/')) {
        forbidden.push(`${source} -> ${dependency}`);
      }
    }
  }
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
    `Feature modules must depend on feature-owned ports, not concrete views:\n${forbidden.map((edge) => `  ${edge}`).join('\n')}`,
  );
}
if (cycles.length) {
  failures.push(
    `Runtime dependency cycles:\n${cycles.map((cycle) => `  ${cycle.join(' <-> ')}`).join('\n')}`,
  );
}

if (failures.length) {
  console.error(failures.join('\n\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Source graph OK: ${reachable.size} TypeScript source modules reachable; 0 dependency cycles; 0 feature-to-view imports.`,
  );
}
