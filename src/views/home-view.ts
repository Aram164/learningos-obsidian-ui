import { renderElsewhere, renderHomeRow, nextWorkspaceDate, moduleNextAction } from '../features/home/elsewhere';
import { renderContinue, renderToday } from '../features/home/focus';
import {
  ItemView,
  type WorkspaceLeaf,
} from 'obsidian';
import {
  button,
  empty,
  icon,
  pageHeader,
  projectedExcerpt,
  section,
} from '../components';
import { VIEW_HOME } from '../constants';
import type {
  ProjectionRecord,
} from '../contracts/manifest-v5';
import type {
  LearningOSUI,
} from '../main';
import {
  asLabel as projectedLabel,
  asRecords as projectedRecords,
  asString as projectedString,
  asStrings as projectedStrings,
  asText as projectedText,
  isRecord,
} from '../projection/readers';

import {
  HomeItem,
  ElsewhereRow,
  HomeResumePointer,
  HomePlugin,
  readResumePointer,
  firstProjectedModuleId,
} from '../features/home/model';

/**
 * Home is the quiet starting point for a real working day.
 *
 * It deliberately avoids a catalogue, progress dashboard, or coordination
 * report. One resumable session is primary; a few time-sensitive items and a
 * few other places to continue remain reachable underneath it.
 */
export class HomeView extends ItemView {
  readonly plugin: HomePlugin;

  constructor(
    leaf: WorkspaceLeaf,
    plugin: HomePlugin,
  ) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_HOME;
  }

  getDisplayText(): string {
    return 'LearningOS · Home';
  }

  getIcon(): string {
    return 'home';
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  greeting(): string {
    const hour = new Date().getHours();

    if (hour < 12) {
      return 'Good morning';
    }

    if (hour < 18) {
      return 'Good afternoon';
    }

    return 'Good evening';
  }

  render(): void {
    const root = this.contentEl;

    root.empty();
    root.addClass(
      'los-root',
      'los-home',
    );

    if (!this.plugin.store.ready) {
      pageHeader(
        root,
        'LearningOS',
        'Projection unavailable',
      );

      empty(
        root,
        'The interface contract could not be loaded',
        this.plugin.store.error,
        'Rebuild views',
        () => this.plugin.generate(),
      );

      return;
    }

    const header = pageHeader(
      root,
      'Home',
      this.greeting(),
      'Resume what matters without rebuilding the context first.',
    );

    header.addClass('los-home-header');

    const actions = header.createDiv({
      cls:
        'los-actions los-home-header-actions',
    });

    const search = button(
      actions,
      'Search modules, units, sources, notes…',
      () => this.plugin.openGlobalSearch(),
      'quiet',
    );

    search.addClass('los-home-search-launcher');
    search.empty();
    icon(search.createSpan(), 'search');
    search.createSpan({
      cls: 'los-home-search-label',
      text: 'Search modules, units, sources, notes…',
    });
    search.createEl('kbd', {
      text: '⌘K',
    });

    search.setAttribute(
      'aria-label',
      'Search LearningOS',
    );

    button(
      actions,
      'Capture',
      () => this.plugin.openCapture(),
      'warm',
    );

    this.renderContinue(root);
    this.renderToday(root);
    this.renderElsewhere(root);
  }

  /** The one filled action on Home. */
    renderContinue(
    root: HTMLElement,
  ): void {
    renderContinue(this, root);
  }

    renderToday(
    root: HTMLElement,
  ): void {
    renderToday(this, root);
  }

    renderElsewhere(
    root: HTMLElement,
  ): void {
    renderElsewhere(this, root);
  }

    renderHomeRow(
    parent: HTMLElement,
    item: HomeItem,
  ): HTMLElement {
    return renderHomeRow(this, parent, item);
  }

    nextWorkspaceDate(
    workspace: ProjectionRecord,
  ): string {
    return nextWorkspaceDate(this, workspace);
  }

    moduleNextAction(
    module: ProjectionRecord,
  ): string {
    return moduleNextAction(this, module);
  }
}
