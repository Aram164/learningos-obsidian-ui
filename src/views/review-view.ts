import { ItemView, type WorkspaceLeaf } from 'obsidian';
import * as fs from 'node:fs';
import * as nodePath from 'node:path';
import {
  badge,
  button,
  empty,
  factList,
  filterTabs,
  OWNERSHIP_STATEMENT,
  pageHeader,
  section,
} from '../components';
import { CONTRACT_VERSION, VIEW_DIAGNOSTICS, VIEW_REVIEW } from '../constants';
import type { ProjectionRecord } from '../contracts/manifest';
import type { AppSurface } from '../app/surface';
import type { AppNavigator } from '../app/navigator';
import { errorMessage, isRecord } from '../projection/readers';
import { gatewayRecoverySummary } from '../application/gateway-recovery';
import {
  asHealthReport,
  type HealthReportV1,
} from '../contracts/health-report';
import {
  asLegacyArchiveStatus,
  type LegacyArchiveDispositionV1,
  type LegacyArchiveLockV1,
} from '../contracts/legacy-archive';

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
  readonly schema_sha256?: string;
  readonly generator?: string;
  readonly generated_at?: string;
  readonly snapshot_id?: string;
  readonly source_revision?: string | null;
  readonly source_dirty?: boolean;
}

type DiagnosticsPlugin = Pick<
  AppSurface,
  | 'copyText'
  | 'gateway'
  | 'gatewayRecoveryState'
  | 'generate'
  | 'manifest'
  | 'resolvePython'
  | 'retryRecoveredWrite'
  | 'runtimeBuildIdentity'
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
  private screen: 'health' | 'legacy' = 'health';
  private health: HealthReportV1 | null = null;
  private healthLoading = false;
  private healthError = '';
  private legacy: LegacyArchiveLockV1 | null = null;
  private legacyLoaded = false;
  private legacyLoading = false;
  private legacyError = '';

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
    void this.loadHealth();
  }

  private async loadHealth(): Promise<void> {
    if (this.healthLoading) return;
    this.healthLoading = true;
    this.healthError = '';
    this.render();
    try {
      const report = asHealthReport(await this.plugin.gateway.healthReport());
      if (!report) throw new Error('Core returned an invalid health-report response.');
      this.health = report;
    } catch (error: unknown) {
      this.health = null;
      this.healthError = errorMessage(error);
    } finally {
      this.healthLoading = false;
      this.render();
    }
  }

  private async loadLegacy(): Promise<void> {
    if (this.legacyLoading) return;
    this.legacyLoading = true;
    this.legacyError = '';
    this.render();
    try {
      const status = asLegacyArchiveStatus(
        await this.plugin.gateway.legacyArchiveStatus(),
      );
      if (!status) throw new Error('Core returned an invalid Legacy Archive status response.');
      this.legacy = status.lock;
      this.legacyLoaded = true;
    } catch (error: unknown) {
      this.legacy = null;
      this.legacyLoaded = false;
      this.legacyError = errorMessage(error);
    } finally {
      this.legacyLoading = false;
      this.render();
    }
  }

  private selectScreen(screen: 'health' | 'legacy'): void {
    this.screen = screen;
    this.render();
    if (screen === 'legacy' && !this.legacyLoaded) void this.loadLegacy();
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
    if (this.healthLoading) return ['…', 'Checking LearningOS health', 'Waiting for the bounded Core health report.'];
    if (this.health?.status === 'healthy') {
      return ['✓', 'Healthy', `Core verified ${this.health.checks.length} registered checks at ${this.health.generated_at}.`];
    }
    if (this.health?.status === 'attention-required') {
      const count = this.health.checks.filter((check) => check.status !== 'ok').length;
      return ['!', 'Attention required', `${count} check${count === 1 ? '' : 's'} need an owner or remedy.`];
    }
    if (this.healthError) return ['?', 'Health unavailable', this.healthError];
    return ['?', 'Health not checked', 'Run the bounded health report before trusting a green state.'];
  }

  render(): void {
    const root = this.contentEl;
    root.empty();
    root.addClass('los-root', 'los-diagnostics-view');
    pageHeader(root, 'More', 'Diagnostics');
    const tabs = root.createDiv({ cls: 'los-subtabs', attr: { 'aria-label': 'Diagnostics sections' } });
    for (const [key, label] of [['health', 'Health'], ['legacy', 'Legacy Archive']] as const) {
      const tab = button(tabs, label, () => this.selectScreen(key), key === this.screen ? 'info' : 'quiet');
      tab.setAttr('aria-pressed', key === this.screen ? 'true' : 'false');
    }

    const generated: DiagnosticsGenerated =
      this.plugin.store.data?._generated ?? {};
    const build = this.buildInfo();
    const runtime = this.plugin.runtimeBuildIdentity();
    // The installed build-info.json and the code actually executing right now
    // can disagree: an old in-memory plugin can go on running after a newer
    // build lands on disk, and only a reload replaces it. Comparing the two
    // fingerprints is the one way to tell which of them Diagnostics is
    // actually looking at.
    const identityMatches = runtime.fingerprint !== 'unavailable'
      && runtime.fingerprint === build.source_fingerprint
      && runtime.contractVersion === build.manifest_contract_version;
    this.setIdentityAttributes(root, generated, build, identityMatches);

    if (this.screen === 'legacy') {
      this.renderLegacy(root);
      return;
    }
    const [glyph, title, detail] = this.state();
    const status = root.createDiv({ cls: 'los-diagnostic-status' });
    status.createSpan({ cls: 'los-diagnostic-glyph', text: glyph });
    const copy = status.createDiv();
    copy.createEl('strong', { text: title });
    copy.createDiv({ cls: 'los-micro', text: detail });

    if (this.health) {
      const checks = section(root, 'Health checks', `Generated ${this.health.generated_at}`);
      for (const check of this.health.checks) {
        const row = checks.createDiv({ cls: 'los-health-check' });
        const heading = row.createDiv({ cls: 'los-health-check-head' });
        heading.createEl('strong', { text: check.summary });
        badge(heading, check.status, check.status === 'ok' ? 'status' : 'role');
        factList(row, [
          ['Check', check.id],
          ['Owner', check.owner],
          ['Remedy', check.remedy],
        ]);
      }
    }

    const facts = section(root, 'Contract and versions');
    const factRows: ReadonlyArray<
      readonly [string, unknown]
    > = [
      ['Manifest contract', generated.contract_version ?? 'unknown'],
      ['Manifest schema', generated.schema_sha256 ?? 'unknown'],
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
      ['UI source fingerprint (installed)', build.source_fingerprint],
      ['UI source fingerprint (running)', runtime.fingerprint],
      ['Running code matches installed build-info', identityMatches
        ? 'yes'
        : 'NO — reload learningos-ui'],
      ['UI bundle fingerprint', build.bundle_sha256],
      ['Build Node', build.node_version],
      ['Generator', generated.generator || 'unknown'],
      ['Projection built', generated.generated_at || 'unknown'],
      ['Snapshot', generated.snapshot_id || 'unknown'],
      ['Source revision', generated.source_revision || 'unknown'],
      ['Python interpreter', this.plugin.resolvePython().path],
      ['Interpreter source', this.plugin.resolvePython().origin],
    ];

    factList(facts, factRows);

    this.renderGatewayRecovery(root);

    const actions = root.createDiv({ cls: 'los-actions' });
    button(actions, 'Refresh health', () => void this.loadHealth(), 'info');
    button(actions, 'Validate and rebuild', () => this.plugin.generate(), 'success');
    button(actions, 'Test the interpreter', () => this.testInterpreter(), 'info');
    button(actions, 'Copy build identity', () => this.plugin.copyText(JSON.stringify(build, null, 2)), 'quiet');
    if (this.report) root.createEl('pre', { cls: 'los-diagnostic-report', text: this.report });

    const policy = section(root, 'About LearningOS');
    policy.createEl('p', { text: OWNERSHIP_STATEMENT });
  }

  /**
   * The visible facts above, as stable machine-readable attributes.
   *
   * The live-app checker used to *echo back* the SHAs its caller passed on the
   * command line and call that verification, so any wrong pair could be
   * attested as correct. These attributes are what it extracts and compares
   * against instead — read from the running app rather than from its own
   * arguments. Nothing here is payload text or a local path, exactly like the
   * visible facts.
   *
   * Set before the tab branch, so the checker can read identity whichever
   * Diagnostics tab the operator happens to be on. A flag that is not a real
   * boolean reports `unknown` rather than stringifying itself, because the
   * checker treats unknown as "not proven clean" and must never be handed a
   * `"null"` it would have to interpret.
   */
  private setIdentityAttributes(
    root: HTMLElement,
    generated: DiagnosticsGenerated,
    build: BuildInfo,
    identityMatches: boolean,
  ): void {
    const flag = (value: unknown): string =>
      (typeof value === 'boolean' ? String(value) : 'unknown');
    root.setAttr('data-los-manifest-contract', String(generated.contract_version ?? 'unknown'));
    root.setAttr('data-los-runtime-fingerprint-matches', identityMatches ? 'yes' : 'no');
    root.setAttr('data-los-core-revision', String(generated.source_revision || 'unknown'));
    root.setAttr('data-los-ui-revision', String(build.source_revision || 'unknown'));
    root.setAttr('data-los-core-dirty', flag(generated.source_dirty));
    root.setAttr('data-los-ui-dirty', flag(build.source_dirty));
    root.setAttr(
      'data-los-gateway-recovery-clear',
      this.plugin.gatewayRecoveryState().kind === 'clear' ? 'yes' : 'no',
    );
  }

  /**
   * The one place an unresolved write is visible and actionable.
   *
   * Metadata only: no payload text and no file paths, because this screen is
   * the one a learner is most likely to screenshot when asking for help.
   *
   * There is deliberately no discard, delete, reset or "start over". Every one
   * of those would let a learner resolve an ambiguity by declaring it resolved,
   * which is precisely the judgement nobody at this screen can make — the write
   * either landed or it did not, and only Core can say which.
   */
  private renderGatewayRecovery(root: HTMLElement): void {
    const state = this.plugin.gatewayRecoveryState();
    const panel = section(
      root,
      'Gateway recovery',
      'One unresolved canonical write, if there is one.',
    );
    if (state.kind === 'clear') {
      panel.createEl('p', { text: 'No unresolved Gateway write.' });
      return;
    }
    const rows = gatewayRecoverySummary(state) ?? [];
    factList(panel, rows);
    const actions = root.createDiv({ cls: 'los-actions' });
    if (state.kind === 'record' && state.entry.record.phase !== 'confirmed') {
      button(
        actions,
        'Retry exact request',
        () => void this.plugin.retryRecoveredWrite(),
        'info',
      );
    } else if (state.kind === 'record') {
      button(
        actions,
        'Finish confirmed write',
        () => void this.plugin.retryRecoveredWrite(),
        'info',
      );
    }
    button(
      actions,
      'Copy recovery summary',
      () => this.plugin.copyText(
        rows.map(([label, value]) => `${label}: ${value}`).join('\n'),
      ),
      'quiet',
    );
  }

  private renderLegacy(root: HTMLElement): void {
    const header = section(
      root,
      'Legacy Archive',
      'Read-only disposition and verification status. Archived records never become normal manifest content here.',
    );
    if (this.legacyLoading) {
      empty(header, 'Checking archive lock', 'Waiting for Core’s bounded archive-status response.');
      return;
    }
    if (this.legacyError) {
      empty(header, 'Legacy Archive unavailable', this.legacyError, 'Try again', () => void this.loadLegacy());
      return;
    }
    if (!this.legacyLoaded) {
      empty(header, 'Archive status not loaded', 'Load the reviewed archive lock without opening archived content.', 'Load archive status', () => void this.loadLegacy());
      return;
    }
    if (!this.legacy) {
      empty(header, 'No approved archive lock', 'Core reports that no reviewed Legacy Archive disposition lock is available. Archived content remains sealed.');
      const actions = root.createDiv({ cls: 'los-actions' });
      button(actions, 'Refresh archive status', () => void this.loadLegacy(), 'info');
      return;
    }

    const lock = this.legacy;
    const status = root.createDiv({ cls: 'los-diagnostic-status' });
    status.createSpan({
      cls: 'los-diagnostic-glyph',
      text: lock.verification.status === 'verified' ? '✓' : '!',
    });
    const copy = status.createDiv();
    copy.createEl('strong', {
      text: lock.verification.status === 'verified'
        ? 'Archive lock verified'
        : 'Archive lock needs attention',
    });
    copy.createDiv({
      cls: 'los-micro',
      text: `Verified ${lock.verification.verified_at}. ${lock.excluded.count} excluded item${lock.excluded.count === 1 ? '' : 's'} remain sealed and were not inspected.`,
    });

    const dispositions: LegacyArchiveDispositionV1[] = [
      'canonicalized', 'byte-preserved', 'superseded-system', 'historical-only', 'unresolved',
    ];
    const counts = Object.fromEntries(dispositions.map((disposition) => [
      disposition,
      lock.entries.filter((entry) => entry.disposition === disposition).length,
    ]));
    const facts = section(root, 'Disposition summary');
    factList(facts, [
      ['Reviewed entries', lock.entries.length],
      ['Canonicalized', counts.canonicalized],
      ['Byte preserved', counts['byte-preserved']],
      ['Superseded system', counts['superseded-system']],
      ['Historical only', counts['historical-only']],
      ['Unresolved', counts.unresolved],
      ['Excluded', `${lock.excluded.count} · sealed, not inspected`],
    ]);

    if (lock.verification.issues?.length) {
      const issues = section(root, 'Issues');
      for (const issue of lock.verification.issues) {
        issues.createDiv({ cls: 'los-health-check', text: issue });
      }
    }
    const actions = root.createDiv({ cls: 'los-actions' });
    button(actions, 'Refresh archive status', () => void this.loadLegacy(), 'info');
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
