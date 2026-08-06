/**
 * Library navigation is deliberately full-page: choose a collection, choose a
 * core-projected thematic group, then open one record. No default selection and
 * no permanent master/detail columns.
 */
export const SOURCE_FACETS = [
  ['all', 'All'], ['local', 'Local copy'], ['online', 'Online'], ['in-unit', 'Used in a unit'],
];

export class LibraryView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.screen = 'home';
    this.collection = 'sources';
    this.groupId = null;
    this.query = '';
    this.facet = 'all';
    this.resourceId = null;
    this.topicPackId = null;
    this.catalogueId = null;
    this.recordType = 'note';
    this.domain = '';
    this.selectedElementId = null;
  }
  getViewType() { return VIEW_LIBRARY; }
  getDisplayText() { return 'LearningOS · Library'; }

  applyState(state = {}) {
    this.screen = state.screen || (state.recordId ? 'legacy-list' : 'home');
    this.collection = state.collection || this.collection || 'sources';
    this.groupId = state.groupId || state.fromGroupId || null;
    this.query = state.query || '';
    this.facet = state.facet || 'all';
    this.resourceId = state.resourceId || null;
    this.topicPackId = state.topicPackId || null;
    this.catalogueId = state.catalogueId || null;
    this.recordType = state.recordType || this.recordType || 'note';
    this.domain = state.domain || '';
  }
  async setState(state) { this.applyState(state); this.render(); }
  getState() {
    return {
      screen: this.screen, collection: this.collection, groupId: this.groupId,
      query: this.query, facet: this.facet, resourceId: this.resourceId,
      topicPackId: this.topicPackId, catalogueId: this.catalogueId,
      recordType: this.recordType, domain: this.domain,
    };
  }
  async onOpen() { this.applyState(this.leaf.state || {}); this.render(); }

  shelfIndex() {
    if (this._shelfIndex && this._shelfSnapshot === this.plugin.store.snapshotId) return this._shelfIndex;
    const index = new Map();
    for (const shelf of [...this.plugin.store.catalogues(), ...this.plugin.store.topicPacks()]) {
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

  matchesSourceFacet(record) {
    if (this.facet === 'all') return true;
    if (this.facet === 'local') return Boolean(record.material_exists || record.material_path);
    if (this.facet === 'online') return Boolean(record.url);
    if (this.facet === 'in-unit') return this.plugin.store.useUnits(record.id).length > 0;
    return true;
  }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-library-view');
    if (!this.plugin.store.ready) {
      pageHeader(root, 'Library', 'Projection unavailable');
      empty(root, 'The interface contract could not be loaded', this.plugin.store.error,
        'Rebuild views', () => this.plugin.generate());
      return;
    }
    if (this.screen === 'group') return this.renderGroup(root);
    if (this.screen === 'source-detail') return this.renderSourcePage(root);
    if (this.screen === 'topic-pack-detail') return this.renderTopicPackPage(root);
    if (this.screen === 'catalogue-detail') return this.renderCataloguePage(root);
    if (this.screen === 'legacy-list') return this.renderLegacyList(root);
    return this.renderHome(root);
  }

  renderHome(root) {
    pageHeader(root, 'Library', 'Choose a thematic group',
      this.collection === 'topic-packs'
        ? 'Topic Packs are narrow, purpose-built and manually ordered collections.'
        : 'Open a domain to browse its learning sources.');
    this.renderCollectionSwitch(root);
    const groups = this.plugin.store.thematicGroups();
    if (!groups.length) {
      empty(root, 'No thematic groups', 'Rebuild the projection after defining thematic-group metadata.');
      return;
    }
    const grid = root.createDiv({ cls: 'los-group-grid los-library-group-grid' });
    for (const group of groups) {
      const count = this.collection === 'topic-packs'
        ? this.plugin.store.topicPacksForGroup(group.id).length
        : this.plugin.store.sourcesForGroup(group.id).length;
      const card = grid.createEl('button', {
        cls: 'los-group-card is-clickable',
        attr: { type: 'button', 'aria-label': `Open ${group.title}` },
      });
      const head = card.createDiv({ cls: 'los-group-card-header' });
      head.createEl('h2', { text: group.title });
      head.createSpan({
        cls: 'los-group-count',
        text: `${count} ${this.collection === 'topic-packs' ? `pack${count === 1 ? '' : 's'}` : `source${count === 1 ? '' : 's'}`}`,
      });
      if (group.description) card.createEl('p', { text: group.description });
      card.createSpan({ cls: 'los-route-open', text: 'Open →' });
      card.addEventListener('click', () => {
        this.selectedElementId = group.id;
        this.plugin.openLibraryGroup(this.collection, group.id);
      });
    }
  }

  renderCollectionSwitch(root) {
    const switcher = root.createDiv({ cls: 'los-collection-switch', attr: { role: 'tablist', 'aria-label': 'Library collection' } });
    for (const [id, label] of [['sources', 'Learning Sources'], ['topic-packs', 'Topic Packs']]) {
      const control = button(switcher, label, () => this.plugin.openLibraryHome(id), this.collection === id ? 'cta' : 'quiet');
      control.setAttrs({ role: 'tab', 'aria-selected': String(this.collection === id) });
    }
  }

  renderGroup(root) {
    const group = this.plugin.store.get(this.groupId);
    const back = button(root, '‹ Library', () => this.plugin.back(), 'quiet');
    back.addClass('los-route-back');
    if (!group) {
      empty(root, 'Thematic group unavailable', 'Return to Library and choose another group.', 'Back', () => this.plugin.back());
      return;
    }
    const isPacks = this.collection === 'topic-packs';
    pageHeader(root, isPacks ? 'Topic Packs' : 'Learning Sources', group.title,
      isPacks ? 'Purpose-built collections in this thematic group.' : 'Learning sources in this thematic group.');
    const toolbar = root.createDiv({ cls: 'los-library-toolbar' });
    const input = toolbar.createEl('input', {
      cls: 'los-search los-route-search',
      attr: {
        type: 'search',
        placeholder: `Search ${group.title} ${isPacks ? 'topic packs' : 'sources'}…`,
        'aria-label': `Search ${group.title} ${isPacks ? 'topic packs' : 'sources'}`,
      },
    });
    input.value = this.query;
    input.addEventListener('input', async () => {
      this.query = input.value;
      await this.rememberGroup();
      this.render();
    });
    if (!isPacks) {
      this.renderSourceFacets(toolbar);
      button(toolbar, 'Full-text / OCR search', () => this.plugin.openFullTextSearch(this.query), 'quiet');
    }

    const all = isPacks
      ? this.plugin.store.topicPacksForGroup(group.id)
      : this.plugin.store.sourcesForGroup(group.id);
    const needle = this.query.trim().toLocaleLowerCase();
    const rows = all.filter((record) => {
      if (!isPacks && !this.matchesSourceFacet(record)) return false;
      if (!needle) return true;
      const hay = [record.id, record.title, record.purpose, record.summary,
        ...(record.aliases || []), ...(record.authors || []), record.organization]
        .filter(Boolean).join(' ').toLocaleLowerCase();
      return needle.split(/\s+/).every((word) => hay.includes(word));
    }).slice().sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)));

    if (!all.length) {
      empty(root, isPacks ? 'No Topic Packs in this group' : 'No Learning Sources in this group',
        isPacks
          ? 'The group exists, but no purpose-built pack currently references it.'
          : 'The group exists, but no learning source currently references it.');
      return;
    }
    if (!rows.length) {
      empty(root, 'No matching results',
        `Nothing in ${group.title} matches the current search and filters.`,
        'Clear search and filters', async () => {
          this.query = ''; this.facet = 'all'; await this.rememberGroup(); this.render();
        });
      return;
    }
    const list = root.createDiv({ cls: 'los-route-list los-library-route-list' });
    for (const record of rows) this.renderRecordRow(list, record, isPacks);
  }

  async rememberGroup() {
    return this.plugin.router.remember({
      name: 'library-group', collection: this.collection, groupId: this.groupId,
      query: this.query, facet: this.facet,
    });
  }

  renderSourceFacets(parent) {
    const facets = parent.createDiv({ cls: 'los-library-facets-inline', attr: { 'aria-label': 'Source filters' } });
    for (const [id, label] of SOURCE_FACETS) {
      const control = button(facets, label, async () => {
        this.facet = id; await this.rememberGroup(); this.render();
      }, this.facet === id ? 'row' : 'quiet');
      control.setAttribute('aria-pressed', String(this.facet === id));
    }
  }

  renderRecordRow(list, record, isPack = false) {
    const row = list.createEl('button', {
      cls: 'los-route-row is-clickable',
      attr: { type: 'button', 'aria-label': `Open ${record.title}`, 'data-record-id': record.id },
    });
    const copy = row.createDiv({ cls: 'los-route-row-copy' });
    copy.createEl('strong', { text: record.title || record.id });
    const meta = isPack
      ? [record.purpose, `${(record.entries || []).length} items`].filter(Boolean).join(' · ')
      : [record.source_type, record.year, record.organization,
        record.material_exists || record.material_path ? 'local' : null,
        record.url ? 'online' : null].filter(Boolean).join(' · ');
    if (meta) copy.createDiv({ cls: 'los-route-meta', text: meta });
    row.createSpan({ cls: 'los-route-open', text: 'Open →' });
    row.addEventListener('click', () => {
      this.selectedElementId = record.id;
      if (isPack) this.plugin.openTopicPackDetail(record.id, this.groupId, this.query);
      else this.plugin.openSourceDetail(record.id, this.groupId, this.query, this.facet);
    });
  }

  renderSourcePage(root) {
    const record = this.plugin.store.get(this.resourceId);
    const back = button(root, '‹ Learning Sources', () => this.plugin.back(), 'quiet');
    back.addClass('los-route-back');
    if (!record || record.type !== 'source') {
      empty(root, 'Learning source unavailable', 'The projected source could not be found.', 'Back', () => this.plugin.back());
      return;
    }
    const detail = root.createDiv({ cls: 'los-detail-page' });
    pageHeader(detail, 'Learning Source', record.title || record.id, record.summary || '');
    this.renderRecordActions(detail, record);
    this.renderAttachments(detail, record);
    this.renderSourceDetail(detail, record);
    this.renderRelated(detail, record);
    this.renderTechnical(detail, record);
  }

  renderTopicPackPage(root) {
    const pack = this.plugin.store.get(this.topicPackId);
    const back = button(root, '‹ Topic Packs', () => this.plugin.back(), 'quiet');
    back.addClass('los-route-back');
    if (!pack || pack.type !== 'topic-pack') {
      empty(root, 'Topic Pack unavailable', 'The projected Topic Pack could not be found.', 'Back', () => this.plugin.back());
      return;
    }
    const detail = root.createDiv({ cls: 'los-detail-page los-topic-pack-detail' });
    pageHeader(detail, 'Topic Pack', pack.title || pack.id, pack.summary || '');
    const purpose = section(detail, 'Purpose');
    purpose.createEl('p', { cls: 'los-pack-purpose', text: pack.purpose || 'No purpose recorded.' });
    this.renderOrderedCollection(detail, pack, 'Pack contents');
    this.renderRelated(detail, pack);
    this.renderTechnical(detail, pack);
  }

  renderCataloguePage(root) {
    const catalogue = this.plugin.store.get(this.catalogueId);
    const back = button(root, '‹ Library', () => this.plugin.back(), 'quiet');
    back.addClass('los-route-back');
    if (!catalogue || catalogue.type !== 'collection') {
      empty(root, 'Source catalogue unavailable', 'The projected catalogue could not be found.', 'Back', () => this.plugin.back());
      return;
    }
    const detail = root.createDiv({ cls: 'los-detail-page los-catalogue-detail' });
    pageHeader(detail, 'Source Catalogue', catalogue.title || catalogue.id, catalogue.summary || '');
    this.renderOrderedCollection(detail, catalogue, 'Catalogue entries');
    this.renderRelated(detail, catalogue);
    this.renderTechnical(detail, catalogue);
  }

  renderOrderedCollection(detail, collection, title) {
    const entries = (collection.entries || []).filter((entry) => entry?.source);
    const wrap = section(detail, `${title} (${entries.length})`,
      'The order and grouping shown here come directly from the canonical collection.');
    if (!entries.length) {
      empty(wrap, 'Empty collection', 'No entries are currently registered.');
      return;
    }
    let previousGroup = null;
    entries.forEach((entry, index) => {
      if (entry.group && entry.group !== previousGroup) {
        wrap.createDiv({ cls: 'los-list-group', text: entry.group });
        previousGroup = entry.group;
      }
      const source = this.plugin.store.get(entry.source);
      const row = wrap.createDiv({ cls: 'los-pack-entry' });
      row.createSpan({ cls: 'los-pack-order', text: String(index + 1) });
      const copy = row.createDiv({ cls: 'los-route-row-copy' });
      const open = copy.createEl('button', {
        cls: 'los-shelf-entry-title is-clickable',
        attr: { type: 'button' },
        text: source?.title || entry.source,
      });
      open.addEventListener('click', () => source && this.plugin.openSourceDetail(source.id, this.groupId));
      if (entry.why) copy.createDiv({ cls: 'los-shelf-why', text: entry.why });
      const facts = [source?.source_type, source?.year,
        source?.material_exists || source?.material_path ? 'local' : null,
        source?.url ? 'online' : null].filter(Boolean).join(' · ');
      if (facts) copy.createDiv({ cls: 'los-route-meta', text: facts });
    });
  }

  renderLegacyList(root) {
    const back = button(root, '‹ Library', () => this.plugin.back(), 'quiet');
    back.addClass('los-route-back');
    const title = `${this.recordType.charAt(0).toUpperCase()}${this.recordType.slice(1)} records`;
    pageHeader(root, 'Compatibility view', title,
      this.domain ? `Domain: ${this.domain}` : 'Legacy record families remain reachable until their migration gate closes.');
    const input = root.createEl('input', {
      cls: 'los-search los-route-search',
      attr: { type: 'search', placeholder: `Search ${this.recordType} records…`, 'aria-label': `Search ${this.recordType}` },
    });
    input.value = this.query;
    input.addEventListener('input', async () => {
      this.query = input.value;
      await this.plugin.router.remember({ name: 'legacy-library-list', recordType: this.recordType, query: this.query, domain: this.domain });
      this.render();
    });
    let rows = this.plugin.store.search(this.query, [this.recordType]);
    if (this.domain) rows = rows.filter((row) => row.domain === this.domain);
    rows = rows.slice().sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)));
    if (!rows.length) {
      empty(root, this.query ? 'No matching records' : 'No records',
        this.query ? 'Try a shorter title, alias or ID.' : `No ${this.recordType} records are projected.`);
      return;
    }
    const list = root.createDiv({ cls: 'los-route-list' });
    for (const record of rows) {
      const row = list.createEl('button', {
        cls: 'los-route-row is-clickable',
        attr: { type: 'button', 'data-record-id': record.id },
      });
      const copy = row.createDiv({ cls: 'los-route-row-copy' });
      copy.createEl('strong', { text: record.title || record.id });
      copy.createDiv({ cls: 'los-route-meta', text: [record.role, record.domain, record.state].filter(Boolean).join(' · ') });
      row.createSpan({ cls: 'los-route-open', text: record.path ? 'Open file →' : 'Open →' });
      row.addEventListener('click', () => {
        this.selectedElementId = record.id;
        if (record.path) this.plugin.openAuthoredPath(record.path);
        else this.plugin.openRecord(record);
      });
    }
  }

  renderRecordActions(detail, record) {
    const actions = detail.createDiv({ cls: 'los-actions' });
    if (record.url) button(actions, 'Open online', () => this.plugin.openResource({ url: record.url }), 'cta');
    if (record.material_path) button(actions, 'Open local copy', () => this.plugin.openMaterialPath(record.material_path), 'quiet');
    if (record.path) button(actions, 'Open authored file', () => this.plugin.openAuthoredPath(record.path), 'quiet');
  }

  renderAttachments(detail, record) {
    if (!record.attachments?.length) return;
    const attachments = section(detail, 'Attachments', 'Open the original handwriting, image, or PDF.');
    for (const attachment of record.attachments) {
      const path = typeof attachment === 'string' ? attachment : attachment.path || attachment.vault_path;
      const label = typeof attachment === 'string' ? attachment.split('/').pop() : attachment.label || path;
      if (path) button(attachments, `Open ${label}`, () => this.plugin.openAuthoredPath(path), 'quiet');
    }
  }

  renderRelated(detail, record) {
    const labels = {
      unit: 'Used in units', concept: 'Connected concepts', note: 'Referenced by notes',
      source: 'Related sources', collection: 'In catalogues', 'topic-pack': 'In Topic Packs',
      module: 'Modules', workspace: 'Workspaces', program: 'Areas',
    };
    const groups = new Map();
    for (const row of this.plugin.store.related(record.id)) {
      const key = row.rec?.type || 'record';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row.rec);
    }
    if (!groups.size) return;
    const wrap = section(detail, 'Related');
    for (const [type, rows] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
      const group = wrap.createDiv({ cls: 'los-related-group' });
      group.createDiv({ cls: 'los-group-title', text: `${labels[type] || type} · ${rows.length}` });
      const shown = group.createDiv({ cls: 'los-related-chips' });
      for (const rec of rows.slice(0, 5)) chip(shown, rec, (row) => this.plugin.openRecord(row));
      if (rows.length > 5) {
        const rest = disclosure(group, `View all ${rows.length}`);
        const restChips = rest.createDiv({ cls: 'los-related-chips' });
        for (const rec of rows.slice(5)) chip(restChips, rec, (row) => this.plugin.openRecord(row));
      }
    }
  }

  renderSourceDetail(detail, record) {
    const facts = section(detail, 'Source facts');
    for (const [label, value] of [['Authors', (record.authors || []).join(', ')],
      ['Organization', record.organization], ['Year', record.year], ['Type', record.source_type]]) {
      if (!value) continue;
      const row = facts.createDiv({ cls: 'los-fact-row' });
      row.createSpan({ cls: 'los-fact-label', text: label });
      row.createSpan({ cls: 'los-fact-value', text: String(value) });
    }

    const memberships = this.shelfIndex().get(record.id) || [];
    const placed = section(detail, 'Collections',
      'Where this source sits and the explicit role it plays there.');
    if (!memberships.length) empty(placed, 'Not in a collection', 'The source remains globally registered.');
    for (const membership of memberships) {
      const line = placed.createDiv({ cls: 'los-shelf-entry' });
      const head = line.createEl('button', {
        cls: 'los-shelf-entry-title is-clickable', attr: { type: 'button' },
        text: membership.shelf.title || membership.shelf.id,
      });
      head.addEventListener('click', () => {
        if (membership.shelf.type === 'topic-pack') this.plugin.openTopicPackDetail(membership.shelf.id);
        else this.plugin.openCatalogueDetail(membership.shelf.id);
      });
      if (membership.group) line.createDiv({ cls: 'los-micro', text: membership.group });
      if (membership.why) line.createDiv({ cls: 'los-shelf-why', text: membership.why });
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
        for (const selection of evaluation.reading_plan || []) card.createDiv({ cls: 'los-row', text: selection });
        for (const selection of evaluation.useful_sections || []) {
          card.createDiv({ cls: 'los-row', text: `${selection.section}${selection.note ? ` — ${selection.note}` : ''}` });
        }
      }
    }
  }

  renderTechnical(detail, record) {
    const technical = disclosure(detail, 'Technical details', 'los-technical-details');
    const idRow = technical.createDiv({ cls: 'los-fact-row' });
    idRow.createSpan({ cls: 'los-fact-label', text: 'Record ID' });
    idRow.createSpan({ cls: 'los-fact-value los-detail-id', text: record.id });
    button(technical, 'Copy ID', () => this.plugin.copyText(record.id), 'quiet');
    if (record.path) {
      const pathRow = technical.createDiv({ cls: 'los-fact-row' });
      pathRow.createSpan({ cls: 'los-fact-label', text: 'Path' });
      pathRow.createSpan({ cls: 'los-fact-value', text: record.path });
    }
  }
}
