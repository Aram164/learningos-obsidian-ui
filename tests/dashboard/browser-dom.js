'use strict';

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

module.exports = { browserDom };
