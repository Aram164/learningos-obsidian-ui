/**
 * F5 · A module at a glance, for revision (Figma `67:10217`, decision D14).
 *
 * Read-only, in the Atlas: one row per lecture in course order, each lecture's
 * ideas left to right by `builds_on`, from `unit.knowledge_map`. Positions come
 * from the data alone (`layoutLectureMap`), so a place on the map stays where
 * it was. The ideas are not links: the map is for studying, and finding stays
 * in Search and the lists (D14). It draws the Atlas route's existing `module`
 * field; no route is new.
 */
import { plural } from '../../components';
import { renderAtlasVariants } from '../../features/atlas/domains';
import { layoutLectureMap } from '../../features/atlas/atlas-model';
import {
  mapProgressTag,
  moduleMap,
  moduleMapFacts,
  moduleMaps,
  mountIdeaLinks,
  type MapRow,
  type ModuleMap,
} from '../../features/atlas/module-map';
import type { AtlasHost } from '../../features/atlas/ports';
import { nonNull } from '../../features/module/model';
import type { AtlasScreenHost } from '../screens';
import { moduleLongTitle, moduleName, sideGroup, textLink, unitLabel } from './parts';

export { moduleMap, moduleMapFacts, moduleMaps, type MapRow, type ModuleMap };

/** Ids for lecture headings, unique across panes that draw the same module. */
let headings = 0;

/** The lecture a learner came from, to scroll to and mark. View state, never a route. */
const landing = new WeakMap<object, string>();

export function openModuleMap(host: AtlasHost, moduleId: string, unitId: string | null = null): void {
  if (unitId) landing.set(host, unitId);
  else landing.delete(host);
  host.go({ concept: null, module: moduleId, lens: 'prerequisites' });
}

export function leaveModuleMap(host: AtlasHost): void {
  landing.delete(host);
  Object.assign(host.concepts, { domain: null, subdomain: null, browseAll: false, recentsOnly: false });
  host.go({ concept: null, module: null, lens: 'prerequisites' });
}

/* ──────────────────────────────── drawing ──────────────────────────────── */

export function renderModuleMap(root: HTMLElement, host: AtlasScreenHost, map: ModuleMap): void {
  const { store, nav } = host.plugin;
  const module = store.get(map.moduleId);
  const short = moduleName(module);
  const head = root.createDiv({ cls: 'sd-title-row' });
  const copy = head.createDiv({ cls: 'sd-title-copy' });
  copy.createEl('h1', { cls: 'sd-title', text: moduleLongTitle(module) });
  copy.createDiv({ cls: 'sd-facts', text: `The module at a glance · ${plural(map.rows.length, 'lecture')} · ${map.ideas} ideas from your lecture maps` });
  renderAtlasVariants(head.createDiv({ cls: 'sd-title-tools' }), nav, 'concepts', (target) => host.go(target));

  const sheet = root.createDiv({ cls: 'sd-sheet sd-mm-sheet' });
  const title = sheet.createDiv({ cls: 'sd-mm-head' });
  title.createEl('h2', { cls: 'sd-mm-title', text: 'The module at a glance' });
  title.createSpan({ cls: 'sd-mm-subtitle', text: 'lectures top to bottom, in course order · ideas left to right: an arrow means “builds on”' });
  const guide = sheet.createDiv({ cls: 'sd-mm-guide' });
  for (const [label, text] of [
    ['How to read it', 'One row per lecture, in course order. Inside a row, an arrow means the idea on the right builds on the one on the left. Nothing moves between visits, so places stay familiar.'],
    ['Revise with it', 'Cover a row and say each idea in a sentence, then open the lecture to check. Start with the lectures you studied longest ago.'],
    ['Not drawn yet', 'Links between lectures. Your lecture maps link ideas inside one lecture only; concept pages show the Atlas’s links across lectures.'],
  ] as const) {
    const column = sideGroup(guide, label);
    column.createEl('p', { cls: 'sd-mm-note', text });
  }

  const here = landing.get(host) ?? null;
  let landed: HTMLElement | null = null;
  const lectures = sheet.createDiv({ cls: 'sd-mm-lectures' });
  const canvases: { canvas: HTMLElement; links: readonly { from: string; to: string }[] }[] = [];
  for (const [index, row] of map.rows.entries()) {
    const lecture = lectures.createDiv({ cls: `sd-mm-lecture${row.unit.id === here ? ' is-here' : ''}`, attr: { 'data-unit': row.unit.id } });
    if (row.unit.id === here) landed = lecture;
    const line = lecture.createDiv({ cls: 'sd-mm-lecture-head' });
    line.createSpan({ cls: 'sd-mm-number', text: (row.label.number ?? String(index + 1)).padStart(2, '0') });
    // Named by its heading, not an aria-label: Obsidian shows every aria-label as a hover tooltip.
    const heading = `sd-mm-lecture-${++headings}`;
    line.createEl('h3', { cls: 'sd-mm-lecture-title', text: row.label.title, attr: { id: heading } });
    const tag = mapProgressTag(store, row.unit.id);
    if (tag) line.createSpan({ cls: `sd-tag is-${tag.tone}`, text: tag.text });
    line.createSpan({ cls: 'sd-mat-flex' });
    textLink(line, 'Open lecture', () => nav.openUnit(row.unit.id)).addClass('sd-mm-open');
    if (row.unit.knowledgeSummary) {
      lecture.createDiv({ cls: 'sd-mm-summary', text: row.unit.knowledgeSummary, attr: { title: row.unit.knowledgeSummary } });
    }
    const layout = layoutLectureMap(row.ideas);
    const byId = new Map(row.ideas.map((idea) => [idea.id, idea]));
    const canvas = lecture.createDiv({ cls: 'sd-mm-ideas', attr: { role: 'group', 'aria-labelledby': heading } });
    for (const column of layout.columns) {
      const stack = canvas.createDiv({ cls: 'sd-mm-column', attr: { role: 'list' } });
      for (const id of column) {
        const idea = byId.get(id);
        if (!idea) continue;
        const node = stack.createDiv({ cls: 'sd-mm-idea', attr: { role: 'listitem', 'data-idea': id, title: idea.summary } });
        node.createSpan({ text: idea.title });
        const before = layout.links.filter((link) => link.to === id).map((link) => byId.get(link.from)?.title).filter(nonNull);
        if (before.length) node.createSpan({ cls: 'los-sr-only', text: `, builds on ${before.join(' and ')}` });
      }
    }
    canvases.push({ canvas, links: layout.links });
  }

  // What has no row is named, so nothing in the module is silently missing.
  if (map.examBlocks.length || map.unmapped.length) {
    const foot = sheet.createDiv({ cls: 'sd-mm-foot' });
    for (const unit of map.examBlocks) {
      const note = foot.createDiv({ cls: 'sd-mm-foot-line' });
      note.createSpan({ text: `${short} ${unitLabel(unit.record, module).place.replace(/^./, (first) => first.toLowerCase())} is an exam block, not a lecture, so it has no row here. ` });
      textLink(note, 'Open it', () => nav.openUnit(unit.id));
    }
    if (map.unmapped.length) {
      foot.createDiv({ cls: 'sd-mm-foot-line', text: `No idea map yet: ${map.unmapped.map((unit) => unitLabel(unit.record, module).place).join(', ')}.` });
    }
  }

  mountIdeaLinks(host, canvases, 'sd-mm');
  const target = landed as HTMLElement | null;
  if (target && typeof target.scrollIntoView === 'function') {
    root.ownerDocument?.defaultView?.requestAnimationFrame(() => target.scrollIntoView({ block: 'center' }));
  }
}
