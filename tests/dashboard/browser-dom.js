'use strict';

function matchSimpleSelector(node, simple) {
  let rest = simple.trim();
  if (!rest) return false;
  const tagMatch = rest.match(/^([A-Za-z][A-Za-z0-9-]*)/);
  if (tagMatch) {
    if (node.tag !== tagMatch[1].toLowerCase()) return false;
    rest = rest.slice(tagMatch[0].length);
  }
  while (rest.length > 0) {
    if (rest.startsWith('#')) {
      const m = rest.match(/^#([A-Za-z0-9_-]+)/);
      if (!m || node.getAttribute('id') !== m[1]) return false;
      rest = rest.slice(m[0].length);
    } else if (rest.startsWith('.')) {
      const m = rest.match(/^\.([A-Za-z0-9_-]+)/);
      if (!m || !node.classes.has(m[1])) return false;
      rest = rest.slice(m[0].length);
    } else if (rest.startsWith('[')) {
      const m = rest.match(/^\[([A-Za-z0-9_:-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/);
      if (!m) return false;
      const actual = node.getAttribute(m[1]);
      if (actual === null) return false;
      const expected = m[2] ?? m[3] ?? m[4];
      if (expected !== undefined && actual !== expected) return false;
      rest = rest.slice(m[0].length);
    } else {
      return false;
    }
  }
  return true;
}

// Native selectors and focus for targeted redraw fixtures; the shared stub stays small.
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
    node.matches = (selector) => selector.split(',').some((group) => {
      const parts = group.trim().split(/\s+/).filter(Boolean);
      if (parts.length === 0) return false;
      if (!matchSimpleSelector(node, parts[parts.length - 1])) return false;
      let cursor = node.parentElement;
      for (let i = parts.length - 2; i >= 0; i -= 1) {
        while (cursor && !matchSimpleSelector(cursor, parts[i])) {
          cursor = cursor.parentElement;
        }
        if (!cursor) return false;
        cursor = cursor.parentElement;
      }
      return true;
    });
    node.closest = (selector) => (node.matches(selector) ? node : node.parentElement?.closest(selector) ?? null);
    node.querySelectorAll = (selector) => node.children.flatMap((child) => [
      ...(child.matches(selector) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
    node.querySelector = (selector) => node.querySelectorAll(selector)[0] || null;
    const spawn = node._spawn;
    node._spawn = function (tag, opts) { return wire(spawn.call(this, tag, opts), this); };
    for (const child of node.children) wire(child, node);
    return node;
  }
  return wire(root);
}

module.exports = { browserDom };
