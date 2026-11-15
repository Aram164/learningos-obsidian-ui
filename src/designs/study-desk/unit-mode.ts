/**
 * Whether a unit shows its study plan or its session.
 *
 * Attention, not a route: the route contract already says which unit and stage,
 * and a plan and a session of the same stage are two drawings of it. Opening a
 * unit shows the plan; choosing to work on a stage opens the session.
 *
 * The mode belongs to the pane that drew it: keyed by leaf in a WeakMap,
 * so Back and Forward restore it and separate panes never share it.
 */
export type UnitMode = 'plan' | 'materials' | 'session';

const modesByHost = new WeakMap<object, Map<string, UnitMode>>();

function modesFor(host: object): Map<string, UnitMode> {
  let modes = modesByHost.get(host);
  if (!modes) {
    modes = new Map<string, UnitMode>();
    modesByHost.set(host, modes);
  }
  return modes;
}

export function unitMode(host: object, unitId: string): UnitMode {
  return modesByHost.get(host)?.get(unitId) ?? 'plan';
}

export function setUnitMode(host: object, unitId: string, mode: UnitMode): void {
  modesFor(host).set(unitId, mode);
}

export function clearUnitMode(host: object, unitId: string): void {
  modesByHost.get(host)?.delete(unitId);
}
