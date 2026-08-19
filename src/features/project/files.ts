import type { ProjectView } from '../../views/project-view';
import {
  badge,
  button,
  chip,
  empty,
  pageHeader,
  projectedExcerpt,
  section,
} from '../../components';
import type { ProjectionRecord } from '../../contracts/manifest';
import {
  asLabel as projectedLabel,
  asListLength as projectedListLength,
  asRecords as projectedRecords,
  asString as projectedString,
  asStrings as projectedStrings,
  asText as projectedText,
  isRecord,
} from '../../projection/readers';
import {
  PROJECT_TABS,
  type ProjectTab,
  type ProjectBoundaries,
  type ProjectStructure,
  type ProjectRelationship,
  readProjectBoundaries,
  readProjectStructure,
  readProjectRelationship,
} from './model';

export function renderFiles(
  view: ProjectView,

    root: HTMLElement,
    project: ProjectionRecord,
  ): void {
    const wrap = section(
      root,
      'Files',
      'Project-owned references; canonical content remains in plain files.',
    );

    const files =
      projectedRecords(project.files);

    if (!files.length) {
      empty(
        wrap,
        'No files linked',
        'Project files can be added through a declared core capability.',
      );

      return;
    }

    for (const file of files) {
      const path =
        projectedString(file.path);

      const label =
        projectedString(file.label)
        ?? path
        ?? projectedString(file.id)
        ?? 'Untitled file';

      const kind =
        projectedString(file.kind)
        ?? 'file';

      const row = wrap.createDiv({
        cls: 'los-record-row los-project-file',
      });

      const copy = row.createDiv({
        cls: 'los-record-copy los-project-link-copy',
      });

      copy.createEl('strong', {
        text: label,
      });

      copy.createDiv({
        cls: 'los-record-meta',
        text:
          path
            ? `${kind} · ${path}`
            : kind,
      });

      if (path) {
        button(
          row,
          'Open',
          () =>
            view.plugin.openAuthoredPath(
              path,
            ),
          'tertiary',
        );
      }
    }
  }

export function renderDecisions(
  view: ProjectView,

    root: HTMLElement,
    project: ProjectionRecord,
  ): void {
    const wrap = section(
      root,
      'Decisions',
      'Open questions and durable decisions, without manufacturing a completion score.',
    );

    const decisions =
      projectedRecords(project.decisions);

    if (!decisions.length) {
      empty(
        wrap,
        'No decisions recorded',
        'Decisions appear here when the project records them.',
      );

      return;
    }

    for (const decision of decisions) {
      const status =
        projectedString(decision.status)
        ?? 'open';

      const row = wrap.createDiv({
        cls: 'los-record-row los-project-decision',
      });

      const copy = row.createDiv({
        cls: 'los-record-copy',
      });

      copy.createEl('strong', {
        text: projectedLabel(decision),
      });

      copy.createDiv({
        cls: 'los-record-summary',
        text:
          projectedText(decision.summary)
          ?? '',
      });

      badge(
        row,
        status,
        status,
      );
    }
  }
