/*
 * Synthetic Core answers for the Ability map and for material spans.
 *
 * Fixture-only, like fixture-vault/: shaped after `ability-context-v1` and
 * `material-span-v1` exactly as the Core CLI prints them
 * (`los.py ability-context [ABILITY_ID]`, `los.py material-span UNIT ROUTE
 * [--extract]`), but every identity is a fixture identity. Nothing here is a
 * real curriculum fact or a real learner record.
 *
 * The horizon is deliberately small and deliberately shaped:
 * - one group with a strict preparation chain and a join (probability rules →
 *   conditional → two Bayes abilities in two modules), carrying one reviewed,
 *   current equivalence bridge between the two Bayes abilities;
 * - two single-ability groups joined only by a tentative candidate connection,
 *   which must never merge them;
 * - one supported ability with a recorded, confirmed attempt, one nearby, the
 *   rest uncertain — states are Core's answers, never the UI's.
 */
'use strict';

const SNAPSHOT = `sha256:${'1'.repeat(64)}`;
const CONTRACT = 'ability-context-v1';
const REVIEWED = { state: 'reviewed', reviewed_by: 'fixture-reviewer', reviewed_on: '2099-04-01' };

const clone = (value) => JSON.parse(JSON.stringify(value));

function route(reason, supported, missing, source) {
  return {
    reason,
    source,
    supported,
    missing_or_uncertain: missing,
    remaining_work: missing,
  };
}

const M2_UNIT = 'curriculum/modules/module-fixture-m2/units/unit-fixture-sad-l04.yaml';
const AML_UNIT = 'curriculum/modules/module-fixture-aml/units/unit-fixture-aml-l04.yaml';

const ABILITIES = [
  {
    id: 'ability-fixture-probability-rules',
    title: 'Apply the probability axioms to finite events',
    state: 'supported',
    reasons: ['current confirmed work meets every stated condition'],
    concept_ids: ['concept-wahrscheinlichkeit'],
    module_ids: ['module-fixture-m2'],
    preparation_routes: [],
    transfer: [],
    evidence: [{
      id: 'observation-fixture-axioms',
      result: 'correct',
      work_ref: 'curriculum/modules/module-fixture-m2/units/unit-fixture-sad-l04/notes.md#axioms',
      claim: 'Correct attempt · no assistance · every stated condition met',
      activity: 'Worked the fixture dice exercise without notes.',
      timestamp: '2099-03-01T18:00:00Z',
      assistance: 'none',
      conditions: ['finite sample space', 'no worked solution shown'],
      conditions_not_met: [],
      evidence_tags: ['names the axioms used', 'correct event probability'],
      confirmation_ref: 'conversation://learningos-app/fixture-confirmed-axioms',
      supersedes: null,
      origin: {
        path: 'workspaces/workspace-fixture-m2/ability-observations.yaml',
        workspace_id: 'workspace-fixture-m2',
      },
    }],
  },
  {
    id: 'ability-fixture-conditional',
    title: 'Compute a conditional probability from a joint table',
    state: 'nearby',
    reasons: ['every prerequisite on one route is supported; no confirmed work of its own yet'],
    concept_ids: ['concept-bedingte-wahrscheinlichkeit', 'concept-wahrscheinlichkeit'],
    module_ids: ['module-fixture-m2'],
    preparation_routes: [route(
      'Conditioning restricts a probability measure the learner can already apply.',
      ['ability-fixture-probability-rules'], [], M2_UNIT,
    )],
    transfer: [],
    evidence: [],
  },
  {
    id: 'ability-fixture-bayes-m2',
    title: 'Invert a conditional probability with Bayes theorem',
    state: 'uncertain',
    reasons: ['no current confirmed work under the stated conditions'],
    concept_ids: ['concept-bayes', 'concept-bedingte-wahrscheinlichkeit'],
    module_ids: ['module-fixture-m2'],
    preparation_routes: [route(
      'Bayes rewrites one conditional in terms of the other.',
      ['ability-fixture-probability-rules'], ['ability-fixture-conditional'], M2_UNIT,
    )],
    transfer: [],
    evidence: [],
  },
  {
    id: 'ability-fixture-bayes-aml',
    title: 'Score a naive Bayes classifier by hand',
    state: 'uncertain',
    reasons: ['no current confirmed work under the stated conditions'],
    concept_ids: ['concept-bayes'],
    module_ids: ['module-fixture-aml'],
    preparation_routes: [route(
      'The classifier multiplies conditionals it assumes independent.',
      [], ['ability-fixture-conditional'], AML_UNIT,
    )],
    transfer: [],
    evidence: [],
  },
  {
    id: 'ability-fixture-logistic',
    title: 'Fit a logistic regression by maximum likelihood',
    state: 'uncertain',
    reasons: ['no current confirmed work under the stated conditions'],
    concept_ids: ['concept-logistic-regression'],
    module_ids: ['module-fixture-aml'],
    preparation_routes: [],
    transfer: [],
    evidence: [],
  },
  {
    id: 'ability-fixture-interval',
    title: 'Construct a frequentist confidence interval',
    state: 'uncertain',
    reasons: ['no current confirmed work under the stated conditions'],
    concept_ids: ['concept-frequentist-inference'],
    module_ids: ['module-fixture-m2'],
    preparation_routes: [],
    transfer: [],
    evidence: [],
  },
];

const DEFINITIONS = {
  'ability-fixture-probability-rules': {
    claim: 'Given a finite sample space, apply the axioms to compute an event probability.',
    source: 'curriculum/modules/module-fixture-m2/units/unit-fixture-sad-l04/study-map.yaml#stage-fixture-foundations',
    conditions: ['finite sample space', 'no worked solution shown'],
    evidence_spec: ['names the axioms used', 'correct event probability'],
  },
  'ability-fixture-conditional': {
    claim: 'Compute P(A|B) from a joint table and name the conditioning event.',
    source: 'curriculum/modules/module-fixture-m2/units/unit-fixture-sad-l04/study-map.yaml#stage-fixture-conditioning',
    conditions: ['joint table given', 'no worked solution shown'],
    evidence_spec: ['correct conditional probability', 'names the conditioning event'],
  },
  'ability-fixture-bayes-m2': {
    claim: 'Given a prior and likelihoods, compute the posterior with Bayes theorem.',
    source: 'curriculum/modules/module-fixture-m2/units/unit-fixture-sad-l04/study-map.yaml#stage-fixture-conditioning',
    conditions: ['stated prior and likelihoods', 'no worked solution shown'],
    evidence_spec: ['correct posterior', 'shows the total-probability denominator'],
  },
  'ability-fixture-bayes-aml': {
    claim: 'Score one example with a naive Bayes classifier and state the independence assumption.',
    source: 'curriculum/modules/module-fixture-aml/units/unit-fixture-aml-l04/study-map.yaml#stage-fixture-aml-bayes',
    conditions: ['stated prior and likelihoods', 'no worked solution shown'],
    evidence_spec: ['correct class score', 'states the independence assumption'],
  },
  'ability-fixture-logistic': {
    claim: 'Fit a one-feature logistic regression by maximum likelihood and read its coefficient.',
    source: 'curriculum/modules/module-fixture-aml/units/unit-fixture-aml-l03/study-map.yaml#stage-aml-l03',
    conditions: ['small labelled dataset given'],
    evidence_spec: ['correct log-likelihood', 'reads the coefficient as an odds ratio'],
  },
  'ability-fixture-interval': {
    claim: 'Construct a 95% interval for a mean and interpret it correctly.',
    source: 'curriculum/modules/module-fixture-m2/units/unit-fixture-sad-l02/study-map.yaml#stage-l02-start',
    conditions: ['known variance'],
    evidence_spec: ['correct interval', 'frequentist interpretation'],
  },
};

const BRIDGE_DIGEST = `sha256:${'e'.repeat(64)}`;

const BRIDGES = [{
  from: 'ability-fixture-bayes-m2',
  to: 'ability-fixture-bayes-aml',
  kind: 'equivalence',
  carries: 'The same inversion of a conditional under a stated prior.',
  changes: 'AML adds the independence assumption of the classifier; neither extension follows from this bridge.',
  conditions: ['stated prior and likelihoods', 'no worked solution shown'],
  source: 'knowledge/notes/note-fixture-bayes-bridge.md',
  source_sha256: BRIDGE_DIGEST,
  review: REVIEWED,
  source_freshness: { status: 'current', observed_sha256: BRIDGE_DIGEST },
}];

const CANDIDATES = [{
  id: 'ability-candidate-fixture-likelihood',
  from: 'ability-fixture-logistic',
  to: 'ability-fixture-interval',
  kind: 'connection',
  carries: 'Both reason from a likelihood of the observed data.',
  changes: 'One fits a model; the other bounds an estimate.',
  conditions: [],
  source_ref: 'conversation://learningos-app/fixture-candidate-key',
  created_at: '2099-04-01T12:00:00Z',
}];

const ENCOUNTERS = {
  'ability-fixture-conditional': [{
    module_id: 'module-fixture-m2',
    unit_id: 'unit-fixture-sad-l04',
    study_map_id: 'study-map-fixture-sad-l04',
    stage_id: 'stage-fixture-conditioning',
    title: 'Conditional probability and Bayes',
    objective: 'Condition on an event and invert the conditional.',
    status: 'active',
    materials: [{ route_id: null, source_id: 'source-fixture-islp', locator: 'Chapter 2', match_state: 'exact' }],
  }],
  'ability-fixture-bayes-m2': [{
    module_id: 'module-fixture-m2',
    unit_id: 'unit-fixture-sad-l04',
    study_map_id: 'study-map-fixture-sad-l04',
    stage_id: 'stage-fixture-conditioning',
    title: 'Conditional probability and Bayes',
    objective: 'Condition on an event and invert the conditional.',
    status: 'active',
    materials: [],
  }],
  'ability-fixture-bayes-aml': [{
    module_id: 'module-fixture-aml',
    unit_id: 'unit-fixture-aml-l04',
    study_map_id: 'study-map-fixture-aml-l04',
    stage_id: 'stage-fixture-aml-bayes',
    title: 'Bayes decision rule',
    objective: 'Classify with the posterior.',
    status: 'pending',
    materials: [],
  }],
};

/** The bounded horizon: `los.py ability-context --limit N`. */
function abilityBrief(patch) {
  const brief = {
    schema_version: 1,
    snapshot_id: SNAPSHOT,
    contract: CONTRACT,
    abilities: clone(ABILITIES),
    total: ABILITIES.length,
    bridges: clone(BRIDGES),
    candidate_connections: clone(CANDIDATES),
    candidate_connection_count: CANDIDATES.length,
    truncated: false,
    expand: 'ability-context ABILITY_ID',
  };
  if (patch) patch(brief);
  return brief;
}

/** One ability expanded: `los.py ability-context ABILITY_ID`. */
function abilityFocus(abilityId, patch) {
  const row = ABILITIES.find((item) => item.id === abilityId);
  if (!row) {
    return {
      schema_version: 1,
      snapshot_id: SNAPSHOT,
      contract: CONTRACT,
      focus: abilityId,
      state: 'unmapped',
      reason: 'no reviewed ability identity maps this id',
    };
  }
  const focus = {
    schema_version: 1,
    snapshot_id: SNAPSHOT,
    contract: CONTRACT,
    focus: abilityId,
    ability: { ...clone(row), ...clone(DEFINITIONS[abilityId]), review: clone(REVIEWED) },
    bridges: clone(BRIDGES.filter((bridge) => bridge.from === abilityId || bridge.to === abilityId)),
    encounters: clone(ENCOUNTERS[abilityId] ?? []),
    related_encounters: [],
    related_encounters_total: 0,
    candidate_connections: clone(CANDIDATES.filter((item) => item.from === abilityId || item.to === abilityId)),
    shared_concept_candidates: ABILITIES
      .filter((item) => item.id !== abilityId
        && item.concept_ids.some((concept) => row.concept_ids.includes(concept)))
      .map((item) => item.id),
    expand: { material: 'material-context QUERY', stage: 'inspect STAGE_ID' },
  };
  if (patch) patch(focus);
  return focus;
}

const UNIT_MODULE = {
  'unit-fixture-sad-l02': 'module-fixture-m2',
  'unit-fixture-sad-l04': 'module-fixture-m2',
  'unit-fixture-analysis': 'module-fixture-m2',
  'unit-fixture-aml-l03': 'module-fixture-aml',
  'unit-fixture-aml-l04': 'module-fixture-aml',
};

/**
 * One exact route: `los.py material-span UNIT ROUTE [--extract]`. A route id
 * containing "remote" answers as registered-remote, "missing" as a local copy
 * that is not on this computer; anything else is a readable local PDF whose
 * excerpt exists only when `--extract` was asked for.
 */
function materialSpan(unitId, routeId, extract) {
  const base = {
    schema_version: 1,
    snapshot_id: SNAPSHOT,
    contract: 'material-span-v1',
    unit_id: unitId,
    module_id: UNIT_MODULE[unitId] ?? 'module-fixture-m2',
    route_id: routeId,
    source_id: 'source-fixture-book',
    analysis_refs: { analysis_notes: [], analysis_notes_total: 0, analysis_notes_truncated: false },
    expansion: null,
  };
  if (/remote/.test(routeId)) {
    return {
      ...base,
      locator: 'https://example.org/fixture-remote-lecture',
      url: 'https://example.org/fixture-remote-lecture',
      availability: 'remote-unobserved',
      spans: [],
    };
  }
  if (/missing/.test(routeId)) {
    return { ...base, locator: 'lectures/missing.pdf', url: null, availability: 'local-unavailable', spans: [] };
  }
  return {
    ...base,
    locator: 'lecture-slides/VL_02.pdf',
    url: null,
    availability: 'local-observed',
    analysis_refs: { analysis_notes: [], analysis_notes_total: 2, analysis_notes_truncated: false },
    spans: [{
      material_uri: 'material://source-fixture-book/lecture-slides/VL_02.pdf',
      format: 'pdf',
      file_sha256: `sha256:${'f'.repeat(64)}`,
      extraction: extract ? 'truncated' : 'not-requested',
      ...(extract ? {
        excerpt: '--- PDF p.1 ---\nFixture lecture deck\n--- PDF p.2 ---\nConditioning on an event',
        excerpt_truncated: true,
        pages: [1, 2],
        page_total: 12,
      } : {}),
    }],
    expansion: extract ? null : `material-span ${unitId} ${routeId} --extract`,
  };
}

/** Route one CLI read the way the gateway would answer it. */
function answerAbilityRead(args, options = {}) {
  if (args[0] === 'ability-context') {
    const id = args[1] && !args[1].startsWith('--') ? args[1] : null;
    return id
      ? abilityFocus(id, options.patchFocus)
      : abilityBrief(options.patchBrief);
  }
  if (args[0] === 'material-span') {
    return materialSpan(args[1], args[2], args.includes('--extract'));
  }
  return null;
}

module.exports = {
  ABILITY_SNAPSHOT: SNAPSHOT,
  ABILITIES,
  BRIDGES,
  CANDIDATES,
  DEFINITIONS,
  abilityBrief,
  abilityFocus,
  materialSpan,
  answerAbilityRead,
};
