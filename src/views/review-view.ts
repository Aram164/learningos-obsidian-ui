/**
 * Review — the decision queues in one place. Shelving proposals, units without
 * a map, inbox items awaiting routing and the Garden's harvest pressure are all
 * the same question ("what needs a decision from me?"), so they stop occupying
 * four separate permanent destinations.
 */
export class ReviewView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; }
  getViewType() { return VIEW_REVIEW; }
  getDisplayText() { return 'LearningOS · Review'; }
  getIcon() { return 'check-check'; }
  async onOpen() { this.render(); }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-review-view');
    if (!this.plugin.store.ready) {
      pageHeader(root, 'LearningOS', 'Projection unavailable');
      empty(root, 'The interface contract could not be loaded', this.plugin.store.error,
        'Rebuild views', () => this.plugin.generate());
      return;
    }
    pageHeader(root, '', 'Review', 'Everything waiting on a decision from you.');
    const shelving = this.plugin.store.units().filter((row) => row.status === 'ready-to-shelve');
    const needsMap = this.plugin.store.units().filter((row) => !this.plugin.store.mapForUnit(row.id));
    const inbox = this.plugin.store.data.counts?.inbox_items || 0;
    const garden = this.plugin.store.gardenEntries();

    const list = root.createDiv({ cls: 'los-review-list' });
    this.queue(list, 'Ready to shelve', shelving.length,
      'Units whose working notes are ready to become durable knowledge.',
      shelving.length ? ['Review proposals', () => this.plugin.openShelving(shelving[0].id)] : null);
    this.queue(list, 'Inbox', inbox,
      'Captured items the operator has not routed yet.',
      ['Open capture', () => this.plugin.openCapture()]);
    this.queue(list, 'Needs a study map', needsMap.length,
      'Units with no current study script.',
      needsMap.length ? ['Open the queue', () => this.plugin.openProgram('queue-needs-map')] : null);
    this.queue(list, 'Garden', garden.length,
      'Half-formed ideas gestating outside the canon; approved AI actions may help prepare them for shelving.',
      ['Open the Garden', () => this.plugin.openGarden()]);

    if (needsMap.length) {
      const detail = disclosure(root, `Units needing a map (${needsMap.length})`);
      const grid = detail.createDiv({ cls: 'los-card-grid' });
      for (const unit of needsMap) unitCard(grid, this.plugin, unit);
    }
  }

  queue(parent, label, count, detail, action) {
    const row = parent.createDiv({ cls: 'los-review-row' });
    const copy = row.createDiv({ cls: 'los-review-copy' });
    const heading = copy.createDiv({ cls: 'los-review-heading' });
    heading.createEl('strong', { text: label });
    if (count != null) heading.createSpan({ cls: 'los-review-count', text: String(count) });
    copy.createDiv({ cls: 'los-micro', text: detail });
    if (action) button(row, action[0], action[1], count ? 'cta' : 'quiet');
    else row.createSpan({ cls: 'los-micro los-review-clear', text: 'Nothing waiting' });
    return row;
  }
}

/**
 * Diagnostics — everything the learner does not need while studying. Lives
 * under More, never on Home. A green/red badge is not enough for a layer that
 * can be stale, warning, erroring, or talking to no core at all.
 */
export class DiagnosticsView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; this.report = ''; }
  getViewType() { return VIEW_DIAGNOSTICS; }
  getDisplayText() { return 'LearningOS · Diagnostics'; }
  getIcon() { return 'activity'; }
  async onOpen() { this.render(); }

  buildInfo() {
    const fallback = {
      ui_version: this.plugin.uiVersion(),
      manifest_contract_version: CONTRACT_VERSION,
      source_revision: 'unavailable',
      source_fingerprint: 'unavailable',
      bundle_sha256: 'unavailable',
      node_version: 'unavailable',
    };
    try {
      const base = this.plugin.app.vault.adapter.getBasePath();
      const pluginInfo = this.plugin.manifest || {};
      const directory = pluginInfo.dir
        || nodePath.join('.obsidian', 'plugins', pluginInfo.id || 'learningos-ui');
      const target = nodePath.join(base, directory, 'build-info.json');
      if (!fs.existsSync(target)) return fallback;
      const parsed = JSON.parse(fs.readFileSync(target, 'utf8'));
      return { ...fallback, ...parsed };
    } catch (_) {
      return fallback;
    }
  }

  state() {
    if (!this.plugin.store.ready) return ['?', 'Core unavailable', this.plugin.store.error];
    if (this.plugin.store.data?._generated?.source_dirty) {
      return ['●', 'Canonical files changed; projection is stale', 'Rebuild to bring the interface back in step.'];
    }
    return ['✓', 'Valid and current', 'The projection matches the canonical tree as of its last rebuild.'];
  }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-diagnostics-view');
    pageHeader(root, 'More', 'Diagnostics');
    const [glyph, title, detail] = this.state();
    const status = root.createDiv({ cls: 'los-diagnostic-status' });
    status.createSpan({ cls: 'los-diagnostic-glyph', text: glyph });
    const copy = status.createDiv();
    copy.createEl('strong', { text: title });
    copy.createDiv({ cls: 'los-micro', text: detail });

    const generated = this.plugin.store.data?._generated || {};
    const build = this.buildInfo();
    const facts = section(root, 'Contract and versions');
    const table = facts.createDiv({ cls: 'los-fact-list' });
    for (const [label, value] of [
      ['Manifest contract', generated.contract_version ?? 'unknown'],
      ['UI expects contract', CONTRACT_VERSION],
      ['UI version', this.plugin.uiVersion()],
      ['UI source revision', build.source_revision],
      ['UI source fingerprint', build.source_fingerprint],
      ['UI bundle fingerprint', build.bundle_sha256],
      ['Build Node', build.node_version],
      ['Generator', generated.generator || 'unknown'],
      ['Projection built', generated.generated_at || 'unknown'],
      ['Snapshot', generated.snapshot_id || 'unknown'],
      ['Source revision', generated.source_revision || 'unknown'],
      ['Python interpreter', this.plugin.resolvePython().path],
      ['Interpreter source', this.plugin.resolvePython().origin],
    ]) {
      const row = table.createDiv({ cls: 'los-fact-row' });
      row.createSpan({ cls: 'los-fact-label', text: label });
      row.createSpan({ cls: 'los-fact-value', text: String(value) });
    }

    const actions = root.createDiv({ cls: 'los-actions' });
    button(actions, 'Validate and rebuild', () => this.plugin.generate(), 'cta');
    button(actions, 'Test the interpreter', () => this.testInterpreter(), 'quiet');
    button(actions, 'Copy build identity', () => this.plugin.copyText(JSON.stringify(build, null, 2)), 'quiet');
    if (this.report) root.createEl('pre', { cls: 'los-diagnostic-report', text: this.report });

    const policy = section(root, 'About LearningOS');
    policy.createEl('p', { text: OWNERSHIP_STATEMENT });
  }

  async testInterpreter() {
    const resolved = this.plugin.resolvePython();
    try {
      const result = await this.plugin.gateway.call(['status', '--json']);
      this.report = `${resolved.path} (${resolved.origin})\nCore answered: ${JSON.stringify(result).slice(0, 400)}`;
    } catch (error) {
      this.report = `${resolved.path} (${resolved.origin})\nFailed: ${error?.message || String(error)}\nTried: ${resolved.attempted.join(', ')}`;
    }
    this.render();
  }
}
