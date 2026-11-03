import type { DesignScreens } from '../screens';
import { renderFocusNav } from './nav';
import { renderFocusHome, renderFocusLearn } from './learning';
import { renderFocusModule, renderFocusModules } from './modules';
import { renderFocusUnit } from './unit';

/** Figma gVh0ebCrqHsxpyaDBX5pzf, refined page 149:92. Supporting views reuse the shared feature renderer. */
export const focusScreens: DesignScreens = {
  nav: renderFocusNav,
  home: renderFocusHome,
  learn: renderFocusLearn,
  moduleList: renderFocusModules,
  moduleDetail: renderFocusModule,
  unit: renderFocusUnit,
};
