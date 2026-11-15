import type { ProjectionRecord } from '../../contracts/manifest';
import { normalizeUnitRecord, orderModuleUnits, readModuleRecord } from '../../features/module/model';
import { readResumePointer } from '../../features/home/model';
import { readStudyMap, type StageRecordView } from '../../features/unit/model';
import type { ManifestStore } from '../../manifest-store';
import { asString } from '../../projection/readers';

export function orderedUnits(store: ManifestStore, moduleId: string, componentId: string | null = null): ProjectionRecord[] {
  const rows = store.unitsFor(moduleId, componentId);
  const module = readModuleRecord(store.get(moduleId), moduleId);
  if (!module) return rows;
  return orderModuleUnits(module, rows.flatMap((row) => {
    const unit = normalizeUnitRecord(row);
    return unit ? [unit] : [];
  })).map((unit) => unit.record);
}

export function unitWork(store: ManifestStore, unitId: string) {
  const record = store.mapForUnit(unitId);
  if (!record) return null;
  const map = readStudyMap(record);
  const done = map.stages.filter((stage) => stage.status === 'complete').length;
  const available = (stage: StageRecordView) => stage.status !== 'complete' && stage.status !== 'skipped';
  const next = map.stages.find((stage) => stage.id === map.currentStageId && available(stage))
    ?? map.stages.find(available);
  return { map, done, next };
}

/** Show the recorded lecture first, then authored course order. */
export function moduleWork(store: ManifestStore, moduleId: string) {
  const pointer = readResumePointer(store.data?.resume_pointer);
  const units = orderedUnits(store, moduleId);
  const first = units.find((unit) => unit.id === pointer.unit_id) ?? units.find((unit) => unit.status === 'active');
  let owed: ProjectionRecord | null = null;
  for (const unit of first ? [first, ...units.filter((row) => row !== first)] : units) {
    const id = asString(unit.id);
    if (!id || unit.status === 'complete' || unit.status === 'archived' || unit.status === 'paused') continue;
    const work = unitWork(store, id);
    if (work?.next) return { unit, stage: work.next, position: work.map.stages.indexOf(work.next) + 1 };
    if (unit.needs_study_map === true && !owed) owed = unit;
  }
  return owed ? { unit: owed, stage: null, position: 0 } : null;
}

export function inProgressUnits(store: ManifestStore) {
  const pointer = readResumePointer(store.data?.resume_pointer);
  const rows = store.modules().filter((module) => module.is_actionable === true).flatMap((module) => {
    const moduleId = asString(module.id);
    if (!moduleId) return [];
    return orderedUnits(store, moduleId).flatMap((unit) => {
      const unitId = asString(unit.id);
      if (!unitId || unit.status === 'complete' || unit.status === 'archived' || unit.status === 'paused') return [];
      const work = unitWork(store, unitId);
      if (!work?.done || work.done === work.map.stages.length) return [];
      return [{ module, unit, unitId, done: work.done, total: work.map.stages.length, next: work.next }];
    });
  });
  return rows.sort((left, right) => Number(right.unitId === pointer.unit_id) - Number(left.unitId === pointer.unit_id));
}

export function currentSemesterKey(store: ManifestStore): string | null {
  return asString(store.currentSemester()?.id)?.replace(/^semester-/, '') ?? null;
}
