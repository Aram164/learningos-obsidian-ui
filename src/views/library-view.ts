/**
 * Library — the reference surface.
 *
 * Shelves come first. A registry of 228 sources in one flat list is a haystack;
 * the 16 curated collections are the only place the *reading strategy* is
 * written down (spine vs supplement, tier, when to reach for it), so they are
 * the default way in. Sources, notes, concepts and workspaces stay reachable as
 * modes, each with the facets that make a few hundred rows navigable.
 *
 * Presentation only: every judgment shown here is authored core-side — this view
 * groups and counts, and never invents an ordering the canon does not carry.
 */
export const LIBRARY_MODES = [
  ['collection', 'Shelves'], ['source', 'Sources'], ['note', 'Notes'],
  ['concept', 'Concepts'], ['workspace', 'Workspaces'],
];

export const SOURCE_FACETS = [
  ['all', 'All'], ['shelved', 'On a shelf'], ['unshelved', 'Not on any shelf'],
  ['local', 'Local copy'], ['online', 'Online'], ['in-unit', 'Used in a unit'],
];

export class LibraryView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.query = '';
    this.type = 'collection';
    this.selectedId = null;
    this.facet = 'all';
    this.domain = '';
  }
  getViewType() { return VIEW_LIBRARY; }
  getDisplayText() { return 'LearningOS · Library'; }

  applyState(state) {
    const has = (key) => Object.prototype.hasOwnProperty.call(state || {}, key);
    if (has('recordType') && state.recordType) this.type = state.recordType;
    if (has('domain')) this.domain = state.domain || '';
    if (has('facet')) this.facet = state.facet || 'all';
    if (has('recordId')) {
      this.selectedId = state.recordId || null;
      const record = this.plugin.store.get(this.selectedId);
      if (!has('recordType') && record?.type) this.type = record.type;
      if (this.selectedId) this.query = '';
    }
    if (has('query')) this.query = state.query || '';
  }
  async setState(state) { this.applyState(state); this.render(); }
  getState() {
    return { recordType: this.type, recordId: this.selectedId, query: this.query,
      facet: this.facet, domain: this.domain };
  }
  async onOpen() { this.applyState(this.leaf.state || {}); this.render(); }

  // -------------------------------------------------------------- shelf index

  /** source id → the shelves that carry it, with this shelf's own reason. */
  shelfIndex() {
    if (this._shelfIndex && this._shelfSnapshot === this.plugin.store.snapshotId) return this._shelfIndex;
    const index = new Map();
    for (const shelf of this.plugin.store.of('collection')) {
      for (const entry of shelf.entries || []) {
        if (!entry?.source) continue;
        if (!index.has(entry.source)) index.set(entry.source, []);
        index.get(entry.source).push({ shelf, group: entry.group, why: entry.why });
      }
    }
    this._shelfIndex = index;
    this._shelfSnapshot = this.plugin.store.snapshotId;
    return index;
  }

  matchesFacet(record) {
    if (this.type !== 'source' || this.facet === 'all') return true;
    const shelves = this.shelfIndex().get(record.id) || [];
    if (this.facet === 'shelved') return shelves.length > 0;
    if (this.facet === 'unshelved') return shelves.length === 0;
    if (this.facet === 'local') return Boolean(record.material_exists);
    if (this.facet === 'online') return Boolean(record.url);
    if (this.facet === 'in-unit') return this.plugin.store.useUnits(record.id).length > 0;
    return true;
  }

  rows() {
    let rows = this.plugin.store.search(this.query, [this.type]).filter((row) => this.matchesFacet(row));
    if (this.domain) rows = rows.filter((row) => (row.domain || '') === this.domain);
    return rows.slice().sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)));
  }

  // ------------------------------------------------------------------ render

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-library-view');
    // Reachable from the Navigator regardless of projection health, so it must
    // degrade rather than search an unloaded record set.
    if (!this.plugin.store.ready) {
      pageHeader(root, 'Reference', 'Projection unavailable');
      empty(root, 'The interface contract could not be loaded', this.plugin.store.error,
        'Rebuild views', () => this.plugin.generate());
      return;
    }
    pageHeader(root, 'Reference', 'Library',
      'Shelves carry the reading strategy; the registry carries everything registered. Use is per unit — never a global source score.');

    const controls = root.createDiv({ cls: 'los-library-controls' });
    const input = controls.createEl('input', {
      cls: 'los-search',
      attr: { type: 'search', placeholder: 'Search titles, IDs, aliases, authors…', 'aria-label': 'Library search' },
    });
    input.value = this.query;
    input.addEventListener('input', (event) => {
      this.query = event.target?.value ?? input.value;
      this.selectedId = null;
      const position = input.selectionStart;
      this.render();
      const next = this.contentEl.querySelector('.los-search');
      next?.focus();
      if (position != null) next?.setSelectionRange(position, position);
    });
    button(controls, 'Full-text / OCR search', () => this.plugin.openFullTextSearch(this.query), 'quiet');

    const tabs = root.createDiv({ cls: 'los-library-tabs' });
    for (const [value, label] of LIBRARY_MODES) {
      const count = this.plugin.store.of(value).length;
      const tab = button(tabs, `${label} (${count})`, () => {
        this.type = value; this.selectedId = null; this.facet = 'all'; this.domain = ''; this.render();
      }, this.type === value ? 'cta' : 'quiet');
      tab.setAttribute('aria-pressed', String(this.type === value));
    }

    if (this.type === 'source') this.renderFacets(root);
    if (this.domain) {
      const active = root.createDiv({ cls: 'los-library-filter' });
      active.createSpan({ text: `Domain: ${this.domain}` });
      button(active, 'Clear', () => { this.domain = ''; this.selectedId = null; this.render(); }, 'quiet');
    }

    const layout = root.createDiv({ cls: 'los-library-layout' });
    const list = layout.createDiv({ cls: 'los-library-list' });
    const rows = this.rows();
    if (this.selectedId && !rows.some((row) => row.id === this.selectedId)) this.selectedId = null;
    if (!this.selectedId && rows.length) this.selectedId = rows[0].id;
    if (!rows.length) {
      empty(list, 'No matching records',
        this.facet === 'all' ? 'Try a title, an ID, or a German/English alias.'
          : 'No record matches this filter — clear it or widen the search.');
    }
    if (this.type === 'collection') this.renderShelfList(list, rows);
    else this.renderFlatList(list, rows);

    this.detailEl = layout.createDiv({ cls: 'los-library-detail' });
    this.renderDetail(rows.find((row) => row.id === this.selectedId));
    viewFooter(root);
  }

  renderFacets(root) {
    const bar = root.createDiv({ cls: 'los-library-facets' });
    bar.createSpan({ cls: 'los-kicker', text: 'Filter' });
    const all = this.plugin.store.of('source');
    for (const [value, label] of SOURCE_FACETS) {
      const previous = this.facet;
      this.facet = value;
      const count = all.filter((row) => this.matchesFacet(row)).length;
      this.facet = previous;
      const chipEl = button(bar, `${label} · ${count}`, () => {
        this.facet = value; this.selectedId = null; this.render();
      }, this.facet === value ? 'cta' : 'quiet');
      chipEl.setAttribute('aria-pressed', String(this.facet === value));
    }
  }

  /** Shelves grouped by the domain the core assigns them. */
  renderShelfList(list, rows) {
    const byDomain = new Map();
    for (const row of rows) {
      const domain = row.domain || 'cross-domain';
      if (!byDomain.has(domain)) byDomain.set(domain, []);
      byDomain.get(domain).push(row);
    }
    for (const domain of [...byDomain.keys()].sort()) {
      list.createDiv({ cls: 'los-list-group', text: domain });
      for (const record of byDomain.get(domain)) this.listRow(list, record, `${(record.entries || []).length} entries`);
    }
  }

  renderFlatList(list, rows) {
    for (const record of rows) {
      let meta = record.id;
      if (record.type === 'source') {
        const shelves = this.shelfIndex().get(record.id) || [];
        meta = [record.source_type, record.year,
          shelves.length ? `${shelves.length} shelf${shelves.length > 1 ? 'ves' : ''}` : 'no shelf',
          record.material_exists ? 'local' : null].filter(Boolean).join(' · ');
      } else if (record.type === 'note') {
        meta = [record.role, record.domain, record.state].filter(Boolean).join(' · ');
      }
      this.listRow(list, record, meta);
    }
  }

  listRow(list, record, meta) {
    const row = list.createEl('button', {
      cls: `los-item ${record.id === this.selectedId ? 'is-selected' : ''}`,
      attr: { type: 'button' },
    });
    icon(row.createSpan(), ICONS[record.type] || 'circle');
    const copy = row.createSpan({ cls: 'los-item-copy' });
    copy.createSpan({ text: record.title || record.id });
    copy.createSpan({ cls: 'los-micro', text: meta || record.id });
    row.addEventListener('click', () => { this.selectedId = record.id; this.render(); });
    return row;
  }

  // ------------------------------------------------------------------ detail

  renderDetail(record) {
    const detail = this.detailEl;
    if (!record) { empty(detail, 'Choose a record', 'The detail pane shows evidence and curriculum usage.'); return; }
    detail.createDiv({ cls: 'los-kicker', text: record.type === 'collection' ? 'shelf' : record.type });
    detail.createEl('h2', { text: record.title || record.id });
    detail.createDiv({ cls: 'los-detail-id', text: record.id });
    if (record.summary) detail.createEl('p', { text: record.summary });

    const actions = detail.createDiv({ cls: 'los-actions' });
    if (record.url) button(actions, 'Open online', () => this.plugin.openResource({ url: record.url }), 'cta');
    if (record.material_path) button(actions, 'Open local copy', () => this.plugin.openMaterialPath(record.material_path), 'quiet');
    if (record.path) button(actions, record.type === 'note' ? 'Open note' : 'Open authored file',
      () => this.plugin.openAuthoredPath(record.path), 'quiet');
    button(actions, 'Copy ID', () => this.plugin.copyText(record.id), 'quiet');

    if (record.attachments?.length) {
      const attachments = section(detail, 'Attachments', 'Open the original handwriting, image, or PDF.');
      for (const attachment of record.attachments) {
        const path = typeof attachment === 'string' ? attachment : attachment.path || attachment.vault_path;
        const label = typeof attachment === 'string' ? attachment.split('/').pop() : attachment.label || path;
        if (path) button(attachments, `Open ${label}`, () => this.plugin.openAuthoredPath(path), 'quiet');
      }
    }

    if (record.type === 'collection') this.renderShelfDetail(detail, record);
    if (record.type === 'source') this.renderSourceDetail(detail, record);

    const related = this.plugin.store.related(record.id);
    if (related.length) {
      const wrap = section(detail, 'Related');
      for (const row of related.slice(0, 24)) chip(wrap, row.rec, (rec) => this.plugin.openRecord(rec));
    }
  }

  /** A shelf reads in its authored order, grouped by the author's own tiers. */
  renderShelfDetail(detail, shelf) {
    const entries = (shelf.entries || []).filter((entry) => entry?.source);
    const wrap = section(detail, `Reading list (${entries.length})`,
      'Order and grouping are the shelf’s own; each line says the entry’s role in this list.');
    if (!entries.length) { empty(wrap, 'Empty shelf', 'No entries are registered on this collection.'); return; }
    const groups = [];
    for (const entry of entries) {
      const name = entry.group || '';
      const last = groups[groups.length - 1];
      if (last && last.name === name) last.rows.push(entry);
      else groups.push({ name, rows: [entry] });
    }
    for (const group of groups) {
      if (group.name) wrap.createDiv({ cls: 'los-list-group', text: group.name });
      for (const entry of group.rows) {
        const source = this.plugin.store.get(entry.source);
        const row = wrap.createDiv({ cls: 'los-shelf-entry' });
        const head = row.createEl('button', { cls: 'los-shelf-entry-title is-clickable', attr: { type: 'button' } });
        icon(head.createSpan(), ICONS.source);
        head.createSpan({ text: source?.title || entry.source });
        head.addEventListener('click', () => {
          if (source) { this.type = 'source'; this.selectedId = source.id; this.facet = 'all'; this.query = ''; this.render(); }
        });
        const facts = [source?.source_type, source?.year,
          source?.material_exists ? 'local copy' : null, source?.url ? 'online' : 'no link'].filter(Boolean);
        if (facts.length) row.createDiv({ cls: 'los-micro', text: facts.join(' · ') });
        if (entry.why) row.createDiv({ cls: 'los-shelf-why', text: entry.why });
        const rowActions = row.createDiv({ cls: 'los-actions' });
        if (source?.url) button(rowActions, 'Open online', () => this.plugin.openResource({ url: source.url }), 'quiet');
        if (source?.material_path) button(rowActions, 'Open local copy', () => this.plugin.openMaterialPath(source.material_path), 'quiet');
      }
    }
  }

  renderSourceDetail(detail, record) {
    const facts = section(detail, 'Source facts');
    for (const [label, value] of [['Authors', (record.authors || []).join(', ')],
      ['Organization', record.organization], ['Year', record.year],
      ['Type', record.source_type]]) {
      if (value) facts.createDiv({ cls: 'los-row', text: `${label}: ${value}` });
    }

    const shelves = this.shelfIndex().get(record.id) || [];
    const onShelves = section(detail, 'On shelves',
      'Where this source sits in a curated list, and the role it plays there.');
    if (!shelves.length) {
      empty(onShelves, 'Not on any shelf',
        'Registered but uncurated — it surfaces only through concept links and note references.');
    }
    for (const row of shelves) {
      const line = onShelves.createDiv({ cls: 'los-shelf-entry' });
      const head = line.createEl('button', { cls: 'los-shelf-entry-title is-clickable', attr: { type: 'button' } });
      icon(head.createSpan(), 'library');
      head.createSpan({ text: row.shelf.title || row.shelf.id });
      head.addEventListener('click', () => {
        this.type = 'collection'; this.selectedId = row.shelf.id; this.query = ''; this.render();
      });
      if (row.group) line.createDiv({ cls: 'los-micro', text: row.group });
      if (row.why) line.createDiv({ cls: 'los-shelf-why', text: row.why });
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
}
