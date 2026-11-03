import { button } from '../../components';
import { foldCase } from '../../sorting';
import type { AvailabilityKind } from './material-card';

/** UI-owned facets narrow a view, never the authored material inventory. */
export interface MaterialFilters {
  query: string;
  medium: string;
  action: string;
  access: string;
}
export interface MaterialFacet {
  readonly medium: string;
  readonly mediumLabel: string;
  readonly action: string;
  readonly actionLabel: string;
  readonly access: AvailabilityKind;
  readonly search: string;
}
export function emptyMaterialFilters(): MaterialFilters {
  return { query: '', medium: '', action: '', access: '' };
}
export function materialMatches(facet: MaterialFacet, filters: MaterialFilters): boolean {
  const query = foldCase(filters.query.trim());
  return (!query || foldCase(facet.search).includes(query))
    && (!filters.medium || facet.medium === filters.medium)
    && (!filters.action || facet.action === filters.action)
    && (!filters.access || facet.access === filters.access);
}
export function hasMaterialFilters(filters: MaterialFilters): boolean {
  return Boolean(filters.query.trim() || filters.medium || filters.action || filters.access);
}

const ACCESS: Readonly<Record<AvailabilityKind, string>> = {
  local: 'Local or in vault', remote: 'Remote', 'local-missing': 'Local copy missing', none: 'Location needed',
};

/** Controls stay in place during filtering, preserving the search caret and focus. */
export function renderMaterialFilters(
  parent: HTMLElement,
  facets: readonly MaterialFacet[],
  filters: MaterialFilters,
  changed: () => void,
  actionHeading = 'Learning action',
): { updateCount(visible: number, total: number): void } {
  const root = parent.createDiv({ cls: 'los-material-filters' });
  const fields = root.createDiv({ cls: 'los-material-filter-fields', attr: { role: 'group', 'aria-label': 'Filter materials' } });
  const label = fields.createEl('label', { cls: 'los-material-filter-field' });
  label.createSpan({ text: 'Find material' });
  const search = label.createEl('input', { attr: { type: 'search', 'aria-label': 'Find material', placeholder: 'Title, task or section' } });
  search.value = filters.query;
  search.addEventListener('input', () => { filters.query = search.value; updateReset(); changed(); });
  const selects: Array<{ control: HTMLSelectElement; key: 'medium' | 'action' | 'access' }> = [];
  const select = (title: string, key: 'medium' | 'action' | 'access', values: Array<readonly [string, string]>) => {
    const field = fields.createEl('label', { cls: 'los-material-filter-field' });
    field.createSpan({ text: title });
    const control = field.createEl('select', { attr: { 'aria-label': title } });
    control.createEl('option', { text: key === 'medium' ? 'All media' : key === 'access' ? 'All access' : 'All purposes / actions', attr: { value: '' } });
    for (const [value, text] of values) control.createEl('option', { text, attr: { value } });
    control.value = filters[key];
    control.addEventListener('change', () => { filters[key] = control.value; updateReset(); changed(); });
    selects.push({ control, key });
  };
  const unique = (values: Array<readonly [string, string]>) => [...new Map(values).entries()];
  select('Medium', 'medium', unique(facets.map(item => [item.medium, item.mediumLabel] as const)));
  if (facets.some(item => item.action)) select(actionHeading, 'action', unique(facets.map(item => [item.action, item.actionLabel] as const)));
  select('Access', 'access', unique(facets.map(item => [item.access, ACCESS[item.access]] as const)));
  const feedback = root.createDiv({ cls: 'los-material-filter-feedback' });
  const count = feedback.createSpan({ cls: 'los-micro', attr: { role: 'status', 'aria-live': 'polite' } });
  const reset = button(feedback, 'Clear filters', () => {
    Object.assign(filters, emptyMaterialFilters());
    search.value = '';
    for (const { control } of selects) control.value = '';
    updateReset(); changed();
  }, 'quiet');
  const updateReset = () => { reset.disabled = !hasMaterialFilters(filters); };
  updateReset();
  return { updateCount(visible, total) {
    count.setText(`${visible} of ${total} materials${hasMaterialFilters(filters) ? ' · Filters active. Clear to restore the full list.' : ' · Complete list. Authored order is preserved.'}`);
  } };
}
