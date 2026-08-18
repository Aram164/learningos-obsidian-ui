import {
  Modal,
  Notice,
  PluginSettingTab,
  Setting,
  type App,
  type ButtonComponent,
  type Plugin,
  type TextComponent,
  type ToggleComponent,
} from 'obsidian';
import { button, empty, OWNERSHIP_STATEMENT, pageHeader, section } from './components';
import { asSessionReview } from './contracts/gateway-v1';
import type { SessionReviewV1 } from './contracts/gateway-v1';
import type { LearningOSUI } from './main';
import { makeModalAccessible } from './accessibility/modal';

type ToggleSettingKey =
  | 'openHomeOnStartup'
  | 'pinHome'
  | 'collapseSidebars'
  | 'showAiRecommendation';

type SettingsPlugin =
  Plugin
  & Pick<
    LearningOSUI,
    | 'generate'
    | 'openDiagnostics'
    | 'settings'
  >;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type SessionEndPlugin = Pick<
  LearningOSUI,
  'gateway'
>;

type SessionReview = SessionReviewV1;

export class LearningOSSettingsTab extends PluginSettingTab {
  declare readonly plugin: SettingsPlugin;

  constructor(
    app: App,
    plugin: SettingsPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const root = this.containerEl; root.empty();
    root.createEl('h2', { text: 'LearningOS UI' });
    const toggles:
      ReadonlyArray<
        readonly [
          ToggleSettingKey,
          string,
          string,
        ]
      > = [
      ['openHomeOnStartup', 'Open Home on startup', 'Open the module-first Home view when the vault becomes ready.'],
      ['pinHome', 'Pin Home', 'Keep the Home leaf available while opening units.'],
      ['collapseSidebars', 'Collapse the right sidebar', 'Keep the learning workspace visually focused.'],
      ['showAiRecommendation', 'Show scoped AI action', 'Display AI buttons that always include explicit curriculum context.'],
    ];
    for (const [key, name, description] of toggles) {
      new Setting(root).setName(name).setDesc(description).addToggle(
        (toggle: ToggleComponent) => toggle
        .setValue(this.plugin.settings[key]).onChange(
          async (value: boolean) => {
          this.plugin.settings[key] = value;
          await this.plugin.saveData(this.plugin.settings);
        }),
      );
    }
    new Setting(root).setName('Python interpreter')
      .setDesc('Leave blank to auto-detect: the project virtual environment, then the system Python.')
      .addText((text: TextComponent) => text
        .setValue(this.plugin.settings.pythonPath || '')
        .onChange(async (value: string) => {
          this.plugin.settings.pythonPath = value.trim();
          await this.plugin.saveData(this.plugin.settings);
        }));
    new Setting(root).setName('Validate and rebuild').setDesc('Run the canonical core projection pipeline.')
      .addButton(
        (control: ButtonComponent) => control
          .setButtonText('Rebuild')
          .setCta()
          .onClick(() => this.plugin.generate()),
      );
    new Setting(root).setName('Diagnostics').setDesc('Contract versions, projection freshness, interpreter.')
      .addButton(
        (control: ButtonComponent) => control
          .setButtonText('Open')
          .onClick(() => this.plugin.openDiagnostics()),
      );

    // Stated once, here — not repeated under every screen (DESIGN.md).
    root.createEl('h3', { text: 'About LearningOS' });
    root.createEl('p', { cls: 'los-muted', text: OWNERSHIP_STATEMENT });
  }
}

export class SessionEndModal extends Modal {
  private readonly plugin: SessionEndPlugin;
  private readonly review: SessionReview;
  private restoreAccessibility: (() => void) | null = null;

  constructor(
    app: App,
    plugin: SessionEndPlugin,
    review: SessionReview,
  ) {
    super(app);
    this.plugin = plugin;
    this.review = review;
  }
  onOpen(): void {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-session-modal');
    pageHeader(root, 'Explicit Git closure', 'End learning session',
      'Only files recorded by guarded learning actions can be staged. Unrelated changes remain untouched.',
      'los-session-end-heading');
    this.restoreAccessibility = makeModalAccessible(root, {
      close: () => this.close(),
      hostClass: 'los-modal--session-end',
      labelledBy: 'los-session-end-heading',
    });
    const owned = section(root, 'Session-owned changes');
    if (!(this.review.owned_changes || []).length) empty(owned, 'No owned changes', 'There is nothing to commit from this session.');
    for (const file of this.review.owned_changes || []) owned.createEl('code', { text: file });
    const unrelated = section(root, 'Unrelated changes (excluded)');
    if (!(this.review.unrelated_changes || []).length) unrelated.createEl('p', { text: 'None.' });
    for (const file of this.review.unrelated_changes || []) unrelated.createEl('code', { text: file });
    const message = root.createEl('input', {
      cls: 'los-search', attr: { type: 'text', placeholder: 'Commit message', 'aria-label': 'Learning session commit message' },
    });
    const pushRow = root.createDiv({ cls: 'los-row' });
    const push = pushRow.createEl('input', { attr: { type: 'checkbox', 'aria-label': 'Push after commit' } });
    pushRow.createSpan({ text: 'Push after the scoped commit succeeds' });
    const actions = root.createDiv({ cls: 'los-actions' });
    button(actions, 'Commit session-owned files', async () => {
      if (!message.value.trim()) { new Notice('Enter a commit message first.'); return; }
      try {
        const result = asSessionReview(
          await this.plugin.gateway.endSession(message.value.trim(), Boolean(push.checked)),
        );
        new Notice(result.pushed ? 'Learning session committed and pushed.' : 'Learning session committed.');
        this.close();
      } catch (error: unknown) {
        new Notice(errorMessage(error));
      }
    }, 'cta');
    button(actions, 'Close without committing', () => this.close(), 'quiet');
    message.focus();
  }
  onClose(): void {
    this.restoreAccessibility?.();
    this.restoreAccessibility = null;
    this.contentEl.empty();
  }
}
