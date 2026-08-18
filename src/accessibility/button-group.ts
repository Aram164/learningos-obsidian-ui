export type ButtonGroupOrientation = 'horizontal' | 'vertical' | 'both';

/**
 * Add optional roving focus to an existing group of native buttons.
 *
 * Tab still enters and leaves the group normally; arrow keys only make moving
 * inside a compact switcher less repetitive. Selection stays with the native
 * button click, so this adds keyboard reach without changing view state or
 * visual treatment.
 */
export function enableButtonGroupKeyboardNavigation(
  group: HTMLElement,
  orientation: ButtonGroupOrientation = 'horizontal',
): void {
  group.addEventListener('keydown', (event: KeyboardEvent) => {
    const horizontal = orientation === 'horizontal' || orientation === 'both';
    const vertical = orientation === 'vertical' || orientation === 'both';
    const backward = event.key === 'Home'
      || (horizontal && event.key === 'ArrowLeft')
      || (vertical && event.key === 'ArrowUp');
    const forward = event.key === 'End'
      || (horizontal && event.key === 'ArrowRight')
      || (vertical && event.key === 'ArrowDown');
    if (!backward && !forward) return;

    const controls = typeof group.querySelectorAll === 'function'
      ? Array.from(group.querySelectorAll<HTMLButtonElement>('button')).filter(
        (control) => !control.disabled && control.getAttribute('aria-hidden') !== 'true',
      )
      : [];
    if (!controls.length) return;
    const current = controls.indexOf(event.target as HTMLButtonElement);
    if (current < 0) return;

    event.preventDefault();
    let target = current;
    if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = controls.length - 1;
    else target = (current + (forward ? 1 : -1) + controls.length) % controls.length;
    controls[target]?.focus();
  });
}
