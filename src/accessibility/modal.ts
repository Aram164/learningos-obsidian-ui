interface AccessibleModalOptions {
  readonly close: () => void;
  readonly hostClass: string;
  /** Resolve after Obsidian has finished opening the host modal. */
  readonly initialFocus?: () => HTMLElement | null;
  readonly labelledBy: string;
}

interface BackgroundState {
  readonly element: HTMLElement;
  readonly ariaHidden: string | null;
  readonly inert: boolean;
}

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Add the dialog semantics Obsidian's Modal host does not expose reliably to
 * every accessibility tree. The host still owns display and dismissal; this
 * helper owns naming, background isolation, keyboard containment and focus
 * restoration for LearningOS overlays.
 */
export function makeModalAccessible(
  content: HTMLElement,
  options: AccessibleModalOptions,
): () => void {
  const document = content.ownerDocument ?? globalThis.document;
  const previousFocus = document?.activeElement as HTMLElement | null;
  const host = (
    typeof content.closest === 'function'
      ? content.closest('.modal')
      : null
  ) as HTMLElement | null;
  const dialog = host ?? content;
  const focusRoot = dialog;

  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', options.labelledBy);
  dialog.setAttribute('tabindex', '-1');
  host?.classList.add(options.hostClass);

  const workspaces = document
    && typeof document.querySelectorAll === 'function'
      ? Array.from(
        document.querySelectorAll<HTMLElement>('.workspace'),
      )
      : [];
  const backgrounds: BackgroundState[] = workspaces
    .filter((element) =>
      typeof element.contains !== 'function'
      || !element.contains(dialog),
    )
    .map((element) => ({
      element,
      ariaHidden: element.getAttribute('aria-hidden'),
      inert: element.inert,
    }));

  for (const background of backgrounds) {
    background.element.inert = true;
    background.element.setAttribute('aria-hidden', 'true');
  }

  /* Obsidian focuses the first control after `onOpen()` returns. Focusing a
   * field synchronously inside `onOpen()` therefore loses to the host and can
   * make a keyboard-launched workflow discard the learner's first keystrokes.
   * Defer the product-specific target until the next frame, after the host has
   * completed its own focus pass. */
  let cancelInitialFocus: (() => void) | null = null;
  if (options.initialFocus) {
    const view = document?.defaultView ?? globalThis.window;
    const focus = (): void => options.initialFocus?.()?.focus?.();
    if (typeof view?.requestAnimationFrame === 'function') {
      const frame = view.requestAnimationFrame(focus);
      cancelInitialFocus = () => view.cancelAnimationFrame?.(frame);
    } else {
      const timer = view.setTimeout(focus, 0);
      cancelInitialFocus = () => view.clearTimeout(timer);
    }
  }

  const focusable = (): HTMLElement[] => {
    if (typeof focusRoot.querySelectorAll !== 'function') {
      return [];
    }

    return Array.from(
      focusRoot.querySelectorAll<HTMLElement>(FOCUSABLE),
    ).filter((element) =>
      element.getAttribute('aria-hidden') !== 'true'
      && !(element as HTMLButtonElement).disabled,
    );
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      options.close();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const controls = focusable();
    if (!controls.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const first = controls[0]!;
    const last = controls.at(-1)!;
    const active = document?.activeElement;

    if (event.shiftKey && (active === first || !focusRoot.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !focusRoot.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  };

  focusRoot.addEventListener('keydown', onKeyDown);
  let cleaned = false;

  return (): void => {
    if (cleaned) {
      return;
    }
    cleaned = true;

    cancelInitialFocus?.();
    cancelInitialFocus = null;

    focusRoot.removeEventListener?.('keydown', onKeyDown);
    host?.classList.remove(options.hostClass);

    for (const background of backgrounds) {
      background.element.inert = background.inert;
      if (background.ariaHidden === null) {
        background.element.removeAttribute('aria-hidden');
      } else {
        background.element.setAttribute(
          'aria-hidden',
          background.ariaHidden,
        );
      }
    }

    previousFocus?.focus?.();
  };
}
