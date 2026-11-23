import { button } from '../../components';
import type { AppSurface } from '../../app/surface';
import type { ProjectionRecord } from '../../contracts/manifest';
import type { PracticeContextWire } from '../../contracts/generated/responses.types';
import { asLabel, asString, asStrings, errorMessage } from '../../projection/readers';

type PracticePlugin = Pick<AppSurface, 'gateway' | 'mutate' | 'store'> & {
  readonly nav: Pick<AppSurface['nav'], 'openRecord'>;
};

type PracticeItem = PracticeContextWire['items'][number];

const METHODS = [
  ['source-matched', 'official-source', 'Match an official answer'],
  ['cross-checked', 'independent-solve', 'Compare an independent solution'],
  ['confirmed', 'explicit-review', 'Confirm the answer after review'],
  ['disputed', 'explicit-review', 'Mark the answer disputed'],
  ['unverified', 'explicit-review', 'Mark the answer unverified'],
] as const;

const SHA256 = /^[a-f0-9]{64}$/;

function control<T extends 'input' | 'select'>(parent: HTMLElement, name: string, tag: T) {
  const label = parent.createEl('label', { cls: 'los-atlas-practice-field' });
  label.createSpan({ text: name });
  return label.createEl(tag);
}

function renderVerification(
  parent: HTMLElement,
  plugin: PracticePlugin,
  note: ProjectionRecord,
  context: PracticeContextWire,
  item: PracticeItem,
  done: () => Promise<void>,
): void {
  const fields = parent.createDiv({ cls: 'los-atlas-practice-fields' });
  button(fields, 'Open note to review answer', () => plugin.nav.openRecord(note), 'quiet');

  const method = control(fields, 'Verification method', 'select');
  method.createEl('option', { text: 'Choose a method', attr: { value: '' } });
  for (const [status, , title] of METHODS) {
    method.createEl('option', { text: title, attr: { value: status } });
  }
  const reviewer = control(fields, 'Reviewer ID', 'input');
  const artifact = control(fields, 'Review artifact SHA-256', 'input');
  const comparisonFields = fields.createDiv({ cls: 'los-atlas-practice-fields' });
  comparisonFields.hidden = true;
  const comparison = control(comparisonFields, 'Independent comparison SHA-256', 'input');

  const official = fields.createDiv({ cls: 'los-atlas-practice-fields' });
  official.hidden = true;
  const source = control(official, 'Primary evidence source', 'select');
  source.createEl('option', { text: 'Choose a linked source', attr: { value: '' } });
  for (const id of asStrings(note.sources)) {
    const record = plugin.store.get(id);
    if (record?.type !== 'source') continue;
    source.createEl('option', { text: asLabel(record, id), attr: { value: id } });
  }
  const path = control(official, 'PDF path relative to materials', 'input');
  const digest = control(official, 'PDF SHA-256', 'input');
  const page = control(official, 'Physical PDF page', 'input');
  page.setAttrs({ type: 'number', min: '1', step: '1' });
  const quote = control(official, 'Evidence excerpt', 'input');
  quote.setAttribute('maxlength', '240');
  method.addEventListener('change', () => {
    official.hidden = method.value !== 'source-matched';
    comparisonFields.hidden = method.value !== 'cross-checked';
  });
  source.addEventListener('change', () => {
    const pathHint = asString(plugin.store.get(source.value)?.material_path);
    path.value = pathHint?.startsWith('materials/') ? pathHint.slice('materials/'.length) : '';
    digest.value = '';
    page.value = '';
    quote.value = '';
  });

  const feedback = parent.createEl('p', { cls: 'los-micro', attr: { role: 'status' } });
  const review = parent.createDiv({ cls: 'los-atlas-practice-fields' });
  const preview = button(fields, 'Preview verification', () => {
    const selection = METHODS.find(([status]) => status === method.value);
    if (!selection || !reviewer.value.trim() || !SHA256.test(artifact.value.trim())) {
      feedback.setText('Choose a method and enter the reviewer ID and review artifact SHA-256.');
      return;
    }
    const [new_status, proofMethod] = selection;
    const pageNumber = Number(page.value);
    const excerpt = quote.value.trim();
    if (new_status === 'source-matched' && (!source.value || !path.value.trim()
        || !SHA256.test(digest.value.trim()) || !Number.isSafeInteger(pageNumber) || pageNumber < 1
        || !excerpt || excerpt.length > 240)) {
      feedback.setText('Select a source and enter the PDF path, SHA-256, physical page and excerpt.');
      return;
    }
    if (new_status === 'cross-checked' && !SHA256.test(comparison.value.trim())) {
      feedback.setText('Enter the SHA-256 of the reviewed independent comparison.');
      return;
    }
    const record = {
      item_id: item.item_id,
      expected_old: item.stored_row,
      new_status,
      method: proofMethod,
      concept_ids: item.concept_ids,
      artifact_sha256: artifact.value.trim(),
      reviewer_id: reviewer.value.trim(),
      ...(new_status === 'source-matched' ? {
        source_binding: {
          source_id: source.value, material_relpath: path.value.trim(),
          file_sha256: digest.value.trim(), page: pageNumber, quote: excerpt,
        },
      } : {}),
      ...(new_status === 'cross-checked' ? { comparison_sha256: comparison.value.trim() } : {}),
    };
    feedback.setText('');
    fields.hidden = true;
    review.empty();
    const { expected_old: previous, ...proposed } = record;
    review.createEl('p', {
      text: `Record one verification for ${item.item_id} (${item.kind}). Stored status: ${previous?.status ?? 'unverified'}.`,
    });
    review.createEl('pre', { text: JSON.stringify(proposed, null, 2) });
    const edit = button(review, 'Edit verification', () => {
      review.empty();
      fields.hidden = false;
      preview.focus();
    }, 'quiet');
    const confirm = button(review, 'Confirm and record', async () => {
      if (confirm.disabled) return;
      confirm.disabled = true;
      edit.disabled = true;
      feedback.setText('Recording verification…');
      try {
        await plugin.mutate(() => plugin.gateway.recordPracticeVerification(record, context));
      } catch (error: unknown) {
        feedback.setText(errorMessage(error));
        confirm.disabled = false;
        edit.disabled = false;
        return;
      }
      await done();
    }, 'cta');
    confirm.focus();
  }, 'quiet');
}

export function renderPracticeReview(parent: HTMLElement, plugin: PracticePlugin, note: ProjectionRecord): void {
  const noteId = asString(note.id);
  if (!noteId || (note.role !== 'exercise-bank' && note.role !== 'mock-exam')) return;

  const result = parent.createDiv({ cls: 'los-atlas-practice-results', attr: { 'aria-live': 'polite' } });
  const load = async (recorded = false): Promise<void> => {
    loadButton.disabled = true;
    result.empty();
    result.createEl('p', { cls: 'los-micro', text: recorded ? 'Verification recorded. Refreshing items…' : 'Loading practice items…' });
    try {
      const snapshot = plugin.store.snapshotId;
      if (!snapshot || plugin.store.stale) throw new Error('Rebuild the current views before reviewing practice.');
      const context = await plugin.gateway.practiceContext(noteId, snapshot);
      if (plugin.store.snapshotId !== snapshot || plugin.store.stale) throw new Error('The LearningOS snapshot changed. Reload practice items.');
      result.empty();
      if (recorded) result.createEl('p', { cls: 'los-micro', text: 'Verification recorded.' });
      for (const diagnostic of context.diagnostics) result.createEl('p', { cls: 'los-micro', text: diagnostic });
      if (!context.items.length && !context.diagnostics.length) {
        result.createEl('p', { cls: 'los-micro', text: 'No supported practice items in this note.' });
      }
      for (const item of context.items) {
        const row = result.createDiv({ cls: 'los-atlas-practice-item' });
        row.createEl('strong', { text: `${item.item_id} · ${item.kind} · ${item.status}` });
        for (const reason of item.ineligibility) row.createEl('p', { cls: 'los-micro', text: reason });
        if (context.diagnostics.length) continue;
        let rendered = false;
        const toggle = button(row, 'Record verification', () => {
          form.hidden = !form.hidden;
          toggle.setAttribute('aria-expanded', String(!form.hidden));
          if (!form.hidden && !rendered) {
            rendered = true;
            renderVerification(form, plugin, note, context, item, () => load(true));
            form.querySelectorAll?.<HTMLElement>('select')[0]?.focus();
          }
        }, 'quiet');
        toggle.setAttribute('aria-expanded', 'false');
        const form = row.createDiv({ cls: 'los-atlas-practice-form' });
        form.hidden = true;
      }
    } catch (error: unknown) {
      result.empty();
      result.createEl('p', { text: `${recorded ? 'Verification recorded. ' : ''}${errorMessage(error)}` });
    } finally {
      loadButton.disabled = false;
    }
  };
  const loadButton = button(parent, 'Load practice items', () => load(), 'tertiary');
}
