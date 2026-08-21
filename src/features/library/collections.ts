import type { LibraryView } from '../../views/library-view';
import {
  button,
  empty,
  pageHeader,
  section,
} from '../../components';
import {
  type LibraryRecordView,
  readLibraryRecord,
  readLibraryRecords,
} from './model';

export function renderRecordRow(
  view: LibraryView,

    list: HTMLElement,
    record: LibraryRecordView,
    isPack = false,
  ): void {
    const row = list.createEl(
      'button',
      {
        cls:
          'los-route-row '
          + 'is-clickable',
        attr: {
          type: 'button',
          'aria-label':
            `Open ${record.title}`,
          'data-record-id':
            record.id,
        },
      },
    );

    const copy = row.createDiv({
      cls: 'los-route-row-copy',
    });

    copy.createEl(
      'strong',
      {
        text: record.title,
      },
    );

    const meta = isPack
      ? [
        record.purpose,
        `${record.entries.length} items`,
      ]
        .filter(Boolean)
        .join(' · ')
      : [
        record.sourceType,
        record.year,
        record.organization,
        record.materialExists
          || record.materialPath
          ? 'local'
          : null,
        record.url
          ? 'online'
          : null,
      ]
        .filter(Boolean)
        .join(' · ');

    if (meta) {
      copy.createDiv({
        cls: 'los-route-meta',
        text: meta,
      });
    }

    row.createSpan({
      cls: 'los-route-open',
      text: 'Open →',
    });

    row.addEventListener(
      'click',
      () => {
        view.selectedElementId =
          record.id;

        if (isPack) {
          view.plugin.nav.openTopicPackDetail(
            record.id,
            view.groupId,
            view.query,
          );
          return;
        }

        view.plugin.nav.openSourceDetail(
          record.id,
          view.groupId,
          view.query,
          view.facet,
          { ...view.filters },
        );
      },
    );
  }

export function renderSourcePage(
  view: LibraryView,

    root: HTMLElement,
  ): void {
    const record = readLibraryRecord(
      view.resourceId
        ? view.plugin.store.get(
          view.resourceId,
        )
        : null,
    );

    const back = button(
      root,
      '‹ Learning Sources',
      () => view.plugin.nav.back(),
      'quiet',
    );

    back.addClass('los-route-back');

    if (
      !record
      || record.type !== 'source'
    ) {
      empty(
        root,
        'Learning source unavailable',
        'The projected source could not be found.',
        'Back',
        () => view.plugin.nav.back(),
      );
      return;
    }

    const detail = root.createDiv({
      cls: 'los-detail-page',
    });

    pageHeader(
      detail,
      'Learning Source',
      record.title,
      record.summary,
    );

    view.renderRecordActions(
      detail,
      record,
    );

    view.renderAttachments(
      detail,
      record,
    );

    view.renderSourceDetail(
      detail,
      record,
    );

    view.renderRelated(
      detail,
      record,
    );

    view.renderTechnical(
      detail,
      record,
    );
  }

export function renderTopicPackPage(
  view: LibraryView,

    root: HTMLElement,
  ): void {
    const pack = readLibraryRecord(
      view.topicPackId
        ? view.plugin.store.get(
          view.topicPackId,
        )
        : null,
    );

    const back = button(
      root,
      '‹ Topic Packs',
      () => view.plugin.nav.back(),
      'quiet',
    );

    back.addClass('los-route-back');

    if (
      !pack
      || pack.type !== 'topic-pack'
    ) {
      empty(
        root,
        'Topic Pack unavailable',
        'The projected Topic Pack could not be found.',
        'Back',
        () => view.plugin.nav.back(),
      );
      return;
    }

    const detail = root.createDiv({
      cls:
        'los-detail-page '
        + 'los-topic-pack-detail',
    });

    pageHeader(
      detail,
      'Topic Pack',
      pack.title,
      pack.summary,
    );

    const purpose = section(
      detail,
      'Purpose',
    );

    purpose.createEl(
      'p',
      {
        cls: 'los-pack-purpose',
        text:
          pack.purpose
          || 'No purpose recorded.',
      },
    );

    view.renderOrderedCollection(
      detail,
      pack,
      'Pack contents',
    );

    view.renderRelated(
      detail,
      pack,
    );

    view.renderTechnical(
      detail,
      pack,
    );
  }

export function renderCataloguePage(
  view: LibraryView,

    root: HTMLElement,
  ): void {
    const catalogue = readLibraryRecord(
      view.catalogueId
        ? view.plugin.store.get(
          view.catalogueId,
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

    if (
      !catalogue
      || catalogue.type !== 'collection'
    ) {
      empty(
        root,
        'Source catalogue unavailable',
        'The projected catalogue could not be found.',
        'Back',
        () => view.plugin.nav.back(),
      );
      return;
    }

    const detail = root.createDiv({
      cls:
        'los-detail-page '
        + 'los-catalogue-detail',
    });

    pageHeader(
      detail,
      'Source Catalogue',
      catalogue.title,
      catalogue.summary,
    );

    view.renderOrderedCollection(
      detail,
      catalogue,
      'Catalogue entries',
    );

    view.renderRelated(
      detail,
      catalogue,
    );

    view.renderTechnical(
      detail,
      catalogue,
    );
  }

export function renderOrderedCollection(
  view: LibraryView,

    detail: HTMLElement,
    collection: LibraryRecordView,
    title: string,
  ): void {
    const entries =
      collection.entries;

    const wrap = section(
      detail,
      `${title} (${entries.length})`,
      'The order and grouping shown here come directly from the canonical collection.',
    );

    if (!entries.length) {
      empty(
        wrap,
        'Empty collection',
        'No entries are currently registered.',
      );
      return;
    }

    let previousGroup:
      string | null = null;

    entries.forEach(
      (
        entry,
        index,
      ) => {
        if (
          entry.group
          && entry.group !== previousGroup
        ) {
          wrap.createDiv({
            cls: 'los-list-group',
            text: entry.group,
          });

          previousGroup =
            entry.group;
        }

        const source =
          readLibraryRecord(
            view.plugin.store.get(
              entry.sourceId,
            ),
          );

        const row = wrap.createDiv({
          cls: 'los-pack-entry',
        });

        row.createSpan({
          cls: 'los-pack-order',
          text: String(index + 1),
        });

        const copy = row.createDiv({
          cls: 'los-route-row-copy',
        });

        const open = copy.createEl(
          'button',
          {
            cls:
              'los-shelf-entry-title '
              + 'is-clickable',
            attr: {
              type: 'button',
            },
            text:
              source?.title
              ?? entry.sourceId,
          },
        );

        open.addEventListener(
          'click',
          () => {
            if (!source) {
              return;
            }

            view.plugin.nav.openSourceDetail(
              source.id,
              view.groupId,
            );
          },
        );

        if (entry.why) {
          copy.createDiv({
            cls: 'los-shelf-why',
            text: entry.why,
          });
        }

        const facts = [
          source?.sourceType,
          source?.year,
          source?.materialExists
            || source?.materialPath
            ? 'local'
            : null,
          source?.url
            ? 'online'
            : null,
        ]
          .filter(Boolean)
          .join(' · ');

        if (facts) {
          copy.createDiv({
            cls: 'los-route-meta',
            text: facts,
          });
        }
      },
    );
  }

export function renderLegacyList(
  view: LibraryView,

    root: HTMLElement,
  ): void {
    const back = button(
      root,
      '‹ Library',
      () => view.plugin.nav.back(),
      'quiet',
    );

    back.addClass('los-route-back');

    const title =
      `${view.recordType
        .charAt(0)
        .toUpperCase()}`
      + `${view.recordType.slice(1)} records`;

    pageHeader(
      root,
      'Compatibility view',
      title,
      view.domain
        ? `Domain: ${view.domain}`
        : 'Legacy record families remain reachable until their migration gate closes.',
    );

    const input = root.createEl(
      'input',
      {
        cls:
          'los-search '
          + 'los-route-search',
        attr: {
          type: 'search',
          placeholder:
            `Search ${view.recordType} records…`,
          'aria-label':
            `Search ${view.recordType}`,
        },
      },
    ) as HTMLInputElement;

    input.value = view.query;

    input.addEventListener(
      'input',
      async () => {
        view.query = input.value;

        await view.plugin.router.remember({
          name: 'legacy-library-list',
          recordType: view.recordType,
          query: view.query,
          domain: view.domain,
        });

        view.render();
      },
    );

    let rows = readLibraryRecords(
      view.plugin.store.search(
        view.query,
        [view.recordType],
      ),
    );

    if (view.domain) {
      rows = rows.filter(
        (record) =>
          record.domain === view.domain,
      );
    }

    rows.sort(
      (left, right) =>
        left.title.localeCompare(
          right.title,
        ),
    );

    if (!rows.length) {
      empty(
        root,
        view.query
          ? 'No matching records'
          : 'No records',
        view.query
          ? 'Try a shorter title, alias or ID.'
          : `No ${view.recordType} records are projected.`,
      );
      return;
    }

    const list = root.createDiv({
      cls: 'los-route-list',
    });

    for (const record of rows) {
      const row = list.createEl(
        'button',
        {
          cls:
            'los-route-row '
            + 'is-clickable',
          attr: {
            type: 'button',
            'data-record-id':
              record.id,
          },
        },
      );

      const copy = row.createDiv({
        cls: 'los-route-row-copy',
      });

      copy.createEl(
        'strong',
        {
          text: record.title,
        },
      );

      copy.createDiv({
        cls: 'los-route-meta',
        text: [
          record.role,
          record.domain,
          record.state,
        ]
          .filter(Boolean)
          .join(' · '),
      });

      row.createSpan({
        cls: 'los-route-open',
        text: record.path
          ? 'Open file →'
          : 'Open →',
      });

      row.addEventListener(
        'click',
        () => {
          view.selectedElementId =
            record.id;

          if (record.path) {
            view.plugin.openAuthoredPath(
              record.path,
            );
            return;
          }

          view.plugin.nav.openRecord(
            record.record,
          );
        },
      );
    }
  }
