import {
  ItemView,
  type WorkspaceLeaf,
} from 'obsidian';
import {
  button,
  empty,
  filterTabs,
  pageHeader,
  section,
} from '../components';
import {
  enableButtonGroupKeyboardNavigation,
} from '../accessibility/button-group';
import {
  VIEW_ATLAS,
} from '../constants';
import type {
  ModuleConceptEvidence,
  ProjectionRecord,
} from '../contracts/manifest';
import type { AppSurface } from '../app/surface';
import type { AppNavigator } from '../app/navigator';
import {
  asLabel as projectedLabel,
  asString as projectedString,
} from '../projection/readers';
import {
  buildConceptContext,
  buildCrossing,
  type Crossing,
  type CrossingRow,
} from '../features/atlas/crossing';

type ConceptScope = 'shared' | 'all';

interface AtlasViewState {
  domain?: string | null;
  concept?: string | null;
}

type AtlasPlugin = Pick<
  AppSurface,
  | 'generate'
  | 'openVaultPath'
  | 'store'
> & {
  readonly nav: Pick<
    AppNavigator,
    | 'openAtlas'
    | 'openModule'
    | 'openRecord'
    | 'openSourceDetail'
    | 'openUnit'
  >;
};

/**
 * The Module x Concept Atlas (ADR-015).
 *
 * This replaced the Domain Atlas landing rather than joining it as a sixth
 * view. The domain atlas answered "what is in this domain", which the
 * generated `domain-atlas.md` still answers and which the Library answers
 * better. What nothing answered is the question a learner carrying four
 * modules actually has: *this concept is in three of them — is it the same
 * thing, and can one week of work serve all three?*
 *
 * Every filled cell carries the authored tag that licensed it, and says so on
 * screen. That is not a debugging affordance: the screen makes claims about
 * how to spend weeks of study, and a claim the learner cannot interrogate is
 * one they have to take on faith.
 */
export class AtlasView extends ItemView {
  private readonly plugin: AtlasPlugin;
  private scope: ConceptScope = 'shared';
  private concept: string | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    plugin: AtlasPlugin,
  ) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_ATLAS;
  }

  getDisplayText() {
    return 'LearningOS · Atlas';
  }

  getIcon() {
    return 'map';
  }

  async setState(
    state: AtlasViewState = {},
  ): Promise<void> {
    if (
      typeof state.concept === 'string'
      || state.concept === null
    ) {
      this.concept = state.concept;
    }

    if (this.concept) {
      this.scope = 'all';
    }

    this.render();
  }

  getState(): AtlasViewState {
    return {
      concept: this.concept,
    };
  }

  async onOpen(): Promise<void> {
    const concept = this.leaf.getViewState().state?.concept;

    this.concept =
      typeof concept === 'string'
        ? concept
        : null;

    if (this.concept) {
      this.scope = 'all';
    }

    this.render();
  }

  crossing(): Crossing {
    return buildCrossing(this.plugin.store);
  }

  private visibleRows(
    crossing: Crossing,
  ): readonly CrossingRow[] {
    return this.scope === 'shared'
      ? crossing.sharedRows
      : crossing.rows;
  }

  render(): void {
    const root = this.contentEl;

    root.empty();
    root.addClass(
      'los-root',
      'los-atlas-view',
    );

    if (!this.plugin.store.ready) {
      pageHeader(
        root,
        'Reach',
        'Atlas unavailable',
      );

      empty(
        root,
        'The interface contract could not be loaded',
        this.plugin.store.error,
        'Rebuild views',
        () => this.plugin.generate(),
      );

      return;
    }

    pageHeader(
      root,
      'Reach',
      'Module × Concept atlas',
      'Where one concept is taught in more than one module — and the exact stage in each that says so.',
    );

    const crossing = this.crossing();

    if (!crossing.rows.length) {
      empty(
        root,
        'No concepts are mapped to modules yet',
        'A cell appears when a stage carries a concept tag, or a knowledge-map node carries a reviewed concept id. Nothing here is inferred, so an empty atlas means nothing is tagged — not that nothing overlaps.',
      );

      this.fallbackAction(root);
      return;
    }

    filterTabs<ConceptScope>(
      root,
      'Which concepts to show',
      [
        ['shared', 'Shared across modules'],
        ['all', 'All concepts'],
      ],
      this.scope,
      (value: ConceptScope) => {
        this.scope = value;
        this.render();
      },
      (value: ConceptScope) =>
        value === 'shared'
          ? crossing.sharedRows.length
          : crossing.rows.length,
    );

    const rows = this.visibleRows(crossing);

    if (!rows.length) {
      empty(
        root,
        'No concept is carried by more than one module',
        `${crossing.totalConcepts} concept(s) are mapped, each to a single module. Switch to All concepts to see them.`,
      );

      this.fallbackAction(root);
      return;
    }

    this.renderGrid(root, crossing, rows);

    const selected = rows.find(
      (row: CrossingRow) => row.conceptId === this.concept,
    );

    if (selected) {
      this.renderConceptDetail(root, crossing, selected);
    }

    this.fallbackAction(root);
  }

  /**
   * Concepts are rows and modules are columns, because a learner reads down
   * the concept they are about to study and across to see who else wants it.
   * Below the responsive breakpoint the grid restacks into per-concept cards —
   * a horizontally scrolling table is unreadable on a narrow pane, and the
   * information is the same either way.
   */
  private renderGrid(
    root: HTMLElement,
    crossing: Crossing,
    rows: readonly CrossingRow[],
  ): void {
    const wrap = root.createDiv({ cls: 'los-crossing' });
    wrap.setAttrs({
      role: 'group',
      'aria-label': 'Concepts by module',
    });
    enableButtonGroupKeyboardNavigation(wrap, 'both');
    wrap.style.setProperty(
      '--los-crossing-columns',
      String(crossing.columns.length),
    );

    const head = wrap.createDiv({ cls: 'los-crossing-head' });
    head.createDiv({
      cls: 'los-crossing-corner los-micro',
      text: 'Concept',
    });

    for (const column of crossing.columns) {
      const cell = head.createDiv({ cls: 'los-crossing-col' });
      cell.toggleClass('is-actionable', column.actionable);
      cell.createSpan({
        cls: 'los-crossing-col-name',
        text: column.shortLabel,
      });
      cell.createSpan({
        cls: 'los-micro',
        text: `${column.conceptCount}`,
      });
      cell.setAttrs({
        title: column.actionable
          ? `${column.label} — current`
          : column.label,
      });
    }

    for (const row of rows) {
      const line = wrap.createDiv({ cls: 'los-crossing-row' });
      line.toggleClass('is-selected', row.conceptId === this.concept);

      const label = line.createEl('button', {
        cls: 'los-crossing-concept is-clickable',
        attr: { type: 'button' },
      });
      label.createSpan({
        cls: 'los-crossing-concept-name',
        text: row.label,
      });
      label.createSpan({
        cls: 'los-micro',
        text: row.moduleCount > 1
          ? `${row.moduleCount} modules`
          : '1 module',
      });
      label.addEventListener('click', () => this.select(row.conceptId));

      for (const column of crossing.columns) {
        const cell = row.cells.get(column.moduleId);

        if (!cell) {
          const blank = line.createDiv({ cls: 'los-crossing-cell is-empty' });
          blank.setAttrs({
            'aria-label': `${row.label} is not mapped in ${column.label}`,
            'data-module-label': column.label,
          });
          continue;
        }

        const filled = line.createEl('button', {
          cls: 'los-crossing-cell is-filled is-clickable',
          attr: { type: 'button' },
        });
        filled.createSpan({
          cls: 'los-crossing-mark',
          text: String(cell.evidence.length),
        });
        filled.setAttrs({
          'aria-label':
            `${row.label} in ${column.label}: ${cell.evidence.length} piece(s) of evidence`,
          title: `${column.label} — ${cell.evidence.length} piece(s) of evidence`,
          'data-module-label': column.label,
        });
        filled.addEventListener('click', () => this.select(row.conceptId));
      }
    }

  }

  /**
   * Secondary published context. These links explain where else the concept
   * can be opened; they never create or strengthen a Module x Concept edge.
   */
  private renderPublishedContext(
    parent: HTMLElement,
    conceptId: string,
    conceptLabel: string,
  ): void {
    const context = buildConceptContext(this.plugin.store, conceptId);

    if (
      !context.notes.length
      && !context.sources.length
      && !context.relations.length
    ) {
      return;
    }

    const wrap = parent.createDiv({ cls: 'los-crossing-context' });

    if (context.notes.length) {
      const group = wrap.createDiv({ cls: 'los-crossing-context-group' });
      group.createEl('h3', { text: 'Linked notes' });

      for (const note of context.notes) {
        const item = group.createEl('button', {
          cls: 'los-item is-clickable',
          attr: { type: 'button' },
        });
        item.createDiv({ cls: 'los-item-title', text: projectedLabel(note) });
        item.createDiv({ cls: 'los-micro', text: 'Explicit concept backlink' });
        item.addEventListener('click', () => this.plugin.nav.openRecord(note));
      }
    }

    if (context.sources.length) {
      const group = wrap.createDiv({ cls: 'los-crossing-context-group' });
      group.createEl('h3', { text: 'Source evaluations' });

      for (const source of context.sources) {
        const sourceId = projectedString(source.id);

        if (!sourceId) {
          continue;
        }

        const item = group.createEl('button', {
          cls: 'los-item is-clickable',
          attr: { type: 'button' },
        });
        item.createDiv({ cls: 'los-item-title', text: projectedLabel(source) });
        item.createDiv({ cls: 'los-micro', text: 'Explicit evaluation concept' });
        item.addEventListener(
          'click',
          () => this.plugin.nav.openSourceDetail(sourceId),
        );
      }
    }

    if (context.relations.length) {
      const group = wrap.createDiv({ cls: 'los-crossing-context-group' });
      group.createEl('h3', { text: 'Concept relationships' });

      for (const relation of context.relations) {
        const relatedLabel = projectedLabel(relation.record);
        const relationLabel = relation.relationType.replaceAll('-', ' ');
        const explanation = relation.direction === 'outgoing'
          ? `${conceptLabel} ${relationLabel} ${relatedLabel}`
          : `${relatedLabel} ${relationLabel} ${conceptLabel}`;
        const item = group.createEl('button', {
          cls: 'los-item is-clickable',
          attr: { type: 'button' },
        });
        item.createDiv({ cls: 'los-item-title', text: relatedLabel });
        item.createDiv({ cls: 'los-micro', text: explanation });
        item.addEventListener(
          'click',
          () => this.plugin.nav.openRecord(relation.record),
        );
      }
    }
  }

  private select(conceptId: string): void {
    const selected = this.concept === conceptId ? null : conceptId;
    void this.plugin.nav.openAtlas(null, selected);
  }

  /**
   * The drill-down. Everything here is already published — stages, units, the
   * concept record itself — so this panel navigates rather than restating.
   */
  private renderConceptDetail(
    root: HTMLElement,
    crossing: Crossing,
    row: CrossingRow,
  ): void {
    const body = section(
      root,
      row.label,
      row.moduleCount > 1
        ? `Taught in ${row.moduleCount} modules. Each entry below is the authored tag that puts it there.`
        : 'Taught in one module.',
    );

    const record = this.plugin.store.get(row.conceptId);

    if (record) {
      const actions = body.createDiv({ cls: 'los-actions' });
      button(
        actions,
        'Open concept',
        () => this.plugin.nav.openRecord(record),
        'quiet',
      );
      this.renderAliases(body, record);
    }

    for (const column of crossing.columns) {
      const cell = row.cells.get(column.moduleId);

      if (!cell) {
        continue;
      }

      const group = body.createDiv({ cls: 'los-crossing-evidence' });
      const header = group.createDiv({ cls: 'los-crossing-evidence-head' });

      const moduleButton = header.createEl('button', {
        cls: 'los-crossing-evidence-module is-clickable',
        attr: { type: 'button' },
      });
      moduleButton.setText(column.label);
      moduleButton.addEventListener(
        'click',
        () => this.plugin.nav.openModule(column.moduleId),
      );

      if (column.actionable) {
        header.createSpan({ cls: 'los-micro', text: 'current' });
      }

      for (const evidence of cell.evidence) {
        this.renderEvidence(group, evidence);
      }
    }

    this.renderPublishedContext(body, row.conceptId, row.label);
  }

  private renderEvidence(
    parent: HTMLElement,
    evidence: ModuleConceptEvidence,
  ): void {
    const unit = this.plugin.store.get(evidence.unit_id);
    const unitLabel = unit ? projectedLabel(unit) : evidence.unit_id;

    const openable =
      evidence.kind === 'stage-concept'
        ? () => this.plugin.nav.openUnit(evidence.unit_id, evidence.stage_id)
        : () => this.plugin.nav.openUnit(evidence.unit_id);

    const item = parent.createEl('button', {
      cls: 'los-item is-clickable',
      attr: { type: 'button' },
    });
    item.addEventListener('click', openable);

    const copy = item.createDiv({ cls: 'los-item-copy' });
    copy.createDiv({ cls: 'los-item-title', text: unitLabel });

    if (evidence.kind === 'stage-concept') {
      const stage = this.plugin.store.get(evidence.stage_id)
        ?? this.plugin.store.stage(evidence.stage_id);

      copy.createDiv({
        cls: 'los-micro',
        text: stage
          ? `Stage tag · ${projectedLabel(stage)}`
          : `Stage tag · ${evidence.stage_id}`,
      });
    } else {
      copy.createDiv({
        cls: 'los-micro',
        text: `Reviewed knowledge-map node · ${evidence.node_id}`,
      });
    }
  }

  private renderAliases(
    parent: HTMLElement,
    record: ProjectionRecord,
  ): void {
    const aliases = Array.isArray(record.aliases)
      ? record.aliases
        .map((value: unknown) => projectedString(value))
        .filter((value): value is string => Boolean(value))
      : [];

    if (!aliases.length) {
      return;
    }

    parent.createDiv({
      cls: 'los-micro',
      text: `Also called: ${aliases.join(' · ')}`,
    });
  }

  /**
   * The generated textual atlas stays reachable, and stays a fallback. It is
   * the human-operable copy (README, "without the operator"), not a second
   * primary surface — two atlases with no rule for which to open is the
   * confusion ADR-005 was written against.
   */
  private fallbackAction(root: HTMLElement): void {
    const actions = root.createDiv({ cls: 'los-actions' });
    button(
      actions,
      'Open generated domain map',
      () => this.plugin.openVaultPath('generated/domain-atlas.md'),
      'quiet',
    );
  }
}
