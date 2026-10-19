'use strict';
const { boot, VIEW, tick, check, heading } = require('./support');

// Native selector/focus semantics needed for the keyboard journey.
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
function toggle(details) { summary(details).fire('click'); details.open = !details.open; details.fire('toggle'); }
const noteIds = (root) => root.find('los-domain-note-row').map((row) => row.getAttribute('data-note-id'));
const optionValues = (select) => select.children.map((option) => option.getAttribute('value'));
const selectNote = (root, id) => root.find('los-domain-select-note').find((row) => row.getAttribute('data-los-tab') === id);
function collection(root, value) { root.find('los-filter-tabs').find((group) => group.getAttribute('aria-label') === 'Domain content')
  .children.find((row) => row.getAttribute('data-los-tab') === value).fire('click'); }

module.exports = async function run() {
  heading('Notes & shelves: corpus parity, explicit selection and ordered source placements');
  const { app, plugin, calls } = await boot({ patchManifest(manifest) {
    const note = manifest.records.find((row) => row.id === 'note-fixture-probability');
    manifest.records.push({ ...note, id: 'note-fixture-future-domain', title: 'Future biophysics wiring',
      domain: 'specialized-biophysics', path: 'knowledge/notes/biophysics/note-fixture-future-domain.md', role: 'crosswalk' });
    manifest.records.push({ ...note, id: 'note-fixture-nested-domain', title: 'Nested data systems reference',
      domain: 'narrow-data-topic', path: 'knowledge/notes/data-systems/narrow-topic/note-fixture-nested-domain.md' });
    manifest.counts.notes += 2;
    const shelf = manifest.records.find((row) => row.id === 'fixture-math-bookshelf');
    shelf.entries.push({ source: shelf.entries[0].source, group: 'revisit', why: 'The same source in a second ordered placement.' });
    shelf.sources.push(shelf.entries[0].source);
    manifest.records.find((row) => row.id === 'source-fixture-video').thematic_group_ids = [];
  } });
  await plugin.nav.openAtlas({ lens: 'domains' });
  let view = viewOf(app), root = browserDom(view.contentEl);
  const refreshRoot = () => { view = viewOf(app); root = browserDom(view.contentEl); };
  check('Notes & shelves keeps the existing route without opening the generated overview',
    plugin.router.snapshot().current.name === 'atlas' && plugin.router.snapshot().current.lens === 'domains'
    && view.getDisplayText() === 'LearningOS · Atlas' && root.findText('los-filter-tab', 'Notes & shelves')
    && plugin.activeNav === 'abilities' && !app.workspace.opened.includes('generated/domain-atlas.md'));
  check('shared Atlas choices have the settled order and labels',
    root.find('los-atlas-variant-switch')[0].children.map((row) => row.text).join('|') === 'Concepts|Notes & shelves|Abilities');
  check('known empty domains and future path buckets stay reachable without inferred aliases',
    choose(root, 'systems') && choose(root, 'biophysics') && choose(root, 'data-systems')
    && !choose(root, 'narrow-data-topic') && !choose(root, 'specialized-biophysics'));
  check('full counts describe records while notes and shelves remain separate collections',
    choose(root, 'mathematics').allText().includes('5 notes · 1 source shelf')
    && root.find('los-domain-note-row').length === 5 && root.find('los-domain-entry-row').length === 0
    && root.find('los-domain-inspector').length === 0);
  const shelfSearch = root.find('los-domain-search')[0]; shelfSearch.value = 'revisit'; shelfSearch.fire('input');
  check('global search exposes matching source shelves while Notes is selected',
    root.find('los-domain-note-row').length === 0 && root.find('los-domain-other-matches').length === 1
    && root.find('los-domain-search-status')[0].allText().includes('1 matching source shelf')
    && root.findText('los-filter-tab', 'Source shelves 1'));
  root.find('los-domain-other-matches')[0].fire('click'); refreshRoot();
  check('the matching-shelf action opens its full ordered placements without filtering entries',
    view.domains.collection === 'shelves' && root.find('los-domain-entry-row').length === 3
    && root.find('los-domain-search')[0].value === 'revisit');
  root.find('los-domain-search')[0].value = ''; root.find('los-domain-search')[0].fire('input');
  collection(root, 'notes'); refreshRoot();
  const beforeSelection = plugin.router.snapshot().history.length;
  const firstChoice = selectNote(root, 'note-fixture-probability'); firstChoice.focus(); firstChoice.fire('click');
  check('row selection opens an explicit inspector without opening the file or pushing history',
    root.find('los-domain-inspector').length === 1 && root.find('los-domain-open-concept').length === 2
    && !app.workspace.opened.includes('knowledge/notes/mathematics/note-fixture-probability.md')
    && plugin.router.snapshot().history.length === beforeSelection
    && global.document.activeElement === selectNote(root, 'note-fixture-probability'));
  check('unrecorded authorship remains honest rather than being labelled user writing',
    root.find('los-domain-inspector')[0].allText().includes('Authorship unrecorded'));
  toggle(root.find('los-domain-note-provenance')[0]);
  const search = root.find('los-domain-search')[0]; search.focus();
  for (const char of 'probability') search.typeText(char);
  check('continuous filtering retains the original field, focus, caret and selected domain',
    root.find('los-domain-search')[0] === search && global.document.activeElement === search
    && search.value === 'probability' && search.selectionStart === 11 && view.domains.selected === 'mathematics');
  search.setSelectionRange(0, 4); search.typeText('P'); search.typeText('rob');
  check('mid-string editing keeps the exact caret and selection', search.value === 'Probability'
    && search.selectionStart === 4 && search.selectionEnd === 4);
  search.value = 'Bayes'; search.fire('input');
  check('selected notes stay inspectable when outside the current search, with honest scope',
    root.find('los-domain-note-row').length === 1 && root.find('los-domain-inspector')[0].allText().includes('outside the current filters'));
  search.value = ''; search.fire('input');
  check('clearing search restores all rows and explicit provenance disclosure attention',
    root.find('los-domain-note-row').length === 5 && root.find('los-domain-note-provenance')[0].open);
  search.value = 'nothing-matches-this-fixture'; search.fire('input');
  check('zero matches preserve the domain and selected record without stale result rows',
    view.domains.selected === 'mathematics' && root.find('los-domain-choice').length === 1
    && root.allText().includes('0 domains match') && root.find('los-domain-note-row').length === 0
    && root.find('los-domain-inspector')[0].allText().includes('outside the current filters'));
  search.value = ''; search.fire('input');
  root.findText('los-btn', 'Clear selection').focus().fire('click');
  check('clearing the inspector returns keyboard focus to its retained note row',
    root.find('los-domain-inspector').length === 0 && view.domains.selectedNote === null
    && global.document.activeElement === selectNote(root, 'note-fixture-probability'));
  const first = choose(root, 'mathematics'); first.focus();
  let prevented = false;
  first.parentElement.fire('keydown', { key: 'ArrowDown', target: first, preventDefault() { prevented = true; } });
  const next = global.document.activeElement;
  check('domain arrow navigation changes focus without selecting or writing',
    prevented && next !== first && view.domains.selected === 'mathematics' && calls.envelopes.length === 0);
  const nextKey = next.getAttribute('data-los-tab'); next.fire('click');
  check('native activation retains focus on the replacement domain and clears foreign note attention',
    view.domains.selected === nextKey && global.document.activeElement === choose(root, nextKey)
    && view.domains.selectedNote === null && choose(root, nextKey).getAttribute('aria-pressed') === 'true');
  choose(root, 'biophysics').fire('click');
  check('future domains expose their complete note and role', root.findText('los-domain-note-row', 'Future biophysics wiring')
    && root.findText('los-domain-note-meta', 'Crosswalk'));
  choose(root, 'mathematics').fire('click');
  selectNote(root, 'note-fixture-probability').fire('click');
  root.find('los-domain-open-note')[0].fire('click'); await tick();
  check('Open note follows the authored path through the resource adapter',
    app.workspace.opened.includes('knowledge/notes/mathematics/note-fixture-probability.md'));
  root.find('los-domain-open-concept')[0].fire('click'); await tick();
  check('explicit linked concepts open their existing concept route', plugin.router.snapshot().current.name === 'atlas'
    && plugin.router.snapshot().current.concept === 'concept-bayes');
  await plugin.nav.openAtlas({ lens: 'domains' }); refreshRoot();
  check('returning to Notes & shelves restores its record attention independently of the concept route',
    view.domains.selectedNote === 'note-fixture-probability' && root.find('los-domain-inspector').length === 1);
  collection(root, 'shelves'); refreshRoot();
  check('Source shelves preserves repeated placements in authored order with distinct counts',
    root.find('los-domain-note-row').length === 0 && root.find('los-domain-shelf')[0].allText().includes('3 ordered entries · 2 sources')
    && root.find('los-domain-entry-row').map((row) => row.getAttribute('data-source-id')).join('|')
      === 'source-fixture-book|source-fixture-islp|source-fixture-book'
    && root.find('los-domain-entry-rationale').every((row) => !row.open));
  toggle(root.find('los-domain-entry-rationale')[2]);
  check('Why this source discloses rationale for the exact repeated placement',
    root.find('los-domain-entry-rationale')[2].open && root.find('los-domain-entry-rationale')[2].allText().includes('second ordered placement')
    && !root.find('los-domain-entry-rationale')[0].open);
  root.find('los-domain-open-shelf')[0].fire('click'); await tick();
  check('Open shelf uses the existing catalogue destination', plugin.router.snapshot().current.name === 'catalogue-detail'
    && plugin.router.snapshot().current.catalogueId === 'fixture-math-bookshelf');
  await plugin.nav.back(); refreshRoot();
  root.find('los-domain-open-source')[0].fire('click'); await tick();
  check('entry source navigation uses the existing source destination', plugin.router.snapshot().current.name === 'source-detail'
    && plugin.router.snapshot().current.resourceId === 'source-fixture-book');
  await plugin.nav.back(); refreshRoot();
  root.findText('los-btn', 'All source folders').fire('click'); await tick();
  check('All source folders opens the complete folder browser rather than a flat source list',
    plugin.router.snapshot().current.name === 'library-folder'
    && plugin.router.snapshot().current.path.length === 0);
  await plugin.nav.back(); refreshRoot();
  toggle(root.find('los-domain-tools')[0]);
  root.find('los-domain-source-group')[0].fire('click'); await tick();
  check('source folders use actual thematic-group route prefixes', plugin.router.snapshot().current.name === 'library-folder'
    && plugin.router.snapshot().current.path[0].startsWith('domain:thematic-group-'));
  await plugin.nav.back(); refreshRoot();
  root.find('los-domain-unfiled')[0].fire('click'); await tick();
  check('sources without a valid thematic group stay reachable through Unfiled', plugin.router.snapshot().current.path[0] === 'shelf:unfiled');
  await plugin.nav.back(); refreshRoot();
  root.find('los-domain-all-sources')[0].fire('click'); await tick();
  check('All sources opens the complete collection', plugin.router.snapshot().current.name === 'library-home'
    && plugin.router.snapshot().current.collection === 'sources');
  await plugin.nav.back(); refreshRoot();
  root.findText('los-btn', 'Generated text overview').fire('click'); await tick();
  check('generated text overview remains reachable through tools', app.workspace.opened.includes('generated/domain-atlas.md'));
  root.findText('los-filter-tab', 'Concepts').fire('click'); await tick();
  check('Concepts retains the prerequisite route', plugin.router.snapshot().current.lens === 'prerequisites');
  refreshRoot(); root.findText('los-filter-tab', 'Abilities').fire('click'); await tick();
  check('Abilities opens its existing route', plugin.router.snapshot().current.name === 'abilities');
  check('browsing, filtering and attention issue zero Gateway writes', calls.envelopes.length === 0);
  plugin.onunload();

  const roles = ['synthesis', 'reference', 'derivation', 'exercise-bank', 'mock-exam', 'implementation', 'question', 'crosswalk'];
  const authors = ['user', 'mixed', 'external', 'operator-drafted', null];
  const large = await boot({ patchManifest(manifest) {
    const base = manifest.records.find((row) => row.id === 'note-fixture-probability');
    const concept = manifest.records.find((row) => row.type === 'concept');
    const manyConceptIds = Array.from({length: 25}, (_, i) => `concept-fixture-note-link-${i}`);
    manifest.records.push(...manyConceptIds.map((id, i) => ({...concept, id, title: `Exact linked concept ${i}`, aliases: []})));
    manifest.counts.concepts += 25;
    for (const [ri, role] of roles.entries()) for (const [ai, authorship] of authors.entries()) {
      const id = `note-fixture-corpus-${ri}-${ai}`;
      manifest.records.push({ ...base, id, title: `Corpus ${String(ri).padStart(2, '0')} ${ai} ${'very long full title '.repeat(12)}`,
        role, authorship, concepts: ai === 0 ? [] : ai === 1 ? manyConceptIds : base.concepts,
        sources: ai === 0 ? [] : ['source-fixture-unavailable'], evidence: [{type: 'external', ref: `Exact evidence reference ${ri}-${ai}`}],
        material_analysis: {resolution: 'resolved', material: 'fixture-analysis.pdf', inspected_range: {start: 1, end: 2},
          recorded_source_digest: 'a'.repeat(64), frozen_input_sha256: 'b'.repeat(64), frozen_input_bytes: 100,
          source_id: ai === 0 ? 'source-fixture-book' : 'source-fixture-unavailable'} ,
        path: `knowledge/notes/${ri % 2 ? 'future-domain' : 'mathematics'}/${id}.md` });
    }
    manifest.counts.notes += 40;
    const shelf = manifest.records.find((row) => row.id === 'fixture-math-bookshelf');
    shelf.entries = Array.from({ length: 27 }, (_, i) => ({ source: i === 26 ? 'source-fixture-unavailable'
      : i % 2 ? 'source-fixture-islp' : 'source-fixture-book', group: `authored-group-${i}`, why: `Exact placement rationale ${i}` }));
    shelf.sources = shelf.entries.map((row) => row.source);
    manifest.records.push({ ...shelf, id: 'fixture-future-shelf', title: 'Future research shelf', domain: 'future-research',
      path: 'sources/collections/fixture-future-shelf.yaml', entries: [], sources: [] });
    manifest.counts.collections += 1;
  } });
  await large.plugin.nav.openAtlas({ lens: 'domains' });
  const largeView = viewOf(large.app), largeRoot = browserDom(largeView.contentEl);
  check('every projected role and authorship, including external and absent, is selectable',
    roles.every((value) => optionValues(largeRoot.find('los-domain-role-filter')[0]).includes(value))
    && ['user', 'mixed', 'external', 'operator-drafted', 'unrecorded'].every((value) => optionValues(largeRoot.find('los-domain-author-filter')[0]).includes(value)));
  let filterParity = true;
  for (const role of roles) for (const author of authors) {
    const roleFilter = largeRoot.find('los-domain-role-filter')[0]; roleFilter.value = role; roleFilter.fire('change');
    const authorFilter = largeRoot.find('los-domain-author-filter')[0]; authorFilter.value = author ?? 'unrecorded'; authorFilter.fire('change');
    for (const key of ['mathematics', 'future-domain']) {
      const choice = choose(largeRoot, key); if (!choice) continue; choice.fire('click');
      const expected = large.plugin.store.of('note').filter((note) => note.role === role && (note.authorship ?? 'unrecorded') === (author ?? 'unrecorded')
        && note.path.split('/')[2] === key).map((note) => note.id).sort();
      filterParity &&= JSON.stringify(noteIds(largeRoot).sort()) === JSON.stringify(expected);
    }
  }
  check('all role × authorship filter intersections preserve exact corpus ids', filterParity);
  largeRoot.find('los-domain-role-filter')[0].value = ''; largeRoot.find('los-domain-role-filter')[0].fire('change');
  largeRoot.find('los-domain-author-filter')[0].value = ''; largeRoot.find('los-domain-author-filter')[0].fire('change');
  const allIds = [];
  for (const key of largeRoot.find('los-domain-choice').map((row) => row.getAttribute('data-los-tab'))) {
    choose(largeRoot, key).fire('click');
    const more = largeRoot.find('los-domain-show-more')[0]; if (more) more.fire('click');
    allIds.push(...noteIds(largeRoot));
    const titles = largeRoot.find('los-domain-select-note').map((row) => row.text);
    check(`stable full-title order in ${key}`, titles.every((value, i) => i === 0 || titles[i - 1].localeCompare(value, 'en') <= 0));
  }
  check('complete browse-all reach has exact corpus id/count parity without duplicates',
    allIds.length === large.plugin.store.of('note').length && new Set(allIds).size === allIds.length
    && JSON.stringify(allIds.sort()) === JSON.stringify(large.plugin.store.of('note').map((note) => note.id).sort()));
  choose(largeRoot, 'mathematics').fire('click');
  selectNote(largeRoot, 'note-fixture-corpus-0-0').fire('click');
  check('long titles remain intact and zero linked concepts are explicit', largeRoot.find('los-domain-inspector')[0].allText().includes('very long full title '.repeat(12).trim())
    && largeRoot.find('los-domain-inspector')[0].allText().includes('Linked concepts · 0')
    && largeRoot.find('los-domain-inspector')[0].allText().includes('No explicit concept links'));
  toggle(largeRoot.find('los-domain-note-provenance')[0]);
  check('resolved analysis sources remain openable even when direct note sources are empty',
    largeRoot.find('los-domain-analysis-source').length === 1 && largeRoot.find('los-domain-note-source').length === 0
    && largeRoot.find('los-domain-note-provenance')[0].allText().includes('Recorded sources · 0')
    && largeRoot.find('los-domain-note-provenance')[0].allText().includes('source-fixture-book'));
  check('recorded evidence presents its exact type and reference legibly',
    largeRoot.find('los-domain-recorded-evidence')[0].allText() === 'external · Exact evidence reference 0-0');
  largeRoot.find('los-domain-analysis-source')[0].fire('click'); await tick();
  check('the recorded analysis source action follows the actual source detail route',
    large.plugin.router.snapshot().current.name === 'source-detail' && large.plugin.router.snapshot().current.resourceId === 'source-fixture-book');
  await large.plugin.nav.back();
  selectNote(largeRoot, 'note-fixture-corpus-0-1').fire('click');
  check('many explicitly linked concepts remain fully reachable without a silent remainder',
    largeRoot.find('los-domain-open-concept').length === 25
    && largeRoot.find('los-domain-inspector')[0].allText().includes('Linked concepts · 25')
    && largeRoot.find('los-domain-open-concept').every((row, i) => row.allText() === `Exact linked concept ${i}`));
  toggle(largeRoot.find('los-domain-note-provenance')[0]);
  check('unavailable direct and analysis sources preserve exact ids without broken actions',
    largeRoot.find('los-domain-note-provenance')[0].allText().includes('source-fixture-unavailable · unavailable in this projection')
    && largeRoot.find('los-domain-note-source').length === 0 && largeRoot.find('los-domain-analysis-source').length === 0);
  collection(largeRoot, 'shelves');
  check('large source shelves initially disclose an honest bounded entry count', largeRoot.find('los-domain-entry-row').length === 20
    && largeRoot.find('los-domain-shelf')[0].allText().includes('27 ordered entries · 3 sources'));
  largeRoot.find('los-domain-show-more')[0].fire('click');
  const shelfEntries = largeRoot.find('los-domain-entry-row');
  check('Show all keeps every authored entry index, duplicate source, group and rationale', shelfEntries.length === 27
    && shelfEntries.every((row, i) => row.getAttribute('data-entry-index') === String(i)
      && row.allText().includes(`authored-group-${i}`) && row.allText().includes(`Exact placement rationale ${i}`))
    && shelfEntries[26].allText().includes('unavailable in this projection')
    && shelfEntries[26].find('los-domain-open-source').length === 0);
  const shelfIds = [];
  for (const key of largeRoot.find('los-domain-choice').map((row) => row.getAttribute('data-los-tab'))) {
    choose(largeRoot, key).fire('click');
    const choices = largeRoot.find('los-domain-shelf-choice');
    if (choices.length) for (const id of choices.map((row) => row.getAttribute('data-los-tab'))) {
      largeRoot.find('los-domain-shelf-choice').find((row) => row.getAttribute('data-los-tab') === id).fire('click');
      shelfIds.push(largeRoot.find('los-domain-shelf')[0].getAttribute('data-shelf-id'));
    }
    else shelfIds.push(...largeRoot.find('los-domain-shelf').map((row) => row.getAttribute('data-shelf-id')));
  }
  check('all catalogues and topic packs retain exact shelf id/count parity across domains',
    JSON.stringify(shelfIds.sort()) === JSON.stringify([...large.plugin.store.catalogues(), ...large.plugin.store.topicPacks()].map((row) => row.id).sort()));
  check('large corpus browsing remains read only', large.calls.envelopes.length === 0);
  large.plugin.onunload();

  const emptyContext = await boot({ patchManifest(manifest) {
    manifest.records = manifest.records.filter((record) => !['note', 'collection', 'topic-pack'].includes(record.type));
    manifest.topic_packs = [];
    manifest.counts.notes = 0; manifest.counts.collections = 0; manifest.counts.topic_packs = 0;
  } });
  await emptyContext.plugin.nav.openAtlas({ lens: 'domains' });
  const emptyRoot = viewOf(emptyContext.app).contentEl;
  check('empty knowledge retains every known domain and source reach with honest emptiness',
    emptyRoot.allText().includes('No notes published in this domain') && emptyRoot.find('los-domain-choice').length === 7
    && emptyRoot.find('los-domain-all-sources').length === 1);
  emptyContext.plugin.store.ready = false; emptyContext.plugin.store.error = 'fixture unavailable'; viewOf(emptyContext.app).render();
  check('unavailable projections show no stale counts and keep Atlas choices reachable',
    emptyRoot.allText().includes('Notes & shelves unavailable') && emptyRoot.find('los-domain-choice').length === 0
    && emptyRoot.findText('los-filter-tab', 'Abilities') && emptyContext.calls.envelopes.length === 0);
  emptyContext.plugin.onunload();
  const invalidContext = await boot({ patchManifest(manifest) { delete manifest.records.find((record) => record.type === 'note').role; } });
  await invalidContext.plugin.nav.openAtlas({ lens: 'domains' });
  check('missing required note roles still fail closed at the manifest boundary', !invalidContext.plugin.store.ready
    && viewOf(invalidContext.app).contentEl.allText().includes('Notes & shelves unavailable')
    && invalidContext.calls.envelopes.length === 0);
  invalidContext.plugin.onunload();
};
