import type { ProjectView } from '../../views/project-view';
import {
  empty,
  pageHeader,
  projectedExcerpt,
} from '../../components';
import type { ProjectionRecord } from '../../contracts/manifest';
import {
  asLabel as projectedLabel,
  asListLength as projectedListLength,
  asString as projectedString,
} from '../../projection/readers';

export function renderList(
  view: ProjectView,

    root: HTMLElement,
  ): void {
    pageHeader(
      root,
      'Projects',
      'Projects',
      'Long-running work with its own structure, materials, files, and decisions.',
    );

    const input = root.createEl(
      'input',
      {
        cls:
          'los-search los-project-search',
        attr: {
          type: 'search',
          placeholder: 'Search projects',
          'aria-label': 'Search projects',
        },
      },
    );

    input.value = view.query;

    const results = root.createDiv({
      cls: 'los-project-list',
    });

    const draw = (): void => {
      results.empty();

      const words = input.value
        .toLocaleLowerCase()
        .split(/\s+/)
        .filter(Boolean);

      const rows =
        view.plugin.store.projects().filter(
          (project: ProjectionRecord) => {
            const id =
              projectedString(project.id);

            if (!id) {
              return false;
            }

            const hay = [
              id,
              projectedString(project.title),
              projectedString(project.objective),
              projectedString(
                project.project_type,
              ),
            ]
              .filter(
                (
                  value,
                ): value is string =>
                  Boolean(value),
              )
              .join(' ')
              .toLocaleLowerCase();

            return words.every(
              (word: string) =>
                hay.includes(word),
            );
          },
        );

      if (!rows.length) {
        empty(
          results,
          'No projects found',
          'No first-class project matches this query.',
          'Clear search',
          () => {
            input.value = '';

            input.dispatchEvent(
              new Event('input'),
            );
          },
        );

        return;
      }

      for (const project of rows) {
        const projectId =
          projectedString(project.id);

        if (!projectId) {
          continue;
        }

        const title =
          projectedLabel(project);

        const status =
          projectedString(project.status)
          ?? 'planned';

        const projectType =
          projectedString(
            project.project_type,
          )
          ?? 'project';

        const row = results.createEl('button', {
          cls: 'los-record-row los-project-row is-clickable',
          attr: {
            type: 'button',
            'aria-label': `Open project: ${title}`,
          },
        });

        row.setAttr(
          'data-record-id',
          projectId,
        );

        const copy = row.createDiv({
          cls: 'los-record-copy',
        });

        copy.createEl('strong', {
          text: title,
        });

        copy.createDiv({
          cls: 'los-record-summary',
          text: projectedExcerpt(
            project.objective,
            170,
          ),
        });

        copy.createDiv({
          cls: 'los-record-meta',
          text:
            `${projectType} · ${status} · ${
              projectedListLength(
                project.linked_module_ids,
              )
            } linked modules`,
        });

        row.createSpan({
          cls: 'los-record-action',
          text: 'Open →',
        });

        row.addEventListener(
          'click',
          () => {
            view.selectedElementId =
              projectId;

            void view.plugin.openProject(
              projectId,
              'structure',
            );
          },
        );
      }
    };

    input.addEventListener(
      'input',
      () => {
        view.query = input.value;

        view.plugin.router.remember({
          name: 'project-list',
          query: view.query,
        });

        draw();
      },
    );

    draw();
  }
