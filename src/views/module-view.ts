import {
  ItemView,
  type WorkspaceLeaf,
} from 'obsidian';
import {
  badge,
  button,
  chip,
  disclosure,
  empty,
  pageHeader,
  section,
  unitCard,
  workspaceCard,
} from '../components';
import {
  STATUS_ORDER,
  VIEW_MODULE,
} from '../constants';
import type {
  JsonRecord,
  ProjectionRecord,
} from '../contracts/manifest-v2';
import type { LearningOSUI } from '../main';

const MODULE_TABS = [
  ['overview', 'Overview'],
  ['units', 'Units'],
  ['resources', 'Resources'],
  ['logistics', 'Logistics'],
] as const;

type ModuleScreen =
  | 'groups'
  | 'list'
  | 'detail';

type ModuleTab =
  (typeof MODULE_TABS)[number][0];

interface ModuleViewState {
  readonly screen: ModuleScreen;
  readonly groupId: string | null;
  readonly query: string;
  readonly moduleId: string | null;
  readonly componentId: string | null;
  readonly tab: ModuleTab | null;
}

interface ParsedModuleViewState {
  readonly screen: ModuleScreen;
  readonly groupId: string | null;
  readonly query: string;
  readonly moduleId: string | null;
  readonly componentId?: string | null | undefined;
  readonly tab?: ModuleTab | null | undefined;
  readonly hasComponentId: boolean;
  readonly hasTab: boolean;
}

interface ThematicGroupView {
  readonly id: string;
  readonly title: string;
  readonly description: string;
}

interface ModuleComponentView {
  readonly id: string;
  readonly title: string;
}

interface ModuleExaminationView {
  readonly type: string | null;
  readonly notes: string | null;
}

interface ModuleRecordView {
  readonly record: ProjectionRecord;
  readonly id: string;
  readonly title: string;
  readonly kind: string;
  readonly code: string;
  readonly semester: string;
  readonly status: string;
  readonly institution: string;
  readonly credits: string | null;
  readonly examination: ModuleExaminationView;
  readonly components: ModuleComponentView[];
}

interface UnitRecordView {
  readonly record: ProjectionRecord;
  readonly id: string;
  readonly title: string;
  readonly status: string;
}

interface ModuleProgressView {
  readonly stagesComplete: number;
  readonly stagesTotal: number;
  readonly unitsTotal: number;
}

interface DeadlineModuleView {
  readonly moduleId: string;
  readonly action: string | null;
}

interface AcademicDeadlineView {
  readonly record: ProjectionRecord;
  readonly kind: string;
  readonly label: string;
  readonly title: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly time: string | null;
  readonly registrationState: string;
  readonly directModuleId: string | null;
  readonly modules: DeadlineModuleView[];
}

interface SourceEntryView {
  readonly record: ProjectionRecord;
  readonly role: string;
  readonly sourceId: string | null;
  readonly why: string;
  readonly unitRouteCount: number;
}

type ModulePlugin = Pick<
  LearningOSUI,
  | 'back'
  | 'openLibrary'
  | 'openModule'
  | 'openModuleDetail'
  | 'openModuleGroup'
  | 'openUnit'
  | 'router'
  | 'store'
>;

function isRecord(
  value: unknown,
): value is JsonRecord {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
  );
}

function nonNull<T>(
  value: T | null,
): value is T {
  return value !== null;
}

function projectedString(
  value: unknown,
): string | null {
  return (
    typeof value === 'string'
    && value.length > 0
  )
    ? value
    : null;
}

function projectedText(
  value: unknown,
): string | null {
  if (
    typeof value !== 'string'
    && typeof value !== 'number'
  ) {
    return null;
  }

  const text = String(value);

  return text.length > 0
    ? text
    : null;
}

function projectedCount(
  value: unknown,
): number {
  if (
    typeof value !== 'number'
    || !Number.isFinite(value)
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.trunc(value),
  );
}

function projectedRecords(
  value: unknown,
): ProjectionRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (
      candidate,
    ): candidate is ProjectionRecord =>
      isRecord(candidate),
  );
}

function projectedStrings(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (
      candidate,
    ): candidate is string =>
      typeof candidate === 'string'
      && candidate.length > 0,
  );
}

function isModuleScreen(
  value: unknown,
): value is ModuleScreen {
  return (
    value === 'groups'
    || value === 'list'
    || value === 'detail'
  );
}

function isModuleTab(
  value: unknown,
): value is ModuleTab {
  return MODULE_TABS.some(
    ([tab]) => tab === value,
  );
}

function readModuleViewState(
  value: unknown,
): ParsedModuleViewState {
  if (!isRecord(value)) {
    return {
      screen: 'groups',
      groupId: null,
      query: '',
      moduleId: null,
      hasComponentId: false,
      hasTab: false,
    };
  }

  const moduleId =
    projectedString(value.moduleId);

  const screen = isModuleScreen(
    value.screen,
  )
    ? value.screen
    : moduleId
      ? 'detail'
      : 'groups';

  const hasComponentId =
    Object.prototype.hasOwnProperty.call(
      value,
      'componentId',
    );

  const hasTab =
    Object.prototype.hasOwnProperty.call(
      value,
      'tab',
    );

  const componentId =
    !hasComponentId
      ? undefined
      : value.componentId === null
        ? null
        : projectedString(
          value.componentId,
        );

  const tab =
    !hasTab
      ? undefined
      : value.tab === null
        ? null
        : isModuleTab(value.tab)
          ? value.tab
          : null;

  return {
    screen,
    groupId:
      projectedString(value.groupId),
    query:
      typeof value.query === 'string'
        ? value.query
        : '',
    moduleId,
    componentId,
    tab,
    hasComponentId,
    hasTab,
  };
}

function readThematicGroup(
  record: ProjectionRecord | null,
): ThematicGroupView | null {
  if (!record) {
    return null;
  }

  const id = projectedString(record.id);

  if (!id) {
    return null;
  }

  return {
    id,
    title:
      projectedString(record.title)
      ?? projectedString(record.label)
      ?? id,
    description:
      projectedText(record.description)
      ?? '',
  };
}

function readComponents(
  value: unknown,
): ModuleComponentView[] {
  return projectedRecords(value)
    .map((record): ModuleComponentView | null => {
      const id = projectedString(record.id);

      if (!id) {
        return null;
      }

      return {
        id,
        title:
          projectedString(record.short_title)
          ?? projectedString(record.title)
          ?? id,
      };
    })
    .filter(nonNull);
}

function readExamination(
  value: unknown,
): ModuleExaminationView {
  const examination = isRecord(value)
    ? value
    : {};

  return {
    type:
      projectedString(examination.type),
    notes:
      projectedText(examination.notes),
  };
}

function readModuleRecord(
  record: ProjectionRecord | null,
  fallbackId: string | null = null,
): ModuleRecordView | null {
  if (!record) {
    return null;
  }

  const id =
    projectedString(record.id)
    ?? fallbackId;

  if (!id) {
    return null;
  }

  return {
    record,
    id,
    title:
      projectedString(record.title)
      ?? id,
    kind:
      projectedString(record.kind)
      ?? 'Module',
    code:
      projectedText(record.code)
      ?? '',
    semester:
      projectedText(record.semester)
      ?? '',
    status:
      projectedString(record.status)
      ?? 'unspecified',
    institution:
      projectedText(record.institution)
      ?? '',
    credits:
      projectedText(record.credits),
    examination:
      readExamination(record.examination),
    components:
      readComponents(record.components),
  };
}

function normalizeUnitRecord(
  record: ProjectionRecord,
): UnitRecordView | null {
  const id = projectedString(record.id);

  if (!id) {
    return null;
  }

  const title =
    projectedString(record.title)
    ?? id;

  const status =
    projectedString(record.status)
    ?? 'unspecified';

  const normalized: ProjectionRecord = {
    ...record,
    id,
    title,
    status,
    scope:
      projectedText(record.scope)
      ?? '',
  };

  return {
    record: normalized,
    id,
    title,
    status,
  };
}

function normalizeWorkspaceRecord(
  record: ProjectionRecord,
): ProjectionRecord {
  return {
    ...record,
    id:
      projectedString(record.id)
      ?? '',
    title:
      projectedString(record.title)
      ?? projectedString(record.id)
      ?? 'Workspace',
    status:
      projectedString(record.status)
      ?? 'unspecified',
    objective:
      projectedText(record.objective)
      ?? '',
    next_action:
      projectedText(record.next_action)
      ?? '',
    deadline:
      projectedText(record.deadline)
      ?? '',
    standing:
      record.standing === true,
    module_ids:
      projectedStrings(record.module_ids),
    unit_ids:
      projectedStrings(record.unit_ids),
  };
}

function readProgress(
  value: unknown,
): ModuleProgressView {
  const progress = isRecord(value)
    ? value
    : {};

  return {
    stagesComplete:
      projectedCount(
        progress.stages_complete,
      ),
    stagesTotal:
      projectedCount(
        progress.stages_total,
      ),
    unitsTotal:
      projectedCount(
        progress.units_total,
      ),
  };
}

function readDeadlineModules(
  value: unknown,
): DeadlineModuleView[] {
  return projectedRecords(value)
    .map((record): DeadlineModuleView | null => {
      const moduleId =
        projectedString(record.module_id);

      if (!moduleId) {
        return null;
      }

      return {
        moduleId,
        action:
          projectedText(record.action),
      };
    })
    .filter(nonNull);
}

function readAcademicDeadline(
  record: ProjectionRecord,
): AcademicDeadlineView {
  const startDate =
    projectedString(record.start_date)
    ?? '';

  const endDate =
    projectedString(record.end_date)
    ?? '';

  return {
    record,
    kind:
      projectedString(record.kind)
      ?? 'academic-date',
    label:
      projectedString(record.label)
      ?? projectedString(record.title)
      ?? 'Academic date',
    title:
      projectedString(record.title)
      ?? '',
    startDate,
    endDate,
    time:
      projectedText(record.time),
    registrationState:
      projectedString(
        record.registration_state,
      )
      ?? 'unregistered',
    directModuleId:
      projectedString(record.module_id),
    modules:
      readDeadlineModules(record.modules),
  };
}

function readSourceEntries(
  value: unknown,
): SourceEntryView[] {
  return projectedRecords(value)
    .map((record): SourceEntryView => ({
      record,
      role:
        projectedString(record.role)
        ?? 'unassigned',
      sourceId:
        projectedString(record.source_id),
      why:
        projectedText(record.why)
        ?? '',
      unitRouteCount:
        Array.isArray(record.unit_routes)
          ? record.unit_routes.length
          : 0,
    }));
}

/**
 * Four tabs, because a module page was four pages wearing one coat: learning
 * work, resources, and administration each have their own reading mode. Units
 * is the default — the learner is here to study, not to check a credit count.
 */
export class ModuleView extends ItemView {
  private readonly plugin: ModulePlugin;

  private screen: ModuleScreen;
  private groupId: string | null;
  private query: string;
  private moduleId: string | null;
  private componentId: string | null;
  private tab: ModuleTab | null;

  selectedElementId: string | null;

  constructor(
    leaf: WorkspaceLeaf,
    plugin: ModulePlugin,
  ) {
    super(leaf);

    this.plugin = plugin;
    this.screen = 'groups';
    this.groupId = null;
    this.query = '';
    this.moduleId = null;
    this.componentId = null;
    this.tab = null;
    this.selectedElementId = null;
  }

  getViewType(): string {
    return VIEW_MODULE;
  }

  getDisplayText(): string {
    return 'LearningOS · Modules';
  }

  async setState(
    state: unknown = {},
  ): Promise<void> {
    const parsed =
      readModuleViewState(state);

    const nextModuleId =
      parsed.moduleId;

    if (nextModuleId !== this.moduleId) {
      this.componentId = null;
      this.tab = null;
    }

    this.screen = parsed.screen;
    this.groupId = parsed.groupId;
    this.query = parsed.query;
    this.moduleId = nextModuleId;

    if (parsed.hasComponentId) {
      this.componentId =
        parsed.componentId
        ?? null;
    }

    if (parsed.hasTab) {
      this.tab =
        parsed.tab
        ?? null;
    }

    this.render();
  }

  getState(): ModuleViewState {
    return {
      screen: this.screen,
      groupId: this.groupId,
      query: this.query,
      moduleId: this.moduleId,
      componentId: this.componentId,
      tab: this.tab,
    };
  }

  async onOpen(): Promise<void> {
    await this.setState(
      this.leaf.state,
    );
  }

  /** Units unless there is nothing to study yet. */
  defaultTab(
    module: ModuleRecordView,
  ): ModuleTab {
    return this.plugin.store
      .unitsFor(module.id)
      .length
      ? 'units'
      : 'overview';
  }

  render(): void {
    const root = this.contentEl;

    root.empty();
    root.addClass(
      'los-root',
      'los-module-view',
    );

    if (this.screen === 'list') {
      this.renderGroupList(root);
      return;
    }

    if (this.screen === 'detail') {
      this.renderModuleDetail(root);
      return;
    }

    this.renderGroups(root);
  }

  renderGroups(
    root: HTMLElement,
  ): void {
    pageHeader(
      root,
      'Modules',
      'Choose a thematic group',
      'Modules stay organized by explicit core-owned domains. Open a group to see its contents.',
    );

    const groups = this.plugin.store
      .thematicGroups()
      .map((record) =>
        readThematicGroup(record),
      )
      .filter(nonNull);

    if (!groups.length) {
      empty(
        root,
        'No thematic groups',
        'Rebuild the projection after defining thematic-group metadata.',
      );
      return;
    }

    const grid = root.createDiv({
      cls: 'los-group-grid',
    });

    for (const group of groups) {
      const modules = this.plugin.store
        .modulesForGroup(group.id)
        .map((record) =>
          readModuleRecord(record),
        )
        .filter(nonNull);

      const card = grid.createEl(
        'button',
        {
          cls:
            'los-group-card is-clickable',
          attr: {
            type: 'button',
            'aria-label':
              `Open ${group.title}`,
          },
        },
      );

      const head = card.createDiv({
        cls: 'los-group-card-header',
      });

      head.createEl('h2', {
        text: group.title,
      });

      head.createSpan({
        cls: 'los-group-count',
        text:
          `${modules.length} module${
            modules.length === 1
              ? ''
              : 's'
          }`,
      });

      if (group.description) {
        card.createEl('p', {
          text: group.description,
        });
      }

      card.createSpan({
        cls: 'los-route-open',
        text: 'Open →',
      });

      card.addEventListener(
        'click',
        () => {
          this.selectedElementId =
            group.id;

          return this.plugin
            .openModuleGroup(group.id);
        },
      );
    }
  }

  renderGroupList(
    root: HTMLElement,
  ): void {
    const groupRecord =
      this.groupId
        ? this.plugin.store.get(
          this.groupId,
        )
        : null;

    const group =
      readThematicGroup(groupRecord);

    const back = button(
      root,
      '‹ Modules',
      () => this.plugin.back(),
      'quiet',
    );

    back.addClass('los-route-back');

    if (!group) {
      empty(
        root,
        'Thematic group unavailable',
        'Return to Modules and choose another group.',
        'Back',
        () => this.plugin.back(),
      );
      return;
    }

    pageHeader(
      root,
      'Modules',
      group.title,
      group.description
      || 'Modules in this thematic group.',
    );

    const search = root.createEl(
      'input',
      {
        cls:
          'los-search los-route-search',
        attr: {
          type: 'search',
          placeholder:
            `Search ${group.title} modules…`,
          'aria-label':
            `Search ${group.title} modules`,
        },
      },
    );

    search.value = this.query;

    search.addEventListener(
      'input',
      async () => {
        this.query = search.value;

        await this.plugin.router.remember({
          name: 'module-list',
          groupId: group.id,
          query: this.query,
        });

        this.render();
      },
    );

    const all = this.plugin.store
      .modulesForGroup(group.id)
      .map((record) =>
        readModuleRecord(record),
      )
      .filter(nonNull);

    const needle =
      this.query
        .trim()
        .toLocaleLowerCase();

    const rows = all.filter(
      (module) => {
        if (!needle) {
          return true;
        }

        return [
          module.title,
          module.code,
          module.kind,
          module.semester,
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase()
          .includes(needle);
      },
    );

    if (!all.length) {
      empty(
        root,
        'No modules in this group',
        'The group exists, but no modules currently reference it.',
      );
      return;
    }

    if (!rows.length) {
      empty(
        root,
        'No matching modules',
        `Nothing in ${group.title} matches “${
          this.query.trim()
        }”.`,
        'Clear search',
        async () => {
          this.query = '';

          await this.plugin.router.remember({
            name: 'module-list',
            groupId: group.id,
            query: '',
          });

          this.render();
        },
      );
      return;
    }

    const list = root.createDiv({
      cls: 'los-route-list',
    });

    for (const module of rows) {
      const row = list.createEl(
        'button',
        {
          cls:
            'los-route-row is-clickable',
          attr: {
            type: 'button',
            'aria-label':
              `Open module: ${module.title}`,
            'data-record-id':
              module.id,
          },
        },
      );

      const copy = row.createDiv({
        cls: 'los-route-row-copy',
      });

      copy.createEl('strong', {
        text: module.title,
      });

      const meta = [
        module.code,
        module.kind,
        module.semester,
        module.status,
      ]
        .filter(Boolean)
        .join(' · ');

      if (meta) {
        copy.createDiv({
          cls: 'los-route-meta',
          text: meta,
        });
      }

      row.createSpan({
        cls: 'los-route-open',
        text: 'Open →',
      });

      row.addEventListener(
        'click',
        () => {
          this.selectedElementId =
            module.id;

          return this.plugin
            .openModuleDetail(module.id);
        },
      );
    }
  }

  renderModuleDetail(
    root: HTMLElement,
  ): void {
    const moduleRecord =
      this.moduleId
        ? this.plugin.store.get(
          this.moduleId,
        )
        : null;

    const module = readModuleRecord(
      moduleRecord,
      this.moduleId,
    );

    const back = button(
      root,
      '‹ Back',
      () => this.plugin.back(),
      'quiet',
    );

    back.addClass('los-route-back');

    if (!module) {
      empty(
        root,
        'Module unavailable',
        'Return to Modules and choose another module.',
      );
      return;
    }

    const tab =
      this.tab
      ?? this.defaultTab(module);

    const header = pageHeader(
      root,
      module.kind,
      module.title,
    );

    header.createDiv({
      cls: 'los-module-facts',
      text: this.headline(module),
    });

    const tabs = root.createDiv({
      cls: 'los-tabs',
      attr: {
        role: 'tablist',
      },
    });

    for (const [key, label] of MODULE_TABS) {
      const control = button(
        tabs,
        label,
        () => this.selectTab(key),
        key === tab
          ? 'cta'
          : 'quiet',
      );

      control.setAttrs({
        role: 'tab',
        'aria-selected':
          String(key === tab),
      });
    }

    if (tab === 'overview') {
      this.renderOverview(
        root,
        module,
      );
    } else if (tab === 'units') {
      this.renderUnits(
        root,
        module,
      );
    } else if (tab === 'resources') {
      this.renderSources(
        root,
        module,
      );
    } else {
      this.renderLogistics(
        root,
        module,
      );
    }
  }

  /** One line instead of six labelled facts; the rest is in Logistics. */
  headline(
    module: ModuleRecordView,
  ): string {
    const today =
      new Date()
        .toISOString()
        .slice(0, 10);

    const nextDate = this
      .deadlinesFor(module)
      .filter((row) =>
        (
          row.endDate
          || row.startDate
        ) >= today,
      )
      .map((row) => row.startDate)[0];

    return [
      module.semester,
      module.credits
        ? `${module.credits} LP`
        : '',
      module.examination.type
        ? `${
          module.examination.type
        }${
          nextDate
            ? ` ${nextDate}`
            : ''
        }`
        : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }

  renderOverview(
    root: HTMLElement,
    module: ModuleRecordView,
  ): void {
    const progress = readProgress(
      this.plugin.store.progress(
        module.id,
      ),
    );

    const wrap = root.createDiv({
      cls: 'los-overview',
    });

    wrap.createDiv({
      cls: 'los-overview-progress',
      text:
        `${progress.stagesComplete} of ${
          progress.stagesTotal
        } stages complete across ${
          progress.unitsTotal
        } unit${
          progress.unitsTotal === 1
            ? ''
            : 's'
        }`,
    });

    const workspaces = this.plugin.store
      .workspacesForModule(module.id)
      .map((record) =>
        normalizeWorkspaceRecord(record),
      );

    for (const workspace of workspaces) {
      workspaceCard(
        wrap,
        this.plugin,
        workspace,
        module.id,
      );
    }

    if (!workspaces.length) {
      empty(
        wrap,
        'No active coordination workspace',
        'The module/unit tree still owns study state.',
      );
    }

    const units = this.plugin.store
      .unitsFor(module.id)
      .map((record) =>
        normalizeUnitRecord(record),
      )
      .filter(nonNull);

    const next =
      units.find(
        (unit) =>
          unit.status === 'active',
      )
      ?? units[0];

    if (next) {
      button(
        wrap,
        `Continue ${next.title}`,
        () =>
          this.plugin.openUnit(next.id),
        'cta',
      );
    }

    const today =
      new Date()
        .toISOString()
        .slice(0, 10);

    const ahead = this
      .deadlinesFor(module)
      .filter((row) =>
        (
          row.endDate
          || row.startDate
        ) >= today,
      );

    if (ahead.length) {
      this.renderDeadlineRows(
        wrap,
        module,
        ahead.slice(0, 1),
      );
    }
  }

  renderUnits(
    root: HTMLElement,
    module: ModuleRecordView,
  ): void {
    if (module.components.length) {
      const tabs = root.createDiv({
        cls: 'los-subtabs',
        attr: {
          role: 'tablist',
        },
      });

      const allTab = button(
        tabs,
        'All components',
        () => this.selectComponent(null),
        this.componentId
          ? 'quiet'
          : 'row',
      );

      allTab.setAttrs({
        role: 'tab',
        'aria-selected':
          String(!this.componentId),
      });

      for (
        const component
        of module.components
      ) {
        const control = button(
          tabs,
          component.title,
          () =>
            this.selectComponent(
              component.id,
            ),
          this.componentId
            === component.id
            ? 'row'
            : 'quiet',
        );

        control.setAttrs({
          role: 'tab',
          'aria-selected':
            String(
              this.componentId
              === component.id,
            ),
        });
      }
    }

    const units = this.plugin.store
      .unitsFor(
        module.id,
        this.componentId,
      )
      .map((record) =>
        normalizeUnitRecord(record),
      )
      .filter(nonNull);

    if (!units.length) {
      empty(
        root,
        'No units in this component',
        'Return to all components.',
      );
      return;
    }

    for (const status of STATUS_ORDER) {
      const rows = units.filter(
        (unit) =>
          unit.status === status,
      );

      if (!rows.length) {
        continue;
      }

      root.createDiv({
        cls: 'los-group-title',
        text:
          status.replaceAll('-', ' '),
      });

      const grid = root.createDiv({
        cls: 'los-card-grid',
      });

      for (const unit of rows) {
        unitCard(
          grid,
          this.plugin,
          unit.record,
        );
      }
    }
  }

  renderLogistics(
    root: HTMLElement,
    module: ModuleRecordView,
  ): void {
    const facts = root.createDiv({
      cls: 'los-fact-list',
    });

    const factRows: ReadonlyArray<
      readonly [string, string | null]
    > = [
      ['Status', module.status],
      ['Institution', module.institution],
      ['Code', module.code],
      ['Semester', module.semester],
      ['Credits', module.credits],
      [
        'Examination',
        module.examination.type,
      ],
    ];

    for (const [label, value] of factRows) {
      if (
        value === null
        || value === ''
      ) {
        continue;
      }

      const row = facts.createDiv({
        cls: 'los-fact-row',
      });

      row.createSpan({
        cls: 'los-fact-label',
        text: label,
      });

      row.createSpan({
        cls: 'los-fact-value',
        text: value,
      });
    }

    if (module.examination.notes) {
      root.createEl('p', {
        cls: 'los-muted',
        text:
          module.examination.notes,
      });
    }

    this.renderAcademicDates(
      root,
      module,
    );
  }

  deadlinesFor(
    module: ModuleRecordView,
  ): AcademicDeadlineView[] {
    return this.plugin.store
      .rows('academic_deadlines')
      .map((record) =>
        readAcademicDeadline(record),
      )
      .filter((row) =>
        row.directModuleId === module.id
        || row.modules.some(
          (entry) =>
            entry.moduleId
            === module.id,
        ),
      )
      .sort((a, b) =>
        a.startDate.localeCompare(
          b.startDate,
        ),
      );
  }

  renderAcademicDates(
    root: HTMLElement,
    module: ModuleRecordView,
  ): void {
    const rows =
      this.deadlinesFor(module);

    if (!rows.length) {
      return;
    }

    const wrap = section(
      root,
      'Academic dates',
      'Registration windows and exam sittings for this module.',
    );

    const today =
      new Date()
        .toISOString()
        .slice(0, 10);

    const ahead = rows.filter(
      (row) =>
        (
          row.endDate
          || row.startDate
        ) >= today,
    );

    const past = rows.filter(
      (row) =>
        (
          row.endDate
          || row.startDate
        ) < today,
    );

    if (ahead.length) {
      this.renderDeadlineRows(
        wrap,
        module,
        ahead,
      );
    } else {
      empty(
        wrap,
        'No upcoming date recorded',
        'Past dates remain available below.',
      );
    }

    if (past.length) {
      const history = disclosure(
        wrap,
        `Past dates (${past.length})`,
        'los-deadline-history',
      );

      this.renderDeadlineRows(
        history,
        module,
        past,
      );
    }
  }

  renderDeadlineRows(
    wrap: HTMLElement,
    module: ModuleRecordView,
    rows: readonly AcademicDeadlineView[],
  ): void {
    const list = wrap.createDiv({
      cls: 'los-date-list',
    });

    for (const row of rows) {
      const card = list.createDiv({
        cls:
          `los-date-row los-deadline-${
            row.kind
          }`,
      });

      const date =
        row.endDate
        && row.endDate !== row.startDate
          ? `${
            row.startDate
          } → ${
            row.endDate
          }`
          : row.startDate;

      card.createDiv({
        cls: 'los-date-when',
        text: date,
      });

      const copy = card.createDiv({
        cls: 'los-date-copy',
      });

      copy.createEl('strong', {
        text: row.label,
      });

      if (
        row.kind
        === 'registration-window'
      ) {
        const entry = row.modules.find(
          (item) =>
            item.moduleId === module.id,
        );

        if (entry?.action) {
          copy.createEl('p', {
            cls: 'los-micro',
            text: entry.action,
          });
        }
      } else {
        copy.createDiv({
          cls: 'los-micro',
          text:
            row.title
            || module.title,
        });

        const facts = copy.createDiv({
          cls: 'los-row',
        });

        badge(
          facts,
          row.registrationState,
          row.registrationState
          || 'needs-map',
        );

        if (row.time) {
          facts.createSpan({
            cls: 'los-micro',
            text: row.time,
          });
        }
      }
    }
  }

  async selectTab(
    tab: ModuleTab,
  ): Promise<void> {
    if (!this.moduleId) {
      return;
    }

    this.tab = tab;

    await this.plugin.router.remember({
      name: 'module-detail',
      moduleId: this.moduleId,
      componentId: this.componentId,
      tab,
    });

    await this.leaf.setViewState({
      type: VIEW_MODULE,
      active: true,
      state: {
        screen: 'detail',
        moduleId: this.moduleId,
        componentId: this.componentId,
        tab,
      },
    });
  }

  async selectComponent(
    componentId: string | null,
  ): Promise<void> {
    if (!this.moduleId) {
      return;
    }

    this.componentId = componentId;

    const tab =
      this.tab
      ?? 'units';

    await this.plugin.router.remember({
      name: 'module-detail',
      moduleId: this.moduleId,
      componentId,
      tab,
    });

    await this.leaf.setViewState({
      type: VIEW_MODULE,
      active: true,
      state: {
        screen: 'detail',
        moduleId: this.moduleId,
        componentId,
        tab,
      },
    });
  }

  renderSources(
    root: HTMLElement,
    module: ModuleRecordView,
  ): void {
    const sourceMap =
      this.plugin.store.sourceMap(
        module.id,
      );

    const entries = readSourceEntries(
      sourceMap
        ? sourceMap.sources
        : null,
    );

    if (!entries.length) {
      empty(
        root,
        'No routed module sources yet',
        'Sources remain globally registered.',
      );
      return;
    }

    root.createEl('p', {
      cls: 'los-muted',
      text:
        'Roles in this module — not global quality scores.',
    });

    const groups =
      new Map<string, SourceEntryView[]>();

    for (const entry of entries) {
      const current =
        groups.get(entry.role);

      if (current) {
        current.push(entry);
      } else {
        groups.set(
          entry.role,
          [entry],
        );
      }
    }

    for (
      const [role, roleEntries]
      of groups
    ) {
      const group = root.createDiv({
        cls: 'los-source-role',
      });

      group.createDiv({
        cls: 'los-group-title',
        text:
          role.replaceAll('-', ' '),
      });

      for (const entry of roleEntries) {
        const row = group.createDiv({
          cls: 'los-row',
        });

        const source =
          entry.sourceId
            ? this.plugin.store.get(
              entry.sourceId,
            )
            : null;

        if (source) {
          chip(
            row,
            source,
            (record: ProjectionRecord) => {
              const id =
                projectedString(
                  record.id,
                );

              if (!id) {
                return;
              }

              return this.plugin
                .openLibrary(id);
            },
          );
        }

        row.createEl('p', {
          text: entry.why,
        });

        if (entry.unitRouteCount) {
          row.createDiv({
            cls: 'los-micro',
            text:
              `${
                entry.unitRouteCount
              } routed unit(s)`,
          });
        }
      }
    }
  }
}
