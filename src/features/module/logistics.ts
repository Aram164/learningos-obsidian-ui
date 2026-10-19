import { compareStrings, foldCase } from '../../sorting';
import type { ModuleLogisticsHost } from './ports';
import {
  badge,
  disclosure,
  empty,
  factList,
  section,
} from '../../components';
import {
  type ModuleRecordView,
  type AcademicDeadlineView,
  readAcademicDeadline,
} from './model';

const EXAMINATION_LABELS: Readonly<Record<string, string>> = {
  klausur: 'Written exam',
  muendlich: 'Oral exam',
  portfolio: 'Portfolio',
  project: 'Project assessment',
};

function words(value: string): string {
  const normalized = value
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .trim();

  return normalized
    ? normalized[0]!.toLocaleUpperCase()
      + normalized.slice(1)
    : '';
}

export function semesterLabel(value: string): string {
  const summer = /^sose-(\d{4})$/i.exec(value);
  if (summer) {
    return `Summer semester ${summer[1]}`;
  }

  const winter = /^wise-(\d{4})(?:-(\d{2,4}))?$/i.exec(value);
  if (winter) {
    const end = winter[2]
      ? `/${winter[2].length === 4 ? winter[2].slice(2) : winter[2]}`
      : '';
    return `Winter semester ${winter[1]}${end}`;
  }

  return words(value);
}

export function examinationLabel(value: string): string {
  return EXAMINATION_LABELS[foldCase(value)]
    ?? words(value);
}

export function statusLabel(value: string): string {
  return words(value);
}

export function renderLogistics(
  view: ModuleLogisticsHost,

    root: HTMLElement,
    module: ModuleRecordView,
  ): void {
    const factRows: ReadonlyArray<
      readonly [string, string | null]
    > = [
      ['Status', statusLabel(module.status)],
      ['Institution', module.institution],
      ['Code', module.code],
      ['Semester', semesterLabel(module.semester)],
      ['Credits', module.credits],
      [
        'Examination',
        module.examination.type
          ? examinationLabel(
            module.examination.type,
          )
          : null,
      ],
    ];

    factList(root, factRows);

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
  view: ModuleLogisticsHost,

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
        compareStrings(
          a.startDate,
          b.startDate,
        ),
      );
  }

export function renderAcademicDates(
  view: ModuleLogisticsHost,

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
