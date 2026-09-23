import type { ManifestStore } from '../../manifest-store';
import { asString } from '../../projection/readers';
import { shortModuleLabel, type AbilityLabels } from './model';

/** Concept titles and module short labels, read from the projection only. */
export function projectionLabels(store: Pick<ManifestStore, 'get'>): AbilityLabels {
  return {
    concept: (id) => asString(store.get(id)?.title),
    module: (id) => {
      const record = store.get(id);
      return shortModuleLabel(
        asString(record?.title),
        asString(record?.code),
        id.replace(/^module-/, ''),
      );
    },
  };
}

/** "23 Sep" from the manifest's build stamp, when it carries a date. */
export function recordsDate(generatedAt: unknown): string | null {
  const match = typeof generatedAt === 'string'
    ? generatedAt.match(/^(\d{4})-(\d{2})-(\d{2})/)
    : null;
  if (!match) return null;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[Number(match[2]) - 1];
  return month ? `${Number(match[3])} ${month}` : null;
}

export function clockTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
