/** Presentation groups only: every authored format remains on its route. */
export interface MaterialTypeGroup {
  readonly key: string;
  readonly label: string;
  readonly icon: string;
  readonly formats: readonly string[];
}

const TYPES: readonly MaterialTypeGroup[] = [
  { key: 'course', label: 'Course materials', icon: 'presentation', formats: ['course-material', 'course', 'slides', 'lecture', 'deck'] },
  { key: 'book', label: 'Books', icon: 'book-open', formats: ['book', 'textbook'] },
  { key: 'video', label: 'Videos', icon: 'play', formats: ['video'] },
  { key: 'article', label: 'Articles', icon: 'file-text', formats: ['article'] },
  { key: 'paper', label: 'Papers', icon: 'newspaper', formats: ['paper'] },
  { key: 'exercise', label: 'Exercises', icon: 'pencil-line', formats: ['exercise', 'practice', 'practise', 'problem-set', 'homework', 'quiz'] },
  { key: 'solutions', label: 'Solutions', icon: 'clipboard-check', formats: ['solutions'] },
  { key: 'exam', label: 'Past exams', icon: 'graduation-cap', formats: ['exam'] },
  { key: 'code', label: 'Code & notebooks', icon: 'code', formats: ['code', 'notebook'] },
  { key: 'website', label: 'Websites', icon: 'globe', formats: ['website', 'web', 'web-page', 'webpage'] },
  { key: 'documentation', label: 'Documentation', icon: 'file-text', formats: ['documentation', 'docs'] },
  { key: 'other', label: 'Other materials', icon: 'file-text', formats: [] },
];

export function materialTypeLabel(format: string): string {
  const value = format.trim().toLowerCase();
  return TYPES.find((type) => type.formats.includes(value))?.label ?? 'Other materials';
}

export function groupMaterialsByType<T>(rows: readonly T[], formatOf: (row: T) => string): Array<MaterialTypeGroup & { entries: T[] }> {
  const groups = TYPES.map((type) => ({ ...type, entries: [] as T[] }));
  for (const row of rows) {
    const format = formatOf(row).trim().toLowerCase();
    const group = groups.find((type) => type.formats.includes(format)) ?? groups[groups.length - 1]!;
    group.entries.push(row);
  }
  return groups.filter((group) => group.entries.length > 0);
}
