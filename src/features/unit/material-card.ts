import { Notice } from 'obsidian';
import { button, chip, icon, overflowMenu } from '../../components';
import type { ProjectionRecord } from '../../contracts/manifest';
import { asMaterialSpan, type MaterialSpanV1 } from '../../contracts/material-span';
import { GatewayError } from '../../contracts/gateway-v1';
import { safeWebUrl } from '../../security/safe-url';
import { hasDirectResourceTarget } from '../../infrastructure/resource-target';
import { asString, asText, errorMessage } from '../../projection/readers';
import {
  materialTypeIcon,
  renderMaterialCautions,
  TRIAGE_HEADING,
  whyThisOne,
  type StageResourceRenderer,
  type StageResourceView,
} from '../stage-resources';
import type { MaterialOptionView, UnitPlugin } from './model';

/**
 * One material card, shared by "Current work" and "Compare materials"
 * (Figma B1 / B1a): purpose, title, kind and exact locator, availability, the
 * rationale behind "Why this one", and — only when asked — the exact local
 * span Core can read. Remote and missing material is said, never guessed at.
 */

export interface PurposeDef {
  readonly value: string;
  readonly label: string;
  readonly sub: string;
}

/**
 * The schema `depth` values with learner-facing labels, in a fixed order.
 * `unassessed` is labelled for what it is — an unwritten evaluation — and
 * never as a verdict on scope.
 */
export const PURPOSES: readonly PurposeDef[] = [
  { value: 'course-aligned', label: 'Follow the course', sub: 'Exactly what this lecture taught' },
  { value: 'orientation', label: 'Get oriented', sub: 'The shape of the idea before the detail' },
  { value: 'intuition', label: 'Build intuition', sub: 'Why it works, in pictures and words' },
  { value: 'derivation', label: 'Derive it', sub: 'The formal argument, step by step' },
  { value: 'practice', label: 'Practise', sub: 'Problems to work, with solutions to check' },
  { value: 'implementation', label: 'Implement it', sub: 'Code it and run it' },
  { value: 'advanced-reference', label: 'Go deeper', sub: 'Beyond this stage — kept, not required' },
  { value: 'unassessed', label: 'Not yet evaluated', sub: 'No one has judged this yet — not a scope judgment' },
];

export const UNASSIGNED_PURPOSE: PurposeDef = {
  value: '',
  label: 'Purpose not yet assigned',
  sub: 'Shown last; never dropped',
};

export function normalisePurpose(value: string | null | undefined): string {
  const candidate = (value ?? '').trim().toLowerCase();
  return PURPOSES.some((def) => def.value === candidate) ? candidate : '';
}

export function purposeLabel(value: string | null | undefined): string {
  const normal = normalisePurpose(value);
  return PURPOSES.find((def) => def.value === normal)?.label ?? UNASSIGNED_PURPOSE.label;
}

/** The route a stage placement points at: its own id, else one exact source + locator match. */
export function routeForResource(
  resource: StageResourceView,
  options: readonly MaterialOptionView[],
): MaterialOptionView | null {
  const routeId = asString(resource.record.route_id);
  if (routeId) return options.find((option) => option.routeId === routeId) ?? null;
  if (!resource.sourceId || !resource.locator) return null;
  const matches = options.filter((option) =>
    option.sourceId === resource.sourceId && option.locator === resource.locator);
  return matches.length === 1 ? matches[0] ?? null : null;
}

export type AvailabilityKind = 'local' | 'local-missing' | 'remote' | 'none';

export interface Availability {
  readonly kind: AvailabilityKind;
  readonly label: string;
  readonly detail: string;
}

/**
 * What the projection says about where a material is — before anything is
 * opened or read. `material_exists` is the producer's observation at build
 * time; the span inspection re-observes the bytes on demand.
 */
export function projectedAvailability(record: ProjectionRecord): Availability {
  // Core projects the two together; either one marks a registered local copy.
  const local = asString(record.material_uri) ?? asString(record.material_path);
  if (local) {
    return record.material_exists === false
      ? { kind: 'local-missing', label: 'Local copy missing', detail: 'Registered locally, but the file is not on this computer.' }
      : { kind: 'local', label: 'Local file', detail: 'On this computer; a bounded excerpt can be inspected.' };
  }
  const vault = asString(record.vault_path);
  if (vault && !vault.toLowerCase().startsWith('material://')) {
    return { kind: 'local', label: 'In the vault', detail: 'A file inside this vault.' };
  }
  if (safeWebUrl(record.url)) {
    return { kind: 'remote', label: 'Remote', detail: 'Opens in your browser. LearningOS never fetches it.' };
  }
  return { kind: 'none', label: 'Not available', detail: 'No local copy and no link is registered for this material.' };
}

/** A placement that names its own target is described by it, not by its route. */
function hasOwnTarget(record: ProjectionRecord): boolean {
  return Boolean(asString(record.material_uri) ?? asString(record.material_path)
    ?? asString(record.vault_path) ?? asString(record.url));
}

const TYPE_LABEL: Readonly<Record<string, string>> = {
  'course-material': 'Course',
  exercise: 'Exercise',
  practice: 'Exercise',
  practise: 'Exercise',
  solutions: 'Solutions',
  exam: 'Past exam',
  book: 'Book',
  textbook: 'Book',
  paper: 'Paper',
  video: 'Video',
  website: 'Web page',
  documentation: 'Documentation',
  code: 'Code',
  course: 'Course',
  article: 'Article',
};

/** "Course PDF", "Exercise PDF", "Video": what the thing is, in two words. */
export function materialKind(record: ProjectionRecord, route: MaterialOptionView | null, workingKind: string): string {
  const declared = (asString(record.format) ?? route?.format ?? '').toLowerCase();
  const base = TYPE_LABEL[declared]
    ?? (workingKind === 'practise' ? 'Exercise' : workingKind === 'watch' ? 'Video' : 'Material');
  const file = asString(record.material_uri) ?? asString(record.material_path)
    ?? asString(route?.record.material_uri) ?? '';
  const extension = file.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toUpperCase();
  if (!extension || base === 'Video' || base === 'Web page') return base;
  return `${base} ${extension}`;
}

/* ---------------------------------------------------------- span inspection */

type SpanState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly span: MaterialSpanV1 }
  | { readonly status: 'error'; readonly message: string; readonly stale: boolean };

/** Answers per projection snapshot; a new snapshot makes every one stale. */
const spans = new Map<string, SpanState>();

function spanKey(snapshot: string | null, unitId: string, routeId: string): string {
  return `${snapshot ?? 'none'}|${unitId}|${routeId}`;
}

export interface MaterialCardDeps {
  readonly plugin: Pick<UnitPlugin, 'gateway' | 'openResource' | 'store'> & { generate?(): unknown };
  readonly unitId: string;
  readonly renderer: StageResourceRenderer;
  /** Redraw the surface that owns the card once a span answer arrives. */
  readonly refresh: () => void;
}

function inspect(deps: MaterialCardDeps, routeId: string): void {
  const snapshot = deps.plugin.store.snapshotId;
  const key = spanKey(snapshot, deps.unitId, routeId);
  if (spans.get(key)?.status === 'loading') return;
  spans.set(key, { status: 'loading' });
  if (spans.size > 40) spans.delete(spans.keys().next().value as string);
  deps.refresh();
  void deps.plugin.gateway.materialSpan(deps.unitId, routeId, {
    extract: true,
    expectedSnapshot: snapshot,
  }).then((value) => {
    const span = asMaterialSpan(value);
    spans.set(key, span
      ? { status: 'ready', span }
      : { status: 'error', message: 'Core answered in a shape this build cannot read.', stale: false });
  }, (error: unknown) => {
    const stale = error instanceof GatewayError && error.exitCode === 3;
    spans.set(key, {
      status: 'error',
      message: stale
        ? 'The records changed since this projection was built. Rebuild it, then inspect again.'
        : errorMessage(error),
      stale,
    });
  }).finally(() => deps.refresh());
}

function renderSpan(parent: HTMLElement, deps: MaterialCardDeps, routeId: string): void {
  const state = spans.get(spanKey(deps.plugin.store.snapshotId, deps.unitId, routeId));
  if (!state) return;
  const box = parent.createDiv({ cls: 'los-span-panel', attr: { role: 'region', 'aria-label': 'Material excerpt' } });
  if (state.status === 'loading') {
    box.createDiv({ cls: 'los-micro', text: 'Reading a bounded material excerpt from Core…' });
    return;
  }
  if (state.status === 'error') {
    box.createDiv({ cls: 'los-micro los-span-error', text: state.message });
    if (state.stale && deps.plugin.generate) {
      button(box, 'Rebuild projection', () => deps.plugin.generate?.(), 'tertiary');
    }
    return;
  }
  const span = state.span;
  const head = box.createDiv({ cls: 'los-span-head' });
  head.createEl('strong', { text: SPAN_AVAILABILITY[span.availability] });
  if (span.locator) head.createSpan({ cls: 'los-micro', text: span.locator });
  if (span.availability === 'remote-unobserved') {
    box.createDiv({ cls: 'los-micro', text: 'Remote material is never fetched implicitly. Open it in your browser to read it.' });
    if (span.url) box.createDiv({ cls: 'los-span-url', text: span.url });
    return;
  }
  if (span.availability === 'local-unavailable') {
    box.createDiv({ cls: 'los-micro', text: 'The file is registered but not on this computer, so nothing could be read.' });
    return;
  }
  if (span.availability === 'unavailable') {
    box.createDiv({ cls: 'los-micro', text: 'No local copy and no link are registered for this route.' });
    return;
  }
  for (const file of span.files) {
    const entry = box.createDiv({ cls: 'los-span-file' });
    const facts = [
      file.format.toUpperCase(),
      file.pages.length
        ? `pages ${file.pages[0]}–${file.pages[file.pages.length - 1]}${file.page_total ? ` of ${file.page_total}` : ''}`
        : '',
      `sha256 ${file.file_sha256.replace(/^sha256:/, '').slice(0, 12)}…`,
    ].filter(Boolean);
    entry.createDiv({ cls: 'los-micro', text: facts.join(' · ') });
    if (file.extraction === 'unreadable') {
      entry.createDiv({ cls: 'los-micro los-span-error', text: `Unreadable: ${file.reason ?? 'no reason given'}` });
      continue;
    }
    if (file.excerpt) {
      entry.createEl('pre', { cls: 'los-span-excerpt', text: file.excerpt });
      const pagesTruncated = file.extraction === 'truncated' || file.extraction === 'range-truncated';
      if (file.excerpt_truncated || pagesTruncated) {
        entry.createDiv({ cls: 'los-micro', text: pagesTruncated && file.pages.length && file.page_total
          ? `Preview covers pages ${file.pages[0]}–${file.pages[file.pages.length - 1]} of ${file.page_total}; open the file for the remaining pages.`
          : 'Excerpt bounded by Core; open the file for the rest.' });
      }
    }
  }
  if (span.analysis_notes_total) {
    box.createDiv({ cls: 'los-micro', text: `${span.analysis_notes_total} analysis ${span.analysis_notes_total === 1 ? 'note reads' : 'notes read'} this route.` });
  }
}

const SPAN_AVAILABILITY: Readonly<Record<MaterialSpanV1['availability'], string>> = {
  'local-observed': 'Local file read just now',
  'local-unavailable': 'Local copy missing',
  'remote-unobserved': 'Remote — not fetched',
  unavailable: 'Not available',
};

function renderAvailability(parent: HTMLElement, availability: Availability, route: MaterialOptionView | null, deps: MaterialCardDeps): void {
  const line = parent.createDiv({ cls: `los-material-availability is-${availability.kind}` });
  line.createSpan({ cls: 'los-material-availability-label', text: availability.label });
  line.createSpan({ cls: 'los-micro', text: availability.detail });
  if (availability.kind === 'local' && route) {
    const state = spans.get(spanKey(deps.plugin.store.snapshotId, deps.unitId, route.routeId));
    const control = button(line, state?.status === 'ready' ? 'Inspect again' : 'Inspect span', () => inspect(deps, route.routeId), 'tertiary');
    control.addClass('los-span-trigger');
    control.disabled = state?.status === 'loading';
  } else if (availability.kind === 'local' && !route) {
    line.createSpan({ cls: 'los-micro', text: 'No single registered route, so its span cannot be inspected.' });
  }
}

export interface CardOptions {
  readonly prominent?: boolean;
  readonly badges?: readonly string[];
  /** The owning lecture's titles for what a route covers, kept with its rationale. */
  readonly coverage?: readonly string[];
  readonly selected?: boolean;
  /** Extra actions after Open, e.g. Choose or Go to lecture. */
  readonly actions?: (actions: HTMLElement) => void;
}

/** A stage placement as a card. The placement keeps its own target and feedback identity. */
export function renderPlacementCard(
  parent: HTMLElement,
  resource: StageResourceView,
  route: MaterialOptionView | null,
  source: ProjectionRecord | null,
  deps: MaterialCardDeps,
  options: CardOptions = {},
): HTMLElement {
  const card = parent.createDiv({
    cls: `los-resource-row los-material-card los-triage-${resource.scopeTriage || 'unranked'}${options.prominent ? ' is-prominent' : ''}`,
  });
  icon(card.createSpan({ cls: 'los-material-card-icon' }), materialTypeIcon(asString(resource.record.format) ?? route?.format ?? resource.kind));
  const copy = card.createDiv({ cls: 'los-resource-copy' });
  copy.createDiv({ cls: 'los-material-purpose', text: purposeLabel(route?.depth ?? asString(resource.record.depth)) });
  copy.createEl('strong', { cls: 'los-material-title', text: resource.label });
  const meta = copy.createDiv({ cls: 'los-resource-row-meta' });
  meta.createSpan({ cls: 'los-material-kind', text: materialKind(resource.record, route, resource.kind) });
  if (resource.locator) meta.createSpan({ cls: 'los-micro los-resource-locator', text: resource.locator });
  meta.createSpan({
    cls: `los-resource-priority los-resource-priority-${resource.scopeTriage || 'unranked'}`,
    text: resource.scopeTriage && resource.scopeTriage in TRIAGE_HEADING
      ? TRIAGE_HEADING[resource.scopeTriage as keyof typeof TRIAGE_HEADING]
      : 'Primary · unranked',
  });
  for (const badge of options.badges ?? []) meta.createSpan({ cls: 'los-micro los-resource-badge', text: badge });
  if (source) chip(meta, source, deps.renderer.openSource);
  const angle = asText(resource.record.angle) ?? route?.angle ?? null;
  if (angle) copy.createDiv({ cls: 'los-resource-angle', text: angle });
  renderMaterialCautions(copy, route?.record ?? resource.record);
  renderAvailability(copy, projectedAvailability(route && !hasOwnTarget(resource.record)
    ? route.record
    : resource.record), route, deps);
  if (route) renderSpan(copy, deps, route.routeId);
  const detail = asText(resource.record.angle_detail) ?? asText(route?.record.angle_detail);
  if (detail) whyThisOne(copy, detail);

  const actions = card.createDiv({ cls: 'los-actions los-resource-actions' });
  if (resource.canOpen && deps.renderer.openResource) {
    button(actions, 'Open', () => deps.renderer.openResource?.(resource), 'quiet');
  } else if (route?.canOpen) {
    button(actions, 'Open', () => deps.plugin.openResource(route.record), 'quiet');
  } else if (source && hasDirectResourceTarget(source) && deps.renderer.openSourceResource) {
    // A locator-only placement ("chapter 3") still reaches its openable source.
    button(actions, 'Open source', () => deps.renderer.openSourceResource?.(source), 'quiet');
  }
  if (resource.sourceId && deps.renderer.rateResource) {
    const sourceId = resource.sourceId;
    const resourceId = resource.id;
    const rate = (verdict: string) => deps.renderer.rateResource?.(sourceId, resourceId, verdict);
    overflowMenu(actions, [
      ['Helpful', () => rate('helpful')],
      ['Too advanced', () => rate('too-advanced')],
      ['Useful for review', () => rate('useful-for-review')],
    ], resourceId ? `Rate ${resource.label}` : `Rate ${resource.label} (whole source)`);
  }
  options.actions?.(actions);
  return card;
}

/** A route the lecture (or the wider module) offers, in the same card shape. */
export function renderRouteCard(
  parent: HTMLElement,
  option: MaterialOptionView,
  source: ProjectionRecord | null,
  deps: MaterialCardDeps,
  options: CardOptions = {},
): HTMLElement {
  const card = parent.createDiv({ cls: 'los-resource-row los-material-card los-source-entry los-triage-unranked' });
  icon(card.createSpan({ cls: 'los-material-card-icon' }), materialTypeIcon(option.format));
  const copy = card.createDiv({ cls: 'los-resource-copy' });
  copy.createDiv({ cls: 'los-material-purpose', text: purposeLabel(option.depth) });
  copy.createEl('strong', { cls: 'los-material-title', text: option.title });
  const meta = copy.createDiv({ cls: 'los-resource-row-meta' });
  meta.createSpan({ cls: 'los-material-kind', text: materialKind(option.record, option, '') });
  if (option.locator) meta.createSpan({ cls: 'los-micro los-resource-locator', text: option.locator });
  for (const badge of options.badges ?? []) meta.createSpan({ cls: 'los-micro los-resource-badge', text: badge });
  if (option.selected) meta.createSpan({ cls: 'los-micro los-resource-chosen', text: 'Chosen for this lecture' });
  if (source) chip(meta, source, deps.renderer.openSource);
  if (option.angle) copy.createDiv({ cls: 'los-resource-angle', text: option.angle });
  renderMaterialCautions(copy, option.record);
  renderAvailability(copy, projectedAvailability(option.record), option, deps);
  renderSpan(copy, deps, option.routeId);
  // Coverage belongs with the rationale: both answer "why this one", and the
  // owning lecture's node titles are what make it readable.
  const coverage = options.coverage?.length ? `Covers: ${options.coverage.join(' · ')}` : '';
  const rationale = [asText(option.record.angle_detail), coverage].filter(Boolean).join('\n\n');
  if (rationale) whyThisOne(copy, rationale);
  const actions = card.createDiv({ cls: 'los-actions los-resource-actions' });
  if (option.canOpen) button(actions, 'Open', () => deps.plugin.openResource(option.record), 'quiet');
  options.actions?.(actions);
  return card;
}

/** A small guard so a card action never fails silently. */
export function reportFailure(error: unknown): void {
  new Notice(errorMessage(error));
}
