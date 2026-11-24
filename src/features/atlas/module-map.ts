/**
 * Module Revision Map data for the module detail screen. The SVG connector
 * that drew idea arrows was removed with the Atlas visual renderer (P4
 * step 29); the lecture rows themselves are data, not a graph presentation.
 */
import { plural } from '../../components';
import { unitLabel, type UnitLabel } from '../module/labels';
import { nonNull, normalizeUnitRecord, orderModuleUnits, readModuleRecord } from '../module/model';
import { readUnitRecord, type KnowledgeNodeView, type UnitRecordView } from '../unit/model';
import type { AtlasHost } from './ports';

type Store = AtlasHost['plugin']['store'];

export interface MapRow {
  readonly unit: UnitRecordView;
  readonly label: UnitLabel;
  readonly ideas: readonly KnowledgeNodeView[];
}

export interface ModuleMap {
  readonly moduleId: string;
  readonly rows: readonly MapRow[];
  readonly examBlocks: readonly UnitRecordView[];
  readonly unmapped: readonly UnitRecordView[];
  readonly ideas: number;
}

/** The module's lectures as the revision map draws them, or null when nothing in it has an idea map. */
export function moduleMap(store: Store, moduleId: string): ModuleMap | null {
  const record = store.get(moduleId);
  const module = record ? readModuleRecord(record) : null;
  if (!record || !module) return null;
  const ordered = orderModuleUnits(module, store.unitsFor(moduleId).map(normalizeUnitRecord).filter(nonNull));
  const units = ordered.map((row) => readUnitRecord(row.record, row.id)).filter(nonNull);
  const blocks = units.filter((unit) => unit.kind === 'exam-block');
  const lectures = units.filter((unit) => unit.kind !== 'exam-block');
  const drawn = lectures.some((unit) => unit.knowledgeNodes.length) ? lectures : blocks;
  const rows = drawn.filter((unit) => unit.knowledgeNodes.length)
    .map((unit) => ({ unit, label: unitLabel(unit.record, record), ideas: unit.knowledgeNodes }));
  if (!rows.length) return null;
  return {
    moduleId,
    rows,
    examBlocks: drawn === lectures ? blocks : [],
    unmapped: drawn.filter((unit) => !unit.knowledgeNodes.length),
    ideas: rows.reduce((sum, row) => sum + row.ideas.length, 0),
  };
}

/** "11 lectures · 71 ideas": what a module map holds, for a link to it. */
export function moduleMapFacts(map: ModuleMap): string {
  return `${plural(map.rows.length, 'lecture')} · ${plural(map.ideas, 'idea')}`;
}
