import { button } from '../../components';
import { todayItems } from '../../features/home/focus';
import { candidateModules, resolveResumeTarget } from '../../features/home/model';
import { currentWorkResource } from '../../features/stage-resources';
import type { ProjectionRecord } from '../../contracts/manifest';
import { asLabel, asString, asStrings, asText } from '../../projection/readers';
import type { HomeScreenHost } from '../screens';
import { setUnitMode } from './unit-mode';
import { deskHead, deskPage, deskRow, moduleName, moduleRow, sideGroup, stageBars, textLink, unitLabel } from './parts';
import { unitWork } from './study-work';

function start(view: HomeScreenHost, unitId: string, stageId: string) {
  return view.plugin.nav.openUnit(unitId, stageId, (leaf) => setUnitMode(leaf, unitId, 'session'));
}

export function renderDeskHome(view: HomeScreenHost): void {
  const { plugin: { nav, store } } = view;
  const root = deskPage(view.contentEl, 'home', store);
  deskHead(root, [{ label: 'Home' }], view);
  root.createEl('h1', { cls: 'sd-title', text: new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date()) });

  const layout = root.createDiv({ cls: 'sd-home-columns' });
  const main = layout.createDiv({ cls: 'sd-home-main' });
  const side = layout.createDiv({ cls: 'sd-side sd-home-side' });
  const academic = store.openAcademicModules().filter((module) => module.is_actionable === true);
  const byId = new Map(academic.map((module) => [module.id, module]));
  const plans = store.of('workspace').flatMap((record) => {
    const action = asText(record.next_action);
    const module = asStrings(record.module_ids).map((id) => byId.get(id)).find((row) => row !== undefined);
    return action && module && record.is_open === true ? [{ record, module, action }] : [];
  });
  const resume = resolveResumeTarget(store);
  const resumeId = resume.unit ? asString(resume.unit.id) : null;
  const resumeStageId = resume.stage ? asString(resume.stage.id) : null;
  const work = resumeId ? unitWork(store, resumeId) : null;
  const stage = work?.map.stages.find((row) => row.id === resumeStageId);
  let resumed = false;
  let focusModule: ProjectionRecord | null = null;
  if (resumeId && resume.unit && work && stage) {
    resumed = true;
    focusModule = resume.module;
    const position = work.map.stages.indexOf(stage);
    const hero = main.createDiv({ cls: 'sd-hero' });
    const copy = hero.createDiv({ cls: 'sd-hero-copy' });
    copy.createDiv({ cls: 'sd-hero-kicker', text: 'Continue where you stopped' });
    copy.createEl('h2', { cls: 'sd-hero-title', text: stage.title });
    copy.createDiv({ cls: 'sd-hero-facts', text: [resume.module && moduleName(resume.module), unitLabel(resume.unit, resume.module).place, `Stage ${position + 1} of ${work.map.stages.length}`].filter(Boolean).join(' · ') });
    stageBars(copy, work.map.stages.length, work.done, position);
    const action = hero.createDiv({ cls: 'sd-hero-action' });
    button(action, 'Continue studying', () => start(view, resumeId, stage.id), 'choice').addClass('sd-hero-button');
    const material = currentWorkResource(stage.resources);
    if (material) action.createDiv({ cls: 'sd-hero-note', text: `Starts with ${material.label}` });
  }

  // The module list is the same neutral list on both paths: the candidate pool
  // under the pinned ordering. With a session to continue it reads as the
  // places around the resume target; without one it is the browse entry.
  const pool = candidateModules(store);
  const courses = pool.filter((module) => module !== focusModule);
  main.createEl('h2', { cls: 'sd-heading', text: resumed ? 'Continue elsewhere' : 'Modules' });
  const list = main.createDiv({ cls: 'sd-sheet sd-home-list' });
  if (courses.length) {
    for (const module of courses.slice(0, 5)) moduleRow(list, store, module, () => nav.openModule(asString(module.id) ?? ''));
    if (courses.length > 5) textLink(list, 'Browse all modules', () => nav.openModules());
  } else {
    list.createEl('p', { cls: 'sd-quiet', text: 'No open module work.' });
    textLink(list, 'Browse modules', () => nav.openModules());
  }

  // Plans are shown for themselves, verbatim, under their own label — never
  // promoted into a suggestion or used to order anything above.
  const others = plans.slice(0, 3);
  if (others.length) {
    main.createEl('h2', { cls: 'sd-heading', text: 'Plans suggest' });
    const sheet = main.createDiv({ cls: 'sd-sheet sd-home-list' });
    for (const { action, record, module } of others) {
      const row = deskRow(sheet, 'sd-today-row', action, () => nav.openModule(asString(module.id) ?? ''));
      const copy = row.createDiv({ cls: 'sd-row-copy' });
      copy.createEl('strong', { text: action });
      copy.createDiv({ cls: 'sd-row-facts', text: asLabel(record) });
    }
  }

  // A unit the producer says still owes a study map is browsing material, not
  // an eligible study choice. It gets its own category so it never masquerades
  // as a candidate, and the UI infers no stage for it.
  const needsMap = store.units().filter((unit) => unit.needs_study_map === true);
  if (needsMap.length) {
    const group = sideGroup(side, 'Needs a study map');
    for (const unit of needsMap.slice(0, 5)) {
      const module = store.get(asString(unit.module_id) ?? '');
      textLink(group, unitLabel(unit, module).title, () => nav.openUnit(asString(unit.id) ?? ''));
    }
    if (needsMap.length > 5) {
      group.createEl('p', { cls: 'sd-note', text: `${needsMap.length - 5} more units still need a map.` });
    }
  }

  const upcoming = sideGroup(side, 'Coming up');
  const today = todayItems(view);
  const dates = today.filter((item) => item.actionLabel !== 'Open review');
  if (!dates.length) upcoming.createEl('p', { cls: 'sd-note', text: 'No dates ahead.' });
  for (const item of dates) {
    if (item.action) textLink(upcoming, item.title, item.action);
    else upcoming.createSpan({ text: item.title });
    upcoming.createDiv({ cls: 'sd-row-facts', text: item.detail });
  }
  const waiting = today.find((item) => item.actionLabel === 'Open review');
  if (waiting?.action) {
    const group = sideGroup(side, 'Waiting for you');
    textLink(group, waiting.title, waiting.action);
    group.createEl('p', { cls: 'sd-note', text: waiting.detail });
  }
}
