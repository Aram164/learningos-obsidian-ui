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
import type { ProjectionRecord } from '../../contracts/manifest-v5';
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

export function renderGroups(
  view: ModuleView,

    root: HTMLElement,
  ): void {
    const semester =
      view.plugin.store.currentSemester();

    const modules = view.plugin.store
      .currentSemesterModules()
      .map((record) =>
        readModuleRecord(record),
      )
      .filter(nonNull);

    pageHeader(
      root,
      typeof semester?.title === 'string'
        ? `Modules · ${semester.title}`
        : 'Modules',
      'Modules',
      'The modules you are taking this semester. Your complete source collection lives in Library.',
    );

    if (!modules.length) {
      empty(
        root,
        'No current-semester modules',
        'The Core projection does not currently identify any enrolled academic modules for this semester.',
      );
      return;
    }

    const summary = root.createDiv({
      cls: 'los-semester-summary',
    });

    summary.createEl('strong', {
      text:
        typeof semester?.title === 'string'
          ? semester.title
          : 'Current semester',
    });

    summary.createSpan({
      text:
        `${modules.length} enrolled module${
          modules.length === 1 ? '' : 's'
        }`,
    });

    const list = root.createDiv({
      cls:
        'los-route-list '
        + 'los-semester-module-list',
    });

    for (const module of modules) {
      const progress = readProgress(
        view.plugin.store.progress(module.id),
      );

      const row = list.createEl(
        'button',
        {
          cls:
            'los-route-row '
            + 'los-semester-module-row '
            + 'is-clickable',
          attr: {
            type: 'button',
            'aria-label':
              `Open module: ${module.title}`,
            'data-record-id': module.id,
          },
        },
      );

      const copy = row.createDiv({
        cls: 'los-route-row-copy',
      });

      copy.createEl('strong', {
        text: module.title,
      });

      const facts = [
        module.code,
        progress.stagesTotal
          ? `${progress.stagesComplete} of ${progress.stagesTotal} stages`
          : `${progress.unitsTotal} unit${progress.unitsTotal === 1 ? '' : 's'}`,
      ].filter(Boolean);

      copy.createDiv({
        cls: 'los-route-meta',
        text: facts.join(' · '),
      });

      row.createSpan({
        cls: 'los-route-open',
        text: 'Open →',
      });

      row.addEventListener(
        'click',
        () => {
          view.selectedElementId =
            module.id;

          return view.plugin
            .openModuleDetail(module.id);
        },
      );
    }
  }

export function renderGroupList(
  view: ModuleView,

    root: HTMLElement,
  ): void {
    const groupRecord =
      view.groupId
        ? view.plugin.store.get(
          view.groupId,
        )
        : null;

    const group =
      readThematicGroup(groupRecord);

    const back = button(
      root,
      '‹ Modules',
      () => view.plugin.back(),
      'quiet',
    );

    back.addClass('los-route-back');

    if (!group) {
      empty(
        root,
        'Thematic group unavailable',
        'Return to Modules and choose another group.',
        'Back',
        () => view.plugin.back(),
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

    search.value = view.query;

    search.addEventListener(
      'input',
      async () => {
        view.query = search.value;

        await view.plugin.router.remember({
          name: 'module-list',
          groupId: group.id,
          query: view.query,
        });

        view.render();
      },
    );

    const all = view.plugin.store
      .modulesForGroup(group.id)
      .map((record) =>
        readModuleRecord(record),
      )
      .filter(nonNull);

    const needle =
      view.query
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
          view.query.trim()
        }”.`,
        'Clear search',
        async () => {
          view.query = '';

          await view.plugin.router.remember({
            name: 'module-list',
            groupId: group.id,
            query: '',
          });

          view.render();
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
          view.selectedElementId =
            module.id;

          return view.plugin
            .openModuleDetail(module.id);
        },
      );
    }
  }
