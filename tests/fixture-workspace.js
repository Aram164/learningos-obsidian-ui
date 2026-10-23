'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const workspaces = new Map();

// Keep the real diagnostic writer under test, but give each test process its
// own physical vault. A shared copy also preserves restart tests in one process.
function fixtureWorkspace(source) {
  source = path.resolve(source);
  if (workspaces.has(source)) return workspaces.get(source).vault;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'learningos-ui-fixture-'));
  const vault = path.join(root, 'vault');
  try {
    fs.cpSync(source, vault, {
      recursive: true,
      // Old test output is never an input to a fresh synthetic run.
      filter: (filename) => filename !== path.join(source, 'operations', 'diagnostics'),
    });
  } catch (error) {
    fs.rmSync(root, { recursive: true, force: true });
    throw error;
  }
  workspaces.set(source, { root, vault });
  return vault;
}

process.on('exit', (code) => {
  for (const [source, { root, vault }] of workspaces) {
    try {
      const trace = path.join(vault, 'operations', 'diagnostics', 'traces.jsonl');
      if (code !== 0 && fs.existsSync(trace)) {
        // Preserve a bounded diagnostic tail in the test/CI failure log, then
        // remove the temporary vault even when assertions fail or call exit().
        const tail = fs.readFileSync(trace, 'utf8').slice(-32768)
          .trimEnd().split('\n').slice(-20).join('\n');
        fs.writeSync(2, `\nSynthetic fixture diagnostics (${source}; last 20 events):\n${tail}\n`);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

// Node's default signal termination skips the exit event. Route ordinary
// interruptions through the same cleanup and diagnostic policy as failures.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => process.exit(128 + os.constants.signals[signal]));
}

module.exports = { fixtureWorkspace };
