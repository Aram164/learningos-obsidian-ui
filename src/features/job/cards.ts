import { badge, button, cardTop } from '../../components';
import type { JobDashboardHost } from './host';
import type { JobNote } from './model';

/*
 * Job renders with the system's card, not its own.
 *
 * The surface had grown a private set — `los-job-note`, `los-job-material`,
 * `los-job-drift`, `los-job-layer` — each a box with a border and a title, none
 * of them different from `los-card` in any way a reader could name. The only
 * thing genuinely particular to Job is which fields go in a card, so that is
 * the only thing this module decides.
 */

/**
 * One note. Freshness is the only badge worth the space: it is the single field
 * that can tell you the prose in front of you no longer matches the code.
 */
export function noteCard(
  parent: HTMLElement,
  host: JobDashboardHost,
  note: JobNote,
): HTMLElement {
  const card = parent.createDiv({ cls: 'los-card' });
  const top = cardTop(card, note.title, note.component);
  badge(top, note.freshness, note.freshness);
  if (note.summary) card.createEl('p', { text: note.summary });
  const actions = card.createDiv({ cls: 'los-actions' });
  if (note.verified_against) {
    actions.createSpan({ cls: 'los-micro', text: `Verified ${note.verified_against}` });
  }
  if (host.editNote) button(actions, 'Edit note', () => host.editNote?.(note), 'quiet');
  button(actions, 'Open note', () => host.openJobPath(note.path), 'quiet');
  return card;
}

/**
 * One shelf entry — a track, a paper or a book. The kicker says which.
 *
 * Both nodes are returned rather than re-found with a selector: the caller
 * needs the header to hang an optional badge on, and a query would make the
 * card's internal structure part of its contract.
 */
export function materialCard(
  parent: HTMLElement,
  kicker: string,
  title: string,
  sub = '',
): { readonly card: HTMLElement; readonly top: HTMLElement } {
  const card = parent.createDiv({ cls: 'los-card' });
  card.createDiv({ cls: 'los-kicker', text: kicker });
  return { card, top: cardTop(card, title, sub) };
}
