/**
 * We use 'en' as a fixed locale for deterministic sorting and matching,
 * independent of the host operating system's locale. This ensures that the
 * exact same manifest produces the exact same ordering on any machine,
 * which is critical for CI and cross-device consistency.
 */
const collator = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'variant',
  caseFirst: 'lower',
});

/**
 * Compares two strings using a fixed deterministic collation.
 */
export function compareStrings(left: string, right: string): number {
  // Numeric collation can equate distinct IDs such as item-02 and item-2.
  // Break those ties by code units so existing ID fallbacks remain total.
  return collator.compare(left, right) || (left < right ? -1 : left > right ? 1 : 0);
}

/**
 * Case-folds a string using a fixed locale for matching purposes.
 */
export function foldCase(value: string): string {
  return value.toLocaleLowerCase('en');
}

export function upperCase(value: string): string {
  return value.toLocaleUpperCase('en');
}
