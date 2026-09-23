import { Modal, Notice, type App } from 'obsidian';
import { makeModalAccessible } from '../../accessibility/modal';
import { button } from '../../components';
import {
  newAbilityDraftId,
  type AbilityClaimDraft,
  type AbilityConnectionDraft,
  type AbilityDraft,
} from '../../application/ability-drafts';
import type {
  AbilityBridgeKindV1,
  AbilityDefinitionV1,
  AbilityResultV1,
  AbilityRowV1,
} from '../../contracts/ability-context';
import { composedClaim, RESULT_LABEL } from './claims';

/** A pointer the claim form offers because Aram's own stage work lives there. */
export interface WorkPointerOption {
  readonly value: string;
  readonly label: string;
}

export interface ClaimDraftOptions {
  readonly ability: AbilityRowV1;
  /** The expanded identity, when read — its conditions and criteria. */
  readonly definition: AbilityDefinitionV1 | null;
  readonly workspaces: ReadonlyArray<{ readonly id: string; readonly title: string }>;
  readonly workPointers: readonly WorkPointerOption[];
  /** Editing keeps the draft's identity; a new draft gets a fresh one. */
  readonly existing: AbilityClaimDraft | null;
  /** A correction supersedes exactly one earlier observation. */
  readonly supersedes?: string | null;
  save(draft: AbilityDraft): void;
  onSaved?(draft: AbilityDraft): void;
}

export interface ConnectionDraftOptions {
  readonly from: AbilityRowV1;
  readonly candidates: readonly AbilityRowV1[];
  readonly existing: AbilityConnectionDraft | null;
  save(draft: AbilityDraft): void;
  onSaved?(draft: AbilityDraft): void;
}

const RESULTS: readonly AbilityResultV1[] = ['correct', 'partial', 'incorrect', 'abandoned'];

const CONNECTION_KINDS: ReadonlyArray<readonly [AbilityBridgeKindV1, string]> = [
  ['connection', 'Related — they connect'],
  ['extension', 'Extension — one builds on the other'],
  ['equivalence', 'Equivalent — the same ability in another course'],
];

let fieldSequence = 0;

function field(parent: HTMLElement, label: string, hint = ''): { wrap: HTMLElement; id: string } {
  fieldSequence += 1;
  const id = `los-ability-field-${fieldSequence}`;
  const wrap = parent.createDiv({ cls: 'los-ability-form-field' });
  wrap.createEl('label', { cls: 'los-ability-form-label', text: label, attr: { for: id } });
  if (hint) wrap.createDiv({ cls: 'los-micro los-ability-form-hint', text: hint });
  return { wrap, id };
}

function textInput(parent: HTMLElement, label: string, value: string, placeholder = '', hint = ''): HTMLInputElement {
  const { wrap, id } = field(parent, label, hint);
  const input = wrap.createEl('input', {
    cls: 'los-ability-form-input',
    attr: { type: 'text', id, placeholder, value },
  });
  input.value = value;
  return input;
}

function textArea(parent: HTMLElement, label: string, value: string, placeholder = '', hint = ''): HTMLTextAreaElement {
  const { wrap, id } = field(parent, label, hint);
  const area = wrap.createEl('textarea', {
    cls: 'los-ability-form-textarea',
    attr: { id, placeholder, rows: '3' },
  });
  area.value = value;
  return area;
}

function select(
  parent: HTMLElement,
  label: string,
  options: ReadonlyArray<readonly [string, string]>,
  value: string,
  hint = '',
): HTMLSelectElement {
  const { wrap, id } = field(parent, label, hint);
  const control = wrap.createEl('select', { cls: 'los-ability-form-select', attr: { id } });
  for (const [optionValue, optionLabel] of options) {
    control.createEl('option', { text: optionLabel, attr: { value: optionValue } });
  }
  control.value = value;
  return control;
}

function now(): string {
  return new Date().toISOString();
}

/**
 * Draft one worked attempt against one ability.
 *
 * Saving writes nothing to Core. The draft waits in Review, where the exact
 * record is shown beside "Confirm & record" — the only control that sends it.
 */
export class AbilityClaimDraftModal extends Modal {
  private restore: (() => void) | null = null;
  constructor(app: App, private readonly options: ClaimDraftOptions) { super(app); }

  onOpen(): void {
    const { ability, definition, existing } = this.options;
    const root = this.contentEl;
    root.empty();
    root.addClass('los-root', 'los-ability-draft');
    root.createDiv({ cls: 'los-kicker', text: existing ? 'Edit draft · not recorded' : 'Draft a worked attempt' });
    const heading = root.createEl('h2', { text: ability.title, attr: { id: 'los-ability-draft-heading' } });
    root.createEl('p', {
      cls: 'los-micro',
      text: 'This saves a draft for Review. Nothing is recorded until you confirm the exact claim there, and completing a stage never records one.',
    });
    if (definition?.claim) {
      const counts = root.createDiv({ cls: 'los-ability-draft-counts' });
      counts.createDiv({ cls: 'los-micro', text: 'What counts' });
      counts.createEl('p', { text: definition.claim });
    }

    const form = root.createDiv({ cls: 'los-ability-form' });
    const workspace = select(
      form,
      'Workspace',
      this.options.workspaces.map((row) => [row.id, row.title] as const),
      existing?.workspace || this.options.workspaces[0]?.id || '',
      this.options.workspaces.length ? 'The active workspace this work belongs to.' : 'No active workspace covers this ability’s modules, so it cannot be recorded yet.',
    );
    const activity = textInput(form, 'What you did', existing?.activity ?? '', 'e.g. worked the Übung 10 backprop exercise');
    const result = select(
      form,
      'What the attempt produced',
      [['', 'Choose…'], ...RESULTS.map((value) => [value, RESULT_LABEL[value]] as const)],
      existing?.result ?? '',
    );
    const assistance = textInput(
      form,
      'Help you had',
      existing?.assistance ?? '',
      'none — or e.g. one hint on σ′(z)',
      'Only “none” counts as independent work.',
    );

    const conditionBoxes = new Map<string, HTMLSelectElement>();
    if (definition?.conditions.length) {
      const block = form.createDiv({ cls: 'los-ability-form-group' });
      block.createDiv({ cls: 'los-ability-form-label', text: 'Conditions' });
      for (const condition of definition.conditions) {
        const state = existing?.conditionsMet.includes(condition)
          ? 'met'
          : existing?.conditionsNotMet.includes(condition) ? 'not-met' : '';
        conditionBoxes.set(condition, select(block, condition, [
          ['', 'Not sure'], ['met', 'Met'], ['not-met', 'Not met'],
        ], state));
      }
    }

    const criteriaBoxes = new Map<string, HTMLInputElement>();
    if (definition?.evidence_spec.length) {
      const block = form.createDiv({ cls: 'los-ability-form-group' });
      block.createDiv({ cls: 'los-ability-form-label', text: 'What the attempt shows' });
      for (const criterion of definition.evidence_spec) {
        const row = block.createEl('label', { cls: 'los-ability-form-check' });
        const box = row.createEl('input', { attr: { type: 'checkbox', 'aria-label': criterion } });
        box.checked = existing?.evidenceTags.includes(criterion) ?? false;
        row.createSpan({ text: criterion });
        criteriaBoxes.set(criterion, box);
      }
    }

    const pointerOptions: Array<readonly [string, string]> = [
      ...this.options.workPointers.map((option) => [option.value, option.label] as const),
      ['', 'Another pointer…'],
    ];
    const knownPointer = this.options.workPointers.some((option) => option.value === existing?.workRef);
    const pointer = select(
      form,
      'Where the work is',
      pointerOptions,
      existing ? (knownPointer ? existing.workRef : '') : (this.options.workPointers[0]?.value ?? ''),
    );
    const otherPointer = textInput(
      form,
      'Other pointer',
      existing && !knownPointer ? existing.workRef : '',
      'curriculum/…, note://…, conversation://… or project://…',
    );
    const syncPointer = () => {
      otherPointer.parentElement?.toggleClass?.('is-hidden', pointer.value !== '');
    };
    pointer.addEventListener('change', syncPointer);
    syncPointer();

    const claim = textArea(
      form,
      'Claim you will confirm',
      existing?.claim ?? '',
      'Filled from the fields above; edit it to say exactly what you did.',
      'Review shows this sentence with the fields under it before anything is recorded.',
    );
    const supersedes = existing?.supersedes ?? this.options.supersedes ?? null;
    if (supersedes) {
      form.createDiv({
        cls: 'los-micro los-ability-form-note',
        text: `Corrects ${supersedes}. The earlier record stays visible; this one supersedes it.`,
      });
    }

    const collect = (): AbilityClaimDraft => {
      const met = [...conditionBoxes].filter(([, box]) => box.value === 'met').map(([condition]) => condition);
      const notMet = [...conditionBoxes].filter(([, box]) => box.value === 'not-met').map(([condition]) => condition);
      const stamp = now();
      return {
        kind: 'claim',
        id: existing?.id ?? newAbilityDraftId('claim'),
        abilityId: ability.id,
        abilityTitle: ability.title,
        workspace: workspace.value,
        activity: activity.value,
        result: RESULTS.includes(result.value as AbilityResultV1) ? result.value as AbilityResultV1 : '',
        assistance: assistance.value,
        conditionsMet: met,
        conditionsNotMet: notMet,
        evidenceTags: [...criteriaBoxes].filter(([, box]) => box.checked).map(([criterion]) => criterion),
        workRef: pointer.value || otherPointer.value.trim(),
        claim: claim.value,
        supersedes,
        createdAt: existing?.createdAt ?? stamp,
        updatedAt: stamp,
      };
    };
    // The composed sentence follows the fields until Aram writes his own.
    let claimEdited = Boolean(existing?.claim);
    const refreshClaim = () => {
      if (claimEdited) return;
      claim.value = composedClaim(collect(), definition);
    };
    refreshClaim();
    for (const control of [result, assistance, ...conditionBoxes.values()]) {
      control.addEventListener('change', refreshClaim);
      control.addEventListener('input', refreshClaim);
    }
    claim.addEventListener('input', () => { claimEdited = true; });

    const actions = root.createDiv({ cls: 'los-actions los-ability-draft-actions' });
    button(actions, existing ? 'Save changes' : 'Save draft', () => {
      const draft = collect();
      this.options.save(draft);
      new Notice('Draft saved. Nothing is recorded until you confirm it in Review.');
      this.close();
      this.options.onSaved?.(draft);
    }, 'cta');
    button(actions, 'Cancel', () => this.close(), 'quiet');
    this.restore = makeModalAccessible(root, {
      close: () => this.close(),
      hostClass: 'los-modal--ability-draft',
      labelledBy: 'los-ability-draft-heading',
      initialFocus: () => activity,
    });
    heading.setAttribute('tabindex', '-1');
  }

  onClose(): void {
    this.restore?.();
    this.restore = null;
    this.contentEl.empty();
  }
}

/**
 * Draft a possible connection between two abilities.
 *
 * Recorded, it becomes a tentative connection: visible in the Atlas, dashed,
 * with no effect on any state until an operator reviews it into a bridge.
 */
export class AbilityConnectionDraftModal extends Modal {
  private restore: (() => void) | null = null;
  constructor(app: App, private readonly options: ConnectionDraftOptions) { super(app); }

  onOpen(): void {
    const { from, candidates, existing } = this.options;
    const root = this.contentEl;
    root.empty();
    root.addClass('los-root', 'los-ability-draft');
    root.createDiv({ cls: 'los-kicker', text: existing ? 'Edit draft · not recorded' : 'Note a possible connection' });
    const heading = root.createEl('h2', { text: from.title, attr: { id: 'los-ability-connection-heading' } });
    root.createEl('p', {
      cls: 'los-micro',
      text: 'A tentative connection carries no evidence and changes no state. It waits for an operator review before it could become a bridge.',
    });
    const form = root.createDiv({ cls: 'los-ability-form' });
    const others = candidates.filter((row) => row.id !== from.id);
    const target = select(
      form,
      'Connects to',
      others.map((row) => [row.id, row.title] as const),
      existing?.toAbility ?? others[0]?.id ?? '',
    );
    const kind = select(form, 'Kind', CONNECTION_KINDS, existing?.connection ?? 'connection');
    const carries = textArea(form, 'What carries over', existing?.carries ?? '', 'e.g. the same local chain-rule step on one graph');
    const changes = textArea(form, 'What still differs', existing?.changes ?? '', 'e.g. AML continues to every layer; SaD stops at one');
    const conditions = textArea(
      form,
      'Under which conditions (one per line)',
      (existing?.conditions ?? []).join('\n'),
      'e.g. specified differentiable graph and loss',
    );
    const source = textInput(
      form,
      'Where you noticed it (optional)',
      existing?.sourceRef ?? '',
      'note://…, conversation://… or project://…',
      'Left empty, the app request that records it is named as where it was noticed.',
    );
    const actions = root.createDiv({ cls: 'los-actions los-ability-draft-actions' });
    button(actions, existing ? 'Save changes' : 'Save draft', () => {
      const stamp = now();
      const to = others.find((row) => row.id === target.value) ?? null;
      const draft: AbilityConnectionDraft = {
        kind: 'connection',
        id: existing?.id ?? newAbilityDraftId('connection'),
        fromAbility: from.id,
        fromTitle: from.title,
        toAbility: to?.id ?? target.value,
        toTitle: to?.title ?? target.value,
        connection: (CONNECTION_KINDS.find(([value]) => value === kind.value)?.[0]) ?? 'connection',
        carries: carries.value,
        changes: changes.value,
        conditions: conditions.value.split('\n').map((line) => line.trim()).filter(Boolean),
        sourceRef: source.value.trim(),
        createdAt: existing?.createdAt ?? stamp,
        updatedAt: stamp,
      };
      this.options.save(draft);
      new Notice('Draft saved. Nothing is recorded until you confirm it in Review.');
      this.close();
      this.options.onSaved?.(draft);
    }, 'cta');
    button(actions, 'Cancel', () => this.close(), 'quiet');
    this.restore = makeModalAccessible(root, {
      close: () => this.close(),
      hostClass: 'los-modal--ability-draft',
      labelledBy: 'los-ability-connection-heading',
      initialFocus: () => target,
    });
    heading.setAttribute('tabindex', '-1');
  }

  onClose(): void {
    this.restore?.();
    this.restore = null;
    this.contentEl.empty();
  }
}
