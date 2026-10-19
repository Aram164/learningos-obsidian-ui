import { Modal, type App } from 'obsidian';
import { makeModalAccessible } from '../../accessibility/modal';
import { button } from '../../components';
import type { PlanTemplate } from '../../contracts/plan-template';
import type { UnitMapImportReview } from '../../gateway-client';
import { asString, errorMessage, isRecord } from '../../projection/readers';

function stageIds(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((row) => asString(row)).filter((row): row is string => Boolean(row))
    : [];
}

/**
 * Render Core's preflight answer, in Core's own terms.
 *
 * The diff is the producer's; this names its fields and counts them, and
 * never restates a rule or computes a consequence of its own. A shape it does
 * not recognise is reported as unreadable rather than rendered as "no
 * changes" — an empty review that looks like a clean one is exactly the
 * failure a preflight exists to prevent.
 */
export function renderImportDiff(root: HTMLElement, answer: unknown): boolean {
  root.empty();
  const payload = isRecord(answer) ? answer : null;
  const diff = payload && isRecord(payload.diff) ? payload.diff : null;
  if (!diff || !Array.isArray(diff.stages_after) || !Array.isArray(diff.content_changes)
    || !Array.isArray(diff.map_changes)
    || !diff.stages_after.every(v => typeof v === 'string' && v.length > 0)
    || payload?.canonical_files_written !== 0) {
    root.createDiv({
      cls: 'los-muted',
      text: 'LearningOS answered in a shape this version cannot read. Do not '
        + 'import on the strength of an unread check.',
    });
    return false;
  }
  const added = stageIds(diff.stages_added);
  const retired = stageIds(diff.stages_retired);
  const preserved = stageIds(diff.preserved_stage_state);
  const after = stageIds(diff.stages_after);
  const replacement = diff.replacement === true;

  root.createDiv({
    cls: 'los-kicker',
    text: replacement ? 'This replaces the current map' : 'This creates the first map',
  });
  const list = root.createEl('ul', { cls: 'los-map-import-diff' });
  const line = (text: string) => list.createEl('li', { text });

  line(`${after.length} stage${after.length === 1 ? '' : 's'} after the import.`);
  if (added.length) line(`Adds: ${added.join(', ')}.`);
  if (retired.length) line(`Retires: ${retired.join(', ')}.`);
  if (!added.length && !retired.length && replacement) {
    line('No stage is added or retired.');
  }
  if (diff.relative_order_changed === true) {
    const reason = asString(diff.intentional_reorder_reason);
    line(`Relative order of surviving stages changes${reason ? `: ${reason}` : ''}.`);
  }
  if (preserved.length) {
    line(`Recorded work carried forward on ${preserved.length} stage`
      + `${preserved.length === 1 ? '' : 's'}.`);
  }
  const resume = asString(diff.resume_stage);
  if (resume) line(`Resumes at ${resume}.`);
  const reset = asString(diff.state_reset_reason);
  if (reset) line(`Recorded stage state is reset: ${reset}.`);
  const evidence = stageIds(diff.retired_stage_evidence);
  if (evidence.length) {
    line(`Evidence exists on retired stage${evidence.length === 1 ? '' : 's'}: `
      + `${evidence.join(', ')}.`);
  }
  for (const value of [...diff.content_changes, ...diff.map_changes]) {
    if (!isRecord(value) || ('stage_id' in value && typeof value.stage_id !== 'string') || typeof value.field !== 'string'
      || !('before' in value) || !('after' in value)) return false;
    const change = root.createEl('details');
    change.createEl('summary', { text: `${value.stage_id ?? 'Map'}: ${value.field.replaceAll('_', ' ')}` });
    change.createEl('div', { text: 'Before' });
    change.createEl('pre', { text: JSON.stringify(value.before, null, 2) });
    change.createEl('div', { text: 'After' });
    change.createEl('pre', { text: JSON.stringify(value.after, null, 2) });
  }
  const written = payload?.canonical_files_written;
  root.createDiv({
    cls: 'los-micro los-muted',
    text: written === 0
      ? 'Checked only — nothing was written.'
      : 'LearningOS did not confirm this was a no-write check.',
  });
  return true;
}

/**
 * Apply a study map that has already been reviewed.
 *
 * The SOP gates curriculum plan creation behind a coverage audit
 * (`system/PLAN-CREATION-SOP.md`, Gate 1), and that gate is deliberately a
 * human one. So this dialog does not author a plan: it names the standard the
 * importer will enforce — read from Core, not restated here — and hands one
 * reviewed file to `unit.map.import`, which refuses it whole if it does not
 * meet that standard. Nothing is written by the interface, and nothing
 * partial can land.
 *
 * **Two steps, because naming a file is not approving an import.** Check runs
 * Core's no-write preflight and renders the concrete diff — which stages
 * arrive, which retire, whether the relative order changed, what recorded work
 * is carried forward. Import then applies those same exact bytes. The learner
 * approves *that diff*, and that is what makes this an explicit review rather
 * than a file picker with consequences; it is also what admits the write to a
 * direct gesture at all (review `workbench/audits/repair-review-2026-09-13`,
 * D1). Editing the path after a check discards it: the approval belongs to the
 * bytes that were shown, never to the field.
 */
export class UnitMapImportModal extends Modal {
  private restoreAccessibility: (() => void) | null = null;

  constructor(
    app: App,
    private readonly options: {
      unitId: string;
      unitTitle: string;
      /** True when the unit already has a current map, so this is a replace. */
      replacing: boolean;
      template?: () => Promise<PlanTemplate>;
      check: (file: string, replace: boolean) => Promise<UnitMapImportReview>;
      submit: (review: UnitMapImportReview) => Promise<unknown>;
    },
  ) { super(app); }

  /** The exact bytes a rendered preflight approved, or null before one ran. */
  private checked: UnitMapImportReview | null = null;
  private reviewGeneration = 0;

  onOpen(): void {
    const { replacing, unitTitle } = this.options;
    const root = this.contentEl;
    root.empty();
    root.addClass('los-root', 'los-map-import-modal');
    const heading = root.createEl('h2', {
      text: replacing ? 'Replace study map' : 'Import study map',
    });
    heading.id = 'los-map-import-heading';
    root.createEl('p', {
      cls: 'los-muted',
      text: replacing
        ? `${unitTitle} already has a current map. Review the changes and the recorded work carried forward before replacing it.`
        : `Apply a reviewed study map to ${unitTitle}. The coverage audit stays where the SOP puts it; this applies its result.`,
    });
    this.restoreAccessibility = makeModalAccessible(root, {
      close: () => this.close(),
      hostClass: 'los-modal--map-import',
      labelledBy: heading.id,
    });

    const standard = root.createDiv({
      cls: 'los-muted los-plan-standard',
      attr: { 'aria-live': 'polite' },
    });
    standard.setText('Reading the plan template from LearningOS…');

    const field = root.createDiv({ cls: 'los-map-import-field' });
    field.createEl('label', { text: 'Reviewed map file' });
    const file = field.createEl('input', { attr: { type: 'text' } });
    file.placeholder = 'path to the audited study-map YAML';

    const status = root.createDiv({ cls: 'los-draft-status', attr: { 'aria-live': 'polite' } });
    const preview = root.createDiv({
      cls: 'los-map-import-preview', attr: { 'aria-live': 'polite' },
    });
    const actions = root.createDiv({ cls: 'los-actions los-map-import-actions' });

    const submit = button(actions, replacing ? 'Replace map' : 'Import map', async () => {
      const path = file.value.trim();
      if (!path || !this.checked || path !== this.checked.file) {
        status.setText('Check the file first; the import applies the diff you were shown.');
        return;
      }
      submit.disabled = true;
      status.setText('Importing…');
      try {
        await this.options.submit(this.checked);
        this.close();
      } catch (error: unknown) {
        this.checked = null;
        submit.disabled = true;
        // Core's refusal names which rule failed. Showing it verbatim is the
        // point: a rejected import is the gate working, and the learner needs
        // to know whether to fix the file or the audit.
        status.setText(errorMessage(error));
      }
    }, 'cta');
    submit.disabled = true;

    const check = button(actions, 'Check', async () => {
      const path = file.value.trim();
      if (!path) { status.setText('Name the reviewed file first.'); return; }
      const generation = ++this.reviewGeneration;
      this.checked = null;
      submit.disabled = true;
      check.disabled = true;
      status.setText('Checking — nothing is written…');
      try {
        const answer = await this.options.check(path, replacing);
        if (generation !== this.reviewGeneration || path !== file.value.trim()) return;
        if (answer.file !== path || answer.unitId !== this.options.unitId
          || answer.replace !== replacing || !renderImportDiff(preview, answer.result)) {
          throw new Error('This review could not be read completely. Check again before importing.');
        }
        this.checked = answer;
        submit.disabled = false;
        status.setText('Checked. Review the change below, then import.');
      } catch (error: unknown) {
        if (generation !== this.reviewGeneration) return;
        this.checked = null;
        submit.disabled = true;
        preview.empty();
        status.setText(errorMessage(error));
      } finally {
        check.disabled = false;
      }
    });

    // The approval is to the bytes that were shown, so changing the path
    // withdraws it rather than silently carrying it to a different file.
    file.addEventListener('input', () => {
      this.reviewGeneration += 1;
      this.checked = null;
      submit.disabled = true;
      preview.empty();
      status.setText('File changed — check it again before importing.');
    });

    button(actions, 'Cancel', () => this.close(), 'quiet');

    void this.describeStandard(standard);
    file.focus();
  }

  private async describeStandard(standard: HTMLElement): Promise<void> {
    if (!this.options.template) {
      standard.setText(
        'This host cannot read the plan template; LearningOS still enforces it on import.',
      );
      return;
    }
    try {
      const template = await this.options.template();
      standard.setText(
        `The file must declare plan_template_version ${template.planTemplateVersion}, `
        + `carry stages numbered from one, and satisfy ${template.schema}. `
        + 'LearningOS refuses the whole import otherwise.',
      );
    } catch (error: unknown) {
      standard.setText(
        `Could not read the plan template: ${errorMessage(error)}. `
        + 'LearningOS still enforces it on import.',
      );
    }
  }

  onClose(): void {
    this.reviewGeneration += 1;
    this.checked = null;
    this.restoreAccessibility?.();
    this.restoreAccessibility = null;
    this.contentEl.empty();
  }
}
