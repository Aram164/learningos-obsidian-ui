'use strict';
const { boot, VIEW, tick, check, heading } = require('./support');
const { browserDom } = require('./browser-dom');

module.exports = async function run() {
  heading('Atlas Library-style browsing: aliases, ungrouped reach and return paths');
  const { app, plugin, calls } = await boot({ patchManifest(manifest) {
    const concept = manifest.records.find((row) => row.type === 'concept');
    manifest.records.push({ ...concept, id: 'concept-unassigned', title: 'No linked note yet', aliases: [] });
    manifest.counts.concepts++;
    const note = manifest.records.find((row) => row.id === 'note-fixture-probability');
    manifest.records.push({ ...note, id: 'note-browse-alias', title: 'Recorded nested note',
      path: 'knowledge/notes/data-systems/dataframe-semantics/note-browse-alias.md', concepts: ['concept-bayes'] });
    manifest.counts.notes++;
  } });
  await plugin.nav.openAtlas();
  const view = () => app.workspace.getLeavesOfType(VIEW.atlas)[0].view;
  const root = () => view().contentEl;
  const domain = (id) => root().find('los-atlas-place').find((row) => row.getAttribute('data-domain') === id);
  const seedIds = () => root().find('los-atlas-concept-seed').map((row) => row.getAttribute('data-concept-id'));
  check('domain overview exposes complete browsing and an explicit ungrouped destination',
    root().allText().includes('Explore by domain') && domain('ungrouped') && root().find('los-atlas-browse-all').length === 1);
  domain('data-systems').fire('click');
  check('only published nested folders become subdomains', root().find('los-atlas-subdomain').length === 1
    && root().allText().includes('Dataframe Semantics') && !root().allText().includes('Probability & statistics'));
  root().find('los-atlas-subdomain')[0].fire('click');
  check('a nested browse path keeps the exact explicitly linked concept identity', seedIds().join('|') === 'concept-bayes');
  root().find('los-atlas-concept-select')[0].fire('click');
  check('title selection previews without navigating to or mutating the graph', view().state.concept === null
    && root().find('los-atlas-concept-preview')[0].allText().includes('Bayes theorem')
    && root().find('los-atlas-node').length === 0);
  root().findText('los-btn', 'Open concept map').fire('click'); await tick();
  check('opening the map retains browse breadcrumbs and all authored prerequisites', view().state.concept === 'concept-bayes'
    && root().find('los-atlas-breadcrumb')[0].allText().includes('Dataframe Semantics')
    && root().find('los-atlas-node').some((node) => node.getAttribute('data-atlas-concept') === 'concept-bedingte-wahrscheinlichkeit'));
  root().findText('los-btn', 'Back to concepts').fire('click'); await tick();
  check('Back to concepts restores the same domain, subdomain and concept list', view().state.concept === null
    && view().concepts.domain === 'data-systems' && view().concepts.subdomain === 'dataframe-semantics'
    && seedIds().join('|') === 'concept-bayes');
  domain('mathematics').fire('click');
  check('the same concept is reachable through another explicit note folder', seedIds().includes('concept-bayes'));
  domain('ungrouped').fire('click');
  check('concepts without note links stay reachable, without a guessed classification', seedIds().includes('concept-unassigned') && !seedIds().includes('concept-bayes'));
  root().findText('los-btn', 'Explore').fire('click'); await tick();
  check('explicit full browsing clears folder scope and exposes every projected identity', view().concepts.domain === null
    && new Set(seedIds()).size === plugin.store.of('concept').length);
  browserDom(root());
  root().find('los-atlas-records')[0].scrollTop = 160;
  root().find('los-atlas-concept-select')[0].focus();
  root().find('los-atlas-concept-select')[0].fire('click');
  check('preview selection preserves the list scroll and keyboard attention in its own pane',
    root().find('los-atlas-records')[0].scrollTop === 160
    && global.document.activeElement === root().find('los-atlas-concept-select')[0]);
  const before = seedIds().sort().join('|');
  const search = root().find('los-atlas-search-input')[0]; search.value = 'No linked'; search.fire('input');
  check('full search includes unassigned concepts by their actual title', seedIds().join('|') === 'concept-unassigned');
  search.value = ''; search.fire('input');
  check('clearing search restores exact browse parity', seedIds().sort().join('|') === before);
  check('all preview, browse, map and return actions are read only', calls.envelopes.length === 0);
  plugin.onunload();
};
