/**
 * The pieces every Study Desk screen is built from (Figma frame 15, "The rules
 * every screen follows"): a breadcrumb head, Literata titles, whole-row targets,
 * one spine colour per module, and one filled action per view.
 */
import { button, icon, manifestFreshness } from '../../components';
import type { ProjectionRecord } from '../../contracts/manifest';
import type { ManifestStore } from '../../manifest-store';
import { readResumePointer } from '../../features/home/model';
import { semesterLabel } from '../../features/module/logistics';
import { asLabel, asRecords, asString } from '../../projection/readers';

export type Cover = 'wine' | 'teal' | 'ochre' | 'moss' | 'slate' | 'plum' | 'stone';

/** Start a page. Classes from another design's last draw stay inert: every rule is scoped. */
export function deskPage(root: HTMLElement, name: string, store: Pick<ManifestStore, 'stale' | 'error'>): HTMLElement {
  root.empty();
  manifestFreshness(root, store);
  root.addClass('los-root', 'sd-page', `sd-${name}`);
  return root;
}

export interface Crumb {
  readonly label: string;
  readonly go?: () => unknown;
}

/** The toolbar line: where you are on the left, at most a couple of plain actions on the right. */
export function deskHead(parent: HTMLElement, crumbs: readonly Crumb[]): HTMLElement {
  const bar = parent.createDiv({ cls: 'sd-toolbar' });
  const trail = bar.createEl('nav', { cls: 'sd-crumbs', attr: { 'aria-label': 'Location' } });
  crumbs.forEach((crumb, index) => {
    if (index) icon(trail.createSpan({ cls: 'sd-crumb-sep' }), 'chevron-right');
    const last = index === crumbs.length - 1;
    if (crumb.go && !last) {
      trail.createEl('button', { cls: 'sd-crumb is-clickable', text: crumb.label, attr: { type: 'button' } })
        .addEventListener('click', () => crumb.go?.());
    } else {
      trail.createSpan({ cls: `sd-crumb${last ? ' is-current' : ''}`, text: crumb.label });
    }
  });
  return bar.createDiv({ cls: 'sd-toolbar-actions' });
}

/** A native button that is the whole row, as on every list in this design. */
export function deskRow(
  parent: HTMLElement,
  cls: string,
  label: string,
  open: () => unknown,
): HTMLButtonElement {
  const row = parent.createEl('button', {
    cls: `sd-row is-clickable ${cls}`.trim(),
    attr: { type: 'button', 'aria-label': label },
  });
  row.addEventListener('click', () => open());
  return row;
}

export function chevron(parent: HTMLElement, name = 'chevron-right'): HTMLElement {
  return icon(parent.createSpan({ cls: 'sd-chevron' }), name);
}

/** A segmented bar that says how far along something is. Words beside it repeat the state. */
export function stageBars(parent: HTMLElement, total: number, done: number, current: number | null = null): HTMLElement {
  const bars = parent.createDiv({ cls: 'sd-bars', attr: { 'aria-hidden': 'true' } });
  for (let index = 0; index < total; index += 1) {
    const state = index === current ? 'is-current' : index < done ? 'is-done' : '';
    bars.createSpan({ cls: `sd-bar ${state}`.trim() });
  }
  return bars;
}

/**
 * One spine colour per module, everywhere it appears.
 *
 * Presentation only: nothing in Core assigns these and nothing reads them back.
 * The four enrolled modules keep the colours the design gave them; anything else
 * follows its area, and a new academic module gets a stable one from its id.
 */
const NAMED_COVERS: Readonly<Record<string, Cover>> = {
  'module-hu-aml': 'wine',
  'module-hu-m2-statistik-analysis': 'teal',
  'module-hu-betriebssysteme': 'ochre',
  'module-hu-icop': 'moss',
};
const ACADEMIC_COVERS: readonly Cover[] = ['wine', 'teal', 'ochre', 'moss'];

export function coverOf(module: ProjectionRecord | null | undefined): Cover {
  const id = asString(module?.id) ?? '';
  const named = NAMED_COVERS[id];
  if (named) return named;
  if (id.startsWith('module-project-') || id.startsWith('module-foundation-')) return 'plum';
  const area = asString(module?.area_id);
  if (area === 'program-job' || area === 'program-skills') return 'slate';
  const hash = [...id].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
  return ACADEMIC_COVERS[hash % ACADEMIC_COVERS.length] ?? 'wine';
}

/** "AML" from "Angewandtes Maschinelles Lernen (AML)", else the code, else initials. */
export function moduleShort(module: ProjectionRecord | null | undefined): string {
  const title = asLabel(module);
  const bracket = /\(([^)]{2,10})\)\s*$/.exec(title)?.[1];
  if (bracket) return bracket;
  const code = asString(module?.code);
  if (code) return code;
  return title.split(/\s+/).filter((word) => /^[A-ZÄÖÜ]/.test(word)).map((word) => word[0]).join('').slice(0, 4) || title.slice(0, 3);
}

/** "AML", or the whole title when the module has no short name of its own: initials would not say which module. */
export function moduleName(module: ProjectionRecord | null | undefined): string {
  const authored = /\(([^)]{2,10})\)\s*$/.test(asLabel(module)) || Boolean(asString(module?.code));
  return authored ? moduleShort(module) : moduleLongTitle(module);
}

/** The title without its module prefix, since the row already sits inside that module. */
export function moduleLongTitle(module: ProjectionRecord | null | undefined): string {
  return asLabel(module).replace(/\s*\([^)]{2,10}\)\s*$/, '');
}

export interface UnitLabel {
  /** "02" for a lecture, null for anything else. */
  readonly number: string | null;
  /** "Lecture 02" for a lecture, else the short title. */
  readonly place: string;
  readonly title: string;
}

/** Split "AML Lecture 02 — k-Nearest Neighbors" into what a row and a breadcrumb need. */
export function unitLabel(unit: ProjectionRecord | null | undefined, module?: ProjectionRecord | null): UnitLabel {
  const title = asLabel(unit);
  const lecture = /(?:^|\s)(Lecture|Vorlesung|VL|Chapter|Week)\s+(\d+)\s*[—–:-]\s*(.+)$/i.exec(title);
  if (lecture?.[1] && lecture[2] && lecture[3]) {
    return { number: lecture[2], place: `${lecture[1]} ${lecture[2]}`, title: lecture[3] };
  }
  const short = module ? moduleShort(module) : '';
  const bare = short && title.startsWith(`${short} `) ? title.slice(short.length + 1) : title;
  const cased = bare.charAt(0).toUpperCase() + bare.slice(1);
  return { number: null, place: cased.split(/\s*[—–:]\s*/)[0] ?? cased, title: cased };
}

/** Semester or area, then how many units: the line under every module title. */
export function moduleFacts(store: Pick<ManifestStore, 'progress'>, module: ProjectionRecord): string {
  const semester = asString(module.semester);
  const area = asString(module.area_id);
  const place = semester ? shortSemester(semester)
    : area === 'program-job' ? 'Job'
      : area === 'program-skills' ? 'Skills'
        : asString(module.kind) === 'project' ? 'Thesis & projects' : '';
  const units = store.progress(asString(module.id) ?? '').units_total;
  return [place, units ? `${units} unit${units === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ');
}

function shortSemester(value: string): string {
  return semesterLabel(value).replace('Summer semester', 'SoSe').replace('Winter semester', 'WiSe');
}

/** How far along, in words, from the same counts Core publishes. Never a judgement. */
export function moduleState(store: Pick<ManifestStore, 'progress' | 'get' | 'stage' | 'data'>, module: ProjectionRecord): string {
  const id = asString(module.id) ?? '';
  const pointer = readResumePointer(store.data?.resume_pointer);
  if (pointer.module_id === id && pointer.unit_id && pointer.stage_id) {
    const unit = store.get(pointer.unit_id);
    const map = pointer.study_map_id ? store.get(pointer.study_map_id) : null;
    const position = asRecords(map?.stages).findIndex((row) => row.id === pointer.stage_id);
    return `${unitLabel(unit, module).place}${position >= 0 ? `, stage ${position + 1}` : ''}`;
  }
  const progress = store.progress(id);
  if (progress.stages_total && progress.stages_complete === progress.stages_total) return 'Done';
  if (progress.stages_complete) return `${progress.stages_complete} of ${progress.stages_total} stages`;
  return progress.stages_total ? 'Not started' : 'No study plan yet';
}

export function moduleRow(
  parent: HTMLElement,
  store: Pick<ManifestStore, 'progress' | 'get' | 'stage' | 'data'>,
  module: ProjectionRecord,
  open: () => unknown,
  state = moduleState(store, module),
): HTMLButtonElement {
  const title = asLabel(module);
  const row = deskRow(parent, 'sd-module-row', `Open module: ${title}`, open);
  row.setAttrs({ 'data-cover': coverOf(module), 'data-record-id': asString(module.id) ?? '' });
  row.createSpan({ cls: 'sd-spine' });
  const copy = row.createDiv({ cls: 'sd-row-copy' });
  copy.createEl('strong', { cls: 'sd-row-title', text: title });
  const facts = moduleFacts(store, module);
  if (facts) copy.createDiv({ cls: 'sd-row-facts', text: facts });
  row.createSpan({ cls: 'sd-row-next', text: state });
  chevron(row);
  return row;
}

/** A plain text link that reads as part of a sentence. */
export function textLink(parent: HTMLElement, label: string, go: () => unknown): HTMLButtonElement {
  const link = button(parent, label, go, 'tertiary');
  link.addClass('sd-link');
  return link;
}

export function sideGroup(parent: HTMLElement, title: string): HTMLElement {
  const group = parent.createDiv({ cls: 'sd-side-group' });
  group.createDiv({ cls: 'sd-eyebrow', text: title });
  return group;
}
