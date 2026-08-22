/** Shared ordered-learning route primitives.
 *
 * Canonical units and the quarantined Job reader own different data and write
 * gateways, but an ordered route is the same interaction in both places.  The
 * adapter values below contain presentation state only; no Job record crosses
 * into the canonical manifest and no canonical rule is reimplemented here.
 */

export interface LearningRouteItem {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly state: string;
  readonly marker: string;
}

export interface LearningRouteOptions {
  readonly title: string;
  readonly ariaLabel: string;
  readonly progressLabel: string;
  readonly completed: number;
  readonly selectedId: string;
  readonly items: readonly LearningRouteItem[];
  readonly select: (id: string) => unknown;
}

export function renderLearningProgress(
  parent: HTMLElement,
  completedValue: number,
  totalValue: number,
  ariaLabel: string,
  showCopy = true,
): HTMLElement {
  const total = Math.max(0, totalValue);
  const completed = Math.min(Math.max(0, completedValue), total);
  const percent = total ? Math.round((completed / total) * 100) : 0;
  if (showCopy) {
    const copy = parent.createDiv({ cls: 'los-stage-progress-copy' });
    copy.createSpan({ text: `${completed} of ${total} complete` });
    copy.createSpan({ cls: 'los-micro', text: `${percent}%` });
  }
  const progress = parent.createDiv({
    cls: 'los-stage-progress',
    attr: {
      role: 'progressbar',
      'aria-label': ariaLabel,
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-valuenow': String(percent),
    },
  });
  const value = progress.createDiv({ cls: 'los-stage-progress-value' });
  value.style.width = `${percent}%`;
  return progress;
}

export function renderLearningRouteRail(
  parent: HTMLElement,
  options: LearningRouteOptions,
): HTMLElement {
  const rail = parent.createEl('nav', { cls: 'los-stage-rail' });
  rail.setAttr('aria-label', options.ariaLabel);

  const summary = rail.createDiv({ cls: 'los-stage-rail-summary' });
  summary.createEl('h2', { text: options.title });
  renderLearningProgress(
    summary,
    options.completed,
    options.items.length,
    options.progressLabel,
  );

  const list = rail.createDiv({ cls: 'los-stage-list', attr: { role: 'list' } });
  const selectedIndex = options.items.findIndex((item) => item.id === options.selectedId);
  for (const [index, item] of options.items.entries()) {
    const selected = item.id === options.selectedId;
    const row = list.createEl('button', {
      cls: `los-stage-row los-s-${item.state} ${
        selected ? 'is-selected' : index > selectedIndex ? 'is-upcoming' : 'is-before'
      } is-clickable`,
      attr: {
        type: 'button',
        role: 'listitem',
        'aria-label': `Open stage ${item.number}: ${item.title}`,
        'aria-posinset': String(index + 1),
        'aria-setsize': String(options.items.length),
        'aria-current': selected ? 'step' : 'false',
        'aria-pressed': String(selected),
      },
    });
    row.createSpan({ cls: 'los-stage-index', text: String(item.number).padStart(2, '0') });
    const copy = row.createSpan({ cls: 'los-stage-copy' });
    copy.createSpan({ text: item.title });
    if (item.marker) copy.createSpan({ cls: 'los-micro', text: item.marker });
    row.addEventListener('click', () => options.select(item.id));
  }
  return rail;
}
