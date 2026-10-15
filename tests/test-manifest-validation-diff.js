'use strict';

/**
 * LearningOS Architecture Convergence — Phase 5
 * Task S31-06R: Differential Manifest Validation Suite
 *
 * This test suite systematically exercises the real compiled Ajv standalone
 * validator against the real handwritten assertManifest decoder using deterministic
 * mutations across the full schema property graph.
 *
 * Authority: SPEC §15 and LearningOS-Phase5-Agent-Execution-Plan.md
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { createSourceModuleLoader } = require('./source-module-loader');

const ROOT = path.dirname(__dirname);
const load = createSourceModuleLoader(ROOT);

// Load the real handwritten assertion function and contract constants
const {
  assertManifest,
  MANIFEST_CONTRACT_VERSION,
  MANIFEST_SCHEMA_SHA256,
} = load('src/contracts/manifest.ts');

// Load the real compiled Ajv standalone validator
const validateManifest = require('../src/contracts/generated/manifest.validator.cjs');

// Load ManifestStore for preflight verification
const { ManifestStore } = load('src/manifest-store.ts');

// Load base fixture
const FIXTURE_PATH = path.join(ROOT, 'fixture-vault/generated/manifest.json');
const rawFixture = fs.readFileSync(FIXTURE_PATH, 'utf8');
const baseFixture = JSON.parse(rawFixture);

function clone(data) {
  return JSON.parse(JSON.stringify(data));
}

// ---------------------------------------------------------------------------
// Branch Seeds: Verified valid seeds for schema branches not in base fixture
// ---------------------------------------------------------------------------

// Seed 1: Base fixture
const seedBase = clone(baseFixture);

// Seed 2: Fixture with compatibility-alias in records
const seedWithAlias = clone(baseFixture);
seedWithAlias.records.push({
  id: 'alias-fixture-thesis-shortcut',
  type: 'compatibility-alias',
  target_id: 'project-fixture-thesis',
  target_type: 'project',
  path: 'projects/aliases.yaml',
});

// Seed 3: Fixture with learning-path in records
const seedWithPath = clone(baseFixture);
seedWithPath.records.push({
  id: 'path-fixture-differential',
  type: 'learning-path',
  revision: 1,
  title: 'Differential Path Verification',
  path: 'paths/differential.yaml',
  workspace_id: 'workspace-fixture-main',
  area: 'university',
  module_id: 'module-fixture-aml',
  status: 'active',
  current_stage: 'stage-path-diff-1',
  created: '2026-09-01',
  updated: null,
  objective: 'Verify learning-path record schema differentially',
  source_plan: null,
  stages: [
    {
      id: 'stage-path-diff-1',
      title: 'Initial verification stage',
      status: 'active',
      objective: 'Run differential tests',
      done_when: ['All assertions pass'],
      resources: [],
      notes_text: 'Stage notes',
      notes_updated: null,
    },
  ],
  shelving: { state: 'none', items: [] },
  archived: false,
});

// Seed 4: Fixture with knowledge-node evidence on module_concept_edges
const seedWithKnowledgeEdge = clone(baseFixture);
seedWithKnowledgeEdge.module_concept_edges.push({
  module_id: 'module-fixture-aml',
  concept_id: 'concept-fixture-1',
  evidence: [
    {
      kind: 'knowledge-node',
      unit_id: 'unit-fixture-aml-foundations',
      node_id: 'knowledge-fixture-ml-intro',
    },
  ],
});

// Seed 5: Fixture with noteRecord having atlas_question and material_analysis (Gap 1)
const seedWithNoteAnalysis = clone(baseFixture);
const noteAnalysisRecord = clone(baseFixture.records.find((r) => r.type === 'note'));
noteAnalysisRecord.id = 'note-fixture-with-analysis';
noteAnalysisRecord.title = 'Question Note with Analysis and Atlas Question';
noteAnalysisRecord.path = 'knowledge/notes/mathematics/note-fixture-with-analysis.md';
noteAnalysisRecord.role = 'question';
noteAnalysisRecord.atlas_question = {
  state: 'open',
  answer_notes: ['note-fixture-probability'],
  target: {
    concepts: ['concept-bayes'],
  },
};
noteAnalysisRecord.material_analysis = {
  resolution: 'resolved',
  material: 'lecture-slides.pdf',
  source_id: 'source-fixture-book',
  recorded_source_digest: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  inspected_range: { start: 1, end: 10 },
  frozen_input_sha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  frozen_input_bytes: 1024,
  anchors: [
    {
      topic: 'Foundations',
      purpose: 'Derivation',
      locator: 'p. 5',
      note: 'Core derivation anchor',
    },
  ],
};
seedWithNoteAnalysis.records.push(noteAnalysisRecord);

// Seed 6: Fixture with studyMap having active detours and proposed shelving (Gap 2)
const seedWithDetourShelving = clone(baseFixture);
seedWithDetourShelving.study_maps[0].detours = [
  {
    id: 'detour-fixture-calc',
    title: 'Review Multivariable Calculus',
    spawned_by_stage: seedWithDetourShelving.study_maps[0].stages[0].id,
    classification: 'required-now',
    status: 'open',
    return_to_stage: seedWithDetourShelving.study_maps[0].stages[0].id,
    resolution: 'Pending review',
  },
];
seedWithDetourShelving.study_maps[0].shelving = {
  state: 'proposed',
  proposal_path: 'work/active/shelving-proposal.md',
  summary: 'Shelve exploratory notes',
  items: [
    {
      id: 'proposal-fixture-1',
      kind: 'archive-map',
      title: 'Archive exploratory map',
      destination: 'archive/maps',
      rationale: 'Completed semester',
      diff: '+ addition',
      content: 'Archived content',
      selected: true,
    },
  ],
};

// Seed 7: Fixture with unit-material-synthesis inside records (Gap 3)
const seedWithSynthesisRecord = clone(baseFixture);
seedWithSynthesisRecord.records.push(clone(baseFixture.unit_material_syntheses[0]));

const SEEDS = {
  base: seedBase,
  'with-alias': seedWithAlias,
  'with-path': seedWithPath,
  'with-knowledge-edge': seedWithKnowledgeEdge,
  'with-note-analysis': seedWithNoteAnalysis,
  'with-detour-shelving': seedWithDetourShelving,
  'with-synthesis-record': seedWithSynthesisRecord,
};

// ---------------------------------------------------------------------------
// Structural Schema Definitions and Constants
// ---------------------------------------------------------------------------

const TOP_LEVEL_PROPERTIES = [
  '_generated', 'academic_deadlines', 'ai_actions', 'artifact_revisions',
  'backlinks', 'counts', 'garden_entries', 'indexes', 'module_concept_edges',
  'module_source_maps', 'modules', 'programs', 'progress', 'project_aliases',
  'project_relationships', 'projects', 'records', 'relations', 'resume_pointer',
  'review_items', 'semesters', 'stages', 'study_maps', 'thematic_groups',
  'topic_packs', 'topics', 'unit_material_syntheses', 'units',
];

const ARRAY_PROPERTIES = [
  'academic_deadlines', 'garden_entries', 'review_items', 'module_source_maps',
  'modules', 'programs', 'project_relationships', 'projects', 'records',
  'relations', 'semesters', 'stages', 'study_maps', 'thematic_groups',
  'topic_packs', 'topics', 'unit_material_syntheses', 'units',
];

const COLLECTION_ROW_GUARDS = {
  academic_deadlines: 'T-09',
  garden_entries: 'T-10',
  relations: 'T-11',
  review_items: 'T-12',
  semesters: 'T-13',
  thematic_groups: 'T-14',
  topic_packs: 'T-15',
  topics: 'T-16',
  modules: 'T-17',
  programs: 'T-18',
  projects: 'T-19',
  project_relationships: 'T-20',
  module_source_maps: 'T-21',
  units: 'T-22',
  study_maps: 'T-23',
  stages: 'T-24',
  records: 'T-25',
  unit_material_syntheses: 'T-47',
};

const INDEX_KEYS = [
  'component_to_units', 'concept_to_modules', 'concept_to_units',
  'module_to_concepts', 'module_to_units', 'project_aliases',
  'project_to_relationships', 'project_to_units', 'project_to_workspaces',
  'source_to_modules', 'source_to_units', 'unit_to_concepts',
  'unit_to_material_synthesis', 'unit_to_study_map', 'workspace_to_modules',
  'workspace_to_units',
];

const GENERATED_KEYS = [
  'contract_version', 'generated_at', 'generator', 'schema_sha256',
  'snapshot_id', 'source_dirty', 'source_fingerprint', 'source_revision', 'warning',
];

const GUARD_METADATA = {
  'T-01': { loc: 'manifest.ts:719', desc: 'Top-level array assertion (requireArray for 18 collections)', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-02': { loc: 'manifest.ts:726', desc: 'Root and _generated object assertions', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-03': { loc: 'manifest.ts:737', desc: 'Root exactKeys assertion (28 declared properties)', class: 'PARTIALLY_COVERED' },
  'T-04': { loc: 'manifest.ts:744', desc: '_generated exactKeys assertion (9 declared properties)', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-05': { loc: 'manifest.ts:747', desc: 'Contract version matching constant MANIFEST_CONTRACT_VERSION (15)', class: 'CONTEXTUAL_PRESERVE' },
  'T-06': { loc: 'manifest.ts:752', desc: 'Schema SHA-256 matching constant MANIFEST_SCHEMA_SHA256 (pin)', class: 'CONTEXTUAL_PRESERVE' },
  'T-07': { loc: 'manifest.ts:764', desc: '_generated metadata attributes type and pattern assertions', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-08': { loc: 'manifest.ts:791', desc: 'ai_actions closed projection validation (validAiActions)', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-09': { loc: 'manifest.ts:794', desc: 'academic_deadlines row projection validation', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-10': { loc: 'manifest.ts:797', desc: 'garden_entries row projection validation', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-11': { loc: 'manifest.ts:800', desc: 'relations row projection validation', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-12': { loc: 'manifest.ts:803', desc: 'review_items row projection validation', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-13': { loc: 'manifest.ts:806', desc: 'semesters row projection validation', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-14': { loc: 'manifest.ts:809', desc: 'thematic_groups row projection validation', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-15': { loc: 'manifest.ts:812', desc: 'topic_packs row projection validation', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-16': { loc: 'manifest.ts:815', desc: 'topics row projection validation', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-17': { loc: 'manifest.ts:819', desc: 'modules row projection validation (components, exam, attempts)', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-18': { loc: 'manifest.ts:824', desc: 'programs row projection validation (program semesters)', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-19': { loc: 'manifest.ts:829', desc: 'projects row projection validation (boundaries, structures, files)', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-20': { loc: 'manifest.ts:834', desc: 'project_relationships row projection validation', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-21': { loc: 'manifest.ts:839', desc: 'module_source_maps row projection validation (entries, routes)', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-22': { loc: 'manifest.ts:844', desc: 'units row projection validation (artifacts, notes, maps)', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-23': { loc: 'manifest.ts:849', desc: 'study_maps row projection validation (stages, resources, shelvings)', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-24': { loc: 'manifest.ts:854', desc: 'stages flat stage row projection validation', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-25': { loc: 'manifest.ts:859', desc: 'records polymorphic union row validation (all record variants)', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-26': { loc: 'manifest.ts:865', desc: 'Secondary surfaces object assertion (isRecord on 8 keys)', class: 'PARTIALLY_COVERED' },
  'T-27': { loc: 'manifest.ts:870 (historical)', desc: 'artifact_revisions non-negative integer map validation (retired)', class: 'RETIRED' },
  'T-28': { loc: 'manifest.ts:873', desc: 'backlinks closed projection validation (validBacklinks)', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-29': { loc: 'manifest.ts:876', desc: 'counts closed projection validation (27 natural metrics)', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-30': { loc: 'manifest.ts:879', desc: 'progress closed projection validation (validProgress)', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-31': { loc: 'manifest.ts:882 (historical)', desc: 'project_aliases string map validation (retired)', class: 'RETIRED' },
  'T-32': { loc: 'manifest.ts:885', desc: 'resume_pointer closed projection validation (validResumePointer)', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-33': { loc: 'manifest.ts:890', desc: 'module_concept_edges array assertion', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-34': { loc: 'manifest.ts:894', desc: 'module_concept_edges row exactKeys assertion (module_id, concept_id, evidence)', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-35': { loc: 'manifest.ts:897', desc: 'module_concept_edges module_id and concept_id identifier patterns', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-36': { loc: 'manifest.ts:902', desc: 'module_concept_edges evidence non-empty array assertion (minItems: 1)', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-37': { loc: 'manifest.ts:906', desc: 'module_concept_edges evidence item unit_id identifier pattern', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-38': { loc: 'manifest.ts:912', desc: 'stage-concept evidence exactKeys and identifier patterns', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-39': { loc: 'manifest.ts:917', desc: 'knowledge-node evidence exactKeys and identifier pattern', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-40': { loc: 'manifest.ts:920', desc: 'module_concept_edges evidence discriminator kind validation', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-41': { loc: 'manifest.ts:927', desc: 'indexes object assertion (validJsonObject)', class: 'REMOVED' },
  'T-42': { loc: 'manifest.ts:938', desc: 'indexes exactKeys assertion (16 declared index keys)', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-43': { loc: 'manifest.ts:950', desc: 'indexes sub-map object assertion (isRecord on 6 specific keys)', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-44': { loc: 'manifest.ts:964', desc: 'indexes unique string array multi-map assertion (13 keys)', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-45': { loc: 'manifest.ts:971', desc: 'indexes string single-map assertion (2 keys)', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-46': { loc: 'manifest.ts:977', desc: 'indexes unit_to_material_synthesis synthesis ID identifier pattern', class: 'PROVEN_FOR_TESTED_CASES' },
  'T-47': { loc: 'manifest.ts:982', desc: 'unit_material_syntheses projection validation (validMaterialSynthesis)', class: 'PROVEN_FOR_TESTED_CASES' },
};

const mutations = [];
let nextId = 1;

function addMutation(spec) {
  const id = `MUT-${String(nextId++).padStart(4, '0')}`;
  mutations.push({
    id,
    seed: spec.seed || 'base',
    category: spec.category,
    propertyFamily: spec.propertyFamily,
    schemaPointer: spec.schemaPointer,
    schemaKeyword: spec.schemaKeyword,
    operation: spec.operation,
    guardId: spec.guardId || null,
    expectedDiff: Boolean(spec.expectedDiff),
    mutate: spec.mutate,
  });
}

// ---------------------------------------------------------------------------
// CATEGORY A: TYPE VIOLATIONS
// ---------------------------------------------------------------------------

// Root properties primitive type flips (exercising T-01, T-02, T-26, T-33, T-41)
for (const prop of TOP_LEVEL_PROPERTIES) {
  let guard = 'T-26';
  if (prop === '_generated') {
    guard = 'T-02';
  } else if (prop === 'module_concept_edges') {
    guard = 'T-33';
  } else if (prop === 'indexes') {
    guard = 'T-41';
  } else if (ARRAY_PROPERTIES.includes(prop)) {
    guard = 'T-01';
  }

  addMutation({
    category: 'A. TYPE',
    propertyFamily: 'root',
    schemaPointer: `#/properties/${prop}`,
    schemaKeyword: 'type',
    operation: `Replace root property "${prop}" with incompatible primitive (number 42)`,
    guardId: guard,
    mutate: (m) => { m[prop] = 42; },
  });
}

// Array item type flips across all 18 collections (exercising T-09 to T-25, T-47)
for (const arrayProp of ARRAY_PROPERTIES) {
  addMutation({
    category: 'A. TYPE',
    propertyFamily: arrayProp,
    schemaPointer: `#/properties/${arrayProp}/items`,
    schemaKeyword: 'type',
    operation: `Insert primitive number 42 into "${arrayProp}" array`,
    guardId: COLLECTION_ROW_GUARDS[arrayProp],
    mutate: (m) => { m[arrayProp].push(42); },
  });
}

// Type violations on nested string fields
addMutation({
  category: 'A. TYPE',
  propertyFamily: 'relations',
  schemaPointer: '#/$defs/relation/properties/type',
  schemaKeyword: 'type',
  operation: 'Set number 42 on relation type where string is required',
  guardId: 'T-11',
  mutate: (m) => { m.relations[0].type = 42; },
});

addMutation({
  category: 'A. TYPE',
  propertyFamily: 'study_maps',
  schemaPointer: '#/$defs/studyMap/properties/id',
  schemaKeyword: 'type',
  operation: 'Set number 42 on study_maps[0].id where string is required',
  guardId: 'T-23',
  mutate: (m) => { m.study_maps[0].id = 42; },
});

addMutation({
  category: 'A. TYPE',
  propertyFamily: 'stages',
  schemaPointer: '#/$defs/flatStage/properties/unit_id',
  schemaKeyword: 'type',
  operation: 'Set number 42 on stages[0].unit_id where string is required',
  guardId: 'T-24',
  mutate: (m) => { m.stages[0].unit_id = 42; },
});

addMutation({
  category: 'A. TYPE',
  propertyFamily: 'topics',
  schemaPointer: '#/$defs/topic/properties/id',
  schemaKeyword: 'type',
  operation: 'Set number 42 on topics[0].id where string is required',
  guardId: 'T-16',
  mutate: (m) => { m.topics[0].id = 42; },
});

addMutation({
  category: 'A. TYPE',
  propertyFamily: 'thematic_groups',
  schemaPointer: '#/$defs/thematicGroup/properties/id',
  schemaKeyword: 'type',
  operation: 'Set number 42 on thematic_groups[0].id where string is required',
  guardId: 'T-14',
  mutate: (m) => { m.thematic_groups[0].id = 42; },
});

addMutation({
  category: 'A. TYPE',
  propertyFamily: 'project_aliases',
  schemaPointer: '#/$defs/stringMap/additionalProperties',
  schemaKeyword: 'type',
  operation: 'Set number 42 on project_aliases value where string is required',
  guardId: 'T-31',
  mutate: (m) => {
    const k = Object.keys(m.project_aliases)[0];
    m.project_aliases[k] = 42;
  },
});

addMutation({
  category: 'A. TYPE',
  propertyFamily: 'indexes',
  schemaPointer: '#/$defs/indexes/properties/concept_to_units',
  schemaKeyword: 'type',
  operation: 'Replace index sub-map concept_to_units with primitive number 42',
  guardId: 'T-43',
  mutate: (m) => { m.indexes.concept_to_units = 42; },
});

addMutation({
  category: 'A. TYPE',
  propertyFamily: 'indexes',
  schemaPointer: '#/$defs/stringMap/additionalProperties',
  schemaKeyword: 'type',
  operation: 'Set number 42 on indexes.unit_to_study_map value where string is required',
  guardId: 'T-45',
  mutate: (m) => {
    const k = Object.keys(m.indexes.unit_to_study_map)[0];
    m.indexes.unit_to_study_map[k] = 42;
  },
});

// Gap 4: Coordination record type flip on section value
addMutation({
  category: 'A. TYPE',
  propertyFamily: 'records',
  schemaPointer: '#/$defs/coordinationRecord/properties/sections/properties/Commitments',
  schemaKeyword: 'type',
  operation: 'Set number 42 on coordination.sections.Commitments where string required',
  guardId: 'T-25',
  mutate: (m) => {
    const rec = m.records.find((r) => r.type === 'coordination');
    rec.sections.Commitments = 42;
  },
});

// S31-06B: T-07 constituent condition type violations
addMutation({
  category: 'A. TYPE',
  propertyFamily: '_generated',
  schemaPointer: '#/$defs/generated/properties/generated_at',
  schemaKeyword: 'type',
  operation: 'Set number 42 on _generated.generated_at where string is required',
  guardId: 'T-07',
  mutate: (m) => { m._generated.generated_at = 42; },
});

addMutation({
  category: 'A. TYPE',
  propertyFamily: '_generated',
  schemaPointer: '#/$defs/generated/properties/generator',
  schemaKeyword: 'type',
  operation: 'Set number 42 on _generated.generator where string is required',
  guardId: 'T-07',
  mutate: (m) => { m._generated.generator = 42; },
});

addMutation({
  category: 'A. TYPE',
  propertyFamily: '_generated',
  schemaPointer: '#/$defs/generated/properties/source_dirty',
  schemaKeyword: 'type',
  operation: 'Set string "true" on _generated.source_dirty where boolean is required',
  guardId: 'T-07',
  mutate: (m) => { m._generated.source_dirty = 'true'; },
});

addMutation({
  category: 'A. TYPE',
  propertyFamily: '_generated',
  schemaPointer: '#/$defs/generated/properties/source_revision',
  schemaKeyword: 'type',
  operation: 'Set number 42 on _generated.source_revision where string or null is required',
  guardId: 'T-07',
  mutate: (m) => { m._generated.source_revision = 42; },
});

addMutation({
  category: 'A. TYPE',
  propertyFamily: '_generated',
  schemaPointer: '#/$defs/generated/properties/warning',
  schemaKeyword: 'type',
  operation: 'Set number 42 on _generated.warning where string is required',
  guardId: 'T-07',
  mutate: (m) => { m._generated.warning = 42; },
});

// ---------------------------------------------------------------------------
// CATEGORY B: REQUIRED PROPERTY VIOLATIONS
// ---------------------------------------------------------------------------

// Delete each root property (exercising T-03)
for (const prop of TOP_LEVEL_PROPERTIES) {
  addMutation({
    category: 'B. REQUIRED',
    propertyFamily: 'root',
    schemaPointer: `#/required/${prop}`,
    schemaKeyword: 'required',
    operation: `Delete required root property "${prop}"`,
    guardId: 'T-03',
    mutate: (m) => { delete m[prop]; },
  });
}

// Delete each _generated metadata property (exercising T-04)
for (const key of GENERATED_KEYS) {
  addMutation({
    category: 'B. REQUIRED',
    propertyFamily: '_generated',
    schemaPointer: `#/$defs/generated/required/${key}`,
    schemaKeyword: 'required',
    operation: `Delete required metadata property "_generated.${key}"`,
    guardId: 'T-04',
    mutate: (m) => { delete m._generated[key]; },
  });
}

// Delete each of 16 index keys (exercising T-42)
for (const indexKey of INDEX_KEYS) {
  addMutation({
    category: 'B. REQUIRED',
    propertyFamily: 'indexes',
    schemaPointer: `#/$defs/indexes/required/${indexKey}`,
    schemaKeyword: 'required',
    operation: `Delete required index property "indexes.${indexKey}"`,
    guardId: 'T-42',
    mutate: (m) => { delete m.indexes[indexKey]; },
  });
}

// Delete required properties on collection items
const itemDeletions = [
  ['modules', 0, 'status', '#/$defs/moduleRecord/required/status', 'T-17'],
  ['programs', 0, 'title', '#/$defs/programRecord/required/title', 'T-18'],
  ['projects', 0, 'status', '#/$defs/projectRecord/required/status', 'T-19'],
  ['project_relationships', 0, 'relation_type', '#/$defs/projectRelationship/required/relation_type', 'T-20'],
  ['module_source_maps', 0, 'sources', '#/$defs/moduleSourceMap/required/sources', 'T-21'],
  ['units', 0, 'title', '#/$defs/projectedUnit/required/title', 'T-22'],
  ['study_maps', 0, 'stages', '#/$defs/studyMap/required/stages', 'T-23'],
  ['stages', 0, 'unit_id', '#/$defs/flatStage/required/unit_id', 'T-24'],
  ['stages', 0, 'module_id', '#/$defs/flatStage/required/module_id', 'T-24'],
  ['academic_deadlines', 0, 'label', '#/$defs/academicDeadline/required/label', 'T-09'],
  ['garden_entries', 0, 'title', '#/$defs/gardenEntry/required/title', 'T-10'],
  ['relations', 0, 'from', '#/$defs/relation/required/from', 'T-11'],
  ['review_items', 0, 'title', '#/$defs/reviewItem/required/title', 'T-12'],
  ['semesters', 0, 'title', '#/$defs/semester/required/title', 'T-13'],
  ['thematic_groups', 0, 'title', '#/$defs/thematicGroup/required/title', 'T-14'],
  ['topic_packs', 0, 'revision', '#/$defs/collectionRecord/required/revision', 'T-15'],
  ['topics', 0, 'title', '#/$defs/topic/required/title', 'T-16'],
  ['unit_material_syntheses', 0, 'freshness', '#/$defs/unitMaterialSynthesisProjection/required/freshness', 'T-47'],
  ['unit_material_syntheses', 0, 'completeness', '#/$defs/unitMaterialSynthesisProjection/required/completeness', 'T-47'],
];

for (const [coll, idx, field, pointer, guardId] of itemDeletions) {
  addMutation({
    category: 'B. REQUIRED',
    propertyFamily: coll,
    schemaPointer: pointer,
    schemaKeyword: 'required',
    operation: `Delete required property "${field}" from "${coll}[${idx}]"`,
    guardId,
    mutate: (m) => { delete m[coll][idx][field]; },
  });
}

// Gap 1: NoteRecord nested material_analysis.inspected_range missing end
addMutation({
  category: 'B. REQUIRED',
  propertyFamily: 'records',
  seed: 'with-note-analysis',
  schemaPointer: '#/$defs/noteRecord/properties/material_analysis/properties/inspected_range/required/end',
  schemaKeyword: 'required',
  operation: 'Delete required "end" from material_analysis.inspected_range',
  guardId: 'T-25',
  mutate: (m) => {
    const rec = m.records.find((r) => r.id === 'note-fixture-with-analysis');
    delete rec.material_analysis.inspected_range.end;
  },
});

// Gap 1: NoteRecord resolved material_analysis missing source_id (allOf if/then)
addMutation({
  category: 'B. REQUIRED',
  propertyFamily: 'records',
  seed: 'with-note-analysis',
  schemaPointer: '#/$defs/noteRecord/properties/material_analysis/allOf/0/then/required/source_id',
  schemaKeyword: 'required',
  operation: 'Delete required "source_id" from resolved material_analysis (allOf requirement)',
  guardId: 'T-25',
  mutate: (m) => {
    const rec = m.records.find((r) => r.id === 'note-fixture-with-analysis');
    delete rec.material_analysis.source_id;
  },
});

// Gap 2: Detour missing return_to_stage
addMutation({
  category: 'B. REQUIRED',
  propertyFamily: 'study_maps',
  seed: 'with-detour-shelving',
  schemaPointer: '#/$defs/studyMap/properties/detours/items/required/return_to_stage',
  schemaKeyword: 'required',
  operation: 'Delete required "return_to_stage" from study_maps[0].detours[0]',
  guardId: 'T-23',
  mutate: (m) => {
    delete m.study_maps[0].detours[0].return_to_stage;
  },
});

// Gap 3: Synthesis inside records missing source_map_revision
addMutation({
  category: 'B. REQUIRED',
  propertyFamily: 'records',
  seed: 'with-synthesis-record',
  schemaPointer: '#/$defs/unitMaterialSynthesisProjection/properties/basis/required/source_map_revision',
  schemaKeyword: 'required',
  operation: 'Delete required "source_map_revision" from unit-material-synthesis basis in records',
  guardId: 'T-25',
  mutate: (m) => {
    const rec = m.records[m.records.length - 1];
    delete rec.basis.source_map_revision;
  },
});

// Gap 4: CoordinationRecord missing required section
addMutation({
  category: 'B. REQUIRED',
  propertyFamily: 'records',
  schemaPointer: '#/$defs/coordinationRecord/properties/sections/required/Commitments',
  schemaKeyword: 'required',
  operation: 'Delete required section "Commitments" from coordination record in records',
  guardId: 'T-25',
  mutate: (m) => {
    const rec = m.records.find((r) => r.type === 'coordination');
    delete rec.sections.Commitments;
  },
});

// S31-06B: Auxiliary schema stageAttachment missing required label
addMutation({
  category: 'B. REQUIRED',
  propertyFamily: 'stages',
  schemaPointer: '#/$defs/stageAttachment/required/label',
  schemaKeyword: 'required',
  operation: 'Delete required property "label" from stageAttachment on stage',
  guardId: 'T-24',
  mutate: (m) => {
    m.stages[0].attachments = [{ path: 'notes/reference.pdf' }];
    m.study_maps[0].stages[0].attachments = [{ path: 'notes/reference.pdf' }];
  },
});

// ---------------------------------------------------------------------------
// CATEGORY C: ADDITIONAL PROPERTIES VIOLATIONS
// ---------------------------------------------------------------------------

addMutation({
  category: 'C. ADDITIONAL_PROPERTIES',
  propertyFamily: 'root',
  schemaPointer: '#/additionalProperties',
  schemaKeyword: 'additionalProperties',
  operation: 'Inject undeclared property on root manifest',
  guardId: 'T-03',
  mutate: (m) => { m.__unexpected_root_property__ = 'forbidden'; },
});

addMutation({
  category: 'C. ADDITIONAL_PROPERTIES',
  propertyFamily: '_generated',
  schemaPointer: '#/$defs/generated/additionalProperties',
  schemaKeyword: 'additionalProperties',
  operation: 'Inject undeclared property on _generated metadata',
  guardId: 'T-04',
  mutate: (m) => { m._generated.__unexpected_meta__ = 'forbidden'; },
});

addMutation({
  category: 'C. ADDITIONAL_PROPERTIES',
  propertyFamily: 'indexes',
  schemaPointer: '#/$defs/indexes/additionalProperties',
  schemaKeyword: 'additionalProperties',
  operation: 'Inject undeclared property on indexes object',
  guardId: 'T-42',
  mutate: (m) => { m.indexes.__unexpected_index__ = {}; },
});

addMutation({
  category: 'C. ADDITIONAL_PROPERTIES',
  propertyFamily: 'counts',
  schemaPointer: '#/$defs/counts/additionalProperties',
  schemaKeyword: 'additionalProperties',
  operation: 'Inject undeclared count metric on counts object',
  guardId: 'T-29',
  mutate: (m) => { m.counts.__unexpected_count__ = 1; },
});

addMutation({
  category: 'C. ADDITIONAL_PROPERTIES',
  propertyFamily: 'resume_pointer',
  schemaPointer: '#/$defs/resumePointer/additionalProperties',
  schemaKeyword: 'additionalProperties',
  operation: 'Inject undeclared property on resume_pointer',
  guardId: 'T-32',
  mutate: (m) => { m.resume_pointer.__unexpected_field__ = 'forbidden'; },
});

addMutation({
  category: 'C. ADDITIONAL_PROPERTIES',
  propertyFamily: 'backlinks',
  schemaPointer: '#/$defs/backlinks/additionalProperties',
  schemaKeyword: 'additionalProperties',
  operation: 'Inject undeclared property on backlinks object',
  guardId: 'T-28',
  mutate: (m) => { m.backlinks.__unexpected_backlink__ = {}; },
});

addMutation({
  category: 'C. ADDITIONAL_PROPERTIES',
  propertyFamily: 'module_concept_edges',
  schemaPointer: '#/$defs/moduleConceptEdge/additionalProperties',
  schemaKeyword: 'additionalProperties',
  operation: 'Inject unexpected property on module_concept_edges row',
  guardId: 'T-34',
  mutate: (m) => { m.module_concept_edges[0].__unexpected_edge_prop__ = 'forbidden'; },
});

for (const coll of ARRAY_PROPERTIES) {
  addMutation({
    category: 'C. ADDITIONAL_PROPERTIES',
    propertyFamily: coll,
    schemaPointer: `#/properties/${coll}/items/additionalProperties`,
    schemaKeyword: 'additionalProperties',
    operation: `Inject unexpected property "__unexpected_extension__" on ${coll}[0]`,
    guardId: COLLECTION_ROW_GUARDS[coll],
    mutate: (m) => { m[coll][0].__unexpected_extension__ = true; },
  });
}

// Gap 1: NoteRecord nested anchor extra property
addMutation({
  category: 'C. ADDITIONAL_PROPERTIES',
  propertyFamily: 'records',
  seed: 'with-note-analysis',
  schemaPointer: '#/$defs/noteRecord/properties/material_analysis/properties/anchors/items/additionalProperties',
  schemaKeyword: 'additionalProperties',
  operation: 'Inject unexpected property on material_analysis anchor',
  guardId: 'T-25',
  mutate: (m) => {
    const rec = m.records.find((r) => r.id === 'note-fixture-with-analysis');
    rec.material_analysis.anchors[0].__unexpected_anchor__ = true;
  },
});

// Gap 1: NoteRecord atlas_question extra property
addMutation({
  category: 'C. ADDITIONAL_PROPERTIES',
  propertyFamily: 'records',
  seed: 'with-note-analysis',
  schemaPointer: '#/$defs/noteRecord/properties/atlas_question/additionalProperties',
  schemaKeyword: 'additionalProperties',
  operation: 'Inject unexpected property on note.atlas_question',
  guardId: 'T-25',
  mutate: (m) => {
    const rec = m.records.find((r) => r.id === 'note-fixture-with-analysis');
    rec.atlas_question.__unexpected_question__ = true;
  },
});

// Gap 2: Detour extra property
addMutation({
  category: 'C. ADDITIONAL_PROPERTIES',
  propertyFamily: 'study_maps',
  seed: 'with-detour-shelving',
  schemaPointer: '#/$defs/studyMap/properties/detours/items/additionalProperties',
  schemaKeyword: 'additionalProperties',
  operation: 'Inject unexpected property on study_maps[0].detours[0]',
  guardId: 'T-23',
  mutate: (m) => {
    m.study_maps[0].detours[0].__unexpected_detour__ = true;
  },
});

// Gap 2: Shelving item extra property
addMutation({
  category: 'C. ADDITIONAL_PROPERTIES',
  propertyFamily: 'study_maps',
  seed: 'with-detour-shelving',
  schemaPointer: '#/$defs/studyMap/properties/shelving/properties/items/items/additionalProperties',
  schemaKeyword: 'additionalProperties',
  operation: 'Inject unexpected property on shelving item',
  guardId: 'T-23',
  mutate: (m) => {
    m.study_maps[0].shelving.items[0].__unexpected_shelving_item__ = true;
  },
});

// Gap 3: Synthesis inside records extra property
addMutation({
  category: 'C. ADDITIONAL_PROPERTIES',
  propertyFamily: 'records',
  seed: 'with-synthesis-record',
  schemaPointer: '#/$defs/unitMaterialSynthesisProjection/additionalProperties',
  schemaKeyword: 'additionalProperties',
  operation: 'Inject unexpected property on unit-material-synthesis record in records',
  guardId: 'T-25',
  mutate: (m) => {
    const rec = m.records[m.records.length - 1];
    rec.__unexpected_synthesis_rec__ = true;
  },
});

// Gap 4: CoordinationRecord sections extra property
addMutation({
  category: 'C. ADDITIONAL_PROPERTIES',
  propertyFamily: 'records',
  schemaPointer: '#/$defs/coordinationRecord/properties/sections/additionalProperties',
  schemaKeyword: 'additionalProperties',
  operation: 'Inject unexpected property into coordination.sections',
  guardId: 'T-25',
  mutate: (m) => {
    const rec = m.records.find((r) => r.type === 'coordination');
    rec.sections.__unexpected_section__ = 'forbidden';
  },
});

// ---------------------------------------------------------------------------
// CATEGORY D: ENUM AND CONST VIOLATIONS
// ---------------------------------------------------------------------------

const enumCases = [
  ['modules', 0, 'status', 'not-a-valid-module-status', '#/$defs/moduleRecord/properties/status', 'T-17'],
  ['projects', 0, 'status', 'hyperactive', '#/$defs/projectRecord/properties/status', 'T-19'],
  ['project_relationships', 0, 'relation_type', 'friendly-alliance', '#/$defs/projectRelationship/properties/relation_type', 'T-20'],
  ['garden_entries', 0, 'status', 'blooming', '#/$defs/gardenEntry/properties/status', 'T-10'],
  ['study_maps', 0, 'stages.0.target_kind', 'telepathic-transmission', '#/$defs/projectedStage/properties/target_kind', 'T-23'],
  ['study_maps', 0, 'shelving.state', 'evaporated', '#/$defs/studyMap/properties/shelving', 'T-23'],
  ['unit_material_syntheses', 0, 'freshness.status', 'fermented', '#/$defs/unitMaterialSynthesisProjection/properties/freshness/properties/status', 'T-47'],
];

for (const [coll, idx, pathStr, outsider, pointer, guardId] of enumCases) {
  addMutation({
    category: 'D. ENUM_CONST',
    propertyFamily: coll,
    schemaPointer: pointer,
    schemaKeyword: 'enum',
    operation: `Set enum field "${coll}[${idx}].${pathStr}" to outsider value "${outsider}"`,
    guardId,
    mutate: (m) => {
      const parts = pathStr.split('.');
      let cur = m[coll][idx];
      for (let i = 0; i < parts.length - 1; i++) {
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = outsider;
    },
  });
}

// Const violation on contract_version (exercising T-05)
addMutation({
  category: 'D. ENUM_CONST',
  propertyFamily: '_generated',
  schemaPointer: '#/$defs/generated/properties/contract_version',
  schemaKeyword: 'const',
  operation: 'Set contract_version to wrong version (14 instead of 15)',
  guardId: 'T-05',
  mutate: (m) => { m._generated.contract_version = 14; },
});

// Const violation on ai_actions contract_version (exercising T-08)
addMutation({
  category: 'D. ENUM_CONST',
  propertyFamily: 'ai_actions',
  schemaPointer: '#/$defs/aiActions/properties/contract_version',
  schemaKeyword: 'const',
  operation: 'Set invalid contract_version (2 instead of 1) in ai_actions',
  guardId: 'T-08',
  mutate: (m) => { m.ai_actions.contract_version = 2; },
});

// Gap 1: Material analysis resolution enum violation
addMutation({
  category: 'D. ENUM_CONST',
  propertyFamily: 'records',
  seed: 'with-note-analysis',
  schemaPointer: '#/$defs/noteRecord/properties/material_analysis/properties/resolution',
  schemaKeyword: 'enum',
  operation: 'Set invalid resolution "stray" on note.material_analysis',
  guardId: 'T-25',
  mutate: (m) => {
    const rec = m.records.find((r) => r.id === 'note-fixture-with-analysis');
    rec.material_analysis.resolution = 'stray';
  },
});

// Gap 1: Atlas question state enum violation
addMutation({
  category: 'D. ENUM_CONST',
  propertyFamily: 'records',
  seed: 'with-note-analysis',
  schemaPointer: '#/$defs/noteRecord/properties/atlas_question/properties/state',
  schemaKeyword: 'enum',
  operation: 'Set invalid state "pending" on note.atlas_question',
  guardId: 'T-25',
  mutate: (m) => {
    const rec = m.records.find((r) => r.id === 'note-fixture-with-analysis');
    rec.atlas_question.state = 'pending';
  },
});

// Gap 2: Detour classification enum violation
addMutation({
  category: 'D. ENUM_CONST',
  propertyFamily: 'study_maps',
  seed: 'with-detour-shelving',
  schemaPointer: '#/$defs/studyMap/properties/detours/items/properties/classification',
  schemaKeyword: 'enum',
  operation: 'Set invalid classification "optional" on detour',
  guardId: 'T-23',
  mutate: (m) => {
    m.study_maps[0].detours[0].classification = 'optional';
  },
});

// Gap 2: Detour status enum violation
addMutation({
  category: 'D. ENUM_CONST',
  propertyFamily: 'study_maps',
  seed: 'with-detour-shelving',
  schemaPointer: '#/$defs/studyMap/properties/detours/items/properties/status',
  schemaKeyword: 'enum',
  operation: 'Set invalid status "in-progress" on detour',
  guardId: 'T-23',
  mutate: (m) => {
    m.study_maps[0].detours[0].status = 'in-progress';
  },
});

// Gap 2: Shelving state enum violation
addMutation({
  category: 'D. ENUM_CONST',
  propertyFamily: 'study_maps',
  seed: 'with-detour-shelving',
  schemaPointer: '#/$defs/studyMap/properties/shelving/properties/state',
  schemaKeyword: 'enum',
  operation: 'Set invalid state "shelved" on study_maps[0].shelving',
  guardId: 'T-23',
  mutate: (m) => {
    m.study_maps[0].shelving.state = 'shelved';
  },
});

// Gap 2: Shelving item kind enum violation
addMutation({
  category: 'D. ENUM_CONST',
  propertyFamily: 'study_maps',
  seed: 'with-detour-shelving',
  schemaPointer: '#/$defs/studyMap/properties/shelving/properties/items/items/properties/kind',
  schemaKeyword: 'enum',
  operation: 'Set invalid kind "external-archive" on shelving item',
  guardId: 'T-23',
  mutate: (m) => {
    m.study_maps[0].shelving.items[0].kind = 'external-archive';
  },
});

// Gap 3: Synthesis inside records freshness status enum violation
addMutation({
  category: 'D. ENUM_CONST',
  propertyFamily: 'records',
  seed: 'with-synthesis-record',
  schemaPointer: '#/$defs/unitMaterialSynthesisProjection/properties/freshness/properties/status',
  schemaKeyword: 'enum',
  operation: 'Set invalid status "expired" on unit-material-synthesis in records',
  guardId: 'T-25',
  mutate: (m) => {
    const rec = m.records[m.records.length - 1];
    rec.freshness.status = 'expired';
  },
});

// Gap 4: CoordinationRecord path const violation
addMutation({
  category: 'D. ENUM_CONST',
  propertyFamily: 'records',
  schemaPointer: '#/$defs/coordinationRecord/properties/path',
  schemaKeyword: 'const',
  operation: 'Set invalid path "work/WRONG.md" on coordination record (const mismatch)',
  guardId: 'T-25',
  mutate: (m) => {
    const rec = m.records.find((r) => r.type === 'coordination');
    rec.path = 'work/WRONG.md';
  },
});

// Gap 4: CoordinationRecord id const violation
addMutation({
  category: 'D. ENUM_CONST',
  propertyFamily: 'records',
  schemaPointer: '#/$defs/coordinationRecord/properties/id',
  schemaKeyword: 'const',
  operation: 'Set invalid id "coordination-bad" on coordination record (const mismatch)',
  guardId: 'T-25',
  mutate: (m) => {
    const rec = m.records.find((r) => r.type === 'coordination');
    rec.id = 'coordination-bad';
  },
});

// S31-06B: Auxiliary schema sourceFeedback invalid feedback enum
addMutation({
  category: 'D. ENUM_CONST',
  propertyFamily: 'stages',
  schemaPointer: '#/$defs/sourceFeedback/properties/feedback',
  schemaKeyword: 'enum',
  operation: 'Set invalid feedback "invalid-enum" on sourceFeedback on stage',
  guardId: 'T-23',
  mutate: (m) => {
    const fb = [{ source_id: 'source-fixture-book', feedback: 'invalid-enum', recorded: '2026-09-01' }];
    m.stages[0].source_feedback = fb;
    m.study_maps[0].stages[0].source_feedback = fb;
  },
});

// ---------------------------------------------------------------------------
// CATEGORY E: STRING CONSTRAINT VIOLATIONS
// ---------------------------------------------------------------------------

const patternCases = [
  ['modules', 0, 'id', 'not-module-prefixed', '#/$defs/moduleRecord/properties/id', 'T-17'],
  ['programs', 0, 'id', 'not-program-prefixed', '#/$defs/programRecord/properties/id', 'T-18'],
  ['projects', 0, 'id', 'not-project-prefixed', '#/$defs/projectRecord/properties/id', 'T-19'],
  ['units', 0, 'id', 'not-unit-prefixed', '#/$defs/projectedUnit/properties/id', 'T-22'],
  ['unit_material_syntheses', 0, 'id', 'not-synthesis-prefixed', '#/$defs/unitMaterialSynthesisProjection/properties/id', 'T-47'],
  ['indexes', null, 'unit_to_material_synthesis', 'wrong-prefix-id', '#/$defs/indexes/properties/unit_to_material_synthesis', 'T-46'],
  ['module_concept_edges', 0, 'module_id', 'not-module-prefixed', '#/$defs/moduleConceptEdge/properties/module_id', 'T-35'],
  ['module_concept_edges', 0, 'evidence.0.unit_id', 'not-unit-prefixed', '#/$defs/stageConceptEvidence/properties/unit_id', 'T-37'],
];

for (const [coll, idx, field, badPattern, pointer, guardId] of patternCases) {
  addMutation({
    category: 'E. STRING_CONSTRAINT',
    propertyFamily: coll,
    schemaPointer: pointer,
    schemaKeyword: 'pattern',
    operation: `Violate ID pattern regex on "${coll}${idx !== null ? `[${idx}].${field}` : `.${field}`}"`,
    guardId,
    mutate: (m) => {
      if (idx !== null) {
        if (field.includes('.')) {
          const parts = field.split('.');
          let cur = m[coll][idx];
          for (let i = 0; i < parts.length - 1; i++) {
            cur = cur[parts[i]];
          }
          cur[parts[parts.length - 1]] = badPattern;
        } else {
          m[coll][idx][field] = badPattern;
        }
      } else {
        const firstKey = Object.keys(m[coll][field])[0];
        m[coll][field][firstKey] = badPattern;
      }
    },
  });
}

// Gap 1: Material analysis frozen_input_sha256 pattern violation
addMutation({
  category: 'E. STRING_CONSTRAINT',
  propertyFamily: 'records',
  seed: 'with-note-analysis',
  schemaPointer: '#/$defs/noteRecord/properties/material_analysis/properties/frozen_input_sha256',
  schemaKeyword: 'pattern',
  operation: 'Set invalid non-64-hex string on frozen_input_sha256',
  guardId: 'T-25',
  mutate: (m) => {
    const rec = m.records.find((r) => r.id === 'note-fixture-with-analysis');
    rec.material_analysis.frozen_input_sha256 = 'short-hash';
  },
});

// Gap 1: Material analysis anchor topic minLength violation
addMutation({
  category: 'E. STRING_CONSTRAINT',
  propertyFamily: 'records',
  seed: 'with-note-analysis',
  schemaPointer: '#/$defs/noteRecord/properties/material_analysis/properties/anchors/items/properties/topic',
  schemaKeyword: 'minLength',
  operation: 'Set empty string "" on anchor topic where minLength: 1',
  guardId: 'T-25',
  mutate: (m) => {
    const rec = m.records.find((r) => r.id === 'note-fixture-with-analysis');
    rec.material_analysis.anchors[0].topic = '';
  },
});

// Gap 2: Detour id pattern violation
addMutation({
  category: 'E. STRING_CONSTRAINT',
  propertyFamily: 'study_maps',
  seed: 'with-detour-shelving',
  schemaPointer: '#/$defs/studyMap/properties/detours/items/properties/id',
  schemaKeyword: 'pattern',
  operation: 'Violate detour ID prefix (not "detour-")',
  guardId: 'T-23',
  mutate: (m) => {
    m.study_maps[0].detours[0].id = 'not-detour-prefixed';
  },
});

// Gap 2: Detour title minLength violation
addMutation({
  category: 'E. STRING_CONSTRAINT',
  propertyFamily: 'study_maps',
  seed: 'with-detour-shelving',
  schemaPointer: '#/$defs/studyMap/properties/detours/items/properties/title',
  schemaKeyword: 'minLength',
  operation: 'Set empty string "" on detour title where minLength: 1',
  guardId: 'T-23',
  mutate: (m) => {
    m.study_maps[0].detours[0].title = '';
  },
});

// Gap 2: Shelving item id pattern violation
addMutation({
  category: 'E. STRING_CONSTRAINT',
  propertyFamily: 'study_maps',
  seed: 'with-detour-shelving',
  schemaPointer: '#/$defs/studyMap/properties/shelving/properties/items/items/properties/id',
  schemaKeyword: 'pattern',
  operation: 'Violate shelving item proposal ID prefix (not "proposal-")',
  guardId: 'T-23',
  mutate: (m) => {
    m.study_maps[0].shelving.items[0].id = 'not-proposal-prefixed';
  },
});

// Gap 2: Shelving item destination minLength violation
addMutation({
  category: 'E. STRING_CONSTRAINT',
  propertyFamily: 'study_maps',
  seed: 'with-detour-shelving',
  schemaPointer: '#/$defs/studyMap/properties/shelving/properties/items/items/properties/destination',
  schemaKeyword: 'minLength',
  operation: 'Set empty string "" on shelving item destination where minLength: 1',
  guardId: 'T-23',
  mutate: (m) => {
    m.study_maps[0].shelving.items[0].destination = '';
  },
});

// minLength violation on academic_deadlines.kind
addMutation({
  category: 'E. STRING_CONSTRAINT',
  propertyFamily: 'academic_deadlines',
  schemaPointer: '#/$defs/academicDeadline/properties/kind',
  schemaKeyword: 'minLength',
  operation: 'Set empty string "" for academic deadline kind where minLength: 1',
  guardId: 'T-09',
  mutate: (m) => { m.academic_deadlines[0].kind = ''; },
});

// Format violations (dates, URIs)
addMutation({
  category: 'E. STRING_CONSTRAINT',
  propertyFamily: 'academic_deadlines',
  schemaPointer: '#/$defs/academicDeadline/properties/date',
  schemaKeyword: 'format',
  operation: 'Set invalid calendar date string on academic deadline',
  guardId: 'T-09',
  mutate: (m) => { m.academic_deadlines[0].date = '2026-99-99'; },
});

addMutation({
  category: 'E. STRING_CONSTRAINT',
  propertyFamily: 'study_maps',
  schemaPointer: '#/$defs/resource/properties/uri',
  schemaKeyword: 'format',
  operation: 'Set invalid URI format on stage resource',
  guardId: 'T-23',
  mutate: (m) => {
    if (m.study_maps[0].stages[0].resources.length === 0) {
      m.study_maps[0].stages[0].resources.push({
        id: 'res-fixture',
        label: 'Resource',
        uri: 'invalid url with spaces',
      });
    } else {
      m.study_maps[0].stages[0].resources[0].uri = 'invalid url with spaces';
    }
  },
});

// minLength violation on generator (exercising T-07)
addMutation({
  category: 'E. STRING_CONSTRAINT',
  propertyFamily: '_generated',
  schemaPointer: '#/$defs/generated/properties/generator',
  schemaKeyword: 'minLength',
  operation: 'Set empty string "" for generator where minLength: 1',
  guardId: 'T-07',
  mutate: (m) => { m._generated.generator = ''; },
});

// S31-06B: T-07 snapshot_id regex pattern violation
addMutation({
  category: 'E. STRING_CONSTRAINT',
  propertyFamily: '_generated',
  schemaPointer: '#/$defs/generated/properties/snapshot_id',
  schemaKeyword: 'pattern',
  operation: 'Set invalid snapshot_id "bad-snapshot-format" where pattern ^sha256:[0-9a-f]{64}$ is required',
  guardId: 'T-07',
  mutate: (m) => { m._generated.snapshot_id = 'bad-snapshot-format'; },
});

// S31-06B: T-07 source_fingerprint regex pattern violation
addMutation({
  category: 'E. STRING_CONSTRAINT',
  propertyFamily: '_generated',
  schemaPointer: '#/$defs/generated/properties/source_fingerprint',
  schemaKeyword: 'pattern',
  operation: 'Set short fingerprint "short-hash" where pattern ^[0-9a-f]{64}$ is required',
  guardId: 'T-07',
  mutate: (m) => { m._generated.source_fingerprint = 'short-hash'; },
});

// S31-06B: Auxiliary schema routeId pattern violation in synthesis completeness
addMutation({
  category: 'E. STRING_CONSTRAINT',
  propertyFamily: 'unit_material_syntheses',
  schemaPointer: '#/$defs/routeId',
  schemaKeyword: 'pattern',
  operation: 'Set invalid route ID "bad-route-id" in completeness missing_route_ids',
  guardId: 'T-47',
  mutate: (m) => { m.unit_material_syntheses[0].completeness.missing_route_ids = ['bad-route-id']; },
});

// S31-06B: Auxiliary schema deadlineModule module_id pattern violation
addMutation({
  category: 'E. STRING_CONSTRAINT',
  propertyFamily: 'academic_deadlines',
  schemaPointer: '#/$defs/deadlineModule/properties/module_id',
  schemaKeyword: 'pattern',
  operation: 'Set invalid module ID "bad-module-id" on academic_deadlines module',
  guardId: 'T-09',
  mutate: (m) => {
    m.academic_deadlines[1].modules = [{
      module_id: 'bad-module-id',
      title: 'Combined Exam',
      action: 'Register',
      termins: [1],
    }];
  },
});

// ---------------------------------------------------------------------------
// CATEGORY F: NUMERIC CONSTRAINT VIOLATIONS
// ---------------------------------------------------------------------------

addMutation({
  category: 'F. NUMERIC_CONSTRAINT',
  propertyFamily: 'counts',
  schemaPointer: '#/$defs/counts/properties/modules',
  schemaKeyword: 'minimum',
  operation: 'Set negative integer (-1) for count metric where minimum: 0',
  guardId: 'T-29',
  mutate: (m) => { m.counts.modules = -1; },
});

addMutation({
  category: 'F. NUMERIC_CONSTRAINT',
  propertyFamily: 'artifact_revisions',
  schemaPointer: '#/$defs/integerMap/additionalProperties',
  schemaKeyword: 'minimum',
  operation: 'Set negative revision counter (-1) where minimum: 0',
  guardId: 'T-27',
  mutate: (m) => {
    const k = Object.keys(m.artifact_revisions)[0];
    m.artifact_revisions[k] = -1;
  },
});

addMutation({
  category: 'F. NUMERIC_CONSTRAINT',
  propertyFamily: 'counts',
  schemaPointer: '#/$defs/counts/properties/modules',
  schemaKeyword: 'type',
  operation: 'Set floating-point number (1.5) where integer is required',
  guardId: 'T-29',
  mutate: (m) => { m.counts.modules = 1.5; },
});

addMutation({
  category: 'F. NUMERIC_CONSTRAINT',
  propertyFamily: 'progress',
  schemaPointer: '#/$defs/progress/additionalProperties/properties/stages_complete',
  schemaKeyword: 'minimum',
  operation: 'Set negative integer (-1) on progress.stages_complete',
  guardId: 'T-30',
  mutate: (m) => {
    const k = Object.keys(m.progress)[0];
    m.progress[k].stages_complete = -1;
  },
});

// Gap 1: Material analysis inspected_range start negative minimum violation
addMutation({
  category: 'F. NUMERIC_CONSTRAINT',
  propertyFamily: 'records',
  seed: 'with-note-analysis',
  schemaPointer: '#/$defs/noteRecord/properties/material_analysis/properties/inspected_range/properties/start',
  schemaKeyword: 'minimum',
  operation: 'Set negative integer (-1) on material_analysis.inspected_range.start (min: 1)',
  guardId: 'T-25',
  mutate: (m) => {
    const rec = m.records.find((r) => r.id === 'note-fixture-with-analysis');
    rec.material_analysis.inspected_range.start = -1;
  },
});

// ---------------------------------------------------------------------------
// CATEGORY G: ARRAY CONSTRAINT VIOLATIONS
// ---------------------------------------------------------------------------

addMutation({
  category: 'G. ARRAY_CONSTRAINT',
  propertyFamily: 'module_concept_edges',
  schemaPointer: '#/$defs/moduleConceptEdge/properties/evidence/minItems',
  schemaKeyword: 'minItems',
  operation: 'Set empty evidence array [] where minItems: 1 is required',
  guardId: 'T-36',
  mutate: (m) => { m.module_concept_edges[0].evidence = []; },
});

addMutation({
  category: 'G. ARRAY_CONSTRAINT',
  propertyFamily: 'indexes',
  schemaPointer: '#/$defs/stringArrayMap/additionalProperties/uniqueItems',
  schemaKeyword: 'uniqueItems',
  operation: 'Inject duplicate item into index stringArrayMap where uniqueItems: true',
  guardId: 'T-44',
  mutate: (m) => {
    m.indexes.concept_to_modules['concept-bayes'] = [
      'module-fixture-aml',
      'module-fixture-aml',
    ];
  },
});

// Gap 1: Atlas question target concepts empty array minItems violation
addMutation({
  category: 'G. ARRAY_CONSTRAINT',
  propertyFamily: 'records',
  seed: 'with-note-analysis',
  schemaPointer: '#/$defs/noteRecord/properties/atlas_question/properties/target/oneOf/0/properties/concepts/minItems',
  schemaKeyword: 'minItems',
  operation: 'Set empty concepts array [] in atlas_question target (minItems: 1)',
  guardId: 'T-25',
  mutate: (m) => {
    const rec = m.records.find((r) => r.id === 'note-fixture-with-analysis');
    rec.atlas_question.target.concepts = [];
  },
});

// ---------------------------------------------------------------------------
// CATEGORY H: NESTED STRUCTURAL & POLYMORPHIC RECORD VIOLATIONS
// ---------------------------------------------------------------------------

// Module components and exam sittings
addMutation({
  category: 'H. NESTED_STRUCTURAL',
  propertyFamily: 'modules',
  schemaPointer: '#/$defs/moduleRecord/properties/components',
  schemaKeyword: 'enum',
  operation: 'Set invalid component type in module component',
  guardId: 'T-17',
  mutate: (m) => {
    m.modules[0].components[0].type = 'invalid-component-kind';
  },
});

addMutation({
  category: 'H. NESTED_STRUCTURAL',
  propertyFamily: 'modules',
  schemaPointer: '#/$defs/examinationSitting/properties/date',
  schemaKeyword: 'format',
  operation: 'Set invalid date format on examination sitting',
  guardId: 'T-17',
  mutate: (m) => {
    m.modules[0].examination.sittings[0].date = 'not-a-date';
  },
});

// Module concept edge evidence variants (exercising T-38, T-40)
addMutation({
  category: 'H. NESTED_STRUCTURAL',
  propertyFamily: 'module_concept_edges',
  schemaPointer: '#/$defs/stageConceptEvidence/required/study_map_id',
  schemaKeyword: 'required',
  operation: 'Delete study_map_id from stage-concept evidence',
  guardId: 'T-38',
  mutate: (m) => {
    delete m.module_concept_edges[0].evidence[0].study_map_id;
  },
});

addMutation({
  category: 'H. NESTED_STRUCTURAL',
  propertyFamily: 'module_concept_edges',
  schemaPointer: '#/$defs/stageConceptEvidence/properties/study_map_id',
  schemaKeyword: 'pattern',
  operation: 'Violate prefix on study_map_id in stage-concept evidence',
  guardId: 'T-38',
  mutate: (m) => {
    m.module_concept_edges[0].evidence[0].study_map_id = 'wrong-prefix-id';
  },
});

addMutation({
  category: 'H. NESTED_STRUCTURAL',
  propertyFamily: 'module_concept_edges',
  schemaPointer: '#/$defs/moduleConceptEdge/properties/evidence/items/oneOf',
  schemaKeyword: 'oneOf',
  operation: 'Set unknown evidence kind discriminator "unsupported-kind"',
  guardId: 'T-40',
  mutate: (m) => {
    m.module_concept_edges[0].evidence[0].kind = 'unsupported-kind';
  },
});

// Knowledge-node evidence mutations (using Seed 4, exercising T-39)
addMutation({
  category: 'H. NESTED_STRUCTURAL',
  propertyFamily: 'module_concept_edges',
  seed: 'with-knowledge-edge',
  schemaPointer: '#/$defs/knowledgeNodeEvidence/required/node_id',
  schemaKeyword: 'required',
  operation: 'Delete node_id from knowledge-node evidence',
  guardId: 'T-39',
  mutate: (m) => {
    const lastEdge = m.module_concept_edges[m.module_concept_edges.length - 1];
    delete lastEdge.evidence[0].node_id;
  },
});

addMutation({
  category: 'H. NESTED_STRUCTURAL',
  propertyFamily: 'module_concept_edges',
  seed: 'with-knowledge-edge',
  schemaPointer: '#/$defs/knowledgeNodeEvidence/properties/node_id',
  schemaKeyword: 'pattern',
  operation: 'Set bad prefix on node_id in knowledge-node evidence',
  guardId: 'T-39',
  mutate: (m) => {
    const lastEdge = m.module_concept_edges[m.module_concept_edges.length - 1];
    lastEdge.evidence[0].node_id = 'wrong-prefix-node';
  },
});

// Material synthesis basis and completeness (exercising T-47)
addMutation({
  category: 'H. NESTED_STRUCTURAL',
  propertyFamily: 'unit_material_syntheses',
  schemaPointer: '#/$defs/unitMaterialSynthesisProjection/properties/basis',
  schemaKeyword: 'required',
  operation: 'Delete source_map_revision from material synthesis basis',
  guardId: 'T-47',
  mutate: (m) => {
    delete m.unit_material_syntheses[0].basis.source_map_revision;
  },
});

addMutation({
  category: 'H. NESTED_STRUCTURAL',
  propertyFamily: 'unit_material_syntheses',
  schemaPointer: '#/$defs/unitMaterialSynthesisProjection/properties/freshness',
  schemaKeyword: 'enum',
  operation: 'Set invalid reason in freshness.reasons array',
  guardId: 'T-47',
  mutate: (m) => {
    m.unit_material_syntheses[0].freshness.reasons.push('invalid-reason-code');
  },
});

// Polymorphic records: Discriminated union mutations (exercising T-25)
const recordTypesInFixture = [
  'source', 'concept', 'note', 'workspace', 'coordination',
  'collection', 'topic-pack', 'project',
];

for (const rType of recordTypesInFixture) {
  addMutation({
    category: 'H. NESTED_STRUCTURAL',
    propertyFamily: 'records',
    schemaPointer: `#/$defs/${rType}Record`,
    schemaKeyword: 'oneOf',
    operation: `Set unknown record.type "unsupported-type-xyz" on ${rType} row`,
    guardId: 'T-25',
    mutate: (m) => {
      const rec = m.records.find((r) => r.type === rType);
      rec.type = 'unsupported-type-xyz';
    },
  });

  addMutation({
    category: 'H. NESTED_STRUCTURAL',
    propertyFamily: 'records',
    schemaPointer: `#/$defs/${rType}Record/required/id`,
    schemaKeyword: 'required',
    operation: `Delete required "id" from ${rType} record row in records`,
    guardId: 'T-25',
    mutate: (m) => {
      const rec = m.records.find((r) => r.type === rType);
      delete rec.id;
    },
  });

  addMutation({
    category: 'H. NESTED_STRUCTURAL',
    propertyFamily: 'records',
    schemaPointer: `#/$defs/${rType}Record/additionalProperties`,
    schemaKeyword: 'additionalProperties',
    operation: `Inject unexpected property on ${rType} record row in records`,
    guardId: 'T-25',
    mutate: (m) => {
      const rec = m.records.find((r) => r.type === rType);
      rec.__unexpected_extension__ = true;
    },
  });
}

// Polymorphic compatibility-alias (using Seed 2, exercising T-25)
addMutation({
  category: 'H. NESTED_STRUCTURAL',
  propertyFamily: 'records',
  seed: 'with-alias',
  schemaPointer: '#/$defs/compatibilityAlias/required/target_id',
  schemaKeyword: 'required',
  operation: 'Delete target_id from compatibility-alias record in records',
  guardId: 'T-25',
  mutate: (m) => {
    const aliasRec = m.records.find((r) => r.type === 'compatibility-alias');
    delete aliasRec.target_id;
  },
});

addMutation({
  category: 'H. NESTED_STRUCTURAL',
  propertyFamily: 'records',
  seed: 'with-alias',
  schemaPointer: '#/$defs/compatibilityAlias/properties/target_id',
  schemaKeyword: 'pattern',
  operation: 'Set bad prefix on target_id in compatibility-alias record',
  guardId: 'T-25',
  mutate: (m) => {
    const aliasRec = m.records.find((r) => r.type === 'compatibility-alias');
    aliasRec.target_id = 'wrong-prefix-id';
  },
});

// Polymorphic learning-path (using Seed 3, exercising T-25)
addMutation({
  category: 'H. NESTED_STRUCTURAL',
  propertyFamily: 'records',
  seed: 'with-path',
  schemaPointer: '#/$defs/learningPathRecord/required/revision',
  schemaKeyword: 'required',
  operation: 'Delete revision from learning-path record in records',
  guardId: 'T-25',
  mutate: (m) => {
    const pathRec = m.records.find((r) => r.type === 'learning-path');
    delete pathRec.revision;
  },
});

addMutation({
  category: 'H. NESTED_STRUCTURAL',
  propertyFamily: 'records',
  seed: 'with-path',
  schemaPointer: '#/$defs/learningPathRecord/properties/stages',
  schemaKeyword: 'minItems',
  operation: 'Set empty stages array [] on learning-path record in records',
  guardId: 'T-25',
  mutate: (m) => {
    const pathRec = m.records.find((r) => r.type === 'learning-path');
    pathRec.stages = [];
  },
});

// ---------------------------------------------------------------------------
// CATEGORY I: CONTEXTUAL REFUSAL PROBE (SPEC §15 item 6, T-06)
// ---------------------------------------------------------------------------

addMutation({
  category: 'I. CONTEXTUAL_PROBE',
  propertyFamily: '_generated',
  schemaPointer: '#/$defs/generated/properties/schema_sha256',
  schemaKeyword: 'pattern',
  operation: 'Mutate schema_sha256 to a different valid 64-hex SHA-256 (wrong-pin probe)',
  guardId: 'T-06',
  expectedDiff: true, // Expected difference: Ajv PASS, assertManifest FAIL
  mutate: (m) => {
    m._generated.schema_sha256 = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';
  },
});

// ---------------------------------------------------------------------------
// Schema-Driven Property-Graph Traversal & Mutation Generation (F2 Resolution)
// ---------------------------------------------------------------------------

const { loadFreshCoreBundle } = require('../scripts/core-contract-bundle.mjs');
const coreRoot = path.resolve(ROOT, '../repository');

let bundleData;
try {
  const loaded = loadFreshCoreBundle(coreRoot);
  bundleData = loaded.bundle;
} catch (err) {
  console.error('[FATAL] Failed to load fresh Core contract bundle:', err.message);
  process.exit(1);
}

const schemaDefs = bundleData?.root?.$defs || {};

function resolveSchemaDef(schema, defs) {
  if (!schema) return { properties: {}, required: [] };
  if (schema.$ref) {
    const ref = schema.$ref;
    if (ref.startsWith('#/$defs/')) {
      const defName = ref.slice('#/$defs/'.length);
      return resolveSchemaDef(defs[defName] || {}, defs);
    }
  }
  if (schema.allOf) {
    const merged = { properties: {}, required: [] };
    for (const sub of schema.allOf) {
      const resolved = resolveSchemaDef(sub, defs);
      Object.assign(merged.properties, resolved.properties || {});
      if (resolved.required) merged.required.push(...resolved.required);
      if (resolved.additionalProperties !== undefined) merged.additionalProperties = resolved.additionalProperties;
    }
    return merged;
  }
  return {
    properties: schema.properties || {},
    required: schema.required || [],
    additionalProperties: schema.additionalProperties,
  };
}

const SCHEMA_COLLECTION_MODELS = {
  academic_deadlines: { schema: resolveSchemaDef(schemaDefs.academicDeadline, schemaDefs), guard: 'T-09', defName: 'academicDeadline' },
  garden_entries: { schema: resolveSchemaDef(schemaDefs.gardenEntry, schemaDefs), guard: 'T-10', defName: 'gardenEntry' },
  relations: { schema: resolveSchemaDef(schemaDefs.relation, schemaDefs), guard: 'T-11', defName: 'relation' },
  review_items: { schema: resolveSchemaDef(schemaDefs.reviewItem, schemaDefs), guard: 'T-12', defName: 'reviewItem' },
  semesters: { schema: resolveSchemaDef(schemaDefs.semester, schemaDefs), guard: 'T-13', defName: 'semester' },
  thematic_groups: { schema: resolveSchemaDef(schemaDefs.thematicGroup, schemaDefs), guard: 'T-14', defName: 'thematicGroup' },
  topic_packs: { schema: resolveSchemaDef(schemaDefs.collectionRecord, schemaDefs), guard: 'T-15', defName: 'collectionRecord' },
  topics: { schema: resolveSchemaDef(schemaDefs.topic, schemaDefs), guard: 'T-16', defName: 'topic' },
  modules: { schema: resolveSchemaDef(schemaDefs.moduleRecord, schemaDefs), guard: 'T-17', defName: 'moduleRecord' },
  programs: { schema: resolveSchemaDef(schemaDefs.programRecord, schemaDefs), guard: 'T-18', defName: 'programRecord' },
  projects: { schema: resolveSchemaDef(schemaDefs.projectRecord, schemaDefs), guard: 'T-19', defName: 'projectRecord' },
  project_relationships: { schema: resolveSchemaDef(schemaDefs.projectRelationship, schemaDefs), guard: 'T-20', defName: 'projectRelationship' },
  module_source_maps: { schema: resolveSchemaDef(schemaDefs.moduleSourceMap, schemaDefs), guard: 'T-21', defName: 'moduleSourceMap' },
  units: { schema: resolveSchemaDef(schemaDefs.projectedUnit, schemaDefs), guard: 'T-22', defName: 'projectedUnit' },
  study_maps: { schema: resolveSchemaDef(schemaDefs.studyMap, schemaDefs), guard: 'T-23', defName: 'studyMap' },
  stages: { schema: resolveSchemaDef(schemaDefs.flatStage, schemaDefs), guard: 'T-24', defName: 'flatStage' },
  unit_material_syntheses: { schema: resolveSchemaDef(schemaDefs.unitMaterialSynthesisProjection, schemaDefs), guard: 'T-47', defName: 'unitMaterialSynthesisProjection' },
};

// Traverse schema properties and generate applicable variants (type flips, required removals)
for (const [colName, { schema, guard, defName }] of Object.entries(SCHEMA_COLLECTION_MODELS)) {
  const item = baseFixture[colName]?.[0];
  if (!item) continue;
  const props = schema.properties || {};
  const req = new Set(schema.required || []);

  for (const [propName, propSchema] of Object.entries(props)) {
    if (!(propName in item)) continue;

    // Type violation: flip primitive/array/object
    addMutation({
      seed: 'base',
      category: 'A. TYPE',
      propertyFamily: colName,
      schemaPointer: `#/$defs/${defName}/properties/${propName}`,
      schemaKeyword: 'type',
      operation: `Set incompatible primitive on ${colName}[0].${propName}`,
      guardId: guard,
      mutate: (m) => {
        const val = m[colName][0][propName];
        m[colName][0][propName] = typeof val === 'number' ? 'invalid' : 42;
      },
    });

    // Required violation: delete required property
    if (req.has(propName)) {
      addMutation({
        seed: 'base',
        category: 'B. REQUIRED',
        propertyFamily: colName,
        schemaPointer: `#/$defs/${defName}/required/${propName}`,
        schemaKeyword: 'required',
        operation: `Delete required property "${colName}[0].${propName}"`,
        guardId: guard,
        mutate: (m) => {
          delete m[colName][0][propName];
        },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Recursive Schema-Driven Traversal Across All 7 Seeds (MUT-0587+)
// ---------------------------------------------------------------------------

const schemaRegistry = new Map();
schemaRegistry.set('', bundleData.root);
if (bundleData.root_uri) schemaRegistry.set(bundleData.root_uri, bundleData.root);
if (bundleData.root?.$id) schemaRegistry.set(bundleData.root.$id, bundleData.root);
for (const r of bundleData.resources || []) {
  if (r.declared_id) schemaRegistry.set(r.declared_id, r.schema);
  for (const a of r.aliases || []) schemaRegistry.set(a, r.schema);
  if (r.schema?.$id) schemaRegistry.set(r.schema.$id, r.schema);
}

function resolveSchemaRef(schema, currentRoot = bundleData.root, stack = []) {
  if (!schema || typeof schema !== 'object') return { schema, root: currentRoot };
  if (schema.$ref) {
    if (stack.includes(schema.$ref)) return { schema, root: currentRoot };
    const [baseUri, pointer] = schema.$ref.split('#');
    let newRoot = currentRoot;
    if (baseUri) {
      newRoot = schemaRegistry.get(baseUri);
      if (!newRoot) throw new Error(`Schema resource not found: ${baseUri} (ref: ${schema.$ref})`);
    }
    let target = newRoot;
    if (pointer && pointer !== '/') {
      for (const part of pointer.split('/').filter(Boolean)) {
        if (!target) break;
        target = target[part];
      }
    }
    if (!target) return { schema: {}, root: newRoot || currentRoot };
    return resolveSchemaRef(target, newRoot, [...stack, schema.$ref]);
  }
  return { schema, root: currentRoot };
}

function resolveFullSchema(schema, currentRoot = bundleData.root) {
  if (!schema) return { properties: {}, required: [], currentRoot, rawSchema: null };
  const refRes = resolveSchemaRef(schema, currentRoot);
  schema = refRes.schema;
  currentRoot = refRes.root;

  if (schema.allOf) {
    const merged = { properties: {}, required: [], currentRoot, rawSchema: schema };
    for (const sub of schema.allOf) {
      const res = resolveFullSchema(sub, currentRoot);
      Object.assign(merged.properties, res.properties || {});
      if (res.required) merged.required.push(...res.required);
      if (res.additionalProperties !== undefined) merged.additionalProperties = res.additionalProperties;
      if (res.items) merged.items = res.items;
      if (res.oneOf) merged.oneOf = res.oneOf;
      if (res.anyOf) merged.anyOf = res.anyOf;
      if (res.enum) merged.enum = res.enum;
      if (res.const !== undefined) merged.const = res.const;
      if (res.format) merged.format = res.format;
      if (res.pattern) merged.pattern = res.pattern;
      if (res.type) merged.type = res.type;
      if (res.minimum !== undefined) merged.minimum = res.minimum;
      if (res.minItems !== undefined) merged.minItems = res.minItems;
    }
    return merged;
  }

  return {
    properties: schema.properties || {},
    required: schema.required || [],
    additionalProperties: schema.additionalProperties,
    items: schema.items,
    oneOf: schema.oneOf,
    anyOf: schema.anyOf,
    enum: schema.enum,
    const: schema.const,
    format: schema.format,
    pattern: schema.pattern,
    type: schema.type,
    minimum: schema.minimum,
    minItems: schema.minItems,
    currentRoot,
    rawSchema: schema,
  };
}

function matchAlternativeBranch(data, branches, currentRoot) {
  if (!branches || !Array.isArray(branches) || branches.length === 0) return null;
  if (data === null || data === undefined) {
    for (let i = 0; i < branches.length; i++) {
      const res = resolveFullSchema(branches[i], currentRoot);
      if (res.type === 'null' || (Array.isArray(res.type) && res.type.includes('null'))) {
        return { index: i, branchSchema: res, currentRoot: res.currentRoot };
      }
    }
    return null;
  }

  // 1. Exact root const match (e.g. source_map: "source-map.yaml")
  for (let i = 0; i < branches.length; i++) {
    const res = resolveFullSchema(branches[i], currentRoot);
    if (res.const !== undefined && data === res.const) {
      return { index: i, branchSchema: res, currentRoot: res.currentRoot };
    }
  }

  // 2. Discriminator property match across all properties (const or enum, e.g. kind: "stage-concept", type: "note")
  if (typeof data === 'object') {
    for (let i = 0; i < branches.length; i++) {
      const res = resolveFullSchema(branches[i], currentRoot);
      const props = res.properties || {};
      for (const [key, propSchema] of Object.entries(props)) {
        if (key in data) {
          const resolvedProp = resolveFullSchema(propSchema, res.currentRoot);
          const constVal = resolvedProp.const;
          if (constVal !== undefined && data[key] === constVal) {
            return { index: i, branchSchema: res, currentRoot: res.currentRoot };
          }
          if (resolvedProp.enum && resolvedProp.enum.includes(data[key])) {
            return { index: i, branchSchema: res, currentRoot: res.currentRoot };
          }
        }
      }
    }

    // 3. Structural match based on required properties
    if (!Array.isArray(data)) {
      for (let i = 0; i < branches.length; i++) {
        const res = resolveFullSchema(branches[i], currentRoot);
        const req = res.required || [];
        if (req.length > 0 && req.every((k) => k in data)) {
          return { index: i, branchSchema: res, currentRoot: res.currentRoot };
        }
      }
      const dataKeys = Object.keys(data);
      for (let i = 0; i < branches.length; i++) {
        const res = resolveFullSchema(branches[i], currentRoot);
        const props = res.properties || {};
        if (dataKeys.length > 0 && dataKeys.every((k) => k in props)) {
          return { index: i, branchSchema: res, currentRoot: res.currentRoot };
        }
      }
    }
  }

  // 4. Primitive / type match
  for (let i = 0; i < branches.length; i++) {
    const res = resolveFullSchema(branches[i], currentRoot);
    const exp = res.type;
    if (exp) {
      if (typeof data === 'string' && (exp === 'string' || (Array.isArray(exp) && exp.includes('string')))) {
        return { index: i, branchSchema: res, currentRoot: res.currentRoot };
      }
      if (typeof data === 'number' && (exp === 'number' || exp === 'integer' || (Array.isArray(exp) && (exp.includes('number') || exp.includes('integer'))))) {
        return { index: i, branchSchema: res, currentRoot: res.currentRoot };
      }
      if (typeof data === 'boolean' && (exp === 'boolean' || (Array.isArray(exp) && exp.includes('boolean')))) {
        return { index: i, branchSchema: res, currentRoot: res.currentRoot };
      }
      if (Array.isArray(data) && (exp === 'array' || (Array.isArray(exp) && exp.includes('array')))) {
        return { index: i, branchSchema: res, currentRoot: res.currentRoot };
      }
    }
  }

  return null;
}

function isAnyJsonValue(schema) {
  if (!schema) return true;
  if (schema.$ref === '#/$defs/jsonValue') return true;
  if (schema.oneOf && schema.oneOf.length >= 5) return true;
  return false;
}

// Compute target paths already covered by MUT-0001 through MUT-0586
const initialCoveredTargets = new Map();
function computePathDiff(a, b, p = '') {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return [p];
  const result = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const q = p + '/' + k;
    if (!(k in a) || !(k in b)) result.push(q);
    else result.push(...computePathDiff(a[k], b[k], q));
  }
  return result;
}

for (const m of mutations) {
  const before = SEEDS[m.seed];
  const after = clone(before);
  m.mutate(after);
  for (const p of computePathDiff(before, after)) {
    if (!initialCoveredTargets.has(p)) initialCoveredTargets.set(p, new Set());
    initialCoveredTargets.get(p).add(m.category);
  }
}

function getByPath(obj, segments) {
  let curr = obj;
  for (const s of segments) {
    if (curr == null) return undefined;
    curr = curr[s];
  }
  return curr;
}

function setByPath(obj, segments, val) {
  let curr = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    curr = curr[segments[i]];
  }
  curr[segments[segments.length - 1]] = val;
}

function deleteByPath(obj, segments) {
  let curr = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    curr = curr[segments[i]];
  }
  delete curr[segments[segments.length - 1]];
}

function makeIncompatibleType(val, schema) {
  const types = new Set(Array.isArray(schema?.type) ? schema.type : (schema?.type ? [schema.type] : []));
  if (types.has('number') || types.has('integer')) return 'invalid-primitive';
  if (types.has('string')) return 42;
  if (types.has('boolean')) return 'invalid-bool';
  if (types.has('array')) return 42;
  if (types.has('object')) return 42;
  return typeof val === 'number' ? 'invalid-primitive' : 42;
}

function inferGuardId(segments) {
  if (segments.length === 0) return null;
  const top = segments[0];
  if (COLLECTION_ROW_GUARDS[top]) return COLLECTION_ROW_GUARDS[top];
  if (top === '_generated') return 'T-04';
  if (top === 'counts') return 'T-29';
  if (top === 'progress') return 'T-30';
  if (top === 'backlinks') return 'T-28';
  if (top === 'resume_pointer') return 'T-32';
  if (top === 'artifact_revisions') return 'T-27';
  if (top === 'project_aliases') return 'T-31';
  if (top === 'indexes') return 'T-42';
  if (top === 'ai_actions') return 'T-08';
  if (top === 'module_concept_edges') {
    const sStr = segments.join('/');
    if (sStr.includes('evidence') && (segments[segments.length - 1] === 'stage_id' || segments[segments.length - 1] === 'study_map_id')) return 'T-38';
    if (sStr.includes('evidence') && segments[segments.length - 1] === 'node_id') return 'T-39';
    if (sStr.includes('evidence') && segments[segments.length - 1] === 'kind') return 'T-40';
    if (sStr.includes('evidence') && segments[segments.length - 1] === 'unit_id') return 'T-37';
    return 'T-34';
  }
  return null;
}

function inferGuardFromPtr(ptr, fallback = 'T-26') {
  const parts = ptr.split('/').filter(Boolean);
  let top = parts[1] || '';
  if (top === 'properties' || top === '$defs') {
    top = parts[2] || '';
  }
  if (COLLECTION_ROW_GUARDS[top]) return COLLECTION_ROW_GUARDS[top];
  if (top === '_generated') return 'T-04';
  if (top === 'counts') return 'T-29';
  if (top === 'progress') return 'T-30';
  if (top === 'backlinks') return 'T-28';
  if (top === 'resume_pointer') return 'T-32';
  if (top === 'artifact_revisions') return 'T-27';
  if (top === 'project_aliases') return 'T-31';
  if (top === 'indexes') return 'T-42';
  if (top === 'ai_actions') return 'T-08';
  if (top === 'module_concept_edges') {
    if (ptr.includes('stageConceptEvidence') || ptr.includes('oneOf/0')) return 'T-38';
    if (ptr.includes('knowledgeNodeEvidence') || ptr.includes('oneOf/1')) return 'T-39';
    return 'T-34';
  }
  return fallback;
}

const schemaInventoryMap = new Map();

function walkSchemaAndData(seedName, data, schema, schemaPtr, dataPtr, segments) {
  if (!data || typeof data !== 'object') return;
  schema = resolveFullSchema(schema);
  const guardId = inferGuardId(segments);
  const family = segments[0] || 'root';

  if (Array.isArray(data)) {
    if (schema.items) {
      const itemSchema = resolveFullSchema(schema.items);
      for (let i = 0; i < data.length; i++) {
        const segs = [...segments, i];
        const ptr = dataPtr + '/' + i;
        if (itemSchema.oneOf) {
          const item = data[i];
          for (const branch of itemSchema.oneOf) {
            const resBranch = resolveFullSchema(branch);
            const constType = resBranch.properties?.type?.const;
            const enumType = resBranch.properties?.type?.enum;
            if ((constType && item.type === constType) || (enumType && enumType.includes(item.type))) {
              walkSchemaAndData(seedName, item, resBranch, schemaPtr + '/items/oneOf', ptr, segs);
              break;
            }
          }
        } else {
          walkSchemaAndData(seedName, data[i], itemSchema, schemaPtr + '/items', ptr, segs);
        }
      }
    }
    return;
  }

  // Closed object additionalProperties violation
  if (schema.additionalProperties === false) {
    const addPropPath = dataPtr + '/__unexpected_extension__';
    const existingCats = initialCoveredTargets.get(addPropPath) || new Set();
    if (!existingCats.has('C. ADDITIONAL_PROPERTIES')) {
      addMutation({
        seed: seedName,
        category: 'C. ADDITIONAL_PROPERTIES',
        propertyFamily: family,
        schemaPointer: schemaPtr + '/additionalProperties',
        schemaKeyword: 'additionalProperties',
        operation: `Inject unexpected property into closed object at ${dataPtr}`,
        guardId,
        mutate: (m) => {
          const target = getByPath(m, segments);
          if (target && typeof target === 'object') {
            target.__unexpected_extension__ = 'invalid_extension';
          }
        },
      });
      existingCats.add('C. ADDITIONAL_PROPERTIES');
      initialCoveredTargets.set(addPropPath, existingCats);
    }
  }

  // Dictionary values if additionalProperties is a schema object
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object' && !isAnyJsonValue(schema.additionalProperties)) {
    const valSchema = resolveFullSchema(schema.additionalProperties);
    for (const [key, val] of Object.entries(data)) {
      if (Object.hasOwn(schema.properties || {}, key)) continue;
      const segs = [...segments, key];
      const targetPath = dataPtr + '/' + key;
      const existingCats = initialCoveredTargets.get(targetPath) || new Set();
      if (!existingCats.has('A. TYPE')) {
        addMutation({
          seed: seedName,
          category: 'A. TYPE',
          propertyFamily: family,
          schemaPointer: schemaPtr + '/additionalProperties',
          schemaKeyword: 'type',
          operation: `Set incompatible type on dictionary value at ${targetPath}`,
          guardId,
          mutate: (m) => {
            const v = getByPath(m, segs);
            setByPath(m, segs, makeIncompatibleType(v, valSchema));
          },
        });
        existingCats.add('A. TYPE');
        initialCoveredTargets.set(targetPath, existingCats);
      }
      walkSchemaAndData(seedName, val, valSchema, schemaPtr + '/additionalProperties', targetPath, segs);
    }
  }

  const req = new Set(schema.required || []);
  const props = schema.properties || {};

  for (const [propName, propSchema] of Object.entries(props)) {
    const resolvedProp = resolveFullSchema(propSchema);
    const segs = [...segments, propName];
    const targetPath = dataPtr + '/' + propName;
    const propPtr = schemaPtr + '/properties/' + propName;

    if (!(propName in data)) {
      if (!schemaInventoryMap.has(targetPath)) {
        schemaInventoryMap.set(targetPath, {
          path: targetPath,
          schemaPointer: propPtr,
          historicalDecoderGuard: guardId,
          status: 'UNINSTANTIATED',
        });
      }
      continue;
    }

    const applicableChecks = [];
    if (!isAnyJsonValue(propSchema)) applicableChecks.push('A. TYPE');
    if (req.has(propName)) applicableChecks.push('B. REQUIRED');
    if (resolvedProp.enum) applicableChecks.push('D. ENUM_CONST');
    if (resolvedProp.format || resolvedProp.pattern) applicableChecks.push('E. STRING_CONSTRAINT');

    schemaInventoryMap.set(targetPath, {
      path: targetPath,
      seed: seedName,
      guardId,
      schemaPointer: propPtr,
      status: 'INSTANTIATED',
      applicableChecks,
    });

    const existingCats = initialCoveredTargets.get(targetPath) || new Set();

    // 1. Type
    if (!existingCats.has('A. TYPE') && !isAnyJsonValue(propSchema)) {
      addMutation({
        seed: seedName,
        category: 'A. TYPE',
        propertyFamily: family,
        schemaPointer: propPtr + '/type',
        schemaKeyword: 'type',
        operation: `Set incompatible primitive on ${targetPath}`,
        guardId,
        mutate: (m) => {
          const val = getByPath(m, segs);
          setByPath(m, segs, makeIncompatibleType(val, resolvedProp));
        },
      });
      existingCats.add('A. TYPE');
      initialCoveredTargets.set(targetPath, existingCats);
    }

    // 2. Required
    if (req.has(propName) && !existingCats.has('B. REQUIRED')) {
      addMutation({
        seed: seedName,
        category: 'B. REQUIRED',
        propertyFamily: family,
        schemaPointer: schemaPtr + '/required/' + propName,
        schemaKeyword: 'required',
        operation: `Delete required property at ${targetPath}`,
        guardId,
        mutate: (m) => {
          deleteByPath(m, segs);
        },
      });
      existingCats.add('B. REQUIRED');
      initialCoveredTargets.set(targetPath, existingCats);
    }

    // 3. Enum
    if (resolvedProp.enum && !existingCats.has('D. ENUM_CONST')) {
      addMutation({
        seed: seedName,
        category: 'D. ENUM_CONST',
        propertyFamily: family,
        schemaPointer: propPtr + '/enum',
        schemaKeyword: 'enum',
        operation: `Set out-of-domain enum on ${targetPath}`,
        guardId,
        mutate: (m) => {
          setByPath(m, segs, '__invalid_enum_out_of_domain__');
        },
      });
      existingCats.add('D. ENUM_CONST');
      initialCoveredTargets.set(targetPath, existingCats);
    }

    // 4. Format / Pattern
    if (resolvedProp.format && !existingCats.has('E. STRING_CONSTRAINT')) {
      addMutation({
        seed: seedName,
        category: 'E. STRING_CONSTRAINT',
        propertyFamily: family,
        schemaPointer: propPtr + '/format',
        schemaKeyword: 'format',
        operation: `Violate format on ${targetPath}`,
        guardId,
        mutate: (m) => {
          setByPath(m, segs, 'not-a-valid-format');
        },
      });
      existingCats.add('E. STRING_CONSTRAINT');
      initialCoveredTargets.set(targetPath, existingCats);
    } else if (resolvedProp.pattern && !existingCats.has('E. STRING_CONSTRAINT')) {
      addMutation({
        seed: seedName,
        category: 'E. STRING_CONSTRAINT',
        propertyFamily: family,
        schemaPointer: propPtr + '/pattern',
        schemaKeyword: 'pattern',
        operation: `Violate regex pattern on ${targetPath}`,
        guardId,
        mutate: (m) => {
          setByPath(m, segs, 'INVALID_PATTERN_VIOLATION');
        },
      });
      existingCats.add('E. STRING_CONSTRAINT');
      initialCoveredTargets.set(targetPath, existingCats);
    }

    walkSchemaAndData(seedName, data[propName], propSchema, propPtr, targetPath, segs);
  }
}

for (const [seedName, seed] of Object.entries(SEEDS)) {
  walkSchemaAndData(seedName, seed, bundleData.root, '#', '', []);
}

// ---------------------------------------------------------------------------
// Supplemental Generalized Schema-Alternative Traversal (MUT-3561+)
// Resolves array alternatives (kind evidence) and object unions (atlas_question.target)
// ---------------------------------------------------------------------------

// Re-index initialCoveredTargets with all mutations through MUT-3560
for (const m of mutations.slice(586)) {
  const before = SEEDS[m.seed];
  const after = clone(before);
  m.mutate(after);
  for (const p of computePathDiff(before, after)) {
    if (!initialCoveredTargets.has(p)) initialCoveredTargets.set(p, new Set());
    initialCoveredTargets.get(p).add(m.category);
  }
}

function walkSupplementalAlternatives(seedName, data, schema, schemaPtr, dataPtr, segments, currentRoot) {
  if (!data || typeof data !== 'object') return;
  schema = resolveFullSchema(schema, currentRoot);
  currentRoot = schema.currentRoot;
  const guardId = inferGuardId(segments);
  const family = segments[0] || 'root';

  if (Array.isArray(data)) {
    if (schema.items) {
      const itemSchema = resolveFullSchema(schema.items, currentRoot);
      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        const segs = [...segments, i];
        const ptr = dataPtr + '/' + i;
        if (itemSchema.oneOf || itemSchema.anyOf) {
          const alts = itemSchema.oneOf || itemSchema.anyOf;
          const match = matchAlternativeBranch(item, alts, itemSchema.currentRoot);
          if (!match) {
            throw new Error(`General coverage reconciliation error: Seed "${seedName}" data at "${ptr}" did not match any branch in alternative at "${schemaPtr}/items"`);
          }
          walkSupplementalAlternatives(seedName, item, match.branchSchema, schemaPtr + '/items/oneOf/' + match.index, ptr, segs, match.currentRoot);
        } else {
          walkSupplementalAlternatives(seedName, item, itemSchema, schemaPtr + '/items', ptr, segs, itemSchema.currentRoot);
        }
      }
    }
    return;
  }

  // Closed object additionalProperties
  if (schema.additionalProperties === false) {
    const addPropPath = dataPtr + '/__unexpected_extension__';
    const existingCats = initialCoveredTargets.get(addPropPath) || new Set();
    if (!existingCats.has('C. ADDITIONAL_PROPERTIES')) {
      addMutation({
        seed: seedName,
        category: 'C. ADDITIONAL_PROPERTIES',
        propertyFamily: family,
        schemaPointer: schemaPtr + '/additionalProperties',
        schemaKeyword: 'additionalProperties',
        operation: `Inject unexpected property into closed object at ${dataPtr}`,
        guardId,
        mutate: (m) => {
          let curr = m;
          for (const s of segments) curr = curr[s];
          if (curr && typeof curr === 'object') {
            curr.__unexpected_extension__ = 'invalid_extension';
          }
        },
      });
      existingCats.add('C. ADDITIONAL_PROPERTIES');
      initialCoveredTargets.set(addPropPath, existingCats);
    }
  }

  const req = new Set(schema.required || []);
  const props = schema.properties || {};

  for (const [propName, propDef] of Object.entries(props)) {
    if (!(propName in data)) continue;
    const resolvedProp = resolveFullSchema(propDef, currentRoot);
    const segs = [...segments, propName];
    const targetPath = dataPtr + '/' + propName;
    const propPtr = schemaPtr + '/properties/' + propName;
    const existingCats = initialCoveredTargets.get(targetPath) || new Set();
    const propGuard = inferGuardId(segs) || guardId;

    if (!existingCats.has('A. TYPE') && !isAnyJsonValue(propDef)) {
      addMutation({
        seed: seedName,
        category: 'A. TYPE',
        propertyFamily: family,
        schemaPointer: propPtr + '/type',
        schemaKeyword: 'type',
        operation: `Set incompatible primitive on ${targetPath}`,
        guardId: propGuard,
        mutate: (m) => {
          let curr = m;
          for (let i = 0; i < segs.length - 1; i++) curr = curr[segs[i]];
          const val = curr[segs[segs.length - 1]];
          curr[segs[segs.length - 1]] = typeof val === 'number' ? 'invalid' : 42;
        },
      });
      existingCats.add('A. TYPE');
      initialCoveredTargets.set(targetPath, existingCats);
    }

    if (req.has(propName) && !existingCats.has('B. REQUIRED')) {
      addMutation({
        seed: seedName,
        category: 'B. REQUIRED',
        propertyFamily: family,
        schemaPointer: schemaPtr + '/required/' + propName,
        schemaKeyword: 'required',
        operation: `Delete required property at ${targetPath}`,
        guardId: propGuard,
        mutate: (m) => {
          let curr = m;
          for (let i = 0; i < segs.length - 1; i++) curr = curr[segs[i]];
          delete curr[segs[segs.length - 1]];
        },
      });
      existingCats.add('B. REQUIRED');
      initialCoveredTargets.set(targetPath, existingCats);
    }

    if (resolvedProp.enum && !existingCats.has('D. ENUM_CONST')) {
      addMutation({
        seed: seedName,
        category: 'D. ENUM_CONST',
        propertyFamily: family,
        schemaPointer: propPtr + '/enum',
        schemaKeyword: 'enum',
        operation: `Set out-of-domain enum on ${targetPath}`,
        guardId: propGuard,
        mutate: (m) => {
          let curr = m;
          for (let i = 0; i < segs.length - 1; i++) curr = curr[segs[i]];
          curr[segs[segs.length - 1]] = '__invalid_enum_out_of_domain__';
        },
      });
      existingCats.add('D. ENUM_CONST');
      initialCoveredTargets.set(targetPath, existingCats);
    }

    if (resolvedProp.format && !existingCats.has('E. STRING_CONSTRAINT')) {
      addMutation({
        seed: seedName,
        category: 'E. STRING_CONSTRAINT',
        propertyFamily: family,
        schemaPointer: propPtr + '/format',
        schemaKeyword: 'format',
        operation: `Violate format on ${targetPath}`,
        guardId: propGuard,
        mutate: (m) => {
          let curr = m;
          for (let i = 0; i < segs.length - 1; i++) curr = curr[segs[i]];
          curr[segs[segs.length - 1]] = 'not-a-valid-format';
        },
      });
      existingCats.add('E. STRING_CONSTRAINT');
      initialCoveredTargets.set(targetPath, existingCats);
    } else if (resolvedProp.pattern && !existingCats.has('E. STRING_CONSTRAINT')) {
      addMutation({
        seed: seedName,
        category: 'E. STRING_CONSTRAINT',
        propertyFamily: family,
        schemaPointer: propPtr + '/pattern',
        schemaKeyword: 'pattern',
        operation: `Violate regex pattern on ${targetPath}`,
        guardId: propGuard,
        mutate: (m) => {
          let curr = m;
          for (let i = 0; i < segs.length - 1; i++) curr = curr[segs[i]];
          curr[segs[segs.length - 1]] = 'INVALID_PATTERN_VIOLATION';
        },
      });
      existingCats.add('E. STRING_CONSTRAINT');
      initialCoveredTargets.set(targetPath, existingCats);
    }

    if (resolvedProp.oneOf || resolvedProp.anyOf) {
      const alts = resolvedProp.oneOf || resolvedProp.anyOf;
      const match = matchAlternativeBranch(data[propName], alts, resolvedProp.currentRoot);
      if (!match) {
        throw new Error(`General coverage reconciliation error: Seed "${seedName}" data at "${targetPath}" did not match any branch in alternative at "${propPtr}"`);
      }
      walkSupplementalAlternatives(seedName, data[propName], match.branchSchema, propPtr + '/oneOf/' + match.index, targetPath, segs, match.currentRoot);
    } else {
      walkSupplementalAlternatives(seedName, data[propName], propDef, propPtr, targetPath, segs, resolvedProp.currentRoot);
    }
  }
}

for (const [seedName, seedData] of Object.entries(SEEDS)) {
  walkSupplementalAlternatives(seedName, seedData, bundleData.root, '#', '', [], bundleData.root);
}

// ---------------------------------------------------------------------------
// Independent Schema-Site Inventory Construction & Instance Binding (Requirement 2)
// ---------------------------------------------------------------------------

function buildIndependentSchemaInventory(bundle) {
  const inventory = new Map();
  function visit(schema, currentRoot, schemaPointer, resourceUri, refStack = new Set()) {
    if (schema.$ref) {
      const fullRef = (resourceUri || '') + schema.$ref;
      if (refStack.has(fullRef)) return;
      refStack = new Set(refStack);
      refStack.add(fullRef);
    }
    const res = resolveFullSchema(schema, currentRoot);
    const curResUri = res.currentRoot?.$id || resourceUri;
    const curRoot = res.currentRoot;

    if (res.oneOf || res.anyOf) {
      const alts = res.oneOf || res.anyOf;
      for (let i = 0; i < alts.length; i++) {
        visit(alts[i], curRoot, schemaPointer + '/oneOf/' + i, curResUri, refStack);
      }
    }

    const guard = inferGuardFromPtr(schemaPointer);

    if (res.additionalProperties === false) {
      const key = `${curResUri}::${schemaPointer}/additionalProperties::additionalProperties`;
      if (!inventory.has(key)) {
        inventory.set(key, {
          key, resourceUri: curResUri, schemaPointer: schemaPointer + '/additionalProperties',
          keyword: 'additionalProperties', category: 'C. ADDITIONAL_PROPERTIES',
          historicalDecoderGuard: guard, status: 'UNINSTANTIATED', boundPaths: new Set(),
        });
      }
    } else if (res.additionalProperties && typeof res.additionalProperties === 'object' && !isAnyJsonValue(res.additionalProperties)) {
      const key = `${curResUri}::${schemaPointer}/additionalProperties::type`;
      if (!inventory.has(key)) {
        inventory.set(key, {
          key, resourceUri: curResUri, schemaPointer: schemaPointer + '/additionalProperties',
          keyword: 'type', category: 'A. TYPE',
          historicalDecoderGuard: guard, status: 'UNINSTANTIATED', boundPaths: new Set(),
        });
      }
      visit(res.additionalProperties, curRoot, schemaPointer + '/additionalProperties', curResUri, refStack);
    }

    if (res.items) {
      visit(res.items, curRoot, schemaPointer + '/items', curResUri, refStack);
    }

    const req = new Set(res.required || []);
    for (const [propName, propDef] of Object.entries(res.properties || {})) {
      const propPtr = schemaPointer + '/properties/' + propName;
      const propGuard = inferGuardFromPtr(propPtr) || guard;
      const resolvedProp = resolveFullSchema(propDef, curRoot);

      if (!isAnyJsonValue(propDef)) {
        const key = `${curResUri}::${propPtr}::type`;
        if (!inventory.has(key)) {
          inventory.set(key, {
            key, resourceUri: curResUri, schemaPointer: propPtr, keyword: 'type',
            category: 'A. TYPE', propertyKey: propName, historicalDecoderGuard: propGuard,
            status: 'UNINSTANTIATED', boundPaths: new Set(),
          });
        }
      }
      if (req.has(propName)) {
        const key = `${curResUri}::${propPtr}::required`;
        if (!inventory.has(key)) {
          inventory.set(key, {
            key, resourceUri: curResUri, schemaPointer: propPtr, keyword: 'required',
            category: 'B. REQUIRED', propertyKey: propName, historicalDecoderGuard: propGuard,
            status: 'UNINSTANTIATED', boundPaths: new Set(),
          });
        }
      }
      if (resolvedProp.enum) {
        const key = `${curResUri}::${propPtr}::enum`;
        if (!inventory.has(key)) {
          inventory.set(key, {
            key, resourceUri: curResUri, schemaPointer: propPtr, keyword: 'enum',
            category: 'D. ENUM_CONST', propertyKey: propName, historicalDecoderGuard: propGuard,
            status: 'UNINSTANTIATED', boundPaths: new Set(),
          });
        }
      }
      if (resolvedProp.pattern) {
        const key = `${curResUri}::${propPtr}::pattern`;
        if (!inventory.has(key)) {
          inventory.set(key, {
            key, resourceUri: curResUri, schemaPointer: propPtr, keyword: 'pattern',
            category: 'E. STRING_CONSTRAINT', propertyKey: propName, historicalDecoderGuard: propGuard,
            status: 'UNINSTANTIATED', boundPaths: new Set(),
          });
        }
      }
      if (resolvedProp.format) {
        const key = `${curResUri}::${propPtr}::format`;
        if (!inventory.has(key)) {
          inventory.set(key, {
            key, resourceUri: curResUri, schemaPointer: propPtr, keyword: 'format',
            category: 'E. STRING_CONSTRAINT', propertyKey: propName, historicalDecoderGuard: propGuard,
            status: 'UNINSTANTIATED', boundPaths: new Set(),
          });
        }
      }
      visit(propDef, curRoot, propPtr, curResUri, refStack);
    }
  }

  visit(bundle.root, bundle.root, '#', bundle.root_uri || bundle.root.$id);
  return inventory;
}

const independentSchemaInventory = buildIndependentSchemaInventory(bundleData);

function bindInventoryToSeeds(inventory, seeds, rootSchema) {
  function bindSite(resourceUri, schemaPtr, keyword, dataPtr) {
    const site = inventory.get(`${resourceUri}::${schemaPtr}::${keyword}`);
    if (site) {
      site.status = 'INSTANTIATED';
      site.boundPaths.add(dataPtr);
    }
  }

  function walkBinding(seedName, data, schema, schemaPtr, dataPtr, currentRoot) {
    schema = resolveFullSchema(schema, currentRoot);
    currentRoot = schema.currentRoot;
    const curResUri = currentRoot?.$id || rootSchema.$id;

    // Alternative selection also applies to dictionary values and array items.
    if (schema.oneOf || schema.anyOf) {
      const match = matchAlternativeBranch(data, schema.oneOf || schema.anyOf, currentRoot);
      if (!match) {
        throw new Error(`General coverage reconciliation error: Seed "${seedName}" data at "${dataPtr}" did not match any branch in alternative at "${schemaPtr}"`);
      }
      walkBinding(seedName, data, match.branchSchema, schemaPtr + '/oneOf/' + match.index, dataPtr, match.currentRoot);
      return;
    }
    if (!data || typeof data !== 'object') return;

    if (Array.isArray(data)) {
      if (schema.items) {
        for (let i = 0; i < data.length; i++) {
          walkBinding(seedName, data[i], schema.items, schemaPtr + '/items', dataPtr + '/' + i, currentRoot);
        }
      }
      return;
    }

    if (schema.additionalProperties === false) {
      bindSite(curResUri, schemaPtr + '/additionalProperties', 'additionalProperties', dataPtr + '/__unexpected_extension__');
    } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object'
      && !isAnyJsonValue(schema.additionalProperties)) {
      for (const [key, value] of Object.entries(data)) {
        // JSON Schema applies this schema only to keys outside `properties`.
        if (Object.hasOwn(schema.properties || {}, key)) continue;
        const valuePtr = schemaPtr + '/additionalProperties';
        const valuePath = dataPtr + '/' + key;
        bindSite(curResUri, valuePtr, 'type', valuePath);
        walkBinding(seedName, value, schema.additionalProperties, valuePtr, valuePath, currentRoot);
      }
    }

    for (const [propName, propDef] of Object.entries(schema.properties || {})) {
      if (!Object.hasOwn(data, propName)) continue;
      const targetPath = dataPtr + '/' + propName;
      const propPtr = schemaPtr + '/properties/' + propName;
      for (const kw of ['type', 'required', 'enum', 'pattern', 'format']) {
        bindSite(curResUri, propPtr, kw, targetPath);
      }
      walkBinding(seedName, data[propName], propDef, propPtr, targetPath, currentRoot);
    }
  }

  for (const [seedName, seedData] of Object.entries(seeds)) {
    walkBinding(seedName, seedData, rootSchema, '#', '', rootSchema);
  }
}

function reconcileInventoryCoverage(inventory, targetMap, requiredTargetPaths = []) {
  const missingCoverage = [];
  const instantiatedPaths = new Set();
  const uninstantiatedSites = [];
  let instantiatedSitesCount = 0;
  for (const [key, site] of inventory.entries()) {
    // Historical attribution is not a claim that a decoder condition remains.
    assert.ok(!Object.hasOwn(site, 'retainedGuard'), `Unsupported retained protection claim at "${key}"`);
    if (site.status === 'INSTANTIATED') {
      instantiatedSitesCount++;
      assert.ok(site.boundPaths.size > 0, `Instantiated schema site "${key}" has 0 bound paths!`);
      for (const p of site.boundPaths) {
        instantiatedPaths.add(p);
        const hasCheck = (targetMap.get(p) || []).some((m) => m.category === site.category);
        if (!hasCheck) missingCoverage.push(`${p} (${site.schemaPointer}): missing required ${site.category} mutation`);
      }
    } else {
      assert.equal(site.status, 'UNINSTANTIATED', `Unknown inventory status at "${key}"`);
      assert.equal(site.boundPaths.size, 0, `Uninstantiated site "${key}" has bound paths!`);
      uninstantiatedSites.push({
        ...site, coverage: 'UNEXERCISED', deletionEligible: false,
        reason: 'No seed value reaches this schema site; historical decoder attribution proves no retained protection.',
      });
    }
  }
  assert.equal(missingCoverage.length, 0,
    `Schema property coverage incomplete (${missingCoverage.length} missing):\n${missingCoverage.join('\n')}`);
  for (const reqPath of requiredTargetPaths) {
    assert.ok(instantiatedPaths.has(reqPath),
      `Required target path "${reqPath}" is missing from instantiated coverage inventory!`);
  }
  return { instantiatedPaths, instantiatedSitesCount, uninstantiatedSites };
}

bindInventoryToSeeds(independentSchemaInventory, SEEDS, bundleData.root);

// ---------------------------------------------------------------------------
// Suite Execution and Differential Verification
// ---------------------------------------------------------------------------

async function runSuite() {
  console.log('===============================================================');
  console.log('LearningOS S31-06R — Differential Manifest Validation Suite');
  console.log('===============================================================');
  console.log(`Core Contract Version : ${MANIFEST_CONTRACT_VERSION}`);
  console.log(`Schema SHA-256 Pin     : ${MANIFEST_SCHEMA_SHA256}`);
  console.log(`Total Mutation Cases   : ${mutations.length}`);
  console.log('---------------------------------------------------------------');

  // Verify baseline unmodified fixture
  const baselineAjv = validateManifest(baseFixture);
  assert.equal(baselineAjv, true, 'Base fixture must pass Ajv validation');
  assert.doesNotThrow(() => assertManifest(baseFixture), 'Base fixture must pass assertManifest');
  assert.equal(baseFixture._generated.contract_version, MANIFEST_CONTRACT_VERSION);
  assert.equal(baseFixture._generated.schema_sha256, MANIFEST_SCHEMA_SHA256);
  console.log('[PASS] Baseline fixture integrity confirmed.');

  // Verify all 7 seeds pass both validators
  for (const [seedName, seedData] of Object.entries(SEEDS)) {
    const seedAjv = validateManifest(seedData);
    assert.equal(seedAjv, true, `Seed "${seedName}" must pass Ajv validation`);
    assert.doesNotThrow(() => assertManifest(seedData), `Seed "${seedName}" must pass assertManifest`);
  }
  console.log(`[PASS] All ${Object.keys(SEEDS).length} valid seeds confirmed green under both validators.`);

  // Verify ManifestStore contract-version preflight
  const badContractApp = {
    vault: {
      adapter: {
        exists: async () => true,
        read: async () => JSON.stringify({
          ...baseFixture,
          _generated: { ...baseFixture._generated, contract_version: 1 },
        }),
      },
    },
  };
  const store = new ManifestStore(badContractApp);
  const loaded = await store.load();
  assert.equal(loaded, false, 'ManifestStore.load must return false on version mismatch');
  assert.equal(store.ready, false, 'ManifestStore must not be ready');
  assert.match(store.error, /Unsupported manifest contract 1/);
  console.log('[PASS] ManifestStore contract-version preflight confirmed.');

  // Run differential mutations
  const results = [];
  let intentionalDiffCount = 0;
  let unexpectedDiffCount = 0;
  let agreementFailCount = 0;
  let ajvPassCount = 0;
  let ajvFailCount = 0;
  let hwPassCount = 0;
  let hwFailCount = 0;

  for (const m of mutations) {
    const seedSource = SEEDS[m.seed];
    assert.ok(seedSource, `Mutation ${m.id} references unknown seed "${m.seed}"`);
    const candidate = clone(seedSource);

    // Apply deterministic mutation
    m.mutate(candidate);

    // 1. Evaluate compiled Ajv standalone validator
    const ajvPass = Boolean(validateManifest(candidate));
    let ajvErrors = null;
    let primaryError = null;
    if (!ajvPass) {
      ajvErrors = Array.isArray(validateManifest.errors)
        ? validateManifest.errors.map((e) => ({
            instancePath: e.instancePath || '',
            schemaPath: e.schemaPath || '',
            keyword: e.keyword || '',
            params: e.params || {},
            message: e.message || '',
          }))
        : [];
      primaryError = ajvErrors[0] || null;
      ajvFailCount++;
    } else {
      ajvPassCount++;
    }

    // 2. Evaluate real handwritten assertManifest
    let hwPass = true;
    let hwError = null;
    try {
      assertManifest(candidate);
      hwPassCount++;
    } catch (err) {
      hwPass = false;
      hwError = err.message || String(err);
      hwFailCount++;
    }

    // 3. Classify outcome
    let agreementClass = '';
    if (ajvPass && hwPass) {
      agreementClass = 'AJV_PASS_HW_PASS';
    } else if (!ajvPass && !hwPass) {
      agreementClass = 'AJV_FAIL_HW_FAIL';
      agreementFailCount++;
    } else if (!ajvPass && hwPass) {
      agreementClass = 'DIFF_AJV_STRICTER';
    } else {
      agreementClass = 'DIFF_HW_STRICTER';
    }

    const hasDiff = ajvPass !== hwPass;
    if (hasDiff) {
      if (m.expectedDiff) {
        intentionalDiffCount++;
      } else {
        unexpectedDiffCount++;
      }
    }

    results.push({
      ...m,
      ajvPass,
      hwPass,
      ajvErrors,
      primaryKeyword: primaryError?.keyword || null,
      primaryPath: primaryError?.instancePath ?? null,
      primaryMessage: primaryError?.message || null,
      hwError,
      agreementClass,
      hasDiff,
    });
  }

  // -------------------------------------------------------------------------
  // Assertions on Test Results & Regression Sensitivity
  // -------------------------------------------------------------------------
  assert.ok(mutations.length >= 200, `Expected at least 200 mutations, got ${mutations.length}`);
  assert.equal(unexpectedDiffCount, 0, `Encountered ${unexpectedDiffCount} unexpected differential mismatches`);
  assert.equal(intentionalDiffCount, 1, `Expected exactly 1 intentional contextual difference, got ${intentionalDiffCount}`);

  // Confirm Contextual Pin Probe (T-06)
  const probeResult = results.find((r) => r.guardId === 'T-06');
  assert.ok(probeResult, 'Contextual pin probe must exist');
  assert.equal(probeResult.ajvPass, true, 'Ajv must PASS wrong-pin payload (pattern matches)');
  assert.equal(probeResult.hwPass, false, 'assertManifest must FAIL wrong-pin payload');
  assert.match(probeResult.hwError, /Unsupported manifest schema/, 'assertManifest must give expected diagnostic');

  // Verify that all invalid shape mutations were rejected by Ajv
  const shapeMutations = results.filter((r) => r.category !== 'I. CONTEXTUAL_PROBE');
  const unrejectedByAjv = shapeMutations.filter((r) => r.ajvPass);
  assert.equal(
    unrejectedByAjv.length,
    0,
    `Ajv accepted ${unrejectedByAjv.length} invalid shape mutations: ${unrejectedByAjv.map((r) => r.id).join(', ')}`,
  );

  // Verify regression sensitivity: all 9 categories must have non-zero cases
  const REQUIRED_CATEGORIES = [
    'A. TYPE',
    'B. REQUIRED',
    'C. ADDITIONAL_PROPERTIES',
    'D. ENUM_CONST',
    'E. STRING_CONSTRAINT',
    'F. NUMERIC_CONSTRAINT',
    'G. ARRAY_CONSTRAINT',
    'H. NESTED_STRUCTURAL',
    'I. CONTEXTUAL_PROBE',
  ];
  for (const cat of REQUIRED_CATEGORIES) {
    const count = results.filter((r) => r.category === cat).length;
    assert.ok(count > 0, `Category ${cat} produced zero mutation cases`);
  }

  // Verify all 7 seeds are directly referenced by mutations
  const usedSeeds = new Set(results.map((r) => r.seed));
  for (const seedKey of Object.keys(SEEDS)) {
    assert.ok(usedSeeds.has(seedKey), `Seed "${seedKey}" was never exercised by any mutation!`);
  }

  // -------------------------------------------------------------------------
  // Schema-Driven Property Graph Coverage & Completeness Verification (F2)
  // -------------------------------------------------------------------------
  const targetMap = new Map();
  function recordTargetDiff(a, b, p = '') {
    if (JSON.stringify(a) === JSON.stringify(b)) return [];
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return [p];
    const res = [];
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const q = p + '/' + k;
      if (!(k in a) || !(k in b)) res.push(q);
      else res.push(...recordTargetDiff(a[k], b[k], q));
    }
    return res;
  }

  for (const m of mutations) {
    const before = SEEDS[m.seed];
    const after = clone(before);
    m.mutate(after);
    for (const p of recordTargetDiff(before, after)) {
      if (!targetMap.has(p)) targetMap.set(p, []);
      targetMap.get(p).push(m);
    }
  }

  // -------------------------------------------------------------------------
  // Complete Schema Inventory Coverage & Verification (F2 Resolution)
  // -------------------------------------------------------------------------
  const requiredTargetPaths = [
    '/module_concept_edges/0/evidence/0/stage_id',
    '/module_concept_edges/0/evidence/0/study_map_id',
    '/records/20/atlas_question/target/concepts',
    '/study_maps/0/stages/0/title', '/study_maps/0/stages/0/status',
    '/records/0/title', '/modules/0/title', '/projects/0/title',
    ...Object.keys(baseFixture.project_aliases).map((key) => '/project_aliases/' + key),
    ...Object.keys(baseFixture.artifact_revisions).map((key) => '/artifact_revisions/' + key),
    ...Object.entries(baseFixture.progress).flatMap(([key, value]) => [
      '/progress/' + key, ...Object.keys(value).map((field) => '/progress/' + key + '/' + field),
    ]),
  ];
  const { instantiatedPaths, instantiatedSitesCount, uninstantiatedSites } =
    reconcileInventoryCoverage(independentSchemaInventory, targetMap, requiredTargetPaths);
  const { runCoverageControls } = require('./test-manifest-coverage-controls');
  runCoverageControls({ buildIndependentSchemaInventory, bindInventoryToSeeds, reconcileInventoryCoverage });
  console.log(`[PASS] Independent schema inventory verified: ${instantiatedSitesCount} instantiated schema sites (${instantiatedPaths.size} instance paths) fully covered.`);
  console.log(`[INFO] ${uninstantiatedSites.length} schema sites are explicitly unexercised; they grant no decoder deletion permission or retained-protection claim.`);

  // -------------------------------------------------------------------------
  // Golden Verdict Oracle Verification (S31-06B)
  // -------------------------------------------------------------------------
  const GOLDEN_FIXTURE_PATH = path.join(ROOT, 'tests/manifest-validation-golden.json');
  const isGenerateGolden = process.argv.includes('--generate-golden');

  if (isGenerateGolden) {
    let baseGoldenMutations = [];
    if (fs.existsSync(GOLDEN_FIXTURE_PATH)) {
      const existing = JSON.parse(fs.readFileSync(GOLDEN_FIXTURE_PATH, 'utf8'));
      baseGoldenMutations = existing.mutations || [];
    }

    // Append only new mutations, preserving all existing expected verdicts
    const newMutationsToAppend = results.slice(baseGoldenMutations.length).map((r) => ({
      id: r.id,
      category: r.category,
      classification: r.guardId === 'T-05' || r.guardId === 'T-06' ? 'CONTEXTUAL' : 'SHAPE',
      guard_id: r.guardId,
      property_family: r.propertyFamily,
      schema_keyword: r.schemaKeyword,
      operation: r.operation,
      expected_validity: false,
      expected_ajv_pass: r.ajvPass,
      expected_hw_pass: r.hwPass,
      expected_agreement: r.agreementClass,
    }));
    const combinedMutations = [...baseGoldenMutations, ...newMutationsToAppend];

    const goldenPayload = {
      contract_version: MANIFEST_CONTRACT_VERSION,
      schema_sha256: MANIFEST_SCHEMA_SHA256,
      generated_validator_sha256: '15cc06a3bd5464a3708690c03ed4723125d749d35af7213500efcb5c9f650a6b',
      core_commit: 'd34693be19d9ed7ed23f4c309fdef11da2adffb7',
      originating_ui_commit: '88adbf76a0cb8c0b0b994efb649af5bf463e7a80',
      total_mutations: combinedMutations.length,
      seeds: Object.keys(SEEDS).map((seedId) => ({
        seed_id: seedId,
        expected_ajv_pass: true,
        expected_hw_pass: true,
        expected_agreement: 'AJV_PASS_HW_PASS',
      })),
      mutations: combinedMutations,
    };
    fs.writeFileSync(GOLDEN_FIXTURE_PATH, JSON.stringify(goldenPayload, null, 2) + '\n', 'utf8');
    console.log(`[PASS] Golden verdict oracle updated with ${newMutationsToAppend.length} appended mutations at: ${GOLDEN_FIXTURE_PATH}`);
  }

  // Verify against Golden Verdict Oracle
  assert.ok(
    fs.existsSync(GOLDEN_FIXTURE_PATH),
    `Golden verdict oracle missing at ${GOLDEN_FIXTURE_PATH}. Run with --generate-golden to generate.`
  );
  const goldenData = JSON.parse(fs.readFileSync(GOLDEN_FIXTURE_PATH, 'utf8'));
  assert.equal(goldenData.contract_version, MANIFEST_CONTRACT_VERSION, 'Golden contract version mismatch');
  assert.equal(goldenData.schema_sha256, MANIFEST_SCHEMA_SHA256, 'Golden schema SHA-256 mismatch');
  assert.equal(goldenData.total_mutations, results.length, 'Golden mutation count mismatch');

  const goldenMap = new Map(goldenData.mutations.map((g) => [g.id, g]));
  for (const r of results) {
    const golden = goldenMap.get(r.id);
    assert.ok(golden, `Mutation ${r.id} missing from golden verdict fixture`);
    assert.equal(r.ajvPass, golden.expected_ajv_pass, `Mutation ${r.id} Ajv verdict diverged from golden expectation`);
    assert.equal(r.hwPass, golden.expected_hw_pass, `Mutation ${r.id} handwritten verdict diverged from golden expectation`);
    assert.equal(r.agreementClass, golden.expected_agreement, `Mutation ${r.id} agreement class diverged from golden expectation`);
  }
  console.log('[PASS] Independent golden verdict oracle verified across all mutations.');

  console.log('---------------------------------------------------------------');
  console.log(`Executed Mutations        : ${results.length}`);
  console.log(`Ajv FAIL / HW FAIL (Agree) : ${agreementFailCount}`);
  console.log(`Intentional Contextual Diff: ${intentionalDiffCount} (T-06 Wrong-Pin Probe: ${probeResult.id})`);
  console.log(`Unexpected Disagreements   : ${unexpectedDiffCount}`);
  console.log('---------------------------------------------------------------');
  console.log('[PASS] All differential validation assertions satisfied.');

  // Write Evidence Coverage Report
  writeCoverageReport(results, {
    totalMutations: results.length,
    agreementFailCount,
    intentionalDiffCount,
    unexpectedDiffCount,
    ajvPassCount,
    ajvFailCount,
    hwPassCount,
    hwFailCount,
    instantiatedCount: instantiatedPaths.size,
    instantiatedSitesCount,
    inventory: [...independentSchemaInventory.values()],
    uninstantiatedCount: uninstantiatedSites.length,
    uninstantiatedPaths: uninstantiatedSites,
  });
}

function writeCoverageReport(results, stats) {
  const scratchDir = path.resolve(ROOT, '../scratch');
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }
  const reportPath = path.join(scratchDir, 'S31-06-coverage-report.md');
  fs.writeFileSync(path.join(scratchDir, 'S31-06-schema-inventory.json'), JSON.stringify({
    instantiatedSites: stats.instantiatedSitesCount,
    uninstantiatedSites: stats.uninstantiatedCount,
    sites: stats.inventory.map((site) => ({
      ...site, boundPaths: [...site.boundPaths],
      coverage: site.status === 'INSTANTIATED' ? 'MUTATION_COVERED' : 'UNEXERCISED',
      deletionEligible: false,
    })),
  }, null, 2) + '\n');

  // Group by category
  const byCategory = {};
  for (const r of results) {
    byCategory[r.category] = (byCategory[r.category] || 0) + 1;
  }

  // Group by keyword
  const byKeyword = {};
  for (const r of results) {
    byKeyword[r.schemaKeyword] = (byKeyword[r.schemaKeyword] || 0) + 1;
  }

  // Group by property family
  const byFamily = {};
  for (const r of results) {
    byFamily[r.propertyFamily] = (byFamily[r.propertyFamily] || 0) + 1;
  }

  // Group by guard identifier
  const byGuard = {};
  for (const r of results) {
    if (r.guardId) {
      byGuard[r.guardId] = (byGuard[r.guardId] || 0) + 1;
    }
  }

  const probe = results.find((r) => r.guardId === 'T-06');
  const probeId = probe ? probe.id : 'MUT-0256';

  const identity = (directory) => execFileSync('git', ['-C', directory, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const digest = (filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
  const report = `# S31-06R — Differential Manifest Validation Suite Coverage Report

**Date:** ${new Date().toISOString()}
**Task:** S31-06R — Differential manifest validation suite & CI enforcement
**Status:** **PASS** (100% agreement on all shape mutations; exact contextual probe verified)
**Authority:** SPEC §15 and LearningOS-Phase5-Agent-Execution-Plan.md

---

## 1. Environment & Commit Identities (Item A)

- **Core Worktree:** \`${coreRoot}\`
- **Core HEAD:** \`${identity(coreRoot)}\`
- **UI Worktree:** \`${ROOT}\`
- **UI HEAD:** \`${identity(ROOT)}\` (HEAD does not identify uncommitted files)
- **Suite Source SHA-256:** \`${digest(__filename)}\`
- **Generated Validator SHA-256:** \`${digest(path.join(ROOT, 'src/contracts/generated/manifest.validator.cjs'))}\`
- **Contract Version:** 15
- **Schema SHA-256:** \`${MANIFEST_SCHEMA_SHA256}\`

---

## 2. Schema Graph Inventory & Reconciliation (Item B & E)

### A. Counting Conventions Reconciliation
- **Root schema definitions:** ${Object.keys(bundleData.root.$defs || {}).length}.
- **Transitive schema resources:** ${Object.keys(bundleData.resources || {}).length}.
- **Inventory accounting:** ${stats.instantiatedSitesCount} instantiated sites and ${stats.uninstantiatedCount} unexercised sites. Definition counts do not prove that all branches were exercised.

### B. Graph Structure
- **Root Properties:** Exactly 28 declared properties with \`additionalProperties: false\`.
- **Top-Level Collection Arrays (18):**
  - \`academic_deadlines\`, \`garden_entries\`, \`review_items\`, \`module_source_maps\`, \`modules\`, \`programs\`, \`project_relationships\`, \`projects\`, \`records\`, \`relations\`, \`semesters\`, \`stages\`, \`study_maps\`, \`thematic_groups\`, \`topic_packs\`, \`topics\`, \`unit_material_syntheses\`, \`units\`.
- **Top-Level Secondary Object Surfaces (8):**
  - \`ai_actions\`, \`artifact_revisions\`, \`backlinks\`, \`counts\`, \`indexes\`, \`progress\`, \`project_aliases\`, \`resume_pointer\`.
- **Top-Level Metadata Surface (1):**
  - \`_generated\` (9 metadata attributes including \`contract_version\` and \`schema_sha256\`).
- **Top-Level Graph Edge Surface (1):**
  - \`module_concept_edges\` (array of items with \`module_id\`, \`concept_id\`, and \`evidence\` union).

### C. Instantiated and Uninstantiated Paths Inventory (F2 Resolution)
- **Instantiated Property Paths:** Exactly **${stats.instantiatedCount}** property paths (${stats.instantiatedSitesCount} schema sites) across all 7 seeds are instantiated and checked for the inventory categories (type, required removal, additionalProperties, enum, and format/pattern), including deep nested paths such as \`/study_maps/0/stages/0/title\`, \`/study_maps/0/stages/0/status\`, and polymorphic record fields.
- **Uninstantiated Sub-Paths:** **${stats.uninstantiatedCount}** optional/auxiliary paths across declared schema models are not instantiated in any seed. They are explicitly **UNEXERCISED**, prove no retained decoder protection, and grant **no deletion permission**. Historical decoder identifiers are attribution only. The complete inventory is written to \`S31-06-schema-inventory.json\`.

---

## 3. Mutation Generation Algorithm (Item C)

The deterministic mutation suite applies 9 orthogonal mutation operators:

1. **Category A (Type Violations):** Injects incompatible primitives (e.g. integer 42) into root object properties, collection arrays, secondary surface maps, and nested fields.
2. **Category B (Required Properties):** Deletes required fields from root (28 properties), \`_generated\` (9 properties), \`indexes\` (16 properties), and collection item models.
3. **Category C (Additional Properties):** Injects undeclared properties (\`__unexpected_extension__\`, etc.) into closed root objects, collections, and item schemas.
4. **Category D (Enum & Const Violations):** Replaces closed enum sets with out-of-domain strings and tests exact constants (\`contract_version: 14\`, \`ai_actions.contract_version: 2\`, \`coordination.id\`, \`coordination.path\`).
5. **Category E (String Constraints):** Violates anchored regular expressions on identifier fields (\`module-\`, \`unit-\`, \`project-\`, \`detour-\`, \`proposal-\`, etc.), empty strings on \`minLength: 1\` fields, invalid date formats (\`YYYY-MM-DD\`), and invalid URI formats.
6. **Category F (Numeric Constraints):** Injects negative integers (-1) into non-negative metrics (\`minimum: 0\` and \`minimum: 1\`) and floating-point values into integer fields.
7. **Category G (Array Constraints):** Injects empty arrays \`[]\` where \`minItems: 1\` is required and duplicate items into index maps requiring \`uniqueItems: true\`.
8. **Category H (Nested Structural & Polymorphic Records):** Exercises deep structural properties across module examinations, material syntheses, evidence variants, and all 10 seeded polymorphic record union variants.
9. **Category I (Contextual Refusal Probe):** Mutates \`_generated.schema_sha256\` to a valid 64-hex SHA-256 pattern to verify that the compiled schema validator accepts the payload while \`assertManifest\` refuses it.

---

## 4. Valid Base Seeds (Item D)

| Seed ID | Description | Role in Suite | Verified Green |
|:---|:---|:---|:---|
| \`base\` | Canonical fixture vault manifest (\`manifest.json\`) | Baseline for 28 root properties and standard models | YES |
| \`with-alias\` | Baseline fixture + \`compatibility-alias\` record | Exercises legacy alias polymorphic record union branch | YES |
| \`with-path\` | Baseline fixture + \`learning-path\` record | Exercises learning path polymorphic record union branch | YES |
| \`with-knowledge-edge\` | Baseline fixture + \`knowledge-node\` evidence | Exercises knowledge-node evidence union branch | YES |
| \`with-note-analysis\` | Baseline fixture + \`noteRecord\` with \`atlas_question\` & \`material_analysis\` | Closes Gap 1 (atlas questions, material analysis, anchors) | YES |
| \`with-detour-shelving\` | Baseline fixture + \`studyMap\` with active \`detours\` & \`shelving\` | Closes Gap 2 (detours, shelving proposals, archive items) | YES |
| \`with-synthesis-record\` | Baseline fixture + \`unit-material-synthesis\` inside \`records\` | Closes Gap 3 (synthesis record in polymorphic union) | YES |

*All 7 seeds confirmed green under both compiled Ajv and production assertManifest prior to mutation.*

---

## 5. Executive Summary Statistics (Item E)

| Metric | Count | Notes |
|:---|:---|:---|
| **Total Evaluated Cases** | **${stats.totalMutations}** | Deterministic mutation cases derived from schema |
| **Valid Base Seeds** | **${Object.keys(SEEDS).length}** | Base fixture + 6 specialized branch seeds |
| **Ajv PASS / HW PASS** | **${Object.keys(SEEDS).length}** | Valid base seeds accepted by both validators |
| **Ajv FAIL / HW FAIL (Agreement)** | **${stats.agreementFailCount}** | Both validators reject invalid shape mutation |
| **Intentional Contextual Difference** | **${stats.intentionalDiffCount}** | Case ${probeId} (T-06 wrong-pin probe: Ajv PASS, HW FAIL) |
| **Unexpected Differences** | **${stats.unexpectedDiffCount}** | Zero unexplained divergences |
| **Ajv Rejection Rate on Invalid Shapes** | **100%** | Zero invalid shape mutations accepted by Ajv |

---

## 6. Mutation Counts by Category (Item F)

| Category | Count | Description |
|:---|:---|:---|
${Object.entries(byCategory).sort().map(([cat, count]) => `| **${cat}** | ${count} | Exercising declared category constraints |`).join('\n')}

---

## 7. Mutation Counts by JSON Schema Keyword

| JSON Schema Keyword | Mutation Count |
|:---|:---|
${Object.entries(byKeyword).sort().map(([kw, count]) => `| \`${kw}\` | ${count} |`).join('\n')}

---

## 8. Mutation Counts by Manifest Property Family

| Property Family | Count | Notes |
|:---|:---|:---|
${Object.entries(byFamily).sort().map(([fam, count]) => `| \`${fam}\` | ${count} | Full collection and schema coverage |`).join('\n')}

---

## 9. Ajv / Handwritten Agreement Matrix (Item H)

| Agreement Class | Count | Description |
|:---|:---|:---|
| \`AJV_PASS_HW_PASS\` | ${Object.keys(SEEDS).length} | Baseline valid seeds (accepted by both) |
| \`AJV_FAIL_HW_FAIL\` | ${stats.agreementFailCount} | Invalid shape mutations (rejected by both) |
| \`DIFF_AJV_STRICTER\` | 0 | Cases where Ajv rejects but handwritten accepts |
| \`DIFF_HW_STRICTER\` | 1 | Intentional contextual pin probe (T-06: ${probeId}) |

---

## 10. Mismatches and Divergences

- **Total Unexpected Divergences:** **0**
- **Total Intentional Contextual Differences:** **1**
  - **Case ID:** \`${probeId}\`
  - **Property:** \`_generated.schema_sha256\`
  - **Mutation:** Set to \`sha256:0000000000000000000000000000000000000000000000000000000000000000\`
  - **Ajv Result:** PASS (matches schema regex \`^sha256:[0-9a-f]{64}$\`)
  - **assertManifest Result:** FAIL (\`Unsupported manifest schema\`)
  - **Diagnostic:** \`TypeError: Unsupported manifest schema sha256:0000000000000000000000000000000000000000000000000000000000000000; expected ${MANIFEST_SCHEMA_SHA256}.\`

---

## 11. Contextual Refusal Probes

### A. Schema SHA-256 Byte Pin Probe (SPEC §15 item 6)
- **Case ID:** \`${probeId}\`
- **Ajv Verdict:** **PASS** (satisfies schema pattern \`^sha256:[0-9a-f]{64}$\`).
- **assertManifest Verdict:** **FAIL** (\`TypeError: Unsupported manifest schema ...\`).
- **Conclusion:** Conclusively demonstrates that host runtime byte-pinning remains active and separate from Ajv schema compilation.

### B. Contract-Version Preflight Probe
- **Tested via:** \`ManifestStore.load()\` with manifest carrying \`_generated.contract_version: 1\`.
- **Result:** Refused immediately with \`Unsupported manifest contract 1; LearningOS UI requires contract 15.\`.
- **Conclusion:** Confirms contextual preflight protects production loaders before schema execution.

---

## 12. Historical Decoder Attribution (Item G, N, O)

| Historical ID | Historical Location | Surface / Responsibility | Mutations | Boundary Verdict Agreement | Historical Classification |
|:---|:---|:---|:---|:---|:---|
${Object.entries(GUARD_METADATA).map(([gid, meta]) => {
  const count = byGuard[gid] || 0;
  return `| **${gid}** | \`${meta.loc}\` | ${meta.desc} | ${count} | ${gid === 'T-06' ? 'Ajv PASS / HW FAIL' : 'Ajv FAIL / HW FAIL'} | \`${meta.class}\` |`;
}).join('\n')}

- **Historical decoder identifiers:** 47 attribution rows; these are not counts of currently executable guards.
- **Retired conditions:** T-27, T-31 and T-41.
- **Contextual bindings preserved:** T-05 and T-06.

---

## 13. Remaining Untested Conditions & Limitations (Item I)

1. **Unexercised schema sites:** ${stats.uninstantiatedCount} sites are explicitly listed in \`S31-06-schema-inventory.json\`. They have no mutation-coverage or retained-protection attestation. No further decoder deletion is authorized by them.
2. **Atomic Invalidation:** Each test case mutates exactly one property at a time; multi-attribute simultaneous failure combinations are not combinatorially generated.
3. **Diagnostic Formatting:** The suite proves equivalence of rejection behavior (accept/reject semantics), not identical string error messages.

---

## 14. S31-07 Deletion Readiness Assessment

1. **Bounded evidence:** Mutation agreement covers the instantiated inventory categories only. Unexercised branches grant no decoder deletion permission. The production assertion invokes Ajv first, so its rejection does not independently prove execution of a handwritten condition.
2. **Contextual Isolation Proved:** The 2 contextual guards (\`T-05\` and \`T-06\`) operate independently and must remain preserved.
3. **Type Narrowing Invariant:** In S31-07, \`assertManifest\` must retain runtime validation by invoking \`validateManifest\` and contextual pins before narrowing. Unchecked casts (\`as Manifest\`) are prohibited.
4. **Safety Fence Established:** This differential suite is integrated into \`npm run check\` and CI as a blocking verification step.

---
*Report generated automatically by \`tests/test-manifest-validation-diff.js\`.*
`;

  fs.writeFileSync(reportPath, report, 'utf8');
  console.log(`[PASS] Evidence report written to: ${reportPath}`);
}

module.exports = { buildIndependentSchemaInventory, bindInventoryToSeeds, reconcileInventoryCoverage };
if (require.main === module) {
  runSuite().catch((err) => {
    console.error('\n[FATAL] Differential suite failed:', err);
    process.exit(1);
  });
}
