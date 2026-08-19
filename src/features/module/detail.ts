import type { ModuleView } from '../../views/module-view';
import {
  badge,
  button,
  chip,
  disclosure,
  empty,
  pageHeader,
  section,
  workspaceCard,
} from '../../components';
import { STATUS_ORDER } from '../../constants';
import type { ProjectionRecord } from '../../contracts/manifest';
import {
  asCount as projectedCount,
  asRecords as projectedRecords,
  asString as projectedString,
  asStrings as projectedStrings,
  asText as projectedText,
  isRecord,
} from '../../projection/readers';
import {
  MODULE_TABS,
  type ModuleTab,
  type ThematicGroupView,
  type ModuleRecordView,
  type UnitRecordView,
  type ModuleProgressView,
  type AcademicDeadlineView,
  type SourceEntryView,
  nonNull,
  readThematicGroup,
  readModuleRecord,
  normalizeUnitRecord,
  normalizeWorkspaceRecord,
  readProgress,
  readAcademicDeadline,
  readSourceEntries,
} from './model';
import {
  examinationLabel,
  semesterLabel,
} from './logistics';
import { enableButtonGroupKeyboardNavigation } from '../../accessibility/button-group';

export function renderModuleDetail(
  view: ModuleView,

    root: HTMLElement,
  ): void {
    const moduleRecord =
      view.moduleId
        ? view.plugin.store.get(
          view.moduleId,
        )
        : null;

    const module = readModuleRecord(
      moduleRecord,
      view.moduleId,
    );

    const back = button(
      root,
      '‹ Back',
      () => view.plugin.back(),
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
      view.tab
      ?? view.defaultTab(module);

    const header = pageHeader(
      root,
      module.kind,
      module.title,
    );

    header.createDiv({
      cls: 'los-module-facts',
      text: view.headline(module),
    });

    const tabs = root.createDiv({
      cls: 'los-tabs',
      attr: {
        role: 'group',
        'aria-label': 'Module sections',
      },
    });
    enableButtonGroupKeyboardNavigation(tabs);

    for (const [key, label] of MODULE_TABS) {
      const control = button(
        tabs,
        label,
        () => view.selectTab(key),
        key === tab
          ? 'cta'
          : 'quiet',
      );

      control.setAttrs({
        'aria-pressed':
          String(key === tab),
      });
    }

    if (tab === 'overview') {
      view.renderOverview(
        root,
        module,
      );
    } else if (tab === 'units') {
      view.renderUnits(
        root,
        module,
      );
    } else if (tab === 'resources') {
      view.renderSources(
        root,
        module,
      );
    } else {
      view.renderLogistics(
        root,
        module,
      );
    }
  }

export function headline(
  view: ModuleView,

    module: ModuleRecordView,
  ): string {
    const today =
      new Date()
        .toISOString()
        .slice(0, 10);

    const nextDate = view
      .deadlinesFor(module)
      .filter((row) =>
        (
          row.endDate
          || row.startDate
        ) >= today,
      )
      .map((row) => row.startDate)[0];

    return [
      semesterLabel(module.semester),
      module.credits
        ? `${module.credits} LP`
        : '',
      module.examination.type
        ? `${
          examinationLabel(
            module.examination.type,
          )
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

export function renderOverview(
  view: ModuleView,

    root: HTMLElement,
    module: ModuleRecordView,
  ): void {
    const progress = readProgress(
      view.plugin.store.progress(
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

    const workspaces = view.plugin.store
      .workspacesForModule(module.id)
      .map((record) =>
        normalizeWorkspaceRecord(record),
      );

    for (const workspace of workspaces) {
      workspaceCard(
        wrap,
        view.plugin,
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

    const units = view.plugin.store
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
          view.plugin.openUnit(next.id),
        'cta',
      );
    }

    const today =
      new Date()
        .toISOString()
        .slice(0, 10);

    const ahead = view
      .deadlinesFor(module)
      .filter((row) =>
        (
          row.endDate
          || row.startDate
        ) >= today,
      );

    if (ahead.length) {
      view.renderDeadlineRows(
        wrap,
        module,
        ahead.slice(0, 1),
      );
    }
  }

export function renderUnits(
  view: ModuleView,

    root: HTMLElement,
    module: ModuleRecordView,
  ): void {
    if (module.components.length) {
      const tabs = root.createDiv({
        cls: 'los-subtabs',
        attr: {
          role: 'group',
          'aria-label': 'Module components',
        },
      });
      enableButtonGroupKeyboardNavigation(tabs);

      const allTab = button(
        tabs,
        'All components',
        () => view.selectComponent(null),
        view.componentId
          ? 'quiet'
          : 'row',
      );

      allTab.setAttrs({
        'aria-pressed':
          String(!view.componentId),
      });

      for (
        const component
        of module.components
      ) {
        const control = button(
          tabs,
          component.title,
          () =>
            view.selectComponent(
              component.id,
            ),
          view.componentId
            === component.id
            ? 'row'
            : 'quiet',
        );

        control.setAttrs({
          'aria-pressed':
            String(
              view.componentId
              === component.id,
            ),
        });
      }
    }

    const units = view.plugin.store
      .unitsFor(
        module.id,
        view.componentId,
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

    const statusRank = (
      status: string,
    ): number => {
      const index = STATUS_ORDER.indexOf(status);
      return index < 0
        ? STATUS_ORDER.length
        : index;
    };

    const ordered = [...units].sort(
      (a, b) =>
        statusRank(a.status)
        - statusRank(b.status)
        || a.title.localeCompare(b.title),
    );

    const heading = root.createDiv({
      cls: 'los-section-heading los-module-units-heading',
    });

    heading.createEl('h2', {
      text: 'Units',
    });

    heading.createSpan({
      text:
        `${ordered.length} unit${
          ordered.length === 1 ? '' : 's'
        } · ${
          ordered.filter(
            (unit) => unit.status === 'active',
          ).length
        } in progress`,
    });

    const list = root.createDiv({
      cls: 'los-record-list los-module-unit-list',
    });

    for (const unit of ordered) {
      const map = view.plugin.store.mapForUnit(
        unit.id,
      );

      const stages = map
        ? projectedRecords(map.stages)
        : [];

      const complete = stages.filter(
        (stage) => stage.status === 'complete',
      ).length;

      const currentStageId = map
        ? projectedString(map.current_stage)
        : null;

      const currentStage = currentStageId
        ? stages.find(
          (stage) => stage.id === currentStageId,
        )
        : null;

      const row = list.createEl('button', {
        cls: 'los-record-row is-clickable',
        attr: {
          type: 'button',
          'aria-label': `Open unit: ${unit.title}`,
        },
      });

      const copy = row.createDiv({
        cls: 'los-record-copy',
      });

      copy.createEl('strong', {
        text: unit.title,
      });

      const meta = [
        unit.status.replaceAll('-', ' '),
        map
          ? `${complete} of ${stages.length} stages`
          : 'No study map yet',
        currentStage
          ? `Current · ${
            projectedString(currentStage.title)
            ?? currentStageId
          }`
          : '',
      ]
        .filter(Boolean)
        .join(' · ');

      copy.createDiv({
        cls: 'los-record-meta',
        text: meta,
      });

      if (map) {
        row.createSpan({
          cls: 'los-record-action',
          text: 'Open →',
        });
      } else {
        badge(
          row,
          'No map',
          'needs-map',
        );
      }

      row.addEventListener(
        'click',
        () => {
          view.selectedElementId = unit.id;
          return view.plugin.openUnit(unit.id);
        },
      );
    }
  }
