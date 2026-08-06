import { ItemView } from 'obsidian';
import { button, empty, icon } from '../components';
import { VIEW_NAV } from '../constants';

/**
 * Seven permanent destinations, nothing else. Areas (Bachelor's / Skills /
 * Thesis) are sub-areas of Learn; the decision queues (Shelving / Garden /
 * Inbox) are Review; atlas, boundaries, diagnostics and maintenance live under
 * More. The sidebar's job is to make the next step obvious, not to prove the
 * system is large.
 */
export class NavView extends ItemView {
  [key: string]: any;
  constructor(leaf, plugin) { super(leaf); this.plugin = plugin; }
  getViewType() { return VIEW_NAV; }
  getDisplayText() { return 'LearningOS · Navigator'; }
  getIcon() { return 'route'; }
  async onOpen() { this.render(); }

  nav(parent, iconName, label, key, action) {
    const active = this.plugin.activeNav === key;
    const row = parent.createEl('button', {
      cls: `los-app-nav-item is-clickable${active ? ' is-active' : ''}`,
      attr: { type: 'button', 'aria-current': active ? 'page' : 'false' },
    });
    icon(row.createSpan(), iconName);
    row.createSpan({ text: label });
    row.addEventListener('click', action);
    return row;
  }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-app-nav');
    const brand = root.createDiv({ cls: 'los-nav-brand' });
    icon(brand.createSpan({ cls: 'los-brand-mark' }), 'route');
    brand.createEl('strong', { text: 'LearningOS' });
    const search = brand.createEl('button', {
      cls: 'los-nav-search is-clickable',
      attr: { type: 'button', 'aria-label': 'Search LearningOS', title: 'Search LearningOS' },
    });
    icon(search.createSpan(), 'search');
    search.addEventListener('click', () => this.plugin.openGlobalSearch());

    const primary = root.createDiv({ cls: 'los-nav-primary' });
    this.nav(primary, 'home', 'Home', 'home', () => this.plugin.openHome());
    this.nav(primary, 'layout-grid', 'Modules', 'modules', () => this.plugin.openModules());
    this.nav(primary, 'graduation-cap', 'Learn', 'learn', () => this.plugin.openLearn());
    this.nav(primary, 'briefcase-business', 'Projects', 'projects', () => this.plugin.openProjects());
    this.nav(primary, 'library', 'Library', 'library', () => this.plugin.openLibrary());
    this.nav(primary, 'sprout', 'Garden', 'garden', () => this.plugin.openGarden());
    this.nav(primary, 'check-check', 'Review', 'review', () => this.plugin.openReview());

    const more = root.createEl('details', { cls: 'los-nav-more' });
    if (this.plugin.settings.navMoreOpen) more.setAttr('open', 'open');
    more.createEl('summary', { cls: 'los-nav-more-trigger', text: 'More' });
    more.addEventListener('toggle', () => {
      this.plugin.settings.navMoreOpen = Boolean(more.open ?? more.attrs?.open);
      this.plugin.scheduleDraftSave();
    });
    const secondary = more.createDiv({ cls: 'los-nav-secondary' });
    this.nav(secondary, 'plus', 'Capture', 'capture', () => this.plugin.openCapture());
    this.nav(secondary, 'map', 'Domain atlas', 'atlas', () => this.plugin.openAtlas());
    this.nav(secondary, 'shield', 'Master’s boundary', 'masters',
      () => this.plugin.openBoundary('program-masters-planning'));
    this.nav(secondary, 'shield-alert', 'Job boundary', 'job',
      () => this.plugin.openBoundary('program-job-boundary'));
    this.nav(secondary, 'activity', 'Diagnostics', 'diagnostics', () => this.plugin.openDiagnostics());
    this.nav(secondary, 'refresh-cw', 'Rebuild projection', 'rebuild', () => this.plugin.generate());
  }
}
