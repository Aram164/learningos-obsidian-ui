/**
 * Report, per module, exactly which members of the plugin it touches.
 *
 * Written for item 11 (finish the host-interface migration): the point of a
 * narrow port is that it names what a module actually needs, and the honest
 * way to derive that is to ask the type checker which properties are read off
 * a `LearningOSUI`-typed expression — not to read the file and guess.
 *
 * Usage: node scripts/host-surface-report.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { config } = ts.readConfigFile(resolve(ROOT, 'tsconfig.json'), (p) => readFileSync(p, 'utf8'));
const parsed = ts.parseJsonConfigFileContent(config, ts.sys, ROOT);
const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });

/**
 * Resolved syntactically rather than through the checker, because a module
 * that narrows with `type CardHost = Pick<LearningOSUI, …>` and then annotates
 * its parameters `host: CardHost` still *depends on main.ts* — which is the
 * coupling item 11 is about. Asking the checker for the type of `host` answers
 * a different question (what can it reach) than the one being measured (does
 * this module import the plugin at all, and for what).
 */
function pluginTypeNames(source) {
  const names = new Set(['LearningOSUI']);
  const visit = (node) => {
    if (ts.isTypeAliasDeclaration(node) && node.type.getText(source).includes('LearningOSUI')) {
      names.add(node.name.getText(source));
    }
    node.forEachChild(visit);
  };
  source.forEachChild(visit);
  return names;
}

const report = new Map();

for (const source of program.getSourceFiles()) {
  if (!source.fileName.startsWith(resolve(ROOT, 'src'))) continue;
  if (source.fileName.endsWith('/main.ts')) continue;
  if (!source.getFullText().includes('LearningOSUI')) continue;

  const typeNames = pluginTypeNames(source);
  const holders = new Set();          // identifiers typed as the plugin
  const collectHolders = (node) => {
    if ((ts.isParameter(node) || ts.isPropertyDeclaration(node) || ts.isVariableDeclaration(node))
        && node.type && ts.isIdentifier(node.name)
        && typeNames.has(node.type.getText(source).replace(/^readonly\s+/, ''))) {
      holders.add(node.name.getText(source));
    }
    node.forEachChild(collectHolders);
  };
  source.forEachChild(collectHolders);

  const members = new Set();
  const visit = (node) => {
    if (ts.isPropertyAccessExpression(node)) {
      const base = node.expression;
      const name = ts.isIdentifier(base) ? base.getText(source)
        : ts.isPropertyAccessExpression(base) ? base.name.getText(source)
          : null;
      if (name && holders.has(name)) members.add(node.name.getText(source));
    }
    node.forEachChild(visit);
  };
  source.forEachChild(visit);
  report.set(source.fileName.slice(ROOT.length + 5), members);
}

const rows = [...report.entries()].sort((a, b) => a[1].size - b[1].size);
let total = 0;
for (const [file, members] of rows) {
  total += members.size;
  console.log(`${String(members.size).padStart(3)}  ${file}`);
  if (members.size) console.log(`     ${[...members].sort().join(', ')}`);
}
console.log(`\n${rows.length} modules, ${total} member references`);

// Which plugin members are reached at all, and from how many modules.
const frequency = new Map();
for (const members of report.values()) {
  for (const member of members) frequency.set(member, (frequency.get(member) ?? 0) + 1);
}
console.log(`\n${frequency.size} distinct members reached:`);
for (const [member, count] of [...frequency].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(2)}  ${member}`);
}
