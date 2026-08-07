import {
  ItemView,
  Notice,
  type WorkspaceLeaf,
} from 'obsidian';
import {
  badge,
  button,
  chip,
  disclosure,
  empty,
  icon,
  overflowMenu,
  pageHeader,
  section,
} from '../components';
import { VIEW_UNIT } from '../constants';
import type {
  JsonRecord,
  ProjectionRecord,
} from '../contracts/manifest-v2';
import type { LearningOSUI } from '../main';

const ARTIFACT_LABELS = [
  [
    'ultimate_reference',
    'Ultimate Reference',
  ],
  [
    'exercise_bank',
    'Exercise Bank',
  ],
  [
    'mock_exam',
    'Mock Exam',
  ],
] as const;

interface ParsedUnitViewState {
  readonly unitId?: string;
  readonly stageId?: string | null;
  readonly hasStageId: boolean;
}

interface UnitRecordView {
  readonly record: ProjectionRecord;
  readonly id: string;
  readonly moduleId: string;
  readonly componentId: string | null;
  readonly kind: string;
  readonly title: string;
  readonly scope: string;
}

interface StageRecordView {
  readonly record: ProjectionRecord;
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly scopeTriage: string;
  readonly objective: string | null;
  readonly estimateMinutes: string | null;
  readonly examCritical: boolean;
  readonly resources: ResourceRecordView[];
  readonly doneWhen: string[];
  readonly attachments: StageAttachmentView[];
  readonly sourceFeedback: ProjectionRecord[];
}

interface ResourceRecordView {
  readonly record: ProjectionRecord;
  readonly kind: string;
  readonly label: string;
  readonly locator: string | null;
  readonly sourceId: string | null;
  readonly canOpen: boolean;
}

interface StudyMapView {
  readonly record: ProjectionRecord;
  readonly currentStageId: string | null;
  readonly stages: StageRecordView[];
  readonly detours: ProjectionRecord[];
}

interface StageAttachmentView {
  readonly path: string;
  readonly label: string;
}

interface ArtifactSet {
  readonly named: ReadonlyArray<
    readonly [string, string]
  >;
  readonly other: string[];
}

type UnitPlugin = Pick<
  LearningOSUI,
  | 'askAiScoped'
  | 'back'
  | 'clearDoneWhen'
  | 'gateway'
  | 'getDoneWhen'
  | 'getSelectedStage'
  | 'getUnitNoteDraft'
  | 'mutate'
  | 'openAuthoredPath'
  | 'openLibrary'
  | 'openModule'
  | 'openRecord'
  | 'openResource'
  | 'openShelving'
  | 'openUnitNote'
  | 'reviewSessionEnd'
  | 'setDoneWhen'
  | 'setSelectedStage'
  | 'settings'
  | 'store'
>;

function errorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : String(error);
}

function isRecord(
  value: unknown,
): value is JsonRecord {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
  );
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

  return text.length
    ? text
    : null;
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

function projectedLabel(
  record: ProjectionRecord | null,
  fallback = 'Untitled',
): string {
  if (!record) {
    return fallback;
  }

  return (
    projectedString(record.title)
    ?? projectedString(record.label)
    ?? projectedString(record.id)
    ?? fallback
  );
}

function readUnitViewState(
  value: unknown,
): ParsedUnitViewState {
  if (!isRecord(value)) {
    return {
      hasStageId: false,
    };
  }

  const hasStageId =
    Object.prototype.hasOwnProperty.call(
      value,
      'stageId',
    );

  const unitId =
    projectedString(value.unitId)
    ?? undefined;

  const stageId = !hasStageId
    ? undefined
    : value.stageId === null
      ? null
      : projectedString(value.stageId);

  return {
    unitId,
    stageId,
    hasStageId,
  };
}

function readUnitRecord(
  record: ProjectionRecord | null,
  fallbackId: string | null,
): UnitRecordView | null {
  if (!record) {
    return null;
  }

  const id =
    projectedString(record.id)
    ?? fallbackId;

  const moduleId =
    projectedString(record.module_id);

  if (!id || !moduleId) {
    return null;
  }

  return {
    record,
    id,
    moduleId,
    componentId:
      projectedString(record.component_id),
    kind:
      projectedString(record.kind)
      ?? 'unit',
    title:
      projectedString(record.title)
      ?? id,
    scope:
      projectedText(record.scope)
      ?? '',
  };
}

function readResource(
  record: ProjectionRecord,
): ResourceRecordView {
  const label =
    projectedString(record.label)
    ?? projectedString(record.title)
    ?? projectedString(record.source_id)
    ?? 'Resource';

  return {
    record,
    kind:
      projectedString(record.kind)
      ?? 'read',
    label,
    locator:
      projectedText(record.locator),
    sourceId:
      projectedString(record.source_id),
    canOpen: Boolean(
      projectedString(record.material_path)
      ?? projectedString(record.url)
      ?? projectedString(record.vault_path),
    ),
  };
}

function readStageAttachment(
  value: unknown,
): StageAttachmentView | null {
  if (typeof value === 'string') {
    if (!value.length) {
      return null;
    }

    return {
      path: value,
      label:
        value.split('/').pop()
        || value,
    };
  }

  if (!isRecord(value)) {
    return null;
  }

  const path =
    projectedString(value.path)
    ?? projectedString(value.vault_path);

  if (!path) {
    return null;
  }

  return {
    path,
    label:
      projectedString(value.label)
      ?? path,
  };
}

function readStage(
  record: ProjectionRecord,
): StageRecordView | null {
  const id =
    projectedString(record.id);

  if (!id) {
    return null;
  }

  const attachments = Array.isArray(
    record.attachments,
  )
    ? record.attachments
      .map(readStageAttachment)
      .filter(
        (
          attachment,
        ): attachment is StageAttachmentView =>
          attachment !== null,
      )
    : [];

  return {
    record,
    id,
    title:
      projectedString(record.title)
      ?? id,
    status:
      projectedString(record.status)
      ?? 'active',
    scopeTriage:
      projectedText(record.scope_triage)
      ?? '',
    objective:
      projectedText(record.objective),
    estimateMinutes:
      projectedText(record.estimate_minutes),
    examCritical:
      record.exam_critical === true,
    resources:
      projectedRecords(
        record.resources,
      ).map(readResource),
    doneWhen:
      projectedStrings(
        record.done_when,
      ).filter(
        (criterion) =>
          Boolean(criterion.trim()),
      ),
    attachments,
    sourceFeedback:
      projectedRecords(
        record.source_feedback,
      ),
  };
}

function readStudyMap(
  record: ProjectionRecord,
): StudyMapView {
  const stages = projectedRecords(
    record.stages,
  )
    .map(readStage)
    .filter(
      (
        stage,
      ): stage is StageRecordView =>
        stage !== null,
    );

  return {
    record,
    currentStageId:
      projectedString(
        record.current_stage,
      ),
    stages,
    detours:
      projectedRecords(record.detours),
  };
}

function readArtifacts(
  value: unknown,
): ArtifactSet {
  if (!isRecord(value)) {
    return {
      named: [],
      other: [],
    };
  }

  const named: Array<
    readonly [string, string]
  > = [];

  for (
    const [key] of ARTIFACT_LABELS
  ) {
    const id =
      projectedString(value[key]);

    if (id) {
      named.push([key, id]);
    }
  }

  return {
    named,
    other:
      projectedStrings(value.other),
  };
}

function artifactLabel(
  key: string,
): string {
  return (
    ARTIFACT_LABELS.find(
      ([candidate]) =>
        candidate === key,
    )?.[1]
    ?? key
  );
}

function fallbackRecord(
  id: string,
): ProjectionRecord {
  return {
    id,
    type: 'record',
    title: id,
  };
}

/**
 * The Unit is where learning actually happens, so it gets the strictest
 * discipline: a stage rail and one current-work panel. Notes are added once
 * after a learning session from the action at the end of the rail; they never
 * occupy a permanent panel or become mandatory per stage.
 */
export class UnitView extends ItemView {
  private readonly plugin: UnitPlugin;

  private unitId: string | null;

  private stageId: string | null;

  constructor(
    leaf: WorkspaceLeaf,
    plugin: UnitPlugin,
  ) {
    super(leaf);

    this.plugin = plugin;
    this.unitId = null;
    this.stageId = null;
  }

  getViewType(): string {
    return VIEW_UNIT;
  }

  getDisplayText(): string {
    return 'LearningOS · Unit';
  }

  async setState(
    state: unknown = {},
  ): Promise<void> {
    const parsed =
      readUnitViewState(state);

    const nextUnitId =
      parsed.unitId
      ?? this.unitId;

    if (nextUnitId !== this.unitId) {
      this.stageId = null;
    }

    this.unitId = nextUnitId;

    const requestedStageId =
      parsed.hasStageId
        ? parsed.stageId ?? null
        : null;

    const selectedStageId =
      this.unitId
        ? this.plugin.getSelectedStage(
          this.unitId,
        )
        : null;

    this.stageId =
      selectedStageId
      ?? requestedStageId
      ?? this.stageId;

    this.render();
  }

  getState(): {
    unitId: string | null;
    stageId: string | null;
  } {
    return {
      unitId: this.unitId,
      stageId: this.stageId,
    };
  }

  async onOpen(): Promise<void> {
    const state =
      readUnitViewState(
        this.leaf.state,
      );

    this.unitId =
      state.unitId
      ?? this.unitId;

    const selectedStageId =
      this.unitId
        ? this.plugin.getSelectedStage(
          this.unitId,
        )
        : null;

    this.stageId =
      selectedStageId
      ?? (
        state.hasStageId
          ? state.stageId ?? null
          : null
      )
      ?? this.stageId;

    this.render();
  }

  render(): void {
    const root = this.contentEl;

    root.empty();
    root.addClass(
      'los-root',
      'los-unit-view',
    );

    const routeUnitId =
      this.unitId;

    const projectedUnit =
      routeUnitId
        ? this.plugin.store.get(
          routeUnitId,
        )
        : null;

    const unit = readUnitRecord(
      projectedUnit,
      routeUnitId,
    );

    if (!unit) {
      empty(
        root,
        'Unit unavailable',
        'Return to its module.',
      );

      return;
    }

    const module =
      this.plugin.store.get(
        unit.moduleId,
      );

    const project =
      this.plugin.store.projectForUnit(
        unit.record,
      );

    const ownerLabel =
      projectedLabel(
        project,
        projectedLabel(
          module,
          unit.moduleId,
        ),
      );

    const header = pageHeader(
      root,
      `${ownerLabel} · ${unit.kind}`,
      unit.title,
      unit.scope,
    );

    const headerActions =
      header.createDiv({
        cls: 'los-actions',
      });

    if (project) {
      button(
        headerActions,
        'Back to project',
        () => this.plugin.back(),
        'quiet',
      );
    } else {
      button(
        headerActions,
        'Back to module',
        () => this.plugin.openModule(
          unit.moduleId,
        ),
        'quiet',
      );
    }

    const projectedStudyMap =
      this.plugin.store.mapForUnit(
        unit.id,
      );

    if (!projectedStudyMap) {
      const missing = section(
        root,
        'Study map needed',
      );

      const projectId =
        projectedString(project?.id)
        ?? undefined;

      const componentId =
        unit.componentId
        ?? undefined;

      empty(
        missing,
        'This unit has no current study script',
        'AI may propose a scoped map; the core imports it only after review.',
        'Create map with AI',
        () => this.plugin.askAiScoped(
          'Propose one study-map JSON document for this unit. Do not write files; include exact source actions and done-when criteria.',
          {
            moduleId: unit.moduleId,
            projectId,
            unitId: unit.id,
            componentId,
          },
        ),
      );

      this.renderArtifacts(
        root,
        unit,
      );

      return;
    }

    const studyMap =
      readStudyMap(
        projectedStudyMap,
      );

    if (!studyMap.stages.length) {
      const bare = section(
        root,
        'Study map needs stages',
      );

      empty(
        bare,
        'This study map has no stages yet',
        'Stage authoring belongs to the core — import a map or add stages there, then rebuild views.',
      );

      this.renderArtifacts(
        root,
        unit,
      );

      return;
    }

    const stageIds = new Set(
      studyMap.stages.map(
        (stage) => stage.id,
      ),
    );

    if (
      !this.stageId
      || !stageIds.has(this.stageId)
    ) {
      this.stageId =
        (
          studyMap.currentStageId
          && stageIds.has(
            studyMap.currentStageId,
          )
        )
          ? studyMap.currentStageId
          : studyMap.stages[0].id;

      this.plugin.setSelectedStage(
        unit.id,
        this.stageId,
      );
    }

    const stage =
      studyMap.stages.find(
        (candidate) =>
          candidate.id
          === this.stageId,
      )
      ?? studyMap.stages[0];

    const layout = root.createDiv({
      cls: 'los-unit-layout',
    });

    this.renderRail(
      layout,
      unit,
      studyMap,
      stage,
    );

    this.renderStage(
      layout,
      unit,
      studyMap,
      stage,
    );

    this.renderActionBar(
      root,
      unit,
      stage,
    );

    const more = disclosure(
      root,
      'Unit artifacts and evidence',
      'los-unit-extras',
    );

    this.renderArtifacts(
      more,
      unit,
    );
  }

  private renderRail(
    layout: HTMLElement,
    unit: UnitRecordView,
    studyMap: StudyMapView,
    current: StageRecordView,
  ): void {
    const rail = layout.createDiv({
      cls: 'los-stage-rail',
    });

    rail.createEl('h2', {
      text: 'Stages',
    });

    for (
      const [index, stage]
      of studyMap.stages.entries()
    ) {
      const selected =
        stage.id === current.id;

      const row = rail.createEl(
        'button',
        {
          cls:
            `los-stage-row los-s-${stage.status} ${
              selected
                ? 'is-selected'
                : ''
            } is-clickable`,
          attr: {
            type: 'button',
            'aria-current':
              selected
                ? 'step'
                : 'false',
          },
        },
      );

      row.createSpan({
        cls: 'los-stage-index',
        text:
          String(index + 1)
            .padStart(2, '0'),
      });

      const copy = row.createSpan({
        cls: 'los-stage-copy',
      });

      copy.createSpan({
        text: stage.title,
      });

      const marker =
        stage.status === 'complete'
          ? 'Complete'
          : stage.status === 'skipped'
            ? 'Skipped'
            : '';

      if (marker) {
        copy.createSpan({
          cls: 'los-micro',
          text: marker,
        });
      }

      row.addEventListener(
        'click',
        () => {
          void this.selectStage(
            stage.id,
          );
        },
      );
    }

    const stageRecords =
      studyMap.stages.map(
        (stage) => stage.record,
      );

    const add = button(
      rail,
      'Add note',
      () => this.plugin.openUnitNote(
        unit.record,
        studyMap.record,
      ),
      'quiet',
    );

    add.addClass(
      'los-add-unit-note',
    );

    const draft =
      this.plugin.getUnitNoteDraft(
        unit.id,
        stageRecords,
      );

    if (
      typeof draft.text === 'string'
      && draft.text.trim()
    ) {
      rail.createDiv({
        cls:
          'los-micro los-unit-note-draft',
        text:
          'Unsaved unit-note draft kept locally.',
      });
    }
  }

  private renderStage(
    layout: HTMLElement,
    unit: UnitRecordView,
    studyMap: StudyMapView,
    stage: StageRecordView,
  ): void {
    const center = layout.createDiv({
      cls: 'los-stage-workspace',
    });

    const top = center.createDiv({
      cls: 'los-stage-heading',
    });

    top.createDiv({
      cls: 'los-kicker',
      text:
        stage.examCritical
          ? 'Exam-critical stage'
          : stage.scopeTriage,
    });

    top.createEl('h2', {
      text: stage.title,
    });

    if (stage.objective) {
      const goal = center.createDiv({
        cls: 'los-stage-goal',
      });

      goal.createDiv({
        cls: 'los-kicker',
        text: 'Goal',
      });

      goal.createEl('p', {
        text: stage.objective,
      });
    }

    if (stage.estimateMinutes) {
      badge(
        top,
        `${stage.estimateMinutes} min`,
        'role',
      );
    }

    const resources = section(
      center,
      'Resources',
    );

    if (!stage.resources.length) {
      empty(
        resources,
        'No source action selected',
        'Use the unit scope and ask AI for a proposal.',
      );
    }

    for (
      const resource of stage.resources
    ) {
      const row = resources.createDiv({
        cls: 'los-resource-row',
      });

      const iconName =
        resource.kind === 'watch'
          ? 'play'
          : resource.kind === 'practise'
            ? 'pencil-line'
            : 'book-open';

      icon(
        row.createSpan(),
        iconName,
      );

      const copy = row.createDiv({
        cls: 'los-resource-copy',
      });

      copy.createEl('strong', {
        text: resource.label,
      });

      if (resource.locator) {
        copy.createDiv({
          cls: 'los-micro',
          text: resource.locator,
        });
      }

      if (resource.sourceId) {
        const source =
          this.plugin.store.get(
            resource.sourceId,
          );

        if (source) {
          chip(
            copy,
            source,
            (
              record: ProjectionRecord,
            ) => {
              const recordId =
                projectedString(record.id);

              return recordId
                ? this.plugin.openLibrary(
                  recordId,
                )
                : undefined;
            },
          );
        }
      }

      const actions = row.createDiv({
        cls:
          'los-actions los-resource-actions',
      });

      if (resource.canOpen) {
        button(
          actions,
          'Open',
          () => this.plugin.openResource(
            resource.record,
          ),
          'quiet',
        );
      }

      if (resource.sourceId) {
        const sourceId =
          resource.sourceId;

        const menuItems: Array<
          [string, () => unknown]
        > = [
          [
            'Helpful',
            () => this.mutate(
              () =>
                this.plugin.gateway.feedback(
                  unit.id,
                  stage.id,
                  sourceId,
                  'helpful',
                ),
            ),
          ],
          [
            'Too advanced',
            () => this.mutate(
              () =>
                this.plugin.gateway.feedback(
                  unit.id,
                  stage.id,
                  sourceId,
                  'too-advanced',
                ),
            ),
          ],
          [
            'Useful for review',
            () => this.mutate(
              () =>
                this.plugin.gateway.feedback(
                  unit.id,
                  stage.id,
                  sourceId,
                  'useful-for-review',
                ),
            ),
          ],
        ];

        overflowMenu(
          actions,
          menuItems,
          `Rate ${resource.label}`,
        );
      }
    }

    if (stage.doneWhen.length) {
      const done = section(
        center,
        'Done when',
      );

      const marks =
        this.plugin.getDoneWhen(
          unit.id,
          stage.id,
        );

      const list = done.createDiv({
        cls: 'los-donewhen-list',
      });

      for (
        const [index, criterion]
        of stage.doneWhen.entries()
      ) {
        const row = list.createEl(
          'label',
          {
            cls: 'los-donewhen-row',
          },
        );

        const box = row.createEl(
          'input',
          {
            attr: {
              type: 'checkbox',
              'aria-label': criterion,
            },
          },
        );

        const checked =
          Boolean(marks[index]);

        if (checked) {
          box.setAttr(
            'checked',
            'checked',
          );
        }

        box.checked = checked;

        box.addEventListener(
          'change',
          () => {
            const nextChecked =
              Boolean(box.checked);

            this.plugin.setDoneWhen(
              unit.id,
              stage.id,
              index,
              nextChecked,
            );

            row.toggleClass(
              'is-checked',
              nextChecked,
            );
          },
        );

        row.toggleClass(
          'is-checked',
          checked,
        );

        row.createSpan({
          text: criterion,
        });
      }
    }

    this.renderStageContext(
      center,
      unit,
      studyMap,
      stage,
    );
  }

  /**
   * One primary action and one menu. The primary is filled; nothing else on
   * this screen may be.
   */
  private renderActionBar(
    root: HTMLElement,
    unit: UnitRecordView,
    stage: StageRecordView,
  ): void {
    const bar = root.createDiv({
      cls: 'los-unit-actionbar',
    });

    button(
      bar,
      'Mark complete',
      () => this.mutate(
        () =>
          this.plugin.gateway.progress(
            unit.id,
            stage.id,
            'complete',
          ),
        () =>
          this.plugin.clearDoneWhen(
            unit.id,
            stage.id,
          ),
      ),
      'cta',
    );

    const menuItems: Array<
      [string, () => unknown] | false
    > = [
      stage.status !== 'active'
      && [
        'Revisit stage',
        () => this.mutate(
          () =>
            this.plugin.gateway.progress(
              unit.id,
              stage.id,
              'revisit',
            ),
        ),
      ],
      [
        'Pause unit',
        () => this.mutate(
          () =>
            this.plugin.gateway.progress(
              unit.id,
              stage.id,
              'paused',
            ),
        ),
      ],
      [
        'Skip stage',
        () => this.mutate(
          () =>
            this.plugin.gateway.progress(
              unit.id,
              stage.id,
              'skipped',
            ),
        ),
      ],
      [
        'Report prerequisite gap',
        () => this.mutate(
          () =>
            this.plugin.gateway.detour(
              unit.id,
              stage.id,
              'Prerequisite gap',
              'required-now',
            ),
        ),
      ],
      [
        'Prepare shelving',
        () =>
          this.plugin.openShelving(
            unit.id,
          ),
      ],
      this.plugin.settings
        .showAiRecommendation
      && [
        'Ask AI with stage context',
        () => {
          const project =
            this.plugin.store
              .projectForUnit(
                unit.record,
              );

          const projectId =
            projectedString(project?.id)
            ?? undefined;

          return this.plugin.askAiScoped(
            'Help with this stage. Treat the active file as supplementary context only.',
            {
              moduleId:
                unit.moduleId,
              projectId,
              unitId:
                unit.id,
              stageId:
                stage.id,
            },
          );
        },
      ],
      [
        'End learning session',
        () =>
          this.plugin
            .reviewSessionEnd(),
      ],
    ];

    overflowMenu(
      bar,
      menuItems,
      'More unit actions',
    );
  }

  private renderStageContext(
    center: HTMLElement,
    unit: UnitRecordView,
    studyMap: StudyMapView,
    stage: StageRecordView,
  ): void {
    const detours =
      studyMap.detours.filter(
        (row) =>
          projectedString(
            row.spawned_by_stage,
          ) === stage.id
          && projectedString(
            row.status,
          ) !== 'resolved'
          && projectedString(
            row.id,
          ) !== null,
      );

    if (
      !stage.attachments.length
      && !detours.length
      && !stage.sourceFeedback.length
    ) {
      return;
    }

    const detail = disclosure(
      center,
      'Stage context',
    );

    for (
      const attachment
      of stage.attachments
    ) {
      button(
        detail,
        attachment.label,
        () =>
          this.plugin.openAuthoredPath(
            attachment.path,
          ),
        'quiet',
      );
    }

    for (const detour of detours) {
      const detourId =
        projectedString(detour.id);

      if (!detourId) {
        continue;
      }

      const title =
        projectedString(detour.title)
        ?? 'Prerequisite detour';

      const classification =
        projectedString(
          detour.classification,
        )
        ?? 'required-now';

      const row = detail.createDiv({
        cls: 'los-detour-row',
      });

      row.createEl('strong', {
        text:
          'Open prerequisite detour',
      });

      row.createEl('p', {
        text:
          `${title} · ${
            classification
          } · returns here`,
      });

      button(
        row,
        'Resolve and return',
        () => this.mutate(
          () =>
            this.plugin.gateway
              .resolveDetour(
                unit.id,
                detourId,
                'Resolved from the unit workspace.',
              ),
        ),
        'quiet',
      );
    }

    for (
      const feedback
      of stage.sourceFeedback
    ) {
      const sourceId =
        projectedString(
          feedback.source_id,
        )
        ?? 'Unknown source';

      const value =
        projectedText(
          feedback.feedback,
        )
        ?? 'Feedback recorded';

      detail.createDiv({
        cls: 'los-row',
        text:
          `${sourceId} · ${value}`,
      });
    }
  }

  private renderArtifacts(
    root: HTMLElement,
    unit: UnitRecordView,
  ): void {
    const wrap = section(
      root,
      'Unit artifacts',
      'Durable notes remain globally canonical; this unit owns stable references.',
    );

    const artifacts =
      readArtifacts(
        unit.record.artifacts,
      );

    let count = 0;

    for (
      const [key, id]
      of artifacts.named
    ) {
      count += 1;

      const card = wrap.createDiv({
        cls: 'los-artifact-card',
      });

      card.createEl('h3', {
        text: artifactLabel(key),
      });

      const record =
        this.plugin.store.get(id)
        ?? fallbackRecord(id);

      chip(
        card,
        record,
        (
          selected: ProjectionRecord,
        ) =>
          this.plugin.openRecord(
            selected,
          ),
      );
    }

    for (const id of artifacts.other) {
      count += 1;

      const record =
        this.plugin.store.get(id)
        ?? fallbackRecord(id);

      chip(
        wrap,
        record,
        (
          selected: ProjectionRecord,
        ) =>
          this.plugin.openRecord(
            selected,
          ),
      );
    }

    if (!count) {
      empty(
        wrap,
        'No durable artifact linked yet',
        'Working notes stay with the stage until shelving is approved.',
      );
    }
  }

  /**
   * Every write goes through the plugin-wide queue, so two clicks in two views
   * can no longer race the same `--expected-snapshot`.
   */
  private async mutate(
    action: () => Promise<unknown>,
    onConfirmed:
      (() => void) | null = null,
  ): Promise<void> {
    if (this.plugin.gateway.isBusy) {
      new Notice(
        'A LearningOS write is already running.',
      );

      return;
    }

    try {
      await this.plugin.mutate(
        action,
      );

      onConfirmed?.();
      this.render();
    } catch (error: unknown) {
      new Notice(
        errorMessage(error),
      );
    }
  }

  private async selectStage(
    stageId: string,
  ): Promise<void> {
    const unitId =
      this.unitId;

    if (!unitId) {
      new Notice(
        'This unit is no longer available.',
      );

      return;
    }

    this.stageId = stageId;

    this.plugin.setSelectedStage(
      unitId,
      stageId,
    );

    await this.leaf.setViewState({
      type: VIEW_UNIT,
      active: true,
      state: {
        unitId,
        stageId,
      },
    });
  }
}
