import { badge, button, cardTop, section } from '../../components';
import { materialCard } from './cards';
import type { JobDashboardHost } from './host';
import type { JobDashboard, JobHorizon } from './model';

const HORIZONS: readonly JobHorizon[] = ['now', 'next', 'later'];

const HORIZON_LABEL: Record<JobHorizon, string> = {
  now: 'Use now',
  next: 'Use next',
  later: 'Keep for later',
};

/**
 * A track, a paper and a book differ in three fields and nothing else, so the
 * shelf normalises them to one shape and renders that once. Three near-copies
 * of the same twelve lines was how the row markup drifted apart in the first
 * place.
 */
interface ShelfEntry {
  readonly kicker: string;
  readonly title: string;
  readonly sub: string;
  readonly note: readonly [string, string] | null;
  readonly body: string;
  readonly action: readonly [string, (() => unknown) | null];
}

function entriesFor(
  horizon: JobHorizon,
  host: JobDashboardHost,
  dashboard: JobDashboard,
): ShelfEntry[] {
  const tracks: ShelfEntry[] = dashboard.learning_tracks
    .filter((item) => item.horizon === horizon)
    .map((track) => ({
      kicker: 'Track',
      title: track.title,
      sub: track.cadence,
      note: [
        `${track.completedSessions.length}/${track.stages.length}`,
        track.status,
      ] as const,
      body: track.outcome,
      action: [
        'Open plan',
        host.openJobPlan ? () => host.openJobPlan?.(track.id) : null,
      ] as const,
    }));

  const papers: ShelfEntry[] = dashboard.papers
    .filter((item) => item.horizon === horizon)
    .map((paper) => ({
      kicker: 'Paper',
      title: paper.title,
      sub: paper.authors.join(', '),
      note: ((): readonly [string, string] | null => {
        const meta = [paper.year, paper.pages ? `${paper.pages} pages` : '']
          .filter(Boolean).join(' · ');
        return meta ? [meta, horizon] as const : null;
      })(),
      body: paper.angle,
      action: paper.available
        ? ['Open PDF', () => host.openJobPath(paper.path)] as const
        : ['PDF unavailable', null] as const,
    }));

  const books: ShelfEntry[] = dashboard.canonical_shelf
    .filter((item) => item.horizon === horizon)
    .map((source) => ({
      kicker: 'Book',
      title: source.title,
      sub: source.authors.join(', '),
      note: null,
      body: source.why,
      action: ['Open in Library', () => host.openSourceDetail(source.source_id)] as const,
    }));

  return [...tracks, ...papers, ...books];
}

export function renderLibrary(
  root: HTMLElement,
  host: JobDashboardHost,
  dashboard: JobDashboard,
): void {
  const library = section(root, 'Library', 'Ordered by when you need it.');

  for (const horizon of HORIZONS) {
    const entries = entriesFor(horizon, host, dashboard);
    if (!entries.length) continue;

    const group = library.createDiv({ cls: 'los-job-horizon' });
    const head = cardTop(group, HORIZON_LABEL[horizon]);
    badge(head, String(entries.length), horizon);

    for (const entry of entries) {
      const { card, top } = materialCard(group, entry.kicker, entry.title, entry.sub);
      if (entry.note) badge(top, entry.note[0], entry.note[1]);
      if (entry.body) card.createEl('p', { text: entry.body });
      const [label, onClick] = entry.action;
      button(card.createDiv({ cls: 'los-actions' }), label, onClick, 'quiet');
    }
  }
}
