import { Notice } from 'obsidian';
import { badge, button, chip } from '../../components';
import type {
  AbilityClaimDraft,
  AbilityConnectionDraft,
} from '../../application/ability-drafts';
import type { AbilityDefinitionV1, AbilityRowV1 } from '../../contracts/ability-context';
import { isRecord, asString, errorMessage } from '../../projection/readers';
import { newGatewayIdentity } from '../../gateway-client';
import {
  candidatePayload,
  claimProblems,
  connectionProblems,
  isUnassisted,
  observationPayload,
  RESULT_LABEL,
  unresolvedConditions,
} from '../abilities/claims';
import {
  AbilityClaimDraftModal,
  AbilityConnectionDraftModal,
} from '../abilities/draft-modals';
import { abilityWorkPointers, abilityWorkspaces } from '../abilities/detail';
import { bridgeSymbol, sentence } from '../abilities/model';
import { categoryLabel, type ReviewEntry } from './queue';
import type { ReviewHost } from './ports';

function part(parent: HTMLElement, title: string): HTMLElement {
  const block = parent.createDiv({ cls: 'los-review-part' });
  block.createEl('h3', { text: title });
  return block;
}

function rule(parent: HTMLElement): void {
  parent.createDiv({ cls: 'los-review-rule', attr: { 'aria-hidden': 'true' } });
}

function definitionFor(host: ReviewHost, abilityId: string): AbilityDefinitionV1 | null {
  const expansion = host.plugin.abilityHorizon.expansion(abilityId);
  return expansion && 'ability' in expansion ? expansion.ability : null;
}

function rowFor(host: ReviewHost, abilityId: string): AbilityRowV1 | null {
  return host.plugin.abilityHorizon.current()?.abilities.find((row) => row.id === abilityId) ?? null;
}

/** Selecting a draft is enough to make Review ask Core for what it needs. */
function ensureAbility(host: ReviewHost, abilityId: string): void {
  host.plugin.abilityHorizon.ensure();
  if (host.plugin.abilityHorizon.current()) host.plugin.abilityHorizon.ensureExpansion(abilityId);
}

function problemList(parent: HTMLElement, problems: readonly string[]): void {
  if (!problems.length) return;
  const box = parent.createDiv({ cls: 'los-review-problems', attr: { role: 'note' } });
  box.createEl('strong', { text: 'Before it can be recorded' });
  const list = box.createEl('ul');
  for (const problem of problems) list.createEl('li', { text: problem });
}

async function send(host: ReviewHost, action: () => Promise<unknown>, done: string): Promise<boolean> {
  if (host.sending) return false;
  host.sending = true;
  host.render();
  try {
    await host.plugin.mutate(action);
    new Notice(done);
    return true;
  } catch (error: unknown) {
    new Notice(errorMessage(error));
    return false;
  } finally {
    host.sending = false;
    host.render();
  }
}

function editClaim(host: ReviewHost, draft: AbilityClaimDraft): void {
  const row = rowFor(host, draft.abilityId)
    ?? { id: draft.abilityId, title: draft.abilityTitle, lifecycle: 'active', state: 'uncertain', reasons: [], concept_ids: [],
      module_ids: [], preparation_routes: [], transfer: [], evidence: [] } as AbilityRowV1;
  const expansion = host.plugin.abilityHorizon.expansion(draft.abilityId);
  const focus = expansion && 'ability' in expansion ? expansion : null;
  new AbilityClaimDraftModal(host.app, {
    ability: row,
    definition: focus?.ability ?? null,
    workspaces: abilityWorkspaces(host.plugin.store, row),
    workPointers: abilityWorkPointers(host.plugin.store, focus),
    existing: draft,
    save: (next) => host.plugin.saveAbilityDraft(next),
    onSaved: () => host.render(),
  }).open();
}

function editConnection(host: ReviewHost, draft: AbilityConnectionDraft): void {
  const brief = host.plugin.abilityHorizon.current();
  const from = brief?.abilities.find((row) => row.id === draft.fromAbility);
  if (!brief || !from) {
    new Notice('The ability map is not loaded, so this connection cannot be edited yet.');
    return;
  }
  new AbilityConnectionDraftModal(host.app, {
    from,
    candidates: brief.abilities,
    existing: draft,
    save: (next) => host.plugin.saveAbilityDraft(next),
    onSaved: () => host.render(),
  }).open();
}

function drop(host: ReviewHost, id: string): void {
  host.plugin.discardAbilityDraft(id);
  host.select(null);
  new Notice('Draft dropped. Nothing was recorded.');
}

function renderClaimDraft(parent: HTMLElement, host: ReviewHost, draft: AbilityClaimDraft): void {
  ensureAbility(host, draft.abilityId);
  const definition = definitionFor(host, draft.abilityId);
  const row = rowFor(host, draft.abilityId);
  const workspaces = row ? abilityWorkspaces(host.plugin.store, row) : [];
  const horizonReady = Boolean(host.plugin.abilityHorizon.current());
  const loading = horizonReady && !definition
    && !host.plugin.abilityHorizon.expansionError(draft.abilityId);

  parent.createDiv({ cls: 'los-review-eyebrow', text: `Worked attempt · draft${draft.supersedes ? ' · correction' : ''}` });
  parent.createEl('h2', { text: draft.abilityTitle });
  if (draft.activity.trim()) parent.createEl('p', { cls: 'los-review-lede', text: draft.activity });
  rule(parent);

  const claim = part(parent, 'Claim to record');
  claim.createDiv({ cls: 'los-review-claim', text: draft.claim.trim() || 'No claim written yet.' });
  const facts = claim.createDiv({ cls: 'los-review-facts' });
  facts.createSpan({ text: draft.result ? `Result: ${RESULT_LABEL[draft.result]}` : 'Result: not chosen' });
  facts.createSpan({
    text: `Assistance: ${draft.assistance.trim() ? draft.assistance.trim() : 'not stated'}${
      draft.assistance.trim() && !isUnassisted(draft.assistance) ? ' — not independent work' : ''}`,
  });

  const shows = part(parent, 'What the attempt shows');
  if (draft.evidenceTags.length) {
    const list = shows.createEl('ul');
    for (const tag of draft.evidenceTags) list.createEl('li', { text: tag });
  } else {
    shows.createEl('p', { cls: 'los-micro', text: 'No evidence criterion marked.' });
  }
  const missing = definition?.evidence_spec.filter((tag) => !draft.evidenceTags.includes(tag)) ?? [];
  if (missing.length && draft.result === 'correct') {
    shows.createEl('p', {
      cls: 'los-micro',
      text: `Core counts a correct attempt as support only when it shows every criterion; missing: ${missing.join('; ')}.`,
    });
  }
  const conditions = [
    ...draft.conditionsMet.map((condition) => `Met: ${condition}`),
    ...draft.conditionsNotMet.map((condition) => `Not met: ${condition}`),
  ];
  if (conditions.length) {
    const list = shows.createEl('ul', { cls: 'los-review-conditions' });
    for (const condition of conditions) list.createEl('li', { text: condition });
  }
  const unanswered = unresolvedConditions(draft, definition);
  if (unanswered.length) {
    shows.createEl('p', {
      cls: 'los-review-problems',
      text: `Not sure: ${unanswered.join('; ')}. Core will record this attempt, but it cannot support this ability while a stated condition is unanswered.`,
    });
  }

  const evidence = part(parent, 'Evidence');
  const work = draft.workRef.trim();
  if (work.startsWith('curriculum/')) {
    button(evidence, `${work} →`, () => host.plugin.openAuthoredPath(work.split('#')[0] ?? work), 'tertiary')
      .addClass('los-review-pointer');
  } else {
    evidence.createDiv({ cls: 'los-review-pointer-text', text: work || 'No work pointer yet.' });
  }
  rule(parent);

  const effect = part(parent, 'After confirmation');
  const workspace = workspaces.find((row2) => row2.id === draft.workspace);
  effect.createEl('p', {
    text: `Records one learner-confirmed observation for this ability in ${workspace?.title ?? (draft.workspace || 'no workspace')}. `
      + 'Core recomputes the ability’s state from it. Stage completion stays a separate action.',
  });
  if (draft.supersedes) {
    effect.createEl('p', { cls: 'los-micro', text: `Supersedes ${draft.supersedes}; that record stays visible.` });
  }
  effect.createEl('p', {
    cls: 'los-micro',
    text: 'The confirmation pointer is this app request (conversation://learningos-app/…), so the receipt is the confirmation.',
  });

  const problems = loading ? [] : claimProblems(draft, {
    ability: definition,
    workspaces: workspaces.map((row2) => row2.id),
  });
  if (!horizonReady) {
    parent.createEl('p', { cls: 'los-micro', text: host.plugin.abilityHorizon.error ?? 'Reading the ability map from Core…' });
  } else if (loading) {
    parent.createEl('p', { cls: 'los-micro', text: 'Reading this ability’s conditions from Core…' });
  }
  problemList(parent, problems);
  rule(parent);

  const actions = parent.createDiv({ cls: 'los-actions los-review-actions' });
  const confirm = button(actions, host.sending ? 'Recording…' : 'Confirm & record', () => {
    const current = host.plugin.listAbilityDrafts().find((row2) => row2.id === draft.id);
    if (!current || current.kind !== 'claim' || current.updatedAt !== draft.updatedAt) {
      new Notice('The draft changed; review it again before confirming.');
      host.render();
      return;
    }
    const identity = newGatewayIdentity('learner.ability-observation.append');
    const payload = observationPayload(current, identity.idempotencyKey);
    const guard = host.plugin.store.artifactGuard(current.workspace);
    void send(
      host,
      () => host.plugin.gateway.recordAbilityObservation(payload, identity, guard),
      'Recorded. Core recomputed this ability’s state.',
    ).then((recorded) => {
      if (!recorded) return;
      host.plugin.discardAbilityDraft(current.id, current.updatedAt);
      host.select(null);
      void host.plugin.abilityHorizon.refresh();
    });
  }, 'cta');
  confirm.disabled = host.sending || loading || !horizonReady || problems.length > 0;
  button(actions, 'Edit', () => editClaim(host, draft), 'quiet').disabled = host.sending;
  button(actions, 'Not this', () => drop(host, draft.id), 'tertiary').disabled = host.sending;
}

function renderConnectionDraft(parent: HTMLElement, host: ReviewHost, draft: AbilityConnectionDraft): void {
  host.plugin.abilityHorizon.ensure();
  const brief = host.plugin.abilityHorizon.current();
  parent.createDiv({ cls: 'los-review-eyebrow', text: 'Possible connection · draft' });
  parent.createEl('h2', { text: `${draft.fromTitle} ${bridgeSymbol(draft.connection)} ${draft.toTitle}` });
  parent.createEl('p', { cls: 'los-review-lede', text: `A tentative ${draft.connection} you noticed.` });
  rule(parent);
  const claim = part(parent, 'Connection to record');
  claim.createDiv({ cls: 'los-review-claim', text: draft.carries.trim() || 'Nothing written about what carries over.' });
  const differs = part(parent, 'What still differs');
  differs.createEl('p', { text: draft.changes.trim() || 'Not written yet.' });
  if (draft.conditions.length) {
    const list = differs.createEl('ul', { cls: 'los-review-conditions' });
    for (const condition of draft.conditions) list.createEl('li', { text: `Only under: ${condition}` });
  }
  const evidence = part(parent, 'Evidence');
  evidence.createDiv({
    cls: 'los-review-pointer-text',
    text: draft.sourceRef.trim() || 'Noticed in this app — the request that records it is named as the source.',
  });
  rule(parent);
  const effect = part(parent, 'After confirmation');
  effect.createEl('p', {
    text: 'Records a tentative connection. It carries no evidence and changes no ability state or readiness; only an operator review can turn it into a bridge.',
  });
  const problems = brief ? connectionProblems(draft, brief) : [];
  if (!brief) {
    parent.createEl('p', { cls: 'los-micro', text: host.plugin.abilityHorizon.error ?? 'Reading the ability map from Core…' });
  }
  problemList(parent, problems);
  rule(parent);
  const actions = parent.createDiv({ cls: 'los-actions los-review-actions' });
  const confirm = button(actions, host.sending ? 'Recording…' : 'Confirm & record', () => {
    const current = host.plugin.listAbilityDrafts().find((row) => row.id === draft.id);
    if (!current || current.kind !== 'connection' || current.updatedAt !== draft.updatedAt) {
      new Notice('The draft changed; review it again before confirming.');
      host.render();
      return;
    }
    const identity = newGatewayIdentity('ability.candidate.append');
    const payload = candidatePayload(current, identity.idempotencyKey);
    const guard = host.plugin.store.artifactGuard('ability-candidates');
    void send(
      host,
      () => host.plugin.gateway.recordAbilityCandidate(payload, identity, guard),
      'Recorded as a tentative connection. It carries nothing until reviewed.',
    ).then((recorded) => {
      if (!recorded) return;
      host.plugin.discardAbilityDraft(current.id, current.updatedAt);
      host.select(null);
      void host.plugin.abilityHorizon.refresh();
    });
  }, 'cta');
  confirm.disabled = host.sending || !brief || problems.length > 0;
  button(actions, 'Edit', () => editConnection(host, draft), 'quiet').disabled = host.sending;
  button(actions, 'Not this', () => drop(host, draft.id), 'tertiary').disabled = host.sending;
}

function renderConflict(parent: HTMLElement, host: ReviewHost, row: AbilityRowV1): void {
  parent.createDiv({ cls: 'los-review-eyebrow', text: 'Conflicting attempts · Core' });
  parent.createEl('h2', { text: row.title });
  rule(parent);
  const claim = part(parent, 'What Core says');
  for (const reason of row.reasons) claim.createEl('p', { text: sentence(reason) });
  const evidence = part(parent, 'Evidence');
  if (!row.evidence.length) evidence.createEl('p', { cls: 'los-micro', text: 'The ledger is in the ability detail.' });
  for (const item of row.evidence) {
    evidence.createDiv({ cls: 'los-review-pointer-text', text: `${RESULT_LABEL[item.result]} · ${item.work_ref}` });
  }
  rule(parent);
  const effect = part(parent, 'Effect');
  effect.createEl('p', {
    text: 'The ability stays uncertain while later work disagrees. A correction supersedes one record and keeps it visible; new confirmed work is judged on its own.',
  });
  rule(parent);
  const actions = parent.createDiv({ cls: 'los-actions los-review-actions' });
  button(actions, 'Open the ability', () => host.plugin.nav.openAbilities({ ability: row.id, detail: true }), 'quiet');
}

function coreAction(host: ReviewHost, target: Record<string, unknown> | null): [string, () => unknown] | null {
  if (!target) return null;
  const kind = asString(target.kind) ?? '';
  const unitId = asString(target.unit_id);
  const id = asString(target.id);
  const path = asString(target.path);
  if (kind === 'study-map' && unitId) return ['Review proposal', () => host.plugin.nav.openShelving(unitId)];
  if (kind === 'inbox-item' && path) return ['Route', () => host.plugin.openVaultPath(path)];
  if (kind === 'unit' && id) return ['Open unit', () => host.plugin.nav.openUnit(id)];
  if (kind === 'garden-note' || kind === 'garden-seed') return ['Review seed', () => host.plugin.nav.openGarden()];
  return null;
}

const CORE_EFFECT: Readonly<Record<string, string>> = {
  planning: 'Opening the unit shows its material and the reviewed-map import. Nothing changes until a reviewed map is imported.',
  inbox: 'Opens the capture so you can route it. Nothing is filed for you.',
  shelving: 'Opens the shelving review. Only the proposal items you select are applied.',
  garden: 'Opens the Garden. A seed changes only through its own reviewed actions.',
};

function renderCore(parent: HTMLElement, host: ReviewHost, entry: Extract<ReviewEntry, { kind: 'core' }>): void {
  parent.createDiv({ cls: 'los-review-eyebrow', text: `${categoryLabel(entry.category)} · Core decision` });
  parent.createEl('h2', { text: entry.title });
  const context = asString(entry.item.context);
  if (context) parent.createEl('p', { cls: 'los-review-lede', text: context });
  rule(parent);
  const claim = part(parent, 'Decision');
  claim.createDiv({ cls: 'los-review-claim', text: entry.reason || 'Core recorded no reason.' });
  const evidence = part(parent, 'Evidence');
  const target = isRecord(entry.item.target) ? entry.item.target : null;
  const targetId = asString(target?.unit_id) ?? asString(target?.id);
  const record = targetId ? host.plugin.store.get(targetId) : null;
  if (record) chip(evidence, record);
  const path = asString(target?.path);
  if (path) evidence.createDiv({ cls: 'los-review-pointer-text', text: path });
  const proposals = Array.isArray(target?.proposal_ids) ? target?.proposal_ids.length ?? 0 : 0;
  if (proposals) evidence.createDiv({ cls: 'los-micro', text: `${proposals} proposed ${proposals === 1 ? 'item' : 'items'}` });
  if (!record && !path) evidence.createEl('p', { cls: 'los-micro', text: 'The target is named in the decision above.' });
  rule(parent);
  const effect = part(parent, 'Effect');
  effect.createEl('p', { text: CORE_EFFECT[entry.category] ?? 'Opens the place where this decision is made.' });
  rule(parent);
  const actions = parent.createDiv({ cls: 'los-actions los-review-actions' });
  const action = coreAction(host, target);
  if (action) button(actions, action[0], action[1], 'quiet');
  else actions.createSpan({ cls: 'los-micro', text: 'No supported action' });
}

/** One selected item: its claim, evidence, effect and actions (Figma B2). */
export function renderReviewEntry(parent: HTMLElement, host: ReviewHost, entry: ReviewEntry): void {
  const pane = parent.createEl('section', {
    cls: `los-review-detail is-${entry.kind}`,
    attr: { 'aria-label': entry.title, 'data-review-id': entry.key },
  });
  if (entry.kind === 'claim-draft') renderClaimDraft(pane, host, entry.draft);
  else if (entry.kind === 'connection-draft') renderConnectionDraft(pane, host, entry.draft);
  else if (entry.kind === 'ability-conflict') renderConflict(pane, host, entry.row);
  else renderCore(pane, host, entry);
  if (entry.kind === 'claim-draft' || entry.kind === 'connection-draft') {
    badge(pane, 'Not recorded', 'role').addClass('los-review-draft-badge');
  }
}
