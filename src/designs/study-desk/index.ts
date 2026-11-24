import type { DesignScreens } from '../screens';
import { renderDeskHome } from './home';
import { renderDeskLearn, renderDeskModuleDetail, renderDeskModuleList } from './modules';
import { renderDeskNav } from './nav';
import { renderDeskUnit } from './unit';

/** Figma file OYWzCiANiWjVWwwu5GTYrz. What is not listed here is restyled, not redrawn. */
export const studyDeskScreens: DesignScreens = {
  nav: renderDeskNav,
  home: renderDeskHome,
  learn: renderDeskLearn,
  moduleList: renderDeskModuleList,
  moduleDetail: renderDeskModuleDetail,
  unit: renderDeskUnit,
  // Atlas is the shared list/inspector renderer in every design (P4 step 29):
  // no design-owned graph screen, so the base view draws it, restyled.
};
