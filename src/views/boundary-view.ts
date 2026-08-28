import { ItemView, type WorkspaceLeaf } from 'obsidian';
import { badge, empty, pageHeader, section } from '../components';
import { VIEW_BOUNDARY } from '../constants';
import type { AppSurface } from '../app/surface';
import {
  asMastersPlanningDashboard,
  type MastersPlanningDashboardV1,
} from '../contracts/masters-planning';

type BoundaryPlugin = Pick<
  AppSurface,
  'store' | 'gateway'
>;

interface BoundaryViewState {
  boundaryId?: string | null;
}

export class BoundaryView extends ItemView {
  private readonly plugin: BoundaryPlugin;
  private boundaryId: string | null = null;
  private mastersDashboard: MastersPlanningDashboardV1 | null = null;
  private mastersLoading = false;
  private mastersError = '';

  constructor(
    leaf: WorkspaceLeaf,
    plugin: BoundaryPlugin,
  ) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() { return VIEW_BOUNDARY; }
  getDisplayText() { return 'LearningOS · Boundary'; }
  async setState(
    state: BoundaryViewState = {},
  ): Promise<void> {
    if (typeof state.boundaryId === 'string') {
      if (state.boundaryId !== this.boundaryId) {
        this.mastersDashboard = null;
        this.mastersError = '';
      }
      this.boundaryId = state.boundaryId;
    }
    this.render();
  }

  getState(): BoundaryViewState {
    return { boundaryId: this.boundaryId };
  }

  async onOpen(): Promise<void> {
    const state = this.leaf.getViewState().state;
    const boundaryId = state?.boundaryId;

    if (typeof boundaryId === 'string') {
      this.boundaryId = boundaryId;
    }
    this.render();
  }

  private async loadMastersPlanning(): Promise<void> {
    if (this.mastersLoading || this.mastersDashboard
      || this.boundaryId !== 'program-masters-planning') return;
    this.mastersLoading = true;
    this.mastersError = '';
    this.render();
    try {
      const result = await this.plugin.gateway.mastersPlanningDashboard();
      const knownConceptIds = new Set(
        this.plugin.store.of('concept')
          .flatMap((concept) => typeof concept.id === 'string' ? [concept.id] : []),
      );
      const dashboard = asMastersPlanningDashboard(result, knownConceptIds);
      if (!dashboard) {
        throw new Error('LearningOS refused an invalid Future Master\'s Planning response.');
      }
      this.mastersDashboard = dashboard;
    } catch (error: unknown) {
      this.mastersError = error instanceof Error ? error.message : String(error);
    } finally {
      this.mastersLoading = false;
      this.render();
    }
  }

  render() {
    const root = this.contentEl; root.empty(); root.addClass('los-root', 'los-boundary-view');
    if (this.boundaryId === 'program-masters-planning') {
      this.renderMastersPlanning(root);
      return;
    }
    empty(root, 'Boundary unavailable', 'This destination is not a declared explicit boundary surface.');
  }

  private renderMastersPlanning(root: HTMLElement): void {
    root.addClass('los-masters-planning');
    pageHeader(
      root,
      'Future Master\'s Planning · isolated',
      'Future Master\'s Planning',
      'A deliberate academic planning workspace, separate from current LearningOS.',
    );
    const banner = root.createDiv({
      cls: 'los-prospective-banner',
      attr: { role: 'status' },
    });
    banner.createEl('strong', { text: 'Prospective—not current LearningOS' });
    banner.createDiv({
      cls: 'los-micro',
      text: 'Candidates here do not enter the normal manifest, search, workload, recommendations, deadlines, or ordinary AI context.',
    });

    if (this.mastersLoading) {
      empty(root, 'Opening prospective planning', 'Reading only the sanitized academic planning dashboard.');
      return;
    }
    if (this.mastersError) {
      empty(
        root,
        'Future Master\'s Planning unavailable',
        this.mastersError,
        'Try again',
        () => void this.loadMastersPlanning(),
      );
      return;
    }
    if (!this.mastersDashboard) {
      empty(
        root,
        'Prospective catalog is sealed',
        'Open it only for a deliberate planning session. The response is read-only and schema-bounded.',
        'Open prospective planning',
        () => void this.loadMastersPlanning(),
      );
      return;
    }

    const catalog = this.mastersDashboard.catalog;
    if (!catalog) {
      empty(root, 'No prospective catalog', 'Core returned the isolated dashboard without a catalog.');
      return;
    }
    const summary = section(
      root,
      'Prospective catalog',
      `Revision ${catalog.revision} · updated ${catalog.updated_at}`,
    );
    const counts = summary.createDiv({ cls: 'los-masters-counts' });
    counts.createSpan({ text: `${catalog.candidate_modules.length} candidate modules` });
    counts.createSpan({ text: `${catalog.candidate_sources.length} candidate sources` });
    counts.createSpan({ text: `${this.mastersDashboard.comparisons.length} approved comparisons` });

    const modules = section(root, 'Candidate modules');
    if (!catalog.candidate_modules.length) {
      modules.createDiv({ cls: 'los-micro', text: 'No candidate modules in this revision.' });
    }
    for (const module of catalog.candidate_modules) {
      const row = modules.createDiv({ cls: 'los-masters-row' });
      const heading = row.createDiv({ cls: 'los-masters-row-head' });
      heading.createEl('strong', { text: module.title });
      badge(heading, module.planning_state, 'role');
      badge(
        heading,
        module.fact_state.status.replaceAll('-', ' '),
        module.fact_state.status === 'verified-current' ? 'status' : 'role',
      );
      if (module.fact_state.as_of) {
        row.createDiv({ cls: 'los-micro', text: `Facts checked as of ${module.fact_state.as_of}` });
      }
      if (module.unresolved_references.length) {
        row.createDiv({
          cls: 'los-micro',
          text: `${module.unresolved_references.length} unresolved reference${module.unresolved_references.length === 1 ? '' : 's'}`,
        });
      }
    }

    const sources = section(root, 'Candidate sources');
    if (!catalog.candidate_sources.length) {
      sources.createDiv({ cls: 'los-micro', text: 'No candidate sources in this revision.' });
    }
    for (const source of catalog.candidate_sources) {
      const row = sources.createDiv({ cls: 'los-masters-row' });
      const heading = row.createDiv({ cls: 'los-masters-row-head' });
      heading.createEl('strong', { text: source.title });
      badge(heading, source.planning_state, 'role');
      badge(heading, source.fact_state.status.replaceAll('-', ' '),
        source.fact_state.status === 'verified-current' ? 'status' : 'role');
    }

    const assessments = this.mastersDashboard.comparisons
      .flatMap((comparison) => comparison.source_assessments);
    if (assessments.length) {
      const reviewed = section(root, 'Approved source assessments');
      const sourceTitle = new Map(catalog.candidate_sources.map((source) => [source.id, source.title]));
      for (const assessment of assessments) {
        const row = reviewed.createDiv({ cls: 'los-masters-row' });
        const heading = row.createDiv({ cls: 'los-masters-row-head' });
        heading.createEl('strong', {
          text: sourceTitle.get(assessment.candidate_source_id) || assessment.candidate_source_id,
        });
        badge(heading, assessment.role, assessment.role === 'selected' ? 'status' : 'role');
        badge(heading, assessment.review_status.replaceAll('-', ' '),
          assessment.review_status === 'deep-reviewed' ? 'status' : 'role');
        const summary = assessment.contribution || assessment.reason;
        if (summary) row.createEl('p', { text: summary });
        if (assessment.concept_ids.length) {
          row.createDiv({
            cls: 'los-micro',
            text: `Concepts: ${assessment.concept_ids.join(', ')}`,
          });
        }
      }
    }

    const pairs = this.mastersDashboard.comparisons
      .flatMap((comparison) => comparison.comparisons);
    if (pairs.length) {
      const comparisons = section(root, 'Approved source comparisons');
      const sourceTitle = new Map(catalog.candidate_sources.map((source) => [source.id, source.title]));
      for (const pair of pairs) {
        const row = comparisons.createDiv({ cls: 'los-masters-row' });
        const heading = row.createDiv({ cls: 'los-masters-row-head' });
        heading.createEl('strong', {
          text: `${sourceTitle.get(pair.left_candidate_source_id) || pair.left_candidate_source_id} ↔ ${sourceTitle.get(pair.right_candidate_source_id) || pair.right_candidate_source_id}`,
        });
        badge(heading, pair.relation.replaceAll('-', ' '), 'role');
        row.createEl('p', { text: pair.narrative });
        row.createDiv({
          cls: 'los-micro',
          text: `Concepts: ${pair.concept_ids.join(', ')}`,
        });
        const evidence = row.createDiv({ cls: 'los-masters-evidence' });
        const leftTitle = sourceTitle.get(pair.left_candidate_source_id)
          || pair.left_candidate_source_id;
        const rightTitle = sourceTitle.get(pair.right_candidate_source_id)
          || pair.right_candidate_source_id;
        for (const [side, title] of [
          [pair.evidence.left, leftTitle],
          [pair.evidence.right, rightTitle],
        ] as const) {
          const list = evidence.createDiv({ cls: 'los-masters-evidence-side' });
          list.createEl('strong', { text: `${title} evidence` });
          for (const item of side) {
            list.createDiv({
              cls: 'los-micro',
              text: item.note ? `${item.locator} — ${item.note}` : item.locator,
            });
          }
        }
      }
    }
  }
}
