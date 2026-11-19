/**
 * Pure presentation labels and cover tones derived from published module and
 * unit projection fields. Shared across interface designs.
 */
import type { ProjectionRecord } from '../../contracts/manifest';
import type { ManifestStore } from '../../manifest-store';
import { asLabel, asString } from '../../projection/readers';
import { semesterLabel } from './logistics';

export type Cover = 'wine' | 'teal' | 'ochre' | 'moss' | 'slate' | 'plum' | 'stone';

const NAMED_COVERS: Readonly<Record<string, Cover>> = {
  'module-hu-aml': 'wine',
  'module-hu-m2-statistik-analysis': 'teal',
  'module-hu-betriebssysteme': 'ochre',
  'module-hu-icop': 'moss',
};
const ACADEMIC_COVERS: readonly Cover[] = ['wine', 'teal', 'ochre', 'moss'];

/** One deterministic cover tone per module. Presentation only. */
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

/** "AML", or the whole title when the module has no short name of its own. */
export function moduleName(module: ProjectionRecord | null | undefined): string {
  const authored = /\(([^)]{2,10})\)\s*$/.test(asLabel(module)) || Boolean(asString(module?.code));
  return authored ? moduleShort(module) : moduleLongTitle(module);
}

/** The title without its trailing parenthetical short code. */
export function moduleLongTitle(module: ProjectionRecord | null | undefined): string {
  return asLabel(module).replace(/\s*\([^)]{2,10}\)\s*$/, '');
}

export interface UnitLabel {
  /** "02" for a numbered lecture/chapter/week, null for anything else. */
  readonly number: string | null;
  /** "Lecture 02" for a lecture, else the short title. */
  readonly place: string;
  readonly title: string;
}

/** Split "AML Lecture 02 — k-Nearest Neighbors" into place number and short title. */
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

export function shortSemester(value: string): string {
  return semesterLabel(value).replace('Summer semester', 'SoSe').replace('Winter semester', 'WiSe');
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

/** How far along, in words, from Core's published counts and module status. */
export function moduleState(store: Pick<ManifestStore, 'progress'>, module: ProjectionRecord): string {
  const progress = store.progress(asString(module.id) ?? '');
  if (progress.stages_total && progress.stages_complete === progress.stages_total) return 'Done';
  return asString(module.status)?.replaceAll('-', ' ') ?? '';
}
