import fs from 'node:fs';
import path from 'node:path';

export function manifestLock(root) {
  const directory = path.join(root, 'contracts');
  const names = fs.readdirSync(directory)
    .filter((name) => /^manifest-v\d+\.lock\.json$/.test(name))
    .sort();
  if (names.length !== 1) {
    throw new Error(
      `Expected exactly one manifest contract lock, found ${names.length}: ${names.join(', ') || 'none'}.`,
    );
  }
  const relative = path.posix.join('contracts', names[0]);
  const absolute = path.join(root, relative);
  return {
    absolute,
    relative,
    text: fs.readFileSync(absolute, 'utf8'),
    value: JSON.parse(fs.readFileSync(absolute, 'utf8')),
  };
}

export function namedLock(root, name) {
  const relative = path.posix.join('contracts', name);
  const absolute = path.join(root, relative);
  return {
    absolute,
    relative,
    text: fs.readFileSync(absolute, 'utf8'),
    value: JSON.parse(fs.readFileSync(absolute, 'utf8')),
  };
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]),
    );
  }
  return value;
}

/** Read the producer contract's deliberately simple YAML string lists. */
export function yamlStringList(text, key) {
  const lines = text.split('\n');
  const start = lines.indexOf(`${key}:`);
  if (start === -1) return null;
  const out = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    const item = line.match(/^\s*-\s+(.*)$/);
    if (item) { out.push(item[1].trim()); continue; }
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    break;
  }
  return out;
}
