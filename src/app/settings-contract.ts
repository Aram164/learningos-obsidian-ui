import type { LearningOSUiDrafts } from '../application/draft-store';
import type { DEFAULT_SETTINGS } from '../constants';

/** Persisted plugin settings, including the UI's own working drafts. */
export type LearningOSSettings = typeof DEFAULT_SETTINGS & {
  uiDrafts: LearningOSUiDrafts;
};
