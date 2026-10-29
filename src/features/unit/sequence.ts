import { Modal, type App } from 'obsidian';
import { makeModalAccessible } from '../../accessibility/modal';
import { button } from '../../components';
import { errorMessage, isRecord } from '../../projection/readers';
import type { StudyMapView } from './model';

export interface StudySequencePreview {
  readonly snapshot_id: string;
  readonly valid_on_date: string;
  readonly unit_id: string;
  readonly study_map_id: string;
  readonly durable_stage_ids: readonly string[];
  readonly stages: readonly { readonly id: string; readonly title: string; readonly status: string }[];
  readonly omitted_stage_ids: readonly string[];
  readonly prerequisite_edges: readonly { readonly prerequisite_stage_id: string; readonly dependent_stage_id: string }[];
  readonly limitations: readonly string[];
}

export function berlinStudyDay(): string {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(v => typeof v === 'string' && v.length > 0);

/** Refuse incomplete/mixed previews; Core owns all dependency judgments. */
export function readStudySequence(value: unknown, unitId: string, mapId: string, snapshot: string, ids: readonly string[], durableIds: readonly string[]): StudySequencePreview {
  if (!isRecord(value) || value.contract !== 'study-sequence-v1' || value.canonical_files_written !== 0
    || value.timezone !== 'Europe/Berlin' || value.lifetime !== 'unit-view-and-snapshot'
    || value.unit_id !== unitId || value.study_map_id !== mapId || value.snapshot_id !== snapshot
    || value.valid_on_date !== berlinStudyDay() || !strings(value.durable_stage_ids)
    || JSON.stringify(value.durable_stage_ids) !== JSON.stringify(durableIds)
    || !strings(value.omitted_stage_ids) || !strings(value.limitations)
    || !Array.isArray(value.stages) || value.stages.length !== ids.length
    || !value.stages.every((s, i) => isRecord(s) && s.id === ids[i] && typeof s.title === 'string' && typeof s.status === 'string')
    || !Array.isArray(value.prerequisite_edges) || !value.prerequisite_edges.every(e => isRecord(e)
      && typeof e.prerequisite_stage_id === 'string' && typeof e.dependent_stage_id === 'string')
    || JSON.stringify(value.omitted_stage_ids) !== JSON.stringify(durableIds.filter(id => !ids.includes(id)))) {
    throw new Error('The complete temporary sequence could not be verified. Reload and check again.');
  }
  return value as unknown as StudySequencePreview;
}

/** View-owned memory only: never serialized into settings, routes or a file. */
export class TemporaryStudySequence {
  private selected: StudySequencePreview | null = null;
  notice = '';
  get active(): boolean { return this.selected !== null; }
  clear(reason = ''): void { this.selected = null; this.notice = reason; }
  use(preview: StudySequencePreview, snapshot: string | null, stale: boolean, day = berlinStudyDay()): void {
    if (stale || !snapshot || preview.snapshot_id !== snapshot || preview.valid_on_date !== day) {
      throw new Error('The temporary sequence expired. Reload and check it again.');
    }
    this.selected = JSON.parse(JSON.stringify(preview)) as StudySequencePreview;
    this.notice = '';
  }
  current(unitId: string, mapId: string, durableIds: readonly string[], snapshot: string | null, stale: boolean, day = berlinStudyDay()): StudySequencePreview | null {
    const value = this.selected;
    if (value && (stale || value.unit_id !== unitId || value.study_map_id !== mapId || value.snapshot_id !== snapshot
      || value.valid_on_date !== day || JSON.stringify(value.durable_stage_ids) !== JSON.stringify(durableIds))) {
      this.clear('The temporary sequence expired. The full durable plan is shown.');
    }
    return this.selected;
  }
}

export class StudySequenceModal extends Modal {
  private generation = 0;
  private restoreAccessibility: (() => void) | null = null;
  constructor(app: App, private readonly options: {
    studyMap: StudyMapView;
    check: (ids: readonly string[]) => Promise<StudySequencePreview>;
    use: (preview: StudySequencePreview) => Promise<void>;
  }) { super(app); }
  onOpen(): void {
    const root = this.contentEl;
    root.empty(); root.addClass('los-root', 'los-map-import-modal');
    const heading = root.createEl('h2', { text: 'Sequence for this sitting' });
    heading.id = 'los-study-sequence-heading';
    this.restoreAccessibility = makeModalAccessible(root, { close: () => this.close(), hostClass: 'los-modal--map-import', labelledBy: heading.id });
    root.createEl('p', { text: 'Choose stages and their order for this Unit view. The durable plan and recorded work stay unchanged. This choice expires when the snapshot or Berlin date changes, the view closes, or you end the sitting.' });
    const fields = this.options.studyMap.stages.map((stage, i) => {
      const label = root.createEl('label', { text: stage.title });
      const include = label.createEl('input', { attr: { type: 'checkbox', 'aria-label': `Include ${stage.title}` } });
      include.checked = true;
      const position = label.createEl('input', { attr: { type: 'number', min: '1', value: String(i + 1), 'aria-label': `Position of ${stage.title}` } });
      return { id: stage.id, include, position };
    });
    const status = root.createDiv({ attr: { 'aria-live': 'polite' } });
    const preview = root.createDiv({ attr: { 'aria-live': 'polite' } });
    const actions = root.createDiv({ cls: 'los-actions' });
    let checked: StudySequencePreview | null = null;
    const use = button(actions, 'Use for this sitting', async () => {
      if (!checked) return;
      const approved = checked;
      const ticket = ++this.generation;
      checked = null; use.disabled = true;
      try {
        // Recheck against the exact reviewed snapshot; this is another read,
        // never a gateway mutation or refreshed approval.
        const current = await this.options.check(approved.stages.map(s => s.id));
        if (ticket !== this.generation) return;
        if (JSON.stringify(current) !== JSON.stringify(approved)) throw new Error('The preview changed. Check the sequence again.');
        await this.options.use(approved);
        this.close();
      } catch (error) { if (ticket === this.generation) status.setText(errorMessage(error)); }
    }, 'cta');
    use.disabled = true;
    const invalidate = () => { ++this.generation; checked = null; use.disabled = true; preview.empty(); status.setText('Check the temporary sequence before using it.'); };
    for (const field of fields) {
      field.include.addEventListener('change', invalidate);
      field.position.addEventListener('input', invalidate);
    }
    button(actions, 'Check sequence', async () => {
      invalidate(); const ticket = this.generation;
      try {
        const selected = fields.filter(f => f.include.checked).map(f => ({ id: f.id, rank: Number(f.position.value) }));
        if (!selected.length || selected.some(f => !Number.isInteger(f.rank) || f.rank < 1)
          || new Set(selected.map(f => f.rank)).size !== selected.length) throw new Error('Choose at least one stage and distinct positive positions.');
        const answer = await this.options.check(selected.sort((a, b) => a.rank - b.rank).map(f => f.id));
        if (ticket !== this.generation) return;
        preview.createEl('h3', { text: 'Order for this sitting' });
        const order = preview.createEl('ol');
        for (const stage of answer.stages) order.createEl('li', { text: `${stage.title} (${stage.id})` });
        preview.createEl('p', { text: `Omitted for this sitting: ${answer.omitted_stage_ids.join(', ') || 'none'}. Their status is unchanged.` });
        for (const edge of answer.prerequisite_edges) preview.createEl('p', { text: `${edge.prerequisite_stage_id} before ${edge.dependent_stage_id}, unless already recorded complete.` });
        for (const note of answer.limitations) preview.createEl('p', { text: note });
        checked = answer; use.disabled = false;
        status.setText('Checked only. Review the order and omissions, then use it for this sitting.');
      } catch (error) { if (ticket === this.generation) status.setText(errorMessage(error)); }
    });
    button(actions, 'Cancel', () => this.close(), 'quiet');
  }
  onClose(): void { ++this.generation; this.restoreAccessibility?.(); this.restoreAccessibility = null; this.contentEl.empty(); }
}
