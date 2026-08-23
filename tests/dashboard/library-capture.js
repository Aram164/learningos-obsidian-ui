'use strict';

const {
  path,
  fs,
  makeApp,
  Notice,
  stub,
  ROOT,
  FIXTURE,
  LearningOSUI,
  FIXTURE_GROUP_COUNT,
  VIEW,
  tick,
  frame,
  check,
  heading,
  build,
  boot,
} = require('./support');

module.exports = async function run() {
  heading('library navigability');
  {
    const { app, plugin } = await boot();

    await plugin.nav.openLibrary();

    let view =
      app.workspace.getLeavesOfType(
        VIEW.library,
      )[0].view;

    let text =
      view.contentEl.allText();

    check(
      'Learning Sources opens as one global faceted browser',
      view.screen === 'home'
        && view.collection === 'sources'
        && view.contentEl.find(
          'los-group-card',
        ).length === 0
        && view.contentEl.find(
          'los-route-row',
        ).length > 0
        && view.contentEl.find(
          'los-library-peer-facets',
        ).length === 1,
    );

    check(
      'the five semantic facets are peers',
      ['Domain', 'Topic', 'Purpose', 'Form', 'Current use']
        .every(
          (label) =>
            text.includes(label),
        )
        && view.contentEl.find(
          'los-library-facet-select',
        ).length === 5,
    );

    check(
      'Sources and Curated packs remain separate collections',
      view.contentEl.find(
        'los-collection-switch',
      ).length === 1
        && text.includes('Sources')
        && text.includes('Curated packs'),
    );

    const select = (dimension) =>
      view.contentEl.find(
        'los-library-facet-select',
      ).find(
        (candidate) =>
          candidate.getAttribute(
            'data-facet',
          ) === dimension,
      );

    const domain = select('domain');
    domain.value =
      'thematic-group-mathematics';
    domain.fire('change');

    await tick();
    await tick();

    view =
      app.workspace.getLeavesOfType(
        VIEW.library,
      )[0].view;

    const expectedMathSources =
      plugin.store.sources().filter(
        (source) =>
          Array.isArray(
            source.thematic_group_ids,
          )
          && source.thematic_group_ids.includes(
            'thematic-group-mathematics',
          ),
      ).length;

    check(
      'Domain is a filter rather than a required first navigation level',
      view.filters.domain
        === 'thematic-group-mathematics'
        && plugin.router.snapshot().current.name
          === 'library-home'
        && plugin.router.snapshot().current.filters?.domain
          === 'thematic-group-mathematics'
        && view.contentEl.find(
          'los-route-row',
        ).length === expectedMathSources
        && view.contentEl.find(
          'los-library-filter-chip',
        ).length === 1,
    );

    const topic =
      view.contentEl.find(
        'los-library-facet-select',
      ).find(
        (candidate) =>
          candidate.getAttribute(
            'data-facet',
          ) === 'topic',
      );

    topic.value =
      'topic-probability';
    topic.fire('change');

    await tick();
    await tick();

    view =
      app.workspace.getLeavesOfType(
        VIEW.library,
      )[0].view;

    check(
      'peer facets combine conjunctively without replacing one another',
      view.filters.domain
        === 'thematic-group-mathematics'
        && view.filters.topic
          === 'topic-probability'
        && view.contentEl.find(
          'los-route-row',
        ).length === 2
        && view.contentEl.find(
          'los-library-filter-chip',
        ).length === 2,
    );

    const route =
      plugin.router.snapshot().current;

    check(
      'the complete facet combination is persisted on the product route',
      route.name === 'library-home'
        && route.filters?.domain
          === 'thematic-group-mathematics'
        && route.filters?.topic
          === 'topic-probability'
        && route.filters?.purpose === ''
        && route.filters?.form === ''
        && route.filters?.use === '',
    );

    view.contentEl
      .findText(
        'los-btn',
        'Clear filters',
      )
      .fire('click');

    await tick();
    await tick();

    view =
      app.workspace.getLeavesOfType(
        VIEW.library,
      )[0].view;

    check(
      'clearing facet state does not change source identity or collection',
      Object.values(
        view.filters,
      ).every(
        (value) => value === '',
      )
        && view.collection === 'sources',
    );

    const math =
      view.contentEl.find(
        'los-library-facet-select',
      ).find(
        (candidate) =>
          candidate.getAttribute(
            'data-facet',
          ) === 'domain',
      );

    math.value =
      'thematic-group-mathematics';
    math.fire('change');

    await tick();
    await tick();

    view =
      app.workspace.getLeavesOfType(
        VIEW.library,
      )[0].view;

    const book =
      view.contentEl.find(
        'los-route-row',
      ).find(
        (row) =>
          row.getAttribute(
            'data-record-id',
          ) === 'source-fixture-book',
      );

    check(
      'no source is automatically selected',
      view.resourceId === null
        && Boolean(book),
    );

    book.fire('click');

    await tick();
    await tick();

    view =
      app.workspace.getLeavesOfType(
        VIEW.library,
      )[0].view;

    text =
      view.contentEl.allText();

    check(
      'source detail stays a full page and preserves shelf rationale',
      view.screen === 'source-detail'
        && view.contentEl.find(
          'los-detail-page',
        ).length === 1
        && text.includes(
          'Fixture math bookshelf',
        )
        && text.includes(
          'The spine — read this before anything else on the shelf.',
        ),
    );

    const firstShelfIndex =
      view.shelfIndex();
    plugin.store.data = {
      ...plugin.store.data,
    };
    const refreshedShelfIndex =
      view.shelfIndex();
    check(
      'shelf membership cache refreshes for a new manifest with the same snapshot',
      refreshedShelfIndex !== firstShelfIndex,
    );

    const technical =
      view.contentEl.find(
        'los-technical-details',
      )[0];

    check(
      'record ID and Copy ID stay under Technical details',
      Boolean(technical)
        && technical.allText()
          .includes('Copy ID')
        && technical.find(
          'los-detail-id',
        )[0]?.text
          === 'source-fixture-book',
    );

    await plugin.nav.back();

    view =
      app.workspace.getLeavesOfType(
        VIEW.library,
      )[0].view;

    check(
      'Back restores the exact global facet state',
      plugin.router.snapshot().current.name
        === 'library-home'
        && view.filters.domain
          === 'thematic-group-mathematics'
        && view.filters.topic === ''
        && view.contentEl.find(
          'los-library-filter-chip',
        ).length === 1,
    );

    await plugin.nav.openLibraryHome(
      'topic-packs',
    );

    view =
      app.workspace.getLeavesOfType(
        VIEW.library,
      )[0].view;

    check(
      'Topic Packs intentionally retain thematic-group navigation',
      view.collection === 'topic-packs'
        && view.contentEl.find(
          'los-group-card',
        ).length
          === FIXTURE_GROUP_COUNT
        && view.contentEl.find(
          'los-route-row',
        ).length === 0,
    );

    view.contentEl
      .findText(
        'los-group-card',
        'Machine Learning',
      )
      .fire('click');

    await tick();

    view =
      app.workspace.getLeavesOfType(
        VIEW.library,
      )[0].view;

    check(
      'a Topic Pack group still opens its ordered pack list',
      view.screen === 'group'
        && view.collection
          === 'topic-packs'
        && view.contentEl.find(
          'los-route-row',
        ).length === 1
        && view.contentEl.allText()
          .includes(
            'Fixture ML evaluation pack',
          ),
    );

    view.contentEl.find(
      'los-route-row',
    )[0].fire('click');

    await tick();

    view =
      app.workspace.getLeavesOfType(
        VIEW.library,
      )[0].view;

    text =
      view.contentEl.allText();

    check(
      'Topic Pack detail keeps one explicit purpose and canonical order',
      view.screen
        === 'topic-pack-detail'
        && text.includes(
          'Compare one bounded set of model-evaluation choices.',
        )
        && view.contentEl.find(
          'los-pack-entry',
        ).length === 2
        && view.contentEl.find(
          'los-pack-order',
        ).map(
          (el) => el.text,
        ).join(',') === '1,2',
    );

    plugin.onunload();
  }

  {
    const { app, plugin } = await boot({
      patchManifest: (manifest) => {
        // If the UI accidentally reconstructs Current use through units,
        // this test goes empty. source_to_modules is the authority.
        manifest.indexes.source_to_units = {};
        manifest.indexes.source_to_modules[
          'source-fixture-islp'
        ] = [
          'module-fixture-m2',
        ];
      },
    });

    await plugin.nav.openLibrary();

    let view =
      app.workspace.getLeavesOfType(
        VIEW.library,
      )[0].view;

    const use =
      view.contentEl.find(
        'los-library-facet-select',
      ).find(
        (candidate) =>
          candidate.getAttribute(
            'data-facet',
          ) === 'use',
      );

    use.value = 'module-fixture-m2';
    use.fire('change');

    await tick();
    await tick();

    view =
      app.workspace.getLeavesOfType(
        VIEW.library,
      )[0].view;

    const ids =
      view.contentEl.find(
        'los-route-row',
      ).map(
        (row) =>
          row.getAttribute(
            'data-record-id',
          ),
      );

    check(
      'Current use reads authoritative source_to_modules even with source_to_units empty',
      view.filters.use
        === 'module-fixture-m2'
        && ids.includes(
          'source-fixture-islp',
        ),
    );

    plugin.onunload();
  }

  {
    const first = await boot();

    await first.plugin.nav.openLibraryHome(
      'sources',
      'probability',
      {
        domain:
          'thematic-group-mathematics',
        topic:
          'topic-probability',
        purpose: '',
        form: '',
        use: '',
      },
    );

    const persisted = {
      ...first.plugin._data,
    };

    first.plugin.onunload();

    const second = await build({
      settings: persisted,
    });

    await second.app.workspace._ready();

    const leaf =
      second.app.workspace.getLeavesOfType(
        VIEW.library,
      )[0];

    check(
      'reload restores query and all five source-facet fields exactly',
      leaf?.view?.screen === 'home'
        && leaf.view.query
          === 'probability'
        && leaf.view.filters.domain
          === 'thematic-group-mathematics'
        && leaf.view.filters.topic
          === 'topic-probability'
        && leaf.view.filters.purpose === ''
        && leaf.view.filters.form === ''
        && leaf.view.filters.use === '',
    );

    second.plugin.onunload();
  }

  {
    const { app, plugin } = await boot();

    await plugin.nav.openLibraryHome(
      'sources',
      'definitely-unfindable-library-source',
    );

    let view = app.workspace.getLeavesOfType(
      VIEW.library,
    )[0].view;

    check(
      'a text-only Library zero result offers a search-specific recovery',
      view.query === 'definitely-unfindable-library-source'
        && Boolean(
          view.contentEl.findText(
            'los-btn',
            'Clear search',
          ),
        ),
    );

    view.contentEl.findText(
      'los-btn',
      'Clear search',
    ).fire('click');

    await tick();
    await tick();

    view = app.workspace.getLeavesOfType(
      VIEW.library,
    )[0].view;

    check(
      'Library recovery clears the persisted query and restores sources',
      view.query === ''
        && plugin.router.snapshot().current.query === ''
        && view.contentEl.find('los-route-row').length > 0,
    );

    plugin.onunload();
  }

  heading('zero-friction inbox capture');
  {
    const { app, plugin, calls } = await boot();
    await plugin.nav.openProgram('inbox');
    const view = app.workspace.getLeavesOfType(VIEW.program)[0].view;
    let element = view.contentEl;
    check('Capture identifies itself in the Obsidian tab',
      view.getDisplayText() === 'LearningOS · Capture');
    check('empty Capture actions are disabled consistently',
      element.findText('los-btn', 'Capture text').disabled === true
      && element.findText('los-btn', 'Capture selected file').disabled === true);
    element.find('los-capture-title')[0].value = 'Fixture thought';
    element.find('los-capture-title')[0].fire('input');
    element.find('los-capture-editor')[0].value = 'A half-formed synthetic idea.';
    element.find('los-capture-editor')[0].fire('input');
    check('Capture text enables only after required content is present',
      element.findText('los-btn', 'Capture text').disabled === false);
    element.findText('los-btn', 'Capture text').fire('click'); await tick(); await tick();
    const textCapture = calls.envelope('capture.create')?.payload;
    check('text capture delegates exact wording and optional title to los.py',
      textCapture?.text === 'A half-formed synthetic idea.' && textCapture?.title === 'Fixture thought');
    check('capture refreshes the atomic projection after the write',
      calls.some((args) => args.length === 1 && args[0] === 'generate'));

    element = view.contentEl;
    element.find('los-capture-file')[0].files = [{ name: 'handwriting.png', __path: '/tmp/handwriting.png' }];
    element.find('los-capture-file')[0].fire('change');
    check('file capture enables only after a local file is selected',
      element.findText('los-btn', 'Capture selected file').disabled === false);
    element.findText('los-btn', 'Capture selected file').fire('click'); await tick(); await tick();
    check('file capture resolves the Electron File through webUtils',
      calls.envelopes.some((e) => e.capability === 'capture.create'
        && e.payload.file === '/tmp/handwriting.png'));
    plugin.onunload();
  }
};
