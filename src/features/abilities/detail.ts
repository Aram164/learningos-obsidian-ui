import { button, empty } from '../../components';
import type {
  AbilityBriefV1,
  AbilityEvidenceV1,
  AbilityFocusV1,
  AbilityRowV1,
} from '../../contracts/ability-context';
import type { ManifestStore } from '../../manifest-store';
import { asLabel, asString, asStrings } from '../../projection/readers';
import {
  bridgeSymbol,
  routeMembers,
  sentence,
  STATE_LABEL,
  type AbilityPlane,
} from './model';
import { RESULT_LABEL } from './claims';
import {
  AbilityClaimDraftModal,
  AbilityConnectionDraftModal,
  type WorkPointerOption,
} from './draft-modals';
import { projectionLabels } from './labels';
import { renderExpansionState } from './expansion';
import type { AbilityHost } from './ports';

type DraftStoreReads = Pick<ManifestStore, 'get' | 'stage' | 'workspacesForModule'>;

/** Active workspaces that cover an ability's modules — where its work may be recorded. */
export function abilityWorkspaces(
  store: DraftStoreReads,
  row: Pick<AbilityRowV1, 'module_ids'>,
): Array<{ id: string; title: string }> {
  const seen = new Map<string, string>();
  for (const moduleId of row.module_ids) {
    for (const workspace of store.workspacesForModule(moduleId)) {
      const id = asString(workspace.id);
      if (!id || workspace.archived === true || asString(workspace.status) !== 'active') continue;
      seen.set(id, asLabel(workspace, id));
    }
  }
  return [...seen].map(([id, title]) => ({ id, title }));
}

/** Aram's own stage work for this ability's encounters: the notes he writes in. */
export function abilityWorkPointers(store: DraftStoreReads, focus: AbilityFocusV1 | null): WorkPointerOption[] {
  const options: WorkPointerOption[] = [];
  for (const encounter of focus?.encounters ?? []) {
    const stage = store.stage(encounter.stage_id);
    const unit = store.get(encounter.unit_id);
    const place = `${asLabel(unit, encounter.unit_id)} · ${encounter.title ?? encounter.stage_id}`;
    const note = asString(stage?.working_note);
    if (note && note.startsWith('curriculum/')) {
      options.push({ value: note, label: `${place} — stage note` });
    }
    for (const attachment of Array.isArray(stage?.attachments) ? stage.attachments : []) {
      const path = typeof attachment === 'string'
        ? attachment
        : asString((attachment as Record<string, unknown> | null)?.path);
      if (path && path.startsWith('curriculum/')) {
        options.push({ value: path, label: `${place} — ${path.split('/').pop() ?? path}` });
      }
    }
  }
  return options;
}

function openDraft(
  host: AbilityHost,
  row: AbilityRowV1,
  focus: AbilityFocusV1 | null,
  supersedes: string | null = null,
): void {
  new AbilityClaimDraftModal(host.app, {
    ability: row,
    definition: focus?.ability ?? null,
    workspaces: abilityWorkspaces(host.plugin.store, row),
    workPointers: abilityWorkPointers(host.plugin.store, focus),
    existing: null,
    supersedes,
    save: (draft) => host.plugin.saveAbilityDraft(draft),
    onSaved: () => host.render(),
  }).open();
}

function openConnection(host: AbilityHost, row: AbilityRowV1, brief: AbilityBriefV1): void {
  new AbilityConnectionDraftModal(host.app, {
    from: row,
    candidates: brief.abilities,
    existing: null,
    save: (draft) => host.plugin.saveAbilityDraft(draft),
    onSaved: () => host.render(),
  }).open();
}

function block(parent: HTMLElement, title: string, lede = ''): HTMLElement {
  const wrap = parent.createEl('section', { cls: 'los-ability-detail-section' });
  wrap.createEl('h2', { text: title });
  if (lede) wrap.createEl('p', { cls: 'los-micro', text: lede });
  return wrap;
}

function list(parent: HTMLElement, items: readonly string[]): void {
  const target = parent.createEl('ul', { cls: 'los-ability-detail-list' });
  for (const item of items) target.createEl('li', { text: item });
}

function openPath(host: AbilityHost, pointer: string): void {
  const path = pointer.split('#')[0] ?? pointer;
  if (path.startsWith('curriculum/') || path.startsWith('knowledge/') || path.startsWith('work/')) {
    host.plugin.openAuthoredPath(path);
  }
}

function pointer(parent: HTMLElement, host: AbilityHost, value: string): void {
  const path = value.split('#')[0] ?? value;
  if (/^(curriculum|knowledge|work)\//.test(path)) {
    button(parent, value, () => openPath(host, value), 'tertiary').addClass('los-ability-source-link');
  } else {
    parent.createSpan({ cls: 'los-ability-pointer', text: value });
  }
}

function renderEvidenceRow(
  parent: HTMLElement,
  host: AbilityHost,
  item: AbilityEvidenceV1,
  correctedBy: ReadonlyMap<string, string>,
  onCorrect: (id: string) => void,
): void {
  const row = parent.createDiv({ cls: `los-ability-evidence is-${item.result}${correctedBy.has(item.id) ? ' is-corrected' : ''}` });
  const head = row.createDiv({ cls: 'los-ability-evidence-head' });
  head.createEl('strong', { text: `${RESULT_LABEL[item.result]}${correctedBy.has(item.id) ? ' · corrected' : ''}` });
  head.createSpan({ cls: 'los-micro', text: [item.timestamp?.slice(0, 16).replace('T', ' '), item.activity].filter(Boolean).join(' · ') });
  if (item.claim) row.createEl('p', { text: item.claim });
  const facts: string[] = [];
  if (item.assistance !== null) facts.push(`Assistance: ${item.assistance || '—'}`);
  if (item.conditions.length) facts.push(`Met: ${item.conditions.join('; ')}`);
  if (item.conditions_not_met.length) facts.push(`Not met: ${item.conditions_not_met.join('; ')}`);
  if (item.evidence_tags.length) facts.push(`Shows: ${item.evidence_tags.join('; ')}`);
  for (const fact of facts) row.createDiv({ cls: 'los-micro', text: fact });
  const refs = row.createDiv({ cls: 'los-ability-evidence-refs' });
  refs.createSpan({ cls: 'los-micro', text: 'Work: ' });
  pointer(refs, host, item.work_ref);
  if (item.confirmation_ref) {
    const confirmation = row.createDiv({ cls: 'los-ability-evidence-refs' });
    confirmation.createSpan({ cls: 'los-micro', text: 'Confirmed: ' });
    confirmation.createSpan({ cls: 'los-ability-pointer', text: item.confirmation_ref });
  }
  if (item.supersedes) row.createDiv({ cls: 'los-micro', text: `Corrects ${item.supersedes}; that record stays visible.` });
  const corrector = correctedBy.get(item.id);
  if (corrector) {
    row.createDiv({ cls: 'los-micro', text: `Corrected by ${corrector}.` });
  } else {
    button(row, 'Draft a correction', () => onCorrect(item.id), 'tertiary');
  }
}

/** The full ability detail (Figma A2 → "Open full ability detail"). */
export function renderAbilityDetail(
  root: HTMLElement,
  host: AbilityHost,
  brief: AbilityBriefV1,
  plane: AbilityPlane,
  abilityId: string,
): void {
  const row = plane.rowOf.get(abilityId);
  if (!row) return;
  const horizon = host.plugin.abilityHorizon;
  horizon.ensureExpansion(abilityId);
  const expansion = horizon.expansion(abilityId);
  const focus = expansion && 'ability' in expansion ? expansion : null;
  const labels = projectionLabels(host.plugin.store);
  const titleOf = (id: string) => plane.rowOf.get(id)?.title ?? id;
  const modules = row.module_ids.map((id) => labels.module(id));

  const page = root.createDiv({ cls: 'los-ability-detail' });
  const header = page.createDiv({ cls: 'los-ability-detail-head' });
  const eyebrow = ['Ability', ...modules];
  if (focus?.ability.lifecycle === 'retired') {
    eyebrow.push('retired identity');
  } else if (focus?.ability.review.state === 'reviewed') {
    eyebrow.push(`reviewed${focus.ability.review.reviewed_on ? ` ${focus.ability.review.reviewed_on}` : ''}`);
  } else if (focus) {
    eyebrow.push('candidate identity');
  }
  header.createDiv({ cls: 'los-ability-eyebrow is-accent', text: eyebrow.join(' · ') });
  header.createEl('h1', { text: row.title });
  const status = header.createDiv({ cls: `los-ability-status is-${row.state}` });
  status.createEl('strong', {
    text: row.evidence.length || row.state !== 'uncertain'
      ? STATE_LABEL[row.state]
      : `${STATE_LABEL[row.state]} · no attempt recorded`,
  });
  for (const reason of row.reasons) status.createDiv({ cls: 'los-micro', text: sentence(reason) });

  const actions = header.createDiv({ cls: 'los-actions los-ability-detail-actions' });
  const canRecord = focus?.ability.review.state === 'reviewed'
    && focus.ability.lifecycle === 'active';
  const draftButton = button(actions, 'Draft a worked attempt', () => openDraft(host, row, focus), 'cta');
  draftButton.disabled = !canRecord;
  if (!canRecord) {
    draftButton.setAttr('title', focus?.ability.lifecycle === 'retired'
      ? 'Retired identities keep their history but cannot receive new evidence.'
      : focus ? 'Only a reviewed ability can hold evidence.' : 'Waiting for this ability’s conditions from Core.');
  }
  button(actions, 'Note a possible connection', () => openConnection(host, row, brief), 'quiet')
    .disabled = row.lifecycle === 'retired';
  button(actions, 'Back to map', () => host.go({ detail: false }), 'tertiary');
  header.createEl('p', {
    cls: 'los-micro',
    text: 'Drafts wait in Review; nothing is recorded until you confirm the exact record there. Completing a stage never records ability evidence.',
  });

  const drafts = host.plugin.listAbilityDrafts().filter((draft) => draft.kind === 'claim'
    ? draft.abilityId === abilityId
    : draft.fromAbility === abilityId || draft.toAbility === abilityId);
  if (drafts.length) {
    const pending = block(page, 'Drafts · not recorded', 'Confirm, edit or drop each one in Review.');
    for (const draft of drafts) {
      const line = pending.createDiv({ cls: 'los-ability-draft-row' });
      line.createSpan({
        text: draft.kind === 'claim'
          ? `Worked attempt · ${draft.result ? RESULT_LABEL[draft.result] : 'result not chosen'} · ${draft.claim || 'no claim yet'}`
          : `Possible ${draft.connection}: ${draft.fromTitle} ${bridgeSymbol(draft.connection)} ${draft.toTitle}`,
      });
      button(line, 'Open in Review', () => host.plugin.nav.openReview(draft.id), 'tertiary');
    }
  }

  const counts = block(page, 'What counts');
  if (focus) {
    counts.createEl('p', { cls: 'los-ability-claim', text: focus.ability.claim });
    if (focus.ability.conditions.length) {
      counts.createEl('h3', { text: 'Conditions' });
      list(counts, focus.ability.conditions);
    }
    counts.createEl('h3', { text: 'The attempt must show' });
    list(counts, focus.ability.evidence_spec);
    if (focus.ability.source) {
      const source = counts.createDiv({ cls: 'los-ability-evidence-refs' });
      source.createSpan({ cls: 'los-micro', text: 'Defined from: ' });
      pointer(source, host, focus.ability.source);
    }
  } else {
    renderExpansionState(counts, host, abilityId);
  }

  const routes = block(page, 'Preparation routes',
    row.preparation_routes.length > 1 ? 'Any one route prepares this ability; every ability inside a route is needed.' : '');
  if (!row.preparation_routes.length) {
    routes.createEl('p', { text: 'No reviewed preparation route. This ability is where its group starts.' });
  }
  row.preparation_routes.forEach((route, index) => {
    const card = routes.createDiv({ cls: 'los-ability-route' });
    card.createEl('h3', { text: row.preparation_routes.length > 1 ? `Route ${index + 1}` : 'Route' });
    card.createEl('p', { text: route.reason });
    const members = card.createEl('ul', { cls: 'los-ability-detail-list' });
    for (const member of routeMembers(route)) {
      const item = members.createEl('li');
      const supported = route.supported.includes(member);
      item.createSpan({ text: titleOf(member) });
      item.createSpan({
        cls: `los-ability-inline-state is-${supported ? 'supported' : 'uncertain'}`,
        text: supported ? ' · supported' : ' · missing or uncertain',
      });
    }
    if (route.remaining_work.length) {
      card.createDiv({ cls: 'los-micro', text: `Remaining: ${route.remaining_work.map(titleOf).join(', ')}` });
    }
    if (route.source) {
      const source = card.createDiv({ cls: 'los-ability-evidence-refs' });
      source.createSpan({ cls: 'los-micro', text: 'Source: ' });
      pointer(source, host, route.source);
    }
  });

  const ledger = block(page, 'Evidence', 'Every recorded attempt, corrections included. Conflicting work stays visible.');
  const rows = focus?.ability.evidence ?? row.evidence;
  if (!rows.length) {
    ledger.createEl('p', { text: 'No learner attempt has been recorded. Confirmed work can change this state.' });
  } else {
    const correctedBy = new Map<string, string>();
    for (const item of rows) if (item.supersedes) correctedBy.set(item.supersedes, item.id);
    for (const item of [...rows].reverse()) {
      renderEvidenceRow(ledger, host, item, correctedBy, (id) => openDraft(host, row, focus, id));
    }
  }
  for (const transfer of row.transfer) {
    const card = ledger.createDiv({ cls: 'los-ability-route' });
    card.createEl('strong', { text: `Supported through a reviewed equivalence from ${titleOf(transfer.from)}` });
    card.createEl('p', { text: `Carries: ${transfer.carries}` });
    card.createEl('p', { text: `Still differs: ${transfer.changes}` });
  }

  const bridges = block(page, 'Bridges', 'Reviewed bridges carry evidence only inside their conditions and while their source is current.');
  const bridgeRows = focus?.bridges ?? brief.bridges.filter((bridge) => bridge.from === abilityId || bridge.to === abilityId);
  if (!bridgeRows.length) bridges.createEl('p', { cls: 'los-micro', text: 'No bridge names this ability.' });
  for (const bridge of bridgeRows) {
    const card = bridges.createDiv({ cls: `los-ability-route is-bridge is-${bridge.freshness}` });
    card.createEl('h3', {
      text: `${bridge.review.state === 'reviewed' ? 'Reviewed' : 'Candidate'} ${bridge.kind}: ${titleOf(bridge.from)} ${bridgeSymbol(bridge.kind)} ${titleOf(bridge.to)}`,
    });
    card.createDiv({
      cls: 'los-micro',
      text: bridge.freshness === 'current' ? 'Source current.' : `Source ${bridge.freshness} — this bridge carries nothing now.`,
    });
    card.createEl('p', { text: `Carries: ${bridge.carries}` });
    card.createEl('p', { text: `Still differs: ${bridge.changes}` });
    if (bridge.conditions.length) card.createDiv({ cls: 'los-micro', text: `Only under: ${bridge.conditions.join('; ')}` });
    const source = card.createDiv({ cls: 'los-ability-evidence-refs' });
    source.createSpan({ cls: 'los-micro', text: 'Source: ' });
    pointer(source, host, bridge.source);
  }

  const tentative = focus?.candidate_connections
    ?? brief.candidate_connections.filter((row2) => row2.from === abilityId || row2.to === abilityId);
  const candidates = block(page, 'Tentative connections', 'Noticed, not reviewed. They carry no evidence and change no state.');
  if (!tentative.length) candidates.createEl('p', { cls: 'los-micro', text: 'None recorded.' });
  for (const connection of tentative) {
    const card = candidates.createDiv({ cls: 'los-ability-route is-tentative' });
    card.createEl('h3', { text: `Tentative ${connection.kind}: ${titleOf(connection.from)} ${bridgeSymbol(connection.kind)} ${titleOf(connection.to)}` });
    card.createEl('p', { text: `Carries: ${connection.carries}` });
    card.createEl('p', { text: `Still differs: ${connection.changes}` });
    card.createDiv({ cls: 'los-micro', text: `Noticed: ${connection.source_ref} · ${connection.created_at.slice(0, 10)}` });
  }

  const encounters = block(page, 'Where courses teach it',
    'A stage’s status is study progress. Completing a stage never establishes this ability.');
  if (!focus) {
    renderExpansionState(encounters, host, abilityId);
  } else if (!focus.encounters.length) {
    encounters.createEl('p', { cls: 'los-micro', text: 'No stage lists this ability yet.' });
  } else {
    for (const encounter of focus.encounters) {
      const card = encounters.createDiv({ cls: 'los-ability-route' });
      const unit = host.plugin.store.get(encounter.unit_id);
      card.createEl('h3', { text: `${labels.module(encounter.module_id)} · ${asLabel(unit, encounter.unit_id)} · ${encounter.title ?? encounter.stage_id}` });
      if (encounter.objective) card.createEl('p', { text: encounter.objective });
      card.createDiv({ cls: 'los-micro', text: `Stage progress: ${encounter.status ?? 'unknown'} — not evidence.` });
      const mapped = encounter.materials.filter((material) => material.locator);
      if (mapped.length) {
        card.createDiv({
          cls: 'los-micro',
          text: `${mapped.length} ${mapped.length === 1 ? 'material' : 'materials'} placed, e.g. ${mapped.slice(0, 2).map((material) => material.locator).join('; ')}`,
        });
      }
      button(card, 'Open stage', () => host.plugin.nav.openUnit(encounter.unit_id, encounter.stage_id), 'quiet');
    }
  }

  if (focus?.related_encounters.length) {
    const related = block(page, 'Connected stages in other courses',
      'Stages that teach an ability this one depends on or is bridged to. Cross-course links live here in the Atlas, not in a study session.');
    for (const encounter of focus.related_encounters) {
      const card = related.createDiv({ cls: 'los-ability-route' });
      const unit = host.plugin.store.get(encounter.unit_id);
      card.createEl('h3', { text: `${labels.module(encounter.module_id)} · ${asLabel(unit, encounter.unit_id)} · ${encounter.title ?? encounter.stage_id}` });
      card.createDiv({ cls: 'los-micro', text: `Teaches: ${encounter.ability_ids.map(titleOf).join(', ')}` });
      button(card, 'Open stage', () => host.plugin.nav.openUnit(encounter.unit_id, encounter.stage_id), 'quiet');
    }
    if (focus.related_encounters_total > focus.related_encounters.length) {
      related.createDiv({
        cls: 'los-micro',
        text: `Showing ${focus.related_encounters.length} of ${focus.related_encounters_total}.`,
      });
    }
  }

  if (focus?.shared_concept_candidates.length) {
    const shared = block(page, 'Shares a concept tag with', 'A shared tag is a lead to look at, never credit.');
    list(shared, focus.shared_concept_candidates.map(titleOf));
  }

  const concepts = asStrings(row.concept_ids);
  if (concepts.length) {
    const tags = block(page, 'Concepts');
    const line = tags.createDiv({ cls: 'los-ability-concepts' });
    for (const conceptId of concepts) {
      button(line, labels.concept(conceptId) ?? conceptId,
        () => host.plugin.nav.openAtlas({ concept: conceptId }), 'quiet');
    }
  }

  if (!focus && horizon.expansionError(abilityId)) {
    empty(page, 'Part of this ability could not be read', horizon.expansionError(abilityId) ?? '');
  }
}
