import type { Plugin, WorkspaceLeaf } from 'obsidian';
import {
  LEGACY_VIEW_TYPES,
  VIEW_ATLAS,
  VIEW_BOUNDARY,
  VIEW_DIAGNOSTICS,
  VIEW_GARDEN,
  VIEW_HOME,
  VIEW_LIBRARY,
  VIEW_MODULE,
  VIEW_NAV,
  VIEW_PROGRAM,
  VIEW_PROJECT,
  VIEW_REVIEW,
  VIEW_SHELVING,
  VIEW_UNIT,
} from '../constants';
import type { AppSurface } from './surface';
import { LearningOSSettingsTab } from '../settings';
import { AtlasView } from '../views/atlas-view';
import { BoundaryView } from '../views/boundary-view';
import { GardenView } from '../views/garden-view';
import { HomeView } from '../views/home-view';
import { LibraryView } from '../views/library-view';
import { ModuleView } from '../views/module-view';
import { NavView } from '../views/nav-view';
import { ProgramView } from '../views/program-view';
import { ProjectView } from '../views/project-view';
import { DiagnosticsView, ReviewView } from '../views/review-view';
import { ShelvingView } from '../views/shelving-view';
import { UnitView } from '../views/unit-view';

export const APPLICATION_VIEW_TYPES = [
  VIEW_HOME,
  VIEW_NAV,
  VIEW_PROGRAM,
  VIEW_MODULE,
  VIEW_PROJECT,
  VIEW_UNIT,
  VIEW_LIBRARY,
  VIEW_ATLAS,
  VIEW_SHELVING,
  VIEW_BOUNDARY,
  VIEW_REVIEW,
  VIEW_GARDEN,
  VIEW_DIAGNOSTICS,
] as const;

type ApplicationPlugin = Plugin & AppSurface & {
  readonly activeNav: string;
};

export function detachLegacyViews(plugin: ApplicationPlugin): void {
  for (const type of LEGACY_VIEW_TYPES) plugin.app.workspace.detachLeavesOfType(type);
}

/** Register the Obsidian host surface; feature behavior remains in its module. */
export function registerApplication(plugin: ApplicationPlugin): void {
  detachLegacyViews(plugin);
  plugin.registerView(VIEW_HOME, (leaf: WorkspaceLeaf) => new HomeView(leaf, plugin));
  plugin.registerView(VIEW_NAV, (leaf: WorkspaceLeaf) => new NavView(leaf, plugin));
  plugin.registerView(VIEW_PROGRAM, (leaf: WorkspaceLeaf) => new ProgramView(leaf, plugin));
  plugin.registerView(VIEW_MODULE, (leaf: WorkspaceLeaf) => new ModuleView(leaf, plugin));
  plugin.registerView(VIEW_PROJECT, (leaf: WorkspaceLeaf) => new ProjectView(leaf, plugin));
  plugin.registerView(VIEW_UNIT, (leaf: WorkspaceLeaf) => new UnitView(leaf, plugin));
  plugin.registerView(VIEW_LIBRARY, (leaf: WorkspaceLeaf) => new LibraryView(leaf, plugin));
  plugin.registerView(VIEW_ATLAS, (leaf: WorkspaceLeaf) => new AtlasView(leaf, plugin));
  plugin.registerView(VIEW_SHELVING, (leaf: WorkspaceLeaf) => new ShelvingView(leaf, plugin));
  plugin.registerView(VIEW_BOUNDARY, (leaf: WorkspaceLeaf) => new BoundaryView(leaf, plugin));
  plugin.registerView(VIEW_REVIEW, (leaf: WorkspaceLeaf) => new ReviewView(leaf, plugin));
  plugin.registerView(VIEW_GARDEN, (leaf: WorkspaceLeaf) => new GardenView(leaf, plugin));
  plugin.registerView(VIEW_DIAGNOSTICS, (leaf: WorkspaceLeaf) => new DiagnosticsView(leaf, plugin));

  plugin.addSettingTab(new LearningOSSettingsTab(plugin.app, plugin));
  plugin.addRibbonIcon('route', 'Open LearningOS', () => plugin.nav.openHome());
  plugin.addCommand({ id: 'open-home', name: 'Open Home', callback: () => plugin.nav.openHome() });
  plugin.addCommand({ id: 'open-current-stage', name: 'Open current stage', callback: () => plugin.nav.openResume() });
  plugin.addCommand({ id: 'open-modules', name: 'Open Modules', callback: () => plugin.nav.openModules() });
  plugin.addCommand({ id: 'open-projects', name: 'Open Projects', callback: () => plugin.nav.openProjects() });
  plugin.addCommand({ id: 'open-library', name: 'Open Library', callback: () => plugin.nav.openLibrary() });
  plugin.addCommand({ id: 'open-global-search', name: 'Search LearningOS', callback: () => plugin.nav.openGlobalSearch() });
  plugin.addCommand({ id: 'open-atlas', name: 'Open Concept Atlas', callback: () => plugin.nav.openAtlas() });
  plugin.addCommand({ id: 'open-garden', name: 'Open Garden', callback: () => plugin.nav.openGarden() });
  plugin.addCommand({ id: 'open-review', name: 'Open Review', callback: () => plugin.nav.openReview() });
  // The live-app verification driver (scripts/check-live-app.mjs) needs a
  // stable command id to open Diagnostics from outside the app — otherwise
  // it can only ever prove Home works. Read-only: it navigates, nothing more.
  plugin.addCommand({ id: 'open-diagnostics', name: 'Open Diagnostics', callback: () => plugin.nav.openDiagnostics() });
  plugin.addCommand({ id: 'rebuild-projection', name: 'Validate and rebuild projection', callback: () => plugin.generate() });
  plugin.addCommand({ id: 'end-learning-session', name: 'End learning session safely', callback: () => plugin.reviewSessionEnd() });

  plugin.app.workspace.onLayoutReady(async () => {
    detachLegacyViews(plugin);
    await plugin.router.openNavigator();
    plugin.app.workspace.leftSplit?.setSize?.(280);
    if (plugin.settings.collapseSidebars) plugin.app.workspace.rightSplit?.collapse();
    if (plugin.settings.openHomeOnStartup) await plugin.router.restore();
  });
}

export function detachApplication(plugin: ApplicationPlugin): void {
  for (const type of APPLICATION_VIEW_TYPES) plugin.app.workspace.detachLeavesOfType(type);
}
