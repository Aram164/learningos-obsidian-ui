/*
 * Local schema-to-TypeScript emitter for the manifest contract (Phase 6, 6.C.1;
 * conductor decision C23).
 *
 * json-schema-to-typescript v16 cannot consume this schema graph (see the
 * generate-contract.mjs header), so the types are emitted here from the same
 * Core bundle the Ajv validator is generated from:
 *
 *   - Every $ref target (resource identity + JSON pointer) and every resource
 *     root gets one stable exported symbol before any body is emitted, so
 *     cross-resource cycles stay named references and a $ref with sibling
 *     keywords becomes an intersection.
 *   - Every keyword present in the closure is classified. Structural keywords
 *     shape the type; validation-only and annotation keywords stay Ajv's
 *     (patterns, bounds, formats, uniqueness, conditionals, exclusivity). An
 *     unknown keyword fails the build instead of being silently erased.
 *   - The UI's public names are aliases pinned to an exact resource and
 *     pointer (contract-type-aliases.json), never inferred from similar names.
 *
 * Ajv stays the runtime authority. These types only describe what a value
 * that passed Ajv looks like.
 */

const STRUCTURAL = new Set([
  '$ref', 'type', 'properties', 'required', 'additionalProperties', 'items',
  'enum', 'const', 'oneOf', 'anyOf', 'allOf',
]);
// Checked at runtime by Ajv; TypeScript cannot express them.
const VALIDATION_ONLY = new Set([
  'pattern', 'format', 'minLength', 'maxLength', 'minimum', 'maximum',
  'minItems', 'maxItems', 'uniqueItems', 'contains', 'minProperties',
  'maxProperties', 'propertyNames', 'unevaluatedProperties', 'not', 'if',
  'then', 'else',
]);
const ANNOTATION = new Set([
  '$schema', '$id', '$defs', 'title', 'description', 'default', 'x-governs',
]);

function pascal(text) {
  return String(text)
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
}

function resourceTag(path) {
  return pascal(path.replace(/\.schema\.json$/, '').replace(/-v\d+$/, ''));
}

function pointerParts(pointer) {
  if (pointer === '' || pointer === '/') return [];
  if (!pointer.startsWith('/')) throw new Error(`Unsupported JSON pointer ${pointer}.`);
  return pointer.slice(1).split('/').map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function at(schema, pointer) {
  let node = schema;
  for (const part of pointerParts(pointer)) {
    if (node === null || typeof node !== 'object' || !(part in node)) {
      throw new Error(`Unresolvable pointer ${pointer}.`);
    }
    node = node[part];
  }
  return node;
}

export function loadResources(bundle) {
  const byUri = new Map();
  const list = [];
  const rootPath = bundle.root_uri.split('/').pop();
  const root = { uri: bundle.root_uri, path: rootPath, schema: bundle.root };
  list.push(root);
  byUri.set(bundle.root_uri, root);
  for (const resource of bundle.resources) {
    const entry = { uri: resource.declared_id, path: resource.path, schema: resource.schema };
    list.push(entry);
    for (const alias of [resource.declared_id, ...(resource.aliases || [])]) byUri.set(alias, entry);
  }
  return { byUri, list };
}

export function emitTypes(bundle, aliases) {
  const { byUri, list } = loadResources(bundle);
  const keywordUse = new Map();
  const symbols = new Map(); // key `${path}#${pointer}` -> name
  const targets = [];

  function key(resource, pointer) { return `${resource.path}#${pointer}`; }
  function resolve(ref, resource) {
    const [base, fragment = ''] = ref.split('#');
    const target = base === '' ? resource : byUri.get(base);
    if (!target) throw new Error(`Unresolvable $ref ${ref}.`);
    return { resource: target, pointer: decodeURIComponent(fragment) };
  }
  function nameFor(resource, pointer) {
    const parts = pointerParts(pointer).filter((p) => p !== '$defs');
    if (parts.length === 0) return `${resourceTag(resource.path)}Schema`;
    return [resourceTag(resource.path), ...parts.map(pascal)].join('_');
  }
  function declare(resource, pointer) {
    const k = key(resource, pointer);
    if (symbols.has(k)) return symbols.get(k);
    const name = nameFor(resource, pointer);
    if ([...symbols.values()].includes(name)) throw new Error(`Symbol collision ${name} for ${k}.`);
    symbols.set(k, name);
    targets.push({ resource, pointer, name });
    return name;
  }

  // Pass 1: allocate a symbol for every resource root and every $ref target.
  function collect(node, resource) {
    if (Array.isArray(node)) { node.forEach((n) => collect(n, resource)); return; }
    if (node === null || typeof node !== 'object') return;
    if (typeof node.$ref === 'string') {
      const { resource: r, pointer } = resolve(node.$ref, resource);
      at(r.schema, pointer);
      declare(r, pointer);
    }
    for (const [k, v] of Object.entries(node)) {
      if (k === 'enum' || k === 'const' || k === 'default') continue;
      if (k === 'properties' && v && typeof v === 'object') {
        Object.values(v).forEach((n) => collect(n, resource));
      } else collect(v, resource);
    }
  }
  for (const resource of list) {
    declare(resource, '');
    collect(resource.schema, resource);
  }
  for (const [publicName, pin] of Object.entries(aliases)) {
    const resource = byUri.get(pin.resource);
    if (!resource) throw new Error(`Alias ${publicName}: unknown resource ${pin.resource}.`);
    at(resource.schema, pin.pointer);
    declare(resource, pin.pointer);
  }

  function literal(value) {
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      return JSON.stringify(value);
    }
    throw new Error(`Unsupported non-primitive literal ${JSON.stringify(value)}.`);
  }
  // Parenthesize only a top-level union or intersection (not one inside braces,
  // brackets, parentheses or string literals).
  function paren(text) {
    let depth = 0;
    let quote = null;
    for (let i = 0; i < text.length; i += 1) {
      const c = text[i];
      if (quote) {
        if (c === '\\') i += 1;
        else if (c === quote) quote = null;
      } else if (c === '"') quote = c;
      else if ('{[(<'.includes(c)) depth += 1;
      else if ('}])>'.includes(c)) depth -= 1;
      else if (depth === 0 && (c === '|' || c === '&')) return `(${text})`;
    }
    return text;
  }
  function propKey(name) { return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name); }

  function expr(node, resource, pointer, depth) {
    if (node === true) return 'unknown';
    if (node === false) return 'never';
    if (node === null || typeof node !== 'object') throw new Error(`Bad schema at ${pointer}.`);
    for (const k of Object.keys(node)) {
      keywordUse.set(k, (keywordUse.get(k) || 0) + 1);
      if (!STRUCTURAL.has(k) && !VALIDATION_ONLY.has(k) && !ANNOTATION.has(k)) {
        throw new Error(`Unclassified schema keyword ${k} at ${resource.path}#${pointer}.`);
      }
    }
    // A nested node that is itself a declared target is referenced by name.
    if (depth > 0 && symbols.has(key(resource, pointer))) return symbols.get(key(resource, pointer));
    const parts = [];
    if (typeof node.$ref === 'string') {
      const { resource: r, pointer: p } = resolve(node.$ref, resource);
      parts.push(symbols.get(key(r, p)));
    }
    if (Array.isArray(node.allOf)) {
      node.allOf.forEach((n, i) => parts.push(paren(expr(n, resource, `${pointer}/allOf/${i}`, depth + 1))));
    }
    const core = coreExpr(node, resource, pointer, depth);
    if (core) parts.push(core);
    if (parts.length === 0) return 'unknown';
    return parts.length === 1 ? parts[0] : parts.map(paren).join(' & ');
  }

  function coreExpr(node, resource, pointer, depth) {
    if ('const' in node) return literal(node.const);
    if (Array.isArray(node.enum)) return node.enum.map(literal).join(' | ');
    const alternatives = node.oneOf || node.anyOf;
    const altKey = node.oneOf ? 'oneOf' : 'anyOf';
    let union = null;
    if (Array.isArray(alternatives)) {
      union = alternatives
        .map((n, i) => paren(expr(n, resource, `${pointer}/${altKey}/${i}`, depth + 1)))
        .join(' | ');
    }
    const types = Array.isArray(node.type) ? node.type : node.type ? [node.type] : null;
    const implicitObject = !types && (node.properties || node.required || node.additionalProperties !== undefined);
    const implicitArray = !types && node.items !== undefined;
    const shapes = (types || (implicitObject ? ['object'] : implicitArray ? ['array'] : []))
      .map((t) => typeShape(t, node, resource, pointer, depth));
    const shape = shapes.length ? shapes.map(paren).join(' | ') : null;
    if (union && shape) return `${paren(union)} & ${paren(shape)}`;
    return union || shape;
  }

  function typeShape(type, node, resource, pointer, depth) {
    switch (type) {
      case 'string': return 'string';
      case 'number':
      case 'integer': return 'number';
      case 'boolean': return 'boolean';
      case 'null': return 'null';
      case 'array': {
        if (node.items === undefined) return 'readonly unknown[]';
        return `readonly ${paren(expr(node.items, resource, `${pointer}/items`, depth + 1))}[]`;
      }
      case 'object': return objectShape(node, resource, pointer, depth);
      default: throw new Error(`Unknown JSON type ${type} at ${pointer}.`);
    }
  }

  function objectShape(node, resource, pointer, depth) {
    const properties = node.properties || {};
    const required = new Set(node.required || []);
    const lines = [];
    for (const name of Object.keys(properties)) {
      const t = expr(properties[name], resource, `${pointer}/properties/${name.replace(/~/g, '~0').replace(/\//g, '~1')}`, depth + 1);
      lines.push(`${propKey(name)}${required.has(name) ? '' : '?'}: ${t};`);
    }
    for (const name of required) {
      if (!(name in properties)) lines.push(`${propKey(name)}: unknown;`);
    }
    const extra = node.additionalProperties;
    if (extra !== undefined && extra !== false && Object.keys(properties).length === 0) {
      const t = extra === true ? 'unknown' : expr(extra, resource, `${pointer}/additionalProperties`, depth + 1);
      return `{ readonly [key: string]: ${t} }`;
    }
    if (lines.length === 0) return extra === false ? 'Record<string, never>' : '{ readonly [key: string]: unknown }';
    const indent = '  '.repeat(depth + 1);
    return `{\n${lines.map((l) => `${indent}readonly ${l}`).join('\n')}\n${'  '.repeat(depth)}}`;
  }

  // Pass 2: emit every symbol body in a deterministic order.
  const ordered = [...targets].sort((a, b) => a.name.localeCompare(b.name));
  const body = ordered.map(({ resource, pointer, name }) => {
    const node = pointer ? at(resource.schema, pointer) : resource.schema;
    return `/** ${resource.path}#${pointer || '/'} */\nexport type ${name} = ${expr(node, resource, pointer, 0)};\n`;
  });
  const publicLines = Object.entries(aliases)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([publicName, pin]) => {
      const resource = byUri.get(pin.resource);
      return `export type ${publicName} = ${symbols.get(key(resource, pin.pointer))};`;
    });
  const used = [...keywordUse.keys()].sort();
  return {
    source: [
      '// GENERATED by scripts/generate-contract.mjs (emit-contract-types.mjs) from the Core',
      '// contract bundle - do not edit. Ajv (manifest.validator.cjs) is the runtime authority;',
      '// these types describe values that passed it.',
      '',
      ...body,
      '// The UI\'s public names, each pinned to one schema resource and pointer',
      '// (scripts/contract-type-aliases.json).',
      ...publicLines,
      '',
    ].join('\n'),
    symbols: ordered.map(({ resource, pointer, name }) => ({ name, resource: resource.path, pointer })),
    keywords: used,
  };
}
