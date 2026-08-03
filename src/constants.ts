export const CONTRACT_VERSION = 2;
export const VIEW_HOME = 'learningos-home';
export const VIEW_NAV = 'learningos-nav';
export const VIEW_PROGRAM = 'learningos-program';
export const VIEW_MODULE = 'learningos-module';
export const VIEW_UNIT = 'learningos-unit';
export const VIEW_LIBRARY = 'learningos-library';
export const VIEW_ATLAS = 'learningos-atlas';
export const VIEW_SHELVING = 'learningos-shelving';
export const VIEW_BOUNDARY = 'learningos-boundary';
export const LEGACY_VIEW_TYPES = [
  'learningos-dashboard', 'learningos-explorer', 'learningos-learning-path',
  'learningos-shelve-review', 'learningos-job-boundary',
];

export const DEFAULT_SETTINGS = {
  openHomeOnStartup: true,
  pinHome: true,
  collapseSidebars: true,
  showAiRecommendation: true,
};

export const STATUS_ORDER = [
  'active', 'ready', 'not-started', 'needs-map', 'paused',
  'ready-to-shelve', 'complete',
];

export const ICONS = {
  program: 'graduation-cap', module: 'book-open', unit: 'layers-3',
  'study-map': 'route', stage: 'list-checks', note: 'file-text',
  concept: 'network', source: 'library', workspace: 'briefcase-business',
  boundary: 'shield', skills: 'wrench', projects: 'flask-conical',
  collection: 'library-big', atlas: 'map',
};
