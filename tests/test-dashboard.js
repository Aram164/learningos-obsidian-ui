/* LearningOS curriculum-v2 app tests. Fixture-only: never reads the live repository. */
'use strict';

const { result } = require('./dashboard/support');

const suites = [
  require('./dashboard/contract-home-search'),
  require('./dashboard/navigation-review-atlas'),
  require('./dashboard/library-capture'),
  require('./dashboard/study-surfaces'),
  require('./dashboard/shelving-resilience'),
  require('./dashboard/runtime-integrity'),
];

async function main() {
  console.log(
    'LearningOS module-first app tests (synthetic fixture only)',
  );

  for (const run of suites) {
    await run();
  }

  return result();
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
