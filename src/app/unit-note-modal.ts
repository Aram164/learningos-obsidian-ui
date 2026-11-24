import { Modal, Notice, type App } from 'obsidian';
import { button, empty, localFilePath, pageHeader } from '../components';
import type { UnitNoteDraft } from '../application/draft-store';
import type { ProjectionRecord } from '../contracts/manifest';
import type { GatewayClient } from '../gateway-client';
import type { ManifestStore } from '../manifest-store';
import { asRecords, errorMessage } from '../projection/readers';
import { makeModalAccessible } from '../accessibility/modal';

type UnitNotePlugin = {
  readonly gateway: Pick<GatewayClient, 'isBusy' | 'saveUnitNote'>;
  readonly store: Pick<ManifestStore, 'artifactGuard'>
    & Partial<Pick<ManifestStore, 'get' | 'mapForUnit'>>;
  getUnitNoteDraft(unitId: string, stages?: ProjectionRecord[]): UnitNoteDraft;
  setUnitNoteDraft(
    unitId: string,
    title: string,
    text: string,
    expectedRevisions?: Readonly<Record<string, number>>,
    recoveredStages?: Readonly<Record<string, string>>,
  ): void;
  clearUnitNoteDraft(
    unitId: string,
    recoveredStages?: Readonly<Record<string, string>>,
    match?: { title: string; text: string } | null,
  ): void;
  mutate<T>(action: () => T | PromiseLike<T>): Promise<T>;
};

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
  private recoveredStages: Readonly<Record<string, string>> = {};
  private referencedStageIds: string[] = [];
  private expectedRevisions: Readonly<Record<string, number>> = {};

  private titleInput!: HTMLInputElement;
  private editor!: HTMLTextAreaElement;
  private fileInput!: HTMLInputElement;
  private fileSummary!: HTMLDivElement;
  private stageSummary!: HTMLDivElement;
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
    this.expectedRevisions = this.plugin.store.artifactGuard(unitId);
    const liveUnit = this.plugin.store.get?.(unitId) ?? this.unit;
    const liveStudyMap = this.plugin.store.mapForUnit?.(unitId) ?? this.studyMap;
    const stages = asRecords(liveStudyMap?.stages);
    const validStageIds = new Set(
      stages
        .map((stage: ProjectionRecord) => stage.id)
        .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0),
    );
    const draft = this.plugin.getUnitNoteDraft(unitId, stages);
    const recoveredStageIds: string[] = Array.isArray(draft.recoveredStageIds)
      ? draft.recoveredStageIds.filter((id: unknown): id is string => typeof id === 'string')
      : [];
    const rawRecovered = draft.recoveredStages || {};
    const validRecoveredStages: Record<string, string> = {};
    for (const [stageId, text] of Object.entries(rawRecovered)) {
      if (validStageIds.has(stageId)) validRecoveredStages[stageId] = text;
    }
    const validRecoveredIds = recoveredStageIds.filter((id) => validStageIds.has(id));
    const droppedStageIds = [
      ...new Set([
        ...recoveredStageIds.filter((id) => !validStageIds.has(id)),
        ...Object.keys(rawRecovered).filter((id) => !validStageIds.has(id)),
      ]),
    ];
    this.recoveredStages = validRecoveredStages;
    if (droppedStageIds.length && (draft.title.trim() || draft.text.trim())) {
      this.plugin.setUnitNoteDraft(
        unitId,
        draft.title,
        draft.text,
        this.expectedRevisions,
        this.recoveredStages,
      );
      new Notice(`Removed retired stage reference(s) from this note draft: ${droppedStageIds.join(', ')}.`);
    }
    this.referencedStageIds = [
      ...new Set<string>([
        ...this.unrecordedCompletedStages(stages, liveUnit),
        ...validRecoveredIds,
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
    this.stageSummary = context.createDiv();
    this.renderStageSummary(stages);
    if (droppedStageIds.length) {
      context.createDiv({
        cls: 'los-micro',
        text: `Retired stage reference(s) removed after study-map update: ${droppedStageIds.join(', ')}.`,
      });
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
      this.expectedRevisions = this.plugin.store.artifactGuard(unitId);
      this.plugin.setUnitNoteDraft(
        unitId,
        this.titleInput.value,
        this.editor.value,
        this.expectedRevisions,
        this.recoveredStages,
      );
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

  private renderStageSummary(stages: ProjectionRecord[]): void {
    if (!this.stageSummary) return;
    this.stageSummary.empty();
    if (this.referencedStageIds.length) {
      const names = this.referencedStageIds.map(
        (id: string) => stages.find(
          (stage: ProjectionRecord) => stage.id === id,
        )?.title || id,
      );
      this.stageSummary.setText(names.join(' · '));
    } else {
      this.stageSummary.addClass('los-micro');
      this.stageSummary.setText('No newly completed stage is required. You may still record a unit-level observation.');
    }
  }

  unrecordedCompletedStages(
    stages: ProjectionRecord[],
    unit: ProjectionRecord = this.unit,
  ): string[] {
    const already = new Set<string>(
      asRecords(unit.note_sections).flatMap(
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
          stage.is_open === false
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
    this.expectedRevisions = this.plugin.store.artifactGuard(unitId);
    const liveStudyMap = this.plugin.store.mapForUnit?.(unitId) ?? this.studyMap;
    const liveStages = asRecords(liveStudyMap?.stages);
    const validStageIds = new Set(
      liveStages
        .map((stage: ProjectionRecord) => stage.id)
        .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0),
    );
    const dropped = this.referencedStageIds.filter((id) => !validStageIds.has(id));
    if (dropped.length) {
      this.referencedStageIds = this.referencedStageIds.filter((id) => validStageIds.has(id));
      const nextRecovered: Record<string, string> = {};
      for (const [stageId, value] of Object.entries(this.recoveredStages)) {
        if (validStageIds.has(stageId)) nextRecovered[stageId] = value;
      }
      this.recoveredStages = nextRecovered;
      this.renderStageSummary(liveStages);
      new Notice(`Removed retired stage reference(s) before saving: ${dropped.join(', ')}.`);
    }
    this.saving = true;
    try {
      const sent = { title: this.titleInput?.value || '', text };
      await this.plugin.mutate(() => this.plugin.gateway.saveUnitNote(unitId, {
        ...sent, stageIds: this.referencedStageIds, filePaths,
      }, this.expectedRevisions));
      // The confirmed write already cleared this draft if it was still the
      // note that was sent; the match keeps the repeat from taking a newer one.
      this.plugin.clearUnitNoteDraft(unitId, this.recoveredStages, sent);
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
