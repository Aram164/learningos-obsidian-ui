import { Modal, type App } from 'obsidian';
import { makeModalAccessible } from '../../accessibility/modal';
import { button } from '../../components';
import type {
  JobHorizon,
  JobLearningTrack,
  JobNote,
  JobTask,
} from './model';

function labelledInput(
  parent: HTMLElement,
  label: string,
  value = '',
): HTMLInputElement {
  const field = parent.createDiv({ cls: 'los-job-field' });
  field.createEl('label', { text: label });
  const input = field.createEl('input', { attr: { type: 'text' } });
  input.value = value;
  return input;
}

function labelledTextarea(
  parent: HTMLElement,
  label: string,
  value = '',
  rows = 7,
): HTMLTextAreaElement {
  const field = parent.createDiv({ cls: 'los-job-field' });
  field.createEl('label', { text: label });
  const editor = field.createEl('textarea');
  editor.rows = rows;
  editor.value = value;
  return editor;
}

function labelledSelect<T extends string>(
  parent: HTMLElement,
  label: string,
  value: T,
  options: ReadonlyArray<readonly [T, string]>,
): HTMLSelectElement {
  const field = parent.createDiv({ cls: 'los-job-field' });
  field.createEl('label', { text: label });
  const select = field.createEl('select');
  for (const [optionValue, optionLabel] of options) {
    const option = select.createEl('option', { text: optionLabel });
    option.value = optionValue;
  }
  select.value = value;
  return select;
}

/** Authored choices only; Core owns every canonical plan-stage default. */
export function jobPlanStageDrafts(value: string): Record<string, unknown>[] {
  return value.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [title = '', objective = '', proof = '', link = '', anchor = '']
      = line.split('|').map((part) => part.trim());
    return {
      title,
      objective,
      done_when: proof ? [proof] : [],
      resource_link: link,
      read_only_anchor: anchor,
    };
  });
}

abstract class JobEditorModal extends Modal {
  private restoreAccessibility: (() => void) | null = null;

  protected begin(title: string, detail: string): HTMLElement {
    const root = this.contentEl;
    root.empty();
    root.addClass('los-root', 'los-job-editor-modal');
    const heading = root.createEl('h2', { text: title });
    heading.id = 'los-job-editor-heading';
    root.createEl('p', { cls: 'los-muted', text: detail });
    this.restoreAccessibility = makeModalAccessible(root, {
      close: () => this.close(),
      hostClass: 'los-modal--job-editor',
      labelledBy: heading.id,
    });
    return root;
  }

  protected actions(
    root: HTMLElement,
    label: string,
    save: () => Promise<void>,
  ): void {
    const status = root.createDiv({ cls: 'los-draft-status', attr: { 'aria-live': 'polite' } });
    const actions = root.createDiv({ cls: 'los-actions los-job-editor-actions' });
    const submit = button(actions, label, async () => {
      submit.disabled = true;
      status.setText('Saving…');
      try {
        await save();
        this.close();
      } catch (error: unknown) {
        submit.disabled = false;
        status.setText(error instanceof Error ? error.message : String(error));
      }
    }, 'cta');
    button(actions, 'Cancel', () => this.close(), 'quiet');
  }

  onClose(): void {
    this.restoreAccessibility?.();
    this.restoreAccessibility = null;
    this.contentEl.empty();
  }
}

export class JobTaskModal extends JobEditorModal {
  constructor(
    app: App,
    private readonly options: {
      task?: JobTask;
      tracks: readonly JobLearningTrack[];
      submit: (task: Record<string, unknown>, revision?: number) => Promise<unknown>;
    },
  ) { super(app); }

  onOpen(): void {
    const { task } = this.options;
    const root = this.begin(
      task ? 'Update task' : 'Add task',
      'Keep the action concrete. Horizon decides where it appears; it does not create a deadline.',
    );
    const title = labelledInput(root, 'Task', task?.title || '');
    const details = labelledTextarea(root, 'Details', task?.details || '', 5);
    const horizon = labelledSelect<JobHorizon>(root, 'Horizon', task?.horizon || 'now', [
      ['now', 'Today / now'], ['next', 'Next'], ['later', 'Later'],
    ]);
    const track = labelledSelect(root, 'Linked plan', task?.trackId || '', [
      ['', 'No linked plan'],
      ...this.options.tracks.map((item) => [item.id, item.title] as const),
    ]);
    this.actions(root, task ? 'Save update' : 'Save task', async () => {
      const value = title.value.trim();
      if (!value) throw new Error('Write a task title first.');
      await this.options.submit({
        ...(task ? { id: task.id } : {}),
        title: value,
        details: details.value.trim(),
        horizon: horizon.value,
        status: task?.status || 'open',
        track_id: track.value,
      }, task?.revision);
    });
    title.focus();
  }
}

export class JobPlanModal extends JobEditorModal {
  constructor(
    app: App,
    private readonly options: {
      plan?: JobLearningTrack;
      submit: (plan: Record<string, unknown>, revision?: number) => Promise<unknown>;
    },
  ) { super(app); }

  onOpen(): void {
    const { plan } = this.options;
    const root = this.begin(
      plan ? 'Update study plan' : 'Create study plan',
      'Define the long-term outcome, then make each stage small enough to finish and prove.',
    );
    const title = labelledInput(root, 'Plan name', plan?.title || '');
    const horizon = labelledSelect<JobHorizon>(root, 'Horizon', plan?.horizon || 'now', [
      ['now', 'Use now'], ['next', 'Use next'], ['later', 'Keep for later'],
    ]);
    const cadence = labelledInput(root, 'Cadence', plan?.cadence || 'One stage per week');
    const outcome = labelledTextarea(root, 'Outcome', plan?.outcome || '', 4);
    const stages = plan ? null : labelledTextarea(
      root,
      'Stages — one per line: title | objective | done when | resource link | read-only anchor',
      '',
      10,
    );
    if (plan) {
      root.createEl('p', {
        cls: 'los-muted',
        text: `${plan.stages.length} structured stages are preserved. Open a stage to review its goal, resources, mental models, and proof.`,
      });
    }
    this.actions(root, plan ? 'Save update' : 'Save plan', async () => {
      const planTitle = title.value.trim();
      if (!planTitle) throw new Error('Give the plan a name first.');
      const rows = stages ? jobPlanStageDrafts(stages.value) : [];
      if (!plan && !rows.length) throw new Error('Add at least one stage.');
      await this.options.submit({
        ...(plan ? { id: plan.id } : {}),
        title: planTitle,
        horizon: horizon.value,
        cadence: cadence.value.trim(),
        outcome: outcome.value.trim(),
        status: plan?.status || 'ready',
        stages: plan ? plan.stages.map((stage) => ({
          id: stage.id,
          number: stage.number,
          title: stage.title,
          status: stage.status,
          objective: stage.objective,
          done_when: [...stage.doneWhen],
          ...(stage.estimateMinutes ? { estimate_minutes: stage.estimateMinutes } : {}),
          exam_critical: stage.examCritical,
          concepts: [...stage.concepts],
          scope_triage: stage.scopeTriage,
          resources: stage.resources.map((resource) => ({
            ...(resource.id ? { id: resource.id } : {}),
            kind: resource.kind,
            label: resource.label,
            ...(resource.sourceId ? { source_id: resource.sourceId } : {}),
            ...(resource.locator ? { locator: resource.locator } : {}),
            ...(resource.url ? { url: resource.url } : {}),
            ...(resource.vaultPath ? { vault_path: resource.vaultPath } : {}),
            ...(resource.scopeTriage ? { scope_triage: resource.scopeTriage } : {}),
          })),
          attachments: [],
          source_feedback: [],
          job_context: {
            mental_models: stage.jobContext.mentalModels.map((model) => ({ ...model })),
            read_only_anchor: stage.jobContext.readOnlyAnchor,
            // Round-tripped so an edit to any other field cannot silently drop
            // the stamp drift detection reads. `freshness` is deliberately not
            // sent back: the producer computes it, and echoing it would let a
            // stale client assert a freshness the checkout never confirmed.
            component: [...stage.jobContext.component],
            verified_against: stage.jobContext.verifiedAgainst,
          },
        })) : rows,
      }, plan?.revision);
    });
    title.focus();
  }
}

export class JobNoteModal extends JobEditorModal {
  constructor(
    app: App,
    private readonly options: {
      note?: JobNote;
      submit: (noteId: string, title: string, body: string, revision?: number) => Promise<unknown>;
    },
  ) { super(app); }

  onOpen(): void {
    const { note } = this.options;
    const root = this.begin(
      note ? 'Update note' : 'New learning note',
      'Capture what you learned in your own words. Source stamps remain a separate verification action.',
    );
    const title = labelledInput(root, 'Note title', note?.title || '');
    const body = labelledTextarea(root, 'Working note', note?.body || '', 16);
    this.actions(root, note ? 'Save update' : 'Create note', async () => {
      const noteTitle = title.value.trim();
      const noteBody = body.value.trim();
      if (!noteTitle || !noteBody) throw new Error('A note needs both a title and some text.');
      await this.options.submit(note?.id || '', noteTitle, noteBody, note?.revision);
    });
    title.focus();
  }
}
