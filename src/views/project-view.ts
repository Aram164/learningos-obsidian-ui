import { renderFiles, renderDecisions } from '../features/project/files';
import { renderBoundaryBanner, renderStructure } from '../features/project/structure';
import { renderDetail, renderOverview } from '../features/project/detail';
import { renderList } from '../features/project/list';
import {
  ItemView,
  Modal,
  type App,
  type WorkspaceLeaf,
} from 'obsidian';
import {
  badge,
  button,
  chip,
  empty,
  pageHeader,
  projectedExcerpt,
  section,
} from '../components';
import { VIEW_PROJECT } from '../constants';
import type {
  ProjectionRecord,
} from '../contracts/manifest';
import type { LearningOSUI } from '../main';
import {
  asLabel as projectedLabel,
  asListLength as projectedListLength,
  asRecords as projectedRecords,
  asString as projectedString,
  asStrings as projectedStrings,
  asText as projectedText,
  isRecord,
} from '../projection/readers';

import {
  PROJECT_TABS,
  ProjectScreen,
  ProjectTab,
  ProjectViewState,
  ProjectBoundaries,
  ProjectStructure,
  ProjectRelationship,
  ProjectPlugin,
  ProjectLinkPlugin,
  isProjectTab,
  readProjectViewState,
  readProjectBoundaries,
  readProjectStructure,
  readProjectRelationship,
} from '../features/project/model';
import { makeModalAccessible } from '../accessibility/modal';

class ProjectLinkReasonModal extends Modal {
  private readonly plugin: ProjectLinkPlugin;
  private readonly relationship: ProjectRelationship;
  private restoreAccessibility: (() => void) | null = null;

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
      '',
      'los-linked-reason-heading',
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

    const close = button(
      actions,
      'Close',
      () => this.close(),
      'quiet',
    );
    this.restoreAccessibility = makeModalAccessible(root, {
      close: () => this.close(),
      hostClass: 'los-modal--linked-reason',
      labelledBy: 'los-linked-reason-heading',
    });
    close.focus();
  }

  onClose(): void {
    this.plugin.router.clearOverlay();
    this.restoreAccessibility?.();
    this.restoreAccessibility = null;
    this.contentEl.empty();
  }
}

/** Full-page first-class Projects navigation. */
export class ProjectView extends ItemView {
  readonly plugin: ProjectPlugin;

  screen: ProjectScreen = 'list';
  projectId: string | null = null;
  tab: ProjectTab = 'structure';
  query = '';

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
      ?? 'structure';

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
    renderList(this, root);
  }

    renderDetail(
    root: HTMLElement,
  ): void {
    renderDetail(this, root);
  }

    renderOverview(
    root: HTMLElement,
    project: ProjectionRecord,
  ): void {
    renderOverview(this, root, project);
  }

    renderBoundaryBanner(
    root: HTMLElement,
    project: ProjectionRecord,
  ): void {
    renderBoundaryBanner(this, root, project);
  }

    renderStructure(
    root: HTMLElement,
    project: ProjectionRecord,
  ): void {
    renderStructure(this, root, project);
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
        cls: 'los-record-row los-project-link',
      });

      const copy = row.createDiv({
        cls: 'los-record-copy los-project-link-copy',
      });

      copy.createEl('strong', {
        text:
          target
            ? projectedLabel(target)
            : relationship.toId,
      });

      copy.createDiv({
        cls: 'los-record-meta',
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
    renderFiles(this, root, project);
  }

    renderDecisions(
    root: HTMLElement,
    project: ProjectionRecord,
  ): void {
    renderDecisions(this, root, project);
  }
}
