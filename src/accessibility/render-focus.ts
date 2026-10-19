/** Keep working focus inside the same leaf when a presentation redraws it. */
export function captureRenderFocus(root: HTMLElement): () => void {
  const doc = root.ownerDocument ?? globalThis.document;
  const focused = doc?.activeElement as HTMLElement | null;
  if (!focused || !root.contains(focused)) return () => {};
  const selector = 'input[type="search"], input.los-route-search, input.los-search, textarea.los-garden-seed-editor, input.los-garden-seed-title';
  const input = typeof focused.matches === 'function' && focused.matches(selector)
    ? focused as HTMLInputElement | HTMLTextAreaElement : null;
  const group = focused.tagName === 'BUTTON' && typeof focused.closest === 'function'
    ? focused.closest<HTMLElement>('[role="group"]') : null;
  const label = group?.getAttribute('aria-label');
  if (!input && !label) return () => {};
  const value = input?.value;
  const start = input?.selectionStart ?? null;
  const end = input?.selectionEnd ?? null;
  const direction = input?.selectionDirection ?? undefined;
  const tab = focused.getAttribute('data-los-tab');
  const text = focused.textContent;
  const top = root.scrollTop;
  const left = root.scrollLeft;
  return () => {
    // Never reclaim focus if another control received it during the update.
    const now = doc.activeElement;
    if (now && now !== focused && now !== doc.body && now.isConnected) return;
    let replacement: HTMLElement | null = null;
    if (input && typeof root.querySelectorAll === 'function') {
      replacement = Array.from(root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(selector))
        .find((node) => node.tagName === input.tagName && node.className === input.className && node.value === value) ?? null;
    } else if (label && typeof root.querySelectorAll === 'function') {
      const nextGroup = Array.from(root.querySelectorAll<HTMLElement>('[role="group"]'))
        .find((node) => node.getAttribute('aria-label') === label);
      replacement = nextGroup ? Array.from(nextGroup.querySelectorAll<HTMLButtonElement>('button'))
        .find((node) => !node.disabled && (tab ? node.getAttribute('data-los-tab') === tab : node.textContent === text)) ?? null : null;
    }
    if (!replacement) return;
    replacement.focus({ preventScroll: true });
    if (input && start !== null && end !== null) {
      try { (replacement as HTMLInputElement).setSelectionRange(start, end, direction); } catch { /* Native search may not support selection. */ }
    }
    root.scrollTop = top;
    root.scrollLeft = left;
  };
}

/** The render callback stays synchronous; view state remains with its owner. */
export function withRenderFocus(root: HTMLElement, render: () => void): void {
  const restore = captureRenderFocus(root);
  try { render(); } finally { restore(); }
}
