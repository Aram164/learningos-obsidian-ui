/** Persisted application navigation contract, independent of Obsidian leaves. */
export type LibraryCollectionV1 = "sources" | "topic-packs";

export interface LibrarySourceFiltersV1 {
  domain: string;
  topic: string;
  purpose: string;
  form: string;
  use: string;
}

export type ProjectDetailTabV1 =
  | "overview"
  | "structure"
  | "linked-materials"
  | "files"
  | "decisions";

export type ApplicationRouteV1 =
  | { name: "home" }
  | { name: "learn"; programId: string }
  | { name: "capture" }
  | { name: "review" }
  | { name: "garden" }
  | { name: "diagnostics" }
  | { name: "program"; programId: string }
  | { name: "module-groups" }
  | { name: "project-list"; query?: string }
  | { name: "project-detail"; projectId: string; tab?: ProjectDetailTabV1 }
  | { name: "module-list"; groupId: string; query?: string }
  | { name: "module-detail"; moduleId: string; componentId?: string | null; tab?: string | null }
  | { name: "unit"; unitId: string; stageId?: string | null }
  | {
      name: "library-home";
      collection: LibraryCollectionV1;
      query?: string;
      filters?: LibrarySourceFiltersV1;
    }
  | {
      name: "library-group";
      collection: LibraryCollectionV1;
      groupId: string;
      query?: string;
      facet?: string;
      filters?: LibrarySourceFiltersV1;
    }
  | {
      name: "source-detail";
      resourceId: string;
      fromGroupId?: string | null;
      query?: string;
      facet?: string;
      filters?: LibrarySourceFiltersV1;
    }
  | { name: "topic-pack-detail"; topicPackId: string; fromGroupId?: string | null; query?: string }
  | { name: "catalogue-detail"; catalogueId: string }
  | { name: "legacy-library-list"; recordType: string; query?: string; domain?: string }
  | {
      name: "library";
      recordId?: string | null;
      recordType?: string | null;
      query?: string;
      facet?: string;
      domain?: string;
    }
  | { name: "atlas"; domain?: string | null; concept?: string | null }
  | { name: "shelving"; unitId?: string | null }
  | { name: "boundary"; boundaryId: string };

export interface NavigationEntryV1 {
  route: ApplicationRouteV1;
  scrollTop: number;
  selectedElementId?: string | undefined;
}

export interface GlobalSearchOverlayV1 {
  kind: "global-search";
  query: string;
  filter: "all" | "learning" | "sources" | "projects";
}

export type OverlayStateV1 =
  | GlobalSearchOverlayV1
  | { kind: "linked-material-reason"; relationshipId: string }
  // The stage material-comparison drawer. Registered so Escape and Back
  // restore the route the learner was on, rather than dropping them
  // somewhere the drawer never came from.
  | { kind: "material-comparison"; unitId: string; stageId: string }
  | null;

export interface NavigationStateV1 {
  version: 1;
  current: ApplicationRouteV1;
  history: NavigationEntryV1[];
}

/*
 * Narrowing boundary.
 *
 * Persisted Obsidian state and product call sites hand over loose values
 * (`unknown`, plain `string`). Routes are strict. These functions are the only
 * sanctioned crossing: loose in, contract-valid out, never a cast at the call
 * site.
 */

const LIBRARY_COLLECTIONS: readonly LibraryCollectionV1[] = [
  "sources",
  "topic-packs",
];

const PROJECT_DETAIL_TABS: readonly ProjectDetailTabV1[] = [
  "overview",
  "structure",
  "linked-materials",
  "files",
  "decisions",
];

export function isLibraryCollection(value: unknown): value is LibraryCollectionV1 {
  return LIBRARY_COLLECTIONS.includes(value as LibraryCollectionV1);
}

export function isProjectDetailTab(value: unknown): value is ProjectDetailTabV1 {
  return PROJECT_DETAIL_TABS.includes(value as ProjectDetailTabV1);
}

export function asLibrarySourceFilters(
  value: unknown,
): LibrarySourceFiltersV1 {
  const record: Record<string, unknown> =
    typeof value === "object"
      && value !== null
      && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};

  const read = (key: keyof LibrarySourceFiltersV1): string =>
    typeof record[key] === "string"
      ? record[key] as string
      : "";

  return {
    domain: read("domain"),
    topic: read("topic"),
    purpose: read("purpose"),
    form: read("form"),
    use: read("use"),
  };
}

/** Coerce a loose collection value; anything unrecognised falls back to sources. */
export function asLibraryCollection(value: unknown): LibraryCollectionV1 {
  return isLibraryCollection(value) ? value : "sources";
}

/** Coerce a loose project tab value; anything unrecognised falls back to overview. */
export function asProjectDetailTab(value: unknown): ProjectDetailTabV1 {
  return isProjectDetailTab(value) ? value : "overview";
}
