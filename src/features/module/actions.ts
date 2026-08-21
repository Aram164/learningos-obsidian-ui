import type { ModuleView } from '../../views/module-view';
import {
  chip,
  empty,
} from '../../components';
import { VIEW_MODULE } from '../../constants';
import type { ProjectionRecord } from '../../contracts/manifest';
import {
  asString as projectedString,
} from '../../projection/readers';
import {
  type ModuleTab,
  type ModuleRecordView,
  type SourceEntryView,
  readSourceEntries,
} from './model';

export async function selectTab(
  view: ModuleView,

    tab: ModuleTab,
  ): Promise<void> {
    if (!view.moduleId) {
      return;
    }

    view.tab = tab;

    await view.plugin.router.remember({
      name: 'module-detail',
      moduleId: view.moduleId,
      componentId: view.componentId,
      tab,
    });

    await view.leaf.setViewState({
      type: VIEW_MODULE,
      active: true,
      state: {
        screen: 'detail',
        moduleId: view.moduleId,
        componentId: view.componentId,
        tab,
      },
    });
  }

export async function selectComponent(
  view: ModuleView,

    componentId: string | null,
  ): Promise<void> {
    if (!view.moduleId) {
      return;
    }

    view.componentId = componentId;

    const tab =
      view.tab
      ?? 'units';

    await view.plugin.router.remember({
      name: 'module-detail',
      moduleId: view.moduleId,
      componentId,
      tab,
    });

    await view.leaf.setViewState({
      type: VIEW_MODULE,
      active: true,
      state: {
        screen: 'detail',
        moduleId: view.moduleId,
        componentId,
        tab,
      },
    });
  }

export function renderSources(
  view: ModuleView,

    root: HTMLElement,
    module: ModuleRecordView,
  ): void {
    const sourceMap =
      view.plugin.store.sourceMap(
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
            ? view.plugin.store.get(
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

              return view.plugin
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
