import type { ModuleView } from '../../views/module-view';
import {
  badge,
  button,
  chip,
  disclosure,
  empty,
  pageHeader,
  section,
  workspaceCard,
} from '../../components';
import { STATUS_ORDER } from '../../constants';
import type { ProjectionRecord } from '../../contracts/manifest-v4';
import {
  asCount as projectedCount,
  asRecords as projectedRecords,
  asString as projectedString,
  asStrings as projectedStrings,
  asText as projectedText,
  isRecord,
} from '../../projection/readers';
import {
  MODULE_TABS,
  type ModuleTab,
  type ThematicGroupView,
  type ModuleRecordView,
  type UnitRecordView,
  type ModuleProgressView,
  type AcademicDeadlineView,
  type SourceEntryView,
  nonNull,
  readThematicGroup,
  readModuleRecord,
  normalizeUnitRecord,
  normalizeWorkspaceRecord,
  readProgress,
  readAcademicDeadline,
  readSourceEntries,
} from './model';

export function renderLogistics(
  view: ModuleView,

    root: HTMLElement,
    module: ModuleRecordView,
  ): void {
    const facts = root.createDiv({
      cls: 'los-fact-list',
    });

    const factRows: ReadonlyArray<
      readonly [string, string | null]
    > = [
      ['Status', module.status],
      ['Institution', module.institution],
      ['Code', module.code],
      ['Semester', module.semester],
      ['Credits', module.credits],
      [
        'Examination',
        module.examination.type,
      ],
    ];

    for (const [label, value] of factRows) {
      if (
        value === null
        || value === ''
      ) {
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

    if (module.examination.notes) {
      root.createEl('p', {
        cls: 'los-muted',
        text:
          module.examination.notes,
      });
    }

    view.renderAcademicDates(
      root,
      module,
    );
  }

export function deadlinesFor(
  view: ModuleView,

    module: ModuleRecordView,
  ): AcademicDeadlineView[] {
    return view.plugin.store
      .rows('academic_deadlines')
      .map((record) =>
        readAcademicDeadline(record),
      )
      .filter((row) =>
        row.directModuleId === module.id
        || row.modules.some(
          (entry) =>
            entry.moduleId
            === module.id,
        ),
      )
      .sort((a, b) =>
        a.startDate.localeCompare(
          b.startDate,
        ),
      );
  }

export function renderAcademicDates(
  view: ModuleView,

    root: HTMLElement,
    module: ModuleRecordView,
  ): void {
    const rows =
      view.deadlinesFor(module);

    if (!rows.length) {
      return;
    }

    const wrap = section(
      root,
      'Academic dates',
      'Registration windows and exam sittings for this module.',
    );

    const today =
      new Date()
        .toISOString()
        .slice(0, 10);

    const ahead = rows.filter(
      (row) =>
        (
          row.endDate
          || row.startDate
        ) >= today,
    );

    const past = rows.filter(
      (row) =>
        (
          row.endDate
          || row.startDate
        ) < today,
    );

    if (ahead.length) {
      view.renderDeadlineRows(
        wrap,
        module,
        ahead,
      );
    } else {
      empty(
        wrap,
        'No upcoming date recorded',
        'Past dates remain available below.',
      );
    }

    if (past.length) {
      const history = disclosure(
        wrap,
        `Past dates (${past.length})`,
        'los-deadline-history',
      );

      view.renderDeadlineRows(
        history,
        module,
        past,
      );
    }
  }

export function renderDeadlineRows(
  view: ModuleView,

    wrap: HTMLElement,
    module: ModuleRecordView,
    rows: readonly AcademicDeadlineView[],
  ): void {
    const list = wrap.createDiv({
      cls: 'los-date-list',
    });

    for (const row of rows) {
      const card = list.createDiv({
        cls:
          `los-date-row los-deadline-${
            row.kind
          }`,
      });

      const date =
        row.endDate
        && row.endDate !== row.startDate
          ? `${
            row.startDate
          } → ${
            row.endDate
          }`
          : row.startDate;

      card.createDiv({
        cls: 'los-date-when',
        text: date,
      });

      const copy = card.createDiv({
        cls: 'los-date-copy',
      });

      copy.createEl('strong', {
        text: row.label,
      });

      if (
        row.kind
        === 'registration-window'
      ) {
        const entry = row.modules.find(
          (item) =>
            item.moduleId === module.id,
        );

        if (entry?.action) {
          copy.createEl('p', {
            cls: 'los-micro',
            text: entry.action,
          });
        }
      } else {
        copy.createDiv({
          cls: 'los-micro',
          text:
            row.title
            || module.title,
        });

        const facts = copy.createDiv({
          cls: 'los-row',
        });

        badge(
          facts,
          row.registrationState,
          row.registrationState
          || 'needs-map',
        );

        if (row.time) {
          facts.createSpan({
            cls: 'los-micro',
            text: row.time,
          });
        }
      }
    }
  }
