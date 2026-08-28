import {
  ItemView,
  type WorkspaceLeaf,
} from 'obsidian';
import {
  button,
  empty,
  icon,
  pageHeader,
  projectedExcerpt,
  section,
} from '../components';
import {
  enableButtonGroupKeyboardNavigation,
} from '../accessibility/button-group';
import {
  ICONS,
  VIEW_ATLAS,
} from '../constants';
import type {
  ProjectionRecord,
} from '../contracts/manifest';
import type { AppSurface } from '../app/surface';
import type { AppNavigator } from '../app/navigator';
import {
  asLabel as projectedLabel,
  asListLength as projectedListLength,
  asString as projectedString,
} from '../projection/readers';
import {
  ATLAS_ROLE_ORDER,
  type AtlasDomain,
  buildAtlasDomains,
  humanLabel,
  intersectionSize,
  recordIds,
  roleLabel,
} from '../features/atlas/model';

interface AtlasViewState {
  domain?: string | null;
}

type AtlasPlugin = Pick<
  AppSurface,
  | 'generate'
  | 'openAuthoredPath'
  | 'openVaultPath'
  | 'store'
> & {
  readonly nav: Pick<
    AppNavigator,
    | 'openLibrary'
    | 'openLibraryFiltered'
    | 'openModule'
    | 'openSourceDetail'
  >;
};

function projectedMetadata(
  values: readonly unknown[],
): string {
  return values
    .filter(
      (
        value,
      ): value is string | number =>
        typeof value === 'string'
        || typeof value === 'number',
    )
    .map(String)
    .filter(Boolean)
    .join(' · ');
}

function plural(
  count: number,
  noun: string,
  pluralNoun = `${noun}s`,
): string {
  return `${count} ${count === 1 ? noun : pluralNoun}`;
}

/**
 * Domain atlas — the cross-domain map (ADR-005).
 *
 * Its whole purpose is to stop a session's field of view collapsing to the
 * active workspace's domain, which a link to a Markdown wall cannot do. Every
 * domain lists its actual notes, wiring hubs and shelves, and every row opens
 * the thing it names. Counts stay — but as a way in, not as the answer.
 *
 * Presentation only: domains, roles and shelf assignments are core-authored.
 */
export class AtlasView extends ItemView {
  private readonly plugin: AtlasPlugin;
  private domain: string | null = null;

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
    return 'LearningOS · Domain atlas';
  }

  getIcon() {
    return 'map';
  }

  async setState(
    state: AtlasViewState = {},
  ): Promise<void> {
    if (
      typeof state.domain === 'string'
      || state.domain === null
    ) {
      this.domain = state.domain;
    }

    this.render();
  }

  getState(): AtlasViewState {
    return {
      domain: this.domain,
    };
  }

  async onOpen(): Promise<void> {
    const domain = this.leaf.getViewState().state?.domain;

    this.domain =
      typeof domain === 'string'
        ? domain
        : null;

    this.render();
  }

  atlas(): AtlasDomain[] {
    return buildAtlasDomains(
      this.plugin.store,
    );
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
        'Domain atlas unavailable',
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
      'Domain atlas',
      'See where your learning lives, what connects across subjects, and which source or module to open next.',
    );

    const domains = this.atlas();

    if (!domains.length) {
      empty(
        root,
        'Nothing mapped yet',
        'No notes or shelves are registered.',
      );

      return;
    }

    if (
      !this.domain
      || !domains.some(
        (row) => row.name === this.domain,
      )
    ) {
      this.domain =
        domains[0]?.name ?? null;
    }

    const glance = root.createDiv({
      cls: 'los-atlas-glance',
    });
    glance.setAttrs({
      role: 'group',
      'aria-label': 'Choose a knowledge domain',
    });
    enableButtonGroupKeyboardNavigation(glance, 'both');

    for (const domain of domains) {
      const selected =
        domain.name === this.domain;

      const tile = glance.createEl(
        'button',
        {
          cls:
            `los-atlas-tile is-clickable ${
              selected
                ? 'is-selected'
                : ''
            }`,
          attr: {
            type: 'button',
            'aria-pressed':
              String(selected),
          },
        },
      );

      tile.createSpan({
        cls: 'los-atlas-tile-name',
        text: humanLabel(domain.name),
      });

      const summaryParts = [
        domain.modules.length ? plural(domain.modules.length, 'module') : '',
        domain.concepts.length ? plural(domain.concepts.length, 'concept') : '',
        domain.sources.length ? plural(domain.sources.length, 'source') : '',
        !domain.modules.length && !domain.concepts.length && !domain.sources.length
          ? plural(domain.shelves.length, 'shelf', 'shelves')
          : '',
      ].filter((part): part is string => Boolean(part));

      tile.createSpan({
        cls: 'los-micro',
        text: summaryParts.join(' · '),
      });

      tile.addEventListener(
        'click',
        () => {
          this.domain = domain.name;
          this.render();
        },
      );
    }

    const current = domains.find(
      (row) =>
        row.name === this.domain,
    );

    const body = root.createDiv({
      cls: 'los-atlas-body',
    });

    this.renderDomain(body, current, domains);
    const mapActions = body.createDiv({ cls: 'los-actions' });
    button(
      mapActions,
      'Open generated map file',
      () => this.plugin.openVaultPath('generated/domain-atlas.md'),
      'quiet',
    );
  }

  noteRow(
    parent: HTMLElement,
    note: ProjectionRecord,
  ): HTMLElement {
    const row = parent.createEl(
      'button',
      {
        cls: 'los-item is-clickable',
        attr: {
          type: 'button',
        },
      },
    );

    icon(
      row.createSpan(),
      ICONS.note,
    );

    const copy = row.createSpan({
      cls: 'los-item-copy',
    });

    copy.createSpan({
      text: projectedLabel(note),
    });

    const metadata = projectedMetadata([
      note.role ? roleLabel(String(note.role)) : '',
      note.state ? humanLabel(note.state) : '',
    ]);

    if (metadata) {
      copy.createSpan({
        cls: 'los-micro',
        text: metadata,
      });
    }

    const summary = projectedString(note.summary);
    if (summary) {
      copy.createSpan({
        cls: 'los-atlas-note-summary',
        text: projectedExcerpt(summary, 150),
      });
    }

    const path =
      projectedString(note.path);

    row.addEventListener(
      'click',
      () => {
        if (path) {
          void this.plugin.openAuthoredPath(
            path,
          );
        }
      },
    );

    return row;
  }

  renderCoveragePanel(
    parent: HTMLElement,
    title: string,
    iconName: string,
    records: readonly ProjectionRecord[],
    kind: 'module' | 'concept' | 'source',
  ): void {
    const panel = parent.createDiv({ cls: 'los-atlas-map-panel' });
    const heading = panel.createDiv({ cls: 'los-atlas-map-panel-head' });
    icon(heading.createSpan(), iconName);
    heading.createEl('h3', { text: title });
    heading.createSpan({ cls: 'los-atlas-count', text: String(records.length) });

    if (!records.length) {
      panel.createDiv({
        cls: 'los-atlas-panel-empty',
        text: kind === 'concept'
          ? 'No named concepts are linked yet.'
          : `No ${kind}s are linked yet.`,
      });
      return;
    }

    const rows = records
      .slice()
      .sort((left, right) => projectedLabel(left).localeCompare(projectedLabel(right)))
      .slice(0, 5);

    for (const record of rows) {
      if (kind === 'concept') {
        const concept = panel.createDiv({ cls: 'los-atlas-concept' });
        icon(concept.createSpan(), ICONS.concept);
        concept.createSpan({ text: projectedLabel(record) });
        continue;
      }

      const recordId = projectedString(record.id);
      const row = panel.createEl('button', {
        cls: 'los-atlas-map-link is-clickable',
        attr: { type: 'button' },
      });
      icon(row.createSpan(), kind === 'module' ? ICONS.module : ICONS.source);
      const copy = row.createSpan({ cls: 'los-item-copy' });
      copy.createSpan({ text: projectedLabel(record) });
      const context = kind === 'module'
        ? projectedMetadata([record.code, record.kind ? humanLabel(record.kind) : ''])
        : humanLabel(record.source_type || 'source');
      if (context) copy.createSpan({ cls: 'los-micro', text: context });
      row.addEventListener('click', () => {
        if (!recordId) return;
        if (kind === 'module') void this.plugin.nav.openModule(recordId);
        else void this.plugin.nav.openSourceDetail(recordId);
      });
    }

    if (records.length > rows.length) {
      panel.createDiv({
        cls: 'los-atlas-more',
        text: `+${records.length - rows.length} more`,
      });
    }
  }

  renderConnections(
    parent: HTMLElement,
    domain: AtlasDomain,
    domains: readonly AtlasDomain[],
  ): void {
    const crosswalks = domain.notes.filter(
      (note: ProjectionRecord) => note.role === 'crosswalk',
    );
    const currentSourceIds = recordIds(domain.sources);
    const currentConceptIds = recordIds(domain.concepts);
    const currentModuleIds = recordIds(domain.modules);
    const peers = domains
      .filter((candidate: AtlasDomain) => candidate.name !== domain.name)
      .map((candidate: AtlasDomain) => {
        const sources = intersectionSize(currentSourceIds, recordIds(candidate.sources));
        const concepts = intersectionSize(currentConceptIds, recordIds(candidate.concepts));
        const modules = intersectionSize(currentModuleIds, recordIds(candidate.modules));
        return { candidate, sources, concepts, modules, score: sources + concepts + modules };
      })
      .filter((peer) => peer.score > 0)
      .sort((left, right) => right.score - left.score || left.candidate.name.localeCompare(right.candidate.name));

    if (!crosswalks.length && !peers.length) return;

    const wrap = section(
      parent,
      'Connections',
      'Use a narrative bridge or jump to a neighbouring domain that shares learning material.',
    );
    const grid = wrap.createDiv({ cls: 'los-atlas-connection-grid' });

    if (crosswalks.length) {
      const card = grid.createDiv({ cls: 'los-atlas-connection-card' });
      card.createEl('h3', { text: 'Narrative bridges' });
      card.createDiv({
        cls: 'los-muted',
        text: 'These notes explain how the pieces fit together.',
      });
      for (const note of crosswalks) this.noteRow(card, note);
    }

    if (peers.length) {
      const card = grid.createDiv({ cls: 'los-atlas-connection-card' });
      card.createEl('h3', { text: 'Connected domains' });
      card.createDiv({
        cls: 'los-muted',
        text: 'Shared sources, concepts, or modules create these links.',
      });
      for (const peer of peers.slice(0, 6)) {
        const row = card.createEl('button', {
          cls: 'los-atlas-domain-link is-clickable',
          attr: { type: 'button' },
        });
        const copy = row.createSpan({ cls: 'los-item-copy' });
        copy.createSpan({ text: humanLabel(peer.candidate.name) });
        const shared = [
          peer.modules ? plural(peer.modules, 'module') : '',
          peer.concepts ? plural(peer.concepts, 'concept') : '',
          peer.sources ? plural(peer.sources, 'source') : '',
        ].filter(Boolean).join(' · ');
        copy.createSpan({ cls: 'los-micro', text: `Shared: ${shared}` });
        row.createSpan({ cls: 'los-atlas-arrow', text: '→' });
        row.addEventListener('click', () => {
          this.domain = peer.candidate.name;
          this.render();
        });
      }
    }
  }

  renderShelves(
    parent: HTMLElement,
    domain: AtlasDomain,
  ): void {
    const wrap = section(
      parent,
      `Curated shelves (${domain.shelves.length})`,
      'Purpose-built reading routes, kept ahead of the full note inventory.',
    );

    if (!domain.shelves.length) {
      empty(
        wrap,
        'No curated shelf yet',
        'Sources are mapped above, but this domain does not have a reading route yet.',
      );
      return;
    }

    const grid = wrap.createDiv({ cls: 'los-atlas-shelf-grid' });
    const shelves = domain.shelves
      .slice()
      .sort((left, right) => projectedLabel(left).localeCompare(projectedLabel(right)));

    for (const shelf of shelves) {
      const card = grid.createDiv({ cls: 'los-shelf-entry' });
      const head = card.createEl('button', {
        cls: 'los-shelf-entry-title is-clickable',
        attr: { type: 'button' },
      });
      icon(head.createSpan(), shelf.type === 'topic-pack' ? ICONS['topic-pack'] : ICONS.collection);
      const copy = head.createSpan({ cls: 'los-item-copy' });
      copy.createSpan({ text: projectedLabel(shelf) });
      copy.createSpan({
        cls: 'los-micro',
        text: plural(projectedListLength(shelf.entries), 'source'),
      });

      const shelfId = projectedString(shelf.id);
      head.addEventListener('click', () => {
        if (shelfId) void this.plugin.nav.openLibrary(shelfId, String(shelf.type || 'collection'));
      });

      const summary = projectedString(shelf.summary) || projectedString(shelf.purpose);
      if (summary) {
        card.createDiv({
          cls: 'los-shelf-why',
          text: projectedExcerpt(summary, 220),
        });
      }
    }
  }

  renderNoteInventory(
    parent: HTMLElement,
    domain: AtlasDomain,
  ): void {
    const notes = domain.notes.filter((note: ProjectionRecord) => note.role !== 'crosswalk');
    if (!notes.length) return;

    const wrap = section(
      parent,
      'Reference notes',
      'The complete inventory stays available without taking over the map.',
    );
    const inventory = wrap.createEl('details', { cls: 'los-atlas-inventory' });
    inventory.createEl('summary', { text: `Open all ${plural(notes.length, 'note')}` });
    const body = inventory.createDiv({ cls: 'los-atlas-inventory-body' });
    const byRole = new Map<string, ProjectionRecord[]>();

    for (const note of notes) {
      const role = String(note.role || 'synthesis');
      const rows = byRole.get(role) ?? [];
      rows.push(note);
      byRole.set(role, rows);
    }

    const roles = [...byRole.keys()].sort((left, right) => {
      const rank = (role: string): number => ATLAS_ROLE_ORDER.indexOf(role) + 1 || 99;
      return rank(left) - rank(right) || left.localeCompare(right);
    });

    for (const role of roles) {
      const rows = (byRole.get(role) ?? [])
        .slice()
        .sort((left, right) => projectedLabel(left).localeCompare(projectedLabel(right)));
      const group = body.createEl('details', { cls: 'los-atlas-group' });
      group.createEl('summary', { text: `${roleLabel(role)} (${rows.length})` });
      for (const note of rows) this.noteRow(group, note);
    }
  }

  renderDomain(
    parent: HTMLElement,
    domain: AtlasDomain | undefined,
    domains: readonly AtlasDomain[],
  ): void {
    if (!domain) return;

    const header = parent.createDiv({ cls: 'los-atlas-domain-head' });
    const copy = header.createDiv({ cls: 'los-atlas-domain-copy' });
    copy.createEl('h2', { text: `${humanLabel(domain.name)} map` });
    copy.createEl('p', {
      text: [
        plural(domain.modules.length, 'module'),
        plural(domain.concepts.length, 'concept'),
        plural(domain.sources.length, 'source'),
        plural(domain.shelves.length, 'curated shelf', 'curated shelves'),
      ].join(' · '),
    });
    const actions = header.createDiv({ cls: 'los-actions' });
    button(
      actions,
      'Browse domain in Library',
      () => this.plugin.nav.openLibraryFiltered('note', domain.name),
      'quiet',
    );

    const coverage = parent.createDiv({ cls: 'los-atlas-map-grid' });
    this.renderCoveragePanel(coverage, 'Modules', ICONS.module, domain.modules, 'module');
    this.renderCoveragePanel(coverage, 'Concepts', ICONS.concept, domain.concepts, 'concept');
    this.renderCoveragePanel(coverage, 'Sources', ICONS.source, domain.sources, 'source');

    this.renderConnections(parent, domain, domains);
    this.renderShelves(parent, domain);
    this.renderNoteInventory(parent, domain);
  }

}
