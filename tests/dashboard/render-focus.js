/* Real input journeys on the synthetic app, with a leaf-scoped DOM adapter. */
'use strict';
const { boot, VIEW, waitFor, check, heading } = require('./support');

// Only this suite needs native selector/focus behaviour; the shared stub stays small.
function browserDom(root) {
  function wire(node, parent = null) {
    node.parentElement = parent;
    node.ownerDocument = global.document;
    Object.defineProperties(node, {
      tagName: { configurable: true, get: () => node.tag.toUpperCase() },
      className: { configurable: true, get: () => [...node.classes].join(' ') },
      textContent: { configurable: true, get: () => node.allText() },
      isConnected: { configurable: true, get: () => root.contains(node) },
    });
    node.matches = (selector) => selector.split(',').some((part) => {
      part = part.trim();
      if (part === '[role="group"]') return node.getAttribute('role') === 'group';
      if (part === 'button') return node.tag === 'button';
      if (part === 'input[type="search"]') return node.tag === 'input' && node.getAttribute('type') === 'search';
      const match = part.match(/^(input|textarea)\.([a-z-]+)$/);
      return Boolean(match && node.tag === match[1] && node.classes.has(match[2]));
    });
    node.closest = (selector) => node.matches(selector) ? node : node.parentElement?.closest(selector) ?? null;
    node.querySelectorAll = (selector) => node.children.flatMap((child) => [
      ...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector),
    ]);
    const spawn = node._spawn;
    node._spawn = function(tag, opts) { return wire(spawn.call(this, tag, opts), this); };
    for (const child of node.children) wire(child, node);
    return node;
  }
  return wire(root);
}
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
