import {
  ItemView,
  Notice,
  type WorkspaceLeaf,
} from 'obsidian';
import {
  badge,
  button,
  disclosure,
  empty,
  pageHeader,
} from '../components';
import { VIEW_GARDEN } from '../constants';
import {
  renderGardenShelveAction,
} from '../features/ai-actions/action-button';
import type {
  ProjectionRecord,
} from '../contracts/manifest-v4';
import type { LearningOSUI } from '../main';
import { asLabel, asString, errorMessage } from '../projection/readers';

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

type GardenFilter =
  | 'all'
  | 'seed'
  | 'review-due'
  | 'harvest-candidate';

const GARDEN_FILTERS: ReadonlyArray<
  readonly [GardenFilter, string]
> = [
  ['all', 'All'],
  ['seed', 'Growing'],
  ['review-due', 'Review due'],
  ['harvest-candidate', 'Candidates'],
];

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
  private filter: GardenFilter = 'all';

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
      'Garden · Incubation',
      'Garden',
      'Ideas can stay messy here until you know what they want to become.',
    );

    this.renderComposer(root);

    const entries =
      this.plugin.store.gardenEntries();

    const filters = root.createDiv({
      cls: 'los-garden-filters',
      attr: {
        role: 'tablist',
        'aria-label': 'Garden filters',
      },
    });

    for (const [value, label] of GARDEN_FILTERS) {
      const count = value === 'all'
        ? entries.length
        : entries.filter(
          (entry) =>
            String(entry.state || 'seed') === value,
        ).length;

      const control = button(
        filters,
        `${label}${count ? ` ${count}` : ''}`,
        () => {
          this.filter = value;
          this.render();
        },
        'quiet',
      );

      control.addClass('los-filter-tab');
      control.toggleClass(
        'is-active',
        this.filter === value,
      );
      control.setAttrs({
        role: 'tab',
        'aria-selected': String(
          this.filter === value,
        ),
      });
    }

    const listHeader = root.createDiv({
      cls: 'los-garden-list-header',
    });

    listHeader.createEl('h2', {
      text: 'Growing ideas',
    });

    listHeader.createSpan({
      cls: 'los-micro',
      text: 'Review eligibility is projected by Core',
    });

    const visible = this.filter === 'all'
      ? entries
      : entries.filter(
        (entry) =>
          String(entry.state || 'seed') === this.filter,
      );

    if (!visible.length) {
      empty(
        root,
        entries.length
          ? 'Nothing in this view'
          : 'No Garden seeds yet',
        entries.length
          ? 'Choose another Garden filter.'
          : 'Plant one above. A seed needs no module, topic, destination, or AI.',
      );
    } else {
      const list = root.createDiv({
        cls: 'los-garden-list',
      });

      for (const target of visible) {
        this.card(list, target);
      }
    }

    const tools = disclosure(
      root,
      'Garden tools',
      'los-utility-disclosure',
    );

    button(
      tools,
      'Open Garden base',
      () =>
        this.plugin.openVaultPath(
          'bases/garden.base',
        ),
      'quiet',
    );

    button(
      tools,
      'Refresh projection',
      () => this.plugin.generate(),
      'quiet',
    );
  }

  renderComposer(
    root: HTMLElement,
  ): void {
    const composer = root.createDiv({
      cls: 'los-garden-seed-composer',
    });

    composer.createEl('h2', {
      text: 'Plant something…',
    });

    composer.createEl('p', {
      cls: 'los-muted',
      text:
        'A thought, question, fragment, or connection. '
        + 'No filing required. No AI required.',
    });

    const editor = composer.createEl(
      'textarea',
      {
        cls: 'los-garden-seed-editor',
        attr: {
          rows: '2',
          placeholder:
            'What keeps returning to your mind?',
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
      cls:
        'los-actions '
        + 'los-garden-composer-actions',
    });

    const title = actions.createEl(
      'input',
      {
        cls: 'los-garden-seed-title',
        attr: {
          type: 'text',
          placeholder: 'Title optional',
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
    const targetId = asString(target.id);
    const targetState = asString(target.state) || 'seed';
    const targetPath = asString(target.path);
    const card = parent.createDiv({
      cls:
        `los-card los-garden-card `
        + `los-garden-${targetState}`,
    });

    const top = card.createDiv({
      cls: 'los-card-top',
    });

    top.createEl('h2', {
      text: asLabel(target, 'Garden seed'),
    });

    badge(
      top,
      targetState,
      targetState,
    );

    card.createDiv({
      cls: 'los-micro',
      text: targetPath || 'Path unavailable',
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

    const latest = targetId
      ? this.plugin.store.latestAiRequest(targetId)
      : null;

    if (latest) {
      const bundlePath = asString(latest.bundle_path);
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

      if (bundlePath) {
        status.createDiv({
          cls: 'los-micro',
          text: bundlePath,
        });
      }

      const statusActions =
        status.createDiv({
          cls: 'los-actions',
        });

      if (bundlePath) {
        button(
          statusActions,
          'Copy bundle path',
          () =>
            this.plugin.copyText(
              bundlePath,
            ),
          'quiet',
        );
      }

      if (
        latest.delivery_id
        && latest.status !== 'applied'
      ) {
        const deliveryId = latest.delivery_id;
        button(
          statusActions,
          'Apply approved delivery',
          async () => {
            try {
              await this.plugin.aiActions
                .applyApprovedDelivery(
                  deliveryId,
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

    if (targetPath) {
      button(actions, 'Open original', () => this.plugin.openVaultPath(targetPath), 'quiet');
    }

    if (target.transcription_path) {
      const transcriptionPath = target.transcription_path;
      button(
        actions,
        'Open AI transcription',
        () =>
          this.plugin.openVaultPath(
            transcriptionPath,
          ),
        'quiet',
      );
    }

    if (targetId) {
      renderGardenShelveAction(actions, this.plugin, target, () => this.render());
    }

    return card;
  }
}
