/**
 * One-shot codemod: delete the import bindings that `noUnusedLocals` reports.
 *
 * Turning the flag on surfaced 372 findings across 32 files, ~95% of them dead
 * import specifiers left behind when logic moved from `views/` into
 * `features/` and nobody pruned the headers. Hand-editing that is a long series
 * of chances to delete the wrong line, so the removals are driven by the
 * compiler's own diagnostics rather than by grep: for every TS6133/TS6192/
 * TS6196 the script resolves the reported position to a node, and only acts if
 * that node is an import binding. Anything else — an unused local, an unused
 * parameter — is left alone and printed for a human to decide about.
 *
 * Kept in the tree rather than thrown away because the same flags will catch
 * the same class again after the next extraction, and re-deriving this is a
 * worse use of an afternoon than reading it.
 *
 * Usage: node scripts/drop-unused-imports.mjs [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');
const UNUSED = new Set([6133, 6192, 6196, 6198, 6199]);

function loadProgram() {
  const configPath = resolve(ROOT, 'tsconfig.json');
  const { config } = ts.readConfigFile(configPath, (p) => readFileSync(p, 'utf8'));
  const parsed = ts.parseJsonConfigFileContent(config, ts.sys, ROOT);
  return ts.createProgram({
    rootNames: parsed.fileNames,
    options: { ...parsed.options, noUnusedLocals: true, noUnusedParameters: true },
  });
}

/** Innermost node containing `pos`. */
function nodeAt(source, pos) {
  let found = source;
  const visit = (node) => {
    if (node.getStart(source) <= pos && pos < node.getEnd()) {
      found = node;
      node.forEachChild(visit);
    }
  };
  source.forEachChild(visit);
  return found;
}

/** The import binding this diagnostic is about, or null if it is not one. */
function bindingFor(node) {
  for (let n = node; n; n = n.parent) {
    if (ts.isImportSpecifier(n) || ts.isNamespaceImport(n)) return n;
    if (ts.isImportClause(n)) return n;           // default import
    if (ts.isImportDeclaration(n)) return n;      // whole declaration (TS6192)
    if (ts.isSourceFile(n)) return null;
    if (ts.isBlock(n) || ts.isFunctionLike(n)) return null;
  }
  return null;
}

const program = loadProgram();
const removals = new Map();   // file -> Set of nodes to delete
const skipped = [];

for (const diagnostic of program.getSemanticDiagnostics()) {
  if (!UNUSED.has(diagnostic.code) || !diagnostic.file) continue;
  const source = diagnostic.file;
  if (!source.fileName.startsWith(resolve(ROOT, 'src'))) continue;

  const binding = bindingFor(nodeAt(source, diagnostic.start));
  const where = `${source.fileName.slice(ROOT.length + 1)}:${
    source.getLineAndCharacterOfPosition(diagnostic.start).line + 1}`;
  if (!binding) {
    skipped.push(`${where}  ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`);
    continue;
  }
  if (!removals.has(source)) removals.set(source, new Set());
  removals.get(source).add(binding);
}

let files = 0;
let deleted = 0;

for (const [source, nodes] of removals) {
  const text = source.getFullText();
  const cuts = [];

  // A declaration losing every surviving specifier goes whole, so the codemod
  // never leaves `import {} from './x';` behind.
  const wholeDeclarations = new Set();
  for (const node of nodes) {
    if (ts.isImportDeclaration(node) || ts.isImportClause(node) || ts.isNamespaceImport(node)) {
      wholeDeclarations.add(ts.isImportDeclaration(node) ? node : node.parent.parent ?? node.parent);
    }
  }
  for (const node of nodes) {
    if (!ts.isImportSpecifier(node)) continue;
    const list = node.parent;                       // NamedImports
    const declaration = list.parent.parent;         // ImportDeclaration
    const survivors = list.elements.filter((e) => !nodes.has(e));
    if (survivors.length === 0 && !declaration.importClause?.name) {
      wholeDeclarations.add(declaration);
    }
  }

  for (const node of nodes) {
    if (ts.isImportSpecifier(node)) {
      const declaration = node.parent.parent.parent;
      if (wholeDeclarations.has(declaration)) continue;
      const list = node.parent.elements;
      const index = list.indexOf(node);
      // Swallow the separating comma with the specifier, taking the preceding
      // one for the final element so the list never ends `, }`.
      const start = index === list.length - 1 && index > 0
        ? list[index - 1].getEnd()
        : node.getStart(source);
      const end = index === list.length - 1
        ? node.getEnd()
        : list[index + 1].getStart(source);
      cuts.push([start, end]);
      deleted += 1;
    }
  }
  for (const declaration of wholeDeclarations) {
    let end = declaration.getEnd();
    while (end < text.length && text[end] !== '\n') end += 1;
    cuts.push([declaration.getStart(source), Math.min(end + 1, text.length)]);
    deleted += 1;
  }

  cuts.sort((a, b) => b[0] - a[0]);
  let next = text;
  let lastStart = Infinity;
  for (const [start, end] of cuts) {
    if (end > lastStart) continue;   // overlapping cut, already covered
    next = next.slice(0, start) + next.slice(end);
    lastStart = start;
  }
  // Collapse the blank run a removed declaration can leave behind.
  next = next.replace(/\n{3,}/g, '\n\n');

  if (next !== text) {
    files += 1;
    if (!DRY) writeFileSync(source.fileName, next);
  }
}

console.log(`${DRY ? '[dry] ' : ''}${deleted} import bindings removed across ${files} files`);
if (skipped.length) {
  console.log(`\n${skipped.length} findings are NOT imports — decide these by hand:`);
  for (const line of skipped) console.log(`  ${line}`);
}
