/** Shared ordered-learning route primitives.
 *
 * Ordered routes contain presentation state only; canonical records and writes
 * remain owned by Core.
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
  /**
   * Whether the rail carries a progress bar above the stages. Figma's
   * `Stage rail` (14:509) does not: every row already states its own state, so
   * the bar restated in one number what six rows say precisely. Other ordered
   * learning views may still opt into it.
   */
  readonly showProgress?: boolean;
  /**
   * A quiet count beside the rail label. Deliberate small deviation from
   * 14:509, which labels the rail "Stages" and nothing else: dropping the
   * progress bar with no replacement would have removed the only place the
   * completed total was stated. Six rows each saying "Complete" is not the
   * same as being told the total.
   */
  readonly titleMeta?: string;
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
  if (options.showProgress !== false) {
    renderLearningProgress(
      summary,
      options.completed,
      options.items.length,
      options.progressLabel,
    );
  } else {
    summary.addClass('is-label-only');
    if (options.titleMeta) {
      summary.createSpan({ cls: 'los-micro', text: options.titleMeta });
    }
  }

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
    /* Figma `Stage rail item` (5:21) carries the ordinal inside the title —
     * "1 · What a query plan is" — and reduces the marker to a dot whose fill
     * encodes state. The numbered circle it replaces competed with the title
     * for the same glance and said nothing the ordinal did not. */
    row.createSpan({ cls: 'los-stage-marker', attr: { 'aria-hidden': 'true' } });
    const copy = row.createSpan({ cls: 'los-stage-copy' });
    copy.createSpan({ cls: 'los-stage-title', text: `${item.number} · ${item.title}` });
    if (item.marker) copy.createSpan({ cls: 'los-micro', text: item.marker });
    row.addEventListener('click', () => options.select(item.id));
  }
  return rail;
}
