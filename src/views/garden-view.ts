/** Garden is a review surface for seeds, not a second canonical knowledge
 * browser. The original artifact is always opened as-is; AI-derived state and
 * transcriptions are displayed as separate projected facts. */
export class GardenView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; }
  getViewType() { return VIEW_GARDEN; }
  getDisplayText() { return 'LearningOS · Garden'; }
  getIcon() { return 'sprout'; }
  async onOpen() { this.render(); }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-garden-view');
    if (!this.plugin.store.ready) {
      pageHeader(root, 'Review', 'Garden unavailable');
      empty(root, 'The interface contract could not be loaded', this.plugin.store.error,
        'Rebuild views', () => this.plugin.generate());
      return;
    }
    const header = pageHeader(root, 'Review', 'Garden',
      'Seeds remain human-owned. “Shelve with AI” prepares a bounded request bundle; nothing changes until an approved delivery is applied.');
    const toolbar = header.createDiv({ cls: 'los-actions los-garden-toolbar' });
    button(toolbar, 'Open Garden base', () => this.plugin.openVaultPath('bases/garden.base'), 'quiet');
    button(toolbar, 'Refresh projection', () => this.plugin.generate(), 'quiet');

    const entries = this.plugin.store.gardenEntries();
    if (!entries.length) {
      empty(root, 'No Garden seeds', 'Create a Markdown seed under knowledge/garden/.');
      return;
    }
    const list = root.createDiv({ cls: 'los-garden-list' });
    for (const target of entries) this.card(list, target);
  }

  card(parent, target) {
    const card = parent.createDiv({ cls: `los-card los-garden-card los-garden-${target.state || 'seed'}` });
    const top = card.createDiv({ cls: 'los-card-top' });
    top.createEl('h2', { text: target.title || target.id });
    badge(top, target.state || 'seed', target.state || 'seed');
    card.createDiv({ cls: 'los-micro', text: target.path });
    if (target.tags?.length) {
      const tags = card.createDiv({ cls: 'los-garden-tags' });
      for (const tag of target.tags) badge(tags, `#${tag}`, 'role');
    }

    const latest = this.plugin.store.latestAiRequest(target.id);
    if (latest) {
      const status = card.createDiv({ cls: 'los-ai-request-status' });
      status.createEl('strong', { text: `AI request · ${latest.status}` });
      status.createDiv({ cls: 'los-micro', text: `${latest.provider || 'manual-bundle'} · ${latest.id}` });
      if (latest.bundle_path) status.createDiv({ cls: 'los-micro', text: latest.bundle_path });
      const statusActions = status.createDiv({ cls: 'los-actions' });
      if (latest.bundle_path) button(statusActions, 'Copy bundle path', () => this.plugin.copyText(latest.bundle_path), 'quiet');
      if (latest.delivery_id && latest.status !== 'applied') {
        button(statusActions, 'Apply approved delivery', async () => {
          try {
            await this.plugin.aiActions.applyApprovedDelivery(latest.delivery_id);
            new Notice('Approved AI delivery applied and projection refreshed.');
            this.render();
          } catch (error) { new Notice(error?.message || String(error)); }
        }, 'cta');
      }
      if (latest.receipt_id) badge(status, `receipt ${latest.receipt_id}`, 'complete');
    }

    const actions = card.createDiv({ cls: 'los-garden-actions' });
    button(actions, 'Open original', () => this.plugin.openVaultPath(target.path), 'quiet');
    if (target.transcription_path) {
      button(actions, 'Open AI transcription', () => this.plugin.openVaultPath(target.transcription_path), 'quiet');
    }
    renderGardenShelveAction(actions, this.plugin, target, () => this.render());
    return card;
  }
}
