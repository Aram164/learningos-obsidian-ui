export class ProgramView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; this.programId = null; }
  getViewType() { return VIEW_PROGRAM; }
  getDisplayText() { return 'LearningOS · Area'; }
  async setState(state) { this.programId = state?.programId || this.programId; this.render(); }
  getState() { return { programId: this.programId }; }
  async onOpen() { this.programId = this.leaf.state?.programId || this.programId; this.render(); }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-program-view');
    if (this.programId === 'queue-needs-map') return this.renderNeedsMap(root);
    if (this.programId === 'inbox') return this.renderInbox(root);
    const program = this.plugin.store.get(this.programId);
    if (!program) { empty(root, 'Area unavailable', 'Return Home and choose another area.'); return; }
    pageHeader(root, 'Program / area', program.title, program.description || '');
    if (program.semester_bound) {
      const semesters = section(root, 'Semesters');
      for (const semester of program.semesters || []) {
        const row = semesters.createDiv({ cls: 'los-row' });
        row.createEl('strong', { text: semester.title }); badge(row, semester.status, semester.status);
      }
      empty(semesters, 'Past semesters remain visible', 'Archived semesters appear here after the turn-semester workflow.');
    }
    const modules = section(root, 'Modules');
    const grid = modules.createDiv({ cls: 'los-card-grid' });
    for (const module of this.plugin.store.modulesFor(program.id)) moduleCard(grid, this.plugin, module);
    viewFooter(root);
  }

  renderNeedsMap(root) {
    pageHeader(root, 'Queue', 'Units needing a study map');
    const grid = root.createDiv({ cls: 'los-card-grid' });
    for (const unit of this.plugin.store.units().filter((row) => row.status === 'needs-map')) {
      unitCard(grid, this.plugin, unit);
    }
    viewFooter(root);
  }

  renderInbox(root) {
    pageHeader(root, 'Capture', 'Inbox', 'You capture; the operator files.');
    const count = this.plugin.store.data.counts?.inbox_items || 0;
    const wrap = section(root, `${count} item${count === 1 ? '' : 's'} awaiting routing`);
    empty(wrap, 'No filing decision is required here', 'Use the capture command or drop material into work/inbox/.');
    viewFooter(root);
  }
}
