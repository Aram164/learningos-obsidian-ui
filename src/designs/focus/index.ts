import type { DesignScreens } from '../screens';
import { renderFocusHome, renderFocusLearn } from './learning';
import { renderFocusModule, renderFocusModules } from './modules';
import { renderFocusNav } from './nav';
import { renderFocusUnit } from './unit';

/** Focus 2.0 (Figma p4Mpw78mLv8FxJAa6SPAEQ). Supporting views reuse shared feature renderers. */
export const focusScreens: DesignScreens = {
  nav: renderFocusNav,
  home: renderFocusHome,
  learn: renderFocusLearn,
  moduleList: renderFocusModules,
  moduleDetail: renderFocusModule,
  unit: renderFocusUnit,
  // Atlas is the shared list/inspector renderer in every design (P4 step 29):
  // no design-owned graph screen, so the base view draws it, restyled.
};
