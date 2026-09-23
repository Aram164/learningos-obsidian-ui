'use strict';

/*
 * Pure tests for the Ability map, the Review queue and the two ability writes.
 *
 * No Obsidian, no DOM: the contract decoders, the plane read model, the claim
 * checks and payloads, the Review queue, and UI-owned drafts, loaded from
 * their TypeScript sources. The Core answers are the synthetic fixtures in
 * tests/ability-fixtures.js, which are shaped exactly like `los.py
 * ability-context` and `los.py material-span` output.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createSourceModuleLoader } = require('./source-module-loader');
const fixtures = require('./ability-fixtures');

const root = path.dirname(__dirname);
const load = createSourceModuleLoader(root);
const {
  asAbilityBrief,
  asAbilityFocus,
  asAbilityUnmapped,
} = load('src/contracts/ability-context.ts');
const { asMaterialSpan } = load('src/contracts/material-span.ts');
const {
  appConfirmationRef,
  hasAcceptedPrefix,
  WORK_REF_PREFIXES,
} = load('src/contracts/ability-writes.ts');
const {
  buildAbilityPlane,
  preparationSentence,
  searchAbilities,
  shortModuleLabel,
  routeMembers,
} = load('src/features/abilities/model.ts');
const {
  candidatePayload,
  claimProblems,
  composedClaim,
  connectionProblems,
  isUnassisted,
  observationPayload,
  unresolvedConditions,
} = load('src/features/abilities/claims.ts');
const { buildReviewQueue, reviewQueueCount, hasConflictingWork } = load('src/features/review/queue.ts');
const { asAbilityDraft } = load('src/application/ability-drafts.ts');

const CONCEPTS = {
  'concept-bayes': 'Bayes theorem',
  'concept-bedingte-wahrscheinlichkeit': 'Conditional probability',
  'concept-wahrscheinlichkeit': 'Probability',
  'concept-logistic-regression': 'Logistic regression',
  'concept-frequentist-inference': 'Frequentist inference',
};
const MODULES = { 'module-fixture-m2': 'M2F', 'module-fixture-aml': 'AMLF' };
const labels = {
  concept: (id) => CONCEPTS[id] ?? null,
  module: (id) => MODULES[id] ?? id,
};

let passed = 0;
function test(name, body) {
  body();
  passed += 1;
}

/* ------------------------------------------------------------ contracts */

test('the fixture answers decode, and a real-shaped answer is not loosened', () => {
  const brief = asAbilityBrief(fixtures.abilityBrief());
  assert.ok(brief, 'brief decodes');
  assert.equal(brief.abilities.length, 6);
  assert.equal(brief.bridges[0].freshness, 'current');
  assert.equal(brief.candidate_connection_count, 1);

  assert.equal(asAbilityBrief({ ...fixtures.abilityBrief(), contract: 'ability-context-v2' }), null,
    'another contract is not read as this one');
  assert.equal(asAbilityBrief({ ...fixtures.abilityBrief(), snapshot_id: 'fixture' }), null,
    'a snapshot that is not a digest is refused');
  assert.equal(asAbilityBrief(fixtures.abilityFocus('ability-fixture-conditional')), null,
    'a focused answer is never mistaken for the horizon');
  assert.equal(asAbilityBrief(fixtures.abilityBrief((raw) => { raw.abilities[0].state = 'mastered'; })), null,
    'a state Core does not define makes the whole answer unreadable, not silently dropped');

  const focus = asAbilityFocus(fixtures.abilityFocus('ability-fixture-bayes-m2'));
  assert.ok(focus, 'focus decodes');
  assert.equal(focus.ability.review.state, 'reviewed');
  assert.deepEqual(focus.ability.evidence_spec, ['correct posterior', 'shows the total-probability denominator']);
  assert.equal(asAbilityFocus(fixtures.abilityFocus('ability-fixture-bayes-m2', (raw) => { raw.focus = 'ability-other'; })), null,
    'an expansion must be of the ability it names');

  const unmapped = asAbilityUnmapped(fixtures.abilityFocus('ability-fixture-nowhere'));
  assert.ok(unmapped && unmapped.reason, 'an unmapped identity is its own answer, not an error and not a gap');
  assert.equal(asAbilityFocus(fixtures.abilityFocus('ability-fixture-nowhere')), null);
});

test('bridge freshness is Core-observed; absence never reads as current', () => {
  const brief = asAbilityBrief(fixtures.abilityBrief((raw) => {
    delete raw.bridges[0].source_freshness;
    raw.bridges.push({ ...raw.bridges[0], from: 'ability-fixture-logistic', review: { state: 'candidate' } });
  }));
  assert.equal(brief.bridges[0].freshness, 'unavailable', 'a reviewed bridge Core did not observe is not current');
  assert.equal(brief.bridges[1].freshness, 'not-reviewed', 'a candidate bridge is never current');
});

test('material spans decode per availability and refuse unknown shapes', () => {
  const local = asMaterialSpan(fixtures.materialSpan('unit-fixture-sad-l04', 'route-drawer-deck', true));
  assert.equal(local.availability, 'local-observed');
  assert.equal(local.files[0].excerpt.includes('Conditioning on an event'), true);
  assert.deepEqual(local.files[0].pages, [1, 2]);
  assert.equal(local.analysis_notes_total, 2);
  const quiet = asMaterialSpan(fixtures.materialSpan('unit-fixture-sad-l04', 'route-drawer-deck', false));
  assert.equal(quiet.files[0].extraction, 'not-requested', 'nothing is extracted unless asked');
  assert.equal(quiet.files[0].excerpt, null);
  const remote = asMaterialSpan(fixtures.materialSpan('unit-fixture-sad-l04', 'route-remote-lecture', true));
  assert.equal(remote.availability, 'remote-unobserved');
  assert.equal(remote.files.length, 0, 'remote material is never fetched');
  assert.equal(asMaterialSpan({ ...fixtures.materialSpan('u', 'r', false), availability: 'guessed' }), null);
  assert.equal(asMaterialSpan({ ...fixtures.materialSpan('u', 'r', false), spans: null }), null);
});

/* ------------------------------------------------------------ the plane */

const brief = asAbilityBrief(fixtures.abilityBrief());
const plane = buildAbilityPlane(brief, labels);
const groupOf = (id) => plane.groups.find((group) => group.nodes.some((node) => node.id === id));
const nodeOf = (id) => groupOf(id).nodes.find((node) => node.id === id);

test('groups are the connected pieces of preparation and bridges, largest first', () => {
  assert.equal(plane.groups.length, 3);
  const chain = plane.groups[0];
  assert.deepEqual(chain.nodes.map((node) => node.id).sort(), [
    'ability-fixture-bayes-aml',
    'ability-fixture-bayes-m2',
    'ability-fixture-conditional',
    'ability-fixture-probability-rules',
  ]);
  assert.equal(chain.title, 'Bayes theorem', 'named after the concept most of its abilities carry');
  assert.notEqual(groupOf('ability-fixture-logistic'), groupOf('ability-fixture-interval'),
    'a tentative connection carries nothing, so it never joins two groups');
  assert.equal(plane.crossGroupCandidates.length, 1);
  assert.equal(chain.hasEvidence, true);
  assert.equal(groupOf('ability-fixture-logistic').hasEvidence, false);
});

test('preparation is directed, transitively reduced, and never drawn from a bridge', () => {
  const chain = plane.groups[0];
  const edges = chain.edges.map((edge) => `${edge.from} -> ${edge.to}`).sort();
  assert.deepEqual(edges, [
    'ability-fixture-conditional -> ability-fixture-bayes-aml',
    'ability-fixture-conditional -> ability-fixture-bayes-m2',
    'ability-fixture-probability-rules -> ability-fixture-conditional',
  ], 'the implied probability-rules -> bayes-m2 arrow is not drawn twice');
  assert.deepEqual(nodeOf('ability-fixture-bayes-m2').prerequisites,
    ['ability-fixture-probability-rules', 'ability-fixture-conditional'],
    'the complete route membership is kept for the inspector, word for word');
  assert.equal(chain.edges.some((edge) =>
    [edge.from, edge.to].sort().join() === ['ability-fixture-bayes-aml', 'ability-fixture-bayes-m2'].join()), false,
  'the reviewed equivalence is a band, not a preparation arrow');
  assert.equal(chain.bridges.length, 1);
  assert.equal(chain.reviewedBridgeCount, 1);
  assert.equal(chain.bridges[0].band, 0);
  assert.ok(chain.height > chain.graphHeight, 'bands sit below the node area');
});

test('columns and roles follow the longest preparation path', () => {
  assert.equal(nodeOf('ability-fixture-probability-rules').column, 0);
  assert.equal(nodeOf('ability-fixture-probability-rules').role, 'foundation');
  assert.equal(nodeOf('ability-fixture-conditional').column, 1);
  assert.equal(nodeOf('ability-fixture-conditional').role, 'step');
  assert.equal(nodeOf('ability-fixture-bayes-m2').column, 2);
  assert.equal(nodeOf('ability-fixture-bayes-aml').role, 'extension');
  assert.equal(nodeOf('ability-fixture-bayes-aml').meta, 'AMLF extension');
  assert.equal(nodeOf('ability-fixture-logistic').role, 'standalone');
  const chain = plane.groups[0];
  assert.deepEqual(chain.columns.map((column) => column.label), ['Foundations', 'Step 2', 'Extension']);
  const nodes = chain.nodes;
  for (const left of nodes) {
    for (const right of nodes) {
      if (left === right || left.column !== right.column) continue;
      assert.ok(Math.abs(left.y - right.y) >= 76, 'nodes in one column never overlap');
    }
  }
});

test('the plane is deterministic for the same horizon', () => {
  const again = buildAbilityPlane(asAbilityBrief(fixtures.abilityBrief()), labels);
  const shape = (value) => JSON.stringify(value.groups);
  assert.equal(shape(again), shape(plane));
  const reversed = buildAbilityPlane(asAbilityBrief(fixtures.abilityBrief((raw) => raw.abilities.reverse())), labels);
  assert.equal(shape(reversed), shape(plane), 'record order does not move anything');
});

test('sentences and search come straight from the routes', () => {
  const titleOf = (id) => plane.rowOf.get(id)?.title ?? id;
  assert.equal(
    preparationSentence(plane.rowOf.get('ability-fixture-bayes-m2'), titleOf),
    'Apply the probability axioms to finite events and Compute a conditional probability from a joint table.',
  );
  assert.equal(preparationSentence(plane.rowOf.get('ability-fixture-logistic'), titleOf), null);
  assert.deepEqual(routeMembers(plane.rowOf.get('ability-fixture-bayes-m2').preparation_routes[0]),
    ['ability-fixture-probability-rules', 'ability-fixture-conditional']);
  assert.deepEqual(searchAbilities(plane, 'bayes amlf', labels), ['ability-fixture-bayes-aml']);
  assert.deepEqual(searchAbilities(plane, '   ', labels), []);
  assert.equal(shortModuleLabel('Advanced Machine Learning (AML)', null, 'x'), 'AML');
  assert.equal(shortModuleLabel('Statistics & Analysis', 'M2', 'x'), 'M2');
});

/* ------------------------------------------------------------ claims */

function claimDraft(overrides = {}) {
  return {
    kind: 'claim',
    id: 'ability-claim-draft-test',
    abilityId: 'ability-fixture-conditional',
    abilityTitle: 'Compute a conditional probability from a joint table',
    workspace: 'workspace-fixture-m2',
    activity: 'Worked the fixture table exercise.',
    result: 'correct',
    assistance: 'none',
    conditionsMet: ['joint table given', 'no worked solution shown'],
    conditionsNotMet: [],
    evidenceTags: ['correct conditional probability', 'names the conditioning event'],
    workRef: 'curriculum/modules/module-fixture-m2/units/unit-fixture-sad-l04/notes.md#table',
    claim: 'Correct attempt · no assistance · every stated condition met',
    supersedes: null,
    createdAt: '2099-04-01T12:00:00Z',
    updatedAt: '2099-04-01T12:00:00Z',
    ...overrides,
  };
}

const definition = asAbilityFocus(fixtures.abilityFocus('ability-fixture-conditional')).ability;
const context = { ability: definition, workspaces: ['workspace-fixture-m2'] };

test('a complete claim draft has no problems, and each missing field is named', () => {
  assert.deepEqual(claimProblems(claimDraft(), context), []);
  const problems = claimProblems(claimDraft({
    workspace: '', result: '', activity: ' ', assistance: '', workRef: 'my notes', claim: '',
    conditionsNotMet: ['joint table given'],
  }), context);
  assert.equal(problems.length, 7);
  assert.ok(problems.some((line) => line.includes('workspace')));
  assert.ok(problems.some((line) => line.includes('curriculum/ path')));
  assert.ok(problems.some((line) => line.includes('both met and not met')));
  assert.ok(claimProblems(claimDraft(), { ...context, ability: null })[0].includes('not in the current ability map'));
  assert.ok(claimProblems(claimDraft(), { ...context, ability: { ...definition, review: { state: 'candidate' } } })[0]
    .includes('still a candidate'));
  assert.ok(claimProblems(claimDraft(), { ...context, ability: { ...definition, lifecycle: 'retired' } })[0]
    .includes('retired'));
});

test('the observation payload is exactly the reviewed record, confirmed by this request', () => {
  const payload = observationPayload(claimDraft({ claim: '  Correct attempt  ' }), 'idem-key-1');
  assert.equal(payload.confirmation_ref, 'conversation://learningos-app/idem-key-1');
  assert.equal(payload.confirmation_ref, appConfirmationRef('idem-key-1'));
  assert.equal(payload.claim, 'Correct attempt');
  assert.equal(payload.ability, 'ability-fixture-conditional');
  assert.equal('supersedes' in payload, false, 'no correction target unless the draft names one');
  assert.equal(observationPayload(claimDraft({ supersedes: 'observation-1' }), 'k').supersedes, 'observation-1');
  for (const key of ['stage_id', 'status', 'study_map_id', 'unit_id']) {
    assert.equal(key in payload, false, `stage progress never rides along (${key})`);
  }
  assert.throws(() => observationPayload(claimDraft({ result: '' }), 'k'));
  const schemaPath = path.join(root, '..', 'repository', 'system', 'schema', 'capabilities',
    'learner.ability-observation.append.schema.json');
  if (fs.existsSync(schemaPath)) {
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    for (const key of Object.keys(payload)) assert.ok(key in schema.properties, `Core declares ${key}`);
    for (const key of schema.required) assert.ok(key in payload, `the payload carries required ${key}`);
  }
});

test('a composed claim never says more than its fields', () => {
  assert.equal(composedClaim(claimDraft(), definition), 'Correct attempt · no assistance · every stated condition met');
  assert.equal(
    composedClaim(claimDraft({ result: 'partial', assistance: 'hint from a tutor', conditionsMet: [], conditionsNotMet: ['no worked solution shown'] }), definition),
    'Partial attempt · hint from a tutor · not met: no worked solution shown · not sure: joint table given',
  );
  assert.equal(isUnassisted(' None '), true);
  assert.equal(isUnassisted('none, but notes'), false);
  const unsure = claimDraft({ conditionsMet: ['joint table given'], conditionsNotMet: [] });
  assert.deepEqual(unresolvedConditions(unsure, definition), ['no worked solution shown']);
  assert.equal(composedClaim(unsure, definition),
    'Correct attempt · no assistance · not sure: no worked solution shown');
});

function connectionDraft(overrides = {}) {
  return {
    kind: 'connection',
    id: 'ability-connection-draft-test',
    fromAbility: 'ability-fixture-logistic',
    fromTitle: 'Fit a logistic regression by maximum likelihood',
    toAbility: 'ability-fixture-interval',
    toTitle: 'Construct a frequentist confidence interval',
    connection: 'connection',
    carries: ' Both use a likelihood. ',
    changes: 'Different goals.',
    conditions: [' iid data ', ''],
    sourceRef: '',
    createdAt: '2099-04-01T12:00:00Z',
    updatedAt: '2099-04-01T12:00:00Z',
    ...overrides,
  };
}

test('a tentative connection is checked for shape only and names its own provenance', () => {
  assert.deepEqual(connectionProblems(connectionDraft(), brief), []);
  assert.ok(connectionProblems(connectionDraft({ toAbility: 'ability-fixture-logistic' }), brief)
    .includes('Choose two different abilities.'));
  assert.ok(connectionProblems(connectionDraft({ toAbility: 'ability-elsewhere' }), brief)
    .includes('Both abilities must be active in the current ability map.'));
  assert.equal(connectionProblems(connectionDraft({ sourceRef: 'curriculum/x.md' }), brief).length, 1,
    'a discovery pointer must be a conversation, note or project reference');
  const payload = candidatePayload(connectionDraft(), 'idem-key-2');
  assert.equal(payload.source_ref, 'conversation://learningos-app/idem-key-2');
  assert.equal(payload.carries, 'Both use a likelihood.');
  assert.deepEqual(payload.condition, ['iid data']);
  assert.equal(candidatePayload(connectionDraft({ sourceRef: 'note://note-fixture-x' }), 'k').source_ref, 'note://note-fixture-x');
});

test('work pointers accept exactly the prefixes Core accepts', () => {
  assert.equal(hasAcceptedPrefix('curriculum/modules/x.md#y', WORK_REF_PREFIXES), true);
  assert.equal(hasAcceptedPrefix('curriculum/', WORK_REF_PREFIXES), false, 'a bare prefix points at nothing');
  assert.equal(hasAcceptedPrefix('curriculum/../../../../etc/passwd', WORK_REF_PREFIXES), false);
  assert.equal(hasAcceptedPrefix('note://a b', WORK_REF_PREFIXES), false, 'a pointer has no spaces');
  assert.equal(hasAcceptedPrefix('https://example.org', WORK_REF_PREFIXES), false);
});

/* ------------------------------------------------------------ Review */

test('Review lists drafts, Core conflicts and Core decisions — and nothing synthesized', () => {
  const items = [
    { id: 'review-planning-unit-fixture-analysis', category: 'planning', title: 'Plan Analysis exam prep', context: '', reason: 'Needs a map.' },
    { id: 'review-inbox-x', category: 'inbox', title: '', context: 'work/inbox/x.md', reason: 'Route it.' },
  ];
  const conflicted = asAbilityBrief(fixtures.abilityBrief((raw) => {
    raw.abilities[2].reasons = ['later comparable work is conflicting'];
  }));
  const drafts = [claimDraft(), connectionDraft()];
  const queue = buildReviewQueue({ items, drafts, horizon: conflicted });
  assert.deepEqual(queue.map((entry) => entry.kind),
    ['claim-draft', 'connection-draft', 'ability-conflict', 'core', 'core']);
  assert.equal(queue[0].context.endsWith('draft, not recorded'), true, 'a draft is labelled as a draft');
  assert.equal(queue[2].key, 'ability-conflict:ability-fixture-bayes-m2');
  assert.equal(queue[3].key, 'review-planning-unit-fixture-analysis', 'a Core item keeps its own id');
  assert.equal(queue[4].title, 'review-inbox-x', 'a missing title falls back to the id, never to a guess');
  assert.equal(queue[4].context, 'Inbox · work/inbox/x.md');
  assert.equal(reviewQueueCount({ items, drafts, horizon: conflicted }), 5);
  assert.equal(reviewQueueCount({ items: [], drafts: [], horizon: brief }), 0,
    'uncertain abilities with no conflicting work are not decisions');
  assert.equal(hasConflictingWork(brief.abilities[0]), false);
});

test('UI-owned drafts round-trip and refuse what they cannot represent', () => {
  assert.deepEqual(asAbilityDraft(JSON.parse(JSON.stringify(claimDraft()))), claimDraft());
  assert.deepEqual(asAbilityDraft(JSON.parse(JSON.stringify(connectionDraft()))), connectionDraft());
  assert.equal(asAbilityDraft({ ...claimDraft(), result: 'mastered' }), null);
  assert.equal(asAbilityDraft({ ...connectionDraft(), connection: 'causes' }), null);
  assert.equal(asAbilityDraft({ ...claimDraft(), id: '' }), null);
});

console.log(`Abilities model OK: ${passed} groups (contracts, plane, claims, Review queue, drafts).`);
