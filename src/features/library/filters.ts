import type { LibraryView } from '../../views/library-view';
import {
  button,
  empty,
  pageHeader,
} from '../../components';
import {
  asString as projectedString,
  asStrings as projectedStrings,
} from '../../projection/readers';
import {
  SOURCE_FACETS,
  VALUED_FACETS,
  SOURCE_FILTER_DIMENSIONS,
  type SourceFilterDimension,
  type LibraryRecordView,
  readLibraryRecords,
} from './model';

export function sourceFilterValuesFor(
  view: LibraryView,

    source: LibraryRecordView,
    dimension: SourceFilterDimension,
  ): string[] {
    if (dimension === 'domain') {
      return projectedStrings(
        source.record.thematic_group_ids,
      );
    }

    if (dimension === 'topic') {
      return projectedStrings(
        source.record.topics,
      );
    }

    if (dimension === 'purpose') {
      const values = new Set<string>();

      for (const evaluation of source.evaluations) {
        for (const role of evaluation.roles) {
          values.add(role);
        }
      }

      return [...values];
    }

    if (dimension === 'form') {
      return source.sourceType
        ? [source.sourceType]
        : [];
    }

    return view.plugin.store
      .useModules(source.id)
      .map((module) =>
        projectedString(module.id),
      )
      .filter(
        (id): id is string =>
          id !== null,
      );
  }

export function sourceMatchesFilters(
  view: LibraryView,

    source: LibraryRecordView,
    omit: SourceFilterDimension | null = null,
  ): boolean {
    for (const [dimension] of SOURCE_FILTER_DIMENSIONS) {
      if (dimension === omit) {
        continue;
      }

      const selected =
        view.filters[dimension];

      if (
        selected
        && !view.sourceFilterValuesFor(
          source,
          dimension,
        ).includes(selected)
      ) {
        return false;
      }
    }

    return true;
  }

export function sourceFilterTally(
  view: LibraryView,

    sources: LibraryRecordView[],
    dimension: SourceFilterDimension,
  ): Map<string, number> {
    const tally = new Map<string, number>();

    for (const source of sources) {
      // Each facet's choices are tallied after every OTHER active filter.
      // This keeps simultaneous filtering intelligible without collapsing the
      // currently selected dimension onto itself.
      if (!view.sourceMatchesFilters(source, dimension)) {
        continue;
      }

      for (
        const value of view.sourceFilterValuesFor(
          source,
          dimension,
        )
      ) {
        tally.set(
          value,
          (tally.get(value) ?? 0) + 1,
        );
      }
    }

    return tally;
  }

export function sourceFilterLabel(
  view: LibraryView,

    dimension: SourceFilterDimension,
    value: string,
  ): string {
    if (dimension === 'domain') {
      const group =
        view.plugin.store.get(value);

      return group
        ? projectedString(group.title) ?? value
        : value;
    }

    if (dimension === 'topic') {
      const topic =
        view.plugin.store.topics()
          .find(
            (row) =>
              projectedString(row.id)
              === value,
          );

      return topic
        ? projectedString(topic.title) ?? value
        : value;
    }

    if (dimension === 'use') {
      const module =
        view.plugin.store.get(value);

      return module
        ? projectedString(module.title) ?? value
        : value;
    }

    return value
      .replace(/[-_]+/g, ' ')
      .replace(
        /\b\w/g,
        (letter) =>
          letter.toLocaleUpperCase(),
      );
  }

export function renderSourceBrowser(
  view: LibraryView,

    root: HTMLElement,
  ): void {
    pageHeader(
      root,
      'Library · Learning sources',
      'Library',
      'Everything you possess, searchable once and browsable through any useful facet.',
    );

    view.renderCollectionSwitch(root);

    const all = readLibraryRecords(
      view.plugin.store.sources(),
    );

    const browser = root.createDiv({
      cls: 'los-library-browser',
    });

    const toolbar = browser.createDiv({
      cls: 'los-library-browser-toolbar',
    });

    const input = toolbar.createEl(
      'input',
      {
        cls:
          'los-search '
          + 'los-route-search '
          + 'los-library-global-search',
        attr: {
          type: 'search',
          placeholder:
            'Search all sources…',
          'aria-label':
            'Search learning sources',
        },
      },
    ) as HTMLInputElement;

    input.value = view.query;

    input.addEventListener(
      'input',
      async () => {
        view.query = input.value;

        view.screen = 'home';
        view.groupId = null;

        await view.rememberSourceBrowser();
        view.render();
      },
    );

    const fullTextSearch = button(
      toolbar,
      'Full text / OCR',
      () => view.plugin.nav.openFullTextSearch(),
      'quiet',
    );

    fullTextSearch.addClass(
      'los-library-ocr-action',
    );
    fullTextSearch.setAttribute(
      'aria-label',
      'Search full text and OCR content',
    );

    browser.createEl('h2', {
      cls: 'los-library-filter-heading',
      text: 'Browse / filter',
    });

    const facets = browser.createDiv({
      cls: 'los-library-peer-facets',
      attr: {
        'aria-label':
          'Learning Source facets',
      },
    });

    for (
      const [
        dimension,
        label,
      ] of SOURCE_FILTER_DIMENSIONS
    ) {
      const control = facets.createDiv({
        cls: 'los-library-peer-facet',
      });

      control.createEl(
        'label',
        {
          cls: 'los-library-facet-label',
          text: label,
        },
      );

      const select = control.createEl(
        'select',
        {
          cls: 'los-library-facet-select',
          attr: {
            'data-facet': dimension,
            'aria-label':
              `Filter by ${label}`,
          },
        },
      ) as HTMLSelectElement;

      const tally =
        view.sourceFilterTally(
          all,
          dimension,
        );

      select.createEl(
        'option',
        {
          text: `All ${label.toLocaleLowerCase()}`,
          attr: {
            value: '',
          },
        },
      );

      const ordered =
        [...tally.entries()]
          .sort(
            (left, right) => {
              const leftLabel =
                view.sourceFilterLabel(
                  dimension,
                  left[0],
                );

              const rightLabel =
                view.sourceFilterLabel(
                  dimension,
                  right[0],
                );

              return (
                leftLabel.localeCompare(
                  rightLabel,
                )
              );
            },
          );

      for (
        const [
          value,
          count,
        ] of ordered
      ) {
        select.createEl(
          'option',
          {
            text:
              `${view.sourceFilterLabel(
                dimension,
                value,
              )} (${count})`,
            attr: {
              value,
            },
          },
        );
      }

      select.value =
        view.filters[dimension];

      select.addEventListener(
        'change',
        () => {
          void view.setSourceFilter(
            dimension,
            select.value,
          );
        },
      );
    }

    const active =
      SOURCE_FILTER_DIMENSIONS
        .filter(
          ([dimension]) =>
            Boolean(
              view.filters[dimension],
            ),
        );

    if (active.length) {
      const activeWrap =
        browser.createDiv({
          cls: 'los-library-active-filters',
          attr: {
            'aria-label':
              'Active Library filters',
          },
        });

      for (
        const [
          dimension,
          label,
        ] of active
      ) {
        const value =
          view.filters[dimension];

        const control = button(
          activeWrap,
          `${label}: ${view.sourceFilterLabel(
            dimension,
            value,
          )} ×`,
          () =>
            void view.setSourceFilter(
              dimension,
              '',
            ),
          'quiet',
        );

        control.addClass(
          'los-library-filter-chip',
        );
      }

      button(
        activeWrap,
        'Clear filters',
        () =>
          void view.clearSourceFilters(),
        'quiet',
      );
    }

    const words =
      view.query
        .trim()
        .toLocaleLowerCase()
        .split(/\s+/)
        .filter(Boolean);

    const rows = all
      .filter(
        (source) =>
          view.sourceMatchesFilters(source),
      )
      .filter(
        (source) => {
          if (!words.length) {
            return true;
          }

          const hay = [
            source.id,
            source.title,
            source.summary,
            source.purpose,
            source.organization,
            source.sourceType,
            ...source.aliases,
            ...source.authors,
          ]
            .filter(Boolean)
            .join(' ')
            .toLocaleLowerCase();

          return words.every(
            (word) =>
              hay.includes(word),
          );
        },
      )
      .sort(
        (left, right) =>
          left.title.localeCompare(
            right.title,
          ),
      );

    browser.createDiv({
      cls: 'los-library-result-summary',
      text:
        `${rows.length} of ${all.length} `
        + `source${all.length === 1 ? '' : 's'}`,
    });

    if (!all.length) {
      empty(
        browser,
        'No Learning Sources',
        'The Core projection currently contains no source records.',
      );
      return;
    }

    if (!rows.length) {
      const hasQuery = Boolean(
        view.query.trim(),
      );
      const hasFilters = SOURCE_FILTER_DIMENSIONS
        .some(
          ([dimension]) =>
            Boolean(view.filters[dimension]),
        );
      const resetLabel = hasQuery
        ? hasFilters
          ? 'Clear search and filters'
          : 'Clear search'
        : 'Clear filters';
      const reset = (): void => {
        if (hasQuery) {
          void view.clearSourceSearchAndFilters();
        } else {
          void view.clearSourceFilters();
        }
      };

      empty(
        browser,
        'No matching sources',
        'No source matches the current search and facet combination.',
        resetLabel,
        reset,
      );
      return;
    }

    const list = browser.createDiv({
      cls:
        'los-route-list '
        + 'los-library-route-list',
    });

    for (const source of rows) {
      view.renderRecordRow(
        list,
        source,
        false,
      );
    }
  }

export function renderSourceFacets(
  view: LibraryView,

    parent: HTMLElement,
  ): void {
    const facets = parent.createDiv({
      cls:
        'los-library-facets-inline',
      attr: {
        'aria-label': 'Source filters',
      },
    });

    for (
      const [
        id,
        label,
      ] of SOURCE_FACETS
    ) {
      const control = button(
        facets,
        label,
        async () => {
          view.facet = id;
          // Switching facet always clears the value: a topic selection is
          // meaningless once you are filtering by form.
          view.facetValue = null;
          await view.rememberGroup();
          view.render();
        },
        view.facet === id
          ? 'row'
          : 'quiet',
      );

      control.setAttribute(
        'aria-pressed',
        String(view.facet === id),
      );
    }
  }

export function renderFacetValues(
  view: LibraryView,

    parent: HTMLElement,
    sources: LibraryRecordView[],
  ): void {
    if (!VALUED_FACETS.has(view.facet)) {
      return;
    }

    const tally = view.facetTally(sources);
    const wrap = parent.createDiv({
      cls: 'los-library-facet-values',
    });

    if (!tally.size) {
      wrap.createDiv({
        cls: 'los-muted',
        text:
          view.facet === 'topic'
            ? 'No source in this view carries a topic yet. '
              + 'Topics are added when a source is actually used, '
              + 'never in a bulk pass.'
            : 'Nothing to filter by here yet.',
      });
      return;
    }

    const clear = button(
      wrap,
      `All (${sources.length})`,
      () => {
        view.facetValue = null;
        view.render();
      },
      view.facetValue ? 'quiet' : 'row',
    );
    clear.setAttribute(
      'aria-pressed',
      String(!view.facetValue),
    );

    const ordered = [...tally.entries()]
      .sort(
        (a, b) =>
          b[1] - a[1]
          || a[0].localeCompare(b[0]),
      );

    for (const [value, count] of ordered) {
      const control = button(
        wrap,
        `${view.facetValueLabel(value)} (${count})`,
        () => {
          view.facetValue =
            view.facetValue === value
              ? null
              : value;
          view.render();
        },
        view.facetValue === value
          ? 'row'
          : 'quiet',
      );
      control.setAttribute(
        'aria-pressed',
        String(view.facetValue === value),
      );
    }

    if (view.facet === 'topic') {
      const untopiced = sources.filter(
        (source) =>
          !projectedStrings(
            source.record.topics,
          ).length,
      ).length;
      if (untopiced) {
        wrap.createDiv({
          cls: 'los-micro',
          text:
            `${untopiced} of ${sources.length} not yet `
            + 'classified by topic — expected, not a backlog.',
        });
      }
    }
  }
