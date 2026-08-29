export { MANIFEST_CONTRACT_VERSION as CONTRACT_VERSION } from './contracts/manifest';
export const VIEW_HOME = 'learningos-home';
export const VIEW_NAV = 'learningos-nav';
export const VIEW_PROGRAM = 'learningos-program';
export const VIEW_MODULE = 'learningos-module';
export const VIEW_PROJECT = 'learningos-project';
export const VIEW_UNIT = 'learningos-unit';
export const VIEW_LIBRARY = 'learningos-library';
export const VIEW_ATLAS = 'learningos-atlas';
export const VIEW_SHELVING = 'learningos-shelving';
export const VIEW_BOUNDARY = 'learningos-boundary';
export const VIEW_REVIEW = 'learningos-review';
export const VIEW_GARDEN = 'learningos-garden';
export const VIEW_DIAGNOSTICS = 'learningos-diagnostics';

/**
 * The six permanent destinations. Areas became sub-areas of Learn and the
 * decision queues became Review, so the sidebar stops presenting the whole
 * system before the learner has done anything. Everything else lives in More.
 */
/* `as const` so the first area is a known-present literal: several call sites
 * fall back to LEARN_AREAS[0][0] as the default area. */
export const LEARN_AREAS = [
  ['program-bachelors', 'Bachelor’s'],
  ['program-skills', 'Skills'],
  ['program-job', 'Job'],
  ['program-thesis-projects', 'Thesis & projects'],
] as const;
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
  /**
   * One unresolved Gateway V2 write, or null. Deliberately `unknown`: a value
   * that fails validation must reach Diagnostics exactly as it was written
   * rather than be narrowed — or worse, normalised away — on the way in.
   */
  gatewayRecovery: null as unknown,
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
  program: 'graduation-cap', module: 'book-open', project: 'briefcase-business', unit: 'layers-3',
  'study-map': 'route', stage: 'list-checks', note: 'file-text',
  concept: 'network', source: 'library', workspace: 'briefcase-business',
  boundary: 'shield', skills: 'wrench', projects: 'flask-conical',
  collection: 'library-big', 'topic-pack': 'notebook-tabs', atlas: 'map',
};
