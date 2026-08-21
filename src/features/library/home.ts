import type { LibraryView } from '../../views/library-view';
import {
  button,
  empty,
  pageHeader,
} from '../../components';
import {
  LIBRARY_COLLECTIONS,
  type ThematicGroupView,
  readThematicGroup,
  readLibraryRecords,
} from './model';
import { enableButtonGroupKeyboardNavigation } from '../../accessibility/button-group';

export function renderHome(
  view: LibraryView,

    root: HTMLElement,
  ): void {
    if (view.collection === 'sources') {
      view.renderSourceBrowser(root);
      return;
    }
    pageHeader(
      root,
      'Library',
      'Choose a thematic group',
      view.collection === 'topic-packs'
        ? 'Topic Packs are narrow, purpose-built and manually ordered collections.'
        : 'Open a domain to browse its learning sources.',
    );

    view.renderCollectionSwitch(root);

    const groups = view.plugin.store
      .thematicGroups()
      .map(readThematicGroup)
      .filter(
        (
          group,
        ): group is ThematicGroupView =>
          group !== null,
      );

    if (!groups.length) {
      empty(
        root,
        'No thematic groups',
        'Rebuild the projection after defining thematic-group metadata.',
      );
      return;
    }

    const grid = root.createDiv({
      cls:
        'los-group-grid '
        + 'los-library-group-grid',
    });

    for (const group of groups) {
      const count =
        view.collection === 'topic-packs'
          ? view.plugin.store
            .topicPacksForGroup(group.id)
            .length
          : view.plugin.store
            .sourcesForGroup(group.id)
            .length;

      const card = grid.createEl(
        'button',
        {
          cls:
            'los-group-card '
            + 'is-clickable',
          attr: {
            type: 'button',
            'aria-label':
              `Open ${group.title}`,
          },
        },
      );

      const head = card.createDiv({
        cls: 'los-group-card-header',
      });

      head.createEl(
        'h2',
        {
          text: group.title,
        },
      );

      const countLabel =
        view.collection === 'topic-packs'
          ? `pack${count === 1 ? '' : 's'}`
          : `source${count === 1 ? '' : 's'}`;

      head.createSpan({
        cls: 'los-group-count',
        text: `${count} ${countLabel}`,
      });

      if (group.description) {
        card.createEl(
          'p',
          {
            text: group.description,
          },
        );
      }

      card.createSpan({
        cls: 'los-route-open',
        text: 'Open →',
      });

      card.addEventListener(
        'click',
        () => {
          view.selectedElementId =
            group.id;

          view.plugin.nav.openLibraryGroup(
            view.collection,
            group.id,
          );
        },
      );
    }
  }

export function renderCollectionSwitch(
  view: LibraryView,

    root: HTMLElement,
  ): void {
    const switcher = root.createDiv({
      cls: 'los-collection-switch',
      attr: {
        role: 'group',
        'aria-label':
          'Library collection',
      },
    });
    enableButtonGroupKeyboardNavigation(switcher);

    for (
      const [
        id,
        label,
      ] of LIBRARY_COLLECTIONS
    ) {
      const control = button(
        switcher,
        label,
        () =>
          view.plugin.nav.openLibraryHome(id),
        view.collection === id
          ? 'cta'
          : 'quiet',
      );

      control.setAttrs({
        'aria-pressed': String(
          view.collection === id,
        ),
      });
    }
  }

export function renderGroup(
  view: LibraryView,

    root: HTMLElement,
  ): void {
    const group = readThematicGroup(
      view.groupId
        ? view.plugin.store.get(
          view.groupId,
        )
        : null,
    );

    const back = button(
      root,
      '‹ Library',
      () => view.plugin.nav.back(),
      'quiet',
    );

    back.addClass('los-route-back');

    if (!group) {
      empty(
        root,
        'Thematic group unavailable',
        'Return to Library and choose another group.',
        'Back',
        () => view.plugin.nav.back(),
      );
      return;
    }

    const isPacks =
      view.collection === 'topic-packs';

    pageHeader(
      root,
      isPacks
        ? 'Topic Packs'
        : 'Learning Sources',
      group.title,
      isPacks
        ? 'Purpose-built collections in this thematic group.'
        : 'Learning sources in this thematic group.',
    );

    const toolbar = root.createDiv({
      cls: 'los-library-toolbar',
    });

    const input = toolbar.createEl(
      'input',
      {
        cls:
          'los-search '
          + 'los-route-search',
        attr: {
          type: 'search',
          placeholder:
            `Search ${group.title} `
            + `${isPacks
              ? 'topic packs'
              : 'sources'}…`,
          'aria-label':
            `Search ${group.title} `
            + `${isPacks
              ? 'topic packs'
              : 'sources'}`,
        },
      },
    ) as HTMLInputElement;

    input.value = view.query;

    input.addEventListener(
      'input',
      async () => {
        view.query = input.value;
        await view.rememberGroup();
        view.render();
      },
    );

    if (!isPacks) {
      view.renderSourceFacets(toolbar);

      button(
        toolbar,
        'Full-text / OCR search',
        () =>
          view.plugin.nav.openFullTextSearch(
            view.query,
          ),
        'quiet',
      );
    }

    const rawRecords = isPacks
      ? view.plugin.store
        .topicPacksForGroup(group.id)
      : view.plugin.store
        .sourcesForGroup(group.id);

    const all =
      readLibraryRecords(rawRecords);

    // Facet values are tallied over the whole group, before the value filter,
    // so the counts do not collapse to 1 as soon as you pick one.
    if (!isPacks) {
      view.renderFacetValues(toolbar, all);
    }

    const needle =
      view.query
        .trim()
        .toLocaleLowerCase();

    const words =
      needle
        .split(/\s+/)
        .filter(Boolean);

    const rows = all
      .filter((record) => {
        if (
          !isPacks
          && !view.matchesSourceFacet(
            record.record,
          )
        ) {
          return false;
        }

        if (!words.length) {
          return true;
        }

        const hay = [
          record.id,
          record.title,
          record.purpose,
          record.summary,
          ...record.aliases,
          ...record.authors,
          record.organization,
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase();

        return words.every(
          (word) => hay.includes(word),
        );
      })
      .sort(
        (left, right) =>
          left.title.localeCompare(
            right.title,
          ),
      );

    if (!all.length) {
      empty(
        root,
        isPacks
          ? 'No Topic Packs in this group'
          : 'No Learning Sources in this group',
        isPacks
          ? 'The group exists, but no purpose-built pack currently references it.'
          : 'The group exists, but no learning source currently references it.',
      );
      return;
    }

    if (!rows.length) {
      empty(
        root,
        'No matching results',
        `Nothing in ${group.title} matches the current search and filters.`,
        'Clear search and filters',
        async () => {
          view.query = '';
          view.facet = 'all';

          await view.rememberGroup();
          view.render();
        },
      );
      return;
    }

    const list = root.createDiv({
      cls:
        'los-route-list '
        + 'los-library-route-list',
    });

    for (const record of rows) {
      view.renderRecordRow(
        list,
        record,
        isPacks,
      );
    }
  }
