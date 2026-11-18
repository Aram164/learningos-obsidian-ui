import type { ProjectionRecord } from '../../contracts/manifest';
import { normalizeUnitRecord, orderModuleUnits, readModuleRecord } from '../../features/module/model';
import { candidateModules, resolveResumeTarget } from '../../features/home/model';
import { isOpenStage, readStudyMap, stageProgress } from '../../features/unit/model';
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
  const { done } = stageProgress(map.stages);
  // The map's own cursor is what Core maintains; a closed or absent cursor is
  // displayed honestly rather than rescued by guessing the first open stage.
  const next = map.stages.find((stage) => stage.id === map.currentStageId && isOpenStage(stage))
    ?? null;
  return { map, done, next };
}

export function inProgressUnits(store: ManifestStore) {
  // The pointer-first sort reads the validated pointer: a projection whose ids
  // are individually known but disagree on ownership sorts nothing first.
  const target = resolveResumeTarget(store);
  const pointerUnitId = target.unit ? target.pointer.unit_id : null;
  const rows = candidateModules(store).flatMap((module) => {
    const moduleId = asString(module.id);
    if (!moduleId) return [];
    return orderedUnits(store, moduleId).flatMap((unit) => {
      const unitId = asString(unit.id);
      if (!unitId) return [];
      const work = unitWork(store, unitId);
      if (!work || work.map.record.is_study_candidate !== true || work.done <= 0 || work.next === null || work.done >= work.map.stages.length) return [];
      return [{ module, unit, unitId, done: work.done, total: work.map.stages.length, next: work.next }];
    });
  });
  return rows.sort((left, right) => Number(right.unitId === pointerUnitId) - Number(left.unitId === pointerUnitId));
}

export function currentSemesterKey(store: ManifestStore): string | null {
  return asString(store.currentSemester()?.id)?.replace(/^semester-/, '') ?? null;
}
