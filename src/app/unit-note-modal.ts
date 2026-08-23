import { Modal, Notice, type App } from 'obsidian';
import { button, empty, localFilePath, pageHeader } from '../components';
import type { ProjectionRecord } from '../contracts/manifest';
import type { AppSurface } from './surface';
import { asRecords, errorMessage } from '../projection/readers';
import { makeModalAccessible } from '../accessibility/modal';

type UnitNotePlugin = Pick<
  AppSurface,
  | 'gateway'
  | 'getUnitNoteDraft'
  | 'setUnitNoteDraft'
  | 'clearUnitNoteDraft'
  | 'mutate'
>;

/**
 * One note after a learning session, attached to the unit rather than to every
 * selected stage. Text drafts are kept locally until the guarded core command
 * confirms a write. Attachments are selected for the current save only.
 */
export class UnitNoteModal extends Modal {
  private readonly plugin: UnitNotePlugin;
  private readonly unit: ProjectionRecord;
  private readonly studyMap: ProjectionRecord | null;

  private files: File[] = [];
  private recoveredStageIds: string[] = [];
  private referencedStageIds: string[] = [];

  private titleInput!: HTMLInputElement;
  private editor!: HTMLTextAreaElement;
  private fileInput!: HTMLInputElement;
  private fileSummary!: HTMLDivElement;
  private restoreAccessibility: (() => void) | null = null;

  /* Suppresses a second Save on this modal. The gateway's own lock already
   * serialises writes across the app, so `gateway.isBusy` says "someone else
   * is writing" — which is a reason to wait, never a reason to drop authored
   * text on the floor. */
  private saving = false;

  constructor(
    app: App,
    plugin: UnitNotePlugin,
    unit: ProjectionRecord,
    studyMap: ProjectionRecord | null,
  ) {
    super(app);
    this.plugin = plugin;
    this.unit = unit;
    this.studyMap = studyMap;
    this.files = [];
  }

  onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass('los-root', 'los-unit-note-modal');
    const unitId = this.unit.id;
    if (!unitId) {
      empty(root, 'Unit unavailable', 'The projection returned a unit without an identity.');
      return;
    }
    const stages = asRecords(this.studyMap?.stages);
    const draft = this.plugin.getUnitNoteDraft(unitId, stages);
    const recoveredStageIds: string[] = Array.isArray(
      draft.recoveredStageIds,
    )
      ? draft.recoveredStageIds.filter(
        (id: unknown): id is string => typeof id === 'string',
      )
      : [];
    this.recoveredStageIds = recoveredStageIds;
    this.referencedStageIds = [
      ...new Set<string>([
        ...this.unrecordedCompletedStages(stages),
        ...recoveredStageIds,
      ]),
    ];

    pageHeader(root, 'Learning session', 'Add note',
      'Attach one note after the stages you worked through. It belongs to the unit, not to one selected stage.',
      'los-unit-note-heading');
    this.restoreAccessibility = makeModalAccessible(root, {
      close: () => this.close(),
      hostClass: 'los-modal--unit-note',
      initialFocus: () => this.editor ?? null,
      labelledBy: 'los-unit-note-heading',
    });

    const context = root.createDiv({ cls: 'los-unit-note-context' });
    context.createDiv({ cls: 'los-kicker', text: 'Stages covered' });
    if (this.referencedStageIds.length) {
      const names = this.referencedStageIds.map(
        (id: string) => stages.find(
          (stage: ProjectionRecord) => stage.id === id,
        )?.title || id,
      );
      context.createDiv({ text: names.join(' · ') });
    } else {
      context.createDiv({ cls: 'los-micro', text: 'No newly completed stage is required. You may still record a unit-level observation.' });
    }

    this.titleInput = root.createEl('input', {
      cls: 'los-search los-unit-note-title',
      attr: { type: 'text', placeholder: 'Optional note title', 'aria-label': 'Unit note title' },
    });
    this.titleInput.value = draft.title || '';

    this.editor = root.createEl('textarea', {
      cls: 'los-note-editor los-unit-note-editor',
      attr: { placeholder: 'What should remain after this learning session?', 'aria-label': 'Unit learning-session note' },
    });
    this.editor.value = draft.text || '';

    const attachments = root.createDiv({ cls: 'los-unit-note-attachments' });
    attachments.createDiv({ cls: 'los-kicker', text: 'Attachments' });
    this.fileInput = attachments.createEl('input', {
      cls: 'los-file-input',
      attr: { type: 'file', multiple: 'multiple', 'aria-label': 'Choose unit note attachments' },
    });
    this.fileSummary = attachments.createDiv({ cls: 'los-micro', text: 'Optional: handwriting, image, or PDF.' });
    this.fileInput.addEventListener('change', () => {
      this.files = [...(this.fileInput.files || [])];
      this.fileSummary.setText(this.files.length
        ? `${this.files.length} attachment${this.files.length === 1 ? '' : 's'} selected for this save.`
        : 'Optional: handwriting, image, or PDF.');
    });

    const status = root.createDiv({ cls: 'los-draft-status', attr: { 'aria-live': 'polite' } });
    const actions = root.createDiv({ cls: 'los-actions los-unit-note-actions' });
    button(actions, 'Cancel', () => this.close(), 'quiet');
    const saveButton = button(actions, 'Save note', () => this.save(), 'cta');
    const persist = () => {
      this.plugin.setUnitNoteDraft(unitId, this.titleInput.value, this.editor.value);
      const hasNote = Boolean(this.editor.value.trim());
      status.setText(hasNote ? 'Draft kept locally until the core confirms the save.' : 'Write a note to enable saving.');
      status.toggleClass('is-dirty', hasNote);
      saveButton.disabled = !hasNote;
      saveButton.setAttribute('aria-disabled', String(!hasNote));
    };
    this.titleInput.addEventListener('input', persist);
    this.editor.addEventListener('input', persist);
    persist();
  }

  unrecordedCompletedStages(
    stages: ProjectionRecord[],
  ): string[] {
    const already = new Set<string>(
      asRecords(this.unit.note_sections).flatMap(
        (section: ProjectionRecord) => Array.isArray(section.stage_ids)
          ? section.stage_ids.filter(
            (id: unknown): id is string => typeof id === 'string',
          )
          : [],
      ),
    );
    return stages
      .filter(
        (stage: ProjectionRecord) =>
          ['complete', 'skipped'].includes(String(stage.status))
          && typeof stage.id === 'string'
          && !already.has(stage.id),
      )
      .map((stage: ProjectionRecord) => String(stage.id));
  }

  async save() {
    const text = String(this.editor?.value || '');
    if (!text.trim()) { new Notice('Write a note before saving.'); this.editor?.focus(); return; }
    if (this.saving) { new Notice('This note is already being saved.'); return; }
    if (this.plugin.gateway.isBusy) { new Notice('Queued behind the running LearningOS write.'); }
    const unitId = this.unit.id;
    if (!unitId) { new Notice('The unit identity is unavailable. Reload LearningOS and try again.'); return; }
    const filePaths: string[] = this.files
      .map((file: File) => localFilePath(file))
      .filter((value: string) => Boolean(value));
    if (filePaths.length !== this.files.length) {
      new Notice('One selected attachment has no readable local path. Remove it and choose the file again.');
      return;
    }
    this.saving = true;
    try {
      await this.plugin.mutate(() => this.plugin.gateway.saveUnitNote(unitId, {
        title: this.titleInput?.value || '', text, stageIds: this.referencedStageIds, filePaths,
      }));
      this.plugin.clearUnitNoteDraft(unitId, this.recoveredStageIds);
      new Notice('Learning-session note saved.');
      this.close();
    } catch (error: unknown) {
      new Notice(errorMessage(error));
    } finally {
      this.saving = false;
    }
  }

  onClose() {
    this.restoreAccessibility?.();
    this.restoreAccessibility = null;
    this.contentEl.empty();
  }
}
