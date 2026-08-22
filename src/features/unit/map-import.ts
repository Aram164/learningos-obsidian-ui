import { Modal, type App } from 'obsidian';
import { makeModalAccessible } from '../../accessibility/modal';
import { button } from '../../components';
import type { PlanTemplate } from '../../contracts/plan-template';
import { errorMessage } from '../../projection/readers';

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
      submit: (file: string, replace: boolean) => Promise<unknown>;
    },
  ) { super(app); }

  onOpen(): void {
    const { replacing, unitTitle } = this.options;
    const root = this.contentEl;
    root.empty();
    root.addClass('los-root', 'los-job-editor-modal');
    const heading = root.createEl('h2', {
      text: replacing ? 'Replace study map' : 'Import study map',
    });
    heading.id = 'los-map-import-heading';
    root.createEl('p', {
      cls: 'los-muted',
      text: replacing
        ? `${unitTitle} already has a current map. Importing archives the old one in Git and makes this the current map.`
        : `Apply a reviewed study map to ${unitTitle}. The coverage audit stays where the SOP puts it; this applies its result.`,
    });
    this.restoreAccessibility = makeModalAccessible(root, {
      close: () => this.close(),
      hostClass: 'los-modal--job-editor',
      labelledBy: heading.id,
    });

    const standard = root.createDiv({
      cls: 'los-muted los-plan-standard',
      attr: { 'aria-live': 'polite' },
    });
    standard.setText('Reading the plan template from LearningOS…');

    const field = root.createDiv({ cls: 'los-job-field' });
    field.createEl('label', { text: 'Reviewed map file' });
    const file = field.createEl('input', { attr: { type: 'text' } });
    file.placeholder = 'path to the audited study-map YAML';

    const status = root.createDiv({ cls: 'los-draft-status', attr: { 'aria-live': 'polite' } });
    const actions = root.createDiv({ cls: 'los-actions los-job-editor-actions' });
    const submit = button(actions, replacing ? 'Replace map' : 'Import map', async () => {
      const path = file.value.trim();
      if (!path) { status.setText('Name the reviewed file first.'); return; }
      submit.disabled = true;
      status.setText('Importing…');
      try {
        await this.options.submit(path, replacing);
        this.close();
      } catch (error: unknown) {
        submit.disabled = false;
        // Core's refusal names which rule failed. Showing it verbatim is the
        // point: a rejected import is the gate working, and the learner needs
        // to know whether to fix the file or the audit.
        status.setText(errorMessage(error));
      }
    }, 'cta');
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
    this.restoreAccessibility?.();
    this.restoreAccessibility = null;
    this.contentEl.empty();
  }
}
