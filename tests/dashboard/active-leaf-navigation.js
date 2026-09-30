'use strict';
const { boot, VIEW, check, heading } = require('./support');

module.exports = async function run() {
  heading('native tab attention: sidebar highlight without navigation or writes');
  const { app, plugin, calls } = await boot();
  await plugin.nav.openAtlas({ lens: 'domains' });
  const domains = app.workspace.getLeavesOfType(VIEW.atlas)[0];
  const domainView = domains.view, domainRoot = domainView.contentEl;
  const role = domainRoot.find('los-domain-role')[0];
  const roleSummary = role.children.find((child) => child.tag === 'summary');
  roleSummary.fire('click'); role.open = true;
  const domainSearch = domainRoot.find('los-domain-search')[0];
  domainSearch.value = 'probability'; domainSearch.fire('input');
  const working = { query: domainView.domains.query, selected: domainView.domains.selected,
    disclosures: JSON.stringify([...domainView.domains.disclosures]) };
  await plugin.nav.openLibraryFolder([], null, 'list', 'fixture');
  const library = app.workspace.getLeavesOfType(VIEW.library)[0];
  const libraryView = library.view, libraryRoot = libraryView.contentEl;
  const librarySearch = libraryRoot.find('los-finder-filter')[0];
  const libraryQuery = libraryView.query;

  // A second native Atlas leaf proves attention reads the selected leaf's
  // own state instead of assuming the route or the first leaf is visible.
  const concepts = app.workspace.getLeaf(true);
  await concepts.setViewState({ type: VIEW.atlas, state: { lens: 'prerequisites' } });
  const restored = app.workspace.getLeaf(true);
  const restoredTitles = [];
  restored.updateHeader = () => restoredTitles.push(restored.view.getDisplayText());
  await restored.setViewState({ type: VIEW.atlas, state: { lens: 'domains' } });
  check('restoring a Domain pane refreshes its native header after both state adoption and opening',
    restoredTitles.length === 2 && restoredTitles.every((title) => title === 'LearningOS · Domain Atlas'));
  await plugin.nav.openDiagnostics();
  const diagnostics = app.workspace.getLeavesOfType(VIEW.diagnostics)[0];
  const navLeaf = app.workspace.getLeavesOfType(VIEW.nav)[0];
  const native = app.workspace.getLeaf(true);
  await native.setViewState({ type: 'markdown', state: { file: 'knowledge/notes/fixture.md' } });
  const snapshot = JSON.stringify(plugin.router.snapshot());
  const settings = JSON.stringify(plugin.settings.navigation);
  const readCount = calls.length;
  let persistCalls = 0, navigationCalls = 0, rememberCalls = 0;
  const persist = plugin.persistSettings.bind(plugin);
  plugin.persistSettings = (...args) => { persistCalls++; return persist(...args); };
  const navigate = plugin.router.navigate.bind(plugin.router);
  plugin.router.navigate = (...args) => { navigationCalls++; return navigate(...args); };
  const remember = plugin.router.remember.bind(plugin.router);
  plugin.router.remember = (...args) => { rememberCalls++; return remember(...args); };

  app.workspace.setActiveLeaf(domains);
  check('switching natively from Diagnostics to Domains highlights the primary Atlas destination',
    plugin.activeNav === 'abilities' && app.workspace.active === domains
    && navLeaf.view.contentEl.findText('los-app-nav-item', 'Atlas').getAttribute('aria-current') === 'page');
  app.workspace.setActiveLeaf(library);
  check('switching to an existing Library tab highlights Library',
    plugin.activeNav === 'library' && navLeaf.view.contentEl.findText('los-app-nav-item', 'Library').classes.has('is-active'));
  app.workspace.setActiveLeaf(concepts);
  check('switching to another Atlas leaf derives its Concept destination from that leaf’s state', plugin.activeNav === 'atlas');
  app.workspace.setActiveLeaf(native);
  check('a native non-LearningOS tab does not fabricate a Home destination', plugin.activeNav === 'atlas');
  app.workspace.setActiveLeaf(navLeaf);
  check('focusing the sidebar itself does not change the highlighted destination', plugin.activeNav === 'atlas');
  app.workspace.trigger('active-leaf-change', null);
  check('a transient null active leaf is ignored', plugin.activeNav === 'atlas');
  app.workspace.setActiveLeaf(restored);
  check('a separately restored Domain tab also highlights primary Atlas', plugin.activeNav === 'abilities');
  app.workspace.setActiveLeaf(diagnostics);
  check('returning to Diagnostics follows the actual tab again', plugin.activeNav === 'diagnostics');
  app.workspace.setActiveLeaf(domains);
  check('attention changes preserve Domain query, selection, explicit disclosures and the original input node',
    domainView.domains.query === working.query && domainView.domains.selected === working.selected
    && JSON.stringify([...domainView.domains.disclosures]) === working.disclosures
    && domainRoot.find('los-domain-search')[0] === domainSearch && domainSearch.value === 'probability');
  check('attention changes preserve the Library query and original field without redrawing the reading pane',
    libraryView.query === libraryQuery && libraryRoot.find('los-finder-filter')[0] === librarySearch
    && librarySearch.value === 'fixture');
  check('attention changes do not navigate, remember, persist settings, alter history or call Core',
    navigationCalls === 0 && rememberCalls === 0 && persistCalls === 0
    && JSON.stringify(plugin.router.snapshot()) === snapshot
    && JSON.stringify(plugin.settings.navigation) === settings
    && calls.length === readCount && calls.envelopes.length === 0);
  plugin.onunload();
};
