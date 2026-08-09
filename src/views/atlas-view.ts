import {
  ItemView,
  type WorkspaceLeaf,
} from 'obsidian';
import {
  boundaryPolicy,
  button,
  empty,
  icon,
  pageHeader,
  projectedExcerpt,
  section,
} from '../components';
import {
  ICONS,
  VIEW_ATLAS,
} from '../constants';
import type {
  ProjectionRecord,
} from '../contracts/manifest-v4';
import type {
  LearningOSUI,
} from '../main';
import {
  asLabel as projectedLabel,
  asListLength as projectedListLength,
  asString as projectedString,
} from '../projection/readers';

interface AtlasViewState {
  domain?: string | null;
}

interface AtlasDomain {
  readonly name: string;
  readonly notes: ProjectionRecord[];
  readonly shelves: ProjectionRecord[];
}

type AtlasPlugin = Pick<
  LearningOSUI,
  | 'generate'
  | 'openAuthoredPath'
  | 'openLibrary'
  | 'openLibraryFiltered'
  | 'openVaultPath'
  | 'store'
>;

export const ATLAS_ROLE_ORDER: readonly string[] = [
  'crosswalk',
  'reference',
  'synthesis',
  'exercise-bank',
  'mock-exam',
];

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
    const domain = this.leaf.state?.domain;

    this.domain =
      typeof domain === 'string'
        ? domain
        : null;

    this.render();
  }

  atlas(): AtlasDomain[] {
    const domains =
      new Map<string, AtlasDomain>();

    const bucket = (
      name: unknown,
    ): AtlasDomain => {
      const key = String(
        name || 'cross-domain',
      );

      const existing =
        domains.get(key);

      if (existing) {
        return existing;
      }

      const created: AtlasDomain = {
        name: key,
        notes: [],
        shelves: [],
      };

      domains.set(
        key,
        created,
      );

      return created;
    };

    for (
      const note of
      this.plugin.store.of('note')
    ) {
      bucket(note.domain).notes.push(note);
    }

    for (
      const shelf of
      this.plugin.store.of('collection')
    ) {
      bucket(shelf.domain).shelves.push(shelf);
    }

    return [...domains.values()].sort(
      (left, right) =>
        right.notes.length - left.notes.length
        || left.name.localeCompare(right.name),
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
      'Every domain’s notes, wiring hubs and shelves — so a question standing in one module can be answered by another domain’s shelf.',
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

    for (const domain of domains) {
      const entries = domain.shelves.reduce(
        (
          total: number,
          shelf: ProjectionRecord,
        ) =>
          total
          + projectedListLength(
            shelf.entries,
          ),
        0,
      );

      const crosswalks =
        domain.notes.filter(
          (note: ProjectionRecord) =>
            note.role === 'crosswalk',
        ).length;

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
        text: domain.name,
      });

      const plural = (
        count: number,
        noun: string,
      ): string =>
        `${count} ${noun}${
          count === 1
            ? ''
            : 's'
        }`;

      const summaryParts = [
        plural(
          domain.notes.length,
          'note',
        ),
        crosswalks
          ? plural(
            crosswalks,
            'crosswalk',
          )
          : '',
        `${
          plural(
            domain.shelves.length,
            'shelf',
          ).replace(
            'shelfs',
            'shelves',
          )
        } (${entries})`,
      ].filter(
        (
          part,
        ): part is string =>
          Boolean(part),
      );

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

    this.renderDomain(
      body,
      current,
    );

    this.renderBoundaries(root);
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
      note.role,
      note.state,
      note.id,
    ]);

    if (metadata) {
      copy.createSpan({
        cls: 'los-micro',
        text: metadata,
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

  renderDomain(
    parent: HTMLElement,
    domain: AtlasDomain | undefined,
  ): void {
    if (!domain) {
      return;
    }

    const header = parent.createDiv({
      cls: 'los-atlas-domain-head',
    });

    header.createEl('h2', {
      text: domain.name,
    });

    const actions = header.createDiv({
      cls: 'los-actions',
    });

    button(
      actions,
      'Browse these notes in the Library',
      () =>
        this.plugin.openLibraryFiltered(
          'note',
          domain.name,
        ),
      'quiet',
    );

    const crosswalks =
      domain.notes.filter(
        (note: ProjectionRecord) =>
          note.role === 'crosswalk',
      );

    if (crosswalks.length) {
      const wrap = section(
        parent,
        `Wiring hubs (${crosswalks.length})`,
        'Crosswalks carry the narrative that joins this domain’s sources and concepts — read one before opening a shelf.',
      );

      for (const note of crosswalks) {
        this.noteRow(
          wrap,
          note,
        );
      }
    }

    const byRole =
      new Map<
        string,
        ProjectionRecord[]
      >();

    for (const note of domain.notes) {
      const role = String(
        note.role || 'synthesis',
      );

      const existingRows =
        byRole.get(role);

      if (existingRows) {
        existingRows.push(note);
      } else {
        byRole.set(
          role,
          [note],
        );
      }
    }

    const roles = [
      ...byRole.keys(),
    ].sort(
      (left, right) => {
        const rank = (
          role: string,
        ): number =>
          (
            ATLAS_ROLE_ORDER.indexOf(role)
            + 1
            || 99
          );

        return (
          rank(left) - rank(right)
          || left.localeCompare(right)
        );
      },
    );

    if (domain.notes.length) {
      const notesWrap = section(
        parent,
        `Notes (${domain.notes.length})`,
        'Grouped by role. Opening a row opens the note itself.',
      );

      for (const role of roles) {
        const roleRows =
          byRole.get(role) ?? [];

        const rows = roleRows
          .slice()
          .sort(
            (left, right) =>
              projectedLabel(left)
                .localeCompare(
                  projectedLabel(right),
                ),
          );

        const group =
          notesWrap.createEl(
            'details',
            {
              cls: 'los-atlas-group',
            },
          );

        if (
          role !== 'crosswalk'
          && rows.length <= 12
        ) {
          group.setAttr(
            'open',
            'open',
          );
        }

        group.createEl(
          'summary',
          {
            text:
              `${role} (${rows.length})`,
          },
        );

        for (const note of rows) {
          this.noteRow(
            group,
            note,
          );
        }
      }
    } else {
      empty(
        parent,
        'No notes in this domain yet',
        'Sources here surface only through concept links and shelves.',
      );
    }

    const shelvesWrap = section(
      parent,
      `Shelves (${domain.shelves.length})`,
      'Curated reading lists. The blurb is the shelf’s own rule for using it.',
    );

    if (!domain.shelves.length) {
      empty(
        shelvesWrap,
        'No shelves yet',
        'Nothing curated for this domain — the registry still holds its sources.',
      );
    }

    const shelves = domain.shelves
      .slice()
      .sort(
        (left, right) =>
          projectedLabel(left)
            .localeCompare(
              projectedLabel(right),
            ),
      );

    for (const shelf of shelves) {
      const card =
        shelvesWrap.createDiv({
          cls: 'los-shelf-entry',
        });

      const head = card.createEl(
        'button',
        {
          cls:
            'los-shelf-entry-title is-clickable',
          attr: {
            type: 'button',
          },
        },
      );

      icon(
        head.createSpan(),
        'library',
      );

      head.createSpan({
        text:
          `${projectedLabel(shelf)} (${
            projectedListLength(
              shelf.entries,
            )
          })`,
      });

      const shelfId =
        projectedString(shelf.id);

      head.addEventListener(
        'click',
        () => {
          if (shelfId) {
            void this.plugin.openLibrary(
              shelfId,
              'collection',
            );
          }
        },
      );

      const summary =
        projectedString(shelf.summary);

      if (summary) {
        card.createDiv({
          cls: 'los-shelf-why',
          text: projectedExcerpt(
            summary,
            320,
          ),
        });
      }
    }
  }

  renderBoundaries(
    root: HTMLElement,
  ): void {
    const boundaries =
      this.plugin.store.rows(
        'quarantine_boundaries',
      );

    const wrap = section(
      root,
      'Outside this map by policy',
      'Named so their absence is visible; their content is never loaded, indexed, or searched.',
    );

    if (!boundaries.length) {
      empty(
        wrap,
        'No boundary records',
        'Nothing is currently quarantined in the projection.',
      );
    }

    for (const boundary of boundaries) {
      const card = wrap.createDiv({
        cls: 'los-boundary-row',
      });

      card.createDiv({
        cls: 'los-item-copy',
        text: projectedLabel(boundary),
      });

      const description =
        projectedString(
          boundary.description,
        ) ?? '';

      const policy =
        boundaryPolicy(description);

      if (policy) {
        card.createDiv({
          cls: 'los-micro',
          text: policy,
        });
      }
    }

    button(
      wrap,
      'Open the generated atlas file',
      () =>
        this.plugin.openVaultPath(
          'generated/domain-atlas.md',
        ),
      'quiet',
    );
  }
}
