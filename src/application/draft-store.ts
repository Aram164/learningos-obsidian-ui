export interface UnitNoteDraft {
  readonly title: string;
  readonly text: string;
}

interface UnitDraft { title: string; text: string; }

export interface LearningOSUiDrafts {
  unitNotes: Record<string, UnitDraft>;
  selectedStages: Record<string, string>;
  inbox: { title: string; text: string };
  doneWhen: Record<string, boolean[]>;
}

export interface DraftSettingsHost {
  uiDrafts: LearningOSUiDrafts;
}

export function emptyUiDrafts(): LearningOSUiDrafts {
  return {
    unitNotes: {},
    selectedStages: {},
    inbox: { title: '', text: '' },
    doneWhen: {},
  };
}

export function normalizeUiDrafts(value: Partial<LearningOSUiDrafts> | null | undefined): LearningOSUiDrafts {
  const empty = emptyUiDrafts();
  return {
    unitNotes: value?.unitNotes ?? empty.unitNotes,
    selectedStages: value?.selectedStages ?? empty.selectedStages,
    inbox: value?.inbox ?? empty.inbox,
    doneWhen: value?.doneWhen ?? empty.doneWhen,
  };
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

  getUnitNote(unitId: string): UnitNoteDraft {
    const saved = this.settings.uiDrafts.unitNotes[unitId];
    return {
      title: saved?.title || '',
      text: String(saved?.text || '').trim(),
    };
  }

  setUnitNote(unitId: string, title: string, text: string): void {
    if (!title.trim() && !text.trim()) delete this.settings.uiDrafts.unitNotes[unitId];
    else this.settings.uiDrafts.unitNotes[unitId] = { title, text };
    this.scheduleSave();
  }

  clearUnitNote(unitId: string): void {
    delete this.settings.uiDrafts.unitNotes[unitId];
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

  getInbox(): { title: string; text: string } {
    return { ...this.settings.uiDrafts.inbox };
  }

  setInbox(title: string, text: string): void {
    this.settings.uiDrafts.inbox = { title, text };
    this.scheduleSave();
  }

  clearInbox(): void {
    this.settings.uiDrafts.inbox = { title: '', text: '' };
    this.scheduleSave();
  }
}
