/* Session-end modal flow: review, then commit or dismiss. Fixture-only. */
'use strict';

const {
  stub,
  frame,
  waitFor,
  check,
  heading,
  boot,
} = require('./support');

module.exports = async function run() {
  heading('session-end review then commit');
  {
    const { plugin, calls } = await boot();
    const sessionEnds = () => calls.filter((args) => args[0] === 'session-end');
    await plugin.reviewSessionEnd();
    const modal = stub.Modal.last;
    check('End learning session opens the change review with no commit flags',
      sessionEnds().length === 1
      && JSON.stringify(sessionEnds()[0])
        === JSON.stringify(['session-end', '--session-id', 'ui'])
      && modal?.contentEl?.getAttribute('aria-labelledby') === 'los-session-end-heading');
    modal.contentEl.find('los-search')[0].value = 'Evening session';
    modal.contentEl.findText('los-btn', 'Commit session-owned files').fire('click');
    await waitFor(() => sessionEnds().length === 2 && !plugin.gateway.isBusy);
    check('Commit session-owned files commits exactly the reviewed session',
      sessionEnds().length === 2
      && JSON.stringify(sessionEnds()[1]) === JSON.stringify(
        ['session-end', '--session-id', 'ui', '--commit-message', 'Evening session']));
    plugin.onunload();
  }

  heading('session-end close without committing');
  {
    const { plugin, calls } = await boot();
    await plugin.reviewSessionEnd();
    const modal = stub.Modal.last;
    const before = calls.length;
    modal.contentEl.findText('los-btn', 'Close without committing').fire('click');
    await frame();
    check('Close without committing makes no Core call',
      calls.length === before);
    plugin.onunload();
  }
};
