import type { LibraryView } from '../../views/library-view';
import {
  badge,
  button,
  chip,
  disclosure,
  empty,
  section,
} from '../../components';
import {
  RELATED_LABELS,
  type LibraryRecordView,
  readLibraryRecords,
  readRelatedRecords,
} from './model';

export function renderRecordActions(
  view: LibraryView,

    detail: HTMLElement,
    record: LibraryRecordView,
  ): void {
    const actions = detail.createDiv({
      cls: 'los-actions',
    });

    if (record.url) {
      const url = record.url;
      button(
        actions,
        'Open online',
        () =>
          view.plugin.openResource({
            url,
          }),
        'info',
      );
    }

    if (record.materialPath) {
      button(
        actions,
        'Open local copy',
        () =>
          view.plugin.openMaterialPath(
            record.materialPath as string,
          ),
        'info',
      );
    }

    if (record.path) {
      button(
        actions,
        'Open authored file',
        () =>
          view.plugin.openAuthoredPath(
            record.path as string,
          ),
        'info',
      );
    }
  }

export function renderAttachments(
  view: LibraryView,

    detail: HTMLElement,
    record: LibraryRecordView,
  ): void {
    if (!record.attachments.length) {
      return;
    }

    const attachments = section(
      detail,
      'Attachments',
      'Open the original handwriting, image, or PDF.',
    );

    for (
      const attachment
      of record.attachments
    ) {
      button(
        attachments,
        `Open ${attachment.label}`,
        () =>
          view.plugin.openAuthoredPath(
            attachment.path,
          ),
        'info',
      );
    }
  }

export function renderRelated(
  view: LibraryView,

    detail: HTMLElement,
    record: LibraryRecordView,
  ): void {
    const related = readRelatedRecords(
      view.plugin.store.related(
        record.id,
      ),
    );

    const groups =
      new Map<
        string,
        LibraryRecordView[]
      >();

    for (const relatedRecord of related) {
      const current =
        groups.get(relatedRecord.type);

      if (current) {
        current.push(relatedRecord);
      } else {
        groups.set(
          relatedRecord.type,
          [relatedRecord],
        );
      }
    }

    if (!groups.size) {
      return;
    }

    const wrap = section(
      detail,
      'Related',
    );

    const orderedGroups = [
      ...groups.entries(),
    ].sort(
      (left, right) =>
        right[1].length
        - left[1].length,
    );

    for (
      const [
        type,
        rows,
      ] of orderedGroups
    ) {
      const group = wrap.createDiv({
        cls: 'los-related-group',
      });

      group.createDiv({
        cls: 'los-group-title',
        text:
          `${RELATED_LABELS[type] ?? type}`
          + ` · ${rows.length}`,
      });

      const shown = group.createDiv({
        cls: 'los-related-chips',
      });

      for (
        const relatedRecord
        of rows.slice(0, 5)
      ) {
        chip(
          shown,
          relatedRecord.record,
          () =>
            view.plugin.nav.openRecord(
              relatedRecord.record,
            ),
        );
      }

      if (rows.length > 5) {
        const rest = disclosure(
          group,
          `View all ${rows.length}`,
        );

        const restChips =
          rest.createDiv({
            cls: 'los-related-chips',
          });

        for (
          const relatedRecord
          of rows.slice(5)
        ) {
          chip(
            restChips,
            relatedRecord.record,
            () =>
              view.plugin.nav.openRecord(
                relatedRecord.record,
              ),
          );
        }
      }
    }
  }

export function renderSourceDetail(
  view: LibraryView,

    detail: HTMLElement,
    record: LibraryRecordView,
  ): void {
    const facts = section(
      detail,
      'Source facts',
    );

    const factRows:
      ReadonlyArray<
        readonly [
          string,
          string,
        ]
      > = [
        [
          'Authors',
          record.authors.join(', '),
        ],
        [
          'Organization',
          record.organization,
        ],
        [
          'Year',
          record.year,
        ],
        [
          'Type',
          record.sourceType,
        ],
      ];

    for (
      const [
        label,
        value,
      ] of factRows
    ) {
      if (!value) {
        continue;
      }

      const row = facts.createDiv({
        cls: 'los-fact-row',
      });

      row.createSpan({
        cls: 'los-fact-label',
        text: label,
      });

      row.createSpan({
        cls: 'los-fact-value',
        text: value,
      });
    }

    const memberships =
      view.shelfIndex().get(
        record.id,
      )
      ?? [];

    const placed = section(
      detail,
      'Collections',
      'Where this source sits and the explicit role it plays there.',
    );

    if (!memberships.length) {
      empty(
        placed,
        'Not in a collection',
        'The source remains globally registered.',
      );
    }

    for (
      const membership
      of memberships
    ) {
      const line = placed.createDiv({
        cls: 'los-shelf-entry',
      });

      const head = line.createEl(
        'button',
        {
          cls:
            'los-shelf-entry-title '
            + 'is-clickable',
          attr: {
            type: 'button',
          },
          text:
            membership.shelf.title,
        },
      );

      head.addEventListener(
        'click',
        () => {
          if (
            membership.shelf.type
            === 'topic-pack'
          ) {
            view.plugin.nav.openTopicPackDetail(
              membership.shelf.id,
            );
            return;
          }

          view.plugin.nav.openCatalogueDetail(
            membership.shelf.id,
          );
        },
      );

      if (membership.group) {
        line.createDiv({
          cls: 'los-micro',
          text: membership.group,
        });
      }

      if (membership.why) {
        line.createDiv({
          cls: 'los-shelf-why',
          text: membership.why,
        });
      }
    }

    const used = section(
      detail,
      'Used in units',
      'Use is module/unit-specific; it is not a global source score.',
    );

    const units = readLibraryRecords(
      view.plugin.store.useUnits(
        record.id,
      ),
    );

    if (!units.length) {
      empty(
        used,
        'Not routed to a unit',
        'The source remains globally registered.',
      );
    }

    for (const unit of units) {
      chip(
        used,
        unit.record,
        () =>
          view.plugin.nav.openUnit(
            unit.id,
          ),
      );
    }

    if (record.evaluations.length) {
      const evidence = section(
        detail,
        'What this source is good for',
      );

      for (
        const evaluation
        of record.evaluations
      ) {
        const card =
          evidence.createDiv({
            cls: 'los-evidence-card',
          });

        /* Purpose first: the roles are the reason to open this source at all.
         * Level sits beside them because "good for first learning" means
         * something different at introductory and at advanced. */
        if (evaluation.roles.length || evaluation.level) {
          const purpose = card.createDiv({ cls: 'los-chip-row' });
          for (const role of evaluation.roles) badge(purpose, role, 'role');
          if (evaluation.level) badge(purpose, evaluation.level, 'level');
        }

        for (const [label, values] of [
          ['Strengths', evaluation.strengths],
          ['Weaknesses', evaluation.weaknesses],
          ['Assumes', evaluation.prerequisites],
          ['Written for', evaluation.audience],
        ] as const) {
          if (!values.length) continue;
          const block = card.createDiv({ cls: 'los-row' });
          block.createEl('strong', { text: `${label}: ` });
          block.createSpan({ text: values.join(' · ') });
        }

        for (
          const selection
          of evaluation.usefulSections
        ) {
          card.createDiv({
            cls: 'los-row',
            text:
              selection.section
              + (
                selection.note
                  ? ` — ${selection.note}`
                  : ''
              ),
          });
        }
      }
    }
  }

export function renderTechnical(
  view: LibraryView,

    detail: HTMLElement,
    record: LibraryRecordView,
  ): void {
    const technical = disclosure(
      detail,
      'Technical details',
      'los-technical-details',
    );

    const idRow = technical.createDiv({
      cls: 'los-fact-row',
    });

    idRow.createSpan({
      cls: 'los-fact-label',
      text: 'Record ID',
    });

    idRow.createSpan({
      cls:
        'los-fact-value '
        + 'los-detail-id',
      text: record.id,
    });

    button(
      technical,
      'Copy ID',
      () =>
        view.plugin.copyText(
          record.id,
        ),
      'quiet',
    );

    if (record.path) {
      const pathRow =
        technical.createDiv({
          cls: 'los-fact-row',
        });

      pathRow.createSpan({
        cls: 'los-fact-label',
        text: 'Path',
      });

      pathRow.createSpan({
        cls: 'los-fact-value',
        text: record.path,
      });
    }
  }
