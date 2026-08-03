export class NavView extends ItemView {
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; }
  getViewType() { return VIEW_NAV; }
  getDisplayText() { return 'LearningOS · Navigator'; }
  getIcon() { return 'route'; }
  async onOpen() { this.render(); }

  nav(parent, iconName, label, action) {
    const row = parent.createEl('button', { cls: 'los-app-nav-item is-clickable', attr: { type: 'button' } });
    icon(row.createSpan(), iconName); row.createSpan({ text: label }); row.addEventListener('click', action);
  }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-app-nav');
    const brand = root.createDiv({ cls: 'los-nav-brand' });
    icon(brand.createSpan({ cls: 'los-brand-mark' }), 'route'); brand.createEl('strong', { text: 'LearningOS' });
    this.nav(root, 'home', 'Home', () => this.plugin.openHome());
    root.createDiv({ cls: 'los-nav-label', text: 'Areas' });
    this.nav(root, 'graduation-cap', 'Bachelor’s', () => this.plugin.openProgram('program-bachelors'));
    this.nav(root, 'wrench', 'Skills', () => this.plugin.openProgram('program-skills'));
    this.nav(root, 'flask-conical', 'Thesis & projects', () => this.plugin.openProgram('program-thesis-projects'));
    root.createDiv({ cls: 'los-nav-label', text: 'Workflow' });
    this.nav(root, 'archive-restore', 'Shelving', () => this.plugin.openShelving());
    this.nav(root, 'library', 'Library', () => this.plugin.openLibrary());
    this.nav(root, 'sprout', 'Garden', () => this.plugin.openVaultPath('bases/garden.base'));
    this.nav(root, 'map', 'Domain atlas', () => this.plugin.openAtlas());
    this.nav(root, 'inbox', 'Inbox', () => this.plugin.openProgram('inbox'));
    root.createDiv({ cls: 'los-nav-label', text: 'Boundaries' });
    this.nav(root, 'shield', 'Master’s', () => this.plugin.openBoundary('program-masters-planning'));
    this.nav(root, 'shield-alert', 'Job', () => this.plugin.openBoundary('program-job-boundary'));
    const foot = root.createDiv({ cls: 'los-nav-foot' });
    button(foot, 'Rebuild projection', () => this.plugin.generate(), 'quiet');
  }
}
