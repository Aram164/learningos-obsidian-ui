import type { DesignScreens } from '../screens';
import { renderDeskAtlas } from './atlas';
import { renderDeskHome, renderDeskLearn } from './home';
import { renderDeskModuleDetail, renderDeskModuleList } from './modules';
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
  atlas: renderDeskAtlas,
};
