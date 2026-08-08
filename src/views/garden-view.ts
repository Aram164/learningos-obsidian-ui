import {
  ItemView,
  Notice,
  type WorkspaceLeaf,
} from 'obsidian';
import {
  badge,
  button,
  empty,
  pageHeader,
} from '../components';
import { VIEW_GARDEN } from '../constants';
import {
  renderGardenShelveAction,
} from '../features/ai-actions/action-button';
import type {
  ProjectionRecord,
} from '../contracts/manifest-v2';
import type { LearningOSUI } from '../main';

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : String(error);
}

type GardenPlugin = Pick<
  LearningOSUI,
  | 'aiActions'
  | 'copyText'
  | 'gateway'
  | 'generate'
  | 'mutate'
  | 'openVaultPath'
  | 'scheduleDraftSave'
  | 'settings'
  | 'store'
>;

/**
 * Garden is a durable holding ground for unfinished ideas.
 *
 * Creating a seed is deliberately mechanical: exact human text crosses the
 * deterministic `garden.seed.create` capability with no classification,
 * routing, maturity judgement, or AI requirement.
 *
 * AI remains a separate, explicit action on an already-existing seed.
 */
export class GardenView extends ItemView {
  private readonly plugin: GardenPlugin;
  private seedTitle = '';
  private seedText = '';
  private planting = false;

  constructor(
    leaf: WorkspaceLeaf,
    plugin: GardenPlugin,
  ) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_GARDEN;
  }

  getDisplayText() {
    return 'LearningOS · Garden';
  }

  getIcon() {
    return 'sprout';
  }

  async onOpen() {
    this.render();
  }

  render(): void {
    const root = this.contentEl;

    root.empty();
    root.addClass(
      'los-root',
      'los-garden-view',
    );

    if (!this.plugin.store.ready) {
      pageHeader(
        root,
        'Garden',
        'Garden unavailable',
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

    pageHeader(
      root,
      '',
      'Garden',
      'Capture an unfinished idea without deciding where it belongs. '
        + 'Classification, routing, and AI are separate later decisions.',
    );

    const toolbar = root.createDiv({
      cls: 'los-actions',
    });

    button(
      toolbar,
      'Open Garden base',
      () =>
        this.plugin.openVaultPath(
          'bases/garden.base',
        ),
      'quiet',
    );

    button(
      toolbar,
      'Refresh projection',
      () => this.plugin.generate(),
      'quiet',
    );

    this.renderComposer(root);

    const entries =
      this.plugin.store.gardenEntries();

    if (!entries.length) {
      empty(
        root,
        'No Garden seeds yet',
        'Add one above. A seed does not need a module, topic, or destination.',
      );

      return;
    }

    const list = root.createDiv({
      cls: 'los-garden-list',
    });

    for (const target of entries) {
      this.card(list, target);
    }
  }

  renderComposer(
    root: HTMLElement,
  ): void {
    const composer = root.createDiv({
      cls: 'los-garden-seed-composer',
    });

    composer.createEl('h2', {
      text: 'Add seed',
    });

    composer.createEl('p', {
      cls: 'los-muted',
      text:
        'Write it as it occurs to you. '
        + 'The text is stored as-is; title is optional.',
    });

    const title = composer.createEl(
      'input',
      {
        cls: 'los-garden-seed-title',
        attr: {
          type: 'text',
          placeholder: 'Optional title',
          'aria-label': 'Optional Garden seed title',
        },
      },
    ) as HTMLInputElement;

    title.value = this.seedTitle;

    title.addEventListener(
      'input',
      () => {
        this.seedTitle = title.value;
      },
    );

    const editor = composer.createEl(
      'textarea',
      {
        cls: 'los-garden-seed-editor',
        attr: {
          rows: '5',
          placeholder:
            'A thought, question, connection, fragment…',
          'aria-label': 'Garden seed text',
        },
      },
    ) as HTMLTextAreaElement;

    editor.value = this.seedText;

    editor.addEventListener(
      'input',
      () => {
        this.seedText = editor.value;
      },
    );

    const actions = composer.createDiv({
      cls: 'los-actions',
    });

    const add = button(
      actions,
      this.planting
        ? 'Adding…'
        : 'Add seed',
      () => {
        void this.plantSeed();
      },
      'cta',
    );

    add.disabled = this.planting;

    composer.createDiv({
      cls: 'los-micro',
      text:
        'No automatic classification · no routing · no AI',
    });
  }

  async plantSeed(): Promise<void> {
    if (this.planting) {
      return;
    }

    const text = this.seedText;
    const title = this.seedTitle.trim();

    if (!text.trim()) {
      new Notice(
        'Write something before adding the seed.',
      );
      return;
    }

    this.planting = true;
    this.render();

    try {
      await this.plugin.mutate(
        () =>
          this.plugin.gateway.createGardenSeed(
            text,
            title,
          ),
      );

      this.seedTitle = '';
      this.seedText = '';

      new Notice('Garden seed added.');
    } catch (error: unknown) {
      new Notice(errorMessage(error));
    } finally {
      this.planting = false;
      this.render();
    }
  }

  card(
    parent: HTMLElement,
    target: ProjectionRecord,
  ): HTMLElement {
    const card = parent.createDiv({
      cls:
        `los-card los-garden-card `
        + `los-garden-${target.state || 'seed'}`,
    });

    const top = card.createDiv({
      cls: 'los-card-top',
    });

    top.createEl('h2', {
      text: target.title || target.id,
    });

    badge(
      top,
      target.state || 'seed',
      target.state || 'seed',
    );

    card.createDiv({
      cls: 'los-micro',
      text: target.path,
    });

    if (target.tags?.length) {
      const tags = card.createDiv({
        cls: 'los-garden-tags',
      });

      for (const tag of target.tags) {
        badge(
          tags,
          `#${tag}`,
          'role',
        );
      }
    }

    const latest =
      this.plugin.store.latestAiRequest(
        target.id,
      );

    if (latest) {
      const status = card.createDiv({
        cls: 'los-ai-request-status',
      });

      status.createEl('strong', {
        text:
          `AI request · ${latest.status}`,
      });

      status.createDiv({
        cls: 'los-micro',
        text:
          `${latest.provider || 'manual-bundle'} · ${latest.id}`,
      });

      if (latest.bundle_path) {
        status.createDiv({
          cls: 'los-micro',
          text: latest.bundle_path,
        });
      }

      const statusActions =
        status.createDiv({
          cls: 'los-actions',
        });

      if (latest.bundle_path) {
        button(
          statusActions,
          'Copy bundle path',
          () =>
            this.plugin.copyText(
              latest.bundle_path,
            ),
          'quiet',
        );
      }

      if (
        latest.delivery_id
        && latest.status !== 'applied'
      ) {
        button(
          statusActions,
          'Apply approved delivery',
          async () => {
            try {
              await this.plugin.aiActions
                .applyApprovedDelivery(
                  latest.delivery_id,
                );

              new Notice(
                'Approved AI delivery applied and projection refreshed.',
              );

              this.render();
            } catch (error: unknown) {
              new Notice(
                errorMessage(error),
              );
            }
          },
          'cta',
        );
      }

      if (latest.receipt_id) {
        badge(
          status,
          `receipt ${latest.receipt_id}`,
          'complete',
        );
      }
    }

    const actions = card.createDiv({
      cls: 'los-garden-actions',
    });

    button(
      actions,
      'Open original',
      () =>
        this.plugin.openVaultPath(
          target.path,
        ),
      'quiet',
    );

    if (target.transcription_path) {
      button(
        actions,
        'Open AI transcription',
        () =>
          this.plugin.openVaultPath(
            target.transcription_path,
          ),
        'quiet',
      );
    }

    renderGardenShelveAction(
      actions,
      this.plugin,
      target,
      () => this.render(),
    );

    return card;
  }
}
