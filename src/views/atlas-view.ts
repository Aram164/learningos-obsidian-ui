/**
 * Domain atlas — the cross-domain map (ADR-005).
 *
 * Its whole purpose is to stop a session's field of view collapsing to the
 * active workspace's domain, which a link to a Markdown wall cannot do. Every
 * domain lists its actual notes, wiring hubs and shelves, and every row opens
 * the thing it names. Counts stay — but as a way in, not as the answer.
 *
 * Presentation only: domains, roles and shelf assignments are core-authored.
 */
export const ATLAS_ROLE_ORDER = ['crosswalk', 'reference', 'synthesis', 'exercise-bank', 'mock-exam'];

export class AtlasView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; this.domain = null; }
  getViewType() { return VIEW_ATLAS; }
  getDisplayText() { return 'LearningOS · Domain atlas'; }
  getIcon() { return 'map'; }
  async setState(state) {
    if (state?.domain) this.domain = state.domain;
    this.render();
  }
  getState() { return { domain: this.domain }; }
  async onOpen() { this.domain = this.leaf.state?.domain || null; this.render(); }

  atlas() {
    const domains = new Map();
    const bucket = (name) => {
      const key = name || 'cross-domain';
      if (!domains.has(key)) domains.set(key, { name: key, notes: [], shelves: [] });
      return domains.get(key);
    };
    for (const note of this.plugin.store.of('note')) bucket(note.domain).notes.push(note);
    for (const shelf of this.plugin.store.of('collection')) bucket(shelf.domain).shelves.push(shelf);
    return [...domains.values()].sort((a, b) => b.notes.length - a.notes.length
      || a.name.localeCompare(b.name));
  }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-atlas-view');
    if (!this.plugin.store.ready) {
      pageHeader(root, 'Reach', 'Domain atlas unavailable');
      empty(root, 'The interface contract could not be loaded', this.plugin.store.error,
        'Rebuild views', () => this.plugin.generate());
      return;
    }
    pageHeader(root, 'Reach', 'Domain atlas',
      'Every domain’s notes, wiring hubs and shelves — so a question standing in one module can be answered by another domain’s shelf.');

    const domains = this.atlas();
    if (!domains.length) {
      empty(root, 'Nothing mapped yet', 'No notes or shelves are registered.');
      return;
    }
    if (!this.domain || !domains.some((row) => row.name === this.domain)) this.domain = domains[0].name;

    const glance = root.createDiv({ cls: 'los-atlas-glance' });
    for (const domain of domains) {
      const entries = domain.shelves.reduce((total, shelf) => total + (shelf.entries || []).length, 0);
      const crosswalks = domain.notes.filter((note) => note.role === 'crosswalk').length;
      const tile = glance.createEl('button', {
        cls: `los-atlas-tile is-clickable ${domain.name === this.domain ? 'is-selected' : ''}`,
        attr: { type: 'button', 'aria-pressed': String(domain.name === this.domain) },
      });
      tile.createSpan({ cls: 'los-atlas-tile-name', text: domain.name });
      const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;
      tile.createSpan({
        cls: 'los-micro',
        text: [plural(domain.notes.length, 'note'),
          crosswalks ? plural(crosswalks, 'crosswalk') : null,
          `${plural(domain.shelves.length, 'shelf').replace('shelfs', 'shelves')} (${entries})`,
        ].filter(Boolean).join(' · '),
      });
      tile.addEventListener('click', () => { this.domain = domain.name; this.render(); });
    }

    const current = domains.find((row) => row.name === this.domain);
    const body = root.createDiv({ cls: 'los-atlas-body' });
    this.renderDomain(body, current);
    this.renderBoundaries(root);
  }

  noteRow(parent, note) {
    const row = parent.createEl('button', { cls: 'los-item is-clickable', attr: { type: 'button' } });
    icon(row.createSpan(), ICONS.note);
    const copy = row.createSpan({ cls: 'los-item-copy' });
    copy.createSpan({ text: note.title || note.id });
    copy.createSpan({ cls: 'los-micro', text: [note.role, note.state, note.id].filter(Boolean).join(' · ') });
    row.addEventListener('click', () => this.plugin.openAuthoredPath(note.path));
    return row;
  }

  renderDomain(parent, domain) {
    if (!domain) return;
    const header = parent.createDiv({ cls: 'los-atlas-domain-head' });
    header.createEl('h2', { text: domain.name });
    const actions = header.createDiv({ cls: 'los-actions' });
    button(actions, 'Browse these notes in the Library',
      () => this.plugin.openLibraryFiltered('note', domain.name), 'quiet');

    const crosswalks = domain.notes.filter((note) => note.role === 'crosswalk');
    if (crosswalks.length) {
      const wrap = section(parent, `Wiring hubs (${crosswalks.length})`,
        'Crosswalks carry the narrative that joins this domain’s sources and concepts — read one before opening a shelf.');
      for (const note of crosswalks) this.noteRow(wrap, note);
    }

    const byRole = new Map();
    for (const note of domain.notes) {
      const role = note.role || 'synthesis';
      if (!byRole.has(role)) byRole.set(role, []);
      byRole.get(role).push(note);
    }
    const roles = [...byRole.keys()].sort((a, b) => {
      const rank = (role) => (ATLAS_ROLE_ORDER.indexOf(role) + 1 || 99);
      return rank(a) - rank(b) || a.localeCompare(b);
    });
    if (domain.notes.length) {
      const notesWrap = section(parent, `Notes (${domain.notes.length})`,
        'Grouped by role. Opening a row opens the note itself.');
      for (const role of roles) {
        const rows = byRole.get(role).slice()
          .sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)));
        const group = notesWrap.createEl('details', { cls: 'los-atlas-group' });
        if (role === 'crosswalk' ? false : rows.length <= 12) group.setAttr('open', 'open');
        group.createEl('summary', { text: `${role} (${rows.length})` });
        for (const note of rows) this.noteRow(group, note);
      }
    } else {
      empty(parent, 'No notes in this domain yet',
        'Sources here surface only through concept links and shelves.');
    }

    const shelvesWrap = section(parent, `Shelves (${domain.shelves.length})`,
      'Curated reading lists. The blurb is the shelf’s own rule for using it.');
    if (!domain.shelves.length) {
      empty(shelvesWrap, 'No shelves yet',
        'Nothing curated for this domain — the registry still holds its sources.');
    }
    for (const shelf of domain.shelves.slice()
      .sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)))) {
      const card = shelvesWrap.createDiv({ cls: 'los-shelf-entry' });
      const head = card.createEl('button', { cls: 'los-shelf-entry-title is-clickable', attr: { type: 'button' } });
      icon(head.createSpan(), 'library');
      head.createSpan({ text: `${shelf.title || shelf.id} (${(shelf.entries || []).length})` });
      head.addEventListener('click', () => this.plugin.openLibrary(shelf.id, 'collection'));
      if (shelf.summary) card.createDiv({ cls: 'los-shelf-why', text: projectedExcerpt(shelf.summary, 320) });
    }
  }

  renderBoundaries(root) {
    const boundaries = this.plugin.store.rows('quarantine_boundaries');
    const wrap = section(root, 'Outside this map by policy',
      'Named so their absence is visible; their content is never loaded, indexed, or searched.');
    if (!boundaries.length) {
      empty(wrap, 'No boundary records', 'Nothing is currently quarantined in the projection.');
    }
    for (const boundary of boundaries) {
      const card = wrap.createDiv({ cls: 'los-boundary-row' });
      card.createDiv({ cls: 'los-item-copy', text: boundary.title || boundary.id });
      const policy = boundaryPolicy(boundary.description || '');
      if (policy) card.createDiv({ cls: 'los-micro', text: policy });
    }
    button(wrap, 'Open the generated atlas file',
      () => this.plugin.openVaultPath('generated/domain-atlas.md'), 'quiet');
  }
}
