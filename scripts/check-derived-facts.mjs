import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourceRoot = path.join(root, 'src');

const CURRICULUM_STATUS_LITERALS = new Set([
  'archived',
  'dropped',
  'completed',
  'awaiting-grade',
  'skipped',
  'complete',
  'paused',
  'active',
  'ready',
  'not-started',
  'needs-map',
  'pending',
  'revisit',
  'ready-to-shelve',
  'current',
]);

const ARRAY_STATUS_LITERALS = new Set([
  'archived',
  'dropped',
  'completed',
  'awaiting-grade',
  'complete',
  'skipped',
]);

/**
 * Explicit render/view allowlist with pinned maximum `.status ===` / `.status !==`
 * counts against curriculum status literals. Raising any count or adding a new
 * comparison without a published verdict must fail CI.
 */
const STATUS_COMPARISON_ALLOWLIST = new Map([
  ['src/projection/readers.ts', { max: 1, reason: 'Single stageProgress() helper counting complete stages.' }],
  ['src/designs/focus/unit.ts', { max: 6, reason: 'Display state labels and completion badges for stages.' }],
  ['src/designs/study-desk/unit.ts', { max: 8, reason: 'Display labels, chips, and stage-strip checks for stages.' }],
  ['src/features/unit/stage.ts', { max: 6, reason: 'Stage transition dispatch, display labels, and complete badge.' }],
  ['src/features/unit/shell.ts', { max: 2, reason: 'Stage rail complete/skipped marker rendering.' }],
  ['src/features/module/detail.ts', { max: 3, reason: 'Paused unit disclosure grouping and unit badge.' }],
  ['src/manifest-store.ts', { max: 3, reason: 'Archived module store exclusion and currentSemester() selector.' }],
  ['src/views/program-view.ts', { max: 1, reason: 'Renders current-semester badge in Classics program view.' }],
  ['src/views/shelving-view.ts', { max: 1, reason: 'Collects study maps awaiting shelving.' }],
]);

const STAGE_COUNT_HELPERS = new Set([
  'src/projection/readers.ts',
  'src/features/unit/model.ts',
]);

const EQUALITY_OPERATORS = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

function sourceModules(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    if (entry.isDirectory()) {
      if (relative === 'src/contracts/generated') return [];
      return sourceModules(absolute);
    }
    if (!entry.isFile() || !entry.name.endsWith('.ts')) return [];
    if (entry.name.endsWith('.d.ts')) return [];
    return [relative];
  });
}

function isStatusAccess(node) {
  return ts.isPropertyAccessExpression(node) && node.name.text === 'status';
}

function isNonCurriculumStatusAccess(node, relative, sourceFile) {
  if (!isStatusAccess(node)) return false;
  const receiverText = node.expression.getText(sourceFile);
  return (relative === 'src/application/gateway-recovery.ts' && receiverText === 'payload')
    || (relative === 'src/features/unit/material-card.ts' && receiverText === 'state')
    || (relative === 'src/features/unit/materials.ts' && receiverText === 'synthesis.freshness');
}

function stringLiteralText(node) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
    ? node.text
    : null;
}

function subtreeHasStatusAccess(rootNode) {
  let found = false;
  function visit(node) {
    if (found) return;
    if (isStatusAccess(node)) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(rootNode);
  return found;
}

function subtreeHasCompleteComparison(rootNode) {
  let found = false;
  function visit(node) {
    if (found) return;
    if (ts.isBinaryExpression(node) && EQUALITY_OPERATORS.has(node.operatorToken.kind)) {
      const pair = [node.left, node.right];
      const hasStatus = pair.some((part) => isStatusAccess(part));
      const hasComplete = pair.some((part) => stringLiteralText(part) === 'complete');
      if (hasStatus && hasComplete) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(rootNode);
  return found;
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

const failures = [];
let totalAllowlisted = 0;

for (const relative of sourceModules(sourceRoot).sort()) {
  const text = fs.readFileSync(path.join(root, relative), 'utf8');
  const sourceFile = ts.createSourceFile(relative, text, ts.ScriptTarget.Latest, true);
  let statusComparisons = 0;

  function visit(node) {
    // 1. No inline stage-completion filter counts outside the shared helper.
    if (
      !STAGE_COUNT_HELPERS.has(relative)
      && ts.isPropertyAccessExpression(node)
      && node.name.text === 'length'
      && ts.isCallExpression(node.expression)
      && ts.isPropertyAccessExpression(node.expression.expression)
      && node.expression.expression.name.text === 'filter'
      && node.expression.arguments.some((arg) => subtreeHasCompleteComparison(arg))
    ) {
      failures.push(
        `${relative}:${lineOf(sourceFile, node)}: inline stage completion count (.filter(...status === 'complete'...).length); use stageProgress() instead.`,
      );
    }

    // 2. No array .includes(...) testing .status against curriculum status literals.
    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'includes'
      && ts.isArrayLiteralExpression(node.expression.expression)
    ) {
      const literals = node.expression.expression.elements
        .map(stringLiteralText)
        .filter((value) => value !== null && ARRAY_STATUS_LITERALS.has(value));
      if (literals.length > 0 && node.arguments.some((arg) => subtreeHasStatusAccess(arg))) {
        failures.push(
          `${relative}:${lineOf(sourceFile, node)}: curriculum status set test (${literals.join(', ')}) via .includes(.status); consume published Core boolean facts instead.`,
        );
      }
    }

    // 3. No unallowlisted .status === / .status !== comparisons against curriculum literals.
    if (ts.isBinaryExpression(node) && EQUALITY_OPERATORS.has(node.operatorToken.kind)) {
      const sides = [node.left, node.right];
      const statusNode = sides.find((part) => isStatusAccess(part));
      const literalText = sides.map(stringLiteralText).find((val) => val !== null);
      if (
        statusNode
        && literalText !== undefined
        && CURRICULUM_STATUS_LITERALS.has(literalText)
        && !isNonCurriculumStatusAccess(statusNode, relative, sourceFile)
      ) {
        statusComparisons += 1;
        const entry = STATUS_COMPARISON_ALLOWLIST.get(relative);
        if (!entry) {
          failures.push(
            `${relative}:${lineOf(sourceFile, node)}: disallowed .status comparison against '${literalText}'; consume published Core verdict or update allowlist only for pure rendering.`,
          );
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  const allowEntry = STATUS_COMPARISON_ALLOWLIST.get(relative);
  if (allowEntry) {
    totalAllowlisted += statusComparisons;
    if (statusComparisons > allowEntry.max) {
      failures.push(
        `${relative}: found ${statusComparisons} curriculum .status comparisons, exceeding pinned maximum ${allowEntry.max} (${allowEntry.reason}).`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Derived facts guard OK: 0 inline stage counts; 0 status .includes() checks; ${totalAllowlisted} allowlisted render/view .status comparisons within pinned limits.`,
  );
}
