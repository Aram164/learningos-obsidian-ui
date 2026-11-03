/* LearningOS curriculum-v2 app tests. Fixture-only: never reads the live repository. */
'use strict';

const { performance } = require('perf_hooks');
const { result } = require('./dashboard/support');

const SUITE_NAMES = [
  'contract-home-search',
  'navigation-review-atlas',
  'abilities-review',
  'render-focus',
  'domain-atlas',
  'atlas-browser',
  'active-leaf-navigation',
  'library-capture',
  'study-surfaces',
  'shelving-resilience',
  'gateway-recovery',
  'runtime-integrity',
  'session-end-flow',
  'interface-designs',
  'focus-interface',
];

function selectSuites() {
  const arg = process.argv.slice(2).find((item) => item.startsWith('--suite='));
  const filter = arg ? arg.slice('--suite='.length).trim() : (process.env.LOS_UI_SUITE || '').trim();
  if (!filter) {
    return SUITE_NAMES.map((name) => [name, require(`./dashboard/${name}`)]);
  }
  const matched = SUITE_NAMES.filter((name) => name.includes(filter));
  if (!matched.length) {
    throw new Error(`No dashboard suite matches "${filter}". Available: ${SUITE_NAMES.join(', ')}`);
  }
  return matched.map((name) => [name, require(`./dashboard/${name}`)]);
}

async function main() {
  console.log(
    'LearningOS module-first app tests (synthetic fixture only)',
  );

  const suites = selectSuites();
  for (const [name, run] of suites) {
    const start = performance.now();
    await run();
    const elapsedMs = Math.round(performance.now() - start);
    if (process.env.LOS_UI_TIMING === '1' || suites.length < SUITE_NAMES.length) {
      console.log(`  [timing] ${name}: ${elapsedMs}ms`);
    }
  }

  return result();
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
