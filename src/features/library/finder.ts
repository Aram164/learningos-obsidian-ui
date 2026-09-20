import { foldCase } from '../../sorting';
import { badge, button, empty, icon } from '../../components';
import type { LibraryFinderHost } from './ports';
import {
  type FinderEntry,
  type FinderFolder,
  folderAt,
  trailFor,
} from './finder-tree';
import { enableButtonGroupKeyboardNavigation } from '../../accessibility/button-group';

/**
 * The Library's folder browser — a file manager over the projection.
 *
 * `finder-tree.ts` decides WHAT is in a folder. This module only draws it and
 * moves the selection. The layout is the one already in the learner's hands: a
 * sidebar of places, a path bar saying where you are, a list of what is here,
 * and an inspector for the one thing selected.
 *
 * Three choices are worth naming:
 *
 * - **Selection and navigation are separate.** One click selects and fills the
 *   inspector; opening takes a second click, Enter, or the right arrow. A tree
 *   this deep (domain → modules → module → bucket → source → directory → file)
 *   becomes unusable if every glance costs a navigation, and the inspector is
 *   where authors, roles and "also in two domains" actually fit.
 *
 * - **The filter is scoped to the folder you are in**, and says so in its own
 *   placeholder. A file manager whose search box quietly leaves the current
 *   folder is the most disorienting thing about the one everybody uses. The
 *   global search is one button away in the sidebar and is a different
 *   question.
 *
 * - **The root states its own coverage.** A folder tree makes one promise the
 *   faceted view never had to — that every source is somewhere — so the root
 *   says whether that is currently true instead of leaving it to be trusted.
 */

const LAYOUTS: ReadonlyArray<readonly ['list' | 'columns', string]> = [
  ['list', 'List'],
  ['columns', 'Columns'],
];

function itemCount(count: number | null): string {
  if (count === null) return '';
  return `${count} item${count === 1 ? '' : 's'}`;
}

function filterWords(query: string): string[] {
  return foldCase(query.trim()).split(/\s+/).filter(Boolean);
}

function matches(entry: FinderEntry, words: readonly string[]): boolean {
  if (!words.length) return true;
  const hay = foldCase(
    [entry.name, entry.detail, entry.kindLabel, entry.sourceId ?? '']
      .filter(Boolean)
      .join(' '),
  );
  return words.every((word) => hay.includes(word));
}

// -------------------------------------------------------------------- sidebar

function renderPlace(
  parent: HTMLElement,
  options: {
    label: string;
    icon: string;
    active: boolean;
    onOpen: () => unknown;
  },
): void {
  const row = parent.createEl('button', {
    cls: `los-finder-place is-clickable${options.active ? ' is-active' : ''}`,
    attr: { type: 'button' },
  });
  if (options.active) row.setAttribute('aria-current', 'true');
  icon(row.createSpan({ cls: 'los-finder-place-icon' }), options.icon);
  row.createSpan({ cls: 'los-finder-place-label', text: options.label });
  row.addEventListener('click', () => { void options.onOpen(); });
}

function renderSidebar(
  view: LibraryFinderHost,
  parent: HTMLElement,
  root: FinderFolder,
): void {
  const sidebar = parent.createDiv({
    cls: 'los-finder-sidebar',
    attr: { role: 'navigation', 'aria-label': 'Library places' },
  });

  const group = (title: string): HTMLElement => {
    const wrap = sidebar.createDiv({ cls: 'los-finder-places' });
    wrap.createEl('h3', { cls: 'los-finder-places-title', text: title });
    return wrap.createDiv({ cls: 'los-finder-places-list' });
  };

  const favourites = group('Favourites');
  renderPlace(favourites, {
    label: 'Library',
    icon: 'library',
    active: view.folderPath.length === 0,
    onOpen: () => view.openFolder([]),
  });
  renderPlace(favourites, {
    label: 'All sources',
    icon: 'list',
    active: false,
    onOpen: () => view.plugin.nav.openLibraryHome('sources'),
  });
  renderPlace(favourites, {
    label: 'Full text / OCR',
    icon: 'search',
    active: false,
    onOpen: () => view.plugin.nav.openFullTextSearch(),
  });

  const sections: ReadonlyArray<readonly [string, FinderEntry[]]> = [
    ['Domains', root.entries.filter((entry) => entry.kind === 'domain')],
    ['Shelves', root.entries.filter((entry) => entry.kind === 'shelf')],
  ];

  for (const [title, entries] of sections) {
    if (!entries.length) continue;
    const list = group(title);
    for (const entry of entries) {
      renderPlace(list, {
        label: entry.name,
        icon: entry.icon,
        active: view.folderPath[0] === entry.segment,
        onOpen: () => view.openFolder([entry.segment]),
      });
    }
  }
}

// ------------------------------------------------------------ path bar & tools

function renderPathBar(
  view: LibraryFinderHost,
  parent: HTMLElement,
  trail: readonly FinderFolder[],
): void {
  const bar = parent.createDiv({
    cls: 'los-finder-pathbar',
    attr: { 'aria-label': 'Folder path' },
  });

  trail.forEach((folder, depth) => {
    if (depth > 0) {
      icon(bar.createSpan({ cls: 'los-finder-path-sep' }), 'chevron-right');
    }
    if (depth === trail.length - 1) {
      const here = bar.createSpan({
        cls: 'los-finder-path-here',
        text: folder.name,
      });
      here.setAttribute('aria-current', 'true');
      return;
    }
    const crumb = bar.createEl('button', {
      cls: 'los-finder-path-crumb is-clickable',
      text: folder.name,
      attr: { type: 'button' },
    });
    crumb.addEventListener('click', () => { void view.openFolder(folder.path); });
  });
}

function renderToolbar(
  view: LibraryFinderHost,
  parent: HTMLElement,
  folder: FinderFolder,
  shown: number,
): void {
  const toolbar = parent.createDiv({ cls: 'los-finder-toolbar' });

  const up = button(
    toolbar,
    'Enclosing folder',
    () => void view.openEnclosingFolder(),
    'quiet',
  );
  up.addClass('los-finder-up');
  up.setAttribute('aria-label', 'Go to the enclosing folder');
  if (!view.folderPath.length) up.disabled = true;

  const search = toolbar.createEl('input', {
    cls: 'los-search los-finder-filter',
    attr: {
      type: 'search',
      placeholder: `Filter ${folder.name}…`,
      'aria-label': `Filter the contents of ${folder.name}`,
    },
  });
  search.value = view.query;
  search.addEventListener('input', () => {
    void view.setFolderQuery(search.value);
  });

  const layouts = toolbar.createDiv({
    cls: 'los-finder-layouts',
    attr: { role: 'group', 'aria-label': 'Folder layout' },
  });
  enableButtonGroupKeyboardNavigation(layouts);
  for (const [id, label] of LAYOUTS) {
    const active = view.folderLayout === id;
    const control = button(
      layouts,
      label,
      () => void view.setFolderLayout(id),
      active ? 'cta' : 'quiet',
    );
    control.setAttribute('aria-pressed', String(active));
  }

  const total = folder.entries.length;
  toolbar.createSpan({
    cls: 'los-finder-count',
    text: shown === total ? itemCount(total) : `${shown} of ${total} items`,
  });
}

// ----------------------------------------------------------------- list layout

function renderRow(
  view: LibraryFinderHost,
  list: HTMLElement,
  entry: FinderEntry,
): HTMLButtonElement {
  const selected = view.folderSelection === entry.segment;
  const row = list.createEl('button', {
    cls: `los-finder-row is-clickable${selected ? ' is-selected' : ''}`,
    attr: {
      type: 'button',
      'data-segment': entry.segment,
      'aria-label': entry.isFolder
        ? `${entry.name}, folder`
        : `${entry.name}, ${entry.kindLabel}`,
    },
  });
  if (selected) row.setAttribute('aria-current', 'true');

  icon(row.createSpan({ cls: 'los-finder-row-icon' }), entry.icon);

  const name = row.createDiv({ cls: 'los-finder-row-name' });
  name.createSpan({ cls: 'los-finder-row-title', text: entry.name });
  if (entry.detail) {
    name.createSpan({ cls: 'los-finder-row-detail', text: entry.detail });
  }

  row.createSpan({ cls: 'los-finder-row-kind', text: entry.kindLabel });

  const trailing = row.createSpan({ cls: 'los-finder-row-trailing' });
  if (entry.alsoIn > 1) {
    badge(trailing, `in ${entry.alsoIn} domains`, 'info');
  }
  if (entry.isFolder) {
    trailing.createSpan({
      cls: 'los-finder-row-count',
      text: itemCount(entry.count),
    });
    icon(trailing.createSpan({ cls: 'los-finder-row-chevron' }), 'chevron-right');
  }

  // First click selects and fills the inspector; a click on the already
  // selected row opens it, which is how a list behaves when browsing is the
  // common case and opening is the committed one.
  row.addEventListener('click', () => {
    if (selected) void view.activateEntry(entry);
    else void view.selectFolderEntry(entry.segment);
  });
  row.addEventListener('dblclick', () => { void view.activateEntry(entry); });
  return row;
}

function renderList(
  view: LibraryFinderHost,
  parent: HTMLElement,
  entries: readonly FinderEntry[],
): void {
  const list = parent.createDiv({
    cls: 'los-finder-list',
    attr: { 'aria-label': 'Folder contents' },
  });

  const header = list.createDiv({
    cls: 'los-finder-list-header',
    attr: { 'aria-hidden': 'true' },
  });
  header.createSpan({ text: 'Name' });
  header.createSpan({ text: 'Kind' });
  header.createSpan({ text: 'Items' });

  const focusSelection = view.takeFolderFocus();
  for (const entry of entries) {
    const row = renderRow(view, list, entry);
    if (focusSelection && entry.segment === view.folderSelection) row.focus();
  }

  list.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const index = entries.findIndex(
      (entry) => entry.segment === view.folderSelection,
    );

    const move = (next: number): void => {
      const clamped = Math.max(0, Math.min(entries.length - 1, next));
      const target = entries[clamped];
      if (!target) return;
      event.preventDefault();
      void view.selectFolderEntry(target.segment);
    };

    if (event.key === 'ArrowDown') return move(index + 1);
    if (event.key === 'ArrowUp') return move(index < 0 ? 0 : index - 1);
    if (event.key === 'Home') return move(0);
    if (event.key === 'End') return move(entries.length - 1);

    if (event.key === 'ArrowLeft' || event.key === 'Backspace') {
      if (!view.folderPath.length) return;
      event.preventDefault();
      void view.openEnclosingFolder();
      return;
    }

    if (event.key === 'ArrowRight') {
      const current = index >= 0 ? entries[index] : undefined;
      if (!current) return;
      event.preventDefault();
      void view.activateEntry(current);
    }
  });
}

// -------------------------------------------------------------- column layout

function renderColumns(
  view: LibraryFinderHost,
  parent: HTMLElement,
  trail: readonly FinderFolder[],
  words: readonly string[],
): void {
  const columns = parent.createDiv({
    cls: 'los-finder-columns',
    attr: { 'aria-label': 'Folder columns' },
  });

  trail.forEach((folder, depth) => {
    const openedSegment = view.folderPath[depth] ?? null;
    const isCurrent = depth === trail.length - 1;
    // Only the column you are standing in is filtered; an ancestor column is
    // context, and hiding the branch you came through would strand you.
    const entries = isCurrent
      ? folder.entries.filter((entry) => matches(entry, words))
      : folder.entries;

    const column = columns.createDiv({
      cls: `los-finder-column${isCurrent ? ' is-current' : ''}`,
    });
    column.createDiv({ cls: 'los-finder-column-title', text: folder.name });

    if (!entries.length) {
      column.createDiv({
        cls: 'los-finder-column-empty',
        text: folder.missing ? 'Unavailable' : 'Empty',
      });
      return;
    }

    for (const entry of entries) {
      const opened = entry.segment === openedSegment;
      const selected = isCurrent && view.folderSelection === entry.segment;
      const row = column.createEl('button', {
        cls: 'los-finder-column-row is-clickable'
          + (opened ? ' is-open' : '')
          + (selected ? ' is-selected' : ''),
        attr: { type: 'button' },
      });
      if (opened || selected) row.setAttribute('aria-current', 'true');
      icon(row.createSpan({ cls: 'los-finder-row-icon' }), entry.icon);
      row.createSpan({ cls: 'los-finder-row-title', text: entry.name });
      if (entry.isFolder) {
        icon(row.createSpan({ cls: 'los-finder-row-chevron' }), 'chevron-right');
      }
      row.addEventListener('click', () => {
        if (entry.isFolder) void view.openFolder([...folder.path, entry.segment]);
        else void view.openFolder(folder.path, entry.segment);
      });
      row.addEventListener('dblclick', () => { void view.activateEntry(entry); });
    }
  });
}

// ------------------------------------------------------------------ inspector

function renderFolderInspector(
  panel: HTMLElement,
  folder: FinderFolder,
): void {
  icon(panel.createDiv({ cls: 'los-finder-inspector-icon' }), folder.icon);
  panel.createEl('h2', { text: folder.name });
  panel.createDiv({ cls: 'los-finder-inspector-kind', text: folder.kindLabel });
  if (folder.description) {
    panel.createEl('p', { cls: 'los-muted', text: folder.description });
  }
  panel.createEl('p', {
    cls: 'los-finder-inspector-hint',
    text: `${itemCount(folder.entries.length)} here. `
      + 'Select one to see what it is and how to open it.',
  });
}

function renderEntryInspector(
  view: LibraryFinderHost,
  panel: HTMLElement,
  entry: FinderEntry,
): void {
  icon(panel.createDiv({ cls: 'los-finder-inspector-icon' }), entry.icon);
  panel.createEl('h2', { text: entry.name });
  panel.createDiv({ cls: 'los-finder-inspector-kind', text: entry.kindLabel });

  const facts: Array<readonly [string, string]> = [];
  if (entry.detail) facts.push(['Details', entry.detail]);
  if (entry.isFolder && entry.count !== null) {
    facts.push(['Contains', itemCount(entry.count)]);
  }
  if (entry.materialPath) facts.push(['Where', entry.materialPath]);
  if (entry.url) facts.push(['Link', entry.url]);
  if (entry.sourceId) facts.push(['Registry id', entry.sourceId]);

  if (facts.length) {
    const list = panel.createEl('dl', { cls: 'los-finder-inspector-facts' });
    for (const [label, value] of facts) {
      list.createEl('dt', { text: label });
      list.createEl('dd', { text: value });
    }
  }

  if (entry.alsoIn > 1) {
    panel.createEl('p', {
      cls: 'los-finder-inspector-alias',
      text: `Filed in ${entry.alsoIn} domains. Those are the same record seen `
        + 'from each of them, not duplicates.',
    });
  }

  const actions = panel.createDiv({ cls: 'los-actions' });

  if (entry.isFolder) {
    button(actions, 'Open folder', () => void view.activateEntry(entry), 'cta');
  } else if (entry.materialPath || entry.url) {
    button(
      actions,
      entry.materialPath ? 'Open file' : 'Open online',
      () => void view.activateEntry(entry),
      'cta',
    );
  }

  if (entry.sourceId) {
    const sourceId = entry.sourceId;
    button(
      actions,
      'Source record',
      () => view.plugin.nav.openSourceDetail(sourceId),
      'info',
    );
  }

  if (entry.materialPath && entry.isFolder) {
    const materialPath = entry.materialPath;
    button(
      actions,
      'Reveal on disk',
      () => view.plugin.openMaterialPath(materialPath),
      'quiet',
    );
  }

  if (entry.url) {
    const url = entry.url;
    button(actions, 'Copy link', () => view.plugin.copyText(url), 'quiet');
  }
}

// ---------------------------------------------------------------------- shell

/**
 * The root's accounting line.
 *
 * Stated in the only terms that matter: how many sources exist, and how many
 * the folders can reach. When they differ, something has become unbrowsable
 * and the line says so rather than letting a smaller Library look complete.
 *
 * The count comes from `view.coverage()`, which caches per projection snapshot,
 * because answering it means walking every folder — cheap in map lookups, but
 * it touches the disk once per source with local material, and the root should
 * not pay that on every keystroke in the filter box.
 */
function renderCoverage(
  view: LibraryFinderHost,
  parent: HTMLElement,
): void {
  const { total, reached } = view.coverage();
  const line = parent.createDiv({ cls: 'los-finder-coverage' });

  if (reached >= total) {
    line.createSpan({
      text: `All ${total} sources are reachable in these folders.`,
    });
    return;
  }

  line.addClass('is-attention');
  line.createSpan({
    text: `${reached} of ${total} sources are reachable — `
      + `${total - reached} cannot be browsed from here.`,
  });
  button(line, 'Rebuild views', () => void view.plugin.generate(), 'quiet');
}

export function renderFinder(
  view: LibraryFinderHost,
  root: HTMLElement,
): void {
  const context = view.finderContext();
  const trail = trailFor(context, view.folderPath);
  const folder = trail[trail.length - 1] ?? folderAt(context, []);
  const words = filterWords(view.query);

  const shell = root.createDiv({ cls: 'los-finder' });
  renderSidebar(view, shell, trail[0] ?? folder);

  const main = shell.createDiv({ cls: 'los-finder-main' });
  renderPathBar(view, main, trail);

  const entries = folder.entries.filter((entry) => matches(entry, words));
  renderToolbar(view, main, folder, entries.length);

  if (folder.description && !words.length) {
    main.createEl('p', {
      cls: 'los-finder-folder-note',
      text: folder.description,
    });
  }

  const body = main.createDiv({ cls: 'los-finder-body' });

  if (folder.missing) {
    empty(
      body,
      'Folder unavailable',
      'This path is not in the current projection. It may have been renamed, '
      + 'or the views may need rebuilding.',
      'Back to Library',
      () => void view.openFolder([]),
    );
    return;
  }

  if (view.folderLayout === 'columns') {
    renderColumns(view, body, trail, words);
  } else if (!folder.entries.length) {
    empty(
      body,
      'Nothing filed here yet',
      // Only a DECLARED folder can be empty — a domain from the taxonomy, or a
      // module from the curriculum. Both exist whether or not anything has
      // been routed to them, so this is a documented absence rather than a
      // missing folder, and saying which one it is beats an unexplained blank.
      `${folder.kindLabel} folders exist whether or not material has been `
      + 'routed to them, so this is an absence on the record rather than '
      + 'something gone missing.',
    );
  } else if (!entries.length) {
    empty(
      body,
      'Nothing matches that filter',
      `No item in ${folder.name} matches “${view.query.trim()}”.`,
      'Clear filter',
      () => void view.setFolderQuery(''),
    );
  } else {
    renderList(view, body, entries);
  }

  const panel = body.createDiv({
    cls: 'los-finder-inspector',
    attr: { 'aria-label': 'Selected item' },
  });
  const selected = entries.find(
    (entry) => entry.segment === view.folderSelection,
  );
  if (selected) renderEntryInspector(view, panel, selected);
  else renderFolderInspector(panel, folder);

  if (!view.folderPath.length) renderCoverage(view, main);
}
