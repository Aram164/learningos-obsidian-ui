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
