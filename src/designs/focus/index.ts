import type { DesignScreens } from '../screens';
import { renderFocusAtlas } from './atlas';
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
  atlas: renderFocusAtlas,
};
