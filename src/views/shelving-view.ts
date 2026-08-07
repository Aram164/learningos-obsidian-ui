import { ItemView, Notice, type WorkspaceLeaf } from 'obsidian';
import { button, empty, pageHeader, section, unitCard } from '../components';
import { VIEW_SHELVING } from '../constants';
import type { ProjectionRecord } from '../contracts/manifest-v2';
import type { LearningOSUI } from '../main';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface ShelvingViewState {
  unitId?: string | null;
}

interface ShelvingProposalItem {
  readonly id: string;
  readonly title: string;
  readonly destination?: string | undefined;
  readonly rationale?: string | undefined;
  readonly diff?: string | undefined;
  readonly selected?: boolean | undefined;
}

interface ShelvingProposal {
  readonly state: 'proposed';
  readonly summary?: string | undefined;
  readonly items: readonly ShelvingProposalItem[];
}

type ShelvingPlugin = Pick<
  LearningOSUI,
  | 'askAiScoped'
  | 'gateway'
  | 'mutate'
  | 'openModule'
  | 'openUnit'
  | 'store'
>;

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
  );
}

function optionalString(
  value: unknown,
): string | undefined {
  return typeof value === 'string'
    ? value
    : undefined;
}

function readShelvingProposal(
  value: unknown,
): ShelvingProposal | null {
  if (
    !isRecord(value)
    || value.state !== 'proposed'
    || !Array.isArray(value.items)
  ) {
    return null;
  }

  const items: ShelvingProposalItem[] = [];

  for (const candidate of value.items) {
    if (
      !isRecord(candidate)
      || typeof candidate.id !== 'string'
      || typeof candidate.title !== 'string'
    ) {
      continue;
    }

    const item: ShelvingProposalItem = {
      id: candidate.id,
      title: candidate.title,
      destination: optionalString(candidate.destination),
      rationale: optionalString(candidate.rationale),
      diff: optionalString(candidate.diff),
      selected:
        typeof candidate.selected === 'boolean'
          ? candidate.selected
          : undefined,
    };

    items.push(item);
  }

  return {
    state: 'proposed',
    summary: optionalString(value.summary),
    items,
  };
}

export class ShelvingView extends ItemView {
  private readonly plugin: ShelvingPlugin;
  private unitId: string | null = null;
  private proposal: ShelvingProposal | null = null;
  private readonly selected = new Set<string>();

  constructor(
    leaf: WorkspaceLeaf,
    plugin: ShelvingPlugin,
  ) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() { return VIEW_SHELVING; }
  getDisplayText() { return 'LearningOS · Shelving'; }
  async setState(
    state: ShelvingViewState = {},
  ): Promise<void> {
    if (typeof state.unitId === 'string') {
      this.unitId = state.unitId;
    }

    await this.loadProposal();
    this.render();
  }

  getState(): ShelvingViewState {
    return { unitId: this.unitId };
  }

  async onOpen(): Promise<void> {
    const unitId = this.leaf.state?.unitId;

    if (typeof unitId === 'string') {
      this.unitId = unitId;
    }

    await this.loadProposal();
    this.render();
  }

  async loadProposal(): Promise<void> {
    if (!this.unitId) {
      this.proposal = null;
      return;
    }

    const map = this.plugin.store.mapForUnit(this.unitId);
    this.proposal = readShelvingProposal(map?.shelving);
  }

  render(): void {
    const root = this.contentEl;
    root.empty();
    root.addClass('los-root', 'los-shelving-view');

    const unit = this.unitId
      ? this.plugin.store.get(this.unitId)
      : null;
    pageHeader(root, 'Approval gate', 'Shelving',
      unit ? `${unit.title}: review durable changes before the gateway applies them.` : 'Choose a unit that is ready to shelve.');
    if (!unit) { this.renderQueue(root); return; }
    const map = this.plugin.store.mapForUnit(unit.id);
    const proposal = this.proposal
      ?? readShelvingProposal(map?.shelving);
    if (!proposal?.items?.length) {
      const wrap = section(root, 'No proposal yet');
      empty(wrap, 'Prepare a deterministic proposal',
        'The gateway derives candidates from this unit. AI may explain them, but cannot apply canonical changes.',
        'Prepare proposal', () => this.prepare());
      button(wrap, 'Ask AI to explain shelving criteria', () => this.plugin.askAiScoped(
        'Explain which stage notes might be durable. Do not write or apply canonical changes.',
        { moduleId: unit.module_id, unitId: unit.id }), 'quiet');
      return;
    }
    if (!this.selected.size) {
      for (const item of proposal.items) if (item.selected !== false) this.selected.add(item.id);
    }
    const summary = section(root, 'Proposed changes', proposal.summary || 'Select only changes you want to apply.');
    for (const item of proposal.items) {
      const row = summary.createDiv({ cls: 'los-proposal-row' });
      const toggle = row.createEl('input', { attr: { type: 'checkbox', 'aria-label': `Select ${item.title}` } });
      toggle.checked = this.selected.has(item.id);
      toggle.addEventListener('change', () => {
        if (toggle.checked) this.selected.add(item.id); else this.selected.delete(item.id);
      });
      const copy = row.createDiv();
      copy.createEl('h3', { text: item.title });
      if (item.destination) copy.createDiv({ cls: 'los-detail-id', text: item.destination });
      if (item.rationale) copy.createEl('p', { text: item.rationale });
      if (item.diff) copy.createEl('pre', { cls: 'los-proposal-diff', text: item.diff });
    }
    const guard = root.createDiv({ cls: 'los-validation-preview' });
    guard.createEl('strong', { text: 'Apply is explicit and selected-only.' });
    guard.createEl('p', { text: 'The core validates and regenerates atomically; broad AI writes are never accepted.' });
    const actions = root.createDiv({ cls: 'los-actions' });
    button(actions, 'Approve selected changes', () => this.apply(), 'cta');
    button(actions, 'Ask AI to review proposal', () => this.plugin.askAiScoped(
      `Review these shelving proposal IDs: ${[...this.selected].join(', ')}. Do not apply changes.`,
      { moduleId: unit.module_id, unitId: unit.id }), 'quiet');
  }

  renderQueue(root: HTMLElement): void {
    const wrap = section(root, 'Ready to shelve');
    const rows = this.plugin.store.units().filter(
      (row: ProjectionRecord) => row.status === 'ready-to-shelve',
    );
    if (!rows.length) empty(wrap, 'No unit is waiting', 'Keep working from any active unit.');
    for (const unit of rows) unitCard(wrap, this.plugin, unit);
  }

  async prepare(): Promise<void> {
    const unitId = this.unitId;

    if (!unitId) {
      new Notice('Choose a unit before preparing shelving.');
      return;
    }

    try {
      await this.plugin.mutate(
        () => this.plugin.gateway.prepareShelving(unitId),
      );
      await this.loadProposal();
      this.render();
    } catch (error: unknown) {
      new Notice(errorMessage(error));
    }
  }

  async apply(): Promise<void> {
    const unitId = this.unitId;

    if (!unitId) {
      new Notice('Choose a unit before applying shelving.');
      return;
    }

    if (!this.selected.size) {
      new Notice('Select at least one proposal.');
      return;
    }

    try {
      await this.plugin.mutate(
        () => this.plugin.gateway.applyShelving(
          unitId,
          [...this.selected],
        ),
      );
      this.proposal = null;
      this.selected.clear();
      this.render();
    } catch (error: unknown) {
      new Notice(errorMessage(error));
    }
  }
}
