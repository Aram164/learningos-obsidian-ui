/**
 * Print the members every `Pick<LearningOSUI, …>` in src/ asks for, together
 * with the declaration each one has on the class.
 *
 * Item 11 scaffolding: the port that replaces `LearningOSUI` in feature modules
 * has to declare exactly the surface those modules already narrow to, with the
 * signatures the class already has. Transcribing 40-odd members by hand is how
 * a port quietly drifts from its implementation, so this reads both sides.
 *
 * Usage: node scripts/emit-app-surface.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { config } = ts.readConfigFile(resolve(ROOT, 'tsconfig.json'), (p) => readFileSync(p, 'utf8'));
const parsed = ts.parseJsonConfigFileContent(config, ts.sys, ROOT);
const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });

const wanted = new Map();   // member -> Set of files asking for it

for (const source of program.getSourceFiles()) {
  if (!source.fileName.startsWith(resolve(ROOT, 'src'))) continue;
  const file = source.fileName.slice(ROOT.length + 5);
  const visit = (node) => {
    if (ts.isTypeReferenceNode(node)
        && node.typeName.getText(source) === 'Pick'
        && node.typeArguments?.length === 2
        && node.typeArguments[0].getText(source) === 'LearningOSUI') {
      const members = node.typeArguments[1];
      const literals = ts.isUnionTypeNode(members) ? members.types : [members];
      for (const literal of literals) {
        const name = literal.getText(source).replace(/^['"]|['"]$/g, '');
        if (!wanted.has(name)) wanted.set(name, new Set());
        wanted.get(name).add(file);
      }
    }
    node.forEachChild(visit);
  };
  source.forEachChild(visit);
}

// The class declarations, so the port can copy signatures rather than invent.
const main = program.getSourceFile(resolve(ROOT, 'src/main.ts'));
const declarations = new Map();
const findClass = (node) => {
  if (ts.isClassDeclaration(node) && node.name?.getText(main) === 'LearningOSUI') {
    for (const member of node.members) {
      const name = member.name?.getText(main);
      if (!name) continue;
      const text = member.getText(main);
      const body = text.indexOf('{');
      const signature = ts.isMethodDeclaration(member) && body > 0
        ? `${text.slice(0, body).trim().replace(/\s+/g, ' ')};`
        : text.split('\n')[0].trim();
      declarations.set(name, signature);
    }
  }
  node.forEachChild(findClass);
};
main.forEachChild(findClass);

console.log(`${wanted.size} members are Picked across src/:\n`);
for (const [name, files] of [...wanted].sort()) {
  const declaration = declarations.get(name) ?? '  ** NOT DECLARED ON THE CLASS **';
  console.log(`${declaration}`);
  console.log(`    // ${files.size}: ${[...files].sort().join(', ')}`);
}
