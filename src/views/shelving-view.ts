export class ShelvingView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; this.unitId = null; this.proposal = null; this.selected = new Set(); }
  getViewType() { return VIEW_SHELVING; }
  getDisplayText() { return 'LearningOS · Shelving'; }
  async setState(state) {
    this.unitId = state?.unitId || this.unitId;
    await this.loadProposal(); this.render();
  }
  getState() { return { unitId: this.unitId }; }
  async onOpen() { this.unitId = this.leaf.state?.unitId || this.unitId; await this.loadProposal(); this.render(); }

  async loadProposal() {
    if (!this.unitId) return;
    const map = this.plugin.store.mapForUnit(this.unitId);
    if (map?.shelving?.state === 'proposed') this.proposal = map.shelving;
  }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-shelving-view');
    const unit = this.plugin.store.get(this.unitId);
    pageHeader(root, 'Approval gate', 'Shelving',
      unit ? `${unit.title}: review durable changes before the gateway applies them.` : 'Choose a unit that is ready to shelve.');
    if (!unit) { this.renderQueue(root); viewFooter(root); return; }
    const map = this.plugin.store.mapForUnit(unit.id);
    const proposal = this.proposal || (map?.shelving?.state === 'proposed' ? map.shelving : null);
    if (!proposal?.items?.length) {
      const wrap = section(root, 'No proposal yet');
      empty(wrap, 'Prepare a deterministic proposal',
        'The gateway derives candidates from this unit. AI may explain them, but cannot apply canonical changes.',
        'Prepare proposal', () => this.prepare());
      button(wrap, 'Ask AI to explain shelving criteria', () => this.plugin.askAiScoped(
        'Explain which stage notes might be durable. Do not write or apply canonical changes.',
        { moduleId: unit.module_id, unitId: unit.id }), 'quiet');
      viewFooter(root); return;
    }
    if (!this.selected.size) {
      for (const item of proposal.items) if (item.selected !== false) this.selected.add(item.id);
    }
    const summary = section(root, 'Proposed changes', proposal.summary || 'Select only changes you want to apply.');
    for (const item of proposal.items) {
      const row = summary.createDiv({ cls: 'los-proposal-row' });
      const toggle = row.createEl('input', { attr: { type: 'checkbox', 'aria-label': `Select ${item.title}` } });
      toggle.checked = this.selected.has(item.id);
      toggle.addEventListener('change', () => {
        if (toggle.checked) this.selected.add(item.id); else this.selected.delete(item.id);
      });
      const copy = row.createDiv();
      copy.createEl('h3', { text: item.title });
      if (item.destination) copy.createDiv({ cls: 'los-detail-id', text: item.destination });
      if (item.rationale) copy.createEl('p', { text: item.rationale });
      if (item.diff) copy.createEl('pre', { cls: 'los-proposal-diff', text: item.diff });
    }
    const guard = root.createDiv({ cls: 'los-validation-preview' });
    guard.createEl('strong', { text: 'Apply is explicit and selected-only.' });
    guard.createEl('p', { text: 'The core validates and regenerates atomically; broad AI writes are never accepted.' });
    const actions = root.createDiv({ cls: 'los-actions' });
    button(actions, 'Approve selected changes', () => this.apply(), 'cta');
    button(actions, 'Ask AI to review proposal', () => this.plugin.askAiScoped(
      `Review these shelving proposal IDs: ${[...this.selected].join(', ')}. Do not apply changes.`,
      { moduleId: unit.module_id, unitId: unit.id }), 'quiet');
    viewFooter(root);
  }

  renderQueue(root) {
    const wrap = section(root, 'Ready to shelve');
    const rows = this.plugin.store.units().filter((row) => row.status === 'ready-to-shelve');
    if (!rows.length) empty(wrap, 'No unit is waiting', 'Keep working from any active unit.');
    for (const unit of rows) unitCard(wrap, this.plugin, unit);
  }

  async prepare() {
    try {
      await this.plugin.gateway.prepareShelving(this.unitId);
      await this.plugin.reloadStore(); await this.loadProposal(); this.render();
    }
    catch (error) { new Notice(error?.message || String(error)); }
  }

  async apply() {
    if (!this.selected.size) { new Notice('Select at least one proposal.'); return; }
    try {
      await this.plugin.gateway.applyShelving(this.unitId, [...this.selected]);
      await this.plugin.reloadStore(); this.proposal = null; this.selected.clear(); this.render();
    } catch (error) { new Notice(error?.message || String(error)); }
  }
}
