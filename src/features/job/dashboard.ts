import {
  badge, button, icon, pageHeader, section,
} from '../../components';
import type {
  JobDashboard, JobHorizon, JobNote, JobTab,
} from './model';

export interface JobDashboardHost {
  openJobPath(path: string): unknown;
  openSourceDetail(sourceId: string): unknown;
  /**
   * Bounded Job writes (ADR-010). Optional so a read-only host — a preview, a
   * test double — stays valid and simply renders no write affordances.
   */
  logJobSession?(track: string, session: number): unknown;
  markJobSessionDone?(track: string, session: number): unknown;
}

/**
 * Three destinations, not four tabs. The old set — overview, system map,
 * learning, shelf — implied four peers, but one asked "what now", one was a
 * reference map, and two were both piles of material sorted by type rather
 * than by when they are needed.
 */
const TABS: ReadonlyArray<readonly [JobTab, string]> = [
  ['now', 'Now'],
  ['system', 'System'],
  ['library', 'Library'],
];

const HORIZON_LABEL: Record<JobHorizon, string> = {
  now: 'Use now',
  next: 'Use next',
  later: 'Keep for later',
};

const HORIZONS: readonly JobHorizon[] = ['now', 'next', 'later'];

function privacyBanner(root: HTMLElement): void {
  const banner = root.createDiv({ cls: 'los-job-privacy' });
  icon(banner.createSpan({ cls: 'los-job-privacy-icon' }), 'shield-check');
  const copy = banner.createDiv();
  copy.createEl('strong', { text: 'Confidential, on-demand view' });
  copy.createEl('p', {
    text: 'Loaded only after opening Job. Nothing here enters LearningOS search, the generated manifest, academic recommendations, or AI context.',
  });
}

function tabs(
  root: HTMLElement,
  active: JobTab,
  choose: (tab: JobTab) => void,
): void {
  const nav = root.createDiv({ cls: 'los-job-tabs' });
  nav.setAttrs({ role: 'group', 'aria-label': 'Job workspace sections' });
  for (const [id, label] of TABS) {
    const control = button(nav, label, () => choose(id), 'quiet');
    control.addClass('los-job-tab');
    control.setAttribute('aria-pressed', String(active === id));
  }
}

function dashboardHeader(
  root: HTMLElement,
  dashboard: JobDashboard,
  active: JobTab,
  choose: (tab: JobTab) => void,
): void {
  pageHeader(root, 'Job · confidential workspace', dashboard.title, dashboard.subtitle);
  privacyBanner(root);
  tabs(root, active, choose);
}

function noteCard(
  parent: HTMLElement,
  host: JobDashboardHost,
  note: JobNote,
): void {
  const card = parent.createDiv({ cls: 'los-job-note' });
  const top = card.createDiv({ cls: 'los-card-top' });
  const copy = top.createDiv({ cls: 'los-job-note-title' });
  copy.createEl('h3', { text: note.title });
  if (note.component) copy.createDiv({ cls: 'los-detail-id', text: note.component });
  badge(top, note.freshness, note.freshness);
  if (note.summary) card.createEl('p', { text: note.summary });
  const footer = card.createDiv({ cls: 'los-job-note-footer' });
  if (note.verified_against) footer.createSpan({ cls: 'los-micro', text: `Verified ${note.verified_against}` });
  button(footer, 'Open note', () => host.openJobPath(note.path), 'quiet');
}

// --------------------------------------------------------------------- Now

/** The next session is the first one not yet recorded as done. */
function nextSession(dashboard: JobDashboard) {
  for (const track of dashboard.learning_tracks) {
    const session = track.sessions.find((item) => !item.done);
    if (session) return { track, session };
  }
  return null;
}

function renderNow(
  root: HTMLElement,
  host: JobDashboardHost,
  dashboard: JobDashboard,
): void {
  const workspace = dashboard.workspace;

  const required = workspace.current_scope.find((item) => item.label === 'required-now');
  const scope = section(root, 'Required now', 'The workspace decides this, not the view.');
  scope.createEl('p', {
    cls: 'los-job-objective',
    text: required ? required.text : workspace.next_action || 'No required-now scope is recorded.',
  });
  button(scope, 'Open workspace context', () => host.openJobPath(workspace.path), 'quiet');

  const upcoming = nextSession(dashboard);
  if (upcoming) {
    const { track, session } = upcoming;
    const next = section(root, 'Next session', track.title);
    const head = next.createDiv({ cls: 'los-card-top' });
    const copy = head.createDiv();
    copy.createDiv({ cls: 'los-kicker', text: `Session ${String(session.number).padStart(2, '0')}` });
    copy.createEl('h3', { text: session.title });
    badge(head, `${track.completedSessions.length}/${track.sessions.length} done`, track.status);
    if (session.concept) next.createEl('p', { text: session.concept });
    const fields: ReadonlyArray<readonly [string, string]> = [
      ['Learn from', session.source],
      ['Stratum angle', session.anchor],
      ['Prove it', session.practice],
    ];
    for (const [label, value] of fields) {
      if (!value) continue;
      const field = next.createDiv({ cls: 'los-job-session-field' });
      field.createEl('strong', { text: label });
      field.createSpan({ text: value });
    }
    const actions = next.createDiv({ cls: 'los-job-session-actions' });
    if (host.logJobSession) {
      button(actions, 'Log a session',
        () => host.logJobSession?.(track.id, session.number), 'cta');
    }
    if (host.markJobSessionDone) {
      button(actions, 'Mark done',
        () => host.markJobSessionDone?.(track.id, session.number), 'quiet');
    }
    button(actions, 'Open complete plan', () => host.openJobPath(track.path), 'quiet');
  }

  const drifted = dashboard.notes.stratum.filter((note) => note.freshness !== 'current');
  if (drifted.length) {
    const queue = section(
      root,
      'Needs re-verifying',
      'A note is trustworthy only relative to a commit. These describe code that has moved since — the judgement of whether the prose still holds stays yours.',
    );
    for (const note of drifted) {
      const row = queue.createDiv({ cls: `los-job-drift los-job-drift--${note.freshness}` });
      const copy = row.createDiv();
      copy.createEl('strong', { text: note.id });
      if (note.component) copy.createDiv({ cls: 'los-detail-id', text: note.component });
      badge(row, note.freshness, note.freshness);
      button(row, 'Open note', () => host.openJobPath(note.path), 'quiet');
    }
  }

  if (workspace.open_questions.length) {
    const questions = section(root, 'Open questions');
    const list = questions.createEl('ul', { cls: 'los-job-question-list' });
    for (const question of workspace.open_questions) list.createEl('li', { text: question });
  }
}

// ------------------------------------------------------------------ System

function renderSystem(
  root: HTMLElement,
  host: JobDashboardHost,
  dashboard: JobDashboard,
): void {
  const map = section(
    root,
    'Stratum, along its own pipeline',
    'Notes sit in the layer they describe. Freshness is re-checked against each note’s recorded commit every time this view opens.',
  );
  const health = map.createDiv({ cls: 'los-job-health' });
  for (const status of ['current', 'drifting', 'stale', 'unverified']) {
    const value = dashboard.notes.health[status] || 0;
    if (value) badge(health, `${value} ${status}`, status);
  }

  const byId = new Map<string, JobNote>();
  for (const note of [...dashboard.notes.skrub, ...dashboard.notes.stratum]) byId.set(note.id, note);

  for (const layer of dashboard.notes.layers) {
    const group = map.createDiv({ cls: 'los-job-layer' });
    const head = group.createDiv({ cls: 'los-card-top' });
    const copy = head.createDiv();
    copy.createEl('h3', { text: layer.title });
    if (layer.summary) copy.createDiv({ cls: 'los-micro', text: layer.summary });
    badge(
      head,
      layer.noteIds.length ? `${layer.noteIds.length} documented` : 'no notes',
      layer.noteIds.length ? 'current' : 'drifting',
    );
    if (!layer.noteIds.length) {
      // An empty layer is the finding, so it is stated rather than skipped.
      group.createEl('p', {
        cls: 'los-muted',
        text: 'No note describes this layer yet.',
      });
      continue;
    }
    const list = group.createDiv({ cls: 'los-job-note-list' });
    for (const id of layer.noteIds) {
      const note = byId.get(id);
      if (note) noteCard(list, host, note);
    }
  }
}

// ----------------------------------------------------------------- Library

function renderLibrary(
  root: HTMLElement,
  host: JobDashboardHost,
  dashboard: JobDashboard,
): void {
  const library = section(
    root,
    'Library',
    'One shelf, ordered by when you need it — not split by whether it happens to be a track, a paper or a book.',
  );

  for (const horizon of HORIZONS) {
    const tracks = dashboard.learning_tracks.filter((item) => item.horizon === horizon);
    const papers = dashboard.papers.filter((item) => item.horizon === horizon);
    const sources = dashboard.canonical_shelf.filter((item) => item.horizon === horizon);
    if (!tracks.length && !papers.length && !sources.length) continue;

    const group = library.createDiv({ cls: `los-job-horizon los-job-horizon--${horizon}` });
    const head = group.createDiv({ cls: 'los-card-top' });
    head.createEl('h3', { text: HORIZON_LABEL[horizon] });
    badge(head, String(tracks.length + papers.length + sources.length), horizon);

    for (const track of tracks) {
      const row = group.createDiv({ cls: 'los-job-material' });
      const top = row.createDiv({ cls: 'los-card-top' });
      const copy = top.createDiv();
      copy.createDiv({ cls: 'los-kicker', text: 'Track' });
      copy.createEl('strong', { text: track.title });
      badge(top, `${track.completedSessions.length}/${track.sessions.length}`, track.status);
      if (track.outcome) row.createEl('p', { text: track.outcome });
      if (track.cadence) row.createDiv({ cls: 'los-micro', text: track.cadence });
      button(row, 'Open complete plan', () => host.openJobPath(track.path), 'quiet');
    }

    for (const paper of papers) {
      const row = group.createDiv({ cls: 'los-job-material' });
      const top = row.createDiv({ cls: 'los-card-top' });
      const copy = top.createDiv();
      copy.createDiv({ cls: 'los-kicker', text: 'Paper' });
      copy.createEl('strong', { text: paper.title });
      const meta = [paper.year, paper.pages ? `${paper.pages} pages` : ''].filter(Boolean).join(' · ');
      if (meta) badge(top, meta, horizon);
      if (paper.authors.length) row.createDiv({ cls: 'los-micro', text: paper.authors.join(', ') });
      if (paper.angle) row.createEl('p', { text: paper.angle });
      button(row, paper.available ? 'Open PDF' : 'PDF unavailable',
        paper.available ? () => host.openJobPath(paper.path) : null, 'quiet');
    }

    for (const source of sources) {
      const row = group.createDiv({ cls: 'los-job-material' });
      const top = row.createDiv({ cls: 'los-card-top' });
      const copy = top.createDiv();
      copy.createDiv({ cls: 'los-kicker', text: 'Book' });
      copy.createEl('strong', { text: source.title });
      if (source.authors.length) row.createDiv({ cls: 'los-micro', text: source.authors.join(', ') });
      if (source.why) row.createEl('p', { text: source.why });
      row.createDiv({
        cls: 'los-job-canon-note',
        text: 'Lives in the LearningOS canon — Job points at it, never the reverse.',
      });
      button(row, 'Open in Library', () => host.openSourceDetail(source.source_id), 'quiet');
    }
  }
}

export function renderJobDashboard(
  root: HTMLElement,
  host: JobDashboardHost,
  dashboard: JobDashboard,
  active: JobTab,
  choose: (tab: JobTab) => void,
): void {
  dashboardHeader(root, dashboard, active, choose);
  if (active === 'system') renderSystem(root, host, dashboard);
  else if (active === 'library') renderLibrary(root, host, dashboard);
  else renderNow(root, host, dashboard);
}
