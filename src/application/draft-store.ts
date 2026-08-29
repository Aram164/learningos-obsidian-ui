import type { ProjectionRecord } from '../contracts/manifest';
import { asLabel, asString } from '../projection/readers';

export interface RecoveredStageDraft {
  readonly id: string;
  readonly title: string;
  readonly text: string;
}

export interface UnitNoteDraft {
  readonly title: string;
  readonly text: string;
  readonly recoveredStageIds: string[];
  readonly expectedRevisions: Readonly<Record<string, number>>;
}

interface StageDraft { text: string; }
interface UnitDraft {
  title: string;
  text: string;
  expectedRevisions?: Record<string, number>;
}

export interface ComposerDraft { title: string; text: string; }

export interface LearningOSUiDrafts {
  stages: Record<string, StageDraft>;
  unitNotes: Record<string, UnitDraft>;
  selectedStages: Record<string, string>;
  inbox: ComposerDraft;
  /**
   * Garden's composer kept its text in view state only, so an Obsidian restart
   * during an unresolved seed write lost the very draft recovery exists to
   * protect. It is persisted for the same reason the inbox draft is.
   */
  garden: ComposerDraft;
  doneWhen: Record<string, boolean[]>;
}

export interface DraftSettingsHost {
  uiDrafts: LearningOSUiDrafts;
}

export function emptyUiDrafts(): LearningOSUiDrafts {
  return {
    stages: {},
    unitNotes: {},
    selectedStages: {},
    inbox: { title: '', text: '' },
    garden: { title: '', text: '' },
    doneWhen: {},
  };
}

export function normalizeUiDrafts(value: Partial<LearningOSUiDrafts> | null | undefined): LearningOSUiDrafts {
  const empty = emptyUiDrafts();
  return {
    stages: value?.stages ?? empty.stages,
    unitNotes: value?.unitNotes ?? empty.unitNotes,
    selectedStages: value?.selectedStages ?? empty.selectedStages,
    inbox: value?.inbox ?? empty.inbox,
    garden: value?.garden ?? empty.garden,
    doneWhen: value?.doneWhen ?? empty.doneWhen,
  };
}

/**
 * Is this draft still the one that was sent?
 *
 * Trimmed on both sides: the composer keeps what was typed and the envelope
 * carries what was sent, and those differ by whitespace by construction. Any
 * edit with content in it still fails, which is the property that matters —
 * a learner who kept typing while the write ran keeps the newer text.
 */
export function sameComposerDraft(
  draft: ComposerDraft,
  sent: ComposerDraft,
): boolean {
  return draft.text.trim() === sent.text.trim()
    && draft.title.trim() === sent.title.trim();
}

/** UI-owned, recoverable working state. Canonical learning facts never live here. */
export class DraftStore {
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly settings: DraftSettingsHost,
    private readonly persist: () => Promise<void>,
  ) {}

  scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.persist();
    }, 250);
  }

  dispose(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
  }

  stageKey(unitId: string, stageId: string): string {
    return `${unitId}::${stageId}`;
  }

  getStage(unitId: string, stageId: string, savedText = ''): { text: string; dirty: boolean } {
    const entry = this.settings.uiDrafts.stages[this.stageKey(unitId, stageId)];
    return { text: entry?.text ?? savedText, dirty: entry != null && entry.text !== savedText };
  }

  setStage(unitId: string, stageId: string, text: string, savedText = ''): void {
    const key = this.stageKey(unitId, stageId);
    if (text === savedText) delete this.settings.uiDrafts.stages[key];
    else this.settings.uiDrafts.stages[key] = { text };
    this.scheduleSave();
  }

  clearStage(unitId: string, stageId: string): void {
    delete this.settings.uiDrafts.stages[this.stageKey(unitId, stageId)];
    this.scheduleSave();
  }

  getUnitNote(unitId: string, stages: readonly ProjectionRecord[] = []): UnitNoteDraft {
    const saved = this.settings.uiDrafts.unitNotes[unitId];
    const recovered: RecoveredStageDraft[] = [];
    for (const stage of stages) {
      const stageId = asString(stage.id);
      if (!stageId) continue;
      const entry = this.settings.uiDrafts.stages[this.stageKey(unitId, stageId)];
      if (entry?.text?.trim()) recovered.push({ id: stageId, title: asLabel(stage, stageId), text: entry.text });
    }
    const recoveredText = recovered
      .map((row) => `### ${row.title}\n\n${row.text.trim()}`).join('\n\n');
    return {
      title: saved?.title || (recovered.length ? 'Recovered stage drafts' : ''),
      text: [String(saved?.text || '').trim(), recoveredText].filter(Boolean).join('\n\n'),
      recoveredStageIds: recovered.map((row) => row.id),
      expectedRevisions: saved?.expectedRevisions ?? {},
    };
  }

  setUnitNote(
    unitId: string,
    title: string,
    text: string,
    expectedRevisions: Readonly<Record<string, number>> = {},
  ): void {
    if (!title.trim() && !text.trim()) delete this.settings.uiDrafts.unitNotes[unitId];
    else this.settings.uiDrafts.unitNotes[unitId] = {
      title,
      text,
      expectedRevisions: { ...expectedRevisions },
    };
    this.scheduleSave();
  }

  /**
   * `match` makes this safe to call after a write has already resolved.
   *
   * Without it, a learner who kept typing while the note was being saved lost
   * the newer text to the success handler. With it, the clear happens only
   * when the draft is still the one that was sent — which is also what makes
   * repeating the cleanup harmless.
   */
  clearUnitNote(
    unitId: string,
    recoveredStageIds: readonly string[] = [],
    match: { title: string; text: string } | null = null,
  ): void {
    const draft = this.settings.uiDrafts.unitNotes[unitId];
    if (match && draft
      && (draft.text !== match.text
        || String(draft.title || '').trim() !== match.title.trim())) {
      return;
    }
    delete this.settings.uiDrafts.unitNotes[unitId];
    for (const stageId of recoveredStageIds) {
      delete this.settings.uiDrafts.stages[this.stageKey(unitId, stageId)];
    }
    this.scheduleSave();
  }

  getSelectedStage(unitId: string): string | null {
    return this.settings.uiDrafts.selectedStages[unitId] || null;
  }

  setSelectedStage(unitId: string, stageId: string | null): void {
    if (stageId) this.settings.uiDrafts.selectedStages[unitId] = stageId;
    else delete this.settings.uiDrafts.selectedStages[unitId];
    this.scheduleSave();
  }

  getDoneWhen(unitId: string, stageId: string): boolean[] {
    return this.settings.uiDrafts.doneWhen[this.stageKey(unitId, stageId)] || [];
  }

  setDoneWhen(unitId: string, stageId: string, index: number, checked: boolean): void {
    const key = this.stageKey(unitId, stageId);
    const marks = [...(this.settings.uiDrafts.doneWhen[key] || [])];
    marks[index] = checked;
    if (marks.some(Boolean)) this.settings.uiDrafts.doneWhen[key] = marks;
    else delete this.settings.uiDrafts.doneWhen[key];
    this.scheduleSave();
  }

  clearDoneWhen(unitId: string, stageId: string): void {
    delete this.settings.uiDrafts.doneWhen[this.stageKey(unitId, stageId)];
    this.scheduleSave();
  }

  getInbox(): ComposerDraft {
    return { ...this.settings.uiDrafts.inbox };
  }

  setInbox(title: string, text: string): void {
    this.settings.uiDrafts.inbox = { title, text };
    this.scheduleSave();
  }

  /**
   * Compared after trimming, because the composer stores what was typed and
   * the envelope carries what was sent — the two differ by whitespace alone.
   * Any real edit still fails the comparison and keeps the newer text.
   */
  clearInbox(match: ComposerDraft | null = null): void {
    const draft = this.settings.uiDrafts.inbox;
    if (match && !sameComposerDraft(draft, match)) return;
    this.settings.uiDrafts.inbox = { title: '', text: '' };
    this.scheduleSave();
  }

  getGarden(): ComposerDraft {
    return { ...this.settings.uiDrafts.garden };
  }

  setGarden(title: string, text: string): void {
    this.settings.uiDrafts.garden = { title, text };
    this.scheduleSave();
  }

  clearGarden(match: ComposerDraft | null = null): void {
    const draft = this.settings.uiDrafts.garden;
    if (match && !sameComposerDraft(draft, match)) return;
    this.settings.uiDrafts.garden = { title: '', text: '' };
    this.scheduleSave();
  }
}
