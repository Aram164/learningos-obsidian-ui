import { badge, cardTop, section } from '../../components';
import { noteCard } from './cards';
import type { JobDashboardHost } from './host';
import type { JobDashboard, JobNote } from './model';

const HEALTH_ORDER: readonly string[] = ['current', 'drifting', 'stale', 'unverified'];

function renderHealth(
  parent: HTMLElement,
  health: Readonly<Record<string, number>>,
): void {
  const row = parent.createDiv({ cls: 'los-job-health' });
  for (const status of HEALTH_ORDER) {
    const value = health[status] || 0;
    if (value) badge(row, `${value} ${status}`, status);
  }
}

/**
 * Notes sit in the pipeline layer they describe. An empty layer is published
 * rather than skipped, because "nothing documents this stage" is a finding.
 */
function renderLayer(
  parent: HTMLElement,
  host: JobDashboardHost,
  layer: JobDashboard['notes']['layers'][number],
  byId: ReadonlyMap<string, JobNote>,
): void {
  const group = parent.createDiv({ cls: 'los-job-layer' });
  const head = cardTop(group, layer.title, layer.summary);

  if (!layer.noteIds.length) {
    group.createEl('p', { cls: 'los-muted', text: 'No note describes this layer yet.' });
    return;
  }

  badge(head, `${layer.noteIds.length} documented`, 'current');
  const list = group.createDiv({ cls: 'los-job-notes' });
  for (const id of layer.noteIds) {
    const note = byId.get(id);
    if (note) noteCard(list, host, note);
  }
}

export function renderSystem(
  root: HTMLElement,
  host: JobDashboardHost,
  dashboard: JobDashboard,
): void {
  const map = section(root, 'Stratum pipeline');
  renderHealth(map, dashboard.notes.health);

  const byId = new Map<string, JobNote>();
  for (const note of [...dashboard.notes.skrub, ...dashboard.notes.stratum]) {
    byId.set(note.id, note);
  }

  for (const layer of dashboard.notes.layers) renderLayer(map, host, layer, byId);
}
