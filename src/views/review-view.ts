import { ItemView, type WorkspaceLeaf } from 'obsidian';
import * as fs from 'node:fs';
import * as nodePath from 'node:path';
import { badge, button, empty, filterTabs, OWNERSHIP_STATEMENT, pageHeader, section } from '../components';
import { CONTRACT_VERSION, VIEW_DIAGNOSTICS, VIEW_REVIEW } from '../constants';
import type { ProjectionRecord } from '../contracts/manifest';
import type { AppSurface } from '../app/surface';
import type { AppNavigator } from '../app/navigator';
import { errorMessage, isRecord } from '../projection/readers';

type ReviewAction = [string, () => unknown];

interface BuildInfo {
  ui_version: string;
  manifest_contract_version: number;
  source_revision: string;
  /** null when the build could not ask Git — "unknown", not "clean". */
  source_dirty: boolean | null;
  source_committed_at: string;
  source_fingerprint: string;
  bundle_sha256: string;
  node_version: string;
}

interface DiagnosticsApp {
  readonly vault: {
    readonly adapter: {
      getBasePath(): string;
    };
  };
}

interface DiagnosticsGenerated {
  readonly contract_version?: string | number;
  readonly generator?: string;
  readonly generated_at?: string;
  readonly snapshot_id?: string;
  readonly source_revision?: string;
  readonly source_dirty?: boolean;
}

type DiagnosticsPlugin = Pick<
  AppSurface,
  | 'copyText'
  | 'gateway'
  | 'generate'
  | 'manifest'
  | 'resolvePython'
  | 'store'
  | 'uiVersion'
>;

type ReviewPlugin = Pick<
  AppSurface,
  | 'generate'
  | 'openVaultPath'
  | 'store'
> & {
  readonly nav: Pick<
    AppNavigator,
    | 'openGarden'
    | 'openShelving'
    | 'openUnit'
  >;
};

type ReviewFilter =
  | 'all'
  | 'inbox'
  | 'shelving'
  | 'planning'
  | 'garden';

const REVIEW_FILTERS: ReadonlyArray<
  readonly [ReviewFilter, string]
> = [
  ['all', 'All'],
  ['inbox', 'Inbox'],
  ['shelving', 'Shelving'],
  ['planning', 'Planning'],
  ['garden', 'Garden'],
];

/**
 * Review renders decisions already identified by Core.
 *
 * It never reconstructs a queue from counts, unit status, Garden age, or file
 * layout. Membership, reason, target, and stable identity all come from
 * `review_items`.
 */
export class ReviewView extends ItemView {
  private readonly plugin: ReviewPlugin;
  private filter: ReviewFilter = 'all';

  constructor(
    leaf: WorkspaceLeaf,
    plugin: ReviewPlugin,
  ) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_REVIEW;
  }

  getDisplayText() {
    return 'LearningOS · Review';
  }

  getIcon() {
    return 'check-check';
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  render(): void {
    const root = this.contentEl;

    root.empty();
    root.addClass(
      'los-root',
      'los-review-view',
    );

    if (!this.plugin.store.ready) {
      pageHeader(
        root,
        'LearningOS',
        'Projection unavailable',
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

    const items =
      this.plugin.store.reviewItems();

    const header = pageHeader(
      root,
      'Review · Decisions',
      'Review',
      'Everything here is waiting on a decision from you.',
    );

    badge(
      header,
      `${items.length} decision${items.length === 1 ? '' : 's'} waiting`,
      'role',
    ).addClass('los-review-count-badge');

    filterTabs(
      root,
      'Review categories',
      REVIEW_FILTERS,
      this.filter,
      (value) => {
        this.filter = value;
        this.render();
      },
      (value) => (
        value === 'all'
          ? items.length
          : items.filter(
            (item) => item.category === value,
          ).length
      ),
    );

    root.createDiv({
      cls: 'los-micro los-review-queue-note',
      text:
        'Only items that require a decision appear here. '
        + 'Garden stays quiet until Core marks a seed review-due.',
    });

    const visible = this.filter === 'all'
      ? items
      : items.filter(
        (item) => item.category === this.filter,
      );

    const list = root.createDiv({
      cls: 'los-review-list',
    });

    if (!visible.length) {
      empty(
        list,
        items.length
          ? 'Nothing in this category'
          : 'Nothing waiting',
        items.length
          ? 'Choose another Review filter.'
          : 'Core has not projected any current Review decisions.',
      );
    } else {
      for (const item of visible) {
        this.decision(list, item);
      }
    }
  }

  decision(
    parent: HTMLElement,
    item: ProjectionRecord,
  ): HTMLElement {
    const id =
      typeof item.id === 'string'
        ? item.id
        : 'review-item';

    const category =
      typeof item.category === 'string'
        ? item.category
        : 'review';

    const title =
      typeof item.title === 'string'
        ? item.title
        : id;

    const context =
      typeof item.context === 'string'
        ? item.context
        : '';

    const reason =
      typeof item.reason === 'string'
        ? item.reason
        : '';

    const row = parent.createDiv({
      cls: 'los-review-decision-row',
      attr: {
        'data-review-id': id,
      },
    });

    const copy = row.createDiv({
      cls: 'los-review-decision-copy',
    });

    const top = copy.createDiv({
      cls: 'los-review-decision-top',
    });

    badge(
      top,
      category.replace(/-/g, ' '),
      'role',
    );

    top.createEl('h2', {
      text: title,
    });

    if (context) {
      copy.createDiv({
        cls: 'los-micro los-review-context',
        text: context,
      });
    }

    if (reason) {
      copy.createEl('p', {
        cls: 'los-review-reason',
        text: reason,
      });
    }

    const action =
      this.actionFor(item);

    if (action) {
      button(
        row,
        action[0],
        action[1],
        'quiet',
      );
    } else {
      row.createSpan({
        cls: 'los-micro los-review-clear',
        text: 'No supported action',
      });
    }

    return row;
  }

  actionFor(
    item: ProjectionRecord,
  ): ReviewAction | null {
    const target =
      isRecord(item.target)
        ? item.target
        : null;

    if (!target) {
      return null;
    }

    const kind =
      typeof target.kind === 'string'
        ? target.kind
        : '';

    if (
      kind === 'study-map'
      && typeof target.unit_id === 'string'
    ) {
      return [
        'Review proposal',
        () =>
          this.plugin.nav.openShelving(
            target.unit_id as string,
          ),
      ];
    }

    if (
      kind === 'inbox-item'
      && typeof target.path === 'string'
    ) {
      return [
        'Route',
        () =>
          this.plugin.openVaultPath(
            target.path as string,
          ),
      ];
    }

    if (
      kind === 'unit'
      && typeof target.id === 'string'
    ) {
      return [
        'Open unit',
        () =>
          this.plugin.nav.openUnit(
            target.id as string,
          ),
      ];
    }

    if (
      kind === 'garden-note'
      || kind === 'garden-seed'
    ) {
      return [
        'Review seed',
        () => this.plugin.nav.openGarden(),
      ];
    }

    return null;
  }
}

/**
 * Diagnostics — everything the learner does not need while studying. Lives
 * under More, never on Home. A green/red badge is not enough for a layer that
 * can be stale, warning, erroring, or talking to no core at all.
 */
export class DiagnosticsView extends ItemView {
  private readonly plugin: DiagnosticsPlugin;
  private report = '';

  constructor(
    leaf: WorkspaceLeaf,
    plugin: DiagnosticsPlugin,
  ) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() { return VIEW_DIAGNOSTICS; }
  getDisplayText() { return 'LearningOS · Diagnostics'; }
  getIcon() { return 'activity'; }
  async onOpen(): Promise<void> {
    this.render();
  }

  buildInfo(): BuildInfo {
    const fallback: BuildInfo = {
      ui_version: this.plugin.uiVersion(),
      manifest_contract_version: CONTRACT_VERSION,
      source_revision: 'unavailable',
      source_dirty: null,
      source_committed_at: 'unavailable',
      source_fingerprint: 'unavailable',
      bundle_sha256: 'unavailable',
      node_version: 'unavailable',
    };

    try {
      const app = this.app as DiagnosticsApp;
      const base = app.vault.adapter.getBasePath();
      const pluginInfo = this.plugin.manifest as unknown as {
        readonly dir?: string;
        readonly id?: string;
      } | undefined;
      const directory = pluginInfo?.dir
        || nodePath.join(
          '.obsidian',
          'plugins',
          pluginInfo?.id || 'learningos-ui',
        );
      const target = nodePath.join(
        base,
        directory,
        'build-info.json',
      );

      if (!fs.existsSync(target)) {
        return fallback;
      }

      const parsed: unknown = JSON.parse(
        fs.readFileSync(target, 'utf8'),
      );

      if (!isRecord(parsed)) {
        return fallback;
      }

      return {
        ui_version:
          typeof parsed.ui_version === 'string'
            ? parsed.ui_version
            : fallback.ui_version,
        manifest_contract_version:
          typeof parsed.manifest_contract_version === 'number'
            ? parsed.manifest_contract_version
            : fallback.manifest_contract_version,
        source_revision:
          typeof parsed.source_revision === 'string'
            ? parsed.source_revision
            : fallback.source_revision,
        // A missing flag stays null: an older build-info predates the field,
        // and reading that absence as "clean" is the exact false reassurance
        // this row exists to remove.
        source_dirty:
          typeof parsed.source_dirty === 'boolean'
            ? parsed.source_dirty
            : fallback.source_dirty,
        source_committed_at:
          typeof parsed.source_committed_at === 'string'
            ? parsed.source_committed_at
            : fallback.source_committed_at,
        source_fingerprint:
          typeof parsed.source_fingerprint === 'string'
            ? parsed.source_fingerprint
            : fallback.source_fingerprint,
        bundle_sha256:
          typeof parsed.bundle_sha256 === 'string'
            ? parsed.bundle_sha256
            : fallback.bundle_sha256,
        node_version:
          typeof parsed.node_version === 'string'
            ? parsed.node_version
            : fallback.node_version,
      };
    } catch (_) {
      return fallback;
    }
  }

  state(): [string, string, string] {
    if (!this.plugin.store.ready) return ['?', 'Core unavailable', this.plugin.store.error];
    if (this.plugin.store.data?._generated?.source_dirty) {
      return ['●', 'Canonical files changed; projection is stale', 'Rebuild to bring the interface back in step.'];
    }
    return ['✓', 'Valid and current', 'The projection matches the canonical tree as of its last rebuild.'];
  }

  render(): void {
    const root = this.contentEl;
    root.empty();
    root.addClass('los-root', 'los-diagnostics-view');
    pageHeader(root, 'More', 'Diagnostics');
    const [glyph, title, detail] = this.state();
    const status = root.createDiv({ cls: 'los-diagnostic-status' });
    status.createSpan({ cls: 'los-diagnostic-glyph', text: glyph });
    const copy = status.createDiv();
    copy.createEl('strong', { text: title });
    copy.createDiv({ cls: 'los-micro', text: detail });

    const generated: DiagnosticsGenerated =
      this.plugin.store.data?._generated ?? {};
    const build = this.buildInfo();
    const facts = section(root, 'Contract and versions');
    const table = facts.createDiv({ cls: 'los-fact-list' });
    const factRows: ReadonlyArray<
      readonly [string, unknown]
    > = [
      ['Manifest contract', generated.contract_version ?? 'unknown'],
      ['UI expects contract', CONTRACT_VERSION],
      ['UI version', this.plugin.uiVersion()],
      ['UI source revision', build.source_revision],
      // The projection states its own staleness; before this the interface
      // stated nothing about its own, and a vault quietly ran a build 32
      // commits behind its source for a day.
      ['UI built from', build.source_dirty === null
        ? `${build.source_committed_at} (working tree unknown)`
        : build.source_dirty
          ? `${build.source_committed_at} + uncommitted sources`
          : build.source_committed_at],
      ['UI source fingerprint', build.source_fingerprint],
      ['UI bundle fingerprint', build.bundle_sha256],
      ['Build Node', build.node_version],
      ['Generator', generated.generator || 'unknown'],
      ['Projection built', generated.generated_at || 'unknown'],
      ['Snapshot', generated.snapshot_id || 'unknown'],
      ['Source revision', generated.source_revision || 'unknown'],
      ['Python interpreter', this.plugin.resolvePython().path],
      ['Interpreter source', this.plugin.resolvePython().origin],
    ];

    for (const [label, value] of factRows) {
      const row = table.createDiv({ cls: 'los-fact-row' });
      row.createSpan({ cls: 'los-fact-label', text: label });
      row.createSpan({ cls: 'los-fact-value', text: String(value) });
    }

    const actions = root.createDiv({ cls: 'los-actions' });
    button(actions, 'Validate and rebuild', () => this.plugin.generate(), 'success');
    button(actions, 'Test the interpreter', () => this.testInterpreter(), 'info');
    button(actions, 'Copy build identity', () => this.plugin.copyText(JSON.stringify(build, null, 2)), 'quiet');
    if (this.report) root.createEl('pre', { cls: 'los-diagnostic-report', text: this.report });

    const policy = section(root, 'About LearningOS');
    policy.createEl('p', { text: OWNERSHIP_STATEMENT });
  }

  async testInterpreter(): Promise<void> {
    const resolved = this.plugin.resolvePython();
    try {
      const result: unknown = await this.plugin.gateway.call(['status', '--json']);
      this.report = `${resolved.path} (${resolved.origin})\nCore answered: ${JSON.stringify(result).slice(0, 400)}`;
    } catch (error: unknown) {
      this.report = `${resolved.path} (${resolved.origin})\nFailed: ${errorMessage(error)}\nTried: ${resolved.attempted.join(', ')}`;
    }
    this.render();
  }
}
