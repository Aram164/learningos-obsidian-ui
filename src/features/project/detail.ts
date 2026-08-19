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
import { enableButtonGroupKeyboardNavigation } from '../../accessibility/button-group';

export function renderDetail(
  view: ProjectView,

    root: HTMLElement,
  ): void {
    const project =
      view.projectId
        ? view.plugin.store.get(
          view.projectId,
        )
        : null;

    const projectId =
      project
        ? projectedString(project.id)
        : null;

    if (
      !project
      || projectedString(project.type)
        !== 'project'
      || !projectId
    ) {
      pageHeader(
        root,
        'Projects',
        'Project not found',
      );

      empty(
        root,
        'This project is unavailable',
        'The current projection does not contain this project.',
        'Back to projects',
        () => view.plugin.openProjects(),
      );

      return;
    }

    const title =
      projectedLabel(project);

    const status =
      projectedString(project.status)
      ?? 'planned';

    const projectType =
      projectedString(project.project_type)
      ?? 'project';

    const back = button(
      root,
      '‹ Back',
      () => view.plugin.back(),
      'quiet',
    );

    back.addClass('los-route-back');

    pageHeader(
      root,
      `Projects · ${projectType} · ${status}`,
      title,
      projectedExcerpt(
        project.objective,
        190,
      ),
    );

    const tabs = root.createDiv({
      cls: 'los-project-tabs',
      attr: {
        role: 'group',
        'aria-label': 'Project sections',
      },
    });
    enableButtonGroupKeyboardNavigation(tabs);

    for (
      const [tabId, label]
      of PROJECT_TABS
    ) {
      const tab = button(
        tabs,
        label,
        () =>
          view.plugin.openProject(
            projectId,
            tabId,
          ),
        'tertiary',
      );

      const active =
        view.tab === tabId;

      tab.toggleClass(
        'is-active',
        active,
      );

      tab.setAttrs({
        'aria-pressed':
          String(active),
      });
    }

    const links = root.createDiv({
      cls: 'los-project-chips',
    });

    const linkedIds = [
      ...projectedStrings(project.linked_module_ids),
      ...projectedStrings(project.unit_ids),
    ];

    for (const id of linkedIds) {
      const record = view.plugin.store.get(id);
      if (!record) continue;
      chip(
        links,
        record,
        (target) => view.plugin.openRecord(target),
      );
    }

    const body = root.createDiv({
      cls: 'los-project-body',
    });

    switch (view.tab) {
      case 'structure':
        view.renderStructure(
          body,
          project,
        );
        view.renderDecisions(
          body,
          project,
        );
        view.renderBoundaryBanner(
          body,
          project,
        );
        break;

      case 'linked-materials':
        view.renderLinked(
          body,
          project,
        );
        break;

      case 'files':
        view.renderFiles(
          body,
          project,
        );
        break;

      case 'decisions':
        view.renderDecisions(
          body,
          project,
        );
        break;

      default:
        view.renderOverview(
          body,
          project,
        );
    }
  }

export function renderOverview(
  view: ProjectView,

    root: HTMLElement,
    project: ProjectionRecord,
  ): void {
    const overview = section(
      root,
      'Overview',
    );

    const meta = overview.createDiv({
      cls: 'los-project-meta-grid',
    });

    const boundaries =
      readProjectBoundaries(
        project.boundaries,
      );

    const metadata:
      Array<readonly [string, string]> = [
        [
          'Type',
          projectedString(
            project.project_type,
          )
          ?? 'Project',
        ],
        [
          'Status',
          projectedString(project.status)
          ?? 'planned',
        ],
        [
          'Confidentiality',
          boundaries.confidentiality,
        ],
        [
          'External code access',
          boundaries.externalCodeAccess,
        ],
      ];

    for (const [label, value] of metadata) {
      const row = meta.createDiv({
        cls: 'los-project-meta',
      });

      row.createDiv({
        cls: 'los-kicker',
        text: label,
      });

      row.createEl('strong', {
        text: value,
      });
    }

    if (boundaries.notes) {
      overview.createEl('p', {
        cls: 'los-muted',
        text: boundaries.notes,
      });
    }

    const units = section(
      root,
      'Project units',
      'Existing learning units remain reachable without turning the project into a module.',
    );

    const unitRows =
      projectedStrings(project.unit_ids)
        .map(
          (id: string) =>
            view.plugin.store.get(id),
        )
        .filter(
          (
            row,
          ): row is ProjectionRecord =>
            row !== null,
        );

    if (!unitRows.length) {
      empty(
        units,
        'No units linked',
        'This project can exist without a linear learning map.',
      );
    }

    for (const unit of unitRows) {
      const unitId =
        projectedString(unit.id);

      if (!unitId) {
        continue;
      }

      button(
        units,
        projectedLabel(unit),
        () =>
          view.plugin.openUnit(unitId),
        'row',
      );
    }
  }
