import { manifestFreshness } from '../components';
import { ItemView, Notice, type WorkspaceLeaf } from 'obsidian';
import { badge, button, disclosure, empty, pageHeader, section, unitCard } from '../components';
import { VIEW_SHELVING } from '../constants';
import type { ProjectionRecord } from '../contracts/manifest';
import type { AppSurface } from '../app/surface';
import type { AppNavigator } from '../app/navigator';
import { errorMessage } from '../projection/readers';
import { readShelvingPacket, shelvingKindLabel, type ShelvingProposalItem } from '../features/shelving/proposal';
import {
  reconcile, reconciliationSummary, selectedIds, type ReconciledItem, type Reconciliation,
} from '../features/shelving/selection';

interface ShelvingViewState {
  unitId?: string | null;
}

type ShelvingPlugin = Pick<
  AppSurface,
  | 'askAiScoped'
  | 'gateway'
  | 'mutate'
  | 'shelvingChoices'
  | 'store'
> & {
  readonly nav: Pick<
    AppNavigator,
    | 'openModule'
    | 'openUnit'
  >;
};

/** What one render showed: the approval and Prepare act on exactly this. */
interface ShownSnapshot {
  readonly unitId: string;
  readonly snapshotId: string | null;
  readonly guard: Readonly<Record<string, number>>;
  readonly items: readonly ShelvingProposalItem[];
}

const CONTENT_PREVIEW_LINES = 12;

/** Raised inside the write queue when the projection moved on after the click. */
const PROPOSAL_MOVED = 'The proposal changed before your approval was sent. Nothing was written; review the current proposal and approve again.';

export class ShelvingView extends ItemView {
  private readonly plugin: ShelvingPlugin;
  private unitId: string | null = null;

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
    this.render();
  }

  getState(): ShelvingViewState {
    return { unitId: this.unitId };
  }

  async onOpen(): Promise<void> {
    const unitId = this.leaf.getViewState().state?.unitId;

    if (typeof unitId === 'string') {
      this.unitId = unitId;
    }
    this.render();
  }

  /**
   * One store read per render. The items on screen, the guard and the snapshot
   * the approval carries all come from it, so the text approved is the text
   * shown (Plan B S3). There is no proposal cache to drift from the guard.
   */
  render(): void {
    const root = this.contentEl;
    root.empty();
    manifestFreshness(root, this.plugin.store);
    root.addClass('los-root', 'los-shelving-view');

    const unit = this.unitId
      ? this.plugin.store.get(this.unitId)
      : null;
    pageHeader(root, 'Approval gate', 'Shelving',
      unit ? `${unit.title}: review durable changes before the gateway applies them.` : 'Choose a unit that is ready to shelve.');
    if (!unit) { this.renderQueue(root); return; }
    if (!unit.id) { empty(root, 'Unit unavailable', 'The projection returned a unit without an identity.'); return; }
    const map = this.plugin.store.mapForUnit(unit.id);
    const packet = readShelvingPacket(map?.shelving);
    const shown: ShownSnapshot = {
      unitId: unit.id,
      snapshotId: this.plugin.store.snapshotId,
      guard: this.plugin.store.artifactGuard(unit.id, typeof map?.id === 'string' ? map.id : null),
      items: packet.state === 'proposed' ? packet.items : [],
    };
    if (packet.state === 'draft') { this.renderDraft(root, unit, packet.proposalPath, packet.summary); return; }
    if (packet.state === 'none') { this.renderEmpty(root, unit, shown); return; }

    const choices = this.plugin.shelvingChoices;
    choices.keepOnly(unit.id, new Set(packet.items.map((item) => item.id)));
    const reconciliation = reconcile(packet.items, choices.choicesFor(unit.id));
    const summary = section(root, 'Proposed changes', packet.summary || 'Select only changes you want to apply.');
    const changes = reconciliationSummary(reconciliation);
    if (changes) summary.createEl('p', { cls: 'los-shelving-reconcile', text: changes, attr: { role: 'status' } });
    for (const row of reconciliation.rows) this.renderItem(summary, unit.id, reconciliation, row);
    const guard = root.createDiv({ cls: 'los-validation-preview' });
    guard.createEl('strong', { text: 'Apply is explicit and selected-only.' });
    guard.createEl('p', { text: 'The core validates and regenerates atomically; broad AI writes are never accepted.' });
    const actions = root.createDiv({ cls: 'los-actions' });
    button(actions, 'Approve selected changes', () => this.apply(shown), 'success');
    button(actions, 'Ask AI to review proposal', () => this.plugin.askAiScoped(
      `Review these shelving proposal IDs: ${this.currentSelection(shown).join(', ')}. Do not apply changes.`,
      { moduleId: unit.module_id, unitId: unit.id }), 'warm');
  }

  private renderItem(parent: HTMLElement, unitId: string, reconciliation: Reconciliation, row: ReconciledItem): void {
    const { item } = row;
    const target = parent.createDiv({ cls: `los-proposal-row${row.mark ? ` is-${row.mark}` : ''}` });
    if (row.approvable) {
      const toggle = target.createEl('input', { attr: { type: 'checkbox', 'aria-label': `Select ${item.title}` } });
      toggle.checked = row.selected;
      toggle.addEventListener('change', () => {
        this.plugin.shelvingChoices.choose(unitId, reconciliation.rows, item.id, toggle.checked);
      });
    } else {
      target.createSpan({ cls: 'los-proposal-blocked', attr: { 'aria-hidden': 'true' } });
    }
    const copy = target.createDiv({ cls: 'los-proposal-copy' });
    const head = copy.createDiv({ cls: 'los-proposal-head' });
    head.createEl('h3', { text: item.title });
    if (row.mark === 'changed') badge(head, 'Changed since you looked', 'attention').addClass('los-proposal-mark');
    if (row.mark === 'new') badge(head, 'New', 'info').addClass('los-proposal-mark');
    const where = [shelvingKindLabel(item.kind), item.destination].filter(Boolean).join(' · ');
    if (where) copy.createDiv({ cls: 'los-detail-id', text: where });
    if (!row.approvable) {
      copy.createEl('p', { cls: 'los-proposal-refusal', text: `This item uses a field this version of LearningOS cannot show (${item.unknownFields.join(', ')}), so it cannot be approved here. Update the plugin, or review the packet with an agent.` });
    }
    if (item.rationale) copy.createEl('p', { text: item.rationale });
    this.renderContent(copy, item.content);
    if (item.diff) {
      copy.createDiv({ cls: 'los-proposal-label', text: 'Diff' });
      copy.createEl('pre', { cls: 'los-proposal-diff', text: item.diff });
    }
    if (item.metadata && Object.keys(item.metadata).length) {
      disclosure(copy, 'Metadata').createEl('pre', { cls: 'los-proposal-diff', text: JSON.stringify(item.metadata, null, 2) });
    }
  }

  /** The text Core writes on apply, collapsed after about twelve lines. */
  private renderContent(parent: HTMLElement, content: string | undefined): void {
    if (content === undefined || !content.trim()) {
      parent.createEl('p', { cls: 'los-muted', text: 'No text to write is attached to this item.' });
      return;
    }
    parent.createDiv({ cls: 'los-proposal-label', text: 'Text that will be written' });
    const lines = content.split('\n');
    const preview = lines.slice(0, CONTENT_PREVIEW_LINES).join('\n');
    const text = parent.createEl('pre', { cls: 'los-proposal-content', text: lines.length > CONTENT_PREVIEW_LINES ? preview : content });
    if (lines.length <= CONTENT_PREVIEW_LINES) return;
    let open = false;
    const label = () => (open ? 'Show fewer lines' : `Show all ${lines.length} lines`);
    const toggle = button(parent, label(), () => {
      open = !open;
      text.setText(open ? content : preview);
      toggle.setText(label());
      toggle.setAttr('aria-expanded', String(open));
    }, 'quiet');
    toggle.setAttr('aria-expanded', 'false');
  }

  private renderEmpty(root: HTMLElement, unit: ProjectionRecord, shown: ShownSnapshot): void {
    const wrap = section(root, 'No proposal yet');
    empty(wrap, 'Prepare a review packet',
      'Prepare writes a review packet of this unit’s notes and attachments. An agent then proposes items from it; nothing is applied until you approve selected items here.',
      'Prepare proposal', () => this.prepare(shown));
    button(wrap, 'Ask AI to explain shelving criteria', () => this.plugin.askAiScoped(
      'Explain which stage notes might be durable. Do not write or apply canonical changes.',
      { moduleId: unit.module_id, unitId: unit.id }), 'quiet');
  }

  /** Core wrote the packet and recorded `draft`: items come from an agent. */
  private renderDraft(root: HTMLElement, unit: ProjectionRecord, proposalPath: string | undefined, summary: string | undefined): void {
    const wrap = section(root, 'Waiting for proposal items',
      'Prepare wrote a review packet of this unit’s notes and attachments. An agent proposes items from it; nothing is applied until you approve selected items here.');
    wrap.createDiv({ cls: 'los-detail-id', text: proposalPath ?? 'Core did not record the packet path.' });
    if (summary) wrap.createEl('p', { cls: 'los-muted', text: summary });
    const where = proposalPath ? ` at ${proposalPath}` : '';
    button(wrap, 'Ask AI to propose items', () => this.plugin.askAiScoped(
      `Propose shelving items for unit ${unit.id} from its review packet${where}. Write the items file and seal review.prepare against it, as system/procedures/shelving-session-closure.md describes, so the proposal appears in the Shelving screen. Stop once the proposal is created. Do not apply any item: only the learner approves selected items, in the app.`,
      { moduleId: unit.module_id, unitId: unit.id }), 'warm');
  }

  /** The learner's current ticks among the items one render showed. */
  private currentSelection(shown: ShownSnapshot): string[] {
    return selectedIds(reconcile(shown.items, this.plugin.shelvingChoices.choicesFor(shown.unitId)));
  }

  renderQueue(root: HTMLElement): void {
    const wrap = section(root, 'Ready to shelve');
    const rows = this.plugin.store.units().filter(
      (row: ProjectionRecord) => row.status === 'ready-to-shelve',
    );
    if (!rows.length) empty(wrap, 'No unit is waiting', 'Keep working from any active unit.');
    for (const unit of rows) unitCard(wrap, this.plugin, unit);
  }

  async prepare(shown: ShownSnapshot): Promise<void> {
    try {
      await this.plugin.mutate(
        () => this.plugin.gateway.prepareShelving(shown.unitId, shown.guard),
      );
      this.render();
    } catch (error: unknown) {
      new Notice(errorMessage(error));
    }
  }

  /**
   * Approve what this render showed. The IDs are read at the click; the guard
   * is this render's. The write queue may run the request later, behind a
   * refresh: if the projection moved on meanwhile, the newer render is already
   * on screen and nothing is sent for the older one.
   */
  async apply(shown: ShownSnapshot): Promise<void> {
    const selected = this.currentSelection(shown);
    if (!selected.length) {
      new Notice('Select at least one proposal.');
      return;
    }

    try {
      await this.plugin.mutate(() => {
        if (this.plugin.store.snapshotId !== shown.snapshotId) throw new Error(PROPOSAL_MOVED);
        return this.plugin.gateway.applyShelving(shown.unitId, selected, shown.guard);
      });
      this.plugin.shelvingChoices.forgetApplied(shown.unitId, selected);
      this.render();
    } catch (error: unknown) {
      new Notice(errorMessage(error));
    }
  }
}
