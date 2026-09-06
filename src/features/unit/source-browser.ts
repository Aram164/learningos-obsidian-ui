/** Group without deduplicating routes or stage occurrences. */
export function groupBySource<T extends { readonly sourceId: string | null }>(entries: readonly T[]): Map<string | null, T[]> {
  const groups = new Map<string | null, T[]>();
  for (const entry of entries) {
    const group = groups.get(entry.sourceId) ?? [];
    group.push(entry); groups.set(entry.sourceId, group);
  }
  return groups;
}
/**
 * Group headings over the material cards.
 *
 * `open` starts the groups expanded. A learner who has already narrowed the
 * list — by searching, by filtering to a purpose, or because this unit draws
 * on a single source — has said what they want; making them click every
 * heading again to see it is a toll, not a disclosure.
 */
export function renderSourceGroups<T extends { readonly sourceId: string | null }>(
  root: HTMLElement, entries: readonly T[], sourceTitle: (id: string | null) => string,
  renderEntry: (parent: HTMLElement, entry: T) => void, open = false,
): void {
  for (const [id, group] of groupBySource(entries)) {
    const details = root.createEl('details', { cls: 'los-disclosure los-source-group' });
    if (open) details.setAttr('open', '');
    details.createEl('summary', { text: `${sourceTitle(id)} · ${group.length} ${group.length === 1 ? 'entry' : 'entries'}` });
    const body = details.createDiv({ cls: 'los-disclosure-body' });
    for (const entry of group) renderEntry(body, entry);
  }
}
