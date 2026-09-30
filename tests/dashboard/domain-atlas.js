'use strict';
const { boot, VIEW, tick, check, heading } = require('./support');

// Native selector/focus semantics needed for the actual keyboard journey.
function browserDom(root) {
  const wire = (node, parent = null) => {
    node.parentElement = parent; node.ownerDocument = global.document;
    Object.defineProperties(node, {
      tagName: { configurable: true, get: () => node.tag.toUpperCase() },
      className: { configurable: true, get: () => [...node.classes].join(' ') },
      textContent: { configurable: true, get: () => node.allText() },
      isConnected: { configurable: true, get: () => root.contains(node) },
    });
    node.matches = (selector) => selector.split(',').some((item) => {
      const part = item.trim();
      if (part === '[role="group"]') return node.getAttribute('role') === 'group';
      if (part === 'button') return node.tag === 'button';
      if (part === 'input[type="search"]') return node.tag === 'input' && node.getAttribute('type') === 'search';
      const match = part.match(/^(input|textarea)\.([a-z-]+)$/);
      return Boolean(match && node.tag === match[1] && node.classes.has(match[2]));
    });
    node.closest = (selector) => node.matches(selector) ? node : node.parentElement?.closest(selector) ?? null;
    node.querySelectorAll = (selector) => node.children.flatMap((child) => [
      ...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector),
    ]);
    const spawn = node._spawn;
    node._spawn = function(tag, opts) { return wire(spawn.call(this, tag, opts), this); };
    for (const child of node.children) wire(child, node);
    return node;
  };
  return wire(root);
}
const viewOf = (app) => app.workspace.getLeavesOfType(VIEW.atlas)[0].view;
const choose = (root, key) => root.find('los-domain-choice').find((row) => row.getAttribute('data-los-tab') === key);
const summary = (details) => details.children.find((child) => child.tag === 'summary');
function toggle(details) { summary(details).fire('click'); details.open = !details.open; }

module.exports = async function run() {
  heading('Domain Atlas: complete reach, counted disclosures and safe navigation');
  const { app, plugin, calls } = await boot({
    patchManifest: (manifest) => {
      const note = manifest.records.find((row) => row.type === 'note');
      manifest.records.push({ ...note, id: 'note-fixture-future-domain', title: 'Future biophysics wiring',
        domain: 'specialized-biophysics', path: 'knowledge/notes/biophysics/note-fixture-future-domain.md', role: 'crosswalk' });
      manifest.records.push({ ...note, id: 'note-fixture-nested-domain', title: 'Nested data systems reference',
        domain: 'narrow-data-topic', path: 'knowledge/notes/data-systems/narrow-topic/note-fixture-nested-domain.md' });
      manifest.counts.notes += 2;
      const shelf = manifest.records.find((row) => row.id === 'fixture-math-bookshelf');
      shelf.entries.push({ source: shelf.entries[0].source, group: 'revisit', why: 'The same source in a second ordered placement.' });
      shelf.sources.push(shelf.entries[0].source);
      manifest.records.find((row) => row.id === 'source-fixture-video').thematic_group_ids = [];
    },
  });
  await plugin.nav.openAtlas({ lens: 'domains' });
  let view = viewOf(app), root = browserDom(view.contentEl);
  const refreshRoot = () => { view = viewOf(app); root = browserDom(view.contentEl); };
  check('Domains is an existing Atlas route and opens without the generated text file',
    plugin.router.snapshot().current.name === 'atlas' && plugin.router.snapshot().current.lens === 'domains'
    && view.getDisplayText() === 'LearningOS · Domain Atlas' && root.allText().includes('Domain Atlas')
    && !app.workspace.opened.includes('generated/domain-atlas.md'));
  check('known empty domains and future path buckets stay reachable without inferred domain aliases',
    choose(root, 'systems') && choose(root, 'biophysics') && choose(root, 'data-systems')
    && !choose(root, 'narrow-data-topic') && !choose(root, 'specialized-biophysics'));
  check('at-a-glance note/shelf counts and role counts match their actual records',
    choose(root, 'mathematics').allText().includes('5 notes · 1 shelf')
    && root.findText('los-domain-role', 'Reference notes · 1')
    && root.findText('los-domain-role', 'Questions · 4'));
  check('shelf counts distinguish repeated ordered entries from distinct sources',
    summary(root.find('los-domain-shelf')[0]).allText().includes('3 entries · 2 sources')
    && root.find('los-domain-entry-row').length === 3
    && root.allText().includes('The same source in a second ordered placement.'));
  const initialRoles = root.find('los-domain-role');
  check('note-role and shelf disclosures are closed initially', initialRoles.every((role) => !role.open)
    && root.find('los-domain-shelf').every((shelf) => !shelf.open));
  toggle(initialRoles[0]);
  const search = root.find('los-domain-search')[0]; search.focus();
  for (const char of 'probability') search.typeText(char);
  check('continuous filtering retains the original field, focus, selection and chosen domain',
    root.find('los-domain-search')[0] === search && global.document.activeElement === search
    && search.value === 'probability' && search.selectionStart === 11
    && view.domains.selected === 'mathematics' && root.find('los-domain-role').every((role) => role.open));
  search.setSelectionRange(0, 4); search.typeText('P'); search.typeText('rob');
  check('mid-string editing and backspace-shaped selection replacement retain the exact caret',
    search.value === 'Probability' && search.selectionStart === 4 && search.selectionEnd === 4);
  search.value = 'Bayes'; search.fire('input');
  check('filtering reveals matching role groups with matching/total counts',
    root.find('los-domain-role').length === 1
    && summary(root.find('los-domain-role')[0]).allText().includes('Questions · 1 of 4')
    && root.find('los-domain-role')[0].open);
  search.value = ''; search.fire('input');
  check('clearing a filter restores explicit disclosure state and all counted records',
    root.findText('los-domain-role', 'Reference notes · 1').open
    && !root.findText('los-domain-role', 'Questions · 4').open
    && root.find('los-domain-note-row').length === 5 && root.find('los-domain-entry-row').length === 3);
  search.value = 'nothing-matches-this-fixture'; search.fire('input');
  check('zero matches keep the chosen domain and report honest emptiness without stale rows',
    view.domains.selected === 'mathematics' && root.find('los-domain-choice').length === 1
    && root.allText().includes('0 domains match') && root.allText().includes('No matches in this domain')
    && root.find('los-domain-note-row').length === 0 && root.find('los-domain-shelf').length === 0
    && root.find('los-domain-search')[0] === search);
  search.value = ''; search.fire('input');
  const first = choose(root, 'mathematics'); first.focus();
  let prevented = false;
  first.parentElement.fire('keydown', { key: 'ArrowDown', target: first, preventDefault() { prevented = true; } });
  const next = global.document.activeElement;
  check('domain arrow navigation changes attention without selecting or writing',
    prevented && next !== first && view.domains.selected === 'mathematics' && calls.envelopes.length === 0);
  const nextKey = next.getAttribute('data-los-tab'); next.fire('click');
  check('native activation keeps focus on the replacement selected domain button',
    view.domains.selected === nextKey && global.document.activeElement === choose(root, nextKey)
    && choose(root, nextKey).getAttribute('aria-pressed') === 'true');
  choose(root, 'biophysics').fire('click');
  check('a future domain lists its full note title and role', root.findText('los-domain-note-row', 'Future biophysics wiring')
    && root.findText('los-domain-role', 'Crosswalks · 1'));
  choose(root, 'mathematics').fire('click');
  root.findText('los-domain-note-row', 'Fixture probability reference').fire('click'); await tick();
  check('note navigation opens the existing authored path through the resource adapter',
    app.workspace.opened.includes('knowledge/notes/mathematics/note-fixture-probability.md'));
  root.find('los-domain-open-shelf')[0].fire('click'); await tick();
  check('shelf navigation uses the existing catalogue route', plugin.router.snapshot().current.name === 'catalogue-detail'
    && plugin.router.snapshot().current.catalogueId === 'fixture-math-bookshelf');
  await plugin.nav.back(); refreshRoot();
  root.find('los-domain-open-source')[0].fire('click'); await tick();
  check('source entry navigation uses the existing source detail route',
    plugin.router.snapshot().current.name === 'source-detail' && plugin.router.snapshot().current.resourceId === 'source-fixture-book');
  await plugin.nav.back(); refreshRoot();
  root.find('los-domain-source-group')[0].fire('click'); await tick();
  check('source-domain links use the actual folder route prefix',
    plugin.router.snapshot().current.name === 'library-folder'
    && plugin.router.snapshot().current.path[0].startsWith('domain:thematic-group-'));
  await plugin.nav.back(); refreshRoot();
  root.find('los-domain-unfiled')[0].fire('click'); await tick();
  check('sources without a valid thematic group remain reachable through Unfiled',
    plugin.router.snapshot().current.path[0] === 'shelf:unfiled');
  await plugin.nav.back(); refreshRoot();
  root.find('los-domain-all-sources')[0].fire('click'); await tick();
  check('All sources opens the complete source collection',
    plugin.router.snapshot().current.name === 'library-home' && plugin.router.snapshot().current.collection === 'sources');
  await plugin.nav.back(); refreshRoot();
  root.findText('los-btn', 'Generated text overview').fire('click'); await tick();
  check('the generated overview stays reachable as a secondary action', app.workspace.opened.includes('generated/domain-atlas.md'));
  root.findText('los-filter-tab', 'Concept atlas').fire('click'); await tick();
  check('Concept atlas remains reachable with its existing lenses',
    plugin.router.snapshot().current.lens === 'prerequisites' && viewOf(app).contentEl.find('los-atlas-controls').length === 1);
  refreshRoot();
  root.findText('los-filter-tab', 'Ability map').fire('click'); await tick();
  check('the grouped entry point returns to Ability map', plugin.router.snapshot().current.name === 'abilities');
  check('the entire Domain Atlas read/filter/navigation journey emits zero Gateway writes', calls.envelopes.length === 0);
  plugin.onunload();

  const emptyContext = await boot({ patchManifest(manifest) {
    manifest.records = manifest.records.filter((record) => !['note', 'collection', 'topic-pack'].includes(record.type));
    manifest.topic_packs = [];
    manifest.counts.notes = 0; manifest.counts.collections = 0; manifest.counts.topic_packs = 0;
  } });
  await emptyContext.plugin.nav.openAtlas({ lens: 'domains' });
  const emptyRoot = viewOf(emptyContext.app).contentEl;
  check('empty knowledge has honest emptiness while retaining every known domain and source reach',
    emptyRoot.allText().includes('Nothing published here yet') && emptyRoot.find('los-domain-choice').length === 7
    && emptyRoot.find('los-domain-all-sources').length === 1);
  emptyContext.plugin.store.ready = false; emptyContext.plugin.store.error = 'fixture unavailable'; viewOf(emptyContext.app).render();
  check('an unavailable projection does not render stale record counts or lose the way back',
    emptyRoot.allText().includes('Domain Atlas unavailable') && emptyRoot.find('los-domain-choice').length === 0
    && emptyRoot.findText('los-filter-tab', 'Ability map') && emptyContext.calls.envelopes.length === 0);
  emptyContext.plugin.onunload();

  const edgeContext = await boot({ patchManifest(manifest) {
    const shelf = manifest.records.find((record) => record.type === 'collection');
    manifest.records.push({ ...shelf, id: 'fixture-future-shelf', title: 'Future research shelf',
      domain: 'future-research', path: 'sources/collections/fixture-future-shelf.yaml',
      sources: ['source-fixture-unavailable'],
      entries: [{ source: 'source-fixture-unavailable', group: 'later', why: 'Missing-source discovery context' }] });
    manifest.counts.collections += 1;
  } });
  await edgeContext.plugin.nav.openAtlas({ lens: 'domains' });
  const edgeRoot = viewOf(edgeContext.app).contentEl;
  choose(edgeRoot, 'future-research').fire('click');
  check('a future shelf domain remains counted and reachable even without notes',
    choose(edgeRoot, 'future-research').allText().includes('0 notes · 1 shelf')
    && summary(edgeRoot.find('los-domain-shelf')[0]).allText().includes('1 entry · 1 source'));
  const edgeSearch = edgeRoot.find('los-domain-search')[0];
  edgeSearch.value = 'Missing-source discovery'; edgeSearch.fire('input');
  check('an unavailable source placement preserves its rationale and count without a broken open action',
    edgeRoot.find('los-domain-shelf')[0].open
    && edgeRoot.find('los-domain-source-unavailable').length === 1
    && edgeRoot.allText().includes('Missing-source discovery context')
    && edgeRoot.find('los-domain-open-source').length === 0 && edgeContext.calls.envelopes.length === 0);
  edgeContext.plugin.onunload();

  const invalidContext = await boot({ patchManifest(manifest) {
    delete manifest.records.find((record) => record.type === 'note').role;
  } });
  await invalidContext.plugin.nav.openAtlas({ lens: 'domains' });
  check('a required missing note role fails closed at the manifest boundary',
    !invalidContext.plugin.store.ready && viewOf(invalidContext.app).contentEl.allText().includes('Domain Atlas unavailable')
    && viewOf(invalidContext.app).contentEl.find('los-domain-choice').length === 0
    && invalidContext.calls.envelopes.length === 0);
  invalidContext.plugin.onunload();
};
