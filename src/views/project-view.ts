class ProjectLinkReasonModal extends Modal {
  constructor(app, plugin, relationship) {
    super(app); this.plugin = plugin; this.relationship = relationship;
  }
  onOpen() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-linked-reason-modal');
    this.plugin.router.openOverlay({ kind: 'linked-material-reason', relationshipId: this.relationship.id });
    pageHeader(root, 'Linked material', 'Why this is linked');
    const target = this.plugin.store.get(this.relationship.to_id);
    const relation = section(root, 'Relationship');
    relation.createEl('p', { text: `${this.relationship.to_type || 'record'} · ${this.relationship.relation_type || 'linked'}` });
    const rationale = section(root, 'Rationale');
    rationale.createEl('p', { text: this.relationship.reason || 'No rationale was projected.' });
    const contribution = section(root, 'Contribution');
    contribution.createEl('p', { text: this.relationship.contribution || 'No contribution was projected.' });
    const actions = root.createDiv({ cls: 'los-actions' });
    if (target) button(actions, 'Open target', () => { this.close(); this.plugin.openRecord(target); }, 'tertiary');
    else if (this.relationship.path) button(actions, 'Open target', () => { this.close(); this.plugin.openAuthoredPath(this.relationship.path); }, 'tertiary');
    button(actions, 'Close', () => this.close(), 'quiet');
  }
  onClose() { this.plugin.router.clearOverlay(); this.contentEl.empty(); }
}

/** Full-page first-class Projects navigation. */
export class ProjectView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf); this.plugin = plugin; this.screen = 'list'; this.projectId = null;
    this.tab = 'overview'; this.query = ''; this.selectedElementId = null;
  }
  getViewType() { return VIEW_PROJECT; }
  getDisplayText() { return 'LearningOS · Projects'; }
  async setState(state = {}) {
    this.screen = state.screen || (state.projectId ? 'detail' : 'list');
    this.projectId = state.projectId || null;
    this.tab = state.tab || 'overview';
    this.query = state.query || '';
    this.render();
  }
  getState() { return { screen: this.screen, projectId: this.projectId, tab: this.tab, query: this.query }; }
  async onOpen() { await this.setState(this.leaf.state || {}); }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-project-view');
    if (!this.plugin.store.ready) return empty(root, 'Projects unavailable', this.plugin.store.error);
    if (this.screen === 'detail') return this.renderDetail(root);
    return this.renderList(root);
  }

  renderList(root) {
    pageHeader(root, 'Projects', 'Projects', 'Long-running work with its own structure, materials, files, and decisions.');
    const input = root.createEl('input', {
      cls: 'los-search los-project-search',
      attr: { type: 'search', placeholder: 'Search projects', 'aria-label': 'Search projects' },
    });
    input.value = this.query;
    const results = root.createDiv({ cls: 'los-project-list' });
    const draw = () => {
      results.empty();
      const words = String(input.value || '').toLocaleLowerCase().split(/\s+/).filter(Boolean);
      const rows = this.plugin.store.projects().filter((project) => {
        const hay = [project.id, project.title, project.objective, project.project_type]
          .filter(Boolean).join(' ').toLocaleLowerCase();
        return words.every((word) => hay.includes(word));
      });
      if (!rows.length) return empty(results, 'No projects found', 'No first-class project matches this query.', 'Clear search', () => {
        input.value = ''; input.fire('input');
      });
      for (const project of rows) {
        const row = results.createEl('button', {
          cls: 'los-card los-project-row is-clickable',
          attr: { type: 'button', 'aria-label': `Open project: ${project.title}` },
        });
        row.setAttr('data-record-id', project.id);
        const top = row.createDiv({ cls: 'los-card-top' });
        top.createEl('h2', { text: project.title });
        badge(top, project.status || 'planned', project.status || 'planned');
        row.createEl('p', { text: projectedExcerpt(project.objective, 280) });
        row.createDiv({ cls: 'los-micro', text: `${project.project_type || 'project'} · ${(project.linked_module_ids || []).length} linked modules` });
        row.addEventListener('click', () => {
          this.selectedElementId = project.id;
          this.plugin.openProject(project.id, 'overview');
        });
      }
    };
    input.addEventListener('input', () => {
      this.query = input.value;
      this.plugin.router.remember({ name: 'project-list', query: this.query });
      draw();
    });
    draw();
  }

  renderDetail(root) {
    const project = this.plugin.store.get(this.projectId);
    if (!project || project.type !== 'project') {
      pageHeader(root, 'Projects', 'Project not found');
      return empty(root, 'This project is unavailable', 'The current projection does not contain this project.', 'Back to projects', () => this.plugin.openProjects());
    }
    const back = button(root, '‹ Projects', () => this.plugin.back(), 'quiet');
    back.addClass('los-route-back');
    const head = pageHeader(root, 'Project', project.title, project.objective || '');
    const headActions = head.createDiv({ cls: 'los-actions' });
    badge(headActions, project.status || 'planned', project.status || 'planned');

    const tabs = root.createDiv({ cls: 'los-project-tabs', attr: { role: 'tablist', 'aria-label': 'Project sections' } });
    for (const [id, label] of [
      ['overview', 'Overview'], ['structure', 'Structure'], ['linked-materials', 'Linked Materials'],
      ['files', 'Files'], ['decisions', 'Decisions'],
    ]) {
      const tab = button(tabs, label, () => this.plugin.openProject(project.id, id), 'tertiary');
      tab.toggleClass('is-active', this.tab === id);
      tab.setAttrs({ role: 'tab', 'aria-selected': String(this.tab === id) });
    }
    const body = root.createDiv({ cls: 'los-project-body' });
    if (this.tab === 'structure') return this.renderStructure(body, project);
    if (this.tab === 'linked-materials') return this.renderLinked(body, project);
    if (this.tab === 'files') return this.renderFiles(body, project);
    if (this.tab === 'decisions') return this.renderDecisions(body, project);
    return this.renderOverview(body, project);
  }

  renderOverview(root, project) {
    const brief = section(root, 'Project brief');
    const briefCard = brief.createDiv({ cls: 'los-project-brief' });
    const briefTop = briefCard.createDiv({ cls: 'los-card-top' });
    briefTop.createDiv({ cls: 'los-project-brief-label', text: 'Research aim' });
    badge(briefTop, project.status || 'planned', project.status || 'planned');
    briefCard.createEl('p', {
      text: projectedExcerpt(project.objective, 1200)
        || 'No project objective has been recorded yet.',
    });
    const briefFacts = briefCard.createDiv({ cls: 'los-project-brief-facts' });
    for (const value of [
      project.project_type || 'Project',
      project.boundaries?.confidentiality,
      project.boundaries?.external_code_access,
    ].filter(Boolean)) {
      briefFacts.createSpan({ text: String(value) });
    }

    const work = section(root, 'Work areas');
    const units = (project.unit_ids || [])
      .map((id) => this.plugin.store.get(id))
      .filter(Boolean);

    if (!units.length) {
      empty(work, 'No work areas linked',
        'Project-owned Units will appear here without imposing a completion percentage.');
    } else {
      const list = work.createDiv({ cls: 'los-project-work-list' });
      for (const unit of units) {
        const row = button(list, unit.title || unit.id,
          () => this.plugin.openUnit(unit.id), 'row');
        row.addClass('los-project-work-area');
        row.createSpan({
          cls: 'los-project-work-area-meta',
          text: unit.scope || unit.kind || 'Project unit',
        });
        row.createSpan({ cls: 'los-route-open', text: 'Open →' });
      }
    }

    const connections = section(root, 'Project connections');
    const relationships = this.plugin.store.projectRelationships(project.id);
    const connectionFacts = [
      `${relationships.length} linked material${relationships.length === 1 ? '' : 's'}`,
      `${(project.linked_module_ids || []).length} linked module${(project.linked_module_ids || []).length === 1 ? '' : 's'}`,
      `${(project.files || []).length} file${(project.files || []).length === 1 ? '' : 's'}`,
    ];
    connections.createEl('p', {
      cls: 'los-project-connections',
      text: connectionFacts.join(' · '),
    });
  }

  renderStructure(root, project) {
    const structure = project.structure || { kind: 'none', nodes: [] };
    const wrap = section(root, 'Structure', `Structure mode: ${structure.kind || 'none'}.`);
    if (!Array.isArray(structure.nodes) || !structure.nodes.length) return empty(wrap, 'No fixed structure', 'This project currently has no linear or nested step map.');
    const tree = wrap.createDiv({ cls: 'los-project-structure' });
    const node = (parent, row, depth = 0) => {
      const item = parent.createDiv({ cls: `los-project-node los-project-node-depth-${Math.min(depth, 4)}` });
      const top = item.createDiv({ cls: 'los-card-top' }); top.createEl('h3', { text: row.title || row.id });
      if (row.status) badge(top, row.status, row.status);
      item.createDiv({ cls: 'los-micro', text: row.kind || 'step' });
      if (row.summary) item.createEl('p', { text: row.summary });
      const children = Array.isArray(row.children) ? row.children : [];
      if (children.length) {
        const nested = item.createDiv({ cls: 'los-project-node-children' });
        for (const child of children) node(nested, child, depth + 1);
      }
    };
    for (const row of structure.nodes) node(tree, row);
  }

  renderLinked(root, project) {
    const wrap = section(root, 'Linked Materials', 'Links retain a core-authored reason rather than implying ownership.');
    const relationships = this.plugin.store.projectRelationships(project.id);
    if (!relationships.length) return empty(wrap, 'No linked materials', 'Links appear here when the project relationship projection contains them.');
    for (const relationship of relationships) {
      const target = this.plugin.store.get(relationship.to_id);
      const row = wrap.createDiv({ cls: 'los-card los-project-link' });
      const copy = row.createDiv({ cls: 'los-project-link-copy' });
      copy.createEl('h3', { text: target?.title || relationship.to_id });
      copy.createDiv({ cls: 'los-micro', text: `${relationship.to_type || 'record'} · ${relationship.relation_type || 'linked'}` });
      const actions = row.createDiv({ cls: 'los-actions' });
      if (target) button(actions, 'Open', () => this.plugin.openRecord(target), 'tertiary');
      button(actions, 'Why linked', () => new ProjectLinkReasonModal(this.app, this.plugin, relationship).open(), 'quiet');
    }
  }

  renderFiles(root, project) {
    const wrap = section(root, 'Files', 'Project-owned references; canonical content remains in plain files.');
    const files = Array.isArray(project.files) ? project.files : [];
    if (!files.length) return empty(wrap, 'No files linked', 'Project files can be added through a declared core capability.');
    for (const file of files) {
      const row = wrap.createDiv({ cls: 'los-card los-project-file' });
      const copy = row.createDiv({ cls: 'los-project-link-copy' });
      copy.createEl('h3', { text: file.label || file.path });
      copy.createDiv({ cls: 'los-micro', text: `${file.kind || 'file'} · ${file.path}` });
      if (file.path) button(row, 'Open', () => this.plugin.openAuthoredPath(file.path), 'tertiary');
    }
  }

  renderDecisions(root, project) {
    const wrap = section(root, 'Decisions', 'Open questions and durable decisions, without manufacturing a completion score.');
    const decisions = Array.isArray(project.decisions) ? project.decisions : [];
    if (!decisions.length) return empty(wrap, 'No decisions recorded', 'Decisions appear here when the project records them.');
    for (const decision of decisions) {
      const row = wrap.createDiv({ cls: 'los-card los-project-decision' });
      const top = row.createDiv({ cls: 'los-card-top' }); top.createEl('h3', { text: decision.title });
      badge(top, decision.status || 'open', decision.status || 'open');
      row.createEl('p', { text: decision.summary || '' });
    }
  }
}
