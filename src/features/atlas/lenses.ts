import { button, empty } from '../../components';
import { enableButtonGroupKeyboardNavigation } from '../../accessibility/button-group';
import {
  bridges,
  conceptLabel,
  diagnostics,
  evidenceFor,
  summarize,
  type AtlasDiagnostic,
  type AtlasGraph,
} from './graph';
import { edgeHeadline, moduleTrail, plural, provenanceSentence } from './narrative';
import { provenanceOf } from './graph';
import type { AtlasHost } from './ports';

/**
 * The two corpus lenses.
 *
 * Both live inside the one Atlas route rather than becoming views of their own
 * (ADR-015 decision 4, restated by ADR-016 decision 6). Both answer a question
 * about the registry rather than about a concept, which is why they replace the
 * focused graph instead of decorating it.
 *
 * Every count here opens its records. A number a reader cannot follow is a
 * verdict, and this screen is not entitled to deliver verdicts about work that
 * has not been written down yet.
 */

function conceptRow(
  parent: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
  conceptId: string,
  detail: string,
): void {
  const row = parent.createEl('button', {
    cls: 'los-atlas-record is-clickable',
    attr: { type: 'button' },
  });
  row.createDiv({
    cls: 'los-atlas-record-title',
    text: conceptLabel(graph, conceptId),
  });
  row.createDiv({ cls: 'los-micro', text: detail });
  row.addEventListener('click', () => host.go({
    concept: conceptId,
    lens: 'prerequisites',
  }));
}

export function renderBridges(
  parent: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
): void {
  const all = bridges(graph);
  const moduleFilter = host.state.module;
  const rows = moduleFilter
    ? all.filter((bridge) =>
      bridge.modules.some((module) => module.id === moduleFilter))
    : all;

  const panel = parent.createDiv({ cls: 'los-atlas-lens-panel' });
  const summary = summarize(graph);

  panel.createDiv({
    cls: 'los-atlas-lens-lead',
    text: moduleFilter
      ? `${plural(rows.length, 'concept')} taught in ${conceptLabel(graph, moduleFilter) === moduleFilter ? 'the selected module' : moduleFilter} and at least one other, of ${plural(all.length, 'bridge')} in the registry.`
      : `${plural(all.length, 'concept')} carry evidence from more than one module, out of ${plural(summary.concepts, 'concept')} in the registry.`,
  });
  panel.createDiv({
    cls: 'los-micro',
    text: 'A bridge says where a concept is taught. It is never a relation between the modules, and no prerequisite is derived from one.',
  });

  if (!rows.length) {
    empty(
      panel,
      'No concept crosses more than one module here',
      'Evidence is published per module from stage tags and reviewed knowledge-map nodes. Nothing crossing means nothing has been tagged in two places — not that the modules share no material.',
    );
    return;
  }

  const list = panel.createDiv({ cls: 'los-atlas-records' });
  enableButtonGroupKeyboardNavigation(list, 'vertical');

  for (const bridge of rows) {
    const detail = bridge.modules
      .map((module) => `${module.label} (${plural(evidenceFor(graph, module.id, bridge.concept.id).length, 'tag')})`)
      .join(' · ');
    conceptRow(list, host, graph, bridge.concept.id, detail);
  }
}

function renderDiagnosticEntry(
  parent: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
  entry: AtlasDiagnostic,
): void {
  const group = parent.createDiv({ cls: 'los-atlas-diagnostic' });
  group.toggleClass('is-empty', entry.count === 0);

  const heading = group.createEl('details', { cls: 'los-disclosure' });
  const summary = heading.createEl('summary');
  summary.createSpan({
    cls: 'los-atlas-record-title',
    text: `${entry.title} · ${entry.count}`,
  });
  const body = heading.createDiv({ cls: 'los-disclosure-body' });

  body.createDiv({ cls: 'los-micro', text: entry.meaning });

  if (!entry.count) {
    body.createDiv({ cls: 'los-micro', text: 'Nothing in this state right now.' });
    return;
  }

  const list = body.createDiv({ cls: 'los-atlas-records' });
  enableButtonGroupKeyboardNavigation(list, 'vertical');

  for (const conceptId of entry.conceptIds) {
    conceptRow(list, host, graph, conceptId, moduleTrail(graph, conceptId));
  }

  for (const edgeId of entry.edgeIds) {
    const edge = graph.relationByIdentity.get(edgeId);
    if (!edge) continue;

    const row = list.createEl('button', {
      cls: 'los-atlas-record is-clickable',
      attr: { type: 'button' },
    });
    row.createDiv({
      cls: 'los-atlas-record-title',
      text: `${conceptLabel(graph, edge.from)} — ${edgeHeadline(graph, edge, edge.from)}`,
    });
    row.createDiv({
      cls: 'los-micro',
      text: provenanceSentence(provenanceOf(graph, edge)),
    });
    row.addEventListener('click', () => host.go({
      concept: edge.from,
      lens: 'prerequisites',
    }));
  }

  for (const moduleId of entry.moduleIds) {
    const module = graph.modules.find((row) => row.id === moduleId);
    const row = list.createEl('button', {
      cls: 'los-atlas-record is-clickable',
      attr: { type: 'button' },
    });
    row.createDiv({
      cls: 'los-atlas-record-title',
      text: module?.label ?? moduleId,
    });
    row.createDiv({ cls: 'los-micro', text: 'No concept evidence published' });
    row.addEventListener('click', () => host.plugin.nav.openModule(moduleId));
  }
}

export function renderDiagnostics(
  parent: HTMLElement,
  host: AtlasHost,
  graph: AtlasGraph,
): void {
  const panel = parent.createDiv({ cls: 'los-atlas-lens-panel' });
  const summary = summarize(graph);

  panel.createDiv({
    cls: 'los-atlas-lens-lead',
    text: `${plural(summary.relations, 'authored relation')} over ${plural(summary.concepts, 'concept')} · ${summary.strictRelations} strict · ${summary.semanticRelations} semantic${summary.unrecognizedRelations ? ` · ${summary.unrecognizedRelations} outside the vocabulary` : ''}.`,
  });
  panel.createDiv({
    cls: 'los-micro',
    text: 'Each row below opens the records it counts. No authored evidence is not the same as not relevant, and nothing here is a judgment about a concept.',
  });

  const entries = diagnostics(graph);
  const list = panel.createDiv({ cls: 'los-atlas-diagnostics' });

  for (const entry of entries) {
    renderDiagnosticEntry(list, host, graph, entry);
  }

  const actions = panel.createDiv({ cls: 'los-actions' });
  button(
    actions,
    'Open generated domain map',
    () => host.plugin.openVaultPath('generated/domain-atlas.md'),
    'quiet',
  );
}
