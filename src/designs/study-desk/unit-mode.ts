/**
 * Whether a unit shows its study plan or its session.
 *
 * Attention, not a route: the route contract already says which unit and stage,
 * and a plan and a session of the same stage are two drawings of it. Opening a
 * unit shows the plan; choosing to work on a stage opens the session.
 *
 * The mode belongs to the view that drew it: keyed by the view host in a
 * WeakMap, so two open panes — or a leaf reopened later — never inherit each
 * other's session, and the state is collected with the leaf that owned it.
 */
export type UnitMode = 'plan' | 'materials' | 'session';

const modesByHost = new WeakMap<object, Map<string, UnitMode>>();

/** One-shot launch hints, consumed by the next render of that unit's view. */
const pendingSessions = new Set<string>();

function modesFor(host: object): Map<string, UnitMode> {
  let modes = modesByHost.get(host);
  if (!modes) {
    modes = new Map<string, UnitMode>();
    modesByHost.set(host, modes);
  }
  return modes;
}

export function unitMode(host: object, unitId: string): UnitMode {
  const modes = modesFor(host);
  // A launch hint is consumed on first read, even over a mode this view
  // already recorded: "Continue" from Home must win, and the hint must
  // never leak into a later, unrelated view of the same unit.
  if (pendingSessions.delete(unitId)) {
    modes.set(unitId, 'session');
  }
  return modes.get(unitId) ?? 'plan';
}

export function setUnitMode(host: object, unitId: string, mode: UnitMode): void {
  modesFor(host).set(unitId, mode);
}

export function clearUnitMode(host: object, unitId: string): void {
  modesByHost.get(host)?.delete(unitId);
}

export function requestSession(unitId: string): void {
  pendingSessions.add(unitId);
}
