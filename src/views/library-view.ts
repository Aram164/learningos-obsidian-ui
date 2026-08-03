export class LibraryView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf); this.plugin = plugin; this.query = ''; this.type = 'source'; this.selectedId = null;
  }
  getViewType() { return VIEW_LIBRARY; }
  getDisplayText() { return 'LearningOS · Library'; }
  async setState(state) {
    this.type = state?.recordType || this.type;
    this.selectedId = state?.recordId || this.selectedId;
    this.render();
  }
  getState() { return { recordType: this.type, recordId: this.selectedId }; }
  async onOpen() {
    this.type = this.leaf.state?.recordType || this.type;
    this.selectedId = this.leaf.state?.recordId || this.selectedId;
    this.render();
  }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-library-view');
    pageHeader(root, 'Reference', 'Library',
      'Search registered sources, notes, concepts, and workspaces without turning the catalogue into the curriculum.');
    const controls = root.createDiv({ cls: 'los-library-controls' });
    const input = controls.createEl('input', {
      cls: 'los-search', attr: { type: 'search', placeholder: 'Search titles, IDs, aliases, authors…', 'aria-label': 'Library search' },
    });
    input.value = this.query;
    input.addEventListener('input', (event) => { this.query = event.target?.value ?? input.value; this.render(); });
    button(controls, 'Full-text / OCR search', () => this.plugin.openFullTextSearch(), 'quiet');
    for (const [value, label] of [['source', 'Sources'], ['note', 'Notes'], ['concept', 'Concepts'], ['workspace', 'Workspaces']]) {
      button(controls, label, () => { this.type = value; this.selectedId = null; this.render(); },
        this.type === value ? 'cta' : 'quiet');
    }
    const layout = root.createDiv({ cls: 'los-library-layout' });
    const list = layout.createDiv({ cls: 'los-library-list' });
    const rows = this.plugin.store.search(this.query, [this.type]);
    if (!rows.length) empty(list, 'No matching records', 'Try a title, an ID, or a German/English alias.');
    for (const record of rows) {
      const row = list.createEl('button', {
        cls: `los-item ${record.id === this.selectedId ? 'is-selected' : ''}`,
        attr: { type: 'button' },
      });
      icon(row.createSpan(), ICONS[record.type] || 'circle');
      const copy = row.createSpan({ cls: 'los-item-copy' });
      copy.createSpan({ text: record.title || record.id });
      copy.createSpan({ cls: 'los-micro', text: record.id });
      row.addEventListener('click', () => { this.selectedId = record.id; this.render(); });
    }
    this.detailEl = layout.createDiv({ cls: 'los-library-detail' });
    this.renderDetail(this.plugin.store.get(this.selectedId) || rows[0]);
    viewFooter(root);
  }

  renderDetail(record) {
    const detail = this.detailEl;
    if (!record) { empty(detail, 'Choose a record', 'The detail pane shows evidence and curriculum usage.'); return; }
    detail.createDiv({ cls: 'los-kicker', text: record.type });
    detail.createEl('h2', { text: record.title || record.id });
    detail.createDiv({ cls: 'los-detail-id', text: record.id });
    if (record.summary) detail.createEl('p', { text: record.summary });
    const actions = detail.createDiv({ cls: 'los-actions' });
    if (record.url) button(actions, 'Open online', () => this.plugin.openResource({ url: record.url }), 'cta');
    if (record.material_path) button(actions, 'Open local copy', () => this.plugin.openResource({ vault_path: record.material_path }), 'quiet');
    if (record.path) button(actions, 'Open registry file', () => this.plugin.openVaultPath(record.path), 'quiet');
    button(actions, 'Copy ID', () => this.plugin.copyText(record.id), 'quiet');

    if (record.type === 'source') {
      const facts = section(detail, 'Source facts');
      for (const [label, value] of [['Authors', (record.authors || []).join(', ')],
        ['Organization', record.organization], ['Year', record.year]]) {
        if (value) facts.createDiv({ cls: 'los-row', text: `${label}: ${value}` });
      }
      const used = section(detail, 'Used in units', 'Use is module/unit-specific; it is not a global source score.');
      const units = this.plugin.store.useUnits(record.id);
      if (!units.length) empty(used, 'Not routed to a unit', 'The source remains globally registered.');
      for (const unit of units) chip(used, unit, (row) => this.plugin.openUnit(row.id));
      const evaluations = (record.evaluations || []).filter((row) => row.verdict || row.scope
        || row.reading_plan?.length || row.useful_sections?.length);
      if (evaluations.length) {
        const evidence = section(detail, 'Existing evaluation evidence');
        for (const evaluation of evaluations) {
          const card = evidence.createDiv({ cls: 'los-evidence-card' });
          if (evaluation.verdict) card.createEl('p', { text: evaluation.verdict });
          for (const selection of evaluation.reading_plan || []) {
            card.createDiv({ cls: 'los-row', text: selection });
          }
          for (const selection of evaluation.useful_sections || []) {
            card.createDiv({ cls: 'los-row', text: `${selection.section}${selection.note ? ` — ${selection.note}` : ''}` });
          }
        }
      }
    }
    const related = this.plugin.store.related(record.id);
    if (related.length) {
      const wrap = section(detail, 'Related');
      for (const row of related.slice(0, 24)) chip(wrap, row.rec, (rec) => this.plugin.openRecord(rec));
    }
  }
}
