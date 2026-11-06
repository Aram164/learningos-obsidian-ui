'use strict';

/*
 * Study Desk v2 · a lecture's materials (Figma OYWz… C2–C4; BRIEF §6, D13).
 * The model is pure and loaded from source; the screen is checked through the
 * built plugin against the synthetic fixture, never the live repository.
 */
const { ROOT, VIEW, boot, check, heading, waitFor } = require('./support');
const { createSourceModuleLoader } = require('../source-module-loader');

/* ── a C2-shaped synthetic lecture: six stages, triage as in AML L02 ────── */

function resource(label, sourceId, kind, scopeTriage, extra = {}) {
  return {
    record: { label, source_id: sourceId, kind, scope_triage: scopeTriage, angle: `${label}: why`, ...extra },
    id: null, kind, label, locator: extra.locator ?? `${label} locator`, sourceId, scopeTriage, canOpen: true,
  };
}

function option(routeId, sourceId, format, depth, scope, locator, extra = {}) {
  return {
    record: { id: routeId, format, depth, scope, locator, source_id: sourceId, title: routeId, angle: `${routeId} angle`, ...extra.record },
    title: routeId, format, angle: `${routeId} angle`, covers: [], depth, scope, locator,
    sourceId, routeId, canOpen: true, canChoose: true, selected: Boolean(extra.selected),
  };
}

function stage(id, resources) {
  return { id, title: id, record: { id }, status: 'pending', resources, concepts: [], doneWhen: [] };
}

/*
 * The fixture's SaD L04 has three placements, a flat list. This patch states a
 * C2-shaped lecture on the same unit: the course's deck, sheet and an older
 * deck, an intuition route used twice, and a route no stage uses.
 */
function richLecture(manifest) {
  const unitId = 'unit-fixture-sad-l04';
  const route = (id, sourceId, title, format, depth, scope, locator, extra = {}) => ({
    id, unit_id: unitId, source_id: sourceId, title, format, depth, scope, locator,
    angle: `${title}: what it is for.`, angle_detail: `${title}: the full rationale.`, covers: ['knowledge-fixture-l04-bayes'], ...extra,
  });
  const book = manifest.records.find((row) => row.id === 'source-fixture-book');
  manifest.records.push({ ...JSON.parse(JSON.stringify(book)), id: 'source-fixture-slides', source_type: 'lecture', title: 'SaD — fixture lecture slides (SoSe 2099)' });
  const map = manifest.module_source_maps.find((row) => row.module_id === 'module-fixture-m2');
  const local = (path) => ({ material_uri: `material://source-fixture-slides/${path}`, material_path: `materials/fixture/${path}`, material_exists: true });
  map.sources.push(
    { source_id: 'source-fixture-slides', role: 'course-material', priority: 0, why: 'The course as taught.', unit_routes: [
      route('route-fx-deck', 'source-fixture-slides', 'Fixture lecture deck', 'course-material', 'course-aligned', 'current', 'lecture-slides/VL 04.pdf', local('lecture-slides/VL 04.pdf')),
      route('route-fx-sheet', 'source-fixture-slides', 'Fixture exercise sheet 4', 'exercise', 'practice', 'current', 'exercises/blatt-04.pdf', local('exercises/blatt-04.pdf')),
      route('route-fx-old', 'source-fixture-slides', 'Older fixture deck', 'course-material', 'course-aligned', 'prior-year', 'old/VL 04.pdf', local('old/VL 04.pdf')),
    ] },
    { source_id: 'source-fixture-islp', role: 'intuition', priority: 2, why: 'A gentler account.', unit_routes: [
      route('route-fx-islp', 'source-fixture-islp', 'ISLP fixture intuition', 'book', 'intuition', 'complementary', 'islp.pdf §2.1', { url: 'https://www.statlearning.com/' }),
    ] },
    { source_id: 'source-fixture-video', role: 'optional-depth', priority: 3, why: 'Beyond the lecture.', unit_routes: [
      route('route-fx-unplaced', 'source-fixture-video', 'Fixture deep-dive video', 'video', 'advanced-reference', 'optional', 'Lecture 9', { url: 'https://example.org/lecture-9' }),
    ] },
  );
  const place = (routeId, sourceId, label, kind, triage, locator) => ({ route_id: routeId, source_id: sourceId, label, kind, scope_triage: triage, locator, angle: `${label}: why here.` });
  const studyMap = manifest.study_maps.find((row) => row.unit_id === unitId);
  const stage = (id) => studyMap.stages.find((row) => row.id === id);
  stage('stage-fixture-foundations').resources.push(place('route-fx-deck', 'source-fixture-slides', 'Fixture lecture deck', 'read', 'required-now', 'lecture-slides/VL 04.pdf'));
  stage('stage-fixture-conditioning').resources.push(
    place('route-fx-deck', 'source-fixture-slides', 'Fixture lecture deck', 'read', 'required-now', 'lecture-slides/VL 04.pdf'),
    place('route-fx-sheet', 'source-fixture-slides', 'Fixture exercise sheet 4', 'practise', 'required-now', 'exercises/blatt-04.pdf'),
    place('route-fx-islp', 'source-fixture-islp', 'ISLP fixture intuition', 'read', 'helpful-now', 'islp.pdf §2.1'),
  );
  stage('stage-fixture-self-test').resources.push(
    place('route-fx-sheet', 'source-fixture-slides', 'Fixture exercise sheet 4', 'practise', 'required-now', 'exercises/blatt-04.pdf'),
    place('route-fx-old', 'source-fixture-slides', 'Older fixture deck', 'reference', 'reference-only', 'old/VL 04.pdf'),
    place('route-fx-islp', 'source-fixture-islp', 'ISLP fixture intuition', 'read', 'helpful-now', 'islp.pdf §2.1'),
  );
}

module.exports = async function run() {
  const load = createSourceModuleLoader(ROOT);
  const mp = load('src/features/unit/material-purpose.ts');

  heading('Study Desk materials: what a material is for (BRIEF §6)');
  {
    const facts = (overrides) => ({ format: null, depth: null, scope: null, role: null, sourceType: null, kind: 'read', triages: ['helpful-now'], hasSource: true, target: 'file', ...overrides });
    const cases = [
      ['the course’s own deck is The lecture', { role: 'course-material', triages: ['required-now'] }, 'lecture'],
      ['a lecture source counts as the course even without a role', { sourceType: 'lecture' }, 'lecture'],
      ['course practice is Practice', { role: 'course-material', kind: 'practise' }, 'practice'],
      ['a prior-year course file is Reference', { role: 'course-material', scope: 'prior-year', triages: ['required-now'] }, 'reference'],
      ['a course file kept only for reference is Reference', { role: 'course-material', triages: ['reference-only', 'reference-only'] }, 'reference'],
      ['a course file required somewhere stays The lecture, whatever its first placement says', { role: 'course-material', triages: ['reference-only', 'required-now'] }, 'lecture'],
      ['depth beats role', { depth: 'intuition', role: 'optional-depth' }, 'intuition'],
      ['orientation reads as Intuition', { depth: 'orientation' }, 'intuition'],
      ['course-aligned outside the course reads as Theory', { depth: 'course-aligned', role: 'reference' }, 'theory'],
      ['an unassessed depth falls through to the role', { depth: 'unassessed', role: 'spine' }, 'theory'],
      ['an exercise format is Practice before any role', { format: 'exercise', role: 'reference' }, 'practice'],
      ['a notebook is Build it', { format: 'notebook' }, 'build'],
      ['optional depth is Going deeper', { role: 'optional-depth' }, 'deeper'],
      ['practising from a spine textbook is Practice, not Theory', { kind: 'practise', role: 'spine' }, 'practice'],
      ['practising from an implementation source is Build it', { kind: 'practise', role: 'implementation' }, 'build'],
      ['a route’s authored depth still outranks the activity', { kind: 'practise', depth: 'intuition' }, 'intuition'],
      ['a candidate source is Reference', { role: 'candidate' }, 'reference'],
      ['deferred everywhere is Going deeper', { triages: ['deferred', 'deferred'] }, 'deeper'],
      ['watching with nothing else known is Intuition', { kind: 'watch' }, 'intuition'],
      ['reference work with nothing else known is Reference', { kind: 'reference' }, 'reference'],
      ['an unlabelled read is Theory, never dropped', {}, 'theory'],
    ];
    for (const [name, overrides, expected] of cases) {
      const actual = mp.resolvePurpose(facts(overrides));
      check(name, actual === expected, `got ${actual}`);
    }
    check('purposes keep the study order', mp.MATERIAL_PURPOSES.map((p) => p.key).join() === 'lecture,intuition,theory,practice,build,deeper,reference');
  }

  heading('Study Desk materials: what a material is (structured fields only)');
  {
    const facts = (overrides) => ({ format: null, depth: null, scope: null, role: null, sourceType: null, kind: 'read', triages: [], hasSource: true, target: 'file', ...overrides });
    const cases = [
      ['a lecture deck is Slides', { sourceType: 'lecture' }, 'slides'],
      ['a course’s own documentation is its Script', { role: 'course-material', sourceType: 'documentation' }, 'scripts'],
      ['course practice is an Exercise sheet', { sourceType: 'lecture', kind: 'practise' }, 'exercise-sheets'],
      ['course solutions stay Solutions', { sourceType: 'lecture', format: 'solutions', kind: 'practise' }, 'solutions'],
      ['a prior-year course file is an Older version', { sourceType: 'lecture', scope: 'prior-year' }, 'older'],
      ['a watched course file is a Recording', { role: 'course-material', kind: 'watch' }, 'recordings'],
      ['the route’s format beats the source’s type', { format: 'code', sourceType: 'book' }, 'code'],
      ['practice from a course source is a Problem set', { sourceType: 'course', kind: 'practise' }, 'problem-sets'],
      ['a course’s readings are a Course', { format: 'course', kind: 'read' }, 'courses'],
      ['a watched source with no format is a Video', { sourceType: 'book', kind: 'watch' }, 'videos'],
      ['documentation is Notes & docs', { sourceType: 'documentation' }, 'notes-docs'],
      ['an unknown source stays reachable as Other', { sourceType: 'other' }, 'other'],
      ['work with no source and nothing to open is a Task', { kind: 'practise', hasSource: false, target: 'none' }, 'tasks'],
      ['practice behind a link is a Problem set, not a Task', { kind: 'practise', hasSource: false, target: 'web' }, 'problem-sets'],
      ['a sourceless link is a Web page', { kind: 'reference', hasSource: false, target: 'web' }, 'web-pages'],
      ['a sourceless vault note is Notes & docs', { hasSource: false, target: 'vault' }, 'notes-docs'],
    ];
    for (const [name, overrides, expected] of cases) {
      const actual = mp.resolveType(facts(overrides));
      check(name, actual === expected, `got ${actual}`);
    }
  }

  heading('Study Desk materials: one lecture, best first (D13)');
  {
    // Stage-by-stage triage as AML L02 has it: R required, H helps, F reference.
    const deck = resource('Current deck', 'src-course', 'read', 'required-now', { locator: 'deck.pdf' });
    const sheet = resource('Übung 02', 'src-course', 'practise', 'required-now', { locator: 'uebung02.pdf' });
    const bonus = resource('Bonusblatt 01', 'src-course', 'practise', 'required-now', { locator: 'bonus01.pdf' });
    const older = resource('Older deck', 'src-course', 'reference', 'reference-only', { locator: 'old.pdf' });
    const cornell = resource('Cornell HW1', 'src-cornell', 'practise', 'helpful-now');
    const caltech = resource('Caltech HW4', 'src-caltech', 'practise', 'helpful-now');
    const mit = resource('MIT 6.036 unit 2', 'src-mit', 'read', 'helpful-now', { locator: 'unit 2' });
    const kroese = resource('Kroese CV', 'src-kroese', 'reference', 'reference-only');
    const cs229 = resource('CS229 lecture 10', 'src-cs229-video', 'reference', 'reference-only');
    const stages = [
      stage('s1', [deck, sheet]),
      stage('s2', [deck, sheet, bonus, older, mit, cornell, kroese]),
      stage('s3', [deck, sheet, bonus, cornell]),
      stage('s4', [deck, cornell]),
      stage('s5', [deck, older, mit, caltech, cs229]),
      stage('s6', [deck, sheet, older, mit, cornell, caltech, kroese, cs229]),
    ];
    const mitRoute = option('route-mit', 'src-mit', 'course', 'practice', 'complementary', 'unit 2');
    const unplaced = option('route-unplaced', 'src-extra', 'book', 'derivation', 'complementary', 'ch. 9');
    const roles = { 'src-course': 'course-material', 'src-cornell': null, 'src-caltech': null, 'src-mit': 'practice', 'src-kroese': 'optional-depth', 'src-cs229-video': 'optional-depth', 'src-extra': 'spine' };
    const types = { 'src-course': 'lecture', 'src-cornell': 'other', 'src-caltech': 'course', 'src-mit': 'course', 'src-kroese': 'book', 'src-cs229-video': 'video', 'src-extra': 'book' };
    const routes = [mitRoute, unplaced];
    const build = (options = routes) => mp.buildLectureMaterials({
      stages, options,
      routeOf: (res) => options.find((o) => o.sourceId === res.sourceId && o.locator === res.locator) ?? null,
      roleOf: (id) => roles[id] ?? null,
      sourceTypeOf: (id) => types[id] ?? null,
    });
    const materials = build();
    const byTitle = (title) => materials.find((m) => m.title === title);
    check('each material appears once, however many stages place it', materials.length === 10
      && byTitle('Current deck').uses.every((use) => use === 'required'));
    check('a route no stage uses is still listed, and uses no stage', byTitle('ch. 9 locator') === undefined
      && materials.some((m) => m.key === 'route-unplaced' && m.uses.every((use) => use === null) && m.placements.length === 0));
    check('a placement joined to its route takes the route’s facts', byTitle('MIT 6.036 unit 2').route?.routeId === 'route-mit'
      && byTitle('MIT 6.036 unit 2').type === 'courses');
    check('plan order is first appearance, then unplaced routes', byTitle('Current deck').order === 0
      && materials.find((m) => m.key === 'route-unplaced').order === materials.length - 1);

    const groups = mp.groupByPurpose(materials);
    const group = (key) => groups.find((g) => g.purpose.key === key);
    check('groups follow the study order and skip empty purposes',
      groups.map((g) => g.purpose.key).join() === 'lecture,theory,practice,deeper,reference');
    check('practice ranks the most-required first and marks it Best fit',
      group('practice').materials[0].title === 'Übung 02' && group('practice').bestFit?.title === 'Übung 02');
    check('inside a type, more stages used ranks higher',
      group('practice').types.find((t) => t.type.key === 'problem-sets').materials.map((m) => m.title).join() === 'Cornell HW1,Caltech HW4');
    check('types sit in the fixed order whatever the ranking',
      group('practice').types.map((t) => t.type.key).join() === 'exercise-sheets,problem-sets,courses');
    check('a long mixed group gets type sub-headings', group('practice').showTypes === true);
    check('a short group reads as one list', group('deeper').showTypes === false && group('lecture').showTypes === false);
    check('a tie at the top gets no Best fit', group('deeper').materials.length === 2 && group('deeper').bestFit === null);
    check('a group of one has nothing to be best among', group('lecture').bestFit === null && group('reference').bestFit === null);

    const pickedRoutes = [mitRoute, option('route-unplaced', 'src-extra', 'book', 'derivation', 'complementary', 'ch. 9', { selected: true })];
    const picked = mp.groupByPurpose(build(pickedRoutes));
    const theory = picked.find((g) => g.purpose.key === 'theory');
    check('a pick has no Best fit beside it', theory.bestFit === null && theory.materials[0].picked === true);
    const practicePicked = mp.groupByPurpose(build([option('route-mit', 'src-mit', 'course', 'practice', 'complementary', 'unit 2', { selected: true })]))
      .find((g) => g.purpose.key === 'practice');
    check('a pick moves to the top of its type and suppresses Best fit',
      practicePicked.types.find((t) => t.type.key === 'courses').materials[0].picked === true && practicePicked.bestFit === null
      && practicePicked.materials[0].title === 'MIT 6.036 unit 2');

    const stageFive = materials.filter((m) => m.uses[4]);
    const filtered = mp.groupByPurpose(stageFive, 4);
    check('a stage filter keeps only what that stage uses', stageFive.length === 5 && !stageFive.some((m) => m.title === 'Übung 02'));
    check('under a stage filter the stage’s own triage ranks first',
      mp.rankMaterials(stageFive, 4).map((m) => m.title).slice(0, 1).join() === 'Current deck');
    check('under a stage filter, the filtered group still marks a strict leader',
      filtered.find((g) => g.purpose.key === 'practice').bestFit?.title === 'MIT 6.036 unit 2');

    check('structure follows volume', mp.lectureLayout(6) === 'flat' && mp.lectureLayout(7) === 'grouped'
      && mp.lectureLayout(30) === 'grouped' && mp.lectureLayout(31) === 'collapsed');
    const where = () => 'local';
    const text = (m) => `${m.title} ${m.locator ?? ''}`;
    const filter = (overrides) => ({ ...mp.NO_FILTER, ...overrides });
    check('search matches every word, case-folded', mp.matchesFilter(byTitle('Cornell HW1'), filter({ query: 'cornell  hw1' }), where, text)
      && !mp.matchesFilter(byTitle('Cornell HW1'), filter({ query: 'cornell caltech' }), where, text));
    check('the type and where filters narrow', mp.matchesFilter(byTitle('Cornell HW1'), filter({ type: 'problem-sets' }), where, text)
      && !mp.matchesFilter(byTitle('Cornell HW1'), filter({ type: 'textbooks' }), where, text)
      && !mp.matchesFilter(byTitle('Cornell HW1'), filter({ where: 'web' }), where, text));
    check('no filter is no narrowing', !mp.isFiltered(mp.NO_FILTER) && mp.isFiltered(filter({ stage: 0 })));
    check('stage runs read as words past nine stages', mp.stageRuns(['required', null, null, 'helps', 'helps', null, 'reference']) === 'Stages 1, 4–5, 7'
      && mp.stageRuns([null, 'helps']) === 'Stage 2' && mp.stageRuns([null]) === 'No stage yet');
  }

  heading('Study Desk materials: the lecture page (C2, C3)');
  {
    const { app, plugin, calls } = await boot({ patchManifest: richLecture });
    const opened = [];
    plugin.openResource = (record) => { opened.push(record); };
    await plugin.setInterfaceDesign('study-desk');
    await plugin.nav.openUnit('unit-fixture-sad-l04');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    const root = () => view.contentEl;
    root().findText('los-filter-tab', 'Materials').fire('click');
    const purposes = () => root().find('sd-purpose').map((node) => node.getAttribute('data-purpose'));
    check('every material appears in a purpose group, in study order',
      purposes().join() === 'lecture,intuition,theory,practice,deeper,reference', purposes().join());
    check('the count is the whole lecture, placed or not', root().findText('sd-mat-count', '9 of 9') !== null);
    check('the facts line says how the list is built',
      root().allText().includes('9 materials for 3 stages · 3 from your course · grouped by what they are for, then type, best first'));
    const row = (title) => root().find('sd-mrow').find((node) => node.allText().includes(title));
    const tags = (title) => row(title).find('sd-tag').map((node) => node.allText());
    check('Best fit marks the strict leader of a group, and a tie at the top gets none',
      tags('Fixture exercise sheet 4').includes('Best fit') && !tags('Fixture Bayes explainer').includes('Best fit')
      && !tags('Fixture lecture deck').includes('Best fit') && root().find('sd-tag').filter((node) => node.allText() === 'Best fit').length === 1);
    check('what the plan asks you to practise is Practice, whatever its source is for',
      root().find('sd-purpose').find((node) => node.getAttribute('data-purpose') === 'practice').allText().includes('Fixture exercise B3'));
    check('the course’s own files carry the Course mark',
      ['Fixture lecture deck', 'Fixture exercise sheet 4', 'Older fixture deck'].every((title) => tags(title).includes('Course'))
      && !tags('ISLP fixture intuition').includes('Course'));
    check('a route no stage uses is still here, in its purpose',
      row('Fixture deep-dive video') !== undefined
      && root().find('sd-purpose').find((node) => node.getAttribute('data-purpose') === 'deeper').allText().includes('Fixture deep-dive video'));
    check('each row says where it is used, in words for a screen reader',
      row('Fixture exercise sheet 4').find('sd-dots')[0].getAttribute('aria-label') === 'Required in stages 2–3');
    check('the meta line reads type, origin, pages and where, without the file path',
      row('Fixture lecture deck').find('sd-mrow-meta')[0].allText() === 'Slides · M2F · VL 04 · On this Mac',
      row('Fixture lecture deck').find('sd-mrow-meta')[0].allText());
    check('the side column indexes every group with its count',
      root().find('sd-index-item').length === 6 && root().findText('sd-index-item', 'Practice').allText().includes('2'));
    check('the lecture’s full plan controls stay one tab away', root().findText('los-filter-tab', 'Stages') !== null);

    row('Fixture lecture deck').find('sd-mrow-open')[0].fire('click');
    check('the whole row opens the material by the existing path', opened.length === 1 && opened[0].id === 'route-fx-deck');

    row('Fixture exercise sheet 4').find('sd-mrow-expand')[0].fire('click');
    await waitFor(() => root().find('sd-mrow-details').length === 1);
    const details = root().find('sd-mrow-details')[0];
    check('the chevron opens the details in place: rationale, pages, source, stages',
      details.allText().includes('Fixture exercise sheet 4: the full rationale.') && details.allText().includes('exercises/blatt-04.pdf')
      && details.allText().includes('SaD — fixture lecture slides (SoSe 2099)') && details.allText().includes('Required in stages 2–3'));
    check('the opened row offers the existing actions and no Rate without a stage',
      ['Open', 'Inspect the pages', 'Show in Library', 'Choose for this lecture'].every((label) => details.findText('los-btn', label) !== null)
      && !details.allText().includes('Rate'));
    const before = calls.envelopes.length;
    details.findText('los-btn', 'Choose for this lecture').fire('click');
    await waitFor(() => calls.envelopes.length > before);
    const choice = calls.envelope('unit.source-selection.set');
    check('Choose for this lecture is the same guarded source selection',
      Boolean(choice) && JSON.stringify(choice).includes('route-fx-sheet'));

    const stageChip = root().find('sd-chip-select-input').find((node) => node.getAttribute('aria-label') === 'Stage');
    stageChip.value = '2'; stageChip.fire('change');
    await waitFor(() => !root().find('sd-mat-note')[0].classes.has('is-empty'));
    check('a stage filter shows that stage’s materials and says so',
      root().findText('sd-mat-count', '3 of 9') !== null
      && root().find('sd-mat-note')[0].allText().includes('Showing what stage 3 uses: 1 required, 1 that help, 1 kept for reference.'));
    row('ISLP fixture intuition').find('sd-mrow-expand')[0].fire('click');
    await waitFor(() => root().find('sd-mrow-details').some((node) => node.allText().includes('ISLP fixture intuition: the full rationale.')));
    check('against one stage, the opened row can rate that placement',
      root().find('sd-mrow-details').some((node) => node.find('los-overflow').length > 0 || node.allText().includes('Rate')));
    root().find('sd-mat-note')[0].findText('los-btn', 'Show all 9').fire('click');
    await waitFor(() => root().findText('sd-mat-count', '9 of 9') !== null);
    check('the note’s link clears the stage filter', root().findText('sd-mat-count', '9 of 9') !== null);

    const input = root().find('sd-mat-search-input')[0];
    input.value = 'older'; input.fire('input');
    await waitFor(() => root().findText('sd-mat-count', '1 of 9') !== null);
    const practice = root().find('sd-purpose').find((node) => node.getAttribute('data-purpose') === 'practice');
    check('a search narrows each group and folds the ones without a match, counted',
      root().findText('sd-mat-count', '1 of 9') !== null && practice.allText().includes('No match for “older”. Open the group to see all of them.')
      && practice.find('sd-mrow').length === 0);
    practice.find('sd-purpose-head')[0].fire('click');
    await waitFor(() => root().find('sd-purpose').find((node) => node.getAttribute('data-purpose') === 'practice').find('sd-mrow').length === 2);
    check('opening a group without a match shows all of it',
      root().find('sd-purpose').find((node) => node.getAttribute('data-purpose') === 'practice').find('sd-mrow').length === 2);
    check('nothing on the page writes to Core but the chosen action', calls.envelopes.length === before + 1);
    plugin.onunload();
  }

  heading('Study Desk materials: one stage’s list, in the session and on the plan (D1)');
  {
    // Stage 2 also gets help of a second purpose, so the session has purpose tabs.
    const twoPurposes = (manifest) => {
      richLecture(manifest);
      const studyMap = manifest.study_maps.find((row) => row.unit_id === 'unit-fixture-sad-l04');
      studyMap.stages.find((row) => row.id === 'stage-fixture-conditioning').resources.push({
        route_id: 'route-fx-unplaced', source_id: 'source-fixture-video', label: 'Fixture deep-dive video', kind: 'watch',
        scope_triage: 'helpful-now', locator: 'Lecture 9', angle: 'Fixture deep-dive video: why here.',
      });
    };
    const { app, plugin, calls } = await boot({ patchManifest: twoPurposes });
    await plugin.setInterfaceDesign('study-desk');
    await plugin.nav.openUnit('unit-fixture-sad-l04');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    const root = () => view.contentEl;
    const folds = root().find('sd-stop-materials');
    const parts = (node) => node.find('sd-stage-part').map((part) => part.allText()).join(', ');
    check('each stage on the plan counts its materials once, triage first',
      folds[1].find('sd-stop-summary')[0].allText() === 'Materials for this stage · 7'
      && parts(folds[1]) === 'Required · 4, Helps · 2'
      && folds[1].find('sd-kept-copy')[0].allText() === 'Kept for reference · 1 — Fixture exercise B3', parts(folds[1]));
    check('a stage’s list uses the one Material row, two lines and no stage dots',
      folds.every((node) => node.find('sd-mrow').length > 0 && node.find('sd-dots').length === 0 && node.find('sd-material-row').length === 0));
    const before = calls.envelopes.length;

    root().findText('los-btn', 'Continue stage').fire('click');
    await waitFor(() => root().find('sd-book-spread').length === 1);
    root().find('sd-strip-tab')[1].fire('click');
    await waitFor(() => root().find('sd-page-left')[0]?.allText().includes('If you get stuck'));
    const left = () => root().find('sd-page-left')[0];
    // The rows a learner sees open: everything but the folded kept-for-reference line.
    const titles = () => {
      const kept = new Set(left().find('sd-kept').flatMap((fold) => fold.find('sd-mrow-title')));
      return left().find('sd-mrow-title').filter((node) => !kept.has(node)).map((node) => node.allText());
    };
    check('the session puts what the stage requires first, then what helps',
      left().allText().includes('Also required') && left().allText().includes('3 more this stage asks for')
      && left().allText().includes('2 that help, by what they are for'));
    const tabs = () => left().find('los-filter-tab').map((node) => `${node.allText()}${node.classes.has('is-active') ? '*' : ''}`);
    check('If you get stuck is split by what each material is for, in study order',
      tabs().join() === 'Intuition · 1*,Going deeper · 1', tabs().join());
    check('the first purpose shows its materials and hides the others',
      titles().includes('ISLP fixture intuition') && !titles().includes('Fixture deep-dive video'));
    left().findText('los-filter-tab', 'Going deeper · 1').fire('click');
    await waitFor(() => tabs().join() === 'Intuition · 1,Going deeper · 1*');
    check('another tab shows its own materials, and the choice holds',
      titles().includes('Fixture deep-dive video') && !titles().includes('ISLP fixture intuition'));
    check('what the stage keeps for reference waits in one folded line',
      left().find('sd-kept-copy')[0].allText() === 'Kept for reference · 1 — Fixture exercise B3');
    check('session rows are compact: no stage dots', left().find('sd-dots').length === 0);
    const deep = left().find('sd-mrow').find((node) => node.allText().includes('Fixture deep-dive video'));
    deep.find('sd-mrow-expand')[0].fire('click');
    await waitFor(() => left().find('sd-mrow-details').length === 1);
    const details = left().find('sd-mrow-details')[0];
    check('an opened row in the session can rate this stage’s placement, and keeps its why',
      (details.find('los-overflow').length > 0 || details.allText().includes('Rate'))
      && details.allText().includes('Fixture deep-dive video: why here.') && details.allText().includes('Fixture deep-dive video: the full rationale.'),
      details.allText().slice(0, 240));
    check('browsing a stage writes nothing to Core', calls.envelopes.length === before);
    plugin.onunload();
  }
};

module.exports.richLecture = richLecture;
