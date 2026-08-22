import type { UnitView } from '../../views/unit-view';
import { Notice } from 'obsidian';
import {
  badge,
  button,
  chip,
  icon,
  section,
} from '../../components';
import type { ProjectionRecord } from '../../contracts/manifest';
import {
  asString as projectedString,
} from '../../projection/readers';
import type {
  MaterialOptionView,
  UnitRecordView,
} from './model';

const MATERIAL_TYPE_ORDER = [
  'video',
  'article',
  'book',
  'exercise',
] as const;

type MaterialType = typeof MATERIAL_TYPE_ORDER[number];

const MATERIAL_TYPE_LABELS: Readonly<Record<MaterialType, string>> = {
  video: 'Videos',
  article: 'Articles',
  book: 'Books',
  exercise: 'Exercises',
};

function materialTypeOf(
  format: string,
): MaterialType {
  if (format === 'video') return 'video';
  if (
    format === 'exercise'
    || format === 'code'
    || format === 'notebook'
    || format === 'quiz'
    || format === 'homework'
    || format === 'problem-set'
  ) return 'exercise';
  if (format === 'book' || format === 'textbook') return 'book';

  // Decks, course pages, papers, documentation, and other readable routes
  // remain distinct in their row metadata while sharing one scan-friendly
  // catalogue group.
  return 'article';
}

function optionIcon(
  materialType: MaterialType,
): string {
  if (materialType === 'video') return 'play';
  if (materialType === 'exercise') return 'pencil-line';
  if (materialType === 'article') return 'file-text';
  return 'book-open';
}

export function renderMaterialOverview(
  view: UnitView,
  root: HTMLElement,
  unit: UnitRecordView,
  options: MaterialOptionView[],
): void {
  const map = section(
    root,
    'Lecture knowledge map',
    unit.knowledgeSummary,
  );

  const titleById = new Map(
    unit.knowledgeNodes.map(
      (node) => [node.id, node.title],
    ),
  );

  const nodes = map.createDiv({
    cls: 'los-knowledge-grid',
  });

  for (const node of unit.knowledgeNodes) {
    const card = nodes.createDiv({
      cls: 'los-knowledge-node',
    });

    card.createEl('h3', {
      text: node.title,
    });
    card.createEl('p', {
      text: node.summary,
    });

    const dependencies = node.buildsOn
      .map((id) => titleById.get(id))
      .filter(
        (title): title is string =>
          Boolean(title),
      );

    if (dependencies.length) {
      card.createDiv({
        cls: 'los-micro',
        text:
          `Builds on: ${dependencies.join(', ')}`,
      });
    }
  }

  const materials = section(
    root,
    'Choose your learning material',
    'This is a complete menu, not a sequence. Pick the explanation angle and depth that fit your current need.',
  );

  const grouped = new Map<
    MaterialType,
    MaterialOptionView[]
  >();

  for (const option of options) {
    const materialType = materialTypeOf(
      option.format,
    );
    const group = grouped.get(materialType);
    if (group) group.push(option);
    else grouped.set(materialType, [option]);
  }

  for (const materialType of MATERIAL_TYPE_ORDER) {
    if (!grouped.has(materialType)) continue;

    const group = materials.createDiv({
      cls:
        'los-material-group '
        + `los-material-group-${materialType}`,
    });
    const entries = grouped.get(materialType) ?? [];

    const heading = group.createDiv({
      cls: 'los-material-group-heading',
    });
    heading.createEl('h3', {
      text: MATERIAL_TYPE_LABELS[materialType],
    });
    heading.createSpan({
      cls: 'los-micro',
      text: `${entries.length} option${entries.length === 1 ? '' : 's'}`,
    });

    for (const option of entries) {
      const row = group.createDiv({
        cls: 'los-material-option',
      });

      icon(
        row.createSpan({
          cls: 'los-material-icon',
        }),
        optionIcon(materialType),
      );

      const copy = row.createDiv({
        cls: 'los-material-copy',
      });

      copy.createEl('h4', {
        text: option.title,
      });
      copy.createEl('p', {
        text: option.angle,
      });

      if (option.locator) {
        copy.createDiv({
          cls: 'los-micro',
          text: option.locator,
        });
      }

      const metadata = copy.createDiv({
        cls: 'los-material-metadata',
      });
      badge(
        metadata,
        option.format.replaceAll('-', ' '),
        'role',
      );
      badge(
        metadata,
        option.depth.replaceAll('-', ' '),
        'role',
      );
      badge(
        metadata,
        option.scope.replaceAll('-', ' '),
        option.scope === 'current'
          ? 'status'
          : 'role',
      );

      for (const knowledgeId of option.covers) {
        const label = titleById.get(knowledgeId);
        if (label) {
          metadata.createSpan({
            cls: 'los-knowledge-chip',
            text: label,
          });
        }
      }

      if (option.sourceId) {
        const source = view.plugin.store.get(
          option.sourceId,
        );

        if (source) {
          chip(
            copy,
            source,
            (record: ProjectionRecord) => {
              const id = projectedString(record.id);
              return id
                ? view.plugin.nav.openLibrary(id)
                : undefined;
            },
          );
        }
      }

      if (option.canOpen || option.canChoose) {
        const actions = row.createDiv({
          cls: 'los-actions los-material-actions',
        });

        if (
          option.canChoose
          && option.sourceId
          && option.locator
        ) {
          const choice = button(
            actions,
            option.selected
              ? 'Remove choice'
              : 'Choose',
            () => {
              void view.plugin.mutate(
                () => view.plugin.gateway.sourceSelection(
                  unit.id,
                  option.sourceId ?? '',
                  option.locator ?? '',
                  option.angle,
                  !option.selected,
                ),
              ).then(
                () => new Notice(
                  option.selected
                    ? 'Material choice removed.'
                    : 'Material chosen for this lecture.',
                ),
              ).catch(
                (error: unknown) =>
                  new Notice(
                    error instanceof Error
                      ? error.message
                      : String(error),
                  ),
              );
            },
            'choice',
          );
          choice.setAttr(
            'aria-pressed',
            option.selected
              ? 'true'
              : 'false',
          );
        }

        if (option.canOpen) {
          button(
            actions,
          'Open',
          () => view.plugin.openResource(
            option.record,
          ),
          'info',
          );
        }
      }
    }
  }
}
