/* Real input journeys on the synthetic app, with a leaf-scoped DOM adapter. */
'use strict';
const { boot, VIEW, waitFor, check, heading } = require('./support');

const { browserDom } = require('./browser-dom');

const viewOf = (app, type) => app.workspace.getLeavesOfType(type)[0]?.view;
module.exports = async function run() {
  heading('redraw focus: continuous typing, selection and independent leaves');
  const { app, plugin, calls } = await boot();
  await plugin.nav.openAbilities();
  await waitFor(() => viewOf(app, VIEW.abilities)?.contentEl.find('los-ability-search').length > 0
    && !viewOf(app, VIEW.abilities).contentEl.find('los-ability-search')[0].disabled);
  const view = viewOf(app, VIEW.abilities);
  const root = browserDom(view.contentEl);
  const input = () => root.find('los-ability-search')[0];
  root.scrollTop = 137; root.scrollLeft = 11;
  input().focus();
  for (const char of 'conditional') input().typeText(char);
  check('Atlas search accepts uninterrupted typing through result redraws',
    input().value === 'conditional' && global.document.activeElement === input()
    && input().selectionStart === 11 && input().selectionEnd === 11
    && root.find('los-ability-search-hit').length > 0);
  input().setSelectionRange(0, 4, 'forward');
  input().typeText('C');
  check('replacing a selection retains its new caret rather than jumping to the end',
    input().value === 'Citional' && input().selectionStart === 1 && input().selectionEnd === 1
    && global.document.activeElement === input());
  input().setSelectionRange(1, 1); input().typeText('ond');
  check('mid-string editing retains focus and the exact insertion point',
    input().value === 'Conditional' && input().selectionStart === 4
    && root.scrollTop === 137 && root.scrollLeft === 11);
  input().setSelectionRange(2, 7, 'backward'); view.render();
  check('a refresh preserves the selected range and direction',
    input().selectionStart === 2 && input().selectionEnd === 7
    && input().selectionDirection === 'backward');
  const another = global.document.body.createEl('input');
  another.focus(); view.render();
  check('Atlas refresh never steals focus from a different leaf', global.document.activeElement === another);
  // Real projection reloads redraw every leaf, including another Concept
  // pane whose search has the same class but an independent query/caret.
  await plugin.nav.openAtlas({ lens: 'prerequisites' });
  const conceptA = app.workspace.getLeavesOfType(VIEW.atlas)[0];
  const conceptB = app.workspace.getLeaf(true);
  await conceptB.setViewState({ type: VIEW.atlas, state: { lens: 'prerequisites' } });
  const conceptRootA = browserDom(conceptA.view.contentEl);
  const conceptRootB = browserDom(conceptB.view.contentEl);
  const conceptInputA = () => conceptRootA.find('los-atlas-search-input')[0];
  const conceptInputB = () => conceptRootB.find('los-atlas-search-input')[0];
  conceptInputA().value = 'conditional'; conceptInputA().fire('input');
  conceptInputB().value = 'bayes'; conceptInputB().fire('input');
  // Emptying a scrollable pane can clamp its native scroll position while
  // its contents are replaced. The adapter makes that browser effect visible.
  for (const conceptRoot of [conceptRootA, conceptRootB]) {
    const empty = conceptRoot.empty;
    conceptRoot.empty = function() {
      empty.call(this); this.scrollTop = 0; this.scrollLeft = 0; return this;
    };
  }
  app.workspace.setActiveLeaf(conceptA);
  conceptInputA().focus(); conceptInputA().setSelectionRange(2, 9, 'backward');
  conceptRootA.scrollTop = 257; conceptRootA.scrollLeft = 19;
  const focusedA = conceptInputA();
  conceptB.view.render();
  check('refreshing another Concept pane never takes the focused pane’s field',
    global.document.activeElement === focusedA && conceptInputA() === focusedA
    && focusedA.selectionStart === 2 && focusedA.selectionEnd === 9
    && focusedA.selectionDirection === 'backward');
  await plugin.reloadStore();
  check('refreshing both Concept leaves retains focus, backward selection and scroll in the first leaf',
    conceptInputA() !== focusedA && global.document.activeElement === conceptInputA()
    && conceptInputA().value === 'conditional' && conceptInputA().selectionStart === 2
    && conceptInputA().selectionEnd === 9 && conceptInputA().selectionDirection === 'backward'
    && conceptRootA.scrollTop === 257 && conceptRootA.scrollLeft === 19);
  app.workspace.setActiveLeaf(conceptB);
  conceptInputB().focus(); conceptInputB().setSelectionRange(0, 3, 'forward');
  conceptRootB.scrollTop = 441; conceptRootB.scrollLeft = 5;
  const focusedB = conceptInputB();
  conceptA.view.render();
  check('the other Concept pane is also protected when it is the focused second leaf',
    global.document.activeElement === focusedB && conceptInputB() === focusedB);
  await plugin.reloadStore();
  check('the second Concept leaf preserves its own selection and scroll during a full refresh',
    conceptInputB() !== focusedB && global.document.activeElement === conceptInputB()
    && conceptInputB().value === 'bayes' && conceptInputB().selectionStart === 0
    && conceptInputB().selectionEnd === 3 && conceptInputB().selectionDirection === 'forward'
    && conceptRootB.scrollTop === 441 && conceptRootB.scrollLeft === 5);
  check('independent Concept queries survive both refresh orders without Gateway writes',
    conceptA.view.query === 'conditional' && conceptB.view.query === 'bayes'
    && conceptInputA().value === 'conditional' && conceptInputB().value === 'bayes'
    && calls.envelopes.length === 0);
  another.focus();
  await plugin.nav.openGarden();
  const garden = viewOf(app, VIEW.garden);
  const gardenRoot = browserDom(garden.contentEl);
  const tabs = () => gardenRoot.find('los-filter-tab');
  const chosen = tabs()[1]; const key = chosen.getAttribute('data-los-tab');
  chosen.focus(); chosen.fire('click');
  const replacement = tabs().find((tab) => tab.getAttribute('data-los-tab') === key);
  check('filter activation preserves focus on the corresponding new button',
    replacement !== chosen && replacement.getAttribute('aria-pressed') === 'true'
    && global.document.activeElement === replacement);
  let prevented = false;
  replacement.parentElement.fire('keydown', {
    key: 'ArrowRight', target: replacement, preventDefault() { prevented = true; },
  });
  const next = global.document.activeElement;
  check('arrow navigation moves focus without selecting or writing',
    prevented && next !== replacement && next.getAttribute('aria-pressed') === 'false'
    && calls.envelopes.length === 0);
  next.fire('click');
  check('native activation after arrow navigation selects and retains focus',
    global.document.activeElement.getAttribute('aria-pressed') === 'true'
    && calls.envelopes.length === 0);
  another.focus();
};
