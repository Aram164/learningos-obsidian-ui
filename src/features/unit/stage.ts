import { Notice } from 'obsidian';
import type { UnitView } from '../../views/unit-view';
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
} from '../../components';
import type { ProjectionRecord } from '../../contracts/manifest-v4';
import {
  asLabel as projectedLabel,
  asRecords as projectedRecords,
  asString as projectedString,
  asStrings as projectedStrings,
  asText as projectedText,
  isRecord,
} from '../../projection/readers';
import {
  type UnitRecordView,
  type StageRecordView,
  type ResourceRecordView,
  type StudyMapView,
  readUnitRecord,
  readStage,
  readStudyMap,
  readArtifacts,
  artifactLabel,
  fallbackRecord,
  errorMessage,
} from './model';

export function renderStage(
  view: UnitView,

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

    if (stage.doneWhen.length) {
      const done = section(
        center,
        'Done when',
      );

      const marks =
        view.plugin.getDoneWhen(
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

            view.plugin.setDoneWhen(
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

    const resources = section(
      center,
      'Exact work',
    );

    if (!stage.resources.length) {
      empty(
        resources,
        'No source action selected',
        'Use the unit scope and ask AI for a proposal.',
      );
    }

    // ADR-008 gave every resource its own triage rank, precisely so a required
    // stage stops presenting the deck, the fallback video, the depth paper and
    // the preserved bibliography at one weight. Rendering them in rank order,
    // under headings, is what turns that stored rank into less reading.
    // Unranked resources (every pre-v2 record) sort with the primaries rather
    // than below them: absent means "not yet ranked", never "deprioritised".
    const TRIAGE_ORDER = [
      'required-now',
      'helpful-now',
      'deferred',
      'reference-only',
    ];
    const TRIAGE_HEADING: Record<string, string> = {
      'required-now': 'Do this',
      'helpful-now': 'If you get stuck',
      deferred: 'Depth — not now',
      'reference-only': 'Reference — preserved, not reading for this stage',
    };
    const rankOf = (
      value: string | null,
    ) => {
      const index = value
        ? TRIAGE_ORDER.indexOf(value)
        : -1;
      return index < 0 ? 0 : index;
    };
    const ordered = [...stage.resources]
      .sort(
        (a, b) =>
          rankOf(a.scopeTriage)
          - rankOf(b.scopeTriage),
      );
    const anyRanked = ordered.some(
      (item) => Boolean(item.scopeTriage),
    );
    let renderedHeading: string | null = null;

    for (
      const resource of ordered
    ) {
      if (anyRanked) {
        const heading: string = resource.scopeTriage
          ? TRIAGE_HEADING[resource.scopeTriage]
            ?? resource.scopeTriage
          : TRIAGE_HEADING['required-now'] ?? 'Do this';
        if (heading !== renderedHeading) {
          resources.createDiv({
            cls: 'los-kicker los-resource-tier',
            text: heading,
          });
          renderedHeading = heading;
        }
      }

      const row = resources.createDiv({
        cls: `los-resource-row los-triage-${resource.scopeTriage ?? 'unranked'}`,
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
          view.plugin.store.get(
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
                ? view.plugin.openLibrary(
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
          () => view.plugin.openResource(
            resource.record,
          ),
          'quiet',
        );
      }

      if (resource.sourceId) {
        const sourceId =
          resource.sourceId;
        // ADR-009. When this resource has its own id, the verdict lands on the
        // resource; otherwise it lands on the source, exactly as before. This
        // is why "SystemML was excellent" and "SPORES was too advanced" can now
        // be two records instead of one indistinguishable pair on the course.
        const resourceId =
          resource.id;

        const rate = (
          verdict: string,
        ) => view.mutate(
          () =>
            view.plugin.gateway.feedback(
              unit.id,
              stage.id,
              sourceId,
              verdict,
              resourceId,
            ),
        );

        const menuItems: Array<
          [string, () => unknown]
        > = [
          ['Helpful', () => rate('helpful')],
          ['Too advanced', () => rate('too-advanced')],
          ['Useful for review', () => rate('useful-for-review')],
        ];

        overflowMenu(
          actions,
          menuItems,
          resourceId
            ? `Rate ${resource.label}`
            : `Rate ${resource.label} (whole source)`,
        );
      }
    }

    view.renderStageContext(
      center,
      unit,
      studyMap,
      stage,
    );

    view.renderActionBar(
      center,
      unit,
      stage,
    );
  }

export function renderActionBar(
  view: UnitView,

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
      () => view.mutate(
        () =>
          view.plugin.gateway.progress(
            unit.id,
            stage.id,
            'complete',
          ),
        () =>
          view.plugin.clearDoneWhen(
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
        () => view.mutate(
          () =>
            view.plugin.gateway.progress(
              unit.id,
              stage.id,
              'revisit',
            ),
        ),
      ],
      [
        'Pause unit',
        () => view.mutate(
          () =>
            view.plugin.gateway.progress(
              unit.id,
              stage.id,
              'paused',
            ),
        ),
      ],
      [
        'Skip stage',
        () => view.mutate(
          () =>
            view.plugin.gateway.progress(
              unit.id,
              stage.id,
              'skipped',
            ),
        ),
      ],
      [
        'Report prerequisite gap',
        () => view.mutate(
          () =>
            view.plugin.gateway.detour(
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
          view.plugin.openShelving(
            unit.id,
          ),
      ],
      view.plugin.settings
        .showAiRecommendation
      && [
        'Ask AI with stage context',
        () => {
          const project =
            view.plugin.store
              .projectForUnit(
                unit.record,
              );

          const projectId =
            projectedString(project?.id)
            ?? undefined;

          return view.plugin.askAiScoped(
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
          view.plugin
            .reviewSessionEnd(),
      ],
    ];

    overflowMenu(
      bar,
      menuItems,
      'More unit actions',
    );
  }
