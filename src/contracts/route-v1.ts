/** Persisted application navigation contract, independent of Obsidian leaves. */
export type LibraryCollectionV1 = "sources" | "topic-packs";

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
  | { name: "project-detail"; projectId: string; tab?: "overview" | "structure" | "linked-materials" | "files" | "decisions" }
  | { name: "module-list"; groupId: string; query?: string }
  | { name: "module-detail"; moduleId: string; componentId?: string | null; tab?: string | null }
  | { name: "module"; moduleId: string; componentId?: string | null }
  | { name: "unit"; unitId: string; stageId?: string | null }
  | { name: "library-home"; collection: LibraryCollectionV1 }
  | { name: "library-group"; collection: LibraryCollectionV1; groupId: string; query?: string; facet?: string }
  | { name: "source-detail"; resourceId: string; fromGroupId?: string | null; query?: string; facet?: string }
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
  | { name: "atlas"; domain?: string | null }
  | { name: "shelving"; unitId?: string | null }
  | { name: "boundary"; boundaryId: string };

export interface NavigationEntryV1 {
  route: ApplicationRouteV1;
  scrollTop: number;
  selectedElementId?: string;
}

export interface GlobalSearchOverlayV1 {
  kind: "global-search";
  query: string;
  filter: "all" | "learning" | "sources" | "projects";
}

export type OverlayStateV1 = GlobalSearchOverlayV1 | { kind: "linked-material-reason"; relationshipId: string } | null;

export interface NavigationStateV1 {
  version: 1;
  current: ApplicationRouteV1;
  history: NavigationEntryV1[];
}
