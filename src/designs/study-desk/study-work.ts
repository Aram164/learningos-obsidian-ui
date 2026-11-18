import type { ProjectionRecord } from '../../contracts/manifest';
import { normalizeUnitRecord, orderModuleUnits, readModuleRecord } from '../../features/module/model';
import { resolveResumeTarget } from '../../features/home/model';
import { firstOpenStage, isOpenStage, readStudyMap } from '../../features/unit/model';
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
  const next = map.stages.find((stage) => stage.id === map.currentStageId && isOpenStage(stage))
    ?? firstOpenStage(map.stages);
  return { map, done, next };
}

export function inProgressUnits(store: ManifestStore) {
  // The pointer-first sort reads the validated pointer: a projection whose ids
  // are individually known but disagree on ownership sorts nothing first.
  const target = resolveResumeTarget(store);
  const pointerUnitId = target.unit ? target.pointer.unit_id : null;
  const rows = store.modules().filter((module) => module.is_actionable === true).flatMap((module) => {
    const moduleId = asString(module.id);
    if (!moduleId) return [];
    return orderedUnits(store, moduleId).flatMap((unit) => {
      const unitId = asString(unit.id);
      if (!unitId || unit.status === 'complete' || unit.status === 'archived' || unit.status === 'paused') return [];
      const work = unitWork(store, unitId);
      if (!work?.done || !work.next || work.done === work.map.stages.length) return [];
      return [{ module, unit, unitId, done: work.done, total: work.map.stages.length, next: work.next }];
    });
  });
  return rows.sort((left, right) => Number(right.unitId === pointerUnitId) - Number(left.unitId === pointerUnitId));
}

export function currentSemesterKey(store: ManifestStore): string | null {
  return asString(store.currentSemester()?.id)?.replace(/^semester-/, '') ?? null;
}
