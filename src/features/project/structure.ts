import type { ProjectView } from '../../views/project-view';
import {
  badge,
  button,
  chip,
  empty,
  pageHeader,
  projectedExcerpt,
  section,
} from '../../components';
import type { ProjectionRecord } from '../../contracts/manifest-v5';
import {
  asLabel as projectedLabel,
  asListLength as projectedListLength,
  asRecords as projectedRecords,
  asString as projectedString,
  asStrings as projectedStrings,
  asText as projectedText,
  isRecord,
} from '../../projection/readers';
import {
  PROJECT_TABS,
  type ProjectTab,
  type ProjectBoundaries,
  type ProjectStructure,
  type ProjectRelationship,
  readProjectBoundaries,
  readProjectStructure,
  readProjectRelationship,
} from './model';

export function renderBoundaryBanner(
  view: ProjectView,

    root: HTMLElement,
    project: ProjectionRecord,
  ): void {
    const boundaries = readProjectBoundaries(
      project.boundaries,
    );

    const banner = root.createDiv({
      cls: 'los-project-boundary',
    });

    banner.createDiv({
      cls: 'los-kicker',
      text: 'Boundary',
    });

    banner.createEl('p', {
      text: [
        `confidentiality: ${boundaries.confidentiality}`,
        `external code access: ${boundaries.externalCodeAccess}`,
        boundaries.notes,
      ]
        .filter(Boolean)
        .join(' · '),
    });
  }

export function renderStructure(
  view: ProjectView,

    root: HTMLElement,
    project: ProjectionRecord,
  ): void {
    const structure =
      readProjectStructure(
        project.structure,
      );

    const wrap = section(
      root,
      'Structure',
      `Structure mode: ${structure.kind}.`,
    );

    if (!structure.nodes.length) {
      empty(
        wrap,
        'No fixed structure',
        'This project currently has no linear or nested step map.',
      );

      return;
    }

    const tree = wrap.createDiv({
      cls: 'los-record-list los-project-structure',
    });

    const renderNode = (
      parent: HTMLElement,
      row: ProjectionRecord,
      depth = 0,
    ): void => {
      const item = parent.createDiv({
        cls: `los-record-row los-project-structure-row los-project-node-depth-${
          Math.min(depth, 4)
        }`,
      });

      const copy = item.createDiv({
        cls: 'los-record-copy',
      });

      copy.createEl('strong', {
        text: projectedLabel(row),
      });

      const status =
        projectedString(row.status);

      if (status) {
        copy.createDiv({
          cls: 'los-record-meta',
          text: `${
            projectedString(row.kind)
            ?? 'step'
          } · ${status}`,
        });
      }

      const summary =
        projectedString(row.summary);

      if (summary) {
        copy.createDiv({
          cls: 'los-record-summary',
          text: summary,
        });
      }

      const children =
        projectedRecords(row.children);

      if (children.length) {
        for (const child of children) {
          renderNode(
            parent,
            child,
            depth + 1,
          );
        }
      }
    };

    for (const row of structure.nodes) {
      renderNode(
        tree,
        row,
      );
    }
  }
