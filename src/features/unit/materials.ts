import type { UnitMaterialsHost } from './ports';
import { Notice } from 'obsidian';
import {
  badge,
  button,
  chip,
  icon,
  section,
} from '../../components';
import type {
  ProjectionRecord,
  UnitMaterialSynthesisV1,
} from '../../contracts/manifest';
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
  view: UnitMaterialsHost,
  root: HTMLElement,
  unit: UnitRecordView,
  options: MaterialOptionView[],
  synthesis: UnitMaterialSynthesisV1 | null,
  /**
   * Whether to render the complete choose-a-source menu on the page.
   *
   * False once a stage workspace is on screen: the menu moved into the
   * comparison drawer (Figma 05 · 36:12) so the stage shows one current action
   * instead of the whole catalogue at one weight. It stays on the page when
   * there is no stage to open a drawer from — a unit with no study map, or a
   * map with no stages — because there the menu is the whole account of what
   * the lecture offers, and the only place a selection can be made.
   */
  includeMenu = true,
): void {
  const studyMap = view.plugin.store.mapForUnit(unit.id);
  const expectedRevisions = view.plugin.store.artifactGuard(
    unit.id,
    typeof studyMap?.id === 'string' ? studyMap.id : null,
  );
  const titleById = new Map(
    unit.knowledgeNodes.map(
      (node) => [node.id, node.title],
    ),
  );

  if (unit.knowledgeNodes.length) {
    const map = section(
      root,
      'Lecture knowledge map',
      unit.knowledgeSummary,
    );
    const nodes = map.createDiv({ cls: 'los-knowledge-grid' });
    for (const node of unit.knowledgeNodes) {
      const card = nodes.createDiv({ cls: 'los-knowledge-node' });
      card.createEl('h3', { text: node.title });
      card.createEl('p', { text: node.summary });
      const dependencies = node.buildsOn
        .map((id) => titleById.get(id))
        .filter((title): title is string => Boolean(title));
      if (dependencies.length) {
        card.createDiv({
          cls: 'los-micro',
          text: `Builds on: ${dependencies.join(', ')}`,
        });
      }
    }
  }

  if (synthesis) {
    renderMaterialSynthesis(view, root, synthesis, options);
  }

  if (!options.length || !includeMenu) return;

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
                  option.routeId,
                  option.sourceId ?? '',
                  option.locator ?? '',
                  option.angle,
                  !option.selected,
                  expectedRevisions,
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

function renderMaterialSynthesis(
  view: UnitMaterialsHost,
  root: HTMLElement,
  synthesis: UnitMaterialSynthesisV1,
  options: MaterialOptionView[],
): void {
  const block = section(
    root,
    'Approved material synthesis',
    'Evidence-backed comparison of the exact material routes approved for this unit.',
  );
  block.addClass('los-material-synthesis');
  const routeTitles = new Map(options.map((option) => [option.routeId, option.title]));
  const head = block.createDiv({ cls: 'los-material-synthesis-head' });
  badge(head, 'approved', 'status');
  const policy = projectedString(synthesis.basis.policy);
  if (policy) badge(head, policy.replaceAll('-', ' '), 'role');
  head.createSpan({
    cls: 'los-micro',
    text: `${synthesis.route_assessments.length} assessed route${synthesis.route_assessments.length === 1 ? '' : 's'}`
      + ` · unit r${synthesis.basis.unit_revision}`
      + ` · source map r${synthesis.basis.source_map_revision}`,
  });

  const projectionStatus = block.createDiv({
    cls: `los-synthesis-status${synthesis.freshness.status === 'stale' ? ' is-stale' : ''}`,
    attr: { role: 'status' },
  });
  const statusHead = projectionStatus.createDiv({ cls: 'los-material-synthesis-head' });
  badge(
    statusHead,
    synthesis.freshness.status === 'current' ? 'current basis' : 'stale basis',
    synthesis.freshness.status === 'current' ? 'status' : 'role',
  );
  badge(
    statusHead,
    synthesis.completeness.complete ? 'complete route coverage' : 'incomplete route coverage',
    synthesis.completeness.complete ? 'status' : 'role',
  );
  projectionStatus.createDiv({
    cls: 'los-micro',
    text: `${synthesis.completeness.assessed_route_count}/${synthesis.completeness.current_route_count} current routes assessed`
      + ` · ${synthesis.completeness.deep_reviewed_count} deep reviewed`
      + ` · ${synthesis.completeness.screened_count} screened`
      + ` · ${synthesis.completeness.unevaluated_count} unevaluated`
      + ` · ${synthesis.completeness.unavailable_count} unavailable`,
  });
  if (synthesis.freshness.status === 'stale') {
    projectionStatus.createEl('p', {
      text: 'This approved dossier is retained below for reference, but its current basis no longer matches: '
        + synthesis.freshness.reasons.map((reason) => reason.replaceAll('_', ' ')).join(', ')
        + '.',
    });
  }
  if (!synthesis.completeness.complete) {
    const routeIssues = [
      synthesis.completeness.missing_route_ids.length
        ? `Missing: ${synthesis.completeness.missing_route_ids.join(', ')}` : '',
      synthesis.completeness.orphaned_route_ids.length
        ? `Orphaned: ${synthesis.completeness.orphaned_route_ids.join(', ')}` : '',
      synthesis.completeness.duplicate_route_ids.length
        ? `Duplicated: ${synthesis.completeness.duplicate_route_ids.join(', ')}` : '',
    ].filter(Boolean);
    projectionStatus.createDiv({
      cls: 'los-micro',
      text: routeIssues.length ? routeIssues.join(' · ') : 'Route coverage is not complete.',
    });
  }

  const assessments = block.createDiv({ cls: 'los-synthesis-grid' });
  for (const assessment of synthesis.route_assessments) {
    const card = assessments.createDiv({ cls: 'los-synthesis-card' });
    const heading = card.createDiv({ cls: 'los-synthesis-card-head' });
    heading.createEl('h3', {
      text: routeTitles.get(assessment.route_id) || assessment.locator,
    });
    badge(heading, assessment.review_status.replaceAll('-', ' '),
      assessment.review_status === 'deep-reviewed' ? 'status' : 'role');
    card.createDiv({ cls: 'los-micro', text: assessment.locator });
    const source = view.plugin.store.get(assessment.source_id);
    if (source) {
      chip(card, source, (record: ProjectionRecord) => {
        const sourceId = projectedString(record.id);
        return sourceId ? view.plugin.nav.openLibrary(sourceId) : undefined;
      });
    }
    const details: ReadonlyArray<readonly [string, string | undefined]> = [
      ['Contribution', assessment.contribution],
      ['Best for', assessment.best_for],
      ['Assumptions', assessment.assumptions],
      ['Notation', assessment.notation],
      ['Exercise value', assessment.exercise_value],
      ['Limitations', assessment.limitations],
      ['Review note', assessment.reason],
    ];
    for (const [label, value] of details) {
      if (!value) continue;
      const row = card.createDiv({ cls: 'los-synthesis-detail' });
      row.createSpan({ cls: 'los-micro', text: label });
      row.createEl('p', { text: value });
    }
    if (assessment.concept_ids.length) {
      const concepts = card.createDiv({ cls: 'los-material-metadata' });
      for (const conceptId of assessment.concept_ids) {
        const concept = view.plugin.store.get(conceptId);
        if (concept) chip(concepts, concept, (record) => view.plugin.nav.openRecord(record));
      }
    }
    const evidenceCount = assessment.evidence?.length || 0;
    if (evidenceCount) {
      card.createDiv({
        cls: 'los-micro',
        text: `${evidenceCount} pinned evidence locator${evidenceCount === 1 ? '' : 's'}`,
      });
    }
  }

  if (synthesis.comparisons.length) {
    const comparisons = block.createDiv({ cls: 'los-synthesis-comparisons' });
    comparisons.createEl('h3', { text: 'Route comparisons' });
    for (const comparison of synthesis.comparisons) {
      const row = comparisons.createDiv({ cls: 'los-synthesis-comparison' });
      const labels = [
        routeTitles.get(comparison.left_route_id) || comparison.left_route_id,
        routeTitles.get(comparison.right_route_id) || comparison.right_route_id,
      ];
      const heading = row.createDiv({ cls: 'los-synthesis-comparison-head' });
      heading.createEl('strong', { text: labels.join(' ↔ ') });
      badge(heading, comparison.relation.replaceAll('-', ' '), 'role');
      row.createEl('p', { text: comparison.narrative });
    }
  }

  if (synthesis.concept_groups.length) {
    const bridges = block.createDiv({ cls: 'los-synthesis-comparisons' });
    bridges.createEl('h3', { text: 'Concept bridges' });
    for (const group of synthesis.concept_groups) {
      const row = bridges.createDiv({ cls: 'los-synthesis-comparison' });
      const concept = view.plugin.store.get(group.concept_id);
      row.createEl('strong', {
        text: projectedString(concept?.title) || group.concept_id,
      });
      row.createEl('p', { text: group.narrative });
      const related = row.createDiv({ cls: 'los-material-metadata' });
      for (const relatedId of [...group.related_unit_ids, ...group.bridge_note_ids]) {
        const record = view.plugin.store.get(relatedId);
        if (record) chip(related, record, (target) => view.plugin.nav.openRecord(target));
      }
    }
  }
}
