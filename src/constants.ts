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
export const VIEW_REVIEW = 'learningos-review';
export const VIEW_GARDEN = 'learningos-garden';
export const VIEW_DIAGNOSTICS = 'learningos-diagnostics';

/**
 * The five permanent destinations. Areas became sub-areas of Learn and the
 * decision queues became Review, so the sidebar stops presenting the whole
 * system before the learner has done anything. Everything else lives in More.
 */
export const LEARN_AREAS = [
  ['program-bachelors', 'Bachelor’s'],
  ['program-skills', 'Skills'],
  ['program-thesis-projects', 'Thesis & projects'],
];
export const LEGACY_VIEW_TYPES = [
  'learningos-dashboard', 'learningos-explorer', 'learningos-learning-path',
  'learningos-shelve-review', 'learningos-job-boundary',
];

export const DEFAULT_SETTINGS = {
  openHomeOnStartup: true,
  pinHome: true,
  collapseSidebars: true,
  showAiRecommendation: true,
  navMoreOpen: false,
  learnArea: 'program-bachelors',
  pythonPath: '',
  preferredAiProvider: 'manual-bundle',
};

/** Protocols an interface layer may hand to a viewer. Everything else — and
 *  above all `javascript:`, `data:` and `file:` — is refused before it can
 *  reach Electron. */
export const SAFE_URL_PROTOCOLS = ['https:', 'http:'];

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
