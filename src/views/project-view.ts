import {
  ItemView,
  Modal,
  type App,
  type WorkspaceLeaf,
} from 'obsidian';
import {
  badge,
  button,
  empty,
  pageHeader,
  projectedExcerpt,
  section,
} from '../components';
import { VIEW_PROJECT } from '../constants';
import type {
  JsonRecord,
  ProjectionRecord,
} from '../contracts/manifest-v2';
import type { LearningOSUI } from '../main';

const PROJECT_TABS = [
  ['overview', 'Overview'],
  ['structure', 'Structure'],
  ['linked-materials', 'Linked Materials'],
  ['files', 'Files'],
  ['decisions', 'Decisions'],
] as const;

type ProjectScreen =
  | 'list'
  | 'detail';

type ProjectTab =
  (typeof PROJECT_TABS)[number][0];

interface ProjectViewState {
  readonly screen?: ProjectScreen;
  readonly projectId?: string | null;
  readonly tab?: ProjectTab;
  readonly query?: string;
}

interface ProjectBoundaries {
  readonly confidentiality: string;
  readonly externalCodeAccess: string;
  readonly notes: string | null;
}

interface ProjectStructure {
  readonly kind: string;
  readonly nodes: ProjectionRecord[];
}

interface ProjectRelationship {
  readonly id: string;
  readonly toId: string;
  readonly toType: string;
  readonly relationType: string;
  readonly reason: string;
  readonly contribution: string;
  readonly path: string | null;
}

type ProjectPlugin = Pick<
  LearningOSUI,
  | 'back'
  | 'openAuthoredPath'
  | 'openProject'
  | 'openProjects'
  | 'openRecord'
  | 'openUnit'
  | 'router'
  | 'store'
>;

type ProjectLinkPlugin = Pick<
  ProjectPlugin,
  | 'openAuthoredPath'
  | 'openRecord'
  | 'router'
  | 'store'
>;

function isRecord(
  value: unknown,
): value is JsonRecord {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
  );
}

function projectedString(
  value: unknown,
): string | null {
  return (
    typeof value === 'string'
    && value
  )
    ? value
    : null;
}

function projectedText(
  value: unknown,
): string | null {
  if (
    typeof value !== 'string'
    && typeof value !== 'number'
  ) {
    return null;
  }

  const text = String(value);

  return text
    ? text
    : null;
}

function projectedLabel(
  record: ProjectionRecord,
): string {
  return (
    projectedString(record.title)
    ?? projectedString(record.label)
    ?? projectedString(record.id)
    ?? 'Untitled'
  );
}

function projectedRecords(
  value: unknown,
): ProjectionRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (
      candidate,
    ): candidate is ProjectionRecord =>
      isRecord(candidate),
  );
}

function projectedStrings(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (
      candidate,
    ): candidate is string =>
      typeof candidate === 'string',
  );
}

function projectedListLength(
  value: unknown,
): number {
  return Array.isArray(value)
    ? value.length
    : 0;
}

function isProjectTab(
  value: unknown,
): value is ProjectTab {
  return PROJECT_TABS.some(
    ([tab]) => tab === value,
  );
}

function readProjectViewState(
  value: unknown,
): ProjectViewState {
  if (!isRecord(value)) {
    return {};
  }

  const screen: ProjectScreen | undefined =
    value.screen === 'detail'
      ? 'detail'
      : value.screen === 'list'
        ? 'list'
        : undefined;

  const projectId =
    value.projectId === null
      ? null
      : projectedString(value.projectId)
        ?? undefined;

  const tab = isProjectTab(value.tab)
    ? value.tab
    : undefined;

  const query =
    typeof value.query === 'string'
      ? value.query
      : undefined;

  return {
    screen,
    projectId,
    tab,
    query,
  };
}

function readProjectBoundaries(
  value: unknown,
): ProjectBoundaries {
  const boundaries = isRecord(value)
    ? value
    : {};

  return {
    confidentiality:
      projectedString(
        boundaries.confidentiality,
      )
      ?? 'unspecified',
    externalCodeAccess:
      projectedString(
        boundaries.external_code_access,
      )
      ?? 'unspecified',
    notes:
      projectedString(boundaries.notes),
  };
}

function readProjectStructure(
  value: unknown,
): ProjectStructure {
  const structure = isRecord(value)
    ? value
    : {};

  return {
    kind:
      projectedString(structure.kind)
      ?? 'none',
    nodes:
      projectedRecords(structure.nodes),
  };
}

function readProjectRelationship(
  value: ProjectionRecord,
): ProjectRelationship | null {
  const id = projectedString(value.id);
  const toId = projectedString(value.to_id);

  if (!id || !toId) {
    return null;
  }

  return {
    id,
    toId,
    toType:
      projectedString(value.to_type)
      ?? 'record',
    relationType:
      projectedString(value.relation_type)
      ?? 'linked',
    reason:
      projectedString(value.reason)
      ?? 'No rationale was projected.',
    contribution:
      projectedString(value.contribution)
      ?? 'No contribution was projected.',
    path:
      projectedString(value.path),
  };
}

class ProjectLinkReasonModal extends Modal {
  private readonly plugin: ProjectLinkPlugin;
  private readonly relationship: ProjectRelationship;

  constructor(
    app: App,
    plugin: ProjectLinkPlugin,
    relationship: ProjectRelationship,
  ) {
    super(app);

    this.plugin = plugin;
    this.relationship = relationship;
  }

  onOpen(): void {
    const root = this.contentEl;

    root.empty();
    root.addClass(
      'los-root',
      'los-linked-reason-modal',
    );

    this.plugin.router.openOverlay({
      kind: 'linked-material-reason',
      relationshipId:
        this.relationship.id,
    });

    pageHeader(
      root,
      'Linked material',
      'Why this is linked',
    );

    const target =
      this.plugin.store.get(
        this.relationship.toId,
      );

    const relation = section(
      root,
      'Relationship',
    );

    relation.createEl('p', {
      text:
        `${this.relationship.toType} · ${
          this.relationship.relationType
        }`,
    });

    const rationale = section(
      root,
      'Rationale',
    );

    rationale.createEl('p', {
      text: this.relationship.reason,
    });

    const contribution = section(
      root,
      'Contribution',
    );

    contribution.createEl('p', {
      text: this.relationship.contribution,
    });

    const actions = root.createDiv({
      cls: 'los-actions',
    });

    if (target) {
      button(
        actions,
        'Open target',
        () => {
          this.close();
          return this.plugin.openRecord(target);
        },
        'tertiary',
      );
    } else if (this.relationship.path) {
      const path = this.relationship.path;

      button(
        actions,
        'Open target',
        () => {
          this.close();

          return this.plugin.openAuthoredPath(
            path,
          );
        },
        'tertiary',
      );
    }

    button(
      actions,
      'Close',
      () => this.close(),
      'quiet',
    );
  }

  onClose(): void {
    this.plugin.router.clearOverlay();
    this.contentEl.empty();
  }
}

/** Full-page first-class Projects navigation. */
export class ProjectView extends ItemView {
  private readonly plugin: ProjectPlugin;

  private screen: ProjectScreen = 'list';
  private projectId: string | null = null;
  private tab: ProjectTab = 'overview';
  private query = '';

  selectedElementId: string | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    plugin: ProjectPlugin,
  ) {
    super(leaf);

    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_PROJECT;
  }

  getDisplayText(): string {
    return 'LearningOS · Projects';
  }

  async setState(
    state: ProjectViewState = {},
  ): Promise<void> {
    const projectId =
      typeof state.projectId === 'string'
        ? state.projectId
        : null;

    this.screen =
      state.screen
      ?? (
        projectId
          ? 'detail'
          : 'list'
      );

    this.projectId = projectId;

    this.tab =
      state.tab
      ?? 'overview';

    this.query =
      state.query
      ?? '';

    this.render();
  }

  getState(): ProjectViewState {
    return {
      screen: this.screen,
      projectId: this.projectId,
      tab: this.tab,
      query: this.query,
    };
  }

  async onOpen(): Promise<void> {
    await this.setState(
      readProjectViewState(
        this.leaf.state,
      ),
    );
  }

  render(): void {
    const root = this.contentEl;

    root.empty();
    root.addClass(
      'los-root',
      'los-project-view',
    );

    if (!this.plugin.store.ready) {
      empty(
        root,
        'Projects unavailable',
        this.plugin.store.error,
      );
      return;
    }

    if (this.screen === 'detail') {
      this.renderDetail(root);
      return;
    }

    this.renderList(root);
  }

  renderList(
    root: HTMLElement,
  ): void {
    pageHeader(
      root,
      'Projects',
      'Projects',
      'Long-running work with its own structure, materials, files, and decisions.',
    );

    const input = root.createEl(
      'input',
      {
        cls:
          'los-search los-project-search',
        attr: {
          type: 'search',
          placeholder: 'Search projects',
          'aria-label': 'Search projects',
        },
      },
    );

    input.value = this.query;

    const results = root.createDiv({
      cls: 'los-project-list',
    });

    const draw = (): void => {
      results.empty();

      const words = input.value
        .toLocaleLowerCase()
        .split(/\s+/)
        .filter(Boolean);

      const rows =
        this.plugin.store.projects().filter(
          (project: ProjectionRecord) => {
            const id =
              projectedString(project.id);

            if (!id) {
              return false;
            }

            const hay = [
              id,
              projectedString(project.title),
              projectedString(project.objective),
              projectedString(
                project.project_type,
              ),
            ]
              .filter(
                (
                  value,
                ): value is string =>
                  Boolean(value),
              )
              .join(' ')
              .toLocaleLowerCase();

            return words.every(
              (word: string) =>
                hay.includes(word),
            );
          },
        );

      if (!rows.length) {
        empty(
          results,
          'No projects found',
          'No first-class project matches this query.',
          'Clear search',
          () => {
            input.value = '';

            input.dispatchEvent(
              new Event('input'),
            );
          },
        );

        return;
      }

      for (const project of rows) {
        const projectId =
          projectedString(project.id);

        if (!projectId) {
          continue;
        }

        const title =
          projectedLabel(project);

        const status =
          projectedString(project.status)
          ?? 'planned';

        const projectType =
          projectedString(
            project.project_type,
          )
          ?? 'project';

        const row = results.createEl(
          'button',
          {
            cls:
              'los-card los-project-row is-clickable',
            attr: {
              type: 'button',
              'aria-label':
                `Open project: ${title}`,
            },
          },
        );

        row.setAttr(
          'data-record-id',
          projectId,
        );

        const top = row.createDiv({
          cls: 'los-card-top',
        });

        top.createEl('h2', {
          text: title,
        });

        badge(
          top,
          status,
          status,
        );

        row.createEl('p', {
          text: projectedExcerpt(
            project.objective,
            280,
          ),
        });

        row.createDiv({
          cls: 'los-micro',
          text:
            `${projectType} · ${
              projectedListLength(
                project.linked_module_ids,
              )
            } linked modules`,
        });

        row.addEventListener(
          'click',
          () => {
            this.selectedElementId =
              projectId;

            void this.plugin.openProject(
              projectId,
              'overview',
            );
          },
        );
      }
    };

    input.addEventListener(
      'input',
      () => {
        this.query = input.value;

        this.plugin.router.remember({
          name: 'project-list',
          query: this.query,
        });

        draw();
      },
    );

    draw();
  }

  renderDetail(
    root: HTMLElement,
  ): void {
    const project =
      this.projectId
        ? this.plugin.store.get(
          this.projectId,
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
        () => this.plugin.openProjects(),
      );

      return;
    }

    const title =
      projectedLabel(project);

    const status =
      projectedString(project.status)
      ?? 'planned';

    const head = pageHeader(
      root,
      'Project',
      title,
      projectedString(project.objective)
        ?? '',
    );

    const headActions = head.createDiv({
      cls: 'los-actions',
    });

    button(
      headActions,
      'Back',
      () => this.plugin.back(),
      'quiet',
    );

    badge(
      headActions,
      status,
      status,
    );

    const tabs = root.createDiv({
      cls: 'los-project-tabs',
      attr: {
        role: 'tablist',
        'aria-label': 'Project sections',
      },
    });

    for (
      const [tabId, label]
      of PROJECT_TABS
    ) {
      const tab = button(
        tabs,
        label,
        () =>
          this.plugin.openProject(
            projectId,
            tabId,
          ),
        'tertiary',
      );

      const active =
        this.tab === tabId;

      tab.toggleClass(
        'is-active',
        active,
      );

      tab.setAttrs({
        role: 'tab',
        'aria-selected':
          String(active),
      });
    }

    const body = root.createDiv({
      cls: 'los-project-body',
    });

    switch (this.tab) {
      case 'structure':
        this.renderStructure(
          body,
          project,
        );
        break;

      case 'linked-materials':
        this.renderLinked(
          body,
          project,
        );
        break;

      case 'files':
        this.renderFiles(
          body,
          project,
        );
        break;

      case 'decisions':
        this.renderDecisions(
          body,
          project,
        );
        break;

      default:
        this.renderOverview(
          body,
          project,
        );
    }
  }

  renderOverview(
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
            this.plugin.store.get(id),
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
          this.plugin.openUnit(unitId),
        'row',
      );
    }
  }

  renderStructure(
    root: HTMLElement,
    project: ProjectionRecord,
  ): void {
    const structure =
      readProjectStructure(
        project.structure,
      );

    const wrap = section(
      root,
      'Structure',
      `Structure mode: ${structure.kind}.`,
    );

    if (!structure.nodes.length) {
      empty(
        wrap,
        'No fixed structure',
        'This project currently has no linear or nested step map.',
      );

      return;
    }

    const tree = wrap.createDiv({
      cls: 'los-project-structure',
    });

    const renderNode = (
      parent: HTMLElement,
      row: ProjectionRecord,
      depth = 0,
    ): void => {
      const item = parent.createDiv({
        cls:
          `los-project-node los-project-node-depth-${
            Math.min(depth, 4)
          }`,
      });

      const top = item.createDiv({
        cls: 'los-card-top',
      });

      top.createEl('h3', {
        text: projectedLabel(row),
      });

      const status =
        projectedString(row.status);

      if (status) {
        badge(
          top,
          status,
          status,
        );
      }

      item.createDiv({
        cls: 'los-micro',
        text:
          projectedString(row.kind)
          ?? 'step',
      });

      const summary =
        projectedString(row.summary);

      if (summary) {
        item.createEl('p', {
          text: summary,
        });
      }

      const children =
        projectedRecords(row.children);

      if (children.length) {
        const nested = item.createDiv({
          cls:
            'los-project-node-children',
        });

        for (const child of children) {
          renderNode(
            nested,
            child,
            depth + 1,
          );
        }
      }
    };

    for (const row of structure.nodes) {
      renderNode(
        tree,
        row,
      );
    }
  }

  renderLinked(
    root: HTMLElement,
    project: ProjectionRecord,
  ): void {
    const wrap = section(
      root,
      'Linked Materials',
      'Links retain a core-authored reason rather than implying ownership.',
    );

    const projectId =
      projectedString(project.id);

    const relationships = projectId
      ? this.plugin.store
        .projectRelationships(projectId)
        .map(readProjectRelationship)
        .filter(
          (
            relationship,
          ): relationship is ProjectRelationship =>
            relationship !== null,
        )
      : [];

    if (!relationships.length) {
      empty(
        wrap,
        'No linked materials',
        'Links appear here when the project relationship projection contains them.',
      );

      return;
    }

    for (
      const relationship
      of relationships
    ) {
      const target =
        this.plugin.store.get(
          relationship.toId,
        );

      const row = wrap.createDiv({
        cls:
          'los-card los-project-link',
      });

      const copy = row.createDiv({
        cls: 'los-project-link-copy',
      });

      copy.createEl('h3', {
        text:
          target
            ? projectedLabel(target)
            : relationship.toId,
      });

      copy.createDiv({
        cls: 'los-micro',
        text:
          `${relationship.toType} · ${
            relationship.relationType
          }`,
      });

      const actions = row.createDiv({
        cls: 'los-actions',
      });

      if (target) {
        button(
          actions,
          'Open',
          () =>
            this.plugin.openRecord(target),
          'tertiary',
        );
      }

      button(
        actions,
        'Why linked',
        () => {
          const modal =
            new ProjectLinkReasonModal(
              this.app,
              this.plugin,
              relationship,
            );

          modal.open();
        },
        'quiet',
      );
    }
  }

  renderFiles(
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
        cls:
          'los-card los-project-file',
      });

      const copy = row.createDiv({
        cls: 'los-project-link-copy',
      });

      copy.createEl('h3', {
        text: label,
      });

      copy.createDiv({
        cls: 'los-micro',
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
            this.plugin.openAuthoredPath(
              path,
            ),
          'tertiary',
        );
      }
    }
  }

  renderDecisions(
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
        cls:
          'los-card los-project-decision',
      });

      const top = row.createDiv({
        cls: 'los-card-top',
      });

      top.createEl('h3', {
        text: projectedLabel(decision),
      });

      badge(
        top,
        status,
        status,
      );

      row.createEl('p', {
        text:
          projectedText(decision.summary)
          ?? '',
      });
    }
  }
}
