import type { PlaneBounds } from './model';

export interface AbilityCamera { readonly x: number; readonly y: number; readonly scale: number }
export interface ViewportSize { readonly width: number; readonly height: number }
export interface ViewportPoint { readonly x: number; readonly y: number }
const MIN_SCALE = 0.001;
const MAX_SCALE = 2.5;
export const PAN_THRESHOLD = 5;

export function zoomAt(camera: AbilityCamera, point: ViewportPoint, scale: number): AbilityCamera {
  const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
  const ratio = next / camera.scale;
  return { scale: next, x: point.x - (point.x - camera.x) * ratio,
    y: point.y - (point.y - camera.y) * ratio };
}

export function fitCamera(bounds: PlaneBounds, size: ViewportSize, padding = 44): AbilityCamera {
  const width = Math.max(1, size.width - padding * 2);
  const height = Math.max(1, size.height - padding * 2);
  const scale = Math.max(MIN_SCALE, Math.min(1, width / Math.max(1, bounds.width), height / Math.max(1, bounds.height)));
  return { scale, x: size.width / 2 - (bounds.x + bounds.width / 2) * scale,
    y: size.height / 2 - (bounds.y + bounds.height / 2) * scale };
}

/** Reveal a record at the existing scale, without moving an already visible record. */
export function revealCamera(camera: AbilityCamera, bounds: PlaneBounds, size: ViewportSize): AbilityCamera {
  const left = bounds.x * camera.scale + camera.x;
  const top = bounds.y * camera.scale + camera.y;
  const right = left + bounds.width * camera.scale;
  const bottom = top + bounds.height * camera.scale;
  if (left >= 24 && top >= 24 && right <= size.width - 24 && bottom <= size.height - 24) return camera;
  return { ...camera, x: size.width / 2 - (bounds.x + bounds.width / 2) * camera.scale,
    y: size.height / 2 - (bounds.y + bounds.height / 2) * camera.scale };
}

export function cameraTransform(camera: AbilityCamera): string {
  return `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`;
}

export interface AbilityViewport {
  fit(bounds: PlaneBounds): void;
  reveal(bounds: PlaneBounds): void;
  zoom(factor: number): void;
  /** A drag's release must not be mistaken for a click. */
  suppressClick(): boolean;
  dispose(): void;
}

/** One transform contains HTML nodes, SVG arrows and bridge bands; controls never enter it. */
export function mountAbilityViewport(options: {
  element: HTMLElement; world: HTMLElement; bounds: PlaneBounds;
  camera(): AbilityCamera | null; changed(camera: AbilityCamera): void;
  percentage: HTMLElement;
}): AbilityViewport {
  const { element, world } = options;
  let disposed = false;
  let suppress = false;
  let drag: { pointer: number; x: number; y: number; camera: AbilityCamera; moved: boolean; pan: boolean } | null = null;
  const listeners: Array<readonly [string, EventListener, AddEventListenerOptions | undefined]> = [];
  const rect = () => typeof element.getBoundingClientRect === 'function'
    ? element.getBoundingClientRect() : { left: 0, top: 0, width: 900, height: 560 };
  const size = (): ViewportSize => {
    const box = rect();
    return { width: box.width || element.clientWidth || 900, height: box.height || element.clientHeight || 560 };
  };
  const apply = (camera: AbilityCamera) => {
    if (disposed) return;
    options.changed(camera);
    world.style.transform = cameraTransform(camera);
    element.setAttribute('data-camera', JSON.stringify(camera));
    options.percentage.setText(`${Math.round(camera.scale * 100)}%`);
  };
  const current = () => options.camera() ?? fitCamera(options.bounds, size());
  const fit = (bounds: PlaneBounds) => apply(fitCamera(bounds, size()));
  const zoom = (factor: number) => {
    const pane = size();
    apply(zoomAt(current(), { x: pane.width / 2, y: pane.height / 2 }, current().scale * factor));
  };
  const listen = (type: string, handler: EventListener, config?: AddEventListenerOptions) => {
    element.addEventListener(type, handler, config); listeners.push([type, handler, config]);
  };
  listen('pointerdown', ((event: PointerEvent) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    const interactive = Boolean(target?.closest?.('button, input, select, a, summary'));
    suppress = false;
    drag = { pointer: event.pointerId, x: event.clientX, y: event.clientY, camera: current(), moved: false, pan: !interactive };
    if (!interactive) {
      element.focus({ preventScroll: true });
      element.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    }
  }) as EventListener);
  listen('pointermove', ((event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointer) return;
    const x = event.clientX - drag.x; const y = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(x, y) < PAN_THRESHOLD) return;
    drag.moved = true;
    if (!drag.pan) return;
    element.addClass('is-panning');
    apply({ ...drag.camera, x: drag.camera.x + x, y: drag.camera.y + y });
  }) as EventListener);
  const release = ((event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointer) return;
    suppress = drag.moved;
    drag = null;
    element.removeClass('is-panning');
    if (element.hasPointerCapture?.(event.pointerId)) element.releasePointerCapture(event.pointerId);
  }) as EventListener;
  listen('pointerup', release); listen('pointercancel', release); listen('lostpointercapture', release);
  listen('wheel', ((event: WheelEvent) => {
    const active = (element.ownerDocument ?? globalThis.document)?.activeElement;
    if (!active || !element.contains(active)) return;
    event.preventDefault();
    const box = rect();
    if (event.ctrlKey || event.metaKey || event.altKey) {
      const factor = Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.04 : 0.002));
      apply(zoomAt(current(), { x: event.clientX - box.left, y: event.clientY - box.top }, current().scale * factor));
    } else {
      const multiplier = event.deltaMode === 1 ? 20 : 1;
      apply({ ...current(), x: current().x - event.deltaX * multiplier, y: current().y - event.deltaY * multiplier });
    }
  }) as EventListener, { passive: false });
  listen('keydown', ((event: KeyboardEvent) => {
    if (event.target !== element) return;
    if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1.2); }
    if (event.key === '-') { event.preventDefault(); zoom(1 / 1.2); }
    if (event.key === '0' || event.key.toLowerCase() === 'f') { event.preventDefault(); fit(options.bounds); }
    if (event.key.startsWith('Arrow')) {
      event.preventDefault(); const delta = event.shiftKey ? 100 : 40;
      apply({ ...current(), x: current().x + (event.key === 'ArrowLeft' ? delta : event.key === 'ArrowRight' ? -delta : 0),
        y: current().y + (event.key === 'ArrowUp' ? delta : event.key === 'ArrowDown' ? -delta : 0) });
    }
  }) as EventListener);
  let frame: number | null = null;
  const initial = options.camera();
  apply(initial ?? fitCamera(options.bounds, size()));
  if (!initial && typeof requestAnimationFrame === 'function') {
    frame = requestAnimationFrame(() => { if (!disposed) fit(options.bounds); });
  }
  return {
    fit, zoom, reveal: (bounds) => apply(revealCamera(current(), bounds, size())),
    suppressClick: () => { const value = suppress; suppress = false; return value; },
    dispose: () => {
      disposed = true;
      if (frame !== null) cancelAnimationFrame(frame);
      if (drag && element.hasPointerCapture?.(drag.pointer)) element.releasePointerCapture(drag.pointer);
      drag = null;
      for (const [type, handler, config] of listeners) element.removeEventListener?.(type, handler, config);
    },
  };
}
