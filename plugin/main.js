'use strict';
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  LearningOSUI: () => LearningOSUI,
  default: () => main_default
});
module.exports = __toCommonJS(main_exports);
var import_obsidian18 = require("obsidian");
var import_node_child_process = require("node:child_process");
var fs2 = __toESM(require("node:fs"));
var nodePath2 = __toESM(require("node:path"));
var import_node_process = __toESM(require("node:process"));
var import_electron2 = require("electron");

// src/app/global-search.ts
var import_obsidian2 = require("obsidian");

// src/components.ts
var import_obsidian = require("obsidian");
var import_electron = require("electron");

// src/constants.ts
var CONTRACT_VERSION = 2;
var VIEW_HOME = "learningos-home";
var VIEW_NAV = "learningos-nav";
var VIEW_PROGRAM = "learningos-program";
var VIEW_MODULE = "learningos-module";
var VIEW_PROJECT = "learningos-project";
var VIEW_UNIT = "learningos-unit";
var VIEW_LIBRARY = "learningos-library";
var VIEW_ATLAS = "learningos-atlas";
var VIEW_SHELVING = "learningos-shelving";
var VIEW_BOUNDARY = "learningos-boundary";
var VIEW_REVIEW = "learningos-review";
var VIEW_GARDEN = "learningos-garden";
var VIEW_DIAGNOSTICS = "learningos-diagnostics";
var LEARN_AREAS = [
  ["program-bachelors", "Bachelor\u2019s"],
  ["program-skills", "Skills"],
  ["program-thesis-projects", "Thesis & projects"]
];
var LEGACY_VIEW_TYPES = [
  "learningos-dashboard",
  "learningos-explorer",
  "learningos-learning-path",
  "learningos-shelve-review",
  "learningos-job-boundary"
];
var DEFAULT_SETTINGS = {
  openHomeOnStartup: true,
  pinHome: true,
  collapseSidebars: true,
  showAiRecommendation: true,
  navMoreOpen: false,
  learnArea: "program-bachelors",
  pythonPath: "",
  preferredAiProvider: "manual-bundle"
};
var SAFE_URL_PROTOCOLS = ["https:", "http:"];
var STATUS_ORDER = [
  "active",
  "ready",
  "not-started",
  "needs-map",
  "paused",
  "ready-to-shelve",
  "complete"
];
var ICONS = {
  program: "graduation-cap",
  module: "book-open",
  project: "briefcase-business",
  unit: "layers-3",
  "study-map": "route",
  stage: "list-checks",
  note: "file-text",
  concept: "network",
  source: "library",
  workspace: "briefcase-business",
  boundary: "shield",
  skills: "wrench",
  projects: "flask-conical",
  collection: "library-big",
  "topic-pack": "notebook-tabs",
  atlas: "map"
};

// src/components.ts
function icon(el, name) {
  (0, import_obsidian.setIcon)(el, name || "circle");
  return el;
}
function button(parent, label, onClick, variant = "") {
  const el = parent.createEl("button", {
    cls: `los-btn is-clickable ${variant ? `los-btn--${variant}` : ""}`,
    text: label,
    attr: { type: "button" }
  });
  el.addEventListener("click", (event) => {
    event.preventDefault();
    onClick?.(event);
  });
  return el;
}
function badge(parent, text, variant = "") {
  return parent.createSpan({ cls: `los-badge ${variant ? `los-badge--${variant}` : ""}`, text });
}
function chip(parent, record, onClick) {
  const el = parent.createEl("button", {
    cls: `los-chip los-t-${record?.type || "record"} is-clickable`,
    attr: { type: "button" }
  });
  const iconName = ICONS[String(record?.type || "")] || "circle";
  icon(el.createSpan({ cls: "los-chip-icon" }), iconName);
  el.createSpan({ text: record?.title || record?.id || "Unknown" });
  if (onClick) el.addEventListener("click", () => onClick(record));
  return el;
}
function pageHeader(parent, kicker, title, description = "") {
  const header = parent.createDiv({ cls: "los-page-header" });
  if (kicker) header.createDiv({ cls: "los-kicker", text: kicker });
  header.createEl("h1", { text: title });
  if (description) header.createEl("p", { text: description });
  return header;
}
function section(parent, title, description = "") {
  const wrap = parent.createDiv({ cls: "los-section" });
  wrap.createEl("h2", { text: title });
  if (description) wrap.createEl("p", { cls: "los-muted", text: description });
  return wrap;
}
function disclosure(parent, summaryText, cls = "") {
  const details = parent.createEl("details", { cls: `los-disclosure ${cls}`.trim() });
  details.createEl("summary", { text: summaryText });
  return details.createDiv({ cls: "los-disclosure-body" });
}
function overflowMenu(parent, items, label = "More actions") {
  const rows = items.filter(Boolean);
  if (!rows.length) return null;
  const details = parent.createEl("details", { cls: "los-overflow" });
  const summary = details.createEl("summary", { cls: "los-overflow-trigger", text: "\u2022\u2022\u2022" });
  summary.setAttrs({ "aria-label": label, role: "button" });
  const body = details.createDiv({ cls: "los-overflow-body" });
  for (const [itemLabel, action] of rows) {
    button(body, itemLabel, () => {
      details.removeAttribute?.("open");
      action();
    }, "menu");
  }
  return details;
}
function progressRow(parent, plugin, module2, nextUp = "") {
  const row = parent.createDiv({ cls: "los-learning-row" });
  const copy = row.createDiv({ cls: "los-learning-copy" });
  const title = button(copy, module2.title, () => plugin.openModule(module2.id), "row");
  title.addClass("los-learning-title");
  if (nextUp) copy.createDiv({ cls: "los-learning-next", text: nextUp });
  const progress = plugin.store.progress(module2.id);
  const meta = row.createDiv({ cls: "los-learning-meta" });
  meta.createSpan({
    cls: "los-micro",
    text: `${progress.stages_complete || 0} of ${progress.stages_total || 0} stages`
  });
  if (progress.units_needing_map) badge(meta, `${progress.units_needing_map} need a map`, "needs-map");
  return row;
}
function safeWebUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return SAFE_URL_PROTOCOLS.includes(url.protocol) ? url : null;
  } catch (_) {
    return null;
  }
}
function empty(parent, title, detail, actionLabel = "", action = null) {
  const el = parent.createDiv({ cls: "los-empty" });
  el.createEl("h3", { text: title });
  el.createEl("p", { text: detail });
  if (actionLabel) button(el, actionLabel, action, "quiet");
  return el;
}
function localFilePath(file) {
  if (!file) return "";
  try {
    return import_electron.webUtils.getPathForFile(file) || "";
  } catch (_) {
    return "";
  }
}
function projectedExcerpt(value, limit = 900) {
  const [paragraph = ""] = String(value || "").split(/\n\s*\n/);
  const first = paragraph.replace(/\*\*/g, "").replace(/`/g, "").replace(/(^|\n)\s*-\s*/g, "$1").replace(/\s+/g, " ").trim();
  if (first.length <= limit) return first;
  return `${Array.from(first).slice(0, limit - 1).join("")}\u2026`;
}
function boundaryPolicy(value) {
  const text = projectedExcerpt(value, 300);
  return /(^|[\s([<'"])Job\//.test(text) ? "" : text;
}
function workspaceCard(parent, plugin, workspace, moduleContext = null) {
  const card = parent.createDiv({ cls: `los-card los-workspace-card los-s-${workspace.status}` });
  const top = card.createDiv({ cls: "los-card-top" });
  top.createEl("h3", { text: workspace.title });
  badge(top, workspace.standing ? `${workspace.status} \xB7 standing` : workspace.status, workspace.status);
  if (workspace.objective) card.createEl("p", { cls: "los-workspace-objective", text: workspace.objective });
  const next = card.createDiv({ cls: "los-next-action" });
  next.createDiv({ cls: "los-kicker", text: "Next action" });
  next.createEl("p", { text: projectedExcerpt(workspace.next_action, 1600) || "No next action recorded." });
  if (workspace.deadline) badge(next, `Deadline ${workspace.deadline}`, "needs-map");
  const actions = card.createDiv({ cls: "los-actions" });
  const moduleIds = (workspace.module_ids || []).filter(
    (id) => id !== moduleContext
  );
  for (const id of moduleIds.slice(0, 3)) {
    const module2 = plugin.store.get(id);
    if (module2) button(actions, `Open ${module2.title}`, () => plugin.openModule(id), "quiet");
  }
  for (const id of (workspace.unit_ids || []).slice(0, 3)) {
    const unit = plugin.store.get(id);
    if (unit) button(actions, `Open ${unit.title}`, () => plugin.openUnit(id), "quiet");
  }
  return card;
}
function unitCard(parent, plugin, unit) {
  const card = parent.createEl("button", {
    cls: `los-card los-unit-card los-s-${unit.status} is-clickable`,
    attr: { type: "button", "aria-label": `Open unit: ${unit.title}` }
  });
  const top = card.createDiv({ cls: "los-card-top" });
  top.createEl("h3", { text: unit.title });
  badge(top, unit.status, unit.status);
  card.createEl("p", { text: unit.scope });
  const map = plugin.store.mapForUnit(unit.id);
  if (map) {
    const done = (map.stages || []).filter(
      (row) => row.status === "complete"
    ).length;
    card.createDiv({ cls: "los-progress-copy", text: `${done} of ${(map.stages || []).length} stages complete` });
  } else {
    card.createDiv({ cls: "los-progress-copy", text: "No study map yet" });
  }
  card.addEventListener("click", () => plugin.openUnit(unit.id));
  return card;
}
var OWNERSHIP_STATEMENT = "Presentation only \xB7 facts live in the LearningOS core \xB7 buttons are conveniences, never duties.";

// src/app/global-search.ts
var GlobalSearchModal = class extends import_obsidian2.Modal {
  plugin;
  query;
  filter;
  input;
  tabButtons = [];
  tabs;
  results;
  constructor(app, plugin, initialQuery = "") {
    super(app);
    this.plugin = plugin;
    this.query = String(initialQuery || "");
    this.filter = "all";
  }
  onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-global-search");
    this.plugin.router.openOverlay({ kind: "global-search", query: this.query, filter: this.filter });
    const header = root.createDiv({ cls: "los-search-header" });
    const copy = header.createDiv();
    copy.createDiv({ cls: "los-kicker", text: "Search LearningOS" });
    copy.createEl("h2", { text: "Find a module, unit, source, or project" });
    button(header, "Close", () => this.close(), "quiet").setAttribute("aria-label", "Close global search");
    this.input = root.createEl("input", {
      cls: "los-search los-global-search-input",
      attr: {
        type: "search",
        placeholder: "Search titles, aliases, authors, and IDs",
        "aria-label": "Search LearningOS",
        autocomplete: "off"
      }
    });
    this.input.value = this.query;
    this.input.addEventListener("input", () => {
      this.query = this.input.value;
      this.plugin.router.updateOverlay({ query: this.query });
      this.renderResults();
    });
    const tabs = root.createDiv({ cls: "los-search-tabs", attr: { role: "tablist", "aria-label": "Search result type" } });
    this.tabButtons = [];
    for (const [id, label] of [
      ["all", "All"],
      ["learning", "Modules & units"],
      ["sources", "Learning sources"],
      ["projects", "Projects"]
    ]) {
      const tab = button(tabs, label, () => {
        this.filter = id;
        this.plugin.router.updateOverlay({ filter: id });
        this.renderTabs();
        this.renderResults();
      }, "tertiary");
      tab.addClass("los-search-tab");
      tab.setAttrs({ role: "tab", "data-filter": id, "aria-selected": String(this.filter === id) });
      this.tabButtons.push(tab);
    }
    this.tabs = tabs;
    this.results = root.createDiv({ cls: "los-search-results", attr: { "aria-live": "polite" } });
    this.renderTabs();
    this.renderResults();
    this.input.focus();
  }
  onClose() {
    this.plugin.router.clearOverlay();
    this.contentEl.empty();
  }
  renderTabs() {
    for (const tab of this.tabButtons || []) {
      const active = tab.getAttribute("data-filter") === this.filter;
      tab.toggleClass("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    }
  }
  candidates() {
    const rows = [];
    const add = (record, kind, subtitle, open) => {
      if (!record?.id || !record?.title) return;
      rows.push({
        id: record.id,
        title: record.title,
        aliases: record.aliases || [],
        authors: record.authors || [],
        kind,
        subtitle,
        open
      });
    };
    for (const module2 of this.plugin.store.modules()) {
      const area = this.plugin.store.get(module2.area_id)?.title || module2.code || "Module";
      add(module2, "learning", `Module \xB7 ${area}`, () => this.plugin.openModule(module2.id));
    }
    for (const project of this.plugin.store.projects()) {
      add(
        project,
        "projects",
        `Project \xB7 ${project.project_type || project.status || "active"}`,
        () => this.plugin.openProject(project.id)
      );
    }
    for (const unit of this.plugin.store.units()) {
      const module2 = this.plugin.store.get(unit.module_id);
      add(unit, "learning", `Unit \xB7 ${module2?.title || unit.module_id}`, () => this.plugin.openUnit(unit.id));
    }
    for (const source of this.plugin.store.sources()) {
      const byline = (source.authors || []).join(", ") || source.organization || source.kind || "Learning source";
      add(source, "sources", `Learning source \xB7 ${byline}`, () => this.plugin.openLibrary(source.id, "source"));
    }
    for (const pack of this.plugin.store.topicPacks()) {
      add(
        pack,
        "sources",
        `Topic Pack \xB7 ${(pack.entries || []).length} items`,
        () => this.plugin.openTopicPackDetail(pack.id)
      );
    }
    for (const workspace of this.plugin.store.of("workspace")) {
      const linkedProject = workspace.project_id ? this.plugin.store.get(workspace.project_id) : null;
      if (!linkedProject) continue;
      add(workspace, "projects", `Project workspace \xB7 ${linkedProject.title}`, () => this.plugin.openProject(linkedProject.id));
    }
    return rows;
  }
  matches(candidate) {
    const words = this.query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!words.length) return true;
    const haystack = [
      candidate.id,
      candidate.title,
      candidate.subtitle,
      ...candidate.aliases,
      ...candidate.authors
    ].filter(Boolean).join(" ").toLocaleLowerCase();
    return words.every(
      (word) => haystack.includes(word)
    );
  }
  rankedCandidates() {
    const needle = this.query.toLocaleLowerCase().trim();
    return this.candidates().filter((candidate) => this.filter === "all" || candidate.kind === this.filter).filter((candidate) => this.matches(candidate)).sort((left, right) => {
      const leftTitle = left.title.toLocaleLowerCase();
      const rightTitle = right.title.toLocaleLowerCase();
      const leftRank = !needle ? 2 : leftTitle === needle ? 0 : leftTitle.startsWith(needle) ? 1 : 2;
      const rightRank = !needle ? 2 : rightTitle === needle ? 0 : rightTitle.startsWith(needle) ? 1 : 2;
      return leftRank - rightRank || left.title.localeCompare(right.title);
    });
  }
  renderResults() {
    if (!this.results) return;
    this.results.empty();
    const rows = this.rankedCandidates();
    const summary = this.results.createDiv({ cls: "los-search-summary" });
    summary.createSpan({ text: this.query.trim() ? `${rows.length} result${rows.length === 1 ? "" : "s"}` : "Quick access" });
    summary.createSpan({ cls: "los-micro", text: "Manifest identities only" });
    if (!rows.length) {
      empty(
        this.results,
        "No structural results",
        `Nothing in the current LearningOS projection matches \u201C${this.query.trim()}\u201D.`,
        "Clear search",
        () => {
          this.query = "";
          this.input.value = "";
          this.plugin.router.updateOverlay({ query: "" });
          this.renderResults();
          this.input.focus();
        }
      );
      return;
    }
    const list = this.results.createDiv({ cls: "los-search-result-list" });
    for (const row of rows.slice(0, 24)) {
      const result = list.createEl("button", {
        cls: "los-search-result is-clickable",
        attr: { type: "button", "aria-label": `Open ${row.title}` }
      });
      const copy = result.createDiv({ cls: "los-search-result-copy" });
      copy.createEl("strong", { text: row.title });
      copy.createDiv({ cls: "los-micro", text: row.subtitle });
      result.createSpan({ cls: "los-search-open", text: "Open \u2192" });
      result.addEventListener("click", () => {
        this.close();
        row.open();
      });
    }
    if (rows.length > 24) {
      this.results.createDiv({ cls: "los-micro", text: `${rows.length - 24} more results. Refine the query to narrow the list.` });
    }
  }
};

// src/contracts/route-v1.ts
var LIBRARY_COLLECTIONS = [
  "sources",
  "topic-packs"
];
var PROJECT_DETAIL_TABS = [
  "overview",
  "structure",
  "linked-materials",
  "files",
  "decisions"
];
function isLibraryCollection(value) {
  return LIBRARY_COLLECTIONS.includes(value);
}
function isProjectDetailTab(value) {
  return PROJECT_DETAIL_TABS.includes(value);
}
function asLibraryCollection(value) {
  return isLibraryCollection(value) ? value : "sources";
}
function asProjectDetailTab(value) {
  return isProjectDetailTab(value) ? value : "overview";
}

// src/app/router.ts
function asLegacyState(value) {
  return value && typeof value === "object" ? value : {};
}
function asText(value, fallback = "") {
  return typeof value === "string" && value ? value : fallback;
}
function asNullableText(value) {
  return typeof value === "string" && value ? value : null;
}
var ApplicationRouter = class {
  plugin;
  navigation;
  overlay;
  constructor(plugin) {
    this.plugin = plugin;
    const saved = plugin.settings.navigation;
    this.navigation = saved?.version === 1 && saved.current ? saved : { version: 1, current: this.fromLegacy(plugin.settings.lastView), history: [] };
    this.overlay = null;
  }
  fromLegacy(legacy) {
    const input = legacy && typeof legacy === "object" ? legacy : {};
    const type = asText(input.type);
    const state = asLegacyState(input.state);
    if (type === VIEW_PROGRAM) {
      return state.programId === "inbox" ? { name: "capture" } : { name: "learn", programId: asText(state.programId, LEARN_AREAS[0][0]) };
    }
    if (type === VIEW_MODULE) {
      if (state.screen === "groups") return { name: "module-groups" };
      if (state.screen === "list") return { name: "module-list", groupId: asText(state.groupId), query: asText(state.query) };
      return {
        name: "module-detail",
        moduleId: asText(state.moduleId),
        componentId: asNullableText(state.componentId),
        tab: asNullableText(state.tab)
      };
    }
    if (type === VIEW_UNIT) return { name: "unit", unitId: asText(state.unitId), stageId: asNullableText(state.stageId) };
    if (type === VIEW_PROJECT) return state.projectId ? { name: "project-detail", projectId: asText(state.projectId), tab: asProjectDetailTab(state.tab) } : { name: "project-list", query: asText(state.query) };
    if (type === VIEW_LIBRARY) return this.libraryRouteFromState(state);
    if (type === VIEW_ATLAS) return { name: "atlas", domain: asNullableText(state.domain) };
    if (type === VIEW_SHELVING) return { name: "shelving", unitId: asNullableText(state.unitId) };
    if (type === VIEW_BOUNDARY) return { name: "boundary", boundaryId: asText(state.boundaryId) };
    if (type === VIEW_REVIEW) return { name: "review" };
    if (type === VIEW_GARDEN) return { name: "garden" };
    if (type === VIEW_DIAGNOSTICS) return { name: "diagnostics" };
    return { name: "home" };
  }
  libraryRouteFromState(state = {}) {
    if (state.screen === "group") return {
      name: "library-group",
      collection: asLibraryCollection(state.collection),
      groupId: asText(state.groupId),
      query: asText(state.query),
      facet: asText(state.facet, "all")
    };
    if (state.screen === "source-detail") return {
      name: "source-detail",
      resourceId: asText(state.resourceId),
      fromGroupId: asNullableText(state.fromGroupId),
      query: asText(state.query),
      facet: asText(state.facet, "all")
    };
    if (state.screen === "topic-pack-detail") return {
      name: "topic-pack-detail",
      topicPackId: asText(state.topicPackId),
      fromGroupId: asNullableText(state.fromGroupId),
      query: asText(state.query)
    };
    if (state.screen === "catalogue-detail") return { name: "catalogue-detail", catalogueId: asText(state.catalogueId) };
    const recordType = asText(state.recordType);
    if (state.screen === "legacy-list") return {
      name: "legacy-library-list",
      recordType: recordType || "note",
      query: asText(state.query),
      domain: asText(state.domain)
    };
    const recordId = asText(state.recordId);
    if (recordId) {
      const record = this.plugin.store?.get?.(recordId);
      if (record?.type === "source" || recordType === "source") {
        return { name: "source-detail", resourceId: recordId };
      }
      if (record?.type === "topic-pack") return { name: "topic-pack-detail", topicPackId: recordId };
      if (record?.type === "collection" || recordType === "collection") {
        return { name: "catalogue-detail", catalogueId: recordId };
      }
    }
    if (recordType && !["source", "topic-pack"].includes(recordType)) {
      return { name: "legacy-library-list", recordType, query: asText(state.query), domain: asText(state.domain) };
    }
    return { name: "library-home", collection: recordType === "topic-pack" ? "topic-packs" : "sources" };
  }
  descriptor(route) {
    switch (route?.name) {
      case "home":
        return { type: VIEW_HOME, state: {}, nav: "home", pin: true };
      case "learn":
        return { type: VIEW_PROGRAM, state: { programId: route.programId }, nav: "learn" };
      case "capture":
        return { type: VIEW_PROGRAM, state: { programId: "inbox" }, nav: "capture" };
      case "review":
        return { type: VIEW_REVIEW, state: {}, nav: "review" };
      case "garden":
        return { type: VIEW_GARDEN, state: {}, nav: "review" };
      case "diagnostics":
        return { type: VIEW_DIAGNOSTICS, state: {}, nav: "diagnostics" };
      case "program":
        return {
          type: VIEW_PROGRAM,
          state: { programId: route.programId },
          nav: route.programId === "queue-needs-map" ? "review" : "learn"
        };
      case "module-groups":
        return { type: VIEW_MODULE, state: { screen: "groups" }, nav: "modules" };
      case "module-list":
        return {
          type: VIEW_MODULE,
          state: { screen: "list", groupId: route.groupId, query: route.query || "" },
          nav: "modules"
        };
      case "module":
      case "module-detail":
        return {
          type: VIEW_MODULE,
          state: {
            screen: "detail",
            moduleId: route.moduleId,
            componentId: route.componentId || null,
            tab: "tab" in route ? route.tab || null : null
          },
          nav: "modules"
        };
      case "project-list":
        return { type: VIEW_PROJECT, state: { screen: "list", query: route.query || "" }, nav: "projects" };
      case "project-detail":
        return {
          type: VIEW_PROJECT,
          state: { screen: "detail", projectId: route.projectId, tab: route.tab || "overview" },
          nav: "projects"
        };
      case "unit":
        return {
          type: VIEW_UNIT,
          state: { unitId: route.unitId, stageId: route.stageId || null },
          nav: "learn"
        };
      case "library-home":
        return {
          type: VIEW_LIBRARY,
          state: { screen: "home", collection: route.collection || "sources" },
          nav: "library"
        };
      case "library-group":
        return {
          type: VIEW_LIBRARY,
          state: {
            screen: "group",
            collection: route.collection || "sources",
            groupId: route.groupId,
            query: route.query || "",
            facet: route.facet || "all"
          },
          nav: "library"
        };
      case "source-detail":
        return {
          type: VIEW_LIBRARY,
          state: {
            screen: "source-detail",
            resourceId: route.resourceId,
            fromGroupId: route.fromGroupId || null,
            query: route.query || "",
            facet: route.facet || "all"
          },
          nav: "library"
        };
      case "topic-pack-detail":
        return {
          type: VIEW_LIBRARY,
          state: {
            screen: "topic-pack-detail",
            topicPackId: route.topicPackId,
            fromGroupId: route.fromGroupId || null,
            query: route.query || ""
          },
          nav: "library"
        };
      case "catalogue-detail":
        return {
          type: VIEW_LIBRARY,
          state: { screen: "catalogue-detail", catalogueId: route.catalogueId },
          nav: "library"
        };
      case "legacy-library-list":
        return {
          type: VIEW_LIBRARY,
          state: { screen: "legacy-list", recordType: route.recordType, query: route.query || "", domain: route.domain || "" },
          nav: "library"
        };
      case "library": {
        const compatible = this.libraryRouteFromState(route);
        return this.descriptor(compatible);
      }
      case "atlas":
        return { type: VIEW_ATLAS, state: { domain: route.domain || null }, nav: "atlas" };
      case "shelving":
        return { type: VIEW_SHELVING, state: { unitId: route.unitId || null }, nav: "review" };
      case "boundary":
        return {
          type: VIEW_BOUNDARY,
          state: { boundaryId: route.boundaryId },
          nav: route.boundaryId === "program-job-boundary" ? "job" : "masters"
        };
      default:
        return { type: VIEW_HOME, state: {}, nav: "home", pin: true };
    }
  }
  sameRoute(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  async openLeaf(type, state = {}, side = "main") {
    let leaf = this.plugin.app.workspace.getLeavesOfType(type)[0];
    if (!leaf) {
      leaf = side === "left" ? this.plugin.app.workspace.getLeftLeaf?.(false) ?? this.plugin.app.workspace.getLeaf(true) : this.plugin.app.workspace.getLeaf(true);
    }
    await leaf.setViewState({ type, active: true, state });
    this.plugin.app.workspace.revealLeaf(leaf);
    this.plugin.app.workspace.setActiveLeaf?.(leaf, { focus: true });
    return leaf;
  }
  async openNavigator() {
    return this.openLeaf(VIEW_NAV, {}, "left");
  }
  async persist() {
    this.plugin.settings.navigation = this.navigation;
    delete this.plugin.settings.lastView;
    await this.plugin.saveData(this.plugin.settings);
  }
  openOverlay(overlay) {
    this.overlay = { ...overlay };
    return this.overlay;
  }
  updateOverlay(patch) {
    if (!this.overlay) return null;
    this.overlay = { ...this.overlay, ...patch };
    return this.overlay;
  }
  clearOverlay() {
    this.overlay = null;
  }
  /** Replace restorable route state without opening a leaf or adding history. */
  async remember(route) {
    this.navigation.current = route;
    await this.persist();
    return route;
  }
  async navigate(route, options = {}) {
    if (!options.preserveOverlay) this.clearOverlay();
    const descriptor = this.descriptor(route);
    const remember = options.remember !== false;
    const pushHistory = options.pushHistory !== false;
    const prior = this.navigation.current;
    if (remember && pushHistory && prior && !this.sameRoute(prior, route)) {
      const activeView = this.plugin.app.workspace.active?.view;
      const currentScroll = Number(options.scrollTop ?? activeView?.contentEl?.scrollTop ?? 0);
      const selectedElementId = options.selectedElementId || activeView?.selectedElementId || void 0;
      this.navigation.history.push({ route: prior, scrollTop: currentScroll, selectedElementId });
      this.navigation.history = this.navigation.history.slice(-50);
    }
    if (remember) {
      this.navigation.current = route;
      await this.persist();
    }
    this.plugin.setActiveNav(descriptor.nav);
    const leaf = await this.openLeaf(descriptor.type, descriptor.state);
    if (Number.isFinite(options.restoreScrollTop) && leaf?.view?.contentEl) {
      leaf.view.contentEl.scrollTop = Number(options.restoreScrollTop);
    }
    if (options.restoreSelectedElementId && leaf?.view) {
      leaf.view.selectedElementId = options.restoreSelectedElementId;
    }
    if (descriptor.pin && this.plugin.settings.pinHome) leaf.setPinned?.(true);
    return leaf;
  }
  async restore() {
    this.clearOverlay();
    const route = this.navigation.current || { name: "home" };
    if (route.name !== "home" && this.plugin.settings.pinHome) {
      const home = await this.navigate({ name: "home" }, { remember: false, pushHistory: false });
      home.setPinned?.(true);
    }
    return this.navigate(route, { remember: true, pushHistory: false });
  }
  async back() {
    const entry = this.navigation.history.pop();
    if (!entry) return this.navigate({ name: "home" }, { pushHistory: false });
    this.navigation.current = entry.route;
    await this.persist();
    return this.navigate(entry.route, {
      remember: false,
      pushHistory: false,
      restoreScrollTop: entry.scrollTop || 0,
      restoreSelectedElementId: entry.selectedElementId
    });
  }
  snapshot() {
    return JSON.parse(JSON.stringify({ ...this.navigation, overlay: this.overlay }));
  }
};

// src/app/unit-note-modal.ts
var import_obsidian3 = require("obsidian");
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
var UnitNoteModal = class extends import_obsidian3.Modal {
  plugin;
  unit;
  studyMap;
  files = [];
  recoveredStageIds = [];
  referencedStageIds = [];
  titleInput;
  editor;
  fileInput;
  fileSummary;
  constructor(app, plugin, unit, studyMap) {
    super(app);
    this.plugin = plugin;
    this.unit = unit;
    this.studyMap = studyMap;
    this.files = [];
  }
  onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-unit-note-modal");
    const stages = Array.isArray(
      this.studyMap?.stages
    ) ? this.studyMap.stages : [];
    const draft = this.plugin.getUnitNoteDraft(this.unit.id, stages);
    const recoveredStageIds = Array.isArray(
      draft.recoveredStageIds
    ) ? draft.recoveredStageIds.filter(
      (id) => typeof id === "string"
    ) : [];
    this.recoveredStageIds = recoveredStageIds;
    this.referencedStageIds = [
      .../* @__PURE__ */ new Set([
        ...this.unrecordedCompletedStages(stages),
        ...recoveredStageIds
      ])
    ];
    pageHeader(
      root,
      "Learning session",
      "Add note",
      "Attach one note after the stages you worked through. It belongs to the unit, not to one selected stage."
    );
    const context = root.createDiv({ cls: "los-unit-note-context" });
    context.createDiv({ cls: "los-kicker", text: "Stages covered" });
    if (this.referencedStageIds.length) {
      const names = this.referencedStageIds.map(
        (id) => stages.find(
          (stage) => stage.id === id
        )?.title || id
      );
      context.createDiv({ text: names.join(" \xB7 ") });
    } else {
      context.createDiv({ cls: "los-micro", text: "No newly completed stage is required. You may still record a unit-level observation." });
    }
    this.titleInput = root.createEl("input", {
      cls: "los-search los-unit-note-title",
      attr: { type: "text", placeholder: "Optional note title", "aria-label": "Unit note title" }
    });
    this.titleInput.value = draft.title || "";
    this.editor = root.createEl("textarea", {
      cls: "los-note-editor los-unit-note-editor",
      attr: { placeholder: "What should remain after this learning session?", "aria-label": "Unit learning-session note" }
    });
    this.editor.value = draft.text || "";
    const attachments = root.createDiv({ cls: "los-unit-note-attachments" });
    attachments.createDiv({ cls: "los-kicker", text: "Attachments" });
    this.fileInput = attachments.createEl("input", {
      cls: "los-file-input",
      attr: { type: "file", multiple: "multiple", "aria-label": "Choose unit note attachments" }
    });
    this.fileSummary = attachments.createDiv({ cls: "los-micro", text: "Optional: handwriting, image, or PDF." });
    this.fileInput.addEventListener("change", () => {
      this.files = [...this.fileInput.files || []];
      this.fileSummary.setText(this.files.length ? `${this.files.length} attachment${this.files.length === 1 ? "" : "s"} selected for this save.` : "Optional: handwriting, image, or PDF.");
    });
    const status = root.createDiv({ cls: "los-draft-status", attr: { "aria-live": "polite" } });
    const persist = () => {
      this.plugin.setUnitNoteDraft(this.unit.id, this.titleInput.value, this.editor.value);
      status.setText(this.editor.value.trim() ? "Draft kept locally until the core confirms the save." : "Write a note to enable saving.");
      status.toggleClass("is-dirty", Boolean(this.editor.value.trim()));
    };
    this.titleInput.addEventListener("input", persist);
    this.editor.addEventListener("input", persist);
    persist();
    const actions = root.createDiv({ cls: "los-actions los-unit-note-actions" });
    button(actions, "Cancel", () => this.close(), "quiet");
    button(actions, "Save note", () => this.save(), "cta");
    this.editor.focus();
  }
  unrecordedCompletedStages(stages) {
    const already = new Set(
      (this.unit.note_sections || []).flatMap(
        (section3) => Array.isArray(section3.stage_ids) ? section3.stage_ids.filter(
          (id) => typeof id === "string"
        ) : []
      )
    );
    return stages.filter(
      (stage) => ["complete", "skipped"].includes(String(stage.status)) && typeof stage.id === "string" && !already.has(stage.id)
    ).map((stage) => String(stage.id));
  }
  async save() {
    const text = String(this.editor?.value || "");
    if (!text.trim()) {
      new import_obsidian3.Notice("Write a note before saving.");
      this.editor?.focus();
      return;
    }
    if (this.plugin.gateway.isBusy) {
      new import_obsidian3.Notice("A LearningOS write is already running.");
      return;
    }
    const filePaths = this.files.map((file) => localFilePath(file)).filter((value) => Boolean(value));
    if (filePaths.length !== this.files.length) {
      new import_obsidian3.Notice("One selected attachment has no readable local path. Remove it and choose the file again.");
      return;
    }
    try {
      await this.plugin.mutate(() => this.plugin.gateway.saveUnitNote(this.unit.id, {
        title: this.titleInput?.value || "",
        text,
        stageIds: this.referencedStageIds,
        filePaths
      }));
      this.plugin.clearUnitNoteDraft(this.unit.id, this.recoveredStageIds);
      new import_obsidian3.Notice("Learning-session note saved.");
      this.close();
    } catch (error) {
      new import_obsidian3.Notice(errorMessage(error));
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/contracts/gateway-v1.ts
var EXIT_PROJECTION_CONFLICT = 3;
var GatewayError = class extends Error {
  exitCode;
  constructor(message, exitCode = null) {
    super(message);
    this.name = "GatewayError";
    this.exitCode = exitCode;
  }
  get isProjectionConflict() {
    return this.exitCode === EXIT_PROJECTION_CONFLICT;
  }
};
function isProjectionConflict(error) {
  return error instanceof GatewayError && error.isProjectionConflict;
}
function exitCodeOf(error) {
  const code = error?.code;
  return typeof code === "number" ? code : null;
}
function structuredError(stdout) {
  const raw = String(stdout ?? "").trim();
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    const message = parsed?.error;
    return typeof message === "string" ? message.trim() : "";
  } catch (_) {
    return "";
  }
}
function asStringList(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
}
function asSessionReview(result) {
  return {
    owned_changes: asStringList(result.owned_changes),
    unrelated_changes: asStringList(result.unrelated_changes),
    pushed: result.pushed === true
  };
}

// src/gateway-client.ts
var requestCounter = 0;
function nextRequestId(capability) {
  requestCounter += 1;
  return `req-${capability.replace(/\./g, "-")}-${Date.now()}-${requestCounter}`;
}
var GatewayClient = class {
  plugin;
  chain;
  pending;
  constructor(plugin) {
    this.plugin = plugin;
    this.chain = Promise.resolve();
    this.pending = 0;
  }
  /**
   * Serialize every mutation, wherever it was clicked. Failures do not poison
   * the chain: the next task runs regardless of how the previous one settled,
   * but never alongside it.
   */
  enqueue(task) {
    this.pending += 1;
    const run = this.chain.then(task, task);
    this.chain = run.then(() => void 0, () => void 0).then(() => {
      this.pending -= 1;
    });
    return run;
  }
  get isBusy() {
    return this.pending > 0;
  }
  /**
   * Every mutating command answers in JSON. Unreadable or empty output means
   * the write was NOT confirmed, so this must reject: call sites clear
   * UI-owned drafts on resolve, and resolving on garbage would destroy the
   * learner's text behind a success notice. `expectJson: false` is only for
   * the text-reporting commands (`validate`, `generate`).
   */
  call(args, { expectJson = true, stdin } = {}) {
    return new Promise((resolve2, reject) => {
      this.plugin.runLos(
        args,
        (error, stdout, stderr) => {
          if (error) {
            const reason = structuredError(stdout) || stderr.trim() || error.message || String(error);
            reject(new GatewayError(reason, exitCodeOf(error)));
            return;
          }
          const raw = String(stdout ?? "").trim();
          if (!expectJson) {
            resolve2({ ok: true, stdout: raw });
            return;
          }
          if (!raw) {
            reject(new Error("LearningOS wrote nothing back, so the change is unconfirmed. Your draft was kept."));
            return;
          }
          let parsed = null;
          try {
            parsed = JSON.parse(raw);
          } catch (_) {
            reject(new Error(`LearningOS answered with unreadable output, so the change is unconfirmed and your draft was kept: ${raw.slice(0, 160)}`));
            return;
          }
          if (!parsed || typeof parsed !== "object" || parsed.ok === false) {
            reject(new GatewayError(
              parsed?.error || "LearningOS refused the change; your draft was kept.",
              exitCodeOf(error)
            ));
            return;
          }
          resolve2(parsed);
        },
        stdin
      );
    });
  }
  /**
   * The one write shape.
   *
   * Every canonical mutation is a declared capability sent as an envelope, so
   * there is a single call shape, a single response shape and a single error
   * path — instead of one positional signature per command, each with its own
   * flag order to get wrong. The named methods below are porcelain over this.
   */
  capability(name, payload) {
    const envelope = {
      request_id: nextRequestId(name),
      capability: name,
      expected_snapshot: this.snapshotId(),
      payload
    };
    return this.call(
      ["capability", name, "--payload-file", "-"],
      { stdin: JSON.stringify(envelope) }
    );
  }
  /**
   * The snapshot guard is what makes a write refusable, so a missing snapshot
   * id must stop the write rather than travel to the CLI as the string
   * "null" — which would be compared against a real snapshot and refused with
   * a misleading message, or worse, matched by accident.
   */
  snapshotId() {
    const snapshotId = this.plugin.store.snapshotId;
    if (!snapshotId) {
      throw new Error("LearningOS has no loaded snapshot to guard this change against; nothing was written.");
    }
    return snapshotId;
  }
  /** Positional-flag form, kept for the commands that are not capabilities. */
  guard() {
    return ["--expected-snapshot", this.snapshotId()];
  }
  // ---- porcelain: each is one declared capability, nothing more ----------
  saveNote(unitId, stageId, text) {
    return this.capability(
      "stage.note.write",
      { unit_id: unitId, stage_id: stageId, text, replace: true }
    );
  }
  saveUnitNote(unitId, {
    title = "",
    text,
    stageIds = [],
    filePaths = []
  }) {
    const payload = { unit_id: unitId, text };
    if (String(title).trim()) payload.title = String(title).trim();
    if (stageIds.length) payload.stage_id = [...stageIds];
    if (filePaths.length) payload.attachment = [...filePaths];
    return this.capability("unit.note.append", payload);
  }
  progress(unitId, stageId, status) {
    return this.capability(
      "stage.progress.update",
      { unit_id: unitId, stage_id: stageId, status }
    );
  }
  feedback(unitId, stageId, sourceId, feedback) {
    return this.capability(
      "source.feedback.record",
      { unit_id: unitId, stage_id: stageId, source_id: sourceId, feedback }
    );
  }
  detour(unitId, stageId, title, classification = "required-now") {
    return this.capability(
      "detour.create",
      { unit_id: unitId, stage_id: stageId, title, classification }
    );
  }
  resolveDetour(unitId, detourId, resolution = "") {
    const payload = { unit_id: unitId, detour_id: detourId };
    if (resolution) payload.resolution = resolution;
    return this.capability("detour.resolve", payload);
  }
  attach(unitId, stageId, filePath, label = "") {
    const payload = { unit_id: unitId, stage_id: stageId, file: filePath };
    if (label) payload.label = label;
    return this.capability("stage.attachment.add", payload);
  }
  captureText(text, title = "") {
    const payload = { text };
    if (title) payload.title = title;
    return this.capability("capture.create", payload);
  }
  captureFile(filePath) {
    return this.capability("capture.create", { file: filePath });
  }
  prepareShelving(unitId) {
    return this.capability("review.prepare", { unit_id: unitId });
  }
  applyShelving(unitId, selected) {
    return this.capability(
      "review.apply",
      { unit_id: unitId, selected: [...selected], approve: true }
    );
  }
  endSession(commitMessage = null, push = false) {
    const args = ["session-end"];
    if (commitMessage) args.push("--commit-message", commitMessage);
    if (push) args.push("--push");
    return this.call(args);
  }
};
function explicitAiContext(plugin, context = {}) {
  const unit = context.unitId ? plugin.store.get(context.unitId) : null;
  const module2 = context.moduleId ? plugin.store.get(context.moduleId) : unit ? plugin.store.get(unit.module_id) : null;
  const studyMap = unit ? plugin.store.mapForUnit(unit.id) : null;
  const stage = context.stageId ? plugin.store.stage(context.stageId) : null;
  const resources = Array.isArray(stage?.resources) ? stage.resources : [];
  return {
    area_program_id: context.programId || module2?.area_id || null,
    module_id: module2?.id || context.moduleId || null,
    component_id: context.componentId || unit?.component_id || null,
    unit_id: unit?.id || context.unitId || null,
    stage_id: stage?.id || context.stageId || null,
    selected_source_ids: [...new Set(resources.map((row) => row.source_id).filter(Boolean))],
    selected_materials: resources.map((row) => row.material_uri || row.vault_path || row.url || row.material_path).filter(Boolean),
    manifest_snapshot: plugin.store.snapshotId,
    active_file_supplement: plugin.app.workspace.getActiveFile?.()?.path || null
  };
}

// src/infrastructure/ai-action-client.ts
var AIActionClient = class {
  plugin;
  constructor(plugin) {
    this.plugin = plugin;
  }
  providers() {
    return this.plugin.store.aiProviders();
  }
  prepareGardenShelving(targetId, provider = "manual-bundle", jobExportConfirmed = false) {
    const args = [
      "ai-action-prepare",
      "--action-id",
      "garden.shelve",
      "--target-kind",
      "garden-note",
      "--target-id",
      targetId,
      "--provider",
      provider,
      ...this.plugin.gateway.guard()
    ];
    if (jobExportConfirmed) {
      args.push("--confirm-job-export");
    }
    return this.plugin.mutate(
      () => this.plugin.gateway.call(args)
    );
  }
  status(requestId) {
    return this.plugin.gateway.call([
      "ai-action-status",
      requestId
    ]);
  }
  applyApprovedDelivery(deliveryId) {
    return this.plugin.mutate(
      () => this.plugin.gateway.call([
        "ai-action-apply-delivery",
        deliveryId
      ])
    );
  }
};

// src/contracts/manifest-v2.ts
var MANIFEST_CONTRACT_VERSION = 2;
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function requireArray(record, key) {
  if (!Array.isArray(record[key])) {
    throw new TypeError(`Manifest v2 field ${String(key)} must be an array.`);
  }
}
function assertManifestV2(value) {
  if (!isRecord(value) || !isRecord(value._generated)) {
    throw new TypeError("Manifest v2 requires an _generated object.");
  }
  if (value._generated.contract_version !== MANIFEST_CONTRACT_VERSION) {
    throw new TypeError(
      `Unsupported manifest contract ${String(value._generated.contract_version)}; expected ${MANIFEST_CONTRACT_VERSION}.`
    );
  }
  for (const key of [
    "academic_deadlines",
    "garden_entries",
    "module_source_maps",
    "modules",
    "programs",
    "project_relationships",
    "projects",
    "quarantine_boundaries",
    "records",
    "relations",
    "semesters",
    "stages",
    "study_maps",
    "thematic_groups",
    "topic_packs",
    "units"
  ]) {
    requireArray(value, key);
  }
  for (const unit of value.units) {
    if (!isRecord(unit) || typeof unit.id !== "string" || typeof unit.notes_text !== "string" || !Array.isArray(unit.note_sections)) {
      throw new TypeError("Manifest v2 unit rows require projected unit note fields.");
    }
  }
  for (const key of ["ai_actions", "artifact_revisions", "backlinks", "counts", "indexes", "progress", "project_aliases"]) {
    if (!isRecord(value[key])) {
      throw new TypeError(`Manifest v2 field ${key} must be an object.`);
    }
  }
}

// src/manifest-store.ts
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
var ManifestStore = class {
  app;
  ready;
  error;
  data;
  records;
  byId;
  contractVersion = null;
  snapshotId = null;
  constructor(app) {
    this.app = app;
    this.ready = false;
    this.error = "";
    this.data = null;
    this.records = [];
    this.byId = /* @__PURE__ */ new Map();
  }
  async load() {
    try {
      if (!await this.app.vault.adapter.exists("generated/manifest.json")) {
        throw new Error("Projection unavailable \u2014 rebuild it to continue.");
      }
      const parsed = JSON.parse(
        await this.app.vault.adapter.read(
          "generated/manifest.json"
        )
      );
      const generated = isRecord2(parsed) && isRecord2(parsed._generated) ? parsed._generated : null;
      const version = generated?.contract_version;
      if (version !== CONTRACT_VERSION) {
        throw new Error(
          `Unsupported manifest contract ${String(version ?? "unknown")}; LearningOS UI requires contract ${CONTRACT_VERSION}.`
        );
      }
      assertManifestV2(parsed);
      const manifest = parsed;
      this.data = manifest;
      this.contractVersion = version;
      this.snapshotId = manifest._generated.snapshot_id;
      this.records = (manifest.records || []).filter((row) => row && typeof row === "object");
      this.byId = new Map(this.records.filter((row) => row?.id).map((row) => [row.id, row]));
      const indexedGroups = [
        "programs",
        "modules",
        "projects",
        "units",
        "study_maps",
        "stages",
        "thematic_groups",
        "topic_packs"
      ];
      for (const group of indexedGroups) {
        for (const row of manifest[group]) {
          if (typeof row?.id === "string") {
            this.byId.set(row.id, row);
          }
        }
      }
      this.ready = true;
      this.error = "";
      return true;
    } catch (error) {
      this.ready = false;
      this.error = error instanceof Error ? error.message : String(error);
      return false;
    }
  }
  get(id) {
    return this.byId.get(id) || null;
  }
  of(type) {
    return this.records.filter((row) => row?.type === type);
  }
  /**
   * One null row anywhere in a projected array used to take Home down on
   * startup. Every list accessor drops non-objects at the boundary, so no view
   * has to defend itself row by row.
   */
  rows(group) {
    const value = this.data?.[group];
    return Array.isArray(value) ? value.filter((row) => row && typeof row === "object") : [];
  }
  programs() {
    return this.rows("programs");
  }
  modules() {
    return this.rows("modules");
  }
  projects() {
    return this.rows("projects");
  }
  projectRelationships(projectId = null) {
    const rows = this.rows("project_relationships");
    return projectId ? rows.filter((row) => row.from_project_id === projectId) : rows;
  }
  resolveProjectAlias(id) {
    return this.data?.project_aliases?.[id] || id;
  }
  projectForUnit(unit) {
    const ids = Array.isArray(unit?.project_ids) ? unit.project_ids : [];
    return ids.map((id) => this.get(id)).find((row) => row?.type === "project") || null;
  }
  thematicGroups() {
    return this.rows("thematic_groups").slice().sort((a, b) => Number(a.order || 0) - Number(b.order || 0) || String(a.title || "").localeCompare(String(b.title || "")));
  }
  sources() {
    return this.of("source");
  }
  topicPacks() {
    return this.rows("topic_packs").length ? this.rows("topic_packs") : this.of("topic-pack");
  }
  catalogues() {
    return this.of("collection").filter((row) => row.collection_kind !== "topic-pack");
  }
  modulesForGroup(groupId) {
    return this.modules().filter((row) => (row.thematic_group_ids || []).includes(groupId));
  }
  sourcesForGroup(groupId) {
    return this.sources().filter((row) => (row.thematic_group_ids || []).includes(groupId));
  }
  topicPacksForGroup(groupId) {
    return this.topicPacks().filter((row) => (row.thematic_group_ids || []).includes(groupId));
  }
  units() {
    return this.rows("units");
  }
  unitNoteSections(unitId) {
    const sections = this.get(unitId)?.note_sections;
    return Array.isArray(sections) ? sections : [];
  }
  studyMaps() {
    return this.rows("study_maps");
  }
  gardenEntries() {
    return this.rows("garden_entries");
  }
  aiAction(actionId) {
    const available = this.data?.ai_actions?.available;
    return this.rows("ai_actions_available").find((row) => row.id === actionId) || (Array.isArray(available) ? available : []).find((row) => row?.id === actionId) || null;
  }
  aiProviders() {
    const rows = this.data?.ai_actions?.provider_adapters;
    return Array.isArray(rows) ? rows.filter((row) => row && typeof row === "object") : [];
  }
  aiRequestsForTarget(targetId) {
    const rows = this.data?.ai_actions?.requests;
    return (Array.isArray(rows) ? rows : []).filter((row) => row?.target?.id === targetId);
  }
  latestAiRequest(targetId) {
    return this.aiRequestsForTarget(targetId).slice().sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0] || null;
  }
  modulesFor(programId) {
    return this.modules().filter((row) => row.area_id === programId);
  }
  unitsFor(moduleId, componentId = null) {
    const rows = this.units().filter((row) => row.module_id === moduleId);
    return componentId ? rows.filter((row) => row.component_id === componentId) : rows;
  }
  mapForUnit(unitId) {
    const mapId = this.data?.indexes?.unit_to_study_map?.[unitId];
    return mapId ? this.get(mapId) : null;
  }
  /** Resolve a stage from its ID alone through the core's flat index. */
  stage(stageId) {
    const stage = this.get(stageId);
    return stage?.study_map_id ? stage : null;
  }
  sourceMap(moduleId) {
    return this.rows("module_source_maps").find((row) => row.module_id === moduleId) || null;
  }
  progress(moduleId) {
    return this.data?.progress?.[moduleId] || {};
  }
  workspacesForModule(moduleId) {
    const rawIds = this.data?.backlinks?.module_to_workspaces?.[moduleId];
    const ids = Array.isArray(rawIds) ? rawIds.filter(
      (id) => typeof id === "string"
    ) : [];
    return ids.map((id) => this.get(id)).filter(
      (row) => row !== null
    );
  }
  useUnits(sourceId) {
    const rawIds = this.data?.indexes?.source_to_units?.[sourceId];
    const ids = Array.isArray(rawIds) ? rawIds.filter(
      (id) => typeof id === "string"
    ) : [];
    return ids.map((id) => this.get(id)).filter(
      (row) => row !== null
    );
  }
  search(query, types = null) {
    const words = String(query || "").toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const allowed = types ? new Set(types) : null;
    const rows = this.records.filter((row) => row && (!allowed || allowed.has(row.type)));
    if (!words.length) return rows;
    const strict = rows.filter((row) => {
      const hay = [
        row.id,
        row.title,
        ...row.aliases || [],
        ...row.authors || [],
        row.organization,
        row.domain
      ].filter(Boolean).join(" ").toLocaleLowerCase();
      return words.every((word) => hay.includes(word));
    });
    if (strict.length) return strict;
    const needle = words.join("");
    return rows.filter((row) => {
      const hay = [row.id, row.title, ...row.aliases || []].filter(Boolean).join(" ").toLocaleLowerCase().replace(/\s+/g, "");
      let at = 0;
      for (const char of hay) if (char === needle[at]) at += 1;
      return at === needle.length;
    });
  }
  related(id) {
    const record = this.get(id);
    if (!record) return [];
    const ids = /* @__PURE__ */ new Set();
    for (const key of [
      "concepts",
      "sources",
      "contexts",
      "notes",
      "program_ids",
      "module_ids",
      "unit_ids",
      "unit_order",
      "related_module_ids"
    ]) {
      for (const value of record[key] || []) ids.add(value);
    }
    for (const table of Object.values(this.data?.backlinks || {})) {
      if (table && typeof table === "object" && Array.isArray(table[id])) {
        for (const value of table[id]) ids.add(typeof value === "string" ? value : value.from);
      }
    }
    for (const relationship of this.projectRelationships()) {
      if (relationship.from_project_id === id) ids.add(relationship.to_id);
      if (relationship.to_id === id) ids.add(relationship.from_project_id);
    }
    return [...ids].map((value) => ({ rec: this.get(value) })).filter((row) => row.rec);
  }
};

// src/settings.ts
var import_obsidian4 = require("obsidian");
function errorMessage2(error) {
  return error instanceof Error ? error.message : String(error);
}
var LearningOSSettingsTab = class extends import_obsidian4.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
  }
  display() {
    const root = this.containerEl;
    root.empty();
    root.createEl("h2", { text: "LearningOS UI" });
    const toggles = [
      ["openHomeOnStartup", "Open Home on startup", "Open the module-first Home view when the vault becomes ready."],
      ["pinHome", "Pin Home", "Keep the Home leaf available while opening units."],
      ["collapseSidebars", "Collapse the right sidebar", "Keep the learning workspace visually focused."],
      ["showAiRecommendation", "Show scoped AI action", "Display AI buttons that always include explicit curriculum context."]
    ];
    for (const [key, name, description] of toggles) {
      new import_obsidian4.Setting(root).setName(name).setDesc(description).addToggle(
        (toggle) => toggle.setValue(this.plugin.settings[key]).onChange(
          async (value) => {
            this.plugin.settings[key] = value;
            await this.plugin.saveData(this.plugin.settings);
          }
        )
      );
    }
    new import_obsidian4.Setting(root).setName("Python interpreter").setDesc("Leave blank to auto-detect: the project virtual environment, then the system Python.").addText((text) => text.setValue(this.plugin.settings.pythonPath || "").onChange(async (value) => {
      this.plugin.settings.pythonPath = value.trim();
      await this.plugin.saveData(this.plugin.settings);
    }));
    new import_obsidian4.Setting(root).setName("Validate and rebuild").setDesc("Run the canonical core projection pipeline.").addButton(
      (control) => control.setButtonText("Rebuild").setCta().onClick(() => this.plugin.generate())
    );
    new import_obsidian4.Setting(root).setName("Diagnostics").setDesc("Contract versions, projection freshness, interpreter.").addButton(
      (control) => control.setButtonText("Open").onClick(() => this.plugin.openDiagnostics())
    );
    root.createEl("h3", { text: "About LearningOS" });
    root.createEl("p", { cls: "los-muted", text: OWNERSHIP_STATEMENT });
  }
};
var SessionEndModal = class extends import_obsidian4.Modal {
  plugin;
  review;
  constructor(app, plugin, review) {
    super(app);
    this.plugin = plugin;
    this.review = review;
  }
  onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-session-modal");
    pageHeader(
      root,
      "Explicit Git closure",
      "End learning session",
      "Only files recorded by guarded learning actions can be staged. Unrelated changes remain untouched."
    );
    const owned = section(root, "Session-owned changes");
    if (!(this.review.owned_changes || []).length) empty(owned, "No owned changes", "There is nothing to commit from this session.");
    for (const file of this.review.owned_changes || []) owned.createEl("code", { text: file });
    const unrelated = section(root, "Unrelated changes (excluded)");
    if (!(this.review.unrelated_changes || []).length) unrelated.createEl("p", { text: "None." });
    for (const file of this.review.unrelated_changes || []) unrelated.createEl("code", { text: file });
    const message = root.createEl("input", {
      cls: "los-search",
      attr: { type: "text", placeholder: "Commit message", "aria-label": "Learning session commit message" }
    });
    const pushRow = root.createDiv({ cls: "los-row" });
    const push = pushRow.createEl("input", { attr: { type: "checkbox", "aria-label": "Push after commit" } });
    pushRow.createSpan({ text: "Push after the scoped commit succeeds" });
    const actions = root.createDiv({ cls: "los-actions" });
    button(actions, "Commit session-owned files", async () => {
      if (!message.value.trim()) {
        new import_obsidian4.Notice("Enter a commit message first.");
        return;
      }
      try {
        const result = asSessionReview(
          await this.plugin.gateway.endSession(message.value.trim(), Boolean(push.checked))
        );
        new import_obsidian4.Notice(result.pushed ? "Learning session committed and pushed." : "Learning session committed.");
        this.close();
      } catch (error) {
        new import_obsidian4.Notice(errorMessage2(error));
      }
    }, "cta");
    button(actions, "Close without committing", () => this.close(), "quiet");
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/views/atlas-view.ts
var import_obsidian5 = require("obsidian");
var ATLAS_ROLE_ORDER = [
  "crosswalk",
  "reference",
  "synthesis",
  "exercise-bank",
  "mock-exam"
];
function projectedString(value) {
  return typeof value === "string" && value ? value : null;
}
function projectedLabel(record) {
  return projectedString(record.title) ?? projectedString(record.id) ?? "Untitled";
}
function projectedListLength(value) {
  return Array.isArray(value) ? value.length : 0;
}
function projectedMetadata(values) {
  return values.filter(
    (value) => typeof value === "string" || typeof value === "number"
  ).map(String).filter(Boolean).join(" \xB7 ");
}
var AtlasView = class extends import_obsidian5.ItemView {
  plugin;
  domain = null;
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_ATLAS;
  }
  getDisplayText() {
    return "LearningOS \xB7 Domain atlas";
  }
  getIcon() {
    return "map";
  }
  async setState(state = {}) {
    if (typeof state.domain === "string" || state.domain === null) {
      this.domain = state.domain;
    }
    this.render();
  }
  getState() {
    return {
      domain: this.domain
    };
  }
  async onOpen() {
    const domain = this.leaf.state?.domain;
    this.domain = typeof domain === "string" ? domain : null;
    this.render();
  }
  atlas() {
    const domains = /* @__PURE__ */ new Map();
    const bucket = (name) => {
      const key = String(
        name || "cross-domain"
      );
      const existing = domains.get(key);
      if (existing) {
        return existing;
      }
      const created = {
        name: key,
        notes: [],
        shelves: []
      };
      domains.set(
        key,
        created
      );
      return created;
    };
    for (const note of this.plugin.store.of("note")) {
      bucket(note.domain).notes.push(note);
    }
    for (const shelf of this.plugin.store.of("collection")) {
      bucket(shelf.domain).shelves.push(shelf);
    }
    return [...domains.values()].sort(
      (left, right) => right.notes.length - left.notes.length || left.name.localeCompare(right.name)
    );
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass(
      "los-root",
      "los-atlas-view"
    );
    if (!this.plugin.store.ready) {
      pageHeader(
        root,
        "Reach",
        "Domain atlas unavailable"
      );
      empty(
        root,
        "The interface contract could not be loaded",
        this.plugin.store.error,
        "Rebuild views",
        () => this.plugin.generate()
      );
      return;
    }
    pageHeader(
      root,
      "Reach",
      "Domain atlas",
      "Every domain\u2019s notes, wiring hubs and shelves \u2014 so a question standing in one module can be answered by another domain\u2019s shelf."
    );
    const domains = this.atlas();
    if (!domains.length) {
      empty(
        root,
        "Nothing mapped yet",
        "No notes or shelves are registered."
      );
      return;
    }
    if (!this.domain || !domains.some(
      (row) => row.name === this.domain
    )) {
      this.domain = domains[0]?.name ?? null;
    }
    const glance = root.createDiv({
      cls: "los-atlas-glance"
    });
    for (const domain of domains) {
      const entries = domain.shelves.reduce(
        (total, shelf) => total + projectedListLength(
          shelf.entries
        ),
        0
      );
      const crosswalks = domain.notes.filter(
        (note) => note.role === "crosswalk"
      ).length;
      const selected = domain.name === this.domain;
      const tile = glance.createEl(
        "button",
        {
          cls: `los-atlas-tile is-clickable ${selected ? "is-selected" : ""}`,
          attr: {
            type: "button",
            "aria-pressed": String(selected)
          }
        }
      );
      tile.createSpan({
        cls: "los-atlas-tile-name",
        text: domain.name
      });
      const plural = (count, noun) => `${count} ${noun}${count === 1 ? "" : "s"}`;
      const summaryParts = [
        plural(
          domain.notes.length,
          "note"
        ),
        crosswalks ? plural(
          crosswalks,
          "crosswalk"
        ) : "",
        `${plural(
          domain.shelves.length,
          "shelf"
        ).replace(
          "shelfs",
          "shelves"
        )} (${entries})`
      ].filter(
        (part) => Boolean(part)
      );
      tile.createSpan({
        cls: "los-micro",
        text: summaryParts.join(" \xB7 ")
      });
      tile.addEventListener(
        "click",
        () => {
          this.domain = domain.name;
          this.render();
        }
      );
    }
    const current = domains.find(
      (row) => row.name === this.domain
    );
    const body = root.createDiv({
      cls: "los-atlas-body"
    });
    this.renderDomain(
      body,
      current
    );
    this.renderBoundaries(root);
  }
  noteRow(parent, note) {
    const row = parent.createEl(
      "button",
      {
        cls: "los-item is-clickable",
        attr: {
          type: "button"
        }
      }
    );
    icon(
      row.createSpan(),
      ICONS.note
    );
    const copy = row.createSpan({
      cls: "los-item-copy"
    });
    copy.createSpan({
      text: projectedLabel(note)
    });
    const metadata = projectedMetadata([
      note.role,
      note.state,
      note.id
    ]);
    if (metadata) {
      copy.createSpan({
        cls: "los-micro",
        text: metadata
      });
    }
    const path = projectedString(note.path);
    row.addEventListener(
      "click",
      () => {
        if (path) {
          void this.plugin.openAuthoredPath(
            path
          );
        }
      }
    );
    return row;
  }
  renderDomain(parent, domain) {
    if (!domain) {
      return;
    }
    const header = parent.createDiv({
      cls: "los-atlas-domain-head"
    });
    header.createEl("h2", {
      text: domain.name
    });
    const actions = header.createDiv({
      cls: "los-actions"
    });
    button(
      actions,
      "Browse these notes in the Library",
      () => this.plugin.openLibraryFiltered(
        "note",
        domain.name
      ),
      "quiet"
    );
    const crosswalks = domain.notes.filter(
      (note) => note.role === "crosswalk"
    );
    if (crosswalks.length) {
      const wrap = section(
        parent,
        `Wiring hubs (${crosswalks.length})`,
        "Crosswalks carry the narrative that joins this domain\u2019s sources and concepts \u2014 read one before opening a shelf."
      );
      for (const note of crosswalks) {
        this.noteRow(
          wrap,
          note
        );
      }
    }
    const byRole = /* @__PURE__ */ new Map();
    for (const note of domain.notes) {
      const role = String(
        note.role || "synthesis"
      );
      const existingRows = byRole.get(role);
      if (existingRows) {
        existingRows.push(note);
      } else {
        byRole.set(
          role,
          [note]
        );
      }
    }
    const roles = [
      ...byRole.keys()
    ].sort(
      (left, right) => {
        const rank = (role) => ATLAS_ROLE_ORDER.indexOf(role) + 1 || 99;
        return rank(left) - rank(right) || left.localeCompare(right);
      }
    );
    if (domain.notes.length) {
      const notesWrap = section(
        parent,
        `Notes (${domain.notes.length})`,
        "Grouped by role. Opening a row opens the note itself."
      );
      for (const role of roles) {
        const roleRows = byRole.get(role) ?? [];
        const rows = roleRows.slice().sort(
          (left, right) => projectedLabel(left).localeCompare(
            projectedLabel(right)
          )
        );
        const group = notesWrap.createEl(
          "details",
          {
            cls: "los-atlas-group"
          }
        );
        if (role !== "crosswalk" && rows.length <= 12) {
          group.setAttr(
            "open",
            "open"
          );
        }
        group.createEl(
          "summary",
          {
            text: `${role} (${rows.length})`
          }
        );
        for (const note of rows) {
          this.noteRow(
            group,
            note
          );
        }
      }
    } else {
      empty(
        parent,
        "No notes in this domain yet",
        "Sources here surface only through concept links and shelves."
      );
    }
    const shelvesWrap = section(
      parent,
      `Shelves (${domain.shelves.length})`,
      "Curated reading lists. The blurb is the shelf\u2019s own rule for using it."
    );
    if (!domain.shelves.length) {
      empty(
        shelvesWrap,
        "No shelves yet",
        "Nothing curated for this domain \u2014 the registry still holds its sources."
      );
    }
    const shelves = domain.shelves.slice().sort(
      (left, right) => projectedLabel(left).localeCompare(
        projectedLabel(right)
      )
    );
    for (const shelf of shelves) {
      const card = shelvesWrap.createDiv({
        cls: "los-shelf-entry"
      });
      const head = card.createEl(
        "button",
        {
          cls: "los-shelf-entry-title is-clickable",
          attr: {
            type: "button"
          }
        }
      );
      icon(
        head.createSpan(),
        "library"
      );
      head.createSpan({
        text: `${projectedLabel(shelf)} (${projectedListLength(
          shelf.entries
        )})`
      });
      const shelfId = projectedString(shelf.id);
      head.addEventListener(
        "click",
        () => {
          if (shelfId) {
            void this.plugin.openLibrary(
              shelfId,
              "collection"
            );
          }
        }
      );
      const summary = projectedString(shelf.summary);
      if (summary) {
        card.createDiv({
          cls: "los-shelf-why",
          text: projectedExcerpt(
            summary,
            320
          )
        });
      }
    }
  }
  renderBoundaries(root) {
    const boundaries = this.plugin.store.rows(
      "quarantine_boundaries"
    );
    const wrap = section(
      root,
      "Outside this map by policy",
      "Named so their absence is visible; their content is never loaded, indexed, or searched."
    );
    if (!boundaries.length) {
      empty(
        wrap,
        "No boundary records",
        "Nothing is currently quarantined in the projection."
      );
    }
    for (const boundary of boundaries) {
      const card = wrap.createDiv({
        cls: "los-boundary-row"
      });
      card.createDiv({
        cls: "los-item-copy",
        text: projectedLabel(boundary)
      });
      const description = projectedString(
        boundary.description
      ) ?? "";
      const policy = boundaryPolicy(description);
      if (policy) {
        card.createDiv({
          cls: "los-micro",
          text: policy
        });
      }
    }
    button(
      wrap,
      "Open the generated atlas file",
      () => this.plugin.openVaultPath(
        "generated/domain-atlas.md"
      ),
      "quiet"
    );
  }
};

// src/views/boundary-view.ts
var import_obsidian6 = require("obsidian");
var BoundaryView = class extends import_obsidian6.ItemView {
  plugin;
  boundaryId = null;
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_BOUNDARY;
  }
  getDisplayText() {
    return "LearningOS \xB7 Boundary";
  }
  async setState(state = {}) {
    if (typeof state.boundaryId === "string") {
      this.boundaryId = state.boundaryId;
    }
    this.render();
  }
  getState() {
    return { boundaryId: this.boundaryId };
  }
  async onOpen() {
    const boundaryId = this.leaf.state?.boundaryId;
    if (typeof boundaryId === "string") {
      this.boundaryId = boundaryId;
    }
    this.render();
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-boundary-view");
    const boundary = (this.plugin.store.data?.quarantine_boundaries || []).find(
      (row) => row.id === this.boundaryId
    );
    if (!boundary) {
      empty(root, "Boundary unavailable", "No quarantined content was loaded.");
      return;
    }
    pageHeader(root, "Deliberate boundary", boundary.title, boundaryPolicy(boundary.description));
    const guard = section(root, "What this means");
    if (boundary.id === "program-job-boundary") {
      guard.createEl("p", { text: "Job content is not indexed, searched, read, or mixed into LearningOS. Access requires a separate, explicit request." });
      button(guard, "Request explicit Job access", () => new import_obsidian6.Notice("Job access remains outside LearningOS. Ask Codex explicitly when needed."), "quiet");
    } else {
      guard.createEl("p", { text: "Master\u2019s planning is quarantined from current Bachelor\u2019s work and all default search. This surface exposes only the boundary record." });
      button(guard, "Open Master\u2019s Planning boundary", () => new import_obsidian6.Notice("Open the quarantined folder manually only for a deliberate planning session."), "quiet");
    }
  }
};

// src/views/garden-view.ts
var import_obsidian8 = require("obsidian");

// src/features/ai-actions/action-button.ts
var import_obsidian7 = require("obsidian");
function errorMessage3(error) {
  return error instanceof Error ? error.message : String(error);
}
function renderGardenShelveAction(parent, plugin, target, onChanged = null) {
  const wrap = parent.createDiv({ cls: "los-ai-action-row" });
  const providers = plugin.aiActions.providers();
  const available = providers.filter(
    (row) => Boolean(row.available)
  );
  let provider = available.some(
    (row) => row.id === plugin.settings.preferredAiProvider
  ) ? plugin.settings.preferredAiProvider : available[0]?.id || "manual-bundle";
  let jobConfirmed = !target.job_derived;
  const select = wrap.createEl("select", {
    cls: "los-ai-provider",
    attr: { "aria-label": `AI provider for ${target.title}` }
  });
  for (const row of providers) {
    const option = select.createEl("option", {
      text: row.available ? row.id : `${row.id} (unavailable)`,
      attr: { value: row.id }
    });
    option.value = row.id;
    if (!row.available) option.setAttr("disabled", "disabled");
  }
  select.value = provider;
  select.addEventListener("change", () => {
    provider = select.value;
    plugin.settings.preferredAiProvider = provider;
    plugin.scheduleDraftSave();
  });
  if (target.job_derived) {
    const consent = wrap.createEl("label", { cls: "los-ai-consent" });
    const checkbox = consent.createEl("input", { attr: { type: "checkbox" } });
    consent.createSpan({ text: "Confirm this exported item may leave the Job boundary" });
    checkbox.addEventListener("change", () => {
      jobConfirmed = Boolean(checkbox.checked);
    });
  }
  const launch = button(wrap, "Shelve with AI", async () => {
    if (target.job_derived && !jobConfirmed) {
      new import_obsidian7.Notice("Explicit export confirmation is required for job-derived material.");
      return;
    }
    launch.setAttr("disabled", "disabled");
    launch.setText("Preparing\u2026");
    try {
      const result = await plugin.aiActions.prepareGardenShelving(
        target.id,
        provider,
        jobConfirmed
      );
      const bundlePath = result.bundle_path || result.request?.bundle_path;
      new import_obsidian7.Notice(bundlePath ? `AI request prepared: ${bundlePath}` : "AI request prepared.");
      onChanged?.(result);
    } catch (error) {
      new import_obsidian7.Notice(errorMessage3(error));
      launch.removeAttribute?.("disabled");
      launch.setText("Shelve with AI");
    }
  }, "quiet");
  launch.addClass("los-ai-action-button");
  if (!available.length) launch.setAttr("disabled", "disabled");
  return wrap;
}

// src/views/garden-view.ts
function errorMessage4(error) {
  return error instanceof Error ? error.message : String(error);
}
var GardenView = class extends import_obsidian8.ItemView {
  plugin;
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_GARDEN;
  }
  getDisplayText() {
    return "LearningOS \xB7 Garden";
  }
  getIcon() {
    return "sprout";
  }
  async onOpen() {
    this.render();
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-garden-view");
    if (!this.plugin.store.ready) {
      pageHeader(root, "Review", "Garden unavailable");
      empty(
        root,
        "The interface contract could not be loaded",
        this.plugin.store.error,
        "Rebuild views",
        () => this.plugin.generate()
      );
      return;
    }
    pageHeader(
      root,
      "Review",
      "Garden",
      "Seeds remain human-owned. \u201CShelve with AI\u201D prepares a bounded request bundle; nothing changes until an approved delivery is applied."
    );
    const toolbar = root.createDiv({ cls: "los-actions" });
    button(toolbar, "Open Garden base", () => this.plugin.openVaultPath("bases/garden.base"), "quiet");
    button(toolbar, "Refresh projection", () => this.plugin.generate(), "quiet");
    const entries = this.plugin.store.gardenEntries();
    if (!entries.length) {
      empty(root, "No Garden seeds", "Create a Markdown seed under knowledge/garden/.");
      return;
    }
    const list = root.createDiv({ cls: "los-garden-list" });
    for (const target of entries) this.card(list, target);
  }
  card(parent, target) {
    const card = parent.createDiv({ cls: `los-card los-garden-card los-garden-${target.state || "seed"}` });
    const top = card.createDiv({ cls: "los-card-top" });
    top.createEl("h2", { text: target.title || target.id });
    badge(top, target.state || "seed", target.state || "seed");
    card.createDiv({ cls: "los-micro", text: target.path });
    if (target.tags?.length) {
      const tags = card.createDiv({ cls: "los-garden-tags" });
      for (const tag of target.tags) badge(tags, `#${tag}`, "role");
    }
    const latest = this.plugin.store.latestAiRequest(target.id);
    if (latest) {
      const status = card.createDiv({ cls: "los-ai-request-status" });
      status.createEl("strong", { text: `AI request \xB7 ${latest.status}` });
      status.createDiv({ cls: "los-micro", text: `${latest.provider || "manual-bundle"} \xB7 ${latest.id}` });
      if (latest.bundle_path) status.createDiv({ cls: "los-micro", text: latest.bundle_path });
      const statusActions = status.createDiv({ cls: "los-actions" });
      if (latest.bundle_path) button(statusActions, "Copy bundle path", () => this.plugin.copyText(latest.bundle_path), "quiet");
      if (latest.delivery_id && latest.status !== "applied") {
        button(statusActions, "Apply approved delivery", async () => {
          try {
            await this.plugin.aiActions.applyApprovedDelivery(latest.delivery_id);
            new import_obsidian8.Notice("Approved AI delivery applied and projection refreshed.");
            this.render();
          } catch (error) {
            new import_obsidian8.Notice(errorMessage4(error));
          }
        }, "cta");
      }
      if (latest.receipt_id) badge(status, `receipt ${latest.receipt_id}`, "complete");
    }
    const actions = card.createDiv({ cls: "los-garden-actions" });
    button(actions, "Open original", () => this.plugin.openVaultPath(target.path), "quiet");
    if (target.transcription_path) {
      button(actions, "Open AI transcription", () => this.plugin.openVaultPath(target.transcription_path), "quiet");
    }
    renderGardenShelveAction(actions, this.plugin, target, () => this.render());
    return card;
  }
};

// src/views/home-view.ts
var import_obsidian9 = require("obsidian");
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function projectedString2(value) {
  return typeof value === "string" && value ? value : null;
}
function projectedText(value) {
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value);
    return text ? text : null;
  }
  return null;
}
function projectedLabel2(record) {
  return projectedString2(record.title) ?? projectedString2(record.label) ?? projectedString2(record.id) ?? "Untitled";
}
function projectedRecords(value) {
  return Array.isArray(value) ? value.filter(
    (candidate) => isRecord3(candidate)
  ) : [];
}
function projectedStrings(value) {
  return Array.isArray(value) ? value.filter(
    (candidate) => typeof candidate === "string"
  ) : [];
}
function projectedCount(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
function readResumePointer(value) {
  if (!isRecord3(value)) {
    return {};
  }
  return {
    unit_id: projectedString2(value.unit_id) ?? void 0,
    study_map_id: projectedString2(value.study_map_id) ?? void 0,
    stage_id: projectedString2(value.stage_id) ?? void 0,
    module_id: projectedString2(value.module_id) ?? void 0
  };
}
function firstProjectedModuleId(value) {
  for (const candidate of projectedRecords(value)) {
    const moduleId = projectedString2(candidate.module_id);
    if (moduleId) {
      return moduleId;
    }
  }
  return null;
}
var HomeView = class extends import_obsidian9.ItemView {
  plugin;
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_HOME;
  }
  getDisplayText() {
    return "LearningOS \xB7 Home";
  }
  getIcon() {
    return "home";
  }
  async onOpen() {
    this.render();
  }
  greeting() {
    const hour = (/* @__PURE__ */ new Date()).getHours();
    if (hour < 12) {
      return "Good morning";
    }
    if (hour < 18) {
      return "Good afternoon";
    }
    return "Good evening";
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass(
      "los-root",
      "los-home"
    );
    if (!this.plugin.store.ready) {
      pageHeader(
        root,
        "LearningOS",
        "Projection unavailable"
      );
      empty(
        root,
        "The interface contract could not be loaded",
        this.plugin.store.error,
        "Rebuild views",
        () => this.plugin.generate()
      );
      return;
    }
    const header = pageHeader(
      root,
      "Home",
      this.greeting(),
      "Resume what matters without rebuilding the context first."
    );
    header.addClass("los-home-header");
    const actions = header.createDiv({
      cls: "los-actions los-home-header-actions"
    });
    button(
      actions,
      "Capture",
      () => this.plugin.openCapture(),
      "quiet"
    );
    const search = button(
      actions,
      "Search",
      () => this.plugin.openGlobalSearch(),
      "quiet"
    );
    search.setAttribute(
      "aria-label",
      "Search LearningOS"
    );
    this.renderContinue(root);
    this.renderToday(root);
    this.renderElsewhere(root);
  }
  /** The one filled action on Home. */
  renderContinue(root) {
    const pointer = readResumePointer(
      this.plugin.store.data?.resume_pointer
    );
    const unit = pointer.unit_id ? this.plugin.store.get(pointer.unit_id) : null;
    const map = pointer.study_map_id ? this.plugin.store.get(
      pointer.study_map_id
    ) : null;
    const stage = pointer.stage_id ? this.plugin.store.stage(
      pointer.stage_id
    ) : null;
    const wrap = root.createDiv({
      cls: "los-continue"
    });
    if (!unit || !stage || !pointer.unit_id || !pointer.stage_id) {
      empty(
        wrap,
        "Nothing to resume yet",
        "Open Learn and choose a module or project.",
        "Open Learn",
        () => this.plugin.openLearn()
      );
      return;
    }
    wrap.createDiv({
      cls: "los-kicker",
      text: "Continue learning"
    });
    const body = wrap.createDiv({
      cls: "los-continue-body"
    });
    const copy = body.createDiv({
      cls: "los-continue-copy"
    });
    const unitModuleId = projectedString2(unit.module_id);
    const module2 = unitModuleId ? this.plugin.store.get(unitModuleId) : null;
    copy.createDiv({
      cls: "los-continue-module",
      text: `${module2 ? projectedLabel2(module2) : unitModuleId ?? "Unknown module"} \xB7 ${projectedLabel2(unit)}`
    });
    copy.createEl("h2", {
      text: projectedLabel2(stage)
    });
    const stages = projectedRecords(map?.stages);
    const position = stages.findIndex(
      (row) => projectedString2(row.id) === pointer.stage_id
    );
    const meta = copy.createDiv({
      cls: "los-continue-meta"
    });
    if (stages.length) {
      meta.createSpan({
        text: `Stage ${position >= 0 ? position + 1 : 1} of ${stages.length}`
      });
    }
    const estimate = projectedText(
      stage.estimate_minutes
    );
    if (estimate) {
      meta.createSpan({
        text: `${estimate} min planned`
      });
    }
    copy.createDiv({
      cls: "los-continue-context",
      text: "Your selected stage, exact resources, and open working state are kept together."
    });
    const actions = body.createDiv({
      cls: "los-actions"
    });
    button(
      actions,
      "Continue session",
      () => this.plugin.openUnit(
        pointer.unit_id,
        pointer.stage_id
      ),
      "cta"
    );
  }
  renderToday(root) {
    const sectionEl = section(
      root,
      "Today",
      "Only items likely to affect the next decision."
    );
    const items = [];
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const upcoming = this.plugin.store.rows("academic_deadlines").filter(
      (row) => {
        const boundary = projectedString2(row.end_date) ?? projectedString2(
          row.start_date
        ) ?? "";
        return boundary >= today;
      }
    ).sort(
      (left, right) => {
        const leftDate = projectedString2(
          left.start_date
        ) ?? projectedString2(
          left.end_date
        ) ?? "";
        const rightDate = projectedString2(
          right.start_date
        ) ?? projectedString2(
          right.end_date
        ) ?? "";
        return leftDate.localeCompare(
          rightDate
        );
      }
    );
    for (const deadline of upcoming.slice(0, 2)) {
      const moduleId = projectedString2(deadline.module_id) ?? firstProjectedModuleId(
        deadline.modules
      );
      const kind = projectedString2(deadline.kind);
      const label = projectedString2(deadline.label);
      const title = kind === "registration-window" ? label ?? projectedLabel2(deadline) : projectedString2(deadline.title) ?? label ?? projectedLabel2(deadline);
      const startDate = projectedString2(deadline.start_date);
      const endDate = projectedString2(deadline.end_date);
      const date = endDate && startDate && endDate !== startDate ? `${startDate} \u2192 ${endDate}` : startDate ?? endDate ?? "Date pending";
      const registrationState = projectedString2(
        deadline.registration_state
      );
      const registrationDetail = registrationState && registrationState !== "registered" ? ` \xB7 ${registrationState}` : "";
      items.push({
        title,
        detail: `${date}${registrationDetail}`,
        actionLabel: moduleId ? "Open module" : "",
        action: moduleId ? () => this.plugin.openModule(
          moduleId
        ) : null
      });
    }
    const inbox = projectedCount(
      this.plugin.store.data?.counts?.inbox_items
    );
    const shelving = this.plugin.store.units().filter(
      (row) => projectedString2(row.status) === "ready-to-shelve"
    ).length;
    const needsMap = this.plugin.store.units().filter(
      (row) => {
        const unitId = projectedString2(row.id);
        return Boolean(unitId) && !this.plugin.store.mapForUnit(
          unitId
        );
      }
    ).length;
    const reviewCount = inbox + shelving + needsMap;
    if (reviewCount) {
      const details = [];
      if (inbox) {
        details.push(`${inbox} inbox`);
      }
      if (shelving) {
        details.push(
          `${shelving} ready to shelve`
        );
      }
      if (needsMap) {
        details.push(
          `${needsMap} without a map`
        );
      }
      items.push({
        title: `${reviewCount} decision${reviewCount === 1 ? "" : "s"} waiting`,
        detail: details.join(" \xB7 "),
        actionLabel: "Open review",
        action: () => this.plugin.openReview()
      });
    }
    const garden = this.plugin.store.gardenEntries()[0];
    if (garden) {
      items.push({
        title: projectedLabel2(garden),
        detail: "Recent Garden capture",
        actionLabel: "Open Garden",
        action: () => this.plugin.openGarden()
      });
    }
    if (!items.length) {
      empty(
        sectionEl,
        "Nothing time-sensitive",
        "Continue the active learning session when you are ready."
      );
      return;
    }
    const list = sectionEl.createDiv({
      cls: "los-home-list"
    });
    for (const item of items.slice(0, 4)) {
      this.renderHomeRow(
        list,
        item
      );
    }
  }
  renderElsewhere(root) {
    const sectionEl = section(
      root,
      "Continue elsewhere",
      "Other active modules and projects, kept secondary to the current session."
    );
    const pointer = readResumePointer(
      this.plugin.store.data?.resume_pointer
    );
    const rows = [];
    for (const record of this.plugin.store.modules()) {
      const recordId = projectedString2(record.id);
      if (!recordId || recordId === pointer.module_id) {
        continue;
      }
      const status = projectedString2(record.status);
      if (status && ["complete", "archived"].includes(status)) {
        continue;
      }
      rows.push({
        record,
        type: projectedString2(record.kind) === "skill" ? "Skill" : "Module",
        open: () => this.plugin.openModule(
          recordId
        )
      });
    }
    for (const record of this.plugin.store.projects()) {
      const recordId = projectedString2(record.id);
      if (!recordId) {
        continue;
      }
      const status = projectedString2(record.status);
      if (status && ["completed", "archived"].includes(status)) {
        continue;
      }
      rows.push({
        record,
        type: "Project",
        open: () => this.plugin.openProject(
          recordId
        )
      });
    }
    const visibleRows = rows.slice(0, 5);
    if (!visibleRows.length) {
      empty(
        sectionEl,
        "No other active work",
        "New modules and projects will appear here when projected."
      );
      return;
    }
    const list = sectionEl.createDiv({
      cls: "los-home-list"
    });
    for (const row of visibleRows) {
      const nextAction = row.type === "Project" ? "" : this.moduleNextAction(
        row.record
      );
      this.renderHomeRow(
        list,
        {
          title: projectedLabel2(
            row.record
          ),
          detail: `${row.type}${nextAction ? ` \xB7 ${nextAction}` : ""}`,
          actionLabel: "Open",
          action: row.open
        }
      );
    }
  }
  renderHomeRow(parent, item) {
    const row = parent.createDiv({
      cls: "los-home-row"
    });
    const copy = row.createDiv({
      cls: "los-home-row-copy"
    });
    copy.createEl("strong", {
      text: item.title
    });
    if (item.detail) {
      copy.createDiv({
        cls: "los-micro",
        text: item.detail
      });
    }
    if (item.actionLabel && item.action) {
      button(
        row,
        item.actionLabel,
        item.action,
        "tertiary"
      );
    }
    return row;
  }
  nextWorkspaceDate(workspace) {
    const directDeadline = projectedString2(workspace.deadline);
    if (directDeadline) {
      return directDeadline;
    }
    const moduleIds = new Set(
      projectedStrings(
        workspace.module_ids
      )
    );
    const dates = [];
    for (const row of this.plugin.store.rows(
      "academic_deadlines"
    )) {
      const kind = projectedString2(row.kind);
      const moduleId = projectedString2(row.module_id);
      const startDate = projectedString2(row.start_date);
      if (kind === "exam" && moduleId && startDate && moduleIds.has(moduleId)) {
        dates.push(startDate);
      }
      if (kind === "registration-window" && startDate && projectedRecords(
        row.modules
      ).some(
        (module2) => {
          const nestedModuleId = projectedString2(
            module2.module_id
          );
          return Boolean(nestedModuleId) && moduleIds.has(
            nestedModuleId
          );
        }
      )) {
        dates.push(startDate);
      }
    }
    return dates.sort()[0] ?? "9999";
  }
  moduleNextAction(module2) {
    const moduleId = projectedString2(module2.id);
    if (!moduleId) {
      return "";
    }
    const workspace = this.plugin.store.of("workspace").filter(
      (row) => {
        const status = projectedString2(row.status);
        return row.archived !== true && status !== "complete" && projectedStrings(
          row.module_ids
        ).includes(moduleId);
      }
    ).sort(
      (left, right) => this.nextWorkspaceDate(left).localeCompare(
        this.nextWorkspaceDate(
          right
        )
      )
    )[0];
    if (workspace?.next_action) {
      return projectedExcerpt(
        workspace.next_action,
        100
      );
    }
    for (const unit of this.plugin.store.unitsFor(moduleId)) {
      const unitId = projectedString2(unit.id);
      if (!unitId) {
        continue;
      }
      const map = this.plugin.store.mapForUnit(
        unitId
      );
      if (!map) {
        continue;
      }
      const stages = projectedRecords(map.stages);
      const currentStageId = projectedString2(
        map.current_stage
      );
      const stage = (currentStageId ? stages.find(
        (row) => projectedString2(row.id) === currentStageId
      ) : void 0) ?? stages.find(
        (row) => projectedString2(row.status) === "active"
      ) ?? stages.find(
        (row) => projectedString2(row.status) !== "complete"
      );
      const stageTitle = stage ? projectedString2(stage.title) : null;
      if (stageTitle) {
        return stageTitle;
      }
    }
    return "";
  }
};

// src/views/library-view.ts
var import_obsidian10 = require("obsidian");
var SOURCE_FACETS = [
  ["all", "All"],
  ["local", "Local copy"],
  ["online", "Online"],
  ["in-unit", "Used in a unit"]
];
var LIBRARY_COLLECTIONS2 = [
  ["sources", "Learning Sources"],
  ["topic-packs", "Topic Packs"]
];
var RELATED_LABELS = {
  unit: "Used in units",
  concept: "Connected concepts",
  note: "Referenced by notes",
  source: "Related sources",
  collection: "In catalogues",
  "topic-pack": "In Topic Packs",
  module: "Modules",
  workspace: "Workspaces",
  program: "Areas"
};
function isRecord4(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function projectedString3(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}
function projectedText2(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  const text = String(value);
  return text.length > 0 ? text : null;
}
function projectedFlag(value) {
  return value === true || value === 1 || value === "true";
}
function projectedStrings2(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (candidate) => typeof candidate === "string" && candidate.length > 0
  );
}
function isLibraryScreen(value) {
  return value === "home" || value === "group" || value === "source-detail" || value === "topic-pack-detail" || value === "catalogue-detail" || value === "legacy-list";
}
function isLibraryCollection2(value) {
  return value === "sources" || value === "topic-packs";
}
function isSourceFacet(value) {
  return SOURCE_FACETS.some(
    ([facet]) => facet === value
  );
}
function readLibraryViewState(value, currentCollection, currentRecordType) {
  if (!isRecord4(value)) {
    return {
      screen: "home",
      collection: currentCollection,
      groupId: null,
      query: "",
      facet: "all",
      resourceId: null,
      topicPackId: null,
      catalogueId: null,
      recordType: currentRecordType,
      domain: ""
    };
  }
  const recordId = projectedString3(value.recordId);
  const screen = isLibraryScreen(
    value.screen
  ) ? value.screen : recordId ? "legacy-list" : "home";
  const collection = isLibraryCollection2(
    value.collection
  ) ? value.collection : currentCollection;
  const groupId = projectedString3(value.groupId) ?? projectedString3(value.fromGroupId);
  return {
    screen,
    collection,
    groupId,
    query: projectedString3(value.query) ?? "",
    facet: isSourceFacet(value.facet) ? value.facet : "all",
    resourceId: projectedString3(value.resourceId),
    topicPackId: projectedString3(value.topicPackId),
    catalogueId: projectedString3(value.catalogueId),
    recordType: projectedString3(value.recordType) ?? currentRecordType,
    domain: projectedString3(value.domain) ?? ""
  };
}
function readThematicGroup(value) {
  if (!isRecord4(value)) {
    return null;
  }
  const id = projectedString3(value.id);
  if (!id) {
    return null;
  }
  return {
    id,
    title: projectedString3(value.title) ?? id,
    description: projectedText2(value.description) ?? ""
  };
}
function readCollectionEntry(value) {
  if (!isRecord4(value)) {
    return null;
  }
  const sourceId = projectedString3(value.source);
  if (!sourceId) {
    return null;
  }
  return {
    sourceId,
    group: projectedText2(value.group),
    why: projectedText2(value.why)
  };
}
function readCollectionEntries(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(readCollectionEntry).filter(
    (entry) => entry !== null
  );
}
function readAttachment(value) {
  if (typeof value === "string") {
    if (!value.length) {
      return null;
    }
    return {
      path: value,
      label: value.split("/").pop() || value
    };
  }
  if (!isRecord4(value)) {
    return null;
  }
  const path = projectedString3(value.path) ?? projectedString3(value.vault_path);
  if (!path) {
    return null;
  }
  return {
    path,
    label: projectedText2(value.label) ?? path
  };
}
function readAttachments(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(readAttachment).filter(
    (attachment) => attachment !== null
  );
}
function readUsefulSection(value) {
  if (!isRecord4(value)) {
    return null;
  }
  const section3 = projectedText2(value.section);
  if (!section3) {
    return null;
  }
  return {
    section: section3,
    note: projectedText2(value.note)
  };
}
function readEvaluation(value) {
  if (!isRecord4(value)) {
    return null;
  }
  const verdict = projectedText2(value.verdict);
  const scope = projectedText2(value.scope);
  const readingPlan = projectedStrings2(value.reading_plan);
  const usefulSections = Array.isArray(
    value.useful_sections
  ) ? value.useful_sections.map(readUsefulSection).filter(
    (section3) => section3 !== null
  ) : [];
  if (!verdict && !scope && !readingPlan.length && !usefulSections.length) {
    return null;
  }
  return {
    verdict,
    scope,
    readingPlan,
    usefulSections
  };
}
function readEvaluations(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(readEvaluation).filter(
    (evaluation) => evaluation !== null
  );
}
function readLibraryRecord(value) {
  if (!isRecord4(value)) {
    return null;
  }
  const id = projectedString3(value.id);
  if (!id) {
    return null;
  }
  return {
    record: value,
    id,
    type: projectedString3(value.type) ?? "record",
    title: projectedText2(value.title) ?? id,
    summary: projectedText2(value.summary) ?? "",
    purpose: projectedText2(value.purpose) ?? "",
    sourceType: projectedText2(value.source_type) ?? "",
    year: projectedText2(value.year) ?? "",
    organization: projectedText2(value.organization) ?? "",
    materialExists: projectedFlag(value.material_exists),
    materialPath: projectedString3(value.material_path),
    url: projectedString3(value.url),
    path: projectedString3(value.path),
    role: projectedText2(value.role) ?? "",
    domain: projectedText2(value.domain) ?? "",
    state: projectedText2(value.state) ?? "",
    aliases: projectedStrings2(value.aliases),
    authors: projectedStrings2(value.authors),
    entries: readCollectionEntries(value.entries),
    attachments: readAttachments(value.attachments),
    evaluations: readEvaluations(value.evaluations)
  };
}
function readLibraryRecords(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(readLibraryRecord).filter(
    (record) => record !== null
  );
}
function readRelatedRecords(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const records = [];
  for (const candidate of value) {
    if (!isRecord4(candidate)) {
      continue;
    }
    const record = readLibraryRecord(candidate.rec);
    if (record) {
      records.push(record);
    }
  }
  return records;
}
var LibraryView = class extends import_obsidian10.ItemView {
  plugin;
  screen = "home";
  collection = "sources";
  groupId = null;
  query = "";
  facet = "all";
  resourceId = null;
  topicPackId = null;
  catalogueId = null;
  recordType = "note";
  domain = "";
  selectedElementId = null;
  _shelfIndex = null;
  _shelfSnapshot = null;
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_LIBRARY;
  }
  getDisplayText() {
    return "LearningOS \xB7 Library";
  }
  applyState(state = {}) {
    const parsed = readLibraryViewState(
      state,
      this.collection,
      this.recordType
    );
    this.screen = parsed.screen;
    this.collection = parsed.collection;
    this.groupId = parsed.groupId;
    this.query = parsed.query;
    this.facet = parsed.facet;
    this.resourceId = parsed.resourceId;
    this.topicPackId = parsed.topicPackId;
    this.catalogueId = parsed.catalogueId;
    this.recordType = parsed.recordType;
    this.domain = parsed.domain;
  }
  async setState(state = {}) {
    this.applyState(state);
    this.render();
  }
  getState() {
    return {
      screen: this.screen,
      collection: this.collection,
      groupId: this.groupId,
      query: this.query,
      facet: this.facet,
      resourceId: this.resourceId,
      topicPackId: this.topicPackId,
      catalogueId: this.catalogueId,
      recordType: this.recordType,
      domain: this.domain
    };
  }
  async onOpen() {
    this.applyState(
      this.leaf.state
    );
    this.render();
  }
  shelfIndex() {
    if (this._shelfIndex && this._shelfSnapshot === this.plugin.store.snapshotId) {
      return this._shelfIndex;
    }
    const index = /* @__PURE__ */ new Map();
    const shelves = readLibraryRecords([
      ...this.plugin.store.catalogues(),
      ...this.plugin.store.topicPacks()
    ]);
    for (const shelf of shelves) {
      for (const entry of shelf.entries) {
        const membership = {
          shelf,
          group: entry.group,
          why: entry.why
        };
        const current = index.get(entry.sourceId);
        if (current) {
          current.push(membership);
        } else {
          index.set(
            entry.sourceId,
            [membership]
          );
        }
      }
    }
    this._shelfIndex = index;
    this._shelfSnapshot = this.plugin.store.snapshotId;
    return index;
  }
  matchesSourceFacet(record) {
    const source = readLibraryRecord(record);
    if (!source) {
      return false;
    }
    if (this.facet === "all") {
      return true;
    }
    if (this.facet === "local") {
      return Boolean(
        source.materialExists || source.materialPath
      );
    }
    if (this.facet === "online") {
      return Boolean(source.url);
    }
    if (this.facet === "in-unit") {
      return this.plugin.store.useUnits(source.id).length > 0;
    }
    return true;
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass(
      "los-root",
      "los-library-view"
    );
    if (!this.plugin.store.ready) {
      pageHeader(
        root,
        "Library",
        "Projection unavailable"
      );
      empty(
        root,
        "The interface contract could not be loaded",
        this.plugin.store.error,
        "Rebuild views",
        () => this.plugin.generate()
      );
      return;
    }
    if (this.screen === "group") {
      this.renderGroup(root);
      return;
    }
    if (this.screen === "source-detail") {
      this.renderSourcePage(root);
      return;
    }
    if (this.screen === "topic-pack-detail") {
      this.renderTopicPackPage(root);
      return;
    }
    if (this.screen === "catalogue-detail") {
      this.renderCataloguePage(root);
      return;
    }
    if (this.screen === "legacy-list") {
      this.renderLegacyList(root);
      return;
    }
    this.renderHome(root);
  }
  renderHome(root) {
    pageHeader(
      root,
      "Library",
      "Choose a thematic group",
      this.collection === "topic-packs" ? "Topic Packs are narrow, purpose-built and manually ordered collections." : "Open a domain to browse its learning sources."
    );
    this.renderCollectionSwitch(root);
    const groups = this.plugin.store.thematicGroups().map(readThematicGroup).filter(
      (group) => group !== null
    );
    if (!groups.length) {
      empty(
        root,
        "No thematic groups",
        "Rebuild the projection after defining thematic-group metadata."
      );
      return;
    }
    const grid = root.createDiv({
      cls: "los-group-grid los-library-group-grid"
    });
    for (const group of groups) {
      const count = this.collection === "topic-packs" ? this.plugin.store.topicPacksForGroup(group.id).length : this.plugin.store.sourcesForGroup(group.id).length;
      const card = grid.createEl(
        "button",
        {
          cls: "los-group-card is-clickable",
          attr: {
            type: "button",
            "aria-label": `Open ${group.title}`
          }
        }
      );
      const head = card.createDiv({
        cls: "los-group-card-header"
      });
      head.createEl(
        "h2",
        {
          text: group.title
        }
      );
      const countLabel = this.collection === "topic-packs" ? `pack${count === 1 ? "" : "s"}` : `source${count === 1 ? "" : "s"}`;
      head.createSpan({
        cls: "los-group-count",
        text: `${count} ${countLabel}`
      });
      if (group.description) {
        card.createEl(
          "p",
          {
            text: group.description
          }
        );
      }
      card.createSpan({
        cls: "los-route-open",
        text: "Open \u2192"
      });
      card.addEventListener(
        "click",
        () => {
          this.selectedElementId = group.id;
          this.plugin.openLibraryGroup(
            this.collection,
            group.id
          );
        }
      );
    }
  }
  renderCollectionSwitch(root) {
    const switcher = root.createDiv({
      cls: "los-collection-switch",
      attr: {
        role: "tablist",
        "aria-label": "Library collection"
      }
    });
    for (const [
      id,
      label
    ] of LIBRARY_COLLECTIONS2) {
      const control = button(
        switcher,
        label,
        () => this.plugin.openLibraryHome(id),
        this.collection === id ? "cta" : "quiet"
      );
      control.setAttrs({
        role: "tab",
        "aria-selected": String(
          this.collection === id
        )
      });
    }
  }
  renderGroup(root) {
    const group = readThematicGroup(
      this.groupId ? this.plugin.store.get(
        this.groupId
      ) : null
    );
    const back = button(
      root,
      "\u2039 Library",
      () => this.plugin.back(),
      "quiet"
    );
    back.addClass("los-route-back");
    if (!group) {
      empty(
        root,
        "Thematic group unavailable",
        "Return to Library and choose another group.",
        "Back",
        () => this.plugin.back()
      );
      return;
    }
    const isPacks = this.collection === "topic-packs";
    pageHeader(
      root,
      isPacks ? "Topic Packs" : "Learning Sources",
      group.title,
      isPacks ? "Purpose-built collections in this thematic group." : "Learning sources in this thematic group."
    );
    const toolbar = root.createDiv({
      cls: "los-library-toolbar"
    });
    const input = toolbar.createEl(
      "input",
      {
        cls: "los-search los-route-search",
        attr: {
          type: "search",
          placeholder: `Search ${group.title} ${isPacks ? "topic packs" : "sources"}\u2026`,
          "aria-label": `Search ${group.title} ${isPacks ? "topic packs" : "sources"}`
        }
      }
    );
    input.value = this.query;
    input.addEventListener(
      "input",
      async () => {
        this.query = input.value;
        await this.rememberGroup();
        this.render();
      }
    );
    if (!isPacks) {
      this.renderSourceFacets(toolbar);
      button(
        toolbar,
        "Full-text / OCR search",
        () => this.plugin.openFullTextSearch(
          this.query
        ),
        "quiet"
      );
    }
    const rawRecords = isPacks ? this.plugin.store.topicPacksForGroup(group.id) : this.plugin.store.sourcesForGroup(group.id);
    const all = readLibraryRecords(rawRecords);
    const needle = this.query.trim().toLocaleLowerCase();
    const words = needle.split(/\s+/).filter(Boolean);
    const rows = all.filter((record) => {
      if (!isPacks && !this.matchesSourceFacet(
        record.record
      )) {
        return false;
      }
      if (!words.length) {
        return true;
      }
      const hay = [
        record.id,
        record.title,
        record.purpose,
        record.summary,
        ...record.aliases,
        ...record.authors,
        record.organization
      ].filter(Boolean).join(" ").toLocaleLowerCase();
      return words.every(
        (word) => hay.includes(word)
      );
    }).sort(
      (left, right) => left.title.localeCompare(
        right.title
      )
    );
    if (!all.length) {
      empty(
        root,
        isPacks ? "No Topic Packs in this group" : "No Learning Sources in this group",
        isPacks ? "The group exists, but no purpose-built pack currently references it." : "The group exists, but no learning source currently references it."
      );
      return;
    }
    if (!rows.length) {
      empty(
        root,
        "No matching results",
        `Nothing in ${group.title} matches the current search and filters.`,
        "Clear search and filters",
        async () => {
          this.query = "";
          this.facet = "all";
          await this.rememberGroup();
          this.render();
        }
      );
      return;
    }
    const list = root.createDiv({
      cls: "los-route-list los-library-route-list"
    });
    for (const record of rows) {
      this.renderRecordRow(
        list,
        record,
        isPacks
      );
    }
  }
  async rememberGroup() {
    if (!this.groupId) {
      return void 0;
    }
    return this.plugin.router.remember({
      name: "library-group",
      collection: this.collection,
      groupId: this.groupId,
      query: this.query,
      facet: this.facet
    });
  }
  renderSourceFacets(parent) {
    const facets = parent.createDiv({
      cls: "los-library-facets-inline",
      attr: {
        "aria-label": "Source filters"
      }
    });
    for (const [
      id,
      label
    ] of SOURCE_FACETS) {
      const control = button(
        facets,
        label,
        async () => {
          this.facet = id;
          await this.rememberGroup();
          this.render();
        },
        this.facet === id ? "row" : "quiet"
      );
      control.setAttribute(
        "aria-pressed",
        String(this.facet === id)
      );
    }
  }
  renderRecordRow(list, record, isPack = false) {
    const row = list.createEl(
      "button",
      {
        cls: "los-route-row is-clickable",
        attr: {
          type: "button",
          "aria-label": `Open ${record.title}`,
          "data-record-id": record.id
        }
      }
    );
    const copy = row.createDiv({
      cls: "los-route-row-copy"
    });
    copy.createEl(
      "strong",
      {
        text: record.title
      }
    );
    const meta = isPack ? [
      record.purpose,
      `${record.entries.length} items`
    ].filter(Boolean).join(" \xB7 ") : [
      record.sourceType,
      record.year,
      record.organization,
      record.materialExists || record.materialPath ? "local" : null,
      record.url ? "online" : null
    ].filter(Boolean).join(" \xB7 ");
    if (meta) {
      copy.createDiv({
        cls: "los-route-meta",
        text: meta
      });
    }
    row.createSpan({
      cls: "los-route-open",
      text: "Open \u2192"
    });
    row.addEventListener(
      "click",
      () => {
        this.selectedElementId = record.id;
        if (isPack) {
          this.plugin.openTopicPackDetail(
            record.id,
            this.groupId,
            this.query
          );
          return;
        }
        this.plugin.openSourceDetail(
          record.id,
          this.groupId,
          this.query,
          this.facet
        );
      }
    );
  }
  renderSourcePage(root) {
    const record = readLibraryRecord(
      this.resourceId ? this.plugin.store.get(
        this.resourceId
      ) : null
    );
    const back = button(
      root,
      "\u2039 Learning Sources",
      () => this.plugin.back(),
      "quiet"
    );
    back.addClass("los-route-back");
    if (!record || record.type !== "source") {
      empty(
        root,
        "Learning source unavailable",
        "The projected source could not be found.",
        "Back",
        () => this.plugin.back()
      );
      return;
    }
    const detail = root.createDiv({
      cls: "los-detail-page"
    });
    pageHeader(
      detail,
      "Learning Source",
      record.title,
      record.summary
    );
    this.renderRecordActions(
      detail,
      record
    );
    this.renderAttachments(
      detail,
      record
    );
    this.renderSourceDetail(
      detail,
      record
    );
    this.renderRelated(
      detail,
      record
    );
    this.renderTechnical(
      detail,
      record
    );
  }
  renderTopicPackPage(root) {
    const pack = readLibraryRecord(
      this.topicPackId ? this.plugin.store.get(
        this.topicPackId
      ) : null
    );
    const back = button(
      root,
      "\u2039 Topic Packs",
      () => this.plugin.back(),
      "quiet"
    );
    back.addClass("los-route-back");
    if (!pack || pack.type !== "topic-pack") {
      empty(
        root,
        "Topic Pack unavailable",
        "The projected Topic Pack could not be found.",
        "Back",
        () => this.plugin.back()
      );
      return;
    }
    const detail = root.createDiv({
      cls: "los-detail-page los-topic-pack-detail"
    });
    pageHeader(
      detail,
      "Topic Pack",
      pack.title,
      pack.summary
    );
    const purpose = section(
      detail,
      "Purpose"
    );
    purpose.createEl(
      "p",
      {
        cls: "los-pack-purpose",
        text: pack.purpose || "No purpose recorded."
      }
    );
    this.renderOrderedCollection(
      detail,
      pack,
      "Pack contents"
    );
    this.renderRelated(
      detail,
      pack
    );
    this.renderTechnical(
      detail,
      pack
    );
  }
  renderCataloguePage(root) {
    const catalogue = readLibraryRecord(
      this.catalogueId ? this.plugin.store.get(
        this.catalogueId
      ) : null
    );
    const back = button(
      root,
      "\u2039 Library",
      () => this.plugin.back(),
      "quiet"
    );
    back.addClass("los-route-back");
    if (!catalogue || catalogue.type !== "collection") {
      empty(
        root,
        "Source catalogue unavailable",
        "The projected catalogue could not be found.",
        "Back",
        () => this.plugin.back()
      );
      return;
    }
    const detail = root.createDiv({
      cls: "los-detail-page los-catalogue-detail"
    });
    pageHeader(
      detail,
      "Source Catalogue",
      catalogue.title,
      catalogue.summary
    );
    this.renderOrderedCollection(
      detail,
      catalogue,
      "Catalogue entries"
    );
    this.renderRelated(
      detail,
      catalogue
    );
    this.renderTechnical(
      detail,
      catalogue
    );
  }
  renderOrderedCollection(detail, collection, title) {
    const entries = collection.entries;
    const wrap = section(
      detail,
      `${title} (${entries.length})`,
      "The order and grouping shown here come directly from the canonical collection."
    );
    if (!entries.length) {
      empty(
        wrap,
        "Empty collection",
        "No entries are currently registered."
      );
      return;
    }
    let previousGroup = null;
    entries.forEach(
      (entry, index) => {
        if (entry.group && entry.group !== previousGroup) {
          wrap.createDiv({
            cls: "los-list-group",
            text: entry.group
          });
          previousGroup = entry.group;
        }
        const source = readLibraryRecord(
          this.plugin.store.get(
            entry.sourceId
          )
        );
        const row = wrap.createDiv({
          cls: "los-pack-entry"
        });
        row.createSpan({
          cls: "los-pack-order",
          text: String(index + 1)
        });
        const copy = row.createDiv({
          cls: "los-route-row-copy"
        });
        const open = copy.createEl(
          "button",
          {
            cls: "los-shelf-entry-title is-clickable",
            attr: {
              type: "button"
            },
            text: source?.title ?? entry.sourceId
          }
        );
        open.addEventListener(
          "click",
          () => {
            if (!source) {
              return;
            }
            this.plugin.openSourceDetail(
              source.id,
              this.groupId
            );
          }
        );
        if (entry.why) {
          copy.createDiv({
            cls: "los-shelf-why",
            text: entry.why
          });
        }
        const facts = [
          source?.sourceType,
          source?.year,
          source?.materialExists || source?.materialPath ? "local" : null,
          source?.url ? "online" : null
        ].filter(Boolean).join(" \xB7 ");
        if (facts) {
          copy.createDiv({
            cls: "los-route-meta",
            text: facts
          });
        }
      }
    );
  }
  renderLegacyList(root) {
    const back = button(
      root,
      "\u2039 Library",
      () => this.plugin.back(),
      "quiet"
    );
    back.addClass("los-route-back");
    const title = `${this.recordType.charAt(0).toUpperCase()}${this.recordType.slice(1)} records`;
    pageHeader(
      root,
      "Compatibility view",
      title,
      this.domain ? `Domain: ${this.domain}` : "Legacy record families remain reachable until their migration gate closes."
    );
    const input = root.createEl(
      "input",
      {
        cls: "los-search los-route-search",
        attr: {
          type: "search",
          placeholder: `Search ${this.recordType} records\u2026`,
          "aria-label": `Search ${this.recordType}`
        }
      }
    );
    input.value = this.query;
    input.addEventListener(
      "input",
      async () => {
        this.query = input.value;
        await this.plugin.router.remember({
          name: "legacy-library-list",
          recordType: this.recordType,
          query: this.query,
          domain: this.domain
        });
        this.render();
      }
    );
    let rows = readLibraryRecords(
      this.plugin.store.search(
        this.query,
        [this.recordType]
      )
    );
    if (this.domain) {
      rows = rows.filter(
        (record) => record.domain === this.domain
      );
    }
    rows.sort(
      (left, right) => left.title.localeCompare(
        right.title
      )
    );
    if (!rows.length) {
      empty(
        root,
        this.query ? "No matching records" : "No records",
        this.query ? "Try a shorter title, alias or ID." : `No ${this.recordType} records are projected.`
      );
      return;
    }
    const list = root.createDiv({
      cls: "los-route-list"
    });
    for (const record of rows) {
      const row = list.createEl(
        "button",
        {
          cls: "los-route-row is-clickable",
          attr: {
            type: "button",
            "data-record-id": record.id
          }
        }
      );
      const copy = row.createDiv({
        cls: "los-route-row-copy"
      });
      copy.createEl(
        "strong",
        {
          text: record.title
        }
      );
      copy.createDiv({
        cls: "los-route-meta",
        text: [
          record.role,
          record.domain,
          record.state
        ].filter(Boolean).join(" \xB7 ")
      });
      row.createSpan({
        cls: "los-route-open",
        text: record.path ? "Open file \u2192" : "Open \u2192"
      });
      row.addEventListener(
        "click",
        () => {
          this.selectedElementId = record.id;
          if (record.path) {
            this.plugin.openAuthoredPath(
              record.path
            );
            return;
          }
          this.plugin.openRecord(
            record.record
          );
        }
      );
    }
  }
  renderRecordActions(detail, record) {
    const actions = detail.createDiv({
      cls: "los-actions"
    });
    if (record.url) {
      button(
        actions,
        "Open online",
        () => this.plugin.openResource({
          url: record.url
        }),
        "cta"
      );
    }
    if (record.materialPath) {
      button(
        actions,
        "Open local copy",
        () => this.plugin.openMaterialPath(
          record.materialPath
        ),
        "quiet"
      );
    }
    if (record.path) {
      button(
        actions,
        "Open authored file",
        () => this.plugin.openAuthoredPath(
          record.path
        ),
        "quiet"
      );
    }
  }
  renderAttachments(detail, record) {
    if (!record.attachments.length) {
      return;
    }
    const attachments = section(
      detail,
      "Attachments",
      "Open the original handwriting, image, or PDF."
    );
    for (const attachment of record.attachments) {
      button(
        attachments,
        `Open ${attachment.label}`,
        () => this.plugin.openAuthoredPath(
          attachment.path
        ),
        "quiet"
      );
    }
  }
  renderRelated(detail, record) {
    const related = readRelatedRecords(
      this.plugin.store.related(
        record.id
      )
    );
    const groups = /* @__PURE__ */ new Map();
    for (const relatedRecord of related) {
      const current = groups.get(relatedRecord.type);
      if (current) {
        current.push(relatedRecord);
      } else {
        groups.set(
          relatedRecord.type,
          [relatedRecord]
        );
      }
    }
    if (!groups.size) {
      return;
    }
    const wrap = section(
      detail,
      "Related"
    );
    const orderedGroups = [
      ...groups.entries()
    ].sort(
      (left, right) => right[1].length - left[1].length
    );
    for (const [
      type,
      rows
    ] of orderedGroups) {
      const group = wrap.createDiv({
        cls: "los-related-group"
      });
      group.createDiv({
        cls: "los-group-title",
        text: `${RELATED_LABELS[type] ?? type} \xB7 ${rows.length}`
      });
      const shown = group.createDiv({
        cls: "los-related-chips"
      });
      for (const relatedRecord of rows.slice(0, 5)) {
        chip(
          shown,
          relatedRecord.record,
          () => this.plugin.openRecord(
            relatedRecord.record
          )
        );
      }
      if (rows.length > 5) {
        const rest = disclosure(
          group,
          `View all ${rows.length}`
        );
        const restChips = rest.createDiv({
          cls: "los-related-chips"
        });
        for (const relatedRecord of rows.slice(5)) {
          chip(
            restChips,
            relatedRecord.record,
            () => this.plugin.openRecord(
              relatedRecord.record
            )
          );
        }
      }
    }
  }
  renderSourceDetail(detail, record) {
    const facts = section(
      detail,
      "Source facts"
    );
    const factRows = [
      [
        "Authors",
        record.authors.join(", ")
      ],
      [
        "Organization",
        record.organization
      ],
      [
        "Year",
        record.year
      ],
      [
        "Type",
        record.sourceType
      ]
    ];
    for (const [
      label,
      value
    ] of factRows) {
      if (!value) {
        continue;
      }
      const row = facts.createDiv({
        cls: "los-fact-row"
      });
      row.createSpan({
        cls: "los-fact-label",
        text: label
      });
      row.createSpan({
        cls: "los-fact-value",
        text: value
      });
    }
    const memberships = this.shelfIndex().get(
      record.id
    ) ?? [];
    const placed = section(
      detail,
      "Collections",
      "Where this source sits and the explicit role it plays there."
    );
    if (!memberships.length) {
      empty(
        placed,
        "Not in a collection",
        "The source remains globally registered."
      );
    }
    for (const membership of memberships) {
      const line = placed.createDiv({
        cls: "los-shelf-entry"
      });
      const head = line.createEl(
        "button",
        {
          cls: "los-shelf-entry-title is-clickable",
          attr: {
            type: "button"
          },
          text: membership.shelf.title
        }
      );
      head.addEventListener(
        "click",
        () => {
          if (membership.shelf.type === "topic-pack") {
            this.plugin.openTopicPackDetail(
              membership.shelf.id
            );
            return;
          }
          this.plugin.openCatalogueDetail(
            membership.shelf.id
          );
        }
      );
      if (membership.group) {
        line.createDiv({
          cls: "los-micro",
          text: membership.group
        });
      }
      if (membership.why) {
        line.createDiv({
          cls: "los-shelf-why",
          text: membership.why
        });
      }
    }
    const used = section(
      detail,
      "Used in units",
      "Use is module/unit-specific; it is not a global source score."
    );
    const units = readLibraryRecords(
      this.plugin.store.useUnits(
        record.id
      )
    );
    if (!units.length) {
      empty(
        used,
        "Not routed to a unit",
        "The source remains globally registered."
      );
    }
    for (const unit of units) {
      chip(
        used,
        unit.record,
        () => this.plugin.openUnit(
          unit.id
        )
      );
    }
    if (record.evaluations.length) {
      const evidence = section(
        detail,
        "Existing evaluation evidence"
      );
      for (const evaluation of record.evaluations) {
        const card = evidence.createDiv({
          cls: "los-evidence-card"
        });
        if (evaluation.verdict) {
          card.createEl(
            "p",
            {
              text: evaluation.verdict
            }
          );
        }
        for (const selection of evaluation.readingPlan) {
          card.createDiv({
            cls: "los-row",
            text: selection
          });
        }
        for (const selection of evaluation.usefulSections) {
          card.createDiv({
            cls: "los-row",
            text: selection.section + (selection.note ? ` \u2014 ${selection.note}` : "")
          });
        }
      }
    }
  }
  renderTechnical(detail, record) {
    const technical = disclosure(
      detail,
      "Technical details",
      "los-technical-details"
    );
    const idRow = technical.createDiv({
      cls: "los-fact-row"
    });
    idRow.createSpan({
      cls: "los-fact-label",
      text: "Record ID"
    });
    idRow.createSpan({
      cls: "los-fact-value los-detail-id",
      text: record.id
    });
    button(
      technical,
      "Copy ID",
      () => this.plugin.copyText(
        record.id
      ),
      "quiet"
    );
    if (record.path) {
      const pathRow = technical.createDiv({
        cls: "los-fact-row"
      });
      pathRow.createSpan({
        cls: "los-fact-label",
        text: "Path"
      });
      pathRow.createSpan({
        cls: "los-fact-value",
        text: record.path
      });
    }
  }
};

// src/views/module-view.ts
var import_obsidian11 = require("obsidian");
var MODULE_TABS = [
  ["overview", "Overview"],
  ["units", "Units"],
  ["resources", "Resources"],
  ["logistics", "Logistics"]
];
function isRecord5(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function nonNull(value) {
  return value !== null;
}
function projectedString4(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}
function projectedText3(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  const text = String(value);
  return text.length > 0 ? text : null;
}
function projectedCount2(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(
    0,
    Math.trunc(value)
  );
}
function projectedRecords2(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (candidate) => isRecord5(candidate)
  );
}
function projectedStrings3(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (candidate) => typeof candidate === "string" && candidate.length > 0
  );
}
function isModuleScreen(value) {
  return value === "groups" || value === "list" || value === "detail";
}
function isModuleTab(value) {
  return MODULE_TABS.some(
    ([tab]) => tab === value
  );
}
function readModuleViewState(value) {
  if (!isRecord5(value)) {
    return {
      screen: "groups",
      groupId: null,
      query: "",
      moduleId: null,
      hasComponentId: false,
      hasTab: false
    };
  }
  const moduleId = projectedString4(value.moduleId);
  const screen = isModuleScreen(
    value.screen
  ) ? value.screen : moduleId ? "detail" : "groups";
  const hasComponentId = Object.prototype.hasOwnProperty.call(
    value,
    "componentId"
  );
  const hasTab = Object.prototype.hasOwnProperty.call(
    value,
    "tab"
  );
  const componentId = !hasComponentId ? void 0 : value.componentId === null ? null : projectedString4(
    value.componentId
  );
  const tab = !hasTab ? void 0 : value.tab === null ? null : isModuleTab(value.tab) ? value.tab : null;
  return {
    screen,
    groupId: projectedString4(value.groupId),
    query: typeof value.query === "string" ? value.query : "",
    moduleId,
    componentId,
    tab,
    hasComponentId,
    hasTab
  };
}
function readThematicGroup2(record) {
  if (!record) {
    return null;
  }
  const id = projectedString4(record.id);
  if (!id) {
    return null;
  }
  return {
    id,
    title: projectedString4(record.title) ?? projectedString4(record.label) ?? id,
    description: projectedText3(record.description) ?? ""
  };
}
function readComponents(value) {
  return projectedRecords2(value).map((record) => {
    const id = projectedString4(record.id);
    if (!id) {
      return null;
    }
    return {
      id,
      title: projectedString4(record.short_title) ?? projectedString4(record.title) ?? id
    };
  }).filter(nonNull);
}
function readExamination(value) {
  const examination = isRecord5(value) ? value : {};
  return {
    type: projectedString4(examination.type),
    notes: projectedText3(examination.notes)
  };
}
function readModuleRecord(record, fallbackId = null) {
  if (!record) {
    return null;
  }
  const id = projectedString4(record.id) ?? fallbackId;
  if (!id) {
    return null;
  }
  return {
    record,
    id,
    title: projectedString4(record.title) ?? id,
    kind: projectedString4(record.kind) ?? "Module",
    code: projectedText3(record.code) ?? "",
    semester: projectedText3(record.semester) ?? "",
    status: projectedString4(record.status) ?? "unspecified",
    institution: projectedText3(record.institution) ?? "",
    credits: projectedText3(record.credits),
    examination: readExamination(record.examination),
    components: readComponents(record.components)
  };
}
function normalizeUnitRecord(record) {
  const id = projectedString4(record.id);
  if (!id) {
    return null;
  }
  const title = projectedString4(record.title) ?? id;
  const status = projectedString4(record.status) ?? "unspecified";
  const normalized = {
    ...record,
    id,
    title,
    status,
    scope: projectedText3(record.scope) ?? ""
  };
  return {
    record: normalized,
    id,
    title,
    status
  };
}
function normalizeWorkspaceRecord(record) {
  return {
    ...record,
    id: projectedString4(record.id) ?? "",
    title: projectedString4(record.title) ?? projectedString4(record.id) ?? "Workspace",
    status: projectedString4(record.status) ?? "unspecified",
    objective: projectedText3(record.objective) ?? "",
    next_action: projectedText3(record.next_action) ?? "",
    deadline: projectedText3(record.deadline) ?? "",
    standing: record.standing === true,
    module_ids: projectedStrings3(record.module_ids),
    unit_ids: projectedStrings3(record.unit_ids)
  };
}
function readProgress(value) {
  const progress = isRecord5(value) ? value : {};
  return {
    stagesComplete: projectedCount2(
      progress.stages_complete
    ),
    stagesTotal: projectedCount2(
      progress.stages_total
    ),
    unitsTotal: projectedCount2(
      progress.units_total
    )
  };
}
function readDeadlineModules(value) {
  return projectedRecords2(value).map((record) => {
    const moduleId = projectedString4(record.module_id);
    if (!moduleId) {
      return null;
    }
    return {
      moduleId,
      action: projectedText3(record.action)
    };
  }).filter(nonNull);
}
function readAcademicDeadline(record) {
  const startDate = projectedString4(record.start_date) ?? "";
  const endDate = projectedString4(record.end_date) ?? "";
  return {
    record,
    kind: projectedString4(record.kind) ?? "academic-date",
    label: projectedString4(record.label) ?? projectedString4(record.title) ?? "Academic date",
    title: projectedString4(record.title) ?? "",
    startDate,
    endDate,
    time: projectedText3(record.time),
    registrationState: projectedString4(
      record.registration_state
    ) ?? "unregistered",
    directModuleId: projectedString4(record.module_id),
    modules: readDeadlineModules(record.modules)
  };
}
function readSourceEntries(value) {
  return projectedRecords2(value).map((record) => ({
    record,
    role: projectedString4(record.role) ?? "unassigned",
    sourceId: projectedString4(record.source_id),
    why: projectedText3(record.why) ?? "",
    unitRouteCount: Array.isArray(record.unit_routes) ? record.unit_routes.length : 0
  }));
}
var ModuleView = class extends import_obsidian11.ItemView {
  plugin;
  screen;
  groupId;
  query;
  moduleId;
  componentId;
  tab;
  selectedElementId;
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.screen = "groups";
    this.groupId = null;
    this.query = "";
    this.moduleId = null;
    this.componentId = null;
    this.tab = null;
    this.selectedElementId = null;
  }
  getViewType() {
    return VIEW_MODULE;
  }
  getDisplayText() {
    return "LearningOS \xB7 Modules";
  }
  async setState(state = {}) {
    const parsed = readModuleViewState(state);
    const nextModuleId = parsed.moduleId;
    if (nextModuleId !== this.moduleId) {
      this.componentId = null;
      this.tab = null;
    }
    this.screen = parsed.screen;
    this.groupId = parsed.groupId;
    this.query = parsed.query;
    this.moduleId = nextModuleId;
    if (parsed.hasComponentId) {
      this.componentId = parsed.componentId ?? null;
    }
    if (parsed.hasTab) {
      this.tab = parsed.tab ?? null;
    }
    this.render();
  }
  getState() {
    return {
      screen: this.screen,
      groupId: this.groupId,
      query: this.query,
      moduleId: this.moduleId,
      componentId: this.componentId,
      tab: this.tab
    };
  }
  async onOpen() {
    await this.setState(
      this.leaf.state
    );
  }
  /** Units unless there is nothing to study yet. */
  defaultTab(module2) {
    return this.plugin.store.unitsFor(module2.id).length ? "units" : "overview";
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass(
      "los-root",
      "los-module-view"
    );
    if (this.screen === "list") {
      this.renderGroupList(root);
      return;
    }
    if (this.screen === "detail") {
      this.renderModuleDetail(root);
      return;
    }
    this.renderGroups(root);
  }
  renderGroups(root) {
    pageHeader(
      root,
      "Modules",
      "Choose a thematic group",
      "Modules stay organized by explicit core-owned domains. Open a group to see its contents."
    );
    const groups = this.plugin.store.thematicGroups().map(
      (record) => readThematicGroup2(record)
    ).filter(nonNull);
    if (!groups.length) {
      empty(
        root,
        "No thematic groups",
        "Rebuild the projection after defining thematic-group metadata."
      );
      return;
    }
    const grid = root.createDiv({
      cls: "los-group-grid"
    });
    for (const group of groups) {
      const modules = this.plugin.store.modulesForGroup(group.id).map(
        (record) => readModuleRecord(record)
      ).filter(nonNull);
      const card = grid.createEl(
        "button",
        {
          cls: "los-group-card is-clickable",
          attr: {
            type: "button",
            "aria-label": `Open ${group.title}`
          }
        }
      );
      const head = card.createDiv({
        cls: "los-group-card-header"
      });
      head.createEl("h2", {
        text: group.title
      });
      head.createSpan({
        cls: "los-group-count",
        text: `${modules.length} module${modules.length === 1 ? "" : "s"}`
      });
      if (group.description) {
        card.createEl("p", {
          text: group.description
        });
      }
      card.createSpan({
        cls: "los-route-open",
        text: "Open \u2192"
      });
      card.addEventListener(
        "click",
        () => {
          this.selectedElementId = group.id;
          return this.plugin.openModuleGroup(group.id);
        }
      );
    }
  }
  renderGroupList(root) {
    const groupRecord = this.groupId ? this.plugin.store.get(
      this.groupId
    ) : null;
    const group = readThematicGroup2(groupRecord);
    const back = button(
      root,
      "\u2039 Modules",
      () => this.plugin.back(),
      "quiet"
    );
    back.addClass("los-route-back");
    if (!group) {
      empty(
        root,
        "Thematic group unavailable",
        "Return to Modules and choose another group.",
        "Back",
        () => this.plugin.back()
      );
      return;
    }
    pageHeader(
      root,
      "Modules",
      group.title,
      group.description || "Modules in this thematic group."
    );
    const search = root.createEl(
      "input",
      {
        cls: "los-search los-route-search",
        attr: {
          type: "search",
          placeholder: `Search ${group.title} modules\u2026`,
          "aria-label": `Search ${group.title} modules`
        }
      }
    );
    search.value = this.query;
    search.addEventListener(
      "input",
      async () => {
        this.query = search.value;
        await this.plugin.router.remember({
          name: "module-list",
          groupId: group.id,
          query: this.query
        });
        this.render();
      }
    );
    const all = this.plugin.store.modulesForGroup(group.id).map(
      (record) => readModuleRecord(record)
    ).filter(nonNull);
    const needle = this.query.trim().toLocaleLowerCase();
    const rows = all.filter(
      (module2) => {
        if (!needle) {
          return true;
        }
        return [
          module2.title,
          module2.code,
          module2.kind,
          module2.semester
        ].filter(Boolean).join(" ").toLocaleLowerCase().includes(needle);
      }
    );
    if (!all.length) {
      empty(
        root,
        "No modules in this group",
        "The group exists, but no modules currently reference it."
      );
      return;
    }
    if (!rows.length) {
      empty(
        root,
        "No matching modules",
        `Nothing in ${group.title} matches \u201C${this.query.trim()}\u201D.`,
        "Clear search",
        async () => {
          this.query = "";
          await this.plugin.router.remember({
            name: "module-list",
            groupId: group.id,
            query: ""
          });
          this.render();
        }
      );
      return;
    }
    const list = root.createDiv({
      cls: "los-route-list"
    });
    for (const module2 of rows) {
      const row = list.createEl(
        "button",
        {
          cls: "los-route-row is-clickable",
          attr: {
            type: "button",
            "aria-label": `Open module: ${module2.title}`,
            "data-record-id": module2.id
          }
        }
      );
      const copy = row.createDiv({
        cls: "los-route-row-copy"
      });
      copy.createEl("strong", {
        text: module2.title
      });
      const meta = [
        module2.code,
        module2.kind,
        module2.semester,
        module2.status
      ].filter(Boolean).join(" \xB7 ");
      if (meta) {
        copy.createDiv({
          cls: "los-route-meta",
          text: meta
        });
      }
      row.createSpan({
        cls: "los-route-open",
        text: "Open \u2192"
      });
      row.addEventListener(
        "click",
        () => {
          this.selectedElementId = module2.id;
          return this.plugin.openModuleDetail(module2.id);
        }
      );
    }
  }
  renderModuleDetail(root) {
    const moduleRecord = this.moduleId ? this.plugin.store.get(
      this.moduleId
    ) : null;
    const module2 = readModuleRecord(
      moduleRecord,
      this.moduleId
    );
    const back = button(
      root,
      "\u2039 Back",
      () => this.plugin.back(),
      "quiet"
    );
    back.addClass("los-route-back");
    if (!module2) {
      empty(
        root,
        "Module unavailable",
        "Return to Modules and choose another module."
      );
      return;
    }
    const tab = this.tab ?? this.defaultTab(module2);
    const header = pageHeader(
      root,
      module2.kind,
      module2.title
    );
    header.createDiv({
      cls: "los-module-facts",
      text: this.headline(module2)
    });
    const tabs = root.createDiv({
      cls: "los-tabs",
      attr: {
        role: "tablist"
      }
    });
    for (const [key, label] of MODULE_TABS) {
      const control = button(
        tabs,
        label,
        () => this.selectTab(key),
        key === tab ? "cta" : "quiet"
      );
      control.setAttrs({
        role: "tab",
        "aria-selected": String(key === tab)
      });
    }
    if (tab === "overview") {
      this.renderOverview(
        root,
        module2
      );
    } else if (tab === "units") {
      this.renderUnits(
        root,
        module2
      );
    } else if (tab === "resources") {
      this.renderSources(
        root,
        module2
      );
    } else {
      this.renderLogistics(
        root,
        module2
      );
    }
  }
  /** One line instead of six labelled facts; the rest is in Logistics. */
  headline(module2) {
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const nextDate = this.deadlinesFor(module2).filter(
      (row) => (row.endDate || row.startDate) >= today
    ).map((row) => row.startDate)[0];
    return [
      module2.semester,
      module2.credits ? `${module2.credits} LP` : "",
      module2.examination.type ? `${module2.examination.type}${nextDate ? ` ${nextDate}` : ""}` : ""
    ].filter(Boolean).join(" \xB7 ");
  }
  renderOverview(root, module2) {
    const progress = readProgress(
      this.plugin.store.progress(
        module2.id
      )
    );
    const wrap = root.createDiv({
      cls: "los-overview"
    });
    wrap.createDiv({
      cls: "los-overview-progress",
      text: `${progress.stagesComplete} of ${progress.stagesTotal} stages complete across ${progress.unitsTotal} unit${progress.unitsTotal === 1 ? "" : "s"}`
    });
    const workspaces = this.plugin.store.workspacesForModule(module2.id).map(
      (record) => normalizeWorkspaceRecord(record)
    );
    for (const workspace of workspaces) {
      workspaceCard(
        wrap,
        this.plugin,
        workspace,
        module2.id
      );
    }
    if (!workspaces.length) {
      empty(
        wrap,
        "No active coordination workspace",
        "The module/unit tree still owns study state."
      );
    }
    const units = this.plugin.store.unitsFor(module2.id).map(
      (record) => normalizeUnitRecord(record)
    ).filter(nonNull);
    const next = units.find(
      (unit) => unit.status === "active"
    ) ?? units[0];
    if (next) {
      button(
        wrap,
        `Continue ${next.title}`,
        () => this.plugin.openUnit(next.id),
        "cta"
      );
    }
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const ahead = this.deadlinesFor(module2).filter(
      (row) => (row.endDate || row.startDate) >= today
    );
    if (ahead.length) {
      this.renderDeadlineRows(
        wrap,
        module2,
        ahead.slice(0, 1)
      );
    }
  }
  renderUnits(root, module2) {
    if (module2.components.length) {
      const tabs = root.createDiv({
        cls: "los-subtabs",
        attr: {
          role: "tablist"
        }
      });
      const allTab = button(
        tabs,
        "All components",
        () => this.selectComponent(null),
        this.componentId ? "quiet" : "row"
      );
      allTab.setAttrs({
        role: "tab",
        "aria-selected": String(!this.componentId)
      });
      for (const component of module2.components) {
        const control = button(
          tabs,
          component.title,
          () => this.selectComponent(
            component.id
          ),
          this.componentId === component.id ? "row" : "quiet"
        );
        control.setAttrs({
          role: "tab",
          "aria-selected": String(
            this.componentId === component.id
          )
        });
      }
    }
    const units = this.plugin.store.unitsFor(
      module2.id,
      this.componentId
    ).map(
      (record) => normalizeUnitRecord(record)
    ).filter(nonNull);
    if (!units.length) {
      empty(
        root,
        "No units in this component",
        "Return to all components."
      );
      return;
    }
    for (const status of STATUS_ORDER) {
      const rows = units.filter(
        (unit) => unit.status === status
      );
      if (!rows.length) {
        continue;
      }
      root.createDiv({
        cls: "los-group-title",
        text: status.replaceAll("-", " ")
      });
      const grid = root.createDiv({
        cls: "los-card-grid"
      });
      for (const unit of rows) {
        unitCard(
          grid,
          this.plugin,
          unit.record
        );
      }
    }
  }
  renderLogistics(root, module2) {
    const facts = root.createDiv({
      cls: "los-fact-list"
    });
    const factRows = [
      ["Status", module2.status],
      ["Institution", module2.institution],
      ["Code", module2.code],
      ["Semester", module2.semester],
      ["Credits", module2.credits],
      [
        "Examination",
        module2.examination.type
      ]
    ];
    for (const [label, value] of factRows) {
      if (value === null || value === "") {
        continue;
      }
      const row = facts.createDiv({
        cls: "los-fact-row"
      });
      row.createSpan({
        cls: "los-fact-label",
        text: label
      });
      row.createSpan({
        cls: "los-fact-value",
        text: value
      });
    }
    if (module2.examination.notes) {
      root.createEl("p", {
        cls: "los-muted",
        text: module2.examination.notes
      });
    }
    this.renderAcademicDates(
      root,
      module2
    );
  }
  deadlinesFor(module2) {
    return this.plugin.store.rows("academic_deadlines").map(
      (record) => readAcademicDeadline(record)
    ).filter(
      (row) => row.directModuleId === module2.id || row.modules.some(
        (entry) => entry.moduleId === module2.id
      )
    ).sort(
      (a, b) => a.startDate.localeCompare(
        b.startDate
      )
    );
  }
  renderAcademicDates(root, module2) {
    const rows = this.deadlinesFor(module2);
    if (!rows.length) {
      return;
    }
    const wrap = section(
      root,
      "Academic dates",
      "Registration windows and exam sittings for this module."
    );
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const ahead = rows.filter(
      (row) => (row.endDate || row.startDate) >= today
    );
    const past = rows.filter(
      (row) => (row.endDate || row.startDate) < today
    );
    if (ahead.length) {
      this.renderDeadlineRows(
        wrap,
        module2,
        ahead
      );
    } else {
      empty(
        wrap,
        "No upcoming date recorded",
        "Past dates remain available below."
      );
    }
    if (past.length) {
      const history = disclosure(
        wrap,
        `Past dates (${past.length})`,
        "los-deadline-history"
      );
      this.renderDeadlineRows(
        history,
        module2,
        past
      );
    }
  }
  renderDeadlineRows(wrap, module2, rows) {
    const list = wrap.createDiv({
      cls: "los-date-list"
    });
    for (const row of rows) {
      const card = list.createDiv({
        cls: `los-date-row los-deadline-${row.kind}`
      });
      const date = row.endDate && row.endDate !== row.startDate ? `${row.startDate} \u2192 ${row.endDate}` : row.startDate;
      card.createDiv({
        cls: "los-date-when",
        text: date
      });
      const copy = card.createDiv({
        cls: "los-date-copy"
      });
      copy.createEl("strong", {
        text: row.label
      });
      if (row.kind === "registration-window") {
        const entry = row.modules.find(
          (item) => item.moduleId === module2.id
        );
        if (entry?.action) {
          copy.createEl("p", {
            cls: "los-micro",
            text: entry.action
          });
        }
      } else {
        copy.createDiv({
          cls: "los-micro",
          text: row.title || module2.title
        });
        const facts = copy.createDiv({
          cls: "los-row"
        });
        badge(
          facts,
          row.registrationState,
          row.registrationState || "needs-map"
        );
        if (row.time) {
          facts.createSpan({
            cls: "los-micro",
            text: row.time
          });
        }
      }
    }
  }
  async selectTab(tab) {
    if (!this.moduleId) {
      return;
    }
    this.tab = tab;
    await this.plugin.router.remember({
      name: "module-detail",
      moduleId: this.moduleId,
      componentId: this.componentId,
      tab
    });
    await this.leaf.setViewState({
      type: VIEW_MODULE,
      active: true,
      state: {
        screen: "detail",
        moduleId: this.moduleId,
        componentId: this.componentId,
        tab
      }
    });
  }
  async selectComponent(componentId) {
    if (!this.moduleId) {
      return;
    }
    this.componentId = componentId;
    const tab = this.tab ?? "units";
    await this.plugin.router.remember({
      name: "module-detail",
      moduleId: this.moduleId,
      componentId,
      tab
    });
    await this.leaf.setViewState({
      type: VIEW_MODULE,
      active: true,
      state: {
        screen: "detail",
        moduleId: this.moduleId,
        componentId,
        tab
      }
    });
  }
  renderSources(root, module2) {
    const sourceMap = this.plugin.store.sourceMap(
      module2.id
    );
    const entries = readSourceEntries(
      sourceMap ? sourceMap.sources : null
    );
    if (!entries.length) {
      empty(
        root,
        "No routed module sources yet",
        "Sources remain globally registered."
      );
      return;
    }
    root.createEl("p", {
      cls: "los-muted",
      text: "Roles in this module \u2014 not global quality scores."
    });
    const groups = /* @__PURE__ */ new Map();
    for (const entry of entries) {
      const current = groups.get(entry.role);
      if (current) {
        current.push(entry);
      } else {
        groups.set(
          entry.role,
          [entry]
        );
      }
    }
    for (const [role, roleEntries] of groups) {
      const group = root.createDiv({
        cls: "los-source-role"
      });
      group.createDiv({
        cls: "los-group-title",
        text: role.replaceAll("-", " ")
      });
      for (const entry of roleEntries) {
        const row = group.createDiv({
          cls: "los-row"
        });
        const source = entry.sourceId ? this.plugin.store.get(
          entry.sourceId
        ) : null;
        if (source) {
          chip(
            row,
            source,
            (record) => {
              const id = projectedString4(
                record.id
              );
              if (!id) {
                return;
              }
              return this.plugin.openLibrary(id);
            }
          );
        }
        row.createEl("p", {
          text: entry.why
        });
        if (entry.unitRouteCount) {
          row.createDiv({
            cls: "los-micro",
            text: `${entry.unitRouteCount} routed unit(s)`
          });
        }
      }
    }
  }
};

// src/views/nav-view.ts
var import_obsidian12 = require("obsidian");
var NavView = class extends import_obsidian12.ItemView {
  plugin;
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_NAV;
  }
  getDisplayText() {
    return "LearningOS \xB7 Navigator";
  }
  getIcon() {
    return "route";
  }
  async onOpen() {
    this.render();
  }
  nav(parent, iconName, label, key, action) {
    const active = this.plugin.activeNav === key;
    const row = parent.createEl("button", {
      cls: `los-app-nav-item is-clickable${active ? " is-active" : ""}`,
      attr: { type: "button", "aria-current": active ? "page" : "false" }
    });
    icon(row.createSpan(), iconName);
    row.createSpan({ text: label });
    row.addEventListener("click", action);
    return row;
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-app-nav");
    const brand = root.createDiv({ cls: "los-nav-brand" });
    icon(brand.createSpan({ cls: "los-brand-mark" }), "route");
    brand.createEl("strong", { text: "LearningOS" });
    const search = brand.createEl("button", {
      cls: "los-nav-search is-clickable",
      attr: { type: "button", "aria-label": "Search LearningOS", title: "Search LearningOS" }
    });
    icon(search.createSpan(), "search");
    search.addEventListener("click", () => this.plugin.openGlobalSearch());
    const primary = root.createDiv({ cls: "los-nav-primary" });
    this.nav(primary, "home", "Home", "home", () => this.plugin.openHome());
    this.nav(primary, "layout-grid", "Modules", "modules", () => this.plugin.openModules());
    this.nav(primary, "graduation-cap", "Learn", "learn", () => this.plugin.openLearn());
    this.nav(primary, "briefcase-business", "Projects", "projects", () => this.plugin.openProjects());
    this.nav(primary, "library", "Library", "library", () => this.plugin.openLibrary());
    this.nav(primary, "sprout", "Garden", "garden", () => this.plugin.openGarden());
    this.nav(primary, "check-check", "Review", "review", () => this.plugin.openReview());
    const more = root.createEl("details", { cls: "los-nav-more" });
    if (this.plugin.settings.navMoreOpen) more.setAttr("open", "open");
    more.createEl("summary", { cls: "los-nav-more-trigger", text: "More" });
    more.addEventListener("toggle", () => {
      this.plugin.settings.navMoreOpen = more.hasAttribute("open");
      this.plugin.scheduleDraftSave();
    });
    const secondary = more.createDiv({ cls: "los-nav-secondary" });
    this.nav(secondary, "plus", "Capture", "capture", () => this.plugin.openCapture());
    this.nav(secondary, "map", "Domain atlas", "atlas", () => this.plugin.openAtlas());
    this.nav(
      secondary,
      "shield",
      "Master\u2019s boundary",
      "masters",
      () => this.plugin.openBoundary("program-masters-planning")
    );
    this.nav(
      secondary,
      "shield-alert",
      "Job boundary",
      "job",
      () => this.plugin.openBoundary("program-job-boundary")
    );
    this.nav(secondary, "activity", "Diagnostics", "diagnostics", () => this.plugin.openDiagnostics());
    this.nav(secondary, "refresh-cw", "Rebuild projection", "rebuild", () => this.plugin.generate());
  }
};

// src/views/program-view.ts
var import_obsidian13 = require("obsidian");
var COORDINATION_HEADINGS = [
  "Priorities",
  "Commitments",
  "Dependencies",
  "Deferrals"
];
function isRecord6(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function readProgramSemesters(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const semesters = [];
  for (const candidate of value) {
    if (!isRecord6(candidate) || typeof candidate.title !== "string" || typeof candidate.status !== "string") {
      continue;
    }
    semesters.push({
      title: candidate.title,
      status: candidate.status
    });
  }
  return semesters;
}
function errorMessage5(error) {
  return error instanceof Error ? error.message : String(error);
}
var ProgramView = class extends import_obsidian13.ItemView {
  plugin;
  programId = null;
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_PROGRAM;
  }
  getDisplayText() {
    return "LearningOS \xB7 Area";
  }
  async setState(state = {}) {
    if (typeof state.programId === "string") {
      this.programId = state.programId;
    }
    this.render();
  }
  getState() {
    return {
      programId: this.programId
    };
  }
  async onOpen() {
    const programId = this.leaf.state?.programId;
    if (typeof programId === "string") {
      this.programId = programId;
    }
    this.render();
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-program-view");
    if (!this.plugin.store.ready) {
      pageHeader(
        root,
        "LearningOS",
        "Projection unavailable"
      );
      empty(
        root,
        "The interface contract could not be loaded",
        this.plugin.store.error,
        "Rebuild views",
        () => this.plugin.generate()
      );
      return;
    }
    if (this.programId === "queue-needs-map") {
      this.renderNeedsMap(root);
      return;
    }
    if (this.programId === "inbox") {
      this.renderInbox(root);
      return;
    }
    const program = this.programId ? this.plugin.store.get(this.programId) : null;
    if (!program) {
      empty(
        root,
        "Area unavailable",
        "Return Home and choose another area."
      );
      return;
    }
    pageHeader(root, "", "Learn");
    const tabs = root.createDiv({
      cls: "los-tabs",
      attr: {
        role: "tablist"
      }
    });
    for (const [areaId, title] of LEARN_AREAS) {
      const active = areaId === program.id;
      const tab = button(
        tabs,
        title,
        () => this.plugin.openLearn(areaId),
        active ? "cta" : "quiet"
      );
      tab.setAttrs({
        role: "tab",
        "aria-selected": String(active)
      });
    }
    if (typeof program.description === "string" && program.description) {
      root.createEl("p", {
        cls: "los-muted",
        text: program.description
      });
    }
    const modules = this.plugin.store.modulesFor(program.id);
    const list = root.createDiv({
      cls: "los-learning-list"
    });
    if (!modules.length) {
      empty(
        root,
        "No modules in this area yet",
        "Nothing is hidden."
      );
    }
    for (const module2 of modules) {
      progressRow(list, this.plugin, module2);
    }
    if (Boolean(program.semester_bound)) {
      const semesters = disclosure(root, "Semesters");
      for (const semester of readProgramSemesters(
        program.semesters
      )) {
        const row = semesters.createDiv({
          cls: "los-row"
        });
        row.createEl("strong", {
          text: semester.title
        });
        badge(
          row,
          semester.status,
          semester.status
        );
      }
    }
    this.renderCoordination(root);
  }
  /**
   * The full coordination record — commitments, dependencies, deferrals — moved
   * off Home to here. Home carries the one-line priority; this is where the
   * whole decision layer is read when the learner actually wants it.
   */
  renderCoordination(root) {
    const coordination = this.plugin.store.get("coordination");
    const sections = isRecord6(coordination?.sections) ? coordination.sections : {};
    const rows = COORDINATION_HEADINGS.map(
      (heading) => [
        heading,
        projectedExcerpt(
          sections[heading],
          1600
        )
      ]
    ).filter((row) => Boolean(row[1]));
    if (!rows.length) {
      return;
    }
    const panel = disclosure(
      root,
      "Semester coordination",
      "los-coordination-details"
    );
    for (const [heading, body] of rows) {
      const row = panel.createDiv({
        cls: "los-coordination-row"
      });
      row.createEl("strong", {
        text: heading
      });
      row.createEl("p", {
        text: body
      });
    }
  }
  renderNeedsMap(root) {
    pageHeader(
      root,
      "Review",
      "Units needing a study map"
    );
    const grid = root.createDiv({
      cls: "los-card-grid"
    });
    const units = this.plugin.store.units().filter(
      (row) => !this.plugin.store.mapForUnit(row.id)
    );
    for (const unit of units) {
      unitCard(grid, this.plugin, unit);
    }
  }
  renderInbox(root) {
    pageHeader(
      root,
      "",
      "Capture",
      "You capture; the operator files."
    );
    const count = this.plugin.store.data?.counts?.inbox_items || 0;
    const wrap = section(
      root,
      `${count} item${count === 1 ? "" : "s"} awaiting routing`
    );
    const form = wrap.createDiv({
      cls: "los-capture-grid"
    });
    const textPanel = form.createDiv({
      cls: "los-capture-panel"
    });
    textPanel.createEl("h3", {
      text: "Quick text"
    });
    const title = textPanel.createEl("input", {
      cls: "los-search los-capture-title",
      attr: {
        type: "text",
        placeholder: "Optional title",
        "aria-label": "Capture title"
      }
    });
    const editor = textPanel.createEl("textarea", {
      cls: "los-note-editor los-capture-editor",
      attr: {
        placeholder: "Paste a link, thought, question, or fragment\u2026",
        "aria-label": "Capture text"
      }
    });
    const draft = this.plugin.getInboxDraft();
    title.value = draft.title || "";
    editor.value = draft.text || "";
    const status = textPanel.createDiv({
      cls: "los-draft-status",
      attr: {
        "aria-live": "polite"
      }
    });
    const captureButton = button(
      textPanel,
      "Capture text",
      () => {
        const text = editor.value.trim();
        if (!text) {
          new import_obsidian13.Notice(
            "Enter some text before capturing."
          );
          editor.focus();
          return;
        }
        this.capture(
          () => this.plugin.gateway.captureText(
            text,
            title.value.trim()
          ),
          () => {
            this.plugin.clearInboxDraft();
            editor.value = "";
            title.value = "";
          }
        );
      },
      "cta"
    );
    const syncDraft = () => {
      const hasDraft = Boolean(
        title.value || editor.value
      );
      this.plugin.setInboxDraft(
        title.value,
        editor.value
      );
      captureButton.disabled = !editor.value.trim();
      status.setText(
        hasDraft ? "Draft kept locally until capture." : "Nothing entered yet."
      );
      status.toggleClass(
        "is-dirty",
        hasDraft
      );
    };
    title.addEventListener(
      "input",
      syncDraft
    );
    editor.addEventListener(
      "input",
      syncDraft
    );
    captureButton.disabled = !editor.value.trim();
    status.setText(
      title.value || editor.value ? "Draft kept locally until capture." : "Nothing entered yet."
    );
    status.toggleClass(
      "is-dirty",
      Boolean(title.value || editor.value)
    );
    const filePanel = form.createDiv({
      cls: "los-capture-panel"
    });
    filePanel.createEl("h3", {
      text: "File or handwriting"
    });
    filePanel.createEl("p", {
      cls: "los-muted",
      text: "The original is copied into the inbox; it is not moved or renamed."
    });
    const picker = filePanel.createEl("input", {
      cls: "los-file-input los-capture-file",
      attr: {
        type: "file",
        "aria-label": "Choose inbox capture file"
      }
    });
    button(
      filePanel,
      "Capture selected file",
      () => {
        const localPath = localFilePath(picker.files?.[0]);
        if (!localPath) {
          new import_obsidian13.Notice(
            "Choose a local file first."
          );
          return;
        }
        this.capture(
          () => this.plugin.gateway.captureFile(
            localPath
          ),
          () => {
            picker.value = "";
          }
        );
      },
      "quiet"
    );
  }
  async capture(action, clear = null) {
    if (this.plugin.gateway.isBusy) {
      new import_obsidian13.Notice(
        "Queued behind the running LearningOS write."
      );
    }
    try {
      await this.plugin.mutate(
        async () => {
          await action();
          await this.plugin.gateway.call(
            ["generate"],
            {
              expectJson: false
            }
          );
        }
      );
      clear?.();
      new import_obsidian13.Notice(
        "Captured to the LearningOS inbox."
      );
      this.render();
    } catch (error) {
      new import_obsidian13.Notice(errorMessage5(error));
    }
  }
};

// src/views/project-view.ts
var import_obsidian14 = require("obsidian");
var PROJECT_TABS = [
  ["overview", "Overview"],
  ["structure", "Structure"],
  ["linked-materials", "Linked Materials"],
  ["files", "Files"],
  ["decisions", "Decisions"]
];
function isRecord7(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function projectedString5(value) {
  return typeof value === "string" && value ? value : null;
}
function projectedText4(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  const text = String(value);
  return text ? text : null;
}
function projectedLabel3(record) {
  return projectedString5(record.title) ?? projectedString5(record.label) ?? projectedString5(record.id) ?? "Untitled";
}
function projectedRecords3(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (candidate) => isRecord7(candidate)
  );
}
function projectedStrings4(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (candidate) => typeof candidate === "string"
  );
}
function projectedListLength2(value) {
  return Array.isArray(value) ? value.length : 0;
}
function isProjectTab(value) {
  return PROJECT_TABS.some(
    ([tab]) => tab === value
  );
}
function readProjectViewState(value) {
  if (!isRecord7(value)) {
    return {};
  }
  const screen = value.screen === "detail" ? "detail" : value.screen === "list" ? "list" : void 0;
  const projectId = value.projectId === null ? null : projectedString5(value.projectId) ?? void 0;
  const tab = isProjectTab(value.tab) ? value.tab : void 0;
  const query = typeof value.query === "string" ? value.query : void 0;
  return {
    screen,
    projectId,
    tab,
    query
  };
}
function readProjectBoundaries(value) {
  const boundaries = isRecord7(value) ? value : {};
  return {
    confidentiality: projectedString5(
      boundaries.confidentiality
    ) ?? "unspecified",
    externalCodeAccess: projectedString5(
      boundaries.external_code_access
    ) ?? "unspecified",
    notes: projectedString5(boundaries.notes)
  };
}
function readProjectStructure(value) {
  const structure = isRecord7(value) ? value : {};
  return {
    kind: projectedString5(structure.kind) ?? "none",
    nodes: projectedRecords3(structure.nodes)
  };
}
function readProjectRelationship(value) {
  const id = projectedString5(value.id);
  const toId = projectedString5(value.to_id);
  if (!id || !toId) {
    return null;
  }
  return {
    id,
    toId,
    toType: projectedString5(value.to_type) ?? "record",
    relationType: projectedString5(value.relation_type) ?? "linked",
    reason: projectedString5(value.reason) ?? "No rationale was projected.",
    contribution: projectedString5(value.contribution) ?? "No contribution was projected.",
    path: projectedString5(value.path)
  };
}
var ProjectLinkReasonModal = class extends import_obsidian14.Modal {
  plugin;
  relationship;
  constructor(app, plugin, relationship) {
    super(app);
    this.plugin = plugin;
    this.relationship = relationship;
  }
  onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass(
      "los-root",
      "los-linked-reason-modal"
    );
    this.plugin.router.openOverlay({
      kind: "linked-material-reason",
      relationshipId: this.relationship.id
    });
    pageHeader(
      root,
      "Linked material",
      "Why this is linked"
    );
    const target = this.plugin.store.get(
      this.relationship.toId
    );
    const relation = section(
      root,
      "Relationship"
    );
    relation.createEl("p", {
      text: `${this.relationship.toType} \xB7 ${this.relationship.relationType}`
    });
    const rationale = section(
      root,
      "Rationale"
    );
    rationale.createEl("p", {
      text: this.relationship.reason
    });
    const contribution = section(
      root,
      "Contribution"
    );
    contribution.createEl("p", {
      text: this.relationship.contribution
    });
    const actions = root.createDiv({
      cls: "los-actions"
    });
    if (target) {
      button(
        actions,
        "Open target",
        () => {
          this.close();
          return this.plugin.openRecord(target);
        },
        "tertiary"
      );
    } else if (this.relationship.path) {
      const path = this.relationship.path;
      button(
        actions,
        "Open target",
        () => {
          this.close();
          return this.plugin.openAuthoredPath(
            path
          );
        },
        "tertiary"
      );
    }
    button(
      actions,
      "Close",
      () => this.close(),
      "quiet"
    );
  }
  onClose() {
    this.plugin.router.clearOverlay();
    this.contentEl.empty();
  }
};
var ProjectView = class extends import_obsidian14.ItemView {
  plugin;
  screen = "list";
  projectId = null;
  tab = "overview";
  query = "";
  selectedElementId = null;
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_PROJECT;
  }
  getDisplayText() {
    return "LearningOS \xB7 Projects";
  }
  async setState(state = {}) {
    const projectId = typeof state.projectId === "string" ? state.projectId : null;
    this.screen = state.screen ?? (projectId ? "detail" : "list");
    this.projectId = projectId;
    this.tab = state.tab ?? "overview";
    this.query = state.query ?? "";
    this.render();
  }
  getState() {
    return {
      screen: this.screen,
      projectId: this.projectId,
      tab: this.tab,
      query: this.query
    };
  }
  async onOpen() {
    await this.setState(
      readProjectViewState(
        this.leaf.state
      )
    );
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass(
      "los-root",
      "los-project-view"
    );
    if (!this.plugin.store.ready) {
      empty(
        root,
        "Projects unavailable",
        this.plugin.store.error
      );
      return;
    }
    if (this.screen === "detail") {
      this.renderDetail(root);
      return;
    }
    this.renderList(root);
  }
  renderList(root) {
    pageHeader(
      root,
      "Projects",
      "Projects",
      "Long-running work with its own structure, materials, files, and decisions."
    );
    const input = root.createEl(
      "input",
      {
        cls: "los-search los-project-search",
        attr: {
          type: "search",
          placeholder: "Search projects",
          "aria-label": "Search projects"
        }
      }
    );
    input.value = this.query;
    const results = root.createDiv({
      cls: "los-project-list"
    });
    const draw = () => {
      results.empty();
      const words = input.value.toLocaleLowerCase().split(/\s+/).filter(Boolean);
      const rows = this.plugin.store.projects().filter(
        (project) => {
          const id = projectedString5(project.id);
          if (!id) {
            return false;
          }
          const hay = [
            id,
            projectedString5(project.title),
            projectedString5(project.objective),
            projectedString5(
              project.project_type
            )
          ].filter(
            (value) => Boolean(value)
          ).join(" ").toLocaleLowerCase();
          return words.every(
            (word) => hay.includes(word)
          );
        }
      );
      if (!rows.length) {
        empty(
          results,
          "No projects found",
          "No first-class project matches this query.",
          "Clear search",
          () => {
            input.value = "";
            input.dispatchEvent(
              new Event("input")
            );
          }
        );
        return;
      }
      for (const project of rows) {
        const projectId = projectedString5(project.id);
        if (!projectId) {
          continue;
        }
        const title = projectedLabel3(project);
        const status = projectedString5(project.status) ?? "planned";
        const projectType = projectedString5(
          project.project_type
        ) ?? "project";
        const row = results.createEl(
          "button",
          {
            cls: "los-card los-project-row is-clickable",
            attr: {
              type: "button",
              "aria-label": `Open project: ${title}`
            }
          }
        );
        row.setAttr(
          "data-record-id",
          projectId
        );
        const top = row.createDiv({
          cls: "los-card-top"
        });
        top.createEl("h2", {
          text: title
        });
        badge(
          top,
          status,
          status
        );
        row.createEl("p", {
          text: projectedExcerpt(
            project.objective,
            280
          )
        });
        row.createDiv({
          cls: "los-micro",
          text: `${projectType} \xB7 ${projectedListLength2(
            project.linked_module_ids
          )} linked modules`
        });
        row.addEventListener(
          "click",
          () => {
            this.selectedElementId = projectId;
            void this.plugin.openProject(
              projectId,
              "overview"
            );
          }
        );
      }
    };
    input.addEventListener(
      "input",
      () => {
        this.query = input.value;
        this.plugin.router.remember({
          name: "project-list",
          query: this.query
        });
        draw();
      }
    );
    draw();
  }
  renderDetail(root) {
    const project = this.projectId ? this.plugin.store.get(
      this.projectId
    ) : null;
    const projectId = project ? projectedString5(project.id) : null;
    if (!project || projectedString5(project.type) !== "project" || !projectId) {
      pageHeader(
        root,
        "Projects",
        "Project not found"
      );
      empty(
        root,
        "This project is unavailable",
        "The current projection does not contain this project.",
        "Back to projects",
        () => this.plugin.openProjects()
      );
      return;
    }
    const title = projectedLabel3(project);
    const status = projectedString5(project.status) ?? "planned";
    const head = pageHeader(
      root,
      "Project",
      title,
      projectedString5(project.objective) ?? ""
    );
    const headActions = head.createDiv({
      cls: "los-actions"
    });
    button(
      headActions,
      "Back",
      () => this.plugin.back(),
      "quiet"
    );
    badge(
      headActions,
      status,
      status
    );
    const tabs = root.createDiv({
      cls: "los-project-tabs",
      attr: {
        role: "tablist",
        "aria-label": "Project sections"
      }
    });
    for (const [tabId, label] of PROJECT_TABS) {
      const tab = button(
        tabs,
        label,
        () => this.plugin.openProject(
          projectId,
          tabId
        ),
        "tertiary"
      );
      const active = this.tab === tabId;
      tab.toggleClass(
        "is-active",
        active
      );
      tab.setAttrs({
        role: "tab",
        "aria-selected": String(active)
      });
    }
    const body = root.createDiv({
      cls: "los-project-body"
    });
    switch (this.tab) {
      case "structure":
        this.renderStructure(
          body,
          project
        );
        break;
      case "linked-materials":
        this.renderLinked(
          body,
          project
        );
        break;
      case "files":
        this.renderFiles(
          body,
          project
        );
        break;
      case "decisions":
        this.renderDecisions(
          body,
          project
        );
        break;
      default:
        this.renderOverview(
          body,
          project
        );
    }
  }
  renderOverview(root, project) {
    const overview = section(
      root,
      "Overview"
    );
    const meta = overview.createDiv({
      cls: "los-project-meta-grid"
    });
    const boundaries = readProjectBoundaries(
      project.boundaries
    );
    const metadata = [
      [
        "Type",
        projectedString5(
          project.project_type
        ) ?? "Project"
      ],
      [
        "Status",
        projectedString5(project.status) ?? "planned"
      ],
      [
        "Confidentiality",
        boundaries.confidentiality
      ],
      [
        "External code access",
        boundaries.externalCodeAccess
      ]
    ];
    for (const [label, value] of metadata) {
      const row = meta.createDiv({
        cls: "los-project-meta"
      });
      row.createDiv({
        cls: "los-kicker",
        text: label
      });
      row.createEl("strong", {
        text: value
      });
    }
    if (boundaries.notes) {
      overview.createEl("p", {
        cls: "los-muted",
        text: boundaries.notes
      });
    }
    const units = section(
      root,
      "Project units",
      "Existing learning units remain reachable without turning the project into a module."
    );
    const unitRows = projectedStrings4(project.unit_ids).map(
      (id) => this.plugin.store.get(id)
    ).filter(
      (row) => row !== null
    );
    if (!unitRows.length) {
      empty(
        units,
        "No units linked",
        "This project can exist without a linear learning map."
      );
    }
    for (const unit of unitRows) {
      const unitId = projectedString5(unit.id);
      if (!unitId) {
        continue;
      }
      button(
        units,
        projectedLabel3(unit),
        () => this.plugin.openUnit(unitId),
        "row"
      );
    }
  }
  renderStructure(root, project) {
    const structure = readProjectStructure(
      project.structure
    );
    const wrap = section(
      root,
      "Structure",
      `Structure mode: ${structure.kind}.`
    );
    if (!structure.nodes.length) {
      empty(
        wrap,
        "No fixed structure",
        "This project currently has no linear or nested step map."
      );
      return;
    }
    const tree = wrap.createDiv({
      cls: "los-project-structure"
    });
    const renderNode = (parent, row, depth = 0) => {
      const item = parent.createDiv({
        cls: `los-project-node los-project-node-depth-${Math.min(depth, 4)}`
      });
      const top = item.createDiv({
        cls: "los-card-top"
      });
      top.createEl("h3", {
        text: projectedLabel3(row)
      });
      const status = projectedString5(row.status);
      if (status) {
        badge(
          top,
          status,
          status
        );
      }
      item.createDiv({
        cls: "los-micro",
        text: projectedString5(row.kind) ?? "step"
      });
      const summary = projectedString5(row.summary);
      if (summary) {
        item.createEl("p", {
          text: summary
        });
      }
      const children = projectedRecords3(row.children);
      if (children.length) {
        const nested = item.createDiv({
          cls: "los-project-node-children"
        });
        for (const child of children) {
          renderNode(
            nested,
            child,
            depth + 1
          );
        }
      }
    };
    for (const row of structure.nodes) {
      renderNode(
        tree,
        row
      );
    }
  }
  renderLinked(root, project) {
    const wrap = section(
      root,
      "Linked Materials",
      "Links retain a core-authored reason rather than implying ownership."
    );
    const projectId = projectedString5(project.id);
    const relationships = projectId ? this.plugin.store.projectRelationships(projectId).map(readProjectRelationship).filter(
      (relationship) => relationship !== null
    ) : [];
    if (!relationships.length) {
      empty(
        wrap,
        "No linked materials",
        "Links appear here when the project relationship projection contains them."
      );
      return;
    }
    for (const relationship of relationships) {
      const target = this.plugin.store.get(
        relationship.toId
      );
      const row = wrap.createDiv({
        cls: "los-card los-project-link"
      });
      const copy = row.createDiv({
        cls: "los-project-link-copy"
      });
      copy.createEl("h3", {
        text: target ? projectedLabel3(target) : relationship.toId
      });
      copy.createDiv({
        cls: "los-micro",
        text: `${relationship.toType} \xB7 ${relationship.relationType}`
      });
      const actions = row.createDiv({
        cls: "los-actions"
      });
      if (target) {
        button(
          actions,
          "Open",
          () => this.plugin.openRecord(target),
          "tertiary"
        );
      }
      button(
        actions,
        "Why linked",
        () => {
          const modal = new ProjectLinkReasonModal(
            this.app,
            this.plugin,
            relationship
          );
          modal.open();
        },
        "quiet"
      );
    }
  }
  renderFiles(root, project) {
    const wrap = section(
      root,
      "Files",
      "Project-owned references; canonical content remains in plain files."
    );
    const files = projectedRecords3(project.files);
    if (!files.length) {
      empty(
        wrap,
        "No files linked",
        "Project files can be added through a declared core capability."
      );
      return;
    }
    for (const file of files) {
      const path = projectedString5(file.path);
      const label = projectedString5(file.label) ?? path ?? projectedString5(file.id) ?? "Untitled file";
      const kind = projectedString5(file.kind) ?? "file";
      const row = wrap.createDiv({
        cls: "los-card los-project-file"
      });
      const copy = row.createDiv({
        cls: "los-project-link-copy"
      });
      copy.createEl("h3", {
        text: label
      });
      copy.createDiv({
        cls: "los-micro",
        text: path ? `${kind} \xB7 ${path}` : kind
      });
      if (path) {
        button(
          row,
          "Open",
          () => this.plugin.openAuthoredPath(
            path
          ),
          "tertiary"
        );
      }
    }
  }
  renderDecisions(root, project) {
    const wrap = section(
      root,
      "Decisions",
      "Open questions and durable decisions, without manufacturing a completion score."
    );
    const decisions = projectedRecords3(project.decisions);
    if (!decisions.length) {
      empty(
        wrap,
        "No decisions recorded",
        "Decisions appear here when the project records them."
      );
      return;
    }
    for (const decision of decisions) {
      const status = projectedString5(decision.status) ?? "open";
      const row = wrap.createDiv({
        cls: "los-card los-project-decision"
      });
      const top = row.createDiv({
        cls: "los-card-top"
      });
      top.createEl("h3", {
        text: projectedLabel3(decision)
      });
      badge(
        top,
        status,
        status
      );
      row.createEl("p", {
        text: projectedText4(decision.summary) ?? ""
      });
    }
  }
};

// src/views/review-view.ts
var import_obsidian15 = require("obsidian");
var fs = __toESM(require("node:fs"));
var nodePath = __toESM(require("node:path"));
function isRecord8(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function errorMessage6(error) {
  return error instanceof Error ? error.message : String(error);
}
var ReviewView = class extends import_obsidian15.ItemView {
  plugin;
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_REVIEW;
  }
  getDisplayText() {
    return "LearningOS \xB7 Review";
  }
  getIcon() {
    return "check-check";
  }
  async onOpen() {
    this.render();
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-review-view");
    if (!this.plugin.store.ready) {
      pageHeader(root, "LearningOS", "Projection unavailable");
      empty(
        root,
        "The interface contract could not be loaded",
        this.plugin.store.error,
        "Rebuild views",
        () => this.plugin.generate()
      );
      return;
    }
    pageHeader(root, "", "Review", "Everything waiting on a decision from you.");
    const shelving = this.plugin.store.units().filter(
      (row) => row.status === "ready-to-shelve"
    );
    const needsMap = this.plugin.store.units().filter(
      (row) => !this.plugin.store.mapForUnit(row.id)
    );
    const inbox = this.plugin.store.data?.counts?.inbox_items || 0;
    const garden = this.plugin.store.gardenEntries();
    const list = root.createDiv({ cls: "los-review-list" });
    this.queue(
      list,
      "Ready to shelve",
      shelving.length,
      "Units whose working notes are ready to become durable knowledge.",
      shelving.length ? ["Review proposals", () => this.plugin.openShelving(shelving[0]?.id)] : null
    );
    this.queue(
      list,
      "Inbox",
      inbox,
      "Captured items the operator has not routed yet.",
      ["Open capture", () => this.plugin.openCapture()]
    );
    this.queue(
      list,
      "Needs a study map",
      needsMap.length,
      "Units with no current study script.",
      needsMap.length ? ["Open the queue", () => this.plugin.openProgram("queue-needs-map")] : null
    );
    this.queue(
      list,
      "Garden",
      garden.length,
      "Half-formed ideas gestating outside the canon; approved AI actions may help prepare them for shelving.",
      ["Open the Garden", () => this.plugin.openGarden()]
    );
    if (needsMap.length) {
      const detail = disclosure(root, `Units needing a map (${needsMap.length})`);
      const grid = detail.createDiv({ cls: "los-card-grid" });
      for (const unit of needsMap) unitCard(grid, this.plugin, unit);
    }
  }
  queue(parent, label, count, detail, action) {
    const row = parent.createDiv({ cls: "los-review-row" });
    const copy = row.createDiv({ cls: "los-review-copy" });
    const heading = copy.createDiv({ cls: "los-review-heading" });
    heading.createEl("strong", { text: label });
    if (count != null) heading.createSpan({ cls: "los-review-count", text: String(count) });
    copy.createDiv({ cls: "los-micro", text: detail });
    if (action) button(row, action[0], action[1], count ? "cta" : "quiet");
    else row.createSpan({ cls: "los-micro los-review-clear", text: "Nothing waiting" });
    return row;
  }
};
var DiagnosticsView = class extends import_obsidian15.ItemView {
  plugin;
  report = "";
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_DIAGNOSTICS;
  }
  getDisplayText() {
    return "LearningOS \xB7 Diagnostics";
  }
  getIcon() {
    return "activity";
  }
  async onOpen() {
    this.render();
  }
  buildInfo() {
    const fallback = {
      ui_version: this.plugin.uiVersion(),
      manifest_contract_version: CONTRACT_VERSION,
      source_revision: "unavailable",
      source_fingerprint: "unavailable",
      bundle_sha256: "unavailable",
      node_version: "unavailable"
    };
    try {
      const app = this.app;
      const base = app.vault.adapter.getBasePath();
      const pluginInfo = this.plugin.manifest ?? {};
      const directory = pluginInfo.dir || nodePath.join(
        ".obsidian",
        "plugins",
        pluginInfo.id || "learningos-ui"
      );
      const target = nodePath.join(
        base,
        directory,
        "build-info.json"
      );
      if (!fs.existsSync(target)) {
        return fallback;
      }
      const parsed = JSON.parse(
        fs.readFileSync(target, "utf8")
      );
      if (!isRecord8(parsed)) {
        return fallback;
      }
      return {
        ui_version: typeof parsed.ui_version === "string" ? parsed.ui_version : fallback.ui_version,
        manifest_contract_version: typeof parsed.manifest_contract_version === "number" ? parsed.manifest_contract_version : fallback.manifest_contract_version,
        source_revision: typeof parsed.source_revision === "string" ? parsed.source_revision : fallback.source_revision,
        source_fingerprint: typeof parsed.source_fingerprint === "string" ? parsed.source_fingerprint : fallback.source_fingerprint,
        bundle_sha256: typeof parsed.bundle_sha256 === "string" ? parsed.bundle_sha256 : fallback.bundle_sha256,
        node_version: typeof parsed.node_version === "string" ? parsed.node_version : fallback.node_version
      };
    } catch (_) {
      return fallback;
    }
  }
  state() {
    if (!this.plugin.store.ready) return ["?", "Core unavailable", this.plugin.store.error];
    if (this.plugin.store.data?._generated?.source_dirty) {
      return ["\u25CF", "Canonical files changed; projection is stale", "Rebuild to bring the interface back in step."];
    }
    return ["\u2713", "Valid and current", "The projection matches the canonical tree as of its last rebuild."];
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-diagnostics-view");
    pageHeader(root, "More", "Diagnostics");
    const [glyph, title, detail] = this.state();
    const status = root.createDiv({ cls: "los-diagnostic-status" });
    status.createSpan({ cls: "los-diagnostic-glyph", text: glyph });
    const copy = status.createDiv();
    copy.createEl("strong", { text: title });
    copy.createDiv({ cls: "los-micro", text: detail });
    const generated = this.plugin.store.data?._generated ?? {};
    const build = this.buildInfo();
    const facts = section(root, "Contract and versions");
    const table = facts.createDiv({ cls: "los-fact-list" });
    const factRows = [
      ["Manifest contract", generated.contract_version ?? "unknown"],
      ["UI expects contract", CONTRACT_VERSION],
      ["UI version", this.plugin.uiVersion()],
      ["UI source revision", build.source_revision],
      ["UI source fingerprint", build.source_fingerprint],
      ["UI bundle fingerprint", build.bundle_sha256],
      ["Build Node", build.node_version],
      ["Generator", generated.generator || "unknown"],
      ["Projection built", generated.generated_at || "unknown"],
      ["Snapshot", generated.snapshot_id || "unknown"],
      ["Source revision", generated.source_revision || "unknown"],
      ["Python interpreter", this.plugin.resolvePython().path],
      ["Interpreter source", this.plugin.resolvePython().origin]
    ];
    for (const [label, value] of factRows) {
      const row = table.createDiv({ cls: "los-fact-row" });
      row.createSpan({ cls: "los-fact-label", text: label });
      row.createSpan({ cls: "los-fact-value", text: String(value) });
    }
    const actions = root.createDiv({ cls: "los-actions" });
    button(actions, "Validate and rebuild", () => this.plugin.generate(), "cta");
    button(actions, "Test the interpreter", () => this.testInterpreter(), "quiet");
    button(actions, "Copy build identity", () => this.plugin.copyText(JSON.stringify(build, null, 2)), "quiet");
    if (this.report) root.createEl("pre", { cls: "los-diagnostic-report", text: this.report });
    const policy = section(root, "About LearningOS");
    policy.createEl("p", { text: OWNERSHIP_STATEMENT });
  }
  async testInterpreter() {
    const resolved = this.plugin.resolvePython();
    try {
      const result = await this.plugin.gateway.call(["status", "--json"]);
      this.report = `${resolved.path} (${resolved.origin})
Core answered: ${JSON.stringify(result).slice(0, 400)}`;
    } catch (error) {
      this.report = `${resolved.path} (${resolved.origin})
Failed: ${errorMessage6(error)}
Tried: ${resolved.attempted.join(", ")}`;
    }
    this.render();
  }
};

// src/views/shelving-view.ts
var import_obsidian16 = require("obsidian");
function errorMessage7(error) {
  return error instanceof Error ? error.message : String(error);
}
function isRecord9(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function optionalString(value) {
  return typeof value === "string" ? value : void 0;
}
function readShelvingProposal(value) {
  if (!isRecord9(value) || value.state !== "proposed" || !Array.isArray(value.items)) {
    return null;
  }
  const items = [];
  for (const candidate of value.items) {
    if (!isRecord9(candidate) || typeof candidate.id !== "string" || typeof candidate.title !== "string") {
      continue;
    }
    const item = {
      id: candidate.id,
      title: candidate.title,
      destination: optionalString(candidate.destination),
      rationale: optionalString(candidate.rationale),
      diff: optionalString(candidate.diff),
      selected: typeof candidate.selected === "boolean" ? candidate.selected : void 0
    };
    items.push(item);
  }
  return {
    state: "proposed",
    summary: optionalString(value.summary),
    items
  };
}
var ShelvingView = class extends import_obsidian16.ItemView {
  plugin;
  unitId = null;
  proposal = null;
  selected = /* @__PURE__ */ new Set();
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_SHELVING;
  }
  getDisplayText() {
    return "LearningOS \xB7 Shelving";
  }
  async setState(state = {}) {
    if (typeof state.unitId === "string") {
      this.unitId = state.unitId;
    }
    await this.loadProposal();
    this.render();
  }
  getState() {
    return { unitId: this.unitId };
  }
  async onOpen() {
    const unitId = this.leaf.state?.unitId;
    if (typeof unitId === "string") {
      this.unitId = unitId;
    }
    await this.loadProposal();
    this.render();
  }
  async loadProposal() {
    if (!this.unitId) {
      this.proposal = null;
      return;
    }
    const map = this.plugin.store.mapForUnit(this.unitId);
    this.proposal = readShelvingProposal(map?.shelving);
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-shelving-view");
    const unit = this.unitId ? this.plugin.store.get(this.unitId) : null;
    pageHeader(
      root,
      "Approval gate",
      "Shelving",
      unit ? `${unit.title}: review durable changes before the gateway applies them.` : "Choose a unit that is ready to shelve."
    );
    if (!unit) {
      this.renderQueue(root);
      return;
    }
    const map = this.plugin.store.mapForUnit(unit.id);
    const proposal = this.proposal ?? readShelvingProposal(map?.shelving);
    if (!proposal?.items?.length) {
      const wrap = section(root, "No proposal yet");
      empty(
        wrap,
        "Prepare a deterministic proposal",
        "The gateway derives candidates from this unit. AI may explain them, but cannot apply canonical changes.",
        "Prepare proposal",
        () => this.prepare()
      );
      button(wrap, "Ask AI to explain shelving criteria", () => this.plugin.askAiScoped(
        "Explain which stage notes might be durable. Do not write or apply canonical changes.",
        { moduleId: unit.module_id, unitId: unit.id }
      ), "quiet");
      return;
    }
    if (!this.selected.size) {
      for (const item of proposal.items) if (item.selected !== false) this.selected.add(item.id);
    }
    const summary = section(root, "Proposed changes", proposal.summary || "Select only changes you want to apply.");
    for (const item of proposal.items) {
      const row = summary.createDiv({ cls: "los-proposal-row" });
      const toggle = row.createEl("input", { attr: { type: "checkbox", "aria-label": `Select ${item.title}` } });
      toggle.checked = this.selected.has(item.id);
      toggle.addEventListener("change", () => {
        if (toggle.checked) this.selected.add(item.id);
        else this.selected.delete(item.id);
      });
      const copy = row.createDiv();
      copy.createEl("h3", { text: item.title });
      if (item.destination) copy.createDiv({ cls: "los-detail-id", text: item.destination });
      if (item.rationale) copy.createEl("p", { text: item.rationale });
      if (item.diff) copy.createEl("pre", { cls: "los-proposal-diff", text: item.diff });
    }
    const guard = root.createDiv({ cls: "los-validation-preview" });
    guard.createEl("strong", { text: "Apply is explicit and selected-only." });
    guard.createEl("p", { text: "The core validates and regenerates atomically; broad AI writes are never accepted." });
    const actions = root.createDiv({ cls: "los-actions" });
    button(actions, "Approve selected changes", () => this.apply(), "cta");
    button(actions, "Ask AI to review proposal", () => this.plugin.askAiScoped(
      `Review these shelving proposal IDs: ${[...this.selected].join(", ")}. Do not apply changes.`,
      { moduleId: unit.module_id, unitId: unit.id }
    ), "quiet");
  }
  renderQueue(root) {
    const wrap = section(root, "Ready to shelve");
    const rows = this.plugin.store.units().filter(
      (row) => row.status === "ready-to-shelve"
    );
    if (!rows.length) empty(wrap, "No unit is waiting", "Keep working from any active unit.");
    for (const unit of rows) unitCard(wrap, this.plugin, unit);
  }
  async prepare() {
    const unitId = this.unitId;
    if (!unitId) {
      new import_obsidian16.Notice("Choose a unit before preparing shelving.");
      return;
    }
    try {
      await this.plugin.mutate(
        () => this.plugin.gateway.prepareShelving(unitId)
      );
      await this.loadProposal();
      this.render();
    } catch (error) {
      new import_obsidian16.Notice(errorMessage7(error));
    }
  }
  async apply() {
    const unitId = this.unitId;
    if (!unitId) {
      new import_obsidian16.Notice("Choose a unit before applying shelving.");
      return;
    }
    if (!this.selected.size) {
      new import_obsidian16.Notice("Select at least one proposal.");
      return;
    }
    try {
      await this.plugin.mutate(
        () => this.plugin.gateway.applyShelving(
          unitId,
          [...this.selected]
        )
      );
      this.proposal = null;
      this.selected.clear();
      this.render();
    } catch (error) {
      new import_obsidian16.Notice(errorMessage7(error));
    }
  }
};

// src/views/unit-view.ts
var import_obsidian17 = require("obsidian");
var ARTIFACT_LABELS = [
  [
    "ultimate_reference",
    "Ultimate Reference"
  ],
  [
    "exercise_bank",
    "Exercise Bank"
  ],
  [
    "mock_exam",
    "Mock Exam"
  ]
];
function errorMessage8(error) {
  return error instanceof Error ? error.message : String(error);
}
function isRecord10(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function projectedString6(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}
function projectedText5(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  const text = String(value);
  return text.length ? text : null;
}
function projectedRecords4(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (candidate) => isRecord10(candidate)
  );
}
function projectedStrings5(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (candidate) => typeof candidate === "string" && candidate.length > 0
  );
}
function projectedLabel4(record, fallback = "Untitled") {
  if (!record) {
    return fallback;
  }
  return projectedString6(record.title) ?? projectedString6(record.label) ?? projectedString6(record.id) ?? fallback;
}
function readUnitViewState(value) {
  if (!isRecord10(value)) {
    return {
      hasStageId: false
    };
  }
  const hasStageId = Object.prototype.hasOwnProperty.call(
    value,
    "stageId"
  );
  const unitId = projectedString6(value.unitId) ?? void 0;
  const stageId = !hasStageId ? void 0 : value.stageId === null ? null : projectedString6(value.stageId);
  return {
    unitId,
    stageId,
    hasStageId
  };
}
function readUnitRecord(record, fallbackId) {
  if (!record) {
    return null;
  }
  const id = projectedString6(record.id) ?? fallbackId;
  const moduleId = projectedString6(record.module_id);
  if (!id || !moduleId) {
    return null;
  }
  return {
    record,
    id,
    moduleId,
    componentId: projectedString6(record.component_id),
    kind: projectedString6(record.kind) ?? "unit",
    title: projectedString6(record.title) ?? id,
    scope: projectedText5(record.scope) ?? ""
  };
}
function readResource(record) {
  const label = projectedString6(record.label) ?? projectedString6(record.title) ?? projectedString6(record.source_id) ?? "Resource";
  return {
    record,
    kind: projectedString6(record.kind) ?? "read",
    label,
    locator: projectedText5(record.locator),
    sourceId: projectedString6(record.source_id),
    canOpen: Boolean(
      projectedString6(record.material_path) ?? projectedString6(record.url) ?? projectedString6(record.vault_path)
    )
  };
}
function readStageAttachment(value) {
  if (typeof value === "string") {
    if (!value.length) {
      return null;
    }
    return {
      path: value,
      label: value.split("/").pop() || value
    };
  }
  if (!isRecord10(value)) {
    return null;
  }
  const path = projectedString6(value.path) ?? projectedString6(value.vault_path);
  if (!path) {
    return null;
  }
  return {
    path,
    label: projectedString6(value.label) ?? path
  };
}
function readStage(record) {
  const id = projectedString6(record.id);
  if (!id) {
    return null;
  }
  const attachments = Array.isArray(
    record.attachments
  ) ? record.attachments.map(readStageAttachment).filter(
    (attachment) => attachment !== null
  ) : [];
  return {
    record,
    id,
    title: projectedString6(record.title) ?? id,
    status: projectedString6(record.status) ?? "active",
    scopeTriage: projectedText5(record.scope_triage) ?? "",
    objective: projectedText5(record.objective),
    estimateMinutes: projectedText5(record.estimate_minutes),
    examCritical: record.exam_critical === true,
    resources: projectedRecords4(
      record.resources
    ).map(readResource),
    doneWhen: projectedStrings5(
      record.done_when
    ).filter(
      (criterion) => Boolean(criterion.trim())
    ),
    attachments,
    sourceFeedback: projectedRecords4(
      record.source_feedback
    )
  };
}
function readStudyMap(record) {
  const stages = projectedRecords4(
    record.stages
  ).map(readStage).filter(
    (stage) => stage !== null
  );
  return {
    record,
    currentStageId: projectedString6(
      record.current_stage
    ),
    stages,
    detours: projectedRecords4(record.detours)
  };
}
function readArtifacts(value) {
  if (!isRecord10(value)) {
    return {
      named: [],
      other: []
    };
  }
  const named = [];
  for (const [key] of ARTIFACT_LABELS) {
    const id = projectedString6(value[key]);
    if (id) {
      named.push([key, id]);
    }
  }
  return {
    named,
    other: projectedStrings5(value.other)
  };
}
function artifactLabel(key) {
  return ARTIFACT_LABELS.find(
    ([candidate]) => candidate === key
  )?.[1] ?? key;
}
function fallbackRecord(id) {
  return {
    id,
    type: "record",
    title: id
  };
}
var UnitView = class extends import_obsidian17.ItemView {
  plugin;
  unitId;
  stageId;
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.unitId = null;
    this.stageId = null;
  }
  getViewType() {
    return VIEW_UNIT;
  }
  getDisplayText() {
    return "LearningOS \xB7 Unit";
  }
  async setState(state = {}) {
    const parsed = readUnitViewState(state);
    const nextUnitId = parsed.unitId ?? this.unitId;
    if (nextUnitId !== this.unitId) {
      this.stageId = null;
    }
    this.unitId = nextUnitId;
    const requestedStageId = parsed.hasStageId ? parsed.stageId ?? null : null;
    const selectedStageId = this.unitId ? this.plugin.getSelectedStage(
      this.unitId
    ) : null;
    this.stageId = selectedStageId ?? requestedStageId ?? this.stageId;
    this.render();
  }
  getState() {
    return {
      unitId: this.unitId,
      stageId: this.stageId
    };
  }
  async onOpen() {
    const state = readUnitViewState(
      this.leaf.state
    );
    this.unitId = state.unitId ?? this.unitId;
    const selectedStageId = this.unitId ? this.plugin.getSelectedStage(
      this.unitId
    ) : null;
    this.stageId = selectedStageId ?? (state.hasStageId ? state.stageId ?? null : null) ?? this.stageId;
    this.render();
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass(
      "los-root",
      "los-unit-view"
    );
    const routeUnitId = this.unitId;
    const projectedUnit = routeUnitId ? this.plugin.store.get(
      routeUnitId
    ) : null;
    const unit = readUnitRecord(
      projectedUnit,
      routeUnitId
    );
    if (!unit) {
      empty(
        root,
        "Unit unavailable",
        "Return to its module."
      );
      return;
    }
    const module2 = this.plugin.store.get(
      unit.moduleId
    );
    const project = this.plugin.store.projectForUnit(
      unit.record
    );
    const ownerLabel = projectedLabel4(
      project,
      projectedLabel4(
        module2,
        unit.moduleId
      )
    );
    const header = pageHeader(
      root,
      `${ownerLabel} \xB7 ${unit.kind}`,
      unit.title,
      unit.scope
    );
    const headerActions = header.createDiv({
      cls: "los-actions"
    });
    if (project) {
      button(
        headerActions,
        "Back to project",
        () => this.plugin.back(),
        "quiet"
      );
    } else {
      button(
        headerActions,
        "Back to module",
        () => this.plugin.openModule(
          unit.moduleId
        ),
        "quiet"
      );
    }
    const projectedStudyMap = this.plugin.store.mapForUnit(
      unit.id
    );
    if (!projectedStudyMap) {
      const missing = section(
        root,
        "Study map needed"
      );
      const projectId = projectedString6(project?.id) ?? void 0;
      const componentId = unit.componentId ?? void 0;
      empty(
        missing,
        "This unit has no current study script",
        "AI may propose a scoped map; the core imports it only after review.",
        "Create map with AI",
        () => this.plugin.askAiScoped(
          "Propose one study-map JSON document for this unit. Do not write files; include exact source actions and done-when criteria.",
          {
            moduleId: unit.moduleId,
            projectId,
            unitId: unit.id,
            componentId
          }
        )
      );
      this.renderArtifacts(
        root,
        unit
      );
      return;
    }
    const studyMap = readStudyMap(
      projectedStudyMap
    );
    const firstStage = studyMap.stages[0];
    if (!firstStage) {
      const bare = section(
        root,
        "Study map needs stages"
      );
      empty(
        bare,
        "This study map has no stages yet",
        "Stage authoring belongs to the core \u2014 import a map or add stages there, then rebuild views."
      );
      this.renderArtifacts(
        root,
        unit
      );
      return;
    }
    const stageIds = new Set(
      studyMap.stages.map(
        (stage2) => stage2.id
      )
    );
    if (!this.stageId || !stageIds.has(this.stageId)) {
      this.stageId = studyMap.currentStageId && stageIds.has(
        studyMap.currentStageId
      ) ? studyMap.currentStageId : firstStage.id;
      this.plugin.setSelectedStage(
        unit.id,
        this.stageId
      );
    }
    const stage = studyMap.stages.find(
      (candidate) => candidate.id === this.stageId
    ) ?? firstStage;
    const layout = root.createDiv({
      cls: "los-unit-layout"
    });
    this.renderRail(
      layout,
      unit,
      studyMap,
      stage
    );
    this.renderStage(
      layout,
      unit,
      studyMap,
      stage
    );
    this.renderActionBar(
      root,
      unit,
      stage
    );
    const more = disclosure(
      root,
      "Unit artifacts and evidence",
      "los-unit-extras"
    );
    this.renderArtifacts(
      more,
      unit
    );
  }
  renderRail(layout, unit, studyMap, current) {
    const rail = layout.createDiv({
      cls: "los-stage-rail"
    });
    rail.createEl("h2", {
      text: "Stages"
    });
    for (const [index, stage] of studyMap.stages.entries()) {
      const selected = stage.id === current.id;
      const row = rail.createEl(
        "button",
        {
          cls: `los-stage-row los-s-${stage.status} ${selected ? "is-selected" : ""} is-clickable`,
          attr: {
            type: "button",
            "aria-current": selected ? "step" : "false"
          }
        }
      );
      row.createSpan({
        cls: "los-stage-index",
        text: String(index + 1).padStart(2, "0")
      });
      const copy = row.createSpan({
        cls: "los-stage-copy"
      });
      copy.createSpan({
        text: stage.title
      });
      const marker = stage.status === "complete" ? "Complete" : stage.status === "skipped" ? "Skipped" : "";
      if (marker) {
        copy.createSpan({
          cls: "los-micro",
          text: marker
        });
      }
      row.addEventListener(
        "click",
        () => {
          void this.selectStage(
            stage.id
          );
        }
      );
    }
    const stageRecords = studyMap.stages.map(
      (stage) => stage.record
    );
    const add = button(
      rail,
      "Add note",
      () => this.plugin.openUnitNote(
        unit.record,
        studyMap.record
      ),
      "quiet"
    );
    add.addClass(
      "los-add-unit-note"
    );
    const draft = this.plugin.getUnitNoteDraft(
      unit.id,
      stageRecords
    );
    if (typeof draft.text === "string" && draft.text.trim()) {
      rail.createDiv({
        cls: "los-micro los-unit-note-draft",
        text: "Unsaved unit-note draft kept locally."
      });
    }
  }
  renderStage(layout, unit, studyMap, stage) {
    const center = layout.createDiv({
      cls: "los-stage-workspace"
    });
    const top = center.createDiv({
      cls: "los-stage-heading"
    });
    top.createDiv({
      cls: "los-kicker",
      text: stage.examCritical ? "Exam-critical stage" : stage.scopeTriage
    });
    top.createEl("h2", {
      text: stage.title
    });
    if (stage.objective) {
      const goal = center.createDiv({
        cls: "los-stage-goal"
      });
      goal.createDiv({
        cls: "los-kicker",
        text: "Goal"
      });
      goal.createEl("p", {
        text: stage.objective
      });
    }
    if (stage.estimateMinutes) {
      badge(
        top,
        `${stage.estimateMinutes} min`,
        "role"
      );
    }
    const resources = section(
      center,
      "Resources"
    );
    if (!stage.resources.length) {
      empty(
        resources,
        "No source action selected",
        "Use the unit scope and ask AI for a proposal."
      );
    }
    for (const resource of stage.resources) {
      const row = resources.createDiv({
        cls: "los-resource-row"
      });
      const iconName = resource.kind === "watch" ? "play" : resource.kind === "practise" ? "pencil-line" : "book-open";
      icon(
        row.createSpan(),
        iconName
      );
      const copy = row.createDiv({
        cls: "los-resource-copy"
      });
      copy.createEl("strong", {
        text: resource.label
      });
      if (resource.locator) {
        copy.createDiv({
          cls: "los-micro",
          text: resource.locator
        });
      }
      if (resource.sourceId) {
        const source = this.plugin.store.get(
          resource.sourceId
        );
        if (source) {
          chip(
            copy,
            source,
            (record) => {
              const recordId = projectedString6(record.id);
              return recordId ? this.plugin.openLibrary(
                recordId
              ) : void 0;
            }
          );
        }
      }
      const actions = row.createDiv({
        cls: "los-actions los-resource-actions"
      });
      if (resource.canOpen) {
        button(
          actions,
          "Open",
          () => this.plugin.openResource(
            resource.record
          ),
          "quiet"
        );
      }
      if (resource.sourceId) {
        const sourceId = resource.sourceId;
        const menuItems = [
          [
            "Helpful",
            () => this.mutate(
              () => this.plugin.gateway.feedback(
                unit.id,
                stage.id,
                sourceId,
                "helpful"
              )
            )
          ],
          [
            "Too advanced",
            () => this.mutate(
              () => this.plugin.gateway.feedback(
                unit.id,
                stage.id,
                sourceId,
                "too-advanced"
              )
            )
          ],
          [
            "Useful for review",
            () => this.mutate(
              () => this.plugin.gateway.feedback(
                unit.id,
                stage.id,
                sourceId,
                "useful-for-review"
              )
            )
          ]
        ];
        overflowMenu(
          actions,
          menuItems,
          `Rate ${resource.label}`
        );
      }
    }
    if (stage.doneWhen.length) {
      const done = section(
        center,
        "Done when"
      );
      const marks = this.plugin.getDoneWhen(
        unit.id,
        stage.id
      );
      const list = done.createDiv({
        cls: "los-donewhen-list"
      });
      for (const [index, criterion] of stage.doneWhen.entries()) {
        const row = list.createEl(
          "label",
          {
            cls: "los-donewhen-row"
          }
        );
        const box = row.createEl(
          "input",
          {
            attr: {
              type: "checkbox",
              "aria-label": criterion
            }
          }
        );
        const checked = Boolean(marks[index]);
        if (checked) {
          box.setAttr(
            "checked",
            "checked"
          );
        }
        box.checked = checked;
        box.addEventListener(
          "change",
          () => {
            const nextChecked = Boolean(box.checked);
            this.plugin.setDoneWhen(
              unit.id,
              stage.id,
              index,
              nextChecked
            );
            row.toggleClass(
              "is-checked",
              nextChecked
            );
          }
        );
        row.toggleClass(
          "is-checked",
          checked
        );
        row.createSpan({
          text: criterion
        });
      }
    }
    this.renderStageContext(
      center,
      unit,
      studyMap,
      stage
    );
  }
  /**
   * One primary action and one menu. The primary is filled; nothing else on
   * this screen may be.
   */
  renderActionBar(root, unit, stage) {
    const bar = root.createDiv({
      cls: "los-unit-actionbar"
    });
    button(
      bar,
      "Mark complete",
      () => this.mutate(
        () => this.plugin.gateway.progress(
          unit.id,
          stage.id,
          "complete"
        ),
        () => this.plugin.clearDoneWhen(
          unit.id,
          stage.id
        )
      ),
      "cta"
    );
    const menuItems = [
      stage.status !== "active" && [
        "Revisit stage",
        () => this.mutate(
          () => this.plugin.gateway.progress(
            unit.id,
            stage.id,
            "revisit"
          )
        )
      ],
      [
        "Pause unit",
        () => this.mutate(
          () => this.plugin.gateway.progress(
            unit.id,
            stage.id,
            "paused"
          )
        )
      ],
      [
        "Skip stage",
        () => this.mutate(
          () => this.plugin.gateway.progress(
            unit.id,
            stage.id,
            "skipped"
          )
        )
      ],
      [
        "Report prerequisite gap",
        () => this.mutate(
          () => this.plugin.gateway.detour(
            unit.id,
            stage.id,
            "Prerequisite gap",
            "required-now"
          )
        )
      ],
      [
        "Prepare shelving",
        () => this.plugin.openShelving(
          unit.id
        )
      ],
      this.plugin.settings.showAiRecommendation && [
        "Ask AI with stage context",
        () => {
          const project = this.plugin.store.projectForUnit(
            unit.record
          );
          const projectId = projectedString6(project?.id) ?? void 0;
          return this.plugin.askAiScoped(
            "Help with this stage. Treat the active file as supplementary context only.",
            {
              moduleId: unit.moduleId,
              projectId,
              unitId: unit.id,
              stageId: stage.id
            }
          );
        }
      ],
      [
        "End learning session",
        () => this.plugin.reviewSessionEnd()
      ]
    ];
    overflowMenu(
      bar,
      menuItems,
      "More unit actions"
    );
  }
  renderStageContext(center, unit, studyMap, stage) {
    const detours = studyMap.detours.filter(
      (row) => projectedString6(
        row.spawned_by_stage
      ) === stage.id && projectedString6(
        row.status
      ) !== "resolved" && projectedString6(
        row.id
      ) !== null
    );
    if (!stage.attachments.length && !detours.length && !stage.sourceFeedback.length) {
      return;
    }
    const detail = disclosure(
      center,
      "Stage context"
    );
    for (const attachment of stage.attachments) {
      button(
        detail,
        attachment.label,
        () => this.plugin.openAuthoredPath(
          attachment.path
        ),
        "quiet"
      );
    }
    for (const detour of detours) {
      const detourId = projectedString6(detour.id);
      if (!detourId) {
        continue;
      }
      const title = projectedString6(detour.title) ?? "Prerequisite detour";
      const classification = projectedString6(
        detour.classification
      ) ?? "required-now";
      const row = detail.createDiv({
        cls: "los-detour-row"
      });
      row.createEl("strong", {
        text: "Open prerequisite detour"
      });
      row.createEl("p", {
        text: `${title} \xB7 ${classification} \xB7 returns here`
      });
      button(
        row,
        "Resolve and return",
        () => this.mutate(
          () => this.plugin.gateway.resolveDetour(
            unit.id,
            detourId,
            "Resolved from the unit workspace."
          )
        ),
        "quiet"
      );
    }
    for (const feedback of stage.sourceFeedback) {
      const sourceId = projectedString6(
        feedback.source_id
      ) ?? "Unknown source";
      const value = projectedText5(
        feedback.feedback
      ) ?? "Feedback recorded";
      detail.createDiv({
        cls: "los-row",
        text: `${sourceId} \xB7 ${value}`
      });
    }
  }
  renderArtifacts(root, unit) {
    const wrap = section(
      root,
      "Unit artifacts",
      "Durable notes remain globally canonical; this unit owns stable references."
    );
    const artifacts = readArtifacts(
      unit.record.artifacts
    );
    let count = 0;
    for (const [key, id] of artifacts.named) {
      count += 1;
      const card = wrap.createDiv({
        cls: "los-artifact-card"
      });
      card.createEl("h3", {
        text: artifactLabel(key)
      });
      const record = this.plugin.store.get(id) ?? fallbackRecord(id);
      chip(
        card,
        record,
        (selected) => this.plugin.openRecord(
          selected
        )
      );
    }
    for (const id of artifacts.other) {
      count += 1;
      const record = this.plugin.store.get(id) ?? fallbackRecord(id);
      chip(
        wrap,
        record,
        (selected) => this.plugin.openRecord(
          selected
        )
      );
    }
    if (!count) {
      empty(
        wrap,
        "No durable artifact linked yet",
        "Working notes stay with the stage until shelving is approved."
      );
    }
  }
  /**
   * Every write goes through the plugin-wide queue, so two clicks in two views
   * can no longer race the same `--expected-snapshot`.
   */
  async mutate(action, onConfirmed = null) {
    if (this.plugin.gateway.isBusy) {
      new import_obsidian17.Notice(
        "A LearningOS write is already running."
      );
      return;
    }
    try {
      await this.plugin.mutate(
        action
      );
      onConfirmed?.();
      this.render();
    } catch (error) {
      new import_obsidian17.Notice(
        errorMessage8(error)
      );
    }
  }
  async selectStage(stageId) {
    const unitId = this.unitId;
    if (!unitId) {
      new import_obsidian17.Notice(
        "This unit is no longer available."
      );
      return;
    }
    this.stageId = stageId;
    this.plugin.setSelectedStage(
      unitId,
      stageId
    );
    await this.leaf.setViewState({
      type: VIEW_UNIT,
      active: true,
      state: {
        unitId,
        stageId
      }
    });
  }
};

// src/main.ts
function errorMessage9(error) {
  return error instanceof Error ? error.message : String(error);
}
var LearningOSUI = class extends import_obsidian18.Plugin {
  draftSaveTimer = null;
  lastAiPrompt = "";
  async onload() {
    const loadedSettings = await this.loadData();
    const savedSettings = loadedSettings ?? {};
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...savedSettings,
      uiDrafts: savedSettings.uiDrafts ?? {
        stages: {},
        unitNotes: {},
        selectedStages: {},
        inbox: {
          title: "",
          text: ""
        },
        doneWhen: {}
      }
    };
    this.settings.uiDrafts ||= { stages: {}, unitNotes: {}, selectedStages: {}, inbox: { title: "", text: "" }, doneWhen: {} };
    this.settings.uiDrafts.stages ||= {};
    this.settings.uiDrafts.unitNotes ||= {};
    this.settings.uiDrafts.selectedStages ||= {};
    this.settings.uiDrafts.inbox ||= { title: "", text: "" };
    this.settings.uiDrafts.doneWhen ||= {};
    this.draftSaveTimer = null;
    for (const type of LEGACY_VIEW_TYPES) this.app.workspace.detachLeavesOfType(type);
    this.store = new ManifestStore(this.app);
    this.gateway = new GatewayClient(this);
    this.aiActions = new AIActionClient(this);
    this.router = new ApplicationRouter(this);
    await this.store.load();
    this.registerView(VIEW_HOME, (leaf) => new HomeView(leaf, this));
    this.registerView(VIEW_NAV, (leaf) => new NavView(leaf, this));
    this.registerView(VIEW_PROGRAM, (leaf) => new ProgramView(leaf, this));
    this.registerView(VIEW_MODULE, (leaf) => new ModuleView(leaf, this));
    this.registerView(VIEW_PROJECT, (leaf) => new ProjectView(leaf, this));
    this.registerView(VIEW_UNIT, (leaf) => new UnitView(leaf, this));
    this.registerView(VIEW_LIBRARY, (leaf) => new LibraryView(leaf, this));
    this.registerView(VIEW_ATLAS, (leaf) => new AtlasView(leaf, this));
    this.registerView(VIEW_SHELVING, (leaf) => new ShelvingView(leaf, this));
    this.registerView(VIEW_BOUNDARY, (leaf) => new BoundaryView(leaf, this));
    this.registerView(VIEW_REVIEW, (leaf) => new ReviewView(leaf, this));
    this.registerView(VIEW_GARDEN, (leaf) => new GardenView(leaf, this));
    this.registerView(VIEW_DIAGNOSTICS, (leaf) => new DiagnosticsView(leaf, this));
    this.addSettingTab(new LearningOSSettingsTab(this.app, this));
    this.addRibbonIcon("route", "Open LearningOS", () => this.openHome());
    this.addCommand({ id: "open-home", name: "Open Home", callback: () => this.openHome() });
    this.addCommand({ id: "open-current-stage", name: "Open current stage", callback: () => this.openResume() });
    this.addCommand({ id: "open-modules", name: "Open Modules", callback: () => this.openModules() });
    this.addCommand({ id: "open-projects", name: "Open Projects", callback: () => this.openProjects() });
    this.addCommand({ id: "open-library", name: "Open Library", callback: () => this.openLibrary() });
    this.addCommand({ id: "open-global-search", name: "Search LearningOS", callback: () => this.openGlobalSearch() });
    this.addCommand({ id: "open-atlas", name: "Open Domain atlas", callback: () => this.openAtlas() });
    this.addCommand({ id: "open-garden", name: "Open Garden", callback: () => this.openGarden() });
    this.addCommand({ id: "rebuild-projection", name: "Validate and rebuild projection", callback: () => this.generate() });
    this.addCommand({ id: "end-learning-session", name: "End learning session safely", callback: () => this.reviewSessionEnd() });
    this.app.workspace.onLayoutReady(async () => {
      for (const type of LEGACY_VIEW_TYPES) this.app.workspace.detachLeavesOfType(type);
      await this.router.openNavigator();
      if (this.settings.collapseSidebars) this.app.workspace.rightSplit?.collapse();
      if (this.settings.openHomeOnStartup) await this.router.restore();
    });
  }
  onunload() {
    if (this.draftSaveTimer) clearTimeout(this.draftSaveTimer);
    void this.saveData(this.settings);
    for (const type of [
      VIEW_HOME,
      VIEW_NAV,
      VIEW_PROGRAM,
      VIEW_MODULE,
      VIEW_PROJECT,
      VIEW_UNIT,
      VIEW_LIBRARY,
      VIEW_ATLAS,
      VIEW_SHELVING,
      VIEW_BOUNDARY,
      VIEW_REVIEW,
      VIEW_GARDEN,
      VIEW_DIAGNOSTICS
    ]) this.app.workspace.detachLeavesOfType(type);
  }
  scheduleDraftSave() {
    if (this.draftSaveTimer) clearTimeout(this.draftSaveTimer);
    this.draftSaveTimer = setTimeout(() => {
      this.draftSaveTimer = null;
      void this.saveData(this.settings);
    }, 250);
  }
  stageDraftKey(unitId, stageId) {
    return `${unitId}::${stageId}`;
  }
  getStageDraft(unitId, stageId, savedText = "") {
    const key = this.stageDraftKey(unitId, stageId);
    const entry = this.settings.uiDrafts.stages[key];
    return { text: entry?.text ?? savedText, dirty: entry != null && entry.text !== savedText };
  }
  setStageDraft(unitId, stageId, text, savedText = "") {
    const key = this.stageDraftKey(unitId, stageId);
    if (text === savedText) delete this.settings.uiDrafts.stages[key];
    else this.settings.uiDrafts.stages[key] = { text };
    this.scheduleDraftSave();
  }
  clearStageDraft(unitId, stageId) {
    delete this.settings.uiDrafts.stages[this.stageDraftKey(unitId, stageId)];
    this.scheduleDraftSave();
  }
  getUnitNoteDraft(unitId, stages = []) {
    const saved = this.settings.uiDrafts.unitNotes[unitId];
    const recovered = [];
    for (const stage of stages || []) {
      const entry = this.settings.uiDrafts.stages[this.stageDraftKey(unitId, stage.id)];
      if (entry?.text?.trim()) recovered.push({ id: stage.id, title: stage.title || stage.id, text: entry.text });
    }
    const recoveredText = recovered.map((row) => `### ${row.title}

${row.text.trim()}`).join("\n\n");
    const savedText = String(saved?.text || "").trim();
    return {
      title: saved?.title || (recovered.length ? "Recovered stage drafts" : ""),
      text: [savedText, recoveredText].filter(Boolean).join("\n\n"),
      recoveredStageIds: recovered.map((row) => row.id)
    };
  }
  setUnitNoteDraft(unitId, title, text) {
    if (!String(title || "").trim() && !String(text || "").trim()) delete this.settings.uiDrafts.unitNotes[unitId];
    else this.settings.uiDrafts.unitNotes[unitId] = { title, text };
    this.scheduleDraftSave();
  }
  clearUnitNoteDraft(unitId, recoveredStageIds = []) {
    delete this.settings.uiDrafts.unitNotes[unitId];
    for (const stageId of recoveredStageIds || []) {
      delete this.settings.uiDrafts.stages[this.stageDraftKey(unitId, stageId)];
    }
    this.scheduleDraftSave();
  }
  openUnitNote(unit, studyMap) {
    const modal = new UnitNoteModal(this.app, this, unit, studyMap);
    modal.open();
    return modal;
  }
  getSelectedStage(unitId) {
    return this.settings.uiDrafts.selectedStages[unitId] || null;
  }
  setSelectedStage(unitId, stageId) {
    if (stageId) this.settings.uiDrafts.selectedStages[unitId] = stageId;
    else delete this.settings.uiDrafts.selectedStages[unitId];
    this.scheduleDraftSave();
  }
  /** Done-when ticks are UI-owned working state: they help the learner see how
   *  far through a stage's criteria they are, and are never a second record of
   *  completion. The core still learns only "complete" from `stage-progress`. */
  getDoneWhen(unitId, stageId) {
    return this.settings.uiDrafts.doneWhen[this.stageDraftKey(unitId, stageId)] || [];
  }
  setDoneWhen(unitId, stageId, index, checked) {
    const key = this.stageDraftKey(unitId, stageId);
    const marks = [
      ...this.settings.uiDrafts.doneWhen[key] || []
    ];
    marks[index] = checked;
    if (marks.some(Boolean)) this.settings.uiDrafts.doneWhen[key] = marks;
    else delete this.settings.uiDrafts.doneWhen[key];
    this.scheduleDraftSave();
  }
  clearDoneWhen(unitId, stageId) {
    delete this.settings.uiDrafts.doneWhen[this.stageDraftKey(unitId, stageId)];
    this.scheduleDraftSave();
  }
  getInboxDraft() {
    return { ...this.settings.uiDrafts.inbox };
  }
  setInboxDraft(title, text) {
    this.settings.uiDrafts.inbox = { title, text };
    this.scheduleDraftSave();
  }
  clearInboxDraft() {
    this.settings.uiDrafts.inbox = { title: "", text: "" };
    this.scheduleDraftSave();
  }
  /**
   * Interpreter resolution, in order: an explicitly configured path, the POSIX
   * venv, the Windows venv, then the PATH names. Reported rather than guessed —
   * when a write button dies, Diagnostics has to be able to say which binary
   * was tried and where it looked.
   */
  /** The plugin's own version, kept off the `manifest.` access path so the
   *  contract-key test cannot mistake it for a projection field. */
  uiVersion() {
    const info = this.manifest;
    return info?.version || "unknown";
  }
  resolvePython() {
    const base = this.app.vault.adapter.getBasePath();
    const configured = String(this.settings.pythonPath || "").trim();
    const searchOrder = [
      [configured, "configured in settings"],
      [nodePath2.join(base, ".venv", "bin", "python"), "project virtual environment"],
      [nodePath2.join(base, ".venv", "Scripts", "python.exe"), "project virtual environment (Windows)"]
    ];
    const candidates = searchOrder.filter(([path]) => path);
    const attempted = candidates.map(([path]) => path);
    for (const [path, origin] of candidates) {
      if (fs2.existsSync(path)) return { path, origin, attempted };
    }
    const fallback = import_node_process.default?.platform === "win32" ? "python" : "python3";
    return { path: fallback, origin: "PATH fallback", attempted: [...attempted, fallback] };
  }
  /**
   * Run the CLI. `stdin` carries a capability envelope when there is one.
   *
   * Envelopes go down stdin rather than a `--payload-file` temp file: a temp
   * file would put canonical intent on disk on every write, including the
   * ones that fail, leaving cleanup as a thing that can be forgotten.
   */
  runLos(args, callback, stdin) {
    const base = this.app.vault.adapter.getBasePath();
    const python = this.resolvePython().path;
    const script = nodePath2.join(base, "tools", "los.py");
    const child = (0, import_node_child_process.execFile)(
      python,
      [script, ...args],
      { cwd: base, timeout: 18e4, maxBuffer: 8 * 1024 * 1024 },
      callback
    );
    if (stdin !== void 0) {
      child.stdin?.end(stdin);
    }
  }
  async reloadStore() {
    const ok = await this.store.load();
    if (!ok) throw new Error(this.store.error);
    this.app.workspace.iterateAllLeaves(
      (leaf) => leaf.view?.render?.()
    );
  }
  /** The active destination is a display fact, so the Navigator is the only
   *  thing it redraws — never the working view the learner is reading. */
  setActiveNav(key) {
    this.activeNav = key;
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_NAV)) leaf.view?.render?.();
  }
  async openNav() {
    return this.router.openNavigator();
  }
  async openHome() {
    return this.router.navigate({ name: "home" });
  }
  /** Learn is one destination; the areas are sub-areas inside it. */
  openLearn(programId = null) {
    const area = programId || this.settings.learnArea || LEARN_AREAS[0][0];
    this.settings.learnArea = area;
    this.scheduleDraftSave();
    return this.router.navigate({ name: "learn", programId: area });
  }
  openCapture() {
    return this.router.navigate({ name: "capture" });
  }
  openReview() {
    return this.router.navigate({ name: "review" });
  }
  openGarden() {
    return this.router.navigate({ name: "garden" });
  }
  openDiagnostics() {
    return this.router.navigate({ name: "diagnostics" });
  }
  openGlobalSearch(query = "") {
    const modal = new GlobalSearchModal(this.app, this, query);
    modal.open();
    return modal;
  }
  openProgram(programId) {
    return this.router.navigate({ name: "program", programId });
  }
  openModules() {
    return this.router.navigate({ name: "module-groups" });
  }
  openProjects(query = "") {
    return this.router.navigate({ name: "project-list", query });
  }
  openProject(projectId, tab = "overview") {
    const current = this.router.snapshot().current;
    const changingTab = current?.name === "project-detail" && current.projectId === projectId;
    return this.router.navigate(
      { name: "project-detail", projectId, tab: asProjectDetailTab(tab) },
      { pushHistory: !changingTab }
    );
  }
  openModuleGroup(groupId, query = "") {
    return this.router.navigate({ name: "module-list", groupId, query });
  }
  openModuleDetail(moduleId, componentId = null, tab = null) {
    return this.router.navigate({ name: "module-detail", moduleId, componentId, tab });
  }
  /** Compatibility alias used by Learn, Home and existing deep links. */
  openModule(moduleId, componentId = null) {
    return this.openModuleDetail(moduleId, componentId);
  }
  openUnit(unitId, stageId = null) {
    const selectedStage = stageId || this.getSelectedStage(unitId);
    if (selectedStage) this.setSelectedStage(unitId, selectedStage);
    return this.router.navigate({ name: "unit", unitId, stageId: selectedStage });
  }
  openLibrary(recordId = void 0, recordType = void 0) {
    if (recordId === void 0 || recordId === null) {
      return this.openLibraryHome(recordType === "topic-pack" ? "topic-packs" : "sources");
    }
    const record = this.store.get(recordId);
    if (record?.type === "source" || recordType === "source") return this.openSourceDetail(recordId);
    if (record?.type === "topic-pack" || recordType === "topic-pack") return this.openTopicPackDetail(recordId);
    if (record?.type === "collection" || recordType === "collection") return this.openCatalogueDetail(recordId);
    return this.router.navigate({ name: "legacy-library-list", recordType: recordType || record?.type || "note", query: "" });
  }
  openLibraryHome(collection = "sources") {
    return this.router.navigate({ name: "library-home", collection: asLibraryCollection(collection) });
  }
  openLibraryGroup(collection, groupId, query = "", facet = "all") {
    return this.router.navigate({
      name: "library-group",
      collection: asLibraryCollection(collection),
      groupId,
      query,
      facet
    });
  }
  openSourceDetail(resourceId, fromGroupId = null, query = "", facet = "all") {
    return this.router.navigate({ name: "source-detail", resourceId, fromGroupId, query, facet });
  }
  openTopicPackDetail(topicPackId, fromGroupId = null, query = "") {
    return this.router.navigate({ name: "topic-pack-detail", topicPackId, fromGroupId, query });
  }
  openCatalogueDetail(catalogueId) {
    return this.router.navigate({ name: "catalogue-detail", catalogueId });
  }
  /** Hidden compatibility surface used by Atlas and pre-migration deep links. */
  openLibraryFiltered(recordType, domain = "") {
    return this.router.navigate({ name: "legacy-library-list", recordType, domain, query: "" });
  }
  openAtlas(domain = null) {
    return this.router.navigate({ name: "atlas", domain });
  }
  openShelving(unitId = null) {
    return this.router.navigate({ name: "shelving", unitId });
  }
  openBoundary(boundaryId) {
    return this.router.navigate({ name: "boundary", boundaryId });
  }
  back() {
    return this.router.back();
  }
  openResume() {
    const pointer = this.store.data?.resume_pointer;
    return pointer ? this.openUnit(pointer.unit_id, pointer.stage_id) : this.openHome();
  }
  openFullTextSearch(query = "") {
    const ok = this.app.commands?.executeCommandById?.("omnisearch:show-modal");
    if (!ok) new import_obsidian18.Notice("Omnisearch is unavailable; structural Library search still works.");
    else if (query.trim()) {
      let attempts = 0;
      const transfer = () => {
        const input = [...document.querySelectorAll(".prompt-input")].find((candidate) => candidate.offsetParent !== null);
        if (!input && attempts++ < 20) {
          setTimeout(transfer, 50);
          return;
        }
        if (!input || input.value) return;
        input.value = query;
        input.dispatchEvent(new InputEvent("input", {
          bubbles: true,
          inputType: "insertText",
          data: query
        }));
        input.focus();
      };
      setTimeout(transfer, 50);
    }
  }
  /**
   * One transaction at a time, across every view. A per-view `busy` flag only
   * ever protected the view that owned it — a stage completion and an inbox
   * capture started from different leaves could still overlap, each carrying an
   * `--expected-snapshot` the other had already invalidated.
   */
  async mutate(action, { reload = true, healStaleProjection = true } = {}) {
    return this.gateway.enqueue(async () => {
      try {
        const result = await action();
        if (reload) await this.reloadStore();
        return result;
      } catch (error) {
        if (!healStaleProjection || !isProjectionConflict(error)) throw error;
        return this.rebuildAndRetry(action, reload);
      }
    });
  }
  /**
   * The core refuses a write whose snapshot is behind the authored tree and
   * says "reload before writing" — but the app's reload re-reads
   * `generated/manifest.json`, which is exactly as stale as the snapshot that
   * was just refused. Only rebuilding the projection moves it forward.
   *
   * This is the normal case, not an edge one: planning happens in Claude, so
   * canonical files change between app sessions by design. Without this the
   * first write after any authoring session fails, and the advice on screen
   * does not fix it.
   *
   * Retrying is safe because a conflict is refused whole — partial application
   * of a validated transaction is a forbidden operation in the core's
   * capability contract, so nothing was written to repeat.
   */
  async rebuildAndRetry(action, reload) {
    new import_obsidian18.Notice("Canonical files changed since this view loaded \u2014 rebuilding the projection, then retrying.");
    await this.gateway.call(["generate"], { expectJson: false });
    await this.reloadStore();
    const result = await action();
    if (reload) await this.reloadStore();
    return result;
  }
  async generate() {
    try {
      await this.mutate(async () => {
        await this.gateway.call(["validate"], { expectJson: false });
        await this.gateway.call(["generate"], { expectJson: false });
      });
      new import_obsidian18.Notice("LearningOS projection rebuilt.");
    } catch (error) {
      new import_obsidian18.Notice(errorMessage9(error));
    }
  }
  async reviewSessionEnd() {
    try {
      const review = asSessionReview(await this.gateway.endSession());
      new SessionEndModal(this.app, this, review).open();
      return review;
    } catch (error) {
      new import_obsidian18.Notice(errorMessage9(error));
      return null;
    }
  }
  /**
   * Hard rule 10 (core CLAUDE.md §13): `Job/` is quarantined. This is its
   * mechanical enforcement. A `Job/…` path never leaves the vault, so the
   * escape checks in the open helpers below cannot catch it — and every open
   * funnels through one of them.
   */
  isQuarantinedPath(path) {
    const posix = String(path || "").replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
    return posix === "Job" || posix.startsWith("Job/") || posix.includes("/Job/");
  }
  refuseQuarantined(path) {
    if (!this.isQuarantinedPath(path)) return false;
    new import_obsidian18.Notice("Job/ is quarantined \u2014 LearningOS never opens or displays it.");
    return true;
  }
  async openVaultPath(path) {
    if (this.refuseQuarantined(path)) return;
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file) {
      new import_obsidian18.Notice(`File unavailable: ${path}`);
      return;
    }
    let existing = null;
    this.app.workspace.iterateAllLeaves((leaf2) => {
      if (!existing && leaf2.view?.file?.path === path) existing = leaf2;
    });
    if (existing) {
      this.app.workspace.revealLeaf(existing);
      this.app.workspace.setActiveLeaf?.(existing, { focus: true });
      return existing;
    }
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.openFile(file);
    return leaf;
  }
  async openExternalPath(path, successMessage = "Opened in the default app.") {
    if (this.refuseQuarantined(path)) return false;
    if (!path || !fs2.existsSync(path)) {
      new import_obsidian18.Notice(`File unavailable: ${path || "unknown path"}`);
      return false;
    }
    const error = await import_electron2.shell.openPath(path);
    if (error) {
      new import_obsidian18.Notice(`Could not open file: ${error}`);
      return false;
    }
    new import_obsidian18.Notice(successMessage);
    return true;
  }
  openMaterialPath(path) {
    const vault = this.app.vault.adapter.getBasePath();
    const learningRoot = nodePath2.dirname(vault);
    const materialsRoot = nodePath2.resolve(learningRoot, "materials");
    const fullPath = nodePath2.resolve(learningRoot, path || "");
    const relative2 = nodePath2.relative(materialsRoot, fullPath);
    if (!path || relative2.startsWith("..") || nodePath2.isAbsolute(relative2)) {
      new import_obsidian18.Notice(`Unsafe material path refused: ${path || "unknown path"}`);
      return false;
    }
    return this.openExternalPath(fullPath, "Opened the local material in its default app.");
  }
  openAuthoredPath(path) {
    if (this.refuseQuarantined(path)) return false;
    const extension = nodePath2.extname(path || "").toLocaleLowerCase();
    if ([".md", ".pdf", ".canvas", ".base"].includes(extension)) return this.openVaultPath(path);
    const base = this.app.vault.adapter.getBasePath();
    const fullPath = nodePath2.resolve(base, path || "");
    const relative2 = nodePath2.relative(base, fullPath);
    if (!path || relative2.startsWith("..") || nodePath2.isAbsolute(relative2)) {
      new import_obsidian18.Notice(`Unsafe vault path refused: ${path || "unknown path"}`);
      return false;
    }
    return this.openExternalPath(fullPath, "Opened the authored file in its default app.");
  }
  openRecord(record) {
    if (!record) return;
    if (record.type === "unit") return this.openUnit(record.id);
    if (record.type === "module") return this.openModule(record.id);
    if (record.type === "project") return this.openProject(record.id);
    if (record.type === "program") return this.openProgram(record.id);
    if (record.type === "source") return this.openSourceDetail(record.id);
    if (record.type === "topic-pack") return this.openTopicPackDetail(record.id);
    if (record.type === "collection") return this.openCatalogueDetail(record.id);
    if (record.type === "note" || record.type === "concept") {
      if (record.path) return this.openAuthoredPath(record.path);
      return this.openLibraryFiltered(record.type);
    }
    if (record.type === "workspace") {
      if (record.project_id) return this.openProject(record.project_id);
      const unit = (record.unit_ids || []).map((id) => this.store.get(id)).find(Boolean);
      if (unit) return this.openUnit(unit.id);
      const module2 = (record.module_ids || []).map((id) => this.store.get(id)).find(Boolean);
      return module2 ? this.openModule(module2.id) : this.openHome();
    }
    if (record.path) return this.openAuthoredPath(record.path);
  }
  openResource(resource) {
    const materialPath = typeof resource.material_path === "string" ? resource.material_path : "";
    if (materialPath.trim()) return this.openMaterialPath(materialPath);
    const vaultPath = typeof resource.vault_path === "string" ? resource.vault_path : "";
    if (vaultPath.trim()) {
      if (vaultPath.trim().toLowerCase().startsWith("material://")) {
        new import_obsidian18.Notice(`Refused an unresolved material link: ${vaultPath.trim().slice(0, 80)}`);
        return false;
      }
      return this.openVaultPath(vaultPath);
    }
    if (resource.url) {
      const url = safeWebUrl(resource.url);
      if (!url) {
        new import_obsidian18.Notice(`Refused an unsupported link: ${String(resource.url).slice(0, 80)}`);
        return false;
      }
      const leaf = this.app.workspace.getLeaf(true);
      return leaf.setViewState({ type: "webviewer", active: true, state: { url: url.href } });
    }
  }
  copyText(value) {
    try {
      navigator.clipboard.writeText(value);
      new import_obsidian18.Notice(`Copied ${value}`);
    } catch (_) {
      new import_obsidian18.Notice(value);
    }
  }
  async askAiScoped(request, context = {}) {
    const envelope = explicitAiContext(this, context);
    const prompt = `${request}

LearningOS explicit context (authoritative):
${JSON.stringify(envelope, null, 2)}

The active file is supplementary context only. Use only action-specific LearningOS capabilities for writes; never infer a global course or learning path.`;
    this.lastAiPrompt = prompt;
    const agent = this.app.plugins?.plugins?.["agentic-copilot"];
    if (agent?.sendToChat) await agent.sendToChat(prompt);
    else {
      this.copyText(prompt);
      new import_obsidian18.Notice("Scoped prompt copied. Open Agentic Copilot to continue.");
    }
    return prompt;
  }
};
var main_default = LearningOSUI;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  LearningOSUI
});
module.exports = module.exports.default;
