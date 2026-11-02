/**
 * Whether a unit shows its study plan or its session.
 *
 * Attention, not a route: the route contract already says which unit and stage,
 * and a plan and a session of the same stage are two drawings of it. Opening a
 * unit shows the plan; choosing to work on a stage opens the session.
 */
export type UnitMode = 'plan' | 'materials' | 'session';

const modes = new Map<string, UnitMode>();

export function unitMode(unitId: string): UnitMode {
  return modes.get(unitId) ?? 'plan';
}

export function setUnitMode(unitId: string, mode: UnitMode): void {
  modes.set(unitId, mode);
}

export function requestSession(unitId: string): void {
  modes.set(unitId, 'session');
}
