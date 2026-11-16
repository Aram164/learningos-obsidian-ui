import { button } from '../../components';
import { todayItems } from '../../features/home/focus';
import { resolveResumeTarget } from '../../features/home/model';
import { currentWorkResource } from '../../features/stage-resources';
import type { ProjectionRecord } from '../../contracts/manifest';
import { asLabel, asString, asStrings, asText } from '../../projection/readers';
import type { HomeScreenHost } from '../screens';
import { setUnitMode } from './unit-mode';
import { deskHead, deskPage, deskRow, moduleName, moduleRow, sideGroup, stageBars, textLink, unitLabel } from './parts';
import { currentSemesterKey, moduleWork, unitWork } from './study-work';

function start(view: HomeScreenHost, unitId: string, stageId: string) {
  return view.plugin.nav.openUnit(unitId, stageId, (leaf) => setUnitMode(leaf, unitId, 'session'));
}

export function renderDeskHome(view: HomeScreenHost): void {
  const { plugin: { nav, store } } = view;
  const root = deskPage(view.contentEl, 'home', store);
  deskHead(root, [{ label: 'Home' }], view);
  const semester = store.currentSemester();
  root.createEl('h1', { cls: 'sd-title', text: new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date()) });
  if (semester) root.createDiv({ cls: 'sd-facts', text: asLabel(semester) });

  const layout = root.createDiv({ cls: 'sd-home-columns' });
  const main = layout.createDiv({ cls: 'sd-home-main' });
  const side = layout.createDiv({ cls: 'sd-side sd-home-side' });
  const academic = store.openAcademicModules().filter((module) => module.is_actionable === true);
  const current = currentSemesterKey(store);
  const thisSemester = current ? academic.filter((module) => module.semester === current) : [];
  const byId = new Map(academic.map((module) => [module.id, module]));
  const plans = store.of('workspace').flatMap((record) => {
    const action = asText(record.next_action);
    const module = asStrings(record.module_ids).map((id) => byId.get(id)).find((row) => row !== undefined);
    return action && module && record.archived !== true && record.status !== 'complete' ? [{ record, module, action }] : [];
  });
  const resume = resolveResumeTarget(store);
  const resumeId = resume.unit ? asString(resume.unit.id) : null;
  const resumeStageId = resume.stage ? asString(resume.stage.id) : null;
  const work = resumeId ? unitWork(store, resumeId) : null;
  const stage = work?.map.stages.find((row) => row.id === resumeStageId);
  let shownPlan: ProjectionRecord | null = null;
  let focusModule: ProjectionRecord | null = null;
  if (resumeId && resume.unit && work && stage) {
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
  } else {
    const candidates = [...thisSemester, ...academic.filter((module) => !thisSemester.includes(module))];
    const ready = candidates.flatMap((module) => {
      const moduleId = asString(module.id);
      const next = moduleId ? moduleWork(store, moduleId) : null;
      const unitId = asString(next?.unit.id);
      if (!next?.stage || !unitId) return [];
      const plan = plans.find(({ module: owner, record }) => {
        const units = asStrings(record.unit_ids);
        return owner === module && units.includes(unitId);
      });
      return [{ module, next, unitId, stage: next.stage, plan }];
    });
    const suggestion = ready.find(({ module, plan }) => thisSemester.includes(module) && plan)
      ?? ready.find(({ module }) => thisSemester.includes(module))
      ?? ready.find(({ plan }) => plan) ?? ready[0];
    const hero = main.createDiv({ cls: 'sd-hero is-empty sd-home-suggestion' });
    const copy = hero.createDiv({ cls: 'sd-hero-copy' });
    if (suggestion) {
      const { module, next, unitId, stage: nextStage } = suggestion;
      focusModule = module;
      // The workspace association above only ordered the candidates. The
      // action below opens this stage, so its copy comes from the study
      // map; the workspace's recorded instruction is listed with the
      // other plans, verbatim, under its own label.
      const place = unitLabel(next.unit, module);
      copy.createDiv({ cls: 'sd-hero-kicker', text: `Suggested from the ${moduleName(module)} study map` });
      copy.createEl('h2', { cls: 'sd-hero-title', text: place.number ? `${place.place} · ${place.title}` : place.title });
      copy.createEl('p', { cls: 'sd-note sd-suggest-action', text: nextStage.objective || nextStage.title });
      const actions = copy.createDiv({ cls: 'sd-home-actions' });
      button(actions, `Start stage ${next.position}`, () => start(view, unitId, nextStage.id), 'cta');
      textLink(actions, 'See the lecture plan', () => nav.openUnit(unitId, nextStage.id, (leaf) => setUnitMode(leaf, unitId, 'plan')));
    } else if (plans[0] && plans[0].module.id) {
      const { module, record, action } = plans[0];
      focusModule = module;
      shownPlan = record;
      copy.createDiv({ cls: 'sd-hero-kicker', text: `Suggested by your ${moduleName(module)} plan` });
      copy.createEl('h2', { cls: 'sd-hero-title', text: asLabel(record) });
      copy.createEl('p', { cls: 'sd-note sd-suggest-action', text: action });
      button(copy.createDiv({ cls: 'sd-home-actions' }), 'Open module', () => nav.openModule(asString(module.id) ?? ''), 'cta');
    } else {
      copy.createEl('h2', { cls: 'sd-hero-title', text: 'No study session to resume' });
      textLink(copy, 'Browse modules', () => nav.openModules());
    }
  }

  const others = plans.filter(({ record }) => record !== shownPlan).slice(0, 3);
  if (others.length) {
    main.createEl('h2', { cls: 'sd-heading', text: 'Plans suggest' });
    const list = main.createDiv({ cls: 'sd-sheet sd-home-list' });
    for (const { action, record, module } of others) {
      const row = deskRow(list, 'sd-today-row', action, () => nav.openModule(asString(module.id) ?? ''));
      const copy = row.createDiv({ cls: 'sd-row-copy' });
      copy.createEl('strong', { text: action });
      copy.createDiv({ cls: 'sd-row-facts', text: asLabel(record) });
    }
  }

  const courses = (thisSemester.length ? thisSemester : academic.filter((module) => module !== focusModule)).slice(0, 5);
  if (courses.length) {
    main.createEl('h2', { cls: 'sd-heading', text: thisSemester.length ? 'This semester' : 'Continue elsewhere' });
    const list = main.createDiv({ cls: 'sd-sheet sd-home-list' });
    for (const module of courses) moduleRow(list, store, module, () => nav.openModule(asString(module.id) ?? ''));
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
