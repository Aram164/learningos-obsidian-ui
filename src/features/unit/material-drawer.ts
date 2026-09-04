import { App, Modal, Notice } from 'obsidian';

import { makeModalAccessible } from '../../accessibility/modal';
import { asText as projectedText } from '../../projection/readers';
import {
  button,
  empty,
  filterTabs,
  pageHeader,
  section,
} from '../../components';
import {
  renderStageResources,
  type StageResourceRenderer,
  type StageResourceView,
} from '../stage-resources';
import type {
  MaterialOptionView,
  StageRecordView,
  UnitPlugin,
  UnitRecordView,
} from './model';

/**
 * The three questions a learner is actually asking when they stop and compare.
 *
 * These are a **lens over fields the producer already authored** — `depth` and
 * `format` on a projected route — not a new axis and not a ranking the system
 * invents. Switching lens changes which source is offered first; it never
 * changes a locator, an angle, or what the complete menu contains.
 */
const NEEDS = [
  ['derivation', 'Derivation'],
  ['intuition', 'Intuition'],
  ['practice', 'Practice'],
] as const;

type Need = typeof NEEDS[number][0];

const PRACTICE_FORMATS = new Set([
  'exercise', 'practice', 'practise', 'problem-set', 'homework', 'quiz',
]);

function matchesNeed(option: MaterialOptionView, need: Need): boolean {
  const depth = option.depth.toLowerCase();
  const format = option.format.toLowerCase();
  if (need === 'practice') {
    return PRACTICE_FORMATS.has(format) || depth.includes('practice');
  }
  return depth.includes(need);
}

export interface MaterialComparisonOptions {
  readonly plugin: UnitPlugin;
  readonly unit: UnitRecordView;
  readonly stage: StageRecordView;
  readonly resources: readonly StageResourceView[];
  readonly materialOptions: readonly MaterialOptionView[];
  readonly expectedRevisions: Readonly<Record<string, number>>;
  readonly renderer: StageResourceRenderer;
  /** Re-render the surface behind the drawer once a choice is confirmed. */
  readonly onChanged: () => void;
}

/**
 * "Choose learning material" — the comparison drawer (Figma 05 · 36:12).
 *
 * The stage screen shows one required action; this is where the rest of the
 * catalogue lives. It is a drawer rather than an inline disclosure because it
 * is a decision surface with its own heading, its own controls and its own
 * honesty note, and because a route-registered overlay gives Escape and Back
 * something to restore — the same pattern the project "Why this is linked"
 * drawer already uses.
 *
 * What must survive the move, from the design's own contract:
 *
 *   * every material stays reachable **and countable** — the complete menu is
 *     unfiltered and states its own total;
 *   * source value, angle, exact locator, coverage, depth and scope all
 *     survive;
 *   * one filled action per context — `Choose` is the only one here, and the
 *     stage screen's `Complete stage` is not on screen at the same time;
 *   * no invented schedule, mastery or recommendation. The "recommended" card
 *     is recommended *for the selected need*, by the producer's own `depth`
 *     field, and says so.
 */
export class MaterialComparisonModal extends Modal {
  private readonly options: MaterialComparisonOptions;
  private need: Need = 'derivation';
  private restoreAccessibility: (() => void) | null = null;
  /** Whether this draw is the first one, or a redraw after a lens switch. */
  private opening = true;
  /** The lens control, so a redraw can hand focus back to the pressed tab. */
  private lensRow: HTMLElement | null = null;

  constructor(app: App, options: MaterialComparisonOptions) {
    super(app);
    this.options = options;
  }

  onOpen(): void {
    this.options.plugin.router.openOverlay({
      kind: 'material-comparison',
      unitId: this.options.unit.id,
      stageId: this.options.stage.id,
    });
    this.draw();
  }

  onClose(): void {
    this.options.plugin.router.clearOverlay();
    this.restoreAccessibility?.();
    this.restoreAccessibility = null;
    this.contentEl.empty();
  }

  /** Full redraw. The lens is the only state, and it changes rarely. */
  private draw(): void {
    const root = this.contentEl;
    const { unit, stage, resources, materialOptions, renderer } = this.options;

    this.restoreAccessibility?.();
    this.restoreAccessibility = null;
    root.empty();
    root.addClass('los-root', 'los-material-drawer');

    pageHeader(
      root,
      'Source comparison',
      'Choose learning material',
      'Every source stays available. Ranking changes with the learning need; '
      + 'provenance and locators do not.',
      'los-material-drawer-heading',
    );

    this.lensRow = null;
    if (materialOptions.length) this.renderNeedLenses(root);

    renderStageResources(root, resources, {
      ...renderer,
      title: `Complete menu · ${resources.length} `
        + `${resources.length === 1 ? 'material' : 'materials'} for ${stage.title}`,
    });

    root.createEl('p', {
      cls: 'los-micro los-material-drawer-note',
      text:
        'A selection changes the current route only; it never deletes or hides '
        + 'the complete source record.',
    });

    const actions = root.createDiv({ cls: 'los-actions' });
    const close = button(actions, 'Close', () => this.close(), 'quiet');

    this.restoreAccessibility = makeModalAccessible(root, {
      close: () => this.close(),
      hostClass: 'los-modal--material-drawer',
      labelledBy: 'los-material-drawer-heading',
    });

    /* On open, focus the dismissal, as every dialog in this app does. On a
     * lens switch the learner is *at* the lens, so focus goes back to the tab
     * they just pressed — a full redraw that dumps focus at the bottom of the
     * drawer would make the control unusable from the keyboard. */
    this.restoreFocus(close);
    this.opening = true;

    void unit;
  }

  /** Kept out of `draw()` so control-flow narrowing on `lensRow` does not
   *  collapse the type the moment the field is reset for a redraw. */
  private restoreFocus(close: HTMLElement): void {
    if (this.opening) {
      close.focus();
      return;
    }
    const tabs = Array.from(this.lensRow?.children ?? []) as HTMLElement[];
    const current = tabs.find(
      (tab) => tab.getAttribute?.('aria-pressed') === 'true',
    );
    (current ?? close).focus();
  }

  private renderNeedLenses(root: HTMLElement): void {
    const { materialOptions } = this.options;

    const lens = root.createDiv({ cls: 'los-material-need' });
    lens.createSpan({ cls: 'los-micro los-material-need-label', text: 'I need' });
    this.lensRow = filterTabs<Need>(
      lens,
      'Learning need',
      NEEDS,
      this.need,
      (value) => {
        this.need = value;
        this.opening = false;
        this.draw();
      },
      (value) => materialOptions.filter(
        (option) => matchesNeed(option, value),
      ).length,
    ) as HTMLElement;

    const matching = materialOptions.filter(
      (option) => matchesNeed(option, this.need),
    );
    const label = NEEDS.find(([value]) => value === this.need)?.[1] ?? this.need;

    // A selection the learner already made outranks position in the list; it is
    // the only ordering signal here that came from a person.
    const recommended = matching.find((option) => option.selected)
      ?? matching[0]
      ?? null;

    if (recommended) {
      this.renderRecommended(root, recommended, label);
    } else {
      // Honest absence. Promoting the nearest thing instead would be the system
      // inventing a recommendation the producer never authored.
      empty(
        root,
        `No source is recorded as a ${label.toLowerCase()} route`,
        'Every source for this unit is still listed below, under the angle its '
        + 'producer gave it.',
      );
    }

    /* Everything the lens did not promote — not only what matched it.
     *
     * The lens changes which source is offered first. It must not change which
     * sources exist, or "compare all" would quietly become "compare some" and
     * a material would be unreachable at the exact moment the learner went
     * looking for it. Figma's own alternatives are drawn from other needs for
     * this reason: an "if stuck" card sits beside a "practice" one. */
    const alternatives = materialOptions.filter(
      (option) => option !== recommended,
    );
    if (alternatives.length) this.renderAlternatives(root, alternatives);
  }

  /**
   * Everything the design's contract says must survive the move: value, angle,
   * exact locator, coverage, depth and scope. All six are producer-authored
   * fields read back — the card ranks nothing and adds nothing.
   */
  private renderRecommended(
    root: HTMLElement,
    option: MaterialOptionView,
    needLabel: string,
  ): void {
    const card = root.createDiv({ cls: 'los-material-recommended' });
    card.createDiv({
      cls: 'los-kicker',
      text: `Recommended for ${needLabel.toLowerCase()}`,
    });
    card.createEl('h3', { text: option.title });

    if (option.angle) {
      card.createEl('p', {
        cls: 'los-material-recommended-line',
        text: `Value · ${option.angle}`,
      });
    }
    const detail = projectedText(option.record.angle_detail);
    if (detail) {
      card.createEl('p', {
        cls: 'los-material-recommended-line',
        text: `Angle · ${detail}`,
      });
    }
    card.createEl('p', {
      cls: 'los-material-recommended-line',
      text: `Depth · ${option.depth} · scope ${option.scope}`,
    });
    if (option.locator) {
      card.createEl('p', {
        cls: 'los-micro los-material-recommended-locator',
        text: `Locator · ${option.locator}`,
      });
    }
    this.renderCoverage(card, option);

    const actions = card.createDiv({ cls: 'los-actions los-material-actions' });
    this.renderChoose(actions, option);
    if (option.canOpen) {
      button(
        actions,
        'Open',
        () => this.options.plugin.openResource(option.record),
        'info',
      );
    }
  }

  /** Which knowledge-map nodes this route covers, by their authored titles. */
  private renderCoverage(
    card: HTMLElement,
    option: MaterialOptionView,
  ): void {
    const titleById = new Map(
      this.options.unit.knowledgeNodes.map((node) => [node.id, node.title]),
    );
    const labels = option.covers
      .map((id) => titleById.get(id))
      .filter((label): label is string => Boolean(label));
    if (!labels.length) return;

    const covers = card.createDiv({ cls: 'los-material-metadata' });
    for (const label of labels) {
      covers.createSpan({ cls: 'los-knowledge-chip', text: label });
    }
  }

  private renderAlternatives(
    root: HTMLElement,
    alternatives: readonly MaterialOptionView[],
  ): void {
    const wrap = section(
      root,
      'Useful alternatives',
      'Different angle — not duplicates.',
    ) as HTMLElement;
    const grid = wrap.createDiv({ cls: 'los-material-alternatives' });

    for (const option of alternatives) {
      const card = grid.createDiv({ cls: 'los-material-alternative' });
      /* Name the need this route serves, so the alternatives read as different
       * angles rather than as also-rans. Falls back to the producer's scope
       * when the route matches no lens — inventing a need for it would be the
       * one thing this drawer must not do. */
      const serves = NEEDS.find(([value]) => matchesNeed(option, value))?.[1];
      card.createDiv({
        cls: 'los-kicker',
        text: serves ?? (option.scope || option.depth),
      });
      card.createEl('h4', { text: option.title });
      if (option.angle) card.createEl('p', { text: option.angle });
      if (option.locator) {
        card.createEl('p', {
          cls: 'los-micro',
          text: option.locator,
        });
      }
      this.renderCoverage(card, option);
      const actions = card.createDiv({
        cls: 'los-actions los-material-actions',
      });
      this.renderChoose(actions, option);
    }
  }

  /**
   * The governed selection, unchanged.
   *
   * Same capability, same guard, same payload as the unit material menu has
   * always sent — `unit.source-selection.set` carrying the route, source,
   * locator and the angle as its purpose. The redesign moved where this button
   * lives; it did not become a second way to write.
   */
  private renderChoose(
    actions: HTMLElement,
    option: MaterialOptionView,
  ): void {
    if (!option.canChoose || !option.sourceId || !option.locator) return;
    const { plugin, unit, expectedRevisions, onChanged } = this.options;

    const choice = button(
      actions,
      option.selected ? 'Remove choice' : 'Choose',
      () => {
        void plugin.mutate(
          () => plugin.gateway.sourceSelection(
            unit.id,
            option.routeId,
            option.sourceId ?? '',
            option.locator ?? '',
            option.angle,
            !option.selected,
            expectedRevisions,
          ),
        ).then(() => {
          new Notice(
            option.selected
              ? 'Material choice removed.'
              : 'Material chosen for this lecture.',
          );
          onChanged();
          this.close();
        }).catch((error: unknown) => {
          new Notice(error instanceof Error ? error.message : String(error));
        });
      },
      'choice',
    );
    choice.setAttr('aria-pressed', option.selected ? 'true' : 'false');
  }
}
