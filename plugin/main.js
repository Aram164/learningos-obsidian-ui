'use strict';
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
  icon(el.createSpan({ cls: "los-chip-icon" }), ICONS[record?.type] || "circle");
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
  const first = String(value || "").split(/\n\s*\n/)[0].replace(/\*\*/g, "").replace(/`/g, "").replace(/(^|\n)\s*-\s*/g, "$1").replace(/\s+/g, " ").trim();
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
  const moduleIds = (workspace.module_ids || []).filter((id) => id !== moduleContext);
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
    const done = (map.stages || []).filter((row) => row.status === "complete").length;
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
      const active = tab.attrs["data-filter"] === this.filter;
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
    return words.every((word) => haystack.includes(word));
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

// src/app/router.ts
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
    const type = legacy?.type;
    const state = legacy?.state || {};
    if (type === VIEW_PROGRAM) {
      return state.programId === "inbox" ? { name: "capture" } : { name: "learn", programId: state.programId || LEARN_AREAS[0][0] };
    }
    if (type === VIEW_MODULE) {
      if (state.screen === "groups") return { name: "module-groups" };
      if (state.screen === "list") return { name: "module-list", groupId: state.groupId, query: state.query || "" };
      return { name: "module-detail", moduleId: state.moduleId, componentId: state.componentId || null, tab: state.tab || null };
    }
    if (type === VIEW_UNIT) return { name: "unit", unitId: state.unitId, stageId: state.stageId || null };
    if (type === VIEW_PROJECT) return state.projectId ? { name: "project-detail", projectId: state.projectId, tab: state.tab || "overview" } : { name: "project-list", query: state.query || "" };
    if (type === VIEW_LIBRARY) return this.libraryRouteFromState(state);
    if (type === VIEW_ATLAS) return { name: "atlas", domain: state.domain || null };
    if (type === VIEW_SHELVING) return { name: "shelving", unitId: state.unitId || null };
    if (type === VIEW_BOUNDARY) return { name: "boundary", boundaryId: state.boundaryId };
    if (type === VIEW_REVIEW) return { name: "review" };
    if (type === VIEW_GARDEN) return { name: "garden" };
    if (type === VIEW_DIAGNOSTICS) return { name: "diagnostics" };
    return { name: "home" };
  }
  libraryRouteFromState(state = {}) {
    if (state.screen === "group") return {
      name: "library-group",
      collection: state.collection || "sources",
      groupId: state.groupId,
      query: state.query || "",
      facet: state.facet || "all"
    };
    if (state.screen === "source-detail") return {
      name: "source-detail",
      resourceId: state.resourceId,
      fromGroupId: state.fromGroupId || null,
      query: state.query || "",
      facet: state.facet || "all"
    };
    if (state.screen === "topic-pack-detail") return {
      name: "topic-pack-detail",
      topicPackId: state.topicPackId,
      fromGroupId: state.fromGroupId || null,
      query: state.query || ""
    };
    if (state.screen === "catalogue-detail") return { name: "catalogue-detail", catalogueId: state.catalogueId };
    if (state.screen === "legacy-list") return {
      name: "legacy-library-list",
      recordType: state.recordType || "note",
      query: state.query || "",
      domain: state.domain || ""
    };
    if (state.recordId) {
      const record = this.plugin.store?.get?.(state.recordId);
      if (record?.type === "source" || state.recordType === "source") {
        return { name: "source-detail", resourceId: state.recordId };
      }
      if (record?.type === "topic-pack") return { name: "topic-pack-detail", topicPackId: state.recordId };
      if (record?.type === "collection" || state.recordType === "collection") {
        return { name: "catalogue-detail", catalogueId: state.recordId };
      }
    }
    if (state.recordType && !["source", "topic-pack"].includes(state.recordType)) {
      return { name: "legacy-library-list", recordType: state.recordType, query: state.query || "", domain: state.domain || "" };
    }
    return { name: "library-home", collection: state.recordType === "topic-pack" ? "topic-packs" : "sources" };
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
            tab: route.tab || null
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
      leaf = side === "left" ? this.plugin.app.workspace.getLeftLeaf(false) : this.plugin.app.workspace.getLeaf(true);
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
var UnitNoteModal = class extends import_obsidian3.Modal {
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
    const stages = Array.isArray(this.studyMap?.stages) ? this.studyMap.stages : [];
    const draft = this.plugin.getUnitNoteDraft(this.unit.id, stages);
    this.recoveredStageIds = draft.recoveredStageIds || [];
    this.referencedStageIds = [.../* @__PURE__ */ new Set([
      ...this.unrecordedCompletedStages(stages),
      ...this.recoveredStageIds
    ])];
    pageHeader(
      root,
      "Learning session",
      "Add note",
      "Attach one note after the stages you worked through. It belongs to the unit, not to one selected stage."
    );
    const context = root.createDiv({ cls: "los-unit-note-context" });
    context.createDiv({ cls: "los-kicker", text: "Stages covered" });
    if (this.referencedStageIds.length) {
      const names = this.referencedStageIds.map((id) => stages.find((stage) => stage.id === id)?.title || id);
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
    const already = new Set((this.unit.note_sections || []).flatMap((section3) => Array.isArray(section3.stage_ids) ? section3.stage_ids : []));
    return stages.filter((stage) => ["complete", "skipped"].includes(stage.status) && !already.has(stage.id)).map((stage) => stage.id);
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
    const filePaths = this.files.map((file) => localFilePath(file)).filter(Boolean);
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
      new import_obsidian3.Notice(error?.message || String(error));
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/gateway-client.ts
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
  call(args, { expectJson = true } = {}) {
    return new Promise((resolve2, reject) => {
      this.plugin.runLos(args, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message || String(error)));
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
          reject(new Error(parsed?.error || "LearningOS refused the change; your draft was kept."));
          return;
        }
        resolve2(parsed);
      });
    });
  }
  guard() {
    return ["--expected-snapshot", this.plugin.store.snapshotId];
  }
  saveNote(unitId, stageId, text) {
    return this.call(["stage-note", unitId, stageId, "--replace", "--text", text, ...this.guard()]);
  }
  saveUnitNote(unitId, { title = "", text, stageIds = [], filePaths = [] }) {
    const args = ["unit-note", unitId, "--text", text];
    if (String(title).trim()) args.push("--title", String(title).trim());
    for (const stageId of stageIds || []) args.push("--stage-id", stageId);
    for (const filePath of filePaths || []) args.push("--attachment", filePath);
    return this.call([...args, ...this.guard()]);
  }
  progress(unitId, stageId, status) {
    return this.call(["stage-progress", unitId, stageId, status, ...this.guard()]);
  }
  feedback(unitId, stageId, sourceId, feedback) {
    return this.call(["source-feedback", unitId, stageId, sourceId, feedback, ...this.guard()]);
  }
  detour(unitId, stageId, title, classification = "required-now") {
    return this.call([
      "detour-create",
      unitId,
      stageId,
      "--title",
      title,
      "--classification",
      classification,
      ...this.guard()
    ]);
  }
  resolveDetour(unitId, detourId, resolution = "") {
    const args = ["detour-resolve", unitId, detourId];
    if (resolution) args.push("--resolution", resolution);
    return this.call([...args, ...this.guard()]);
  }
  attach(unitId, stageId, filePath, label = "") {
    const args = ["stage-attach", unitId, stageId, "--file", filePath];
    if (label) args.push("--label", label);
    return this.call([...args, ...this.guard()]);
  }
  captureText(text, title = "") {
    const args = ["capture", "--json", "--text", text];
    if (title) args.push("--title", title);
    return this.call(args);
  }
  captureFile(filePath) {
    return this.call(["capture", "--json", "--file", filePath]);
  }
  prepareShelving(unitId) {
    return this.call(["shelving-prepare", unitId, ...this.guard()]);
  }
  applyShelving(unitId, selected) {
    return this.call(["shelving-apply", unitId, "--approve", "--selected", ...selected, ...this.guard()]);
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
  const resources = stage?.resources || [];
  return {
    area_program_id: context.programId || module2?.area_id || null,
    module_id: module2?.id || context.moduleId || null,
    component_id: context.componentId || unit?.component_id || null,
    unit_id: unit?.id || context.unitId || null,
    stage_id: stage?.id || context.stageId || null,
    selected_source_ids: [...new Set(resources.map((row) => row.source_id).filter(Boolean))],
    selected_materials: resources.filter((row) => row.vault_path || row.url).map((row) => row.vault_path || row.url),
    manifest_snapshot: plugin.store.snapshotId,
    active_file_supplement: plugin.app.workspace.getActiveFile()?.path || null
  };
}

// src/infrastructure/ai-action-client.ts
var AIActionClient = class {
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
    if (jobExportConfirmed) args.push("--confirm-job-export");
    return this.plugin.mutate(() => this.plugin.gateway.call(args));
  }
  status(requestId) {
    return this.plugin.gateway.call(["ai-action-status", requestId]);
  }
  applyApprovedDelivery(deliveryId) {
    return this.plugin.mutate(() => this.plugin.gateway.call([
      "ai-action-apply-delivery",
      deliveryId
    ]));
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
      const parsed = JSON.parse(await this.app.vault.adapter.read("generated/manifest.json"));
      const version = parsed?._generated?.contract_version;
      if (version !== CONTRACT_VERSION) {
        throw new Error(`Unsupported manifest contract ${version ?? "unknown"}; LearningOS UI requires contract ${CONTRACT_VERSION}.`);
      }
      assertManifestV2(parsed);
      const manifest = parsed;
      this.data = manifest;
      this.contractVersion = version;
      this.snapshotId = manifest._generated.snapshot_id;
      this.records = (manifest.records || []).filter((row) => row && typeof row === "object");
      this.byId = new Map(this.records.filter((row) => row?.id).map((row) => [row.id, row]));
      for (const group of ["programs", "modules", "projects", "units", "study_maps", "stages", "thematic_groups", "topic_packs"]) {
        for (const row of manifest[group] || []) if (row?.id) this.byId.set(row.id, row);
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
    return this.get(unitId)?.note_sections || [];
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
    const ids = this.data?.backlinks?.module_to_workspaces?.[moduleId] || [];
    return ids.map((id) => this.get(id)).filter(Boolean);
  }
  useUnits(sourceId) {
    return (this.data?.indexes?.source_to_units?.[sourceId] || []).map((id) => this.get(id)).filter(Boolean);
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
var LearningOSSettingsTab = class extends import_obsidian4.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const root = this.containerEl;
    root.empty();
    root.createEl("h2", { text: "LearningOS UI" });
    for (const [key, name, description] of [
      ["openHomeOnStartup", "Open Home on startup", "Open the module-first Home view when the vault becomes ready."],
      ["pinHome", "Pin Home", "Keep the Home leaf available while opening units."],
      ["collapseSidebars", "Collapse the right sidebar", "Keep the learning workspace visually focused."],
      ["showAiRecommendation", "Show scoped AI action", "Display AI buttons that always include explicit curriculum context."]
    ]) {
      new import_obsidian4.Setting(root).setName(name).setDesc(description).addToggle((toggle) => toggle.setValue(this.plugin.settings[key]).onChange(async (value) => {
        this.plugin.settings[key] = value;
        await this.plugin.saveData(this.plugin.settings);
      }));
    }
    new import_obsidian4.Setting(root).setName("Python interpreter").setDesc("Leave blank to auto-detect: the project virtual environment, then the system Python.").addText((text) => text.setValue(this.plugin.settings.pythonPath || "").onChange(async (value) => {
      this.plugin.settings.pythonPath = value.trim();
      await this.plugin.saveData(this.plugin.settings);
    }));
    new import_obsidian4.Setting(root).setName("Validate and rebuild").setDesc("Run the canonical core projection pipeline.").addButton((control) => control.setButtonText("Rebuild").setCta().onClick(() => this.plugin.generate()));
    new import_obsidian4.Setting(root).setName("Diagnostics").setDesc("Contract versions, projection freshness, interpreter.").addButton((control) => control.setButtonText("Open").onClick(() => this.plugin.openDiagnostics()));
    root.createEl("h3", { text: "About LearningOS" });
    root.createEl("p", { cls: "los-muted", text: OWNERSHIP_STATEMENT });
  }
};
var SessionEndModal = class extends import_obsidian4.Modal {
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
        const result = await this.plugin.gateway.endSession(message.value.trim(), Boolean(push.checked));
        new import_obsidian4.Notice(result.pushed ? "Learning session committed and pushed." : "Learning session committed.");
        this.close();
      } catch (error) {
        new import_obsidian4.Notice(error?.message || String(error));
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
var ATLAS_ROLE_ORDER = ["crosswalk", "reference", "synthesis", "exercise-bank", "mock-exam"];
var AtlasView = class extends import_obsidian5.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.domain = null;
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
  async setState(state) {
    if (state?.domain) this.domain = state.domain;
    this.render();
  }
  getState() {
    return { domain: this.domain };
  }
  async onOpen() {
    this.domain = this.leaf.state?.domain || null;
    this.render();
  }
  atlas() {
    const domains = /* @__PURE__ */ new Map();
    const bucket = (name) => {
      const key = name || "cross-domain";
      if (!domains.has(key)) domains.set(key, { name: key, notes: [], shelves: [] });
      return domains.get(key);
    };
    for (const note of this.plugin.store.of("note")) bucket(note.domain).notes.push(note);
    for (const shelf of this.plugin.store.of("collection")) bucket(shelf.domain).shelves.push(shelf);
    return [...domains.values()].sort((a, b) => b.notes.length - a.notes.length || a.name.localeCompare(b.name));
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-atlas-view");
    if (!this.plugin.store.ready) {
      pageHeader(root, "Reach", "Domain atlas unavailable");
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
      empty(root, "Nothing mapped yet", "No notes or shelves are registered.");
      return;
    }
    if (!this.domain || !domains.some((row) => row.name === this.domain)) this.domain = domains[0].name;
    const glance = root.createDiv({ cls: "los-atlas-glance" });
    for (const domain of domains) {
      const entries = domain.shelves.reduce((total, shelf) => total + (shelf.entries || []).length, 0);
      const crosswalks = domain.notes.filter((note) => note.role === "crosswalk").length;
      const tile = glance.createEl("button", {
        cls: `los-atlas-tile is-clickable ${domain.name === this.domain ? "is-selected" : ""}`,
        attr: { type: "button", "aria-pressed": String(domain.name === this.domain) }
      });
      tile.createSpan({ cls: "los-atlas-tile-name", text: domain.name });
      const plural = (count, noun) => `${count} ${noun}${count === 1 ? "" : "s"}`;
      tile.createSpan({
        cls: "los-micro",
        text: [
          plural(domain.notes.length, "note"),
          crosswalks ? plural(crosswalks, "crosswalk") : null,
          `${plural(domain.shelves.length, "shelf").replace("shelfs", "shelves")} (${entries})`
        ].filter(Boolean).join(" \xB7 ")
      });
      tile.addEventListener("click", () => {
        this.domain = domain.name;
        this.render();
      });
    }
    const current = domains.find((row) => row.name === this.domain);
    const body = root.createDiv({ cls: "los-atlas-body" });
    this.renderDomain(body, current);
    this.renderBoundaries(root);
  }
  noteRow(parent, note) {
    const row = parent.createEl("button", { cls: "los-item is-clickable", attr: { type: "button" } });
    icon(row.createSpan(), ICONS.note);
    const copy = row.createSpan({ cls: "los-item-copy" });
    copy.createSpan({ text: note.title || note.id });
    copy.createSpan({ cls: "los-micro", text: [note.role, note.state, note.id].filter(Boolean).join(" \xB7 ") });
    row.addEventListener("click", () => this.plugin.openAuthoredPath(note.path));
    return row;
  }
  renderDomain(parent, domain) {
    if (!domain) return;
    const header = parent.createDiv({ cls: "los-atlas-domain-head" });
    header.createEl("h2", { text: domain.name });
    const actions = header.createDiv({ cls: "los-actions" });
    button(
      actions,
      "Browse these notes in the Library",
      () => this.plugin.openLibraryFiltered("note", domain.name),
      "quiet"
    );
    const crosswalks = domain.notes.filter((note) => note.role === "crosswalk");
    if (crosswalks.length) {
      const wrap = section(
        parent,
        `Wiring hubs (${crosswalks.length})`,
        "Crosswalks carry the narrative that joins this domain\u2019s sources and concepts \u2014 read one before opening a shelf."
      );
      for (const note of crosswalks) this.noteRow(wrap, note);
    }
    const byRole = /* @__PURE__ */ new Map();
    for (const note of domain.notes) {
      const role = note.role || "synthesis";
      if (!byRole.has(role)) byRole.set(role, []);
      byRole.get(role).push(note);
    }
    const roles = [...byRole.keys()].sort((a, b) => {
      const rank = (role) => ATLAS_ROLE_ORDER.indexOf(role) + 1 || 99;
      return rank(a) - rank(b) || a.localeCompare(b);
    });
    if (domain.notes.length) {
      const notesWrap = section(
        parent,
        `Notes (${domain.notes.length})`,
        "Grouped by role. Opening a row opens the note itself."
      );
      for (const role of roles) {
        const rows = byRole.get(role).slice().sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)));
        const group = notesWrap.createEl("details", { cls: "los-atlas-group" });
        if (role === "crosswalk" ? false : rows.length <= 12) group.setAttr("open", "open");
        group.createEl("summary", { text: `${role} (${rows.length})` });
        for (const note of rows) this.noteRow(group, note);
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
    for (const shelf of domain.shelves.slice().sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)))) {
      const card = shelvesWrap.createDiv({ cls: "los-shelf-entry" });
      const head = card.createEl("button", { cls: "los-shelf-entry-title is-clickable", attr: { type: "button" } });
      icon(head.createSpan(), "library");
      head.createSpan({ text: `${shelf.title || shelf.id} (${(shelf.entries || []).length})` });
      head.addEventListener("click", () => this.plugin.openLibrary(shelf.id, "collection"));
      if (shelf.summary) card.createDiv({ cls: "los-shelf-why", text: projectedExcerpt(shelf.summary, 320) });
    }
  }
  renderBoundaries(root) {
    const boundaries = this.plugin.store.rows("quarantine_boundaries");
    const wrap = section(
      root,
      "Outside this map by policy",
      "Named so their absence is visible; their content is never loaded, indexed, or searched."
    );
    if (!boundaries.length) {
      empty(wrap, "No boundary records", "Nothing is currently quarantined in the projection.");
    }
    for (const boundary of boundaries) {
      const card = wrap.createDiv({ cls: "los-boundary-row" });
      card.createDiv({ cls: "los-item-copy", text: boundary.title || boundary.id });
      const policy = boundaryPolicy(boundary.description || "");
      if (policy) card.createDiv({ cls: "los-micro", text: policy });
    }
    button(
      wrap,
      "Open the generated atlas file",
      () => this.plugin.openVaultPath("generated/domain-atlas.md"),
      "quiet"
    );
  }
};

// src/views/boundary-view.ts
var import_obsidian6 = require("obsidian");
var BoundaryView = class extends import_obsidian6.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.boundaryId = null;
  }
  getViewType() {
    return VIEW_BOUNDARY;
  }
  getDisplayText() {
    return "LearningOS \xB7 Boundary";
  }
  async setState(state) {
    this.boundaryId = state?.boundaryId || this.boundaryId;
    this.render();
  }
  getState() {
    return { boundaryId: this.boundaryId };
  }
  async onOpen() {
    this.boundaryId = this.leaf.state?.boundaryId || this.boundaryId;
    this.render();
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-boundary-view");
    const boundary = (this.plugin.store.data?.quarantine_boundaries || []).find((row) => row.id === this.boundaryId);
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
function renderGardenShelveAction(parent, plugin, target, onChanged = null) {
  const wrap = parent.createDiv({ cls: "los-ai-action-row" });
  const providers = plugin.aiActions.providers();
  const available = providers.filter((row) => row.available);
  let provider = available.some((row) => row.id === plugin.settings.preferredAiProvider) ? plugin.settings.preferredAiProvider : available[0]?.id || "manual-bundle";
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
      const result = await plugin.aiActions.prepareGardenShelving(target.id, provider, jobConfirmed);
      const bundlePath = result.bundle_path || result.request?.bundle_path;
      new import_obsidian7.Notice(bundlePath ? `AI request prepared: ${bundlePath}` : "AI request prepared.");
      onChanged?.(result);
    } catch (error) {
      new import_obsidian7.Notice(error?.message || String(error));
      launch.removeAttribute?.("disabled");
      launch.setText("Shelve with AI");
    }
  }, "quiet");
  launch.addClass("los-ai-action-button");
  if (!available.length) launch.setAttr("disabled", "disabled");
  return wrap;
}

// src/views/garden-view.ts
var GardenView = class extends import_obsidian8.ItemView {
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
            new import_obsidian8.Notice(error?.message || String(error));
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
var HomeView = class extends import_obsidian9.ItemView {
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
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-home");
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
    const header = pageHeader(
      root,
      "Home",
      this.greeting(),
      "Resume what matters without rebuilding the context first."
    );
    header.addClass("los-home-header");
    const actions = header.createDiv({ cls: "los-actions los-home-header-actions" });
    button(actions, "Capture", () => this.plugin.openCapture(), "quiet");
    const search = button(actions, "Search", () => this.plugin.openGlobalSearch(), "quiet");
    search.setAttribute("aria-label", "Search LearningOS");
    this.renderContinue(root);
    this.renderToday(root);
    this.renderElsewhere(root);
  }
  /** The one filled action on Home. */
  renderContinue(root) {
    const pointer = this.plugin.store.data.resume_pointer || {};
    const unit = this.plugin.store.get(pointer.unit_id);
    const map = this.plugin.store.get(pointer.study_map_id);
    const stage = this.plugin.store.stage(pointer.stage_id);
    const wrap = root.createDiv({ cls: "los-continue" });
    if (!unit || !stage) {
      empty(
        wrap,
        "Nothing to resume yet",
        "Open Learn and choose a module or project.",
        "Open Learn",
        () => this.plugin.openLearn()
      );
      return;
    }
    wrap.createDiv({ cls: "los-kicker", text: "Continue learning" });
    const body = wrap.createDiv({ cls: "los-continue-body" });
    const copy = body.createDiv({ cls: "los-continue-copy" });
    const module2 = this.plugin.store.get(unit.module_id);
    copy.createDiv({
      cls: "los-continue-module",
      text: `${module2?.title || unit.module_id} \xB7 ${unit.title}`
    });
    copy.createEl("h2", { text: stage.title });
    const stages = Array.isArray(map?.stages) ? map.stages.filter(Boolean) : [];
    const position = stages.findIndex((row) => row?.id === stage.id);
    const meta = copy.createDiv({ cls: "los-continue-meta" });
    if (stages.length) meta.createSpan({ text: `Stage ${position >= 0 ? position + 1 : 1} of ${stages.length}` });
    if (stage.estimate_minutes) meta.createSpan({ text: `${stage.estimate_minutes} min planned` });
    copy.createDiv({
      cls: "los-continue-context",
      text: "Your selected stage, exact resources, and open working state are kept together."
    });
    const actions = body.createDiv({ cls: "los-actions" });
    button(actions, "Continue session", () => this.plugin.openUnit(unit.id, stage.id), "cta");
  }
  renderToday(root) {
    const sectionEl = section(root, "Today", "Only items likely to affect the next decision.");
    const items = [];
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const upcoming = this.plugin.store.rows("academic_deadlines").filter((row) => (row.end_date || row.start_date || "") >= today).sort((left, right) => String(left.start_date || left.end_date).localeCompare(String(right.start_date || right.end_date)));
    for (const deadline of upcoming.slice(0, 2)) {
      const moduleId = deadline.module_id || deadline.modules?.[0]?.module_id;
      const title = deadline.kind === "registration-window" ? deadline.label : deadline.title || deadline.label;
      const date = deadline.end_date && deadline.end_date !== deadline.start_date ? `${deadline.start_date} \u2192 ${deadline.end_date}` : deadline.start_date || deadline.end_date || "Date pending";
      items.push({
        title,
        detail: `${date}${deadline.registration_state && deadline.registration_state !== "registered" ? ` \xB7 ${deadline.registration_state}` : ""}`,
        actionLabel: moduleId ? "Open module" : "",
        action: moduleId ? () => this.plugin.openModule(moduleId) : null
      });
    }
    const inbox = this.plugin.store.data.counts?.inbox_items || 0;
    const shelving = this.plugin.store.units().filter((row) => row.status === "ready-to-shelve").length;
    const needsMap = this.plugin.store.units().filter((row) => !this.plugin.store.mapForUnit(row.id)).length;
    const reviewCount = inbox + shelving + needsMap;
    if (reviewCount) {
      items.push({
        title: `${reviewCount} decision${reviewCount === 1 ? "" : "s"} waiting`,
        detail: [
          inbox && `${inbox} inbox`,
          shelving && `${shelving} ready to shelve`,
          needsMap && `${needsMap} without a map`
        ].filter(Boolean).join(" \xB7 "),
        actionLabel: "Open review",
        action: () => this.plugin.openReview()
      });
    }
    const garden = this.plugin.store.gardenEntries()[0];
    if (garden) {
      items.push({
        title: garden.title,
        detail: "Recent Garden capture",
        actionLabel: "Open Garden",
        action: () => this.plugin.openGarden()
      });
    }
    if (!items.length) {
      empty(sectionEl, "Nothing time-sensitive", "Continue the active learning session when you are ready.");
      return;
    }
    const list = sectionEl.createDiv({ cls: "los-home-list" });
    for (const item of items.slice(0, 4)) this.renderHomeRow(list, item);
  }
  renderElsewhere(root) {
    const sectionEl = section(
      root,
      "Continue elsewhere",
      "Other active modules and projects, kept secondary to the current session."
    );
    const pointer = this.plugin.store.data.resume_pointer || {};
    const rows = [
      ...this.plugin.store.modules().filter((module2) => module2.id !== pointer.module_id).filter((module2) => !["complete", "archived"].includes(module2.status)).map((record) => ({ record, type: record.kind === "skill" ? "Skill" : "Module", open: () => this.plugin.openModule(record.id) })),
      ...this.plugin.store.projects().filter((project) => !["completed", "archived"].includes(project.status)).map((record) => ({ record, type: "Project", open: () => this.plugin.openProject(record.id) }))
    ].slice(0, 5);
    if (!rows.length) {
      empty(sectionEl, "No other active work", "New modules and projects will appear here when projected.");
      return;
    }
    const list = sectionEl.createDiv({ cls: "los-home-list" });
    for (const row of rows) {
      this.renderHomeRow(list, {
        title: row.record.title,
        detail: `${row.type}${row.type === "Project" ? "" : this.moduleNextAction(row.record) ? ` \xB7 ${this.moduleNextAction(row.record)}` : ""}`,
        actionLabel: "Open",
        action: row.open
      });
    }
  }
  renderHomeRow(parent, item) {
    const row = parent.createDiv({ cls: "los-home-row" });
    const copy = row.createDiv({ cls: "los-home-row-copy" });
    copy.createEl("strong", { text: item.title });
    if (item.detail) copy.createDiv({ cls: "los-micro", text: item.detail });
    if (item.actionLabel && item.action) button(row, item.actionLabel, item.action, "tertiary");
    return row;
  }
  nextWorkspaceDate(workspace) {
    if (workspace.deadline) return String(workspace.deadline);
    const moduleIds = new Set(workspace.module_ids || []);
    const dates = [];
    for (const row of this.plugin.store.rows("academic_deadlines")) {
      if (row.kind === "exam" && moduleIds.has(row.module_id)) dates.push(row.start_date);
      if (row.kind === "registration-window" && (row.modules || []).some((module2) => moduleIds.has(module2.module_id))) dates.push(row.start_date);
    }
    return dates.filter(Boolean).sort()[0] || "9999";
  }
  moduleNextAction(module2) {
    const workspace = this.plugin.store.of("workspace").filter((row) => !row.archived && row.status !== "complete" && (row.module_ids || []).includes(module2.id)).sort((a, b) => this.nextWorkspaceDate(a).localeCompare(this.nextWorkspaceDate(b)))[0];
    if (workspace?.next_action) return projectedExcerpt(workspace.next_action, 100);
    for (const unit of this.plugin.store.unitsFor(module2.id)) {
      const map = this.plugin.store.mapForUnit(unit.id);
      if (!map) continue;
      const stage = (map.stages || []).find((row) => row.id === map.current_stage) || (map.stages || []).find((row) => row.status === "active") || (map.stages || []).find((row) => row.status !== "complete");
      if (stage?.title) return stage.title;
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
var LibraryView = class extends import_obsidian10.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.screen = "home";
    this.collection = "sources";
    this.groupId = null;
    this.query = "";
    this.facet = "all";
    this.resourceId = null;
    this.topicPackId = null;
    this.catalogueId = null;
    this.recordType = "note";
    this.domain = "";
    this.selectedElementId = null;
  }
  getViewType() {
    return VIEW_LIBRARY;
  }
  getDisplayText() {
    return "LearningOS \xB7 Library";
  }
  applyState(state = {}) {
    this.screen = state.screen || (state.recordId ? "legacy-list" : "home");
    this.collection = state.collection || this.collection || "sources";
    this.groupId = state.groupId || state.fromGroupId || null;
    this.query = state.query || "";
    this.facet = state.facet || "all";
    this.resourceId = state.resourceId || null;
    this.topicPackId = state.topicPackId || null;
    this.catalogueId = state.catalogueId || null;
    this.recordType = state.recordType || this.recordType || "note";
    this.domain = state.domain || "";
  }
  async setState(state) {
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
    this.applyState(this.leaf.state || {});
    this.render();
  }
  shelfIndex() {
    if (this._shelfIndex && this._shelfSnapshot === this.plugin.store.snapshotId) return this._shelfIndex;
    const index = /* @__PURE__ */ new Map();
    for (const shelf of [...this.plugin.store.catalogues(), ...this.plugin.store.topicPacks()]) {
      for (const entry of shelf.entries || []) {
        if (!entry?.source) continue;
        if (!index.has(entry.source)) index.set(entry.source, []);
        index.get(entry.source).push({ shelf, group: entry.group, why: entry.why });
      }
    }
    this._shelfIndex = index;
    this._shelfSnapshot = this.plugin.store.snapshotId;
    return index;
  }
  matchesSourceFacet(record) {
    if (this.facet === "all") return true;
    if (this.facet === "local") return Boolean(record.material_exists || record.material_path);
    if (this.facet === "online") return Boolean(record.url);
    if (this.facet === "in-unit") return this.plugin.store.useUnits(record.id).length > 0;
    return true;
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-library-view");
    if (!this.plugin.store.ready) {
      pageHeader(root, "Library", "Projection unavailable");
      empty(
        root,
        "The interface contract could not be loaded",
        this.plugin.store.error,
        "Rebuild views",
        () => this.plugin.generate()
      );
      return;
    }
    if (this.screen === "group") return this.renderGroup(root);
    if (this.screen === "source-detail") return this.renderSourcePage(root);
    if (this.screen === "topic-pack-detail") return this.renderTopicPackPage(root);
    if (this.screen === "catalogue-detail") return this.renderCataloguePage(root);
    if (this.screen === "legacy-list") return this.renderLegacyList(root);
    return this.renderHome(root);
  }
  renderHome(root) {
    pageHeader(
      root,
      "Library",
      "Choose a thematic group",
      this.collection === "topic-packs" ? "Topic Packs are narrow, purpose-built and manually ordered collections." : "Open a domain to browse its learning sources."
    );
    this.renderCollectionSwitch(root);
    const groups = this.plugin.store.thematicGroups();
    if (!groups.length) {
      empty(root, "No thematic groups", "Rebuild the projection after defining thematic-group metadata.");
      return;
    }
    const grid = root.createDiv({ cls: "los-group-grid los-library-group-grid" });
    for (const group of groups) {
      const count = this.collection === "topic-packs" ? this.plugin.store.topicPacksForGroup(group.id).length : this.plugin.store.sourcesForGroup(group.id).length;
      const card = grid.createEl("button", {
        cls: "los-group-card is-clickable",
        attr: { type: "button", "aria-label": `Open ${group.title}` }
      });
      const head = card.createDiv({ cls: "los-group-card-header" });
      head.createEl("h2", { text: group.title });
      head.createSpan({
        cls: "los-group-count",
        text: `${count} ${this.collection === "topic-packs" ? `pack${count === 1 ? "" : "s"}` : `source${count === 1 ? "" : "s"}`}`
      });
      if (group.description) card.createEl("p", { text: group.description });
      card.createSpan({ cls: "los-route-open", text: "Open \u2192" });
      card.addEventListener("click", () => {
        this.selectedElementId = group.id;
        this.plugin.openLibraryGroup(this.collection, group.id);
      });
    }
  }
  renderCollectionSwitch(root) {
    const switcher = root.createDiv({ cls: "los-collection-switch", attr: { role: "tablist", "aria-label": "Library collection" } });
    for (const [id, label] of [["sources", "Learning Sources"], ["topic-packs", "Topic Packs"]]) {
      const control = button(switcher, label, () => this.plugin.openLibraryHome(id), this.collection === id ? "cta" : "quiet");
      control.setAttrs({ role: "tab", "aria-selected": String(this.collection === id) });
    }
  }
  renderGroup(root) {
    const group = this.plugin.store.get(this.groupId);
    const back = button(root, "\u2039 Library", () => this.plugin.back(), "quiet");
    back.addClass("los-route-back");
    if (!group) {
      empty(root, "Thematic group unavailable", "Return to Library and choose another group.", "Back", () => this.plugin.back());
      return;
    }
    const isPacks = this.collection === "topic-packs";
    pageHeader(
      root,
      isPacks ? "Topic Packs" : "Learning Sources",
      group.title,
      isPacks ? "Purpose-built collections in this thematic group." : "Learning sources in this thematic group."
    );
    const toolbar = root.createDiv({ cls: "los-library-toolbar" });
    const input = toolbar.createEl("input", {
      cls: "los-search los-route-search",
      attr: {
        type: "search",
        placeholder: `Search ${group.title} ${isPacks ? "topic packs" : "sources"}\u2026`,
        "aria-label": `Search ${group.title} ${isPacks ? "topic packs" : "sources"}`
      }
    });
    input.value = this.query;
    input.addEventListener("input", async () => {
      this.query = input.value;
      await this.rememberGroup();
      this.render();
    });
    if (!isPacks) {
      this.renderSourceFacets(toolbar);
      button(toolbar, "Full-text / OCR search", () => this.plugin.openFullTextSearch(this.query), "quiet");
    }
    const all = isPacks ? this.plugin.store.topicPacksForGroup(group.id) : this.plugin.store.sourcesForGroup(group.id);
    const needle = this.query.trim().toLocaleLowerCase();
    const rows = all.filter((record) => {
      if (!isPacks && !this.matchesSourceFacet(record)) return false;
      if (!needle) return true;
      const hay = [
        record.id,
        record.title,
        record.purpose,
        record.summary,
        ...record.aliases || [],
        ...record.authors || [],
        record.organization
      ].filter(Boolean).join(" ").toLocaleLowerCase();
      return needle.split(/\s+/).every((word) => hay.includes(word));
    }).slice().sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)));
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
    const list = root.createDiv({ cls: "los-route-list los-library-route-list" });
    for (const record of rows) this.renderRecordRow(list, record, isPacks);
  }
  async rememberGroup() {
    return this.plugin.router.remember({
      name: "library-group",
      collection: this.collection,
      groupId: this.groupId,
      query: this.query,
      facet: this.facet
    });
  }
  renderSourceFacets(parent) {
    const facets = parent.createDiv({ cls: "los-library-facets-inline", attr: { "aria-label": "Source filters" } });
    for (const [id, label] of SOURCE_FACETS) {
      const control = button(facets, label, async () => {
        this.facet = id;
        await this.rememberGroup();
        this.render();
      }, this.facet === id ? "row" : "quiet");
      control.setAttribute("aria-pressed", String(this.facet === id));
    }
  }
  renderRecordRow(list, record, isPack = false) {
    const row = list.createEl("button", {
      cls: "los-route-row is-clickable",
      attr: { type: "button", "aria-label": `Open ${record.title}`, "data-record-id": record.id }
    });
    const copy = row.createDiv({ cls: "los-route-row-copy" });
    copy.createEl("strong", { text: record.title || record.id });
    const meta = isPack ? [record.purpose, `${(record.entries || []).length} items`].filter(Boolean).join(" \xB7 ") : [
      record.source_type,
      record.year,
      record.organization,
      record.material_exists || record.material_path ? "local" : null,
      record.url ? "online" : null
    ].filter(Boolean).join(" \xB7 ");
    if (meta) copy.createDiv({ cls: "los-route-meta", text: meta });
    row.createSpan({ cls: "los-route-open", text: "Open \u2192" });
    row.addEventListener("click", () => {
      this.selectedElementId = record.id;
      if (isPack) this.plugin.openTopicPackDetail(record.id, this.groupId, this.query);
      else this.plugin.openSourceDetail(record.id, this.groupId, this.query, this.facet);
    });
  }
  renderSourcePage(root) {
    const record = this.plugin.store.get(this.resourceId);
    const back = button(root, "\u2039 Learning Sources", () => this.plugin.back(), "quiet");
    back.addClass("los-route-back");
    if (!record || record.type !== "source") {
      empty(root, "Learning source unavailable", "The projected source could not be found.", "Back", () => this.plugin.back());
      return;
    }
    const detail = root.createDiv({ cls: "los-detail-page" });
    pageHeader(detail, "Learning Source", record.title || record.id, record.summary || "");
    this.renderRecordActions(detail, record);
    this.renderAttachments(detail, record);
    this.renderSourceDetail(detail, record);
    this.renderRelated(detail, record);
    this.renderTechnical(detail, record);
  }
  renderTopicPackPage(root) {
    const pack = this.plugin.store.get(this.topicPackId);
    const back = button(root, "\u2039 Topic Packs", () => this.plugin.back(), "quiet");
    back.addClass("los-route-back");
    if (!pack || pack.type !== "topic-pack") {
      empty(root, "Topic Pack unavailable", "The projected Topic Pack could not be found.", "Back", () => this.plugin.back());
      return;
    }
    const detail = root.createDiv({ cls: "los-detail-page los-topic-pack-detail" });
    pageHeader(detail, "Topic Pack", pack.title || pack.id, pack.summary || "");
    const purpose = section(detail, "Purpose");
    purpose.createEl("p", { cls: "los-pack-purpose", text: pack.purpose || "No purpose recorded." });
    this.renderOrderedCollection(detail, pack, "Pack contents");
    this.renderRelated(detail, pack);
    this.renderTechnical(detail, pack);
  }
  renderCataloguePage(root) {
    const catalogue = this.plugin.store.get(this.catalogueId);
    const back = button(root, "\u2039 Library", () => this.plugin.back(), "quiet");
    back.addClass("los-route-back");
    if (!catalogue || catalogue.type !== "collection") {
      empty(root, "Source catalogue unavailable", "The projected catalogue could not be found.", "Back", () => this.plugin.back());
      return;
    }
    const detail = root.createDiv({ cls: "los-detail-page los-catalogue-detail" });
    pageHeader(detail, "Source Catalogue", catalogue.title || catalogue.id, catalogue.summary || "");
    this.renderOrderedCollection(detail, catalogue, "Catalogue entries");
    this.renderRelated(detail, catalogue);
    this.renderTechnical(detail, catalogue);
  }
  renderOrderedCollection(detail, collection, title) {
    const entries = (collection.entries || []).filter((entry) => entry?.source);
    const wrap = section(
      detail,
      `${title} (${entries.length})`,
      "The order and grouping shown here come directly from the canonical collection."
    );
    if (!entries.length) {
      empty(wrap, "Empty collection", "No entries are currently registered.");
      return;
    }
    let previousGroup = null;
    entries.forEach((entry, index) => {
      if (entry.group && entry.group !== previousGroup) {
        wrap.createDiv({ cls: "los-list-group", text: entry.group });
        previousGroup = entry.group;
      }
      const source = this.plugin.store.get(entry.source);
      const row = wrap.createDiv({ cls: "los-pack-entry" });
      row.createSpan({ cls: "los-pack-order", text: String(index + 1) });
      const copy = row.createDiv({ cls: "los-route-row-copy" });
      const open = copy.createEl("button", {
        cls: "los-shelf-entry-title is-clickable",
        attr: { type: "button" },
        text: source?.title || entry.source
      });
      open.addEventListener("click", () => source && this.plugin.openSourceDetail(source.id, this.groupId));
      if (entry.why) copy.createDiv({ cls: "los-shelf-why", text: entry.why });
      const facts = [
        source?.source_type,
        source?.year,
        source?.material_exists || source?.material_path ? "local" : null,
        source?.url ? "online" : null
      ].filter(Boolean).join(" \xB7 ");
      if (facts) copy.createDiv({ cls: "los-route-meta", text: facts });
    });
  }
  renderLegacyList(root) {
    const back = button(root, "\u2039 Library", () => this.plugin.back(), "quiet");
    back.addClass("los-route-back");
    const title = `${this.recordType.charAt(0).toUpperCase()}${this.recordType.slice(1)} records`;
    pageHeader(
      root,
      "Compatibility view",
      title,
      this.domain ? `Domain: ${this.domain}` : "Legacy record families remain reachable until their migration gate closes."
    );
    const input = root.createEl("input", {
      cls: "los-search los-route-search",
      attr: { type: "search", placeholder: `Search ${this.recordType} records\u2026`, "aria-label": `Search ${this.recordType}` }
    });
    input.value = this.query;
    input.addEventListener("input", async () => {
      this.query = input.value;
      await this.plugin.router.remember({ name: "legacy-library-list", recordType: this.recordType, query: this.query, domain: this.domain });
      this.render();
    });
    let rows = this.plugin.store.search(this.query, [this.recordType]);
    if (this.domain) rows = rows.filter((row) => row.domain === this.domain);
    rows = rows.slice().sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)));
    if (!rows.length) {
      empty(
        root,
        this.query ? "No matching records" : "No records",
        this.query ? "Try a shorter title, alias or ID." : `No ${this.recordType} records are projected.`
      );
      return;
    }
    const list = root.createDiv({ cls: "los-route-list" });
    for (const record of rows) {
      const row = list.createEl("button", {
        cls: "los-route-row is-clickable",
        attr: { type: "button", "data-record-id": record.id }
      });
      const copy = row.createDiv({ cls: "los-route-row-copy" });
      copy.createEl("strong", { text: record.title || record.id });
      copy.createDiv({ cls: "los-route-meta", text: [record.role, record.domain, record.state].filter(Boolean).join(" \xB7 ") });
      row.createSpan({ cls: "los-route-open", text: record.path ? "Open file \u2192" : "Open \u2192" });
      row.addEventListener("click", () => {
        this.selectedElementId = record.id;
        if (record.path) this.plugin.openAuthoredPath(record.path);
        else this.plugin.openRecord(record);
      });
    }
  }
  renderRecordActions(detail, record) {
    const actions = detail.createDiv({ cls: "los-actions" });
    if (record.url) button(actions, "Open online", () => this.plugin.openResource({ url: record.url }), "cta");
    if (record.material_path) button(actions, "Open local copy", () => this.plugin.openMaterialPath(record.material_path), "quiet");
    if (record.path) button(actions, "Open authored file", () => this.plugin.openAuthoredPath(record.path), "quiet");
  }
  renderAttachments(detail, record) {
    if (!record.attachments?.length) return;
    const attachments = section(detail, "Attachments", "Open the original handwriting, image, or PDF.");
    for (const attachment of record.attachments) {
      const path = typeof attachment === "string" ? attachment : attachment.path || attachment.vault_path;
      const label = typeof attachment === "string" ? attachment.split("/").pop() : attachment.label || path;
      if (path) button(attachments, `Open ${label}`, () => this.plugin.openAuthoredPath(path), "quiet");
    }
  }
  renderRelated(detail, record) {
    const labels = {
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
    const groups = /* @__PURE__ */ new Map();
    for (const row of this.plugin.store.related(record.id)) {
      const key = row.rec?.type || "record";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row.rec);
    }
    if (!groups.size) return;
    const wrap = section(detail, "Related");
    for (const [type, rows] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
      const group = wrap.createDiv({ cls: "los-related-group" });
      group.createDiv({ cls: "los-group-title", text: `${labels[type] || type} \xB7 ${rows.length}` });
      const shown = group.createDiv({ cls: "los-related-chips" });
      for (const rec of rows.slice(0, 5)) chip(shown, rec, (row) => this.plugin.openRecord(row));
      if (rows.length > 5) {
        const rest = disclosure(group, `View all ${rows.length}`);
        const restChips = rest.createDiv({ cls: "los-related-chips" });
        for (const rec of rows.slice(5)) chip(restChips, rec, (row) => this.plugin.openRecord(row));
      }
    }
  }
  renderSourceDetail(detail, record) {
    const facts = section(detail, "Source facts");
    for (const [label, value] of [
      ["Authors", (record.authors || []).join(", ")],
      ["Organization", record.organization],
      ["Year", record.year],
      ["Type", record.source_type]
    ]) {
      if (!value) continue;
      const row = facts.createDiv({ cls: "los-fact-row" });
      row.createSpan({ cls: "los-fact-label", text: label });
      row.createSpan({ cls: "los-fact-value", text: String(value) });
    }
    const memberships = this.shelfIndex().get(record.id) || [];
    const placed = section(
      detail,
      "Collections",
      "Where this source sits and the explicit role it plays there."
    );
    if (!memberships.length) empty(placed, "Not in a collection", "The source remains globally registered.");
    for (const membership of memberships) {
      const line = placed.createDiv({ cls: "los-shelf-entry" });
      const head = line.createEl("button", {
        cls: "los-shelf-entry-title is-clickable",
        attr: { type: "button" },
        text: membership.shelf.title || membership.shelf.id
      });
      head.addEventListener("click", () => {
        if (membership.shelf.type === "topic-pack") this.plugin.openTopicPackDetail(membership.shelf.id);
        else this.plugin.openCatalogueDetail(membership.shelf.id);
      });
      if (membership.group) line.createDiv({ cls: "los-micro", text: membership.group });
      if (membership.why) line.createDiv({ cls: "los-shelf-why", text: membership.why });
    }
    const used = section(detail, "Used in units", "Use is module/unit-specific; it is not a global source score.");
    const units = this.plugin.store.useUnits(record.id);
    if (!units.length) empty(used, "Not routed to a unit", "The source remains globally registered.");
    for (const unit of units) chip(used, unit, (row) => this.plugin.openUnit(row.id));
    const evaluations = (record.evaluations || []).filter((row) => row.verdict || row.scope || row.reading_plan?.length || row.useful_sections?.length);
    if (evaluations.length) {
      const evidence = section(detail, "Existing evaluation evidence");
      for (const evaluation of evaluations) {
        const card = evidence.createDiv({ cls: "los-evidence-card" });
        if (evaluation.verdict) card.createEl("p", { text: evaluation.verdict });
        for (const selection of evaluation.reading_plan || []) card.createDiv({ cls: "los-row", text: selection });
        for (const selection of evaluation.useful_sections || []) {
          card.createDiv({ cls: "los-row", text: `${selection.section}${selection.note ? ` \u2014 ${selection.note}` : ""}` });
        }
      }
    }
  }
  renderTechnical(detail, record) {
    const technical = disclosure(detail, "Technical details", "los-technical-details");
    const idRow = technical.createDiv({ cls: "los-fact-row" });
    idRow.createSpan({ cls: "los-fact-label", text: "Record ID" });
    idRow.createSpan({ cls: "los-fact-value los-detail-id", text: record.id });
    button(technical, "Copy ID", () => this.plugin.copyText(record.id), "quiet");
    if (record.path) {
      const pathRow = technical.createDiv({ cls: "los-fact-row" });
      pathRow.createSpan({ cls: "los-fact-label", text: "Path" });
      pathRow.createSpan({ cls: "los-fact-value", text: record.path });
    }
  }
};

// src/views/module-view.ts
var import_obsidian11 = require("obsidian");
var ModuleView = class extends import_obsidian11.ItemView {
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
    this.screen = state.screen || (state.moduleId ? "detail" : "groups");
    this.groupId = state.groupId || null;
    this.query = state.query || "";
    const nextModuleId = state.moduleId || null;
    if (nextModuleId !== this.moduleId) {
      this.componentId = null;
      this.tab = null;
    }
    this.moduleId = nextModuleId;
    if (Object.prototype.hasOwnProperty.call(state, "componentId")) this.componentId = state.componentId || null;
    if (Object.prototype.hasOwnProperty.call(state, "tab")) this.tab = state.tab || null;
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
    await this.setState(this.leaf.state || {});
  }
  /** Units unless there is nothing to study yet. */
  defaultTab(module2) {
    return this.plugin.store.unitsFor(module2.id).length ? "units" : "overview";
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-module-view");
    if (this.screen === "list") return this.renderGroupList(root);
    if (this.screen === "detail") return this.renderModuleDetail(root);
    return this.renderGroups(root);
  }
  renderGroups(root) {
    pageHeader(
      root,
      "Modules",
      "Choose a thematic group",
      "Modules stay organized by explicit core-owned domains. Open a group to see its contents."
    );
    const groups = this.plugin.store.thematicGroups();
    if (!groups.length) {
      empty(root, "No thematic groups", "Rebuild the projection after defining thematic-group metadata.");
      return;
    }
    const grid = root.createDiv({ cls: "los-group-grid" });
    for (const group of groups) {
      const modules = this.plugin.store.modulesForGroup(group.id);
      const card = grid.createEl("button", {
        cls: "los-group-card is-clickable",
        attr: { type: "button", "aria-label": `Open ${group.title}` }
      });
      const head = card.createDiv({ cls: "los-group-card-header" });
      head.createEl("h2", { text: group.title });
      head.createSpan({ cls: "los-group-count", text: `${modules.length} module${modules.length === 1 ? "" : "s"}` });
      if (group.description) card.createEl("p", { text: group.description });
      card.createSpan({ cls: "los-route-open", text: "Open \u2192" });
      card.addEventListener("click", () => {
        this.selectedElementId = group.id;
        this.plugin.openModuleGroup(group.id);
      });
    }
  }
  renderGroupList(root) {
    const group = this.plugin.store.get(this.groupId);
    const back = button(root, "\u2039 Modules", () => this.plugin.back(), "quiet");
    back.addClass("los-route-back");
    if (!group) {
      empty(root, "Thematic group unavailable", "Return to Modules and choose another group.", "Back", () => this.plugin.back());
      return;
    }
    pageHeader(root, "Modules", group.title, group.description || "Modules in this thematic group.");
    const search = root.createEl("input", {
      cls: "los-search los-route-search",
      attr: { type: "search", placeholder: `Search ${group.title} modules\u2026`, "aria-label": `Search ${group.title} modules` }
    });
    search.value = this.query;
    search.addEventListener("input", async () => {
      this.query = search.value;
      await this.plugin.router.remember({ name: "module-list", groupId: this.groupId, query: this.query });
      this.render();
    });
    const all = this.plugin.store.modulesForGroup(group.id);
    const needle = this.query.trim().toLocaleLowerCase();
    const rows = all.filter((module2) => !needle || [module2.title, module2.code, module2.kind, module2.semester].filter(Boolean).join(" ").toLocaleLowerCase().includes(needle));
    if (!all.length) {
      empty(root, "No modules in this group", "The group exists, but no modules currently reference it.");
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
          await this.plugin.router.remember({ name: "module-list", groupId: this.groupId, query: "" });
          this.render();
        }
      );
      return;
    }
    const list = root.createDiv({ cls: "los-route-list" });
    for (const module2 of rows) {
      const row = list.createEl("button", {
        cls: "los-route-row is-clickable",
        attr: { type: "button", "aria-label": `Open module: ${module2.title}`, "data-record-id": module2.id }
      });
      const copy = row.createDiv({ cls: "los-route-row-copy" });
      copy.createEl("strong", { text: module2.title });
      const meta = [module2.code, module2.kind, module2.semester, module2.status].filter(Boolean).join(" \xB7 ");
      if (meta) copy.createDiv({ cls: "los-route-meta", text: meta });
      row.createSpan({ cls: "los-route-open", text: "Open \u2192" });
      row.addEventListener("click", () => {
        this.selectedElementId = module2.id;
        this.plugin.openModuleDetail(module2.id);
      });
    }
  }
  renderModuleDetail(root) {
    const module2 = this.plugin.store.get(this.moduleId);
    const back = button(root, "\u2039 Back", () => this.plugin.back(), "quiet");
    back.addClass("los-route-back");
    if (!module2) {
      empty(root, "Module unavailable", "Return to Modules and choose another module.");
      return;
    }
    const tab = this.tab || this.defaultTab(module2);
    const header = pageHeader(root, module2.kind, module2.title);
    header.createDiv({ cls: "los-module-facts", text: this.headline(module2) });
    const tabs = root.createDiv({ cls: "los-tabs", attr: { role: "tablist" } });
    for (const [key, label] of [
      ["overview", "Overview"],
      ["units", "Units"],
      ["resources", "Resources"],
      ["logistics", "Logistics"]
    ]) {
      const control = button(tabs, label, () => this.selectTab(key), key === tab ? "cta" : "quiet");
      control.setAttrs({ role: "tab", "aria-selected": String(key === tab) });
    }
    if (tab === "overview") this.renderOverview(root, module2);
    else if (tab === "units") this.renderUnits(root, module2);
    else if (tab === "resources") this.renderSources(root, module2);
    else this.renderLogistics(root, module2);
  }
  /** One line instead of six labelled facts; the rest is in Logistics. */
  headline(module2) {
    const nextDate = this.deadlinesFor(module2).filter((row) => (row.end_date || row.start_date) >= (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)).map((row) => row.start_date)[0];
    return [
      module2.semester,
      module2.credits != null ? `${module2.credits} LP` : "",
      module2.examination?.type ? `${module2.examination.type}${nextDate ? ` ${nextDate}` : ""}` : ""
    ].filter(Boolean).join(" \xB7 ");
  }
  renderOverview(root, module2) {
    const progress = this.plugin.store.progress(module2.id);
    const wrap = root.createDiv({ cls: "los-overview" });
    wrap.createDiv({
      cls: "los-overview-progress",
      text: `${progress.stages_complete || 0} of ${progress.stages_total || 0} stages complete across ${progress.units_total || 0} unit${progress.units_total === 1 ? "" : "s"}`
    });
    const workspaces = this.plugin.store.workspacesForModule(module2.id);
    for (const workspace of workspaces) workspaceCard(wrap, this.plugin, workspace, module2.id);
    if (!workspaces.length) {
      empty(wrap, "No active coordination workspace", "The module/unit tree still owns study state.");
    }
    const next = this.plugin.store.unitsFor(module2.id).find((unit) => unit.status === "active") || this.plugin.store.unitsFor(module2.id)[0];
    if (next) button(wrap, `Continue ${next.title}`, () => this.plugin.openUnit(next.id), "cta");
    const ahead = this.deadlinesFor(module2).filter((row) => (row.end_date || row.start_date) >= (/* @__PURE__ */ new Date()).toISOString().slice(0, 10));
    if (ahead.length) this.renderDeadlineRows(wrap, module2, ahead.slice(0, 1));
  }
  renderUnits(root, module2) {
    if ((module2.components || []).length) {
      const tabs = root.createDiv({ cls: "los-subtabs", attr: { role: "tablist" } });
      const allTab = button(
        tabs,
        "All components",
        () => this.selectComponent(null),
        this.componentId ? "quiet" : "row"
      );
      allTab.setAttrs({ role: "tab", "aria-selected": String(!this.componentId) });
      for (const component of module2.components) {
        const tab = button(
          tabs,
          component.short_title || component.title,
          () => this.selectComponent(component.id),
          this.componentId === component.id ? "row" : "quiet"
        );
        tab.setAttrs({ role: "tab", "aria-selected": String(this.componentId === component.id) });
      }
    }
    const units = this.plugin.store.unitsFor(module2.id, this.componentId);
    if (!units.length) {
      empty(root, "No units in this component", "Return to all components.");
      return;
    }
    for (const status of STATUS_ORDER) {
      const rows = units.filter((unit) => unit.status === status);
      if (!rows.length) continue;
      root.createDiv({ cls: "los-group-title", text: status.replaceAll("-", " ") });
      const grid = root.createDiv({ cls: "los-card-grid" });
      for (const unit of rows) unitCard(grid, this.plugin, unit);
    }
  }
  renderLogistics(root, module2) {
    const facts = root.createDiv({ cls: "los-fact-list" });
    for (const [label, value] of [
      ["Status", module2.status],
      ["Institution", module2.institution],
      ["Code", module2.code],
      ["Semester", module2.semester],
      ["Credits", module2.credits],
      ["Examination", module2.examination?.type]
    ]) {
      if (value == null) continue;
      const row = facts.createDiv({ cls: "los-fact-row" });
      row.createSpan({ cls: "los-fact-label", text: label });
      row.createSpan({ cls: "los-fact-value", text: String(value) });
    }
    if (module2.examination?.notes) root.createEl("p", { cls: "los-muted", text: module2.examination.notes });
    this.renderAcademicDates(root, module2);
  }
  deadlinesFor(module2) {
    const rows = this.plugin.store.rows("academic_deadlines").filter((row) => row.module_id === module2.id || (row.modules || []).some((entry) => entry.module_id === module2.id));
    return rows.sort((a, b) => String(a.start_date || "").localeCompare(String(b.start_date || "")));
  }
  renderAcademicDates(root, module2) {
    const rows = this.deadlinesFor(module2);
    if (!rows.length) return;
    const wrap = section(root, "Academic dates", "Registration windows and exam sittings for this module.");
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const ahead = rows.filter((row) => (row.end_date || row.start_date) >= today);
    const past = rows.filter((row) => (row.end_date || row.start_date) < today);
    if (ahead.length) this.renderDeadlineRows(wrap, module2, ahead);
    else empty(wrap, "No upcoming date recorded", "Past dates remain available below.");
    if (past.length) {
      const history = disclosure(wrap, `Past dates (${past.length})`, "los-deadline-history");
      this.renderDeadlineRows(history, module2, past);
    }
  }
  renderDeadlineRows(wrap, module2, rows) {
    const list = wrap.createDiv({ cls: "los-date-list" });
    for (const row of rows) {
      const card = list.createDiv({ cls: `los-date-row los-deadline-${row.kind}` });
      const date = row.end_date && row.end_date !== row.start_date ? `${row.start_date} \u2192 ${row.end_date}` : row.start_date;
      card.createDiv({ cls: "los-date-when", text: date });
      const copy = card.createDiv({ cls: "los-date-copy" });
      copy.createEl("strong", { text: row.label });
      if (row.kind === "registration-window") {
        const entry = (row.modules || []).find((item) => item.module_id === module2.id);
        if (entry?.action) copy.createEl("p", { cls: "los-micro", text: entry.action });
      } else {
        copy.createDiv({ cls: "los-micro", text: row.title || module2.title });
        const facts = copy.createDiv({ cls: "los-row" });
        badge(facts, row.registration_state || "unregistered", row.registration_state || "needs-map");
        if (row.time) facts.createSpan({ cls: "los-micro", text: row.time });
      }
    }
  }
  async selectTab(tab) {
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
      state: { screen: "detail", moduleId: this.moduleId, componentId: this.componentId, tab }
    });
  }
  async selectComponent(componentId) {
    this.componentId = componentId;
    const tab = this.tab || "units";
    await this.plugin.router.remember({
      name: "module-detail",
      moduleId: this.moduleId,
      componentId,
      tab
    });
    await this.leaf.setViewState({
      type: VIEW_MODULE,
      active: true,
      state: { screen: "detail", moduleId: this.moduleId, componentId, tab }
    });
  }
  renderSources(root, module2) {
    const sourceMap = this.plugin.store.sourceMap(module2.id);
    if (!sourceMap?.sources?.length) {
      empty(root, "No routed module sources yet", "Sources remain globally registered.");
      return;
    }
    root.createEl("p", { cls: "los-muted", text: "Roles in this module \u2014 not global quality scores." });
    const groups = /* @__PURE__ */ new Map();
    for (const entry of sourceMap.sources) {
      if (!groups.has(entry.role)) groups.set(entry.role, []);
      groups.get(entry.role).push(entry);
    }
    for (const [role, entries] of groups) {
      const group = root.createDiv({ cls: "los-source-role" });
      group.createDiv({ cls: "los-group-title", text: role.replaceAll("-", " ") });
      for (const entry of entries) {
        const row = group.createDiv({ cls: "los-row" });
        chip(row, this.plugin.store.get(entry.source_id), (record) => this.plugin.openLibrary(record.id));
        row.createEl("p", { text: entry.why });
        if (entry.unit_routes?.length) row.createDiv({ cls: "los-micro", text: `${entry.unit_routes.length} routed unit(s)` });
      }
    }
  }
};

// src/views/nav-view.ts
var import_obsidian12 = require("obsidian");
var NavView = class extends import_obsidian12.ItemView {
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
      this.plugin.settings.navMoreOpen = Boolean(more.open ?? more.attrs?.open);
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
var ProgramView = class extends import_obsidian13.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.programId = null;
  }
  getViewType() {
    return VIEW_PROGRAM;
  }
  getDisplayText() {
    return "LearningOS \xB7 Area";
  }
  async setState(state) {
    this.programId = state?.programId || this.programId;
    this.render();
  }
  getState() {
    return { programId: this.programId };
  }
  async onOpen() {
    this.programId = this.leaf.state?.programId || this.programId;
    this.render();
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-program-view");
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
    if (this.programId === "queue-needs-map") return this.renderNeedsMap(root);
    if (this.programId === "inbox") return this.renderInbox(root);
    const program = this.plugin.store.get(this.programId);
    if (!program) {
      empty(root, "Area unavailable", "Return Home and choose another area.");
      return;
    }
    pageHeader(root, "", "Learn");
    const tabs = root.createDiv({ cls: "los-tabs", attr: { role: "tablist" } });
    for (const [areaId, title] of LEARN_AREAS) {
      const active = areaId === program.id;
      const tab = button(tabs, title, () => this.plugin.openLearn(areaId), active ? "cta" : "quiet");
      tab.setAttrs({ role: "tab", "aria-selected": String(active) });
    }
    if (program.description) root.createEl("p", { cls: "los-muted", text: program.description });
    const modules = this.plugin.store.modulesFor(program.id);
    const list = root.createDiv({ cls: "los-learning-list" });
    if (!modules.length) empty(root, "No modules in this area yet", "Nothing is hidden.");
    for (const module2 of modules) progressRow(list, this.plugin, module2);
    if (program.semester_bound) {
      const semesters = disclosure(root, "Semesters");
      for (const semester of program.semesters || []) {
        const row = semesters.createDiv({ cls: "los-row" });
        row.createEl("strong", { text: semester.title });
        badge(row, semester.status, semester.status);
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
    const rows = ["Priorities", "Commitments", "Dependencies", "Deferrals"].map((heading) => [heading, projectedExcerpt(coordination?.sections?.[heading], 1600)]).filter(([, body]) => body);
    if (!rows.length) return;
    const panel = disclosure(root, "Semester coordination", "los-coordination-details");
    for (const [heading, body] of rows) {
      const row = panel.createDiv({ cls: "los-coordination-row" });
      row.createEl("strong", { text: heading });
      row.createEl("p", { text: body });
    }
  }
  renderNeedsMap(root) {
    pageHeader(root, "Review", "Units needing a study map");
    const grid = root.createDiv({ cls: "los-card-grid" });
    for (const unit of this.plugin.store.units().filter((row) => !this.plugin.store.mapForUnit(row.id))) {
      unitCard(grid, this.plugin, unit);
    }
  }
  renderInbox(root) {
    pageHeader(root, "", "Capture", "You capture; the operator files.");
    const count = this.plugin.store.data?.counts?.inbox_items || 0;
    const wrap = section(root, `${count} item${count === 1 ? "" : "s"} awaiting routing`);
    const form = wrap.createDiv({ cls: "los-capture-grid" });
    const textPanel = form.createDiv({ cls: "los-capture-panel" });
    textPanel.createEl("h3", { text: "Quick text" });
    const title = textPanel.createEl("input", {
      cls: "los-search los-capture-title",
      attr: { type: "text", placeholder: "Optional title", "aria-label": "Capture title" }
    });
    const editor = textPanel.createEl("textarea", {
      cls: "los-note-editor los-capture-editor",
      attr: { placeholder: "Paste a link, thought, question, or fragment\u2026", "aria-label": "Capture text" }
    });
    const draft = this.plugin.getInboxDraft();
    title.value = draft.title || "";
    editor.value = draft.text || "";
    const status = textPanel.createDiv({ cls: "los-draft-status", attr: { "aria-live": "polite" } });
    const captureButton = button(textPanel, "Capture text", () => {
      const text = editor.value.trim();
      if (!text) {
        new import_obsidian13.Notice("Enter some text before capturing.");
        editor.focus();
        return;
      }
      this.capture(
        () => this.plugin.gateway.captureText(text, title.value.trim()),
        () => {
          this.plugin.clearInboxDraft();
          editor.value = "";
          title.value = "";
        }
      );
    }, "cta");
    const syncDraft = () => {
      const hasDraft = Boolean(title.value || editor.value);
      this.plugin.setInboxDraft(title.value, editor.value);
      captureButton.disabled = !editor.value.trim();
      status.setText(hasDraft ? "Draft kept locally until capture." : "Nothing entered yet.");
      status.toggleClass("is-dirty", hasDraft);
    };
    title.addEventListener("input", syncDraft);
    editor.addEventListener("input", syncDraft);
    captureButton.disabled = !editor.value.trim();
    status.setText(title.value || editor.value ? "Draft kept locally until capture." : "Nothing entered yet.");
    status.toggleClass("is-dirty", Boolean(title.value || editor.value));
    const filePanel = form.createDiv({ cls: "los-capture-panel" });
    filePanel.createEl("h3", { text: "File or handwriting" });
    filePanel.createEl("p", { cls: "los-muted", text: "The original is copied into the inbox; it is not moved or renamed." });
    const picker = filePanel.createEl("input", {
      cls: "los-file-input los-capture-file",
      attr: { type: "file", "aria-label": "Choose inbox capture file" }
    });
    button(filePanel, "Capture selected file", () => {
      const localPath = localFilePath(picker.files?.[0]);
      if (!localPath) {
        new import_obsidian13.Notice("Choose a local file first.");
        return;
      }
      this.capture(() => this.plugin.gateway.captureFile(localPath), () => {
        picker.value = "";
      });
    }, "quiet");
  }
  async capture(action, clear) {
    if (this.plugin.gateway.isBusy) new import_obsidian13.Notice("Queued behind the running LearningOS write.");
    try {
      await this.plugin.mutate(async () => {
        await action();
        await this.plugin.gateway.call(["generate"], { expectJson: false });
      });
      clear?.();
      new import_obsidian13.Notice("Captured to the LearningOS inbox.");
      this.render();
    } catch (error) {
      new import_obsidian13.Notice(error?.message || String(error));
    }
  }
};

// src/views/project-view.ts
var import_obsidian14 = require("obsidian");
var ProjectLinkReasonModal = class extends import_obsidian14.Modal {
  constructor(app, plugin, relationship) {
    super(app);
    this.plugin = plugin;
    this.relationship = relationship;
  }
  onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-linked-reason-modal");
    this.plugin.router.openOverlay({ kind: "linked-material-reason", relationshipId: this.relationship.id });
    pageHeader(root, "Linked material", "Why this is linked");
    const target = this.plugin.store.get(this.relationship.to_id);
    const relation = section(root, "Relationship");
    relation.createEl("p", { text: `${this.relationship.to_type || "record"} \xB7 ${this.relationship.relation_type || "linked"}` });
    const rationale = section(root, "Rationale");
    rationale.createEl("p", { text: this.relationship.reason || "No rationale was projected." });
    const contribution = section(root, "Contribution");
    contribution.createEl("p", { text: this.relationship.contribution || "No contribution was projected." });
    const actions = root.createDiv({ cls: "los-actions" });
    if (target) button(actions, "Open target", () => {
      this.close();
      this.plugin.openRecord(target);
    }, "tertiary");
    else if (this.relationship.path) button(actions, "Open target", () => {
      this.close();
      this.plugin.openAuthoredPath(this.relationship.path);
    }, "tertiary");
    button(actions, "Close", () => this.close(), "quiet");
  }
  onClose() {
    this.plugin.router.clearOverlay();
    this.contentEl.empty();
  }
};
var ProjectView = class extends import_obsidian14.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.screen = "list";
    this.projectId = null;
    this.tab = "overview";
    this.query = "";
    this.selectedElementId = null;
  }
  getViewType() {
    return VIEW_PROJECT;
  }
  getDisplayText() {
    return "LearningOS \xB7 Projects";
  }
  async setState(state = {}) {
    this.screen = state.screen || (state.projectId ? "detail" : "list");
    this.projectId = state.projectId || null;
    this.tab = state.tab || "overview";
    this.query = state.query || "";
    this.render();
  }
  getState() {
    return { screen: this.screen, projectId: this.projectId, tab: this.tab, query: this.query };
  }
  async onOpen() {
    await this.setState(this.leaf.state || {});
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-project-view");
    if (!this.plugin.store.ready) return empty(root, "Projects unavailable", this.plugin.store.error);
    if (this.screen === "detail") return this.renderDetail(root);
    return this.renderList(root);
  }
  renderList(root) {
    pageHeader(root, "Projects", "Projects", "Long-running work with its own structure, materials, files, and decisions.");
    const input = root.createEl("input", {
      cls: "los-search los-project-search",
      attr: { type: "search", placeholder: "Search projects", "aria-label": "Search projects" }
    });
    input.value = this.query;
    const results = root.createDiv({ cls: "los-project-list" });
    const draw = () => {
      results.empty();
      const words = String(input.value || "").toLocaleLowerCase().split(/\s+/).filter(Boolean);
      const rows = this.plugin.store.projects().filter((project) => {
        const hay = [project.id, project.title, project.objective, project.project_type].filter(Boolean).join(" ").toLocaleLowerCase();
        return words.every((word) => hay.includes(word));
      });
      if (!rows.length) return empty(results, "No projects found", "No first-class project matches this query.", "Clear search", () => {
        input.value = "";
        input.fire("input");
      });
      for (const project of rows) {
        const row = results.createEl("button", {
          cls: "los-card los-project-row is-clickable",
          attr: { type: "button", "aria-label": `Open project: ${project.title}` }
        });
        row.setAttr("data-record-id", project.id);
        const top = row.createDiv({ cls: "los-card-top" });
        top.createEl("h2", { text: project.title });
        badge(top, project.status || "planned", project.status || "planned");
        row.createEl("p", { text: projectedExcerpt(project.objective, 280) });
        row.createDiv({ cls: "los-micro", text: `${project.project_type || "project"} \xB7 ${(project.linked_module_ids || []).length} linked modules` });
        row.addEventListener("click", () => {
          this.selectedElementId = project.id;
          this.plugin.openProject(project.id, "overview");
        });
      }
    };
    input.addEventListener("input", () => {
      this.query = input.value;
      this.plugin.router.remember({ name: "project-list", query: this.query });
      draw();
    });
    draw();
  }
  renderDetail(root) {
    const project = this.plugin.store.get(this.projectId);
    if (!project || project.type !== "project") {
      pageHeader(root, "Projects", "Project not found");
      return empty(root, "This project is unavailable", "The current projection does not contain this project.", "Back to projects", () => this.plugin.openProjects());
    }
    const head = pageHeader(root, "Project", project.title, project.objective || "");
    const headActions = head.createDiv({ cls: "los-actions" });
    button(headActions, "Back", () => this.plugin.back(), "quiet");
    badge(headActions, project.status || "planned", project.status || "planned");
    const tabs = root.createDiv({ cls: "los-project-tabs", attr: { role: "tablist", "aria-label": "Project sections" } });
    for (const [id, label] of [
      ["overview", "Overview"],
      ["structure", "Structure"],
      ["linked-materials", "Linked Materials"],
      ["files", "Files"],
      ["decisions", "Decisions"]
    ]) {
      const tab = button(tabs, label, () => this.plugin.openProject(project.id, id), "tertiary");
      tab.toggleClass("is-active", this.tab === id);
      tab.setAttrs({ role: "tab", "aria-selected": String(this.tab === id) });
    }
    const body = root.createDiv({ cls: "los-project-body" });
    if (this.tab === "structure") return this.renderStructure(body, project);
    if (this.tab === "linked-materials") return this.renderLinked(body, project);
    if (this.tab === "files") return this.renderFiles(body, project);
    if (this.tab === "decisions") return this.renderDecisions(body, project);
    return this.renderOverview(body, project);
  }
  renderOverview(root, project) {
    const overview = section(root, "Overview");
    const meta = overview.createDiv({ cls: "los-project-meta-grid" });
    for (const [label, value] of [
      ["Type", project.project_type || "Project"],
      ["Status", project.status || "planned"],
      ["Confidentiality", project.boundaries?.confidentiality || "unspecified"],
      ["External code access", project.boundaries?.external_code_access || "unspecified"]
    ]) {
      const row = meta.createDiv({ cls: "los-project-meta" });
      row.createDiv({ cls: "los-kicker", text: label });
      row.createEl("strong", { text: value });
    }
    if (project.boundaries?.notes) overview.createEl("p", { cls: "los-muted", text: project.boundaries.notes });
    const units = section(root, "Project units", "Existing learning units remain reachable without turning the project into a module.");
    const unitRows = (project.unit_ids || []).map((id) => this.plugin.store.get(id)).filter(Boolean);
    if (!unitRows.length) empty(units, "No units linked", "This project can exist without a linear learning map.");
    for (const unit of unitRows) button(units, unit.title || unit.id, () => this.plugin.openUnit(unit.id), "row");
  }
  renderStructure(root, project) {
    const structure = project.structure || { kind: "none", nodes: [] };
    const wrap = section(root, "Structure", `Structure mode: ${structure.kind || "none"}.`);
    if (!Array.isArray(structure.nodes) || !structure.nodes.length) return empty(wrap, "No fixed structure", "This project currently has no linear or nested step map.");
    const tree = wrap.createDiv({ cls: "los-project-structure" });
    const node = (parent, row, depth = 0) => {
      const item = parent.createDiv({ cls: `los-project-node los-project-node-depth-${Math.min(depth, 4)}` });
      const top = item.createDiv({ cls: "los-card-top" });
      top.createEl("h3", { text: row.title || row.id });
      if (row.status) badge(top, row.status, row.status);
      item.createDiv({ cls: "los-micro", text: row.kind || "step" });
      if (row.summary) item.createEl("p", { text: row.summary });
      const children = Array.isArray(row.children) ? row.children : [];
      if (children.length) {
        const nested = item.createDiv({ cls: "los-project-node-children" });
        for (const child of children) node(nested, child, depth + 1);
      }
    };
    for (const row of structure.nodes) node(tree, row);
  }
  renderLinked(root, project) {
    const wrap = section(root, "Linked Materials", "Links retain a core-authored reason rather than implying ownership.");
    const relationships = this.plugin.store.projectRelationships(project.id);
    if (!relationships.length) return empty(wrap, "No linked materials", "Links appear here when the project relationship projection contains them.");
    for (const relationship of relationships) {
      const target = this.plugin.store.get(relationship.to_id);
      const row = wrap.createDiv({ cls: "los-card los-project-link" });
      const copy = row.createDiv({ cls: "los-project-link-copy" });
      copy.createEl("h3", { text: target?.title || relationship.to_id });
      copy.createDiv({ cls: "los-micro", text: `${relationship.to_type || "record"} \xB7 ${relationship.relation_type || "linked"}` });
      const actions = row.createDiv({ cls: "los-actions" });
      if (target) button(actions, "Open", () => this.plugin.openRecord(target), "tertiary");
      button(actions, "Why linked", () => new ProjectLinkReasonModal(this.app, this.plugin, relationship).open(), "quiet");
    }
  }
  renderFiles(root, project) {
    const wrap = section(root, "Files", "Project-owned references; canonical content remains in plain files.");
    const files = Array.isArray(project.files) ? project.files : [];
    if (!files.length) return empty(wrap, "No files linked", "Project files can be added through a declared core capability.");
    for (const file of files) {
      const row = wrap.createDiv({ cls: "los-card los-project-file" });
      const copy = row.createDiv({ cls: "los-project-link-copy" });
      copy.createEl("h3", { text: file.label || file.path });
      copy.createDiv({ cls: "los-micro", text: `${file.kind || "file"} \xB7 ${file.path}` });
      if (file.path) button(row, "Open", () => this.plugin.openAuthoredPath(file.path), "tertiary");
    }
  }
  renderDecisions(root, project) {
    const wrap = section(root, "Decisions", "Open questions and durable decisions, without manufacturing a completion score.");
    const decisions = Array.isArray(project.decisions) ? project.decisions : [];
    if (!decisions.length) return empty(wrap, "No decisions recorded", "Decisions appear here when the project records them.");
    for (const decision of decisions) {
      const row = wrap.createDiv({ cls: "los-card los-project-decision" });
      const top = row.createDiv({ cls: "los-card-top" });
      top.createEl("h3", { text: decision.title });
      badge(top, decision.status || "open", decision.status || "open");
      row.createEl("p", { text: decision.summary || "" });
    }
  }
};

// src/views/review-view.ts
var import_obsidian15 = require("obsidian");
var fs = __toESM(require("node:fs"));
var nodePath = __toESM(require("node:path"));
var ReviewView = class extends import_obsidian15.ItemView {
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
    const shelving = this.plugin.store.units().filter((row) => row.status === "ready-to-shelve");
    const needsMap = this.plugin.store.units().filter((row) => !this.plugin.store.mapForUnit(row.id));
    const inbox = this.plugin.store.data.counts?.inbox_items || 0;
    const garden = this.plugin.store.gardenEntries();
    const list = root.createDiv({ cls: "los-review-list" });
    this.queue(
      list,
      "Ready to shelve",
      shelving.length,
      "Units whose working notes are ready to become durable knowledge.",
      shelving.length ? ["Review proposals", () => this.plugin.openShelving(shelving[0].id)] : null
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
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.report = "";
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
      const base = this.plugin.app.vault.adapter.getBasePath();
      const pluginInfo = this.plugin.manifest || {};
      const directory = pluginInfo.dir || nodePath.join(".obsidian", "plugins", pluginInfo.id || "learningos-ui");
      const target = nodePath.join(base, directory, "build-info.json");
      if (!fs.existsSync(target)) return fallback;
      const parsed = JSON.parse(fs.readFileSync(target, "utf8"));
      return { ...fallback, ...parsed };
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
    const generated = this.plugin.store.data?._generated || {};
    const build = this.buildInfo();
    const facts = section(root, "Contract and versions");
    const table = facts.createDiv({ cls: "los-fact-list" });
    for (const [label, value] of [
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
    ]) {
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
Failed: ${error?.message || String(error)}
Tried: ${resolved.attempted.join(", ")}`;
    }
    this.render();
  }
};

// src/views/shelving-view.ts
var import_obsidian16 = require("obsidian");
var ShelvingView = class extends import_obsidian16.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.unitId = null;
    this.proposal = null;
    this.selected = /* @__PURE__ */ new Set();
  }
  getViewType() {
    return VIEW_SHELVING;
  }
  getDisplayText() {
    return "LearningOS \xB7 Shelving";
  }
  async setState(state) {
    this.unitId = state?.unitId || this.unitId;
    await this.loadProposal();
    this.render();
  }
  getState() {
    return { unitId: this.unitId };
  }
  async onOpen() {
    this.unitId = this.leaf.state?.unitId || this.unitId;
    await this.loadProposal();
    this.render();
  }
  async loadProposal() {
    if (!this.unitId) return;
    const map = this.plugin.store.mapForUnit(this.unitId);
    if (map?.shelving?.state === "proposed") this.proposal = map.shelving;
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-shelving-view");
    const unit = this.plugin.store.get(this.unitId);
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
    const proposal = this.proposal || (map?.shelving?.state === "proposed" ? map.shelving : null);
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
    const rows = this.plugin.store.units().filter((row) => row.status === "ready-to-shelve");
    if (!rows.length) empty(wrap, "No unit is waiting", "Keep working from any active unit.");
    for (const unit of rows) unitCard(wrap, this.plugin, unit);
  }
  async prepare() {
    try {
      await this.plugin.mutate(() => this.plugin.gateway.prepareShelving(this.unitId));
      await this.loadProposal();
      this.render();
    } catch (error) {
      new import_obsidian16.Notice(error?.message || String(error));
    }
  }
  async apply() {
    if (!this.selected.size) {
      new import_obsidian16.Notice("Select at least one proposal.");
      return;
    }
    try {
      await this.plugin.mutate(() => this.plugin.gateway.applyShelving(this.unitId, [...this.selected]));
      this.proposal = null;
      this.selected.clear();
      this.render();
    } catch (error) {
      new import_obsidian16.Notice(error?.message || String(error));
    }
  }
};

// src/views/unit-view.ts
var import_obsidian17 = require("obsidian");
var UnitView = class extends import_obsidian17.ItemView {
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
  async setState(state) {
    const nextUnitId = state?.unitId || this.unitId;
    if (nextUnitId !== this.unitId) this.stageId = null;
    this.unitId = nextUnitId;
    const requested = Object.prototype.hasOwnProperty.call(state || {}, "stageId") ? state.stageId : null;
    this.stageId = this.plugin.getSelectedStage(this.unitId) || requested || this.stageId;
    this.render();
  }
  getState() {
    return { unitId: this.unitId, stageId: this.stageId };
  }
  async onOpen() {
    this.unitId = this.leaf.state?.unitId || this.unitId;
    this.stageId = this.plugin.getSelectedStage(this.unitId) || this.leaf.state?.stageId || this.stageId;
    this.render();
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-unit-view");
    const unit = this.plugin.store.get(this.unitId);
    if (!unit) {
      empty(root, "Unit unavailable", "Return to its module.");
      return;
    }
    const module2 = this.plugin.store.get(unit.module_id);
    const project = this.plugin.store.projectForUnit(unit);
    const owner = project || module2;
    const ownerLabel = owner?.title || unit.module_id;
    const header = pageHeader(root, `${ownerLabel} \xB7 ${unit.kind}`, unit.title, unit.scope);
    const headerActions = header.createDiv({ cls: "los-actions" });
    if (project) button(headerActions, "Back to project", () => this.plugin.back(), "quiet");
    else button(headerActions, "Back to module", () => this.plugin.openModule(unit.module_id), "quiet");
    const studyMap = this.plugin.store.mapForUnit(unit.id);
    if (!studyMap) {
      const missing = section(root, "Study map needed");
      empty(
        missing,
        "This unit has no current study script",
        "AI may propose a scoped map; the core imports it only after review.",
        "Create map with AI",
        () => this.plugin.askAiScoped(
          "Propose one study-map JSON document for this unit. Do not write files; include exact source actions and done-when criteria.",
          { moduleId: unit.module_id, projectId: project?.id, unitId: unit.id, componentId: unit.component_id }
        )
      );
      this.renderArtifacts(root, unit);
      return;
    }
    const stages = Array.isArray(studyMap.stages) ? studyMap.stages.filter((row) => row && typeof row === "object") : [];
    if (!stages.length) {
      const bare = section(root, "Study map needs stages");
      empty(
        bare,
        "This study map has no stages yet",
        "Stage authoring belongs to the core \u2014 import a map or add stages there, then rebuild views."
      );
      this.renderArtifacts(root, unit);
      return;
    }
    const map = { ...studyMap, stages };
    if (!this.stageId || !stages.some((row) => row.id === this.stageId)) {
      this.stageId = map.current_stage;
      this.plugin.setSelectedStage(unit.id, this.stageId);
    }
    const stage = stages.find((row) => row.id === this.stageId) || stages[0];
    const layout = root.createDiv({ cls: "los-unit-layout" });
    this.renderRail(layout, unit, map, stage);
    this.renderStage(layout, unit, map, stage);
    this.renderActionBar(root, unit, map, stage);
    const more = disclosure(root, "Unit artifacts and evidence", "los-unit-extras");
    this.renderArtifacts(more, unit);
  }
  renderRail(layout, unit, studyMap, current) {
    const rail = layout.createDiv({ cls: "los-stage-rail" });
    rail.createEl("h2", { text: "Stages" });
    for (const [index, stage] of studyMap.stages.entries()) {
      const row = rail.createEl("button", {
        cls: `los-stage-row los-s-${stage.status} ${stage.id === current.id ? "is-selected" : ""} is-clickable`,
        attr: { type: "button", "aria-current": stage.id === current.id ? "step" : "false" }
      });
      row.createSpan({ cls: "los-stage-index", text: String(index + 1).padStart(2, "0") });
      const copy = row.createSpan({ cls: "los-stage-copy" });
      copy.createSpan({ text: stage.title });
      const marker = stage.status === "complete" ? "Complete" : stage.status === "skipped" ? "Skipped" : "";
      if (marker) copy.createSpan({ cls: "los-micro", text: marker });
      row.addEventListener("click", () => this.selectStage(stage.id));
    }
    const add = button(rail, "Add note", () => this.plugin.openUnitNote(unit, studyMap), "quiet");
    add.addClass("los-add-unit-note");
    const draft = this.plugin.getUnitNoteDraft(unit.id, studyMap.stages);
    if (draft.text.trim()) rail.createDiv({ cls: "los-micro los-unit-note-draft", text: "Unsaved unit-note draft kept locally." });
  }
  renderStage(layout, unit, studyMap, stage) {
    const center = layout.createDiv({ cls: "los-stage-workspace" });
    const top = center.createDiv({ cls: "los-stage-heading" });
    top.createDiv({ cls: "los-kicker", text: stage.exam_critical ? "Exam-critical stage" : stage.scope_triage });
    top.createEl("h2", { text: stage.title });
    if (stage.objective) {
      const goal = center.createDiv({ cls: "los-stage-goal" });
      goal.createDiv({ cls: "los-kicker", text: "Goal" });
      goal.createEl("p", { text: stage.objective });
    }
    if (stage.estimate_minutes) badge(top, `${stage.estimate_minutes} min`, "role");
    const resources = section(center, "Resources");
    const stageResources = Array.isArray(stage.resources) ? stage.resources.filter((row) => row && typeof row === "object") : [];
    if (!stageResources.length) empty(resources, "No source action selected", "Use the unit scope and ask AI for a proposal.");
    for (const resource of stageResources) {
      const row = resources.createDiv({ cls: "los-resource-row" });
      icon(row.createSpan(), resource.kind === "watch" ? "play" : resource.kind === "practise" ? "pencil-line" : "book-open");
      const copy = row.createDiv({ cls: "los-resource-copy" });
      copy.createEl("strong", { text: resource.label });
      if (resource.locator) copy.createDiv({ cls: "los-micro", text: resource.locator });
      if (resource.source_id) {
        const source = this.plugin.store.get(resource.source_id);
        chip(copy, source, (record) => this.plugin.openLibrary(record.id));
      }
      const actions = row.createDiv({ cls: "los-actions los-resource-actions" });
      if (resource.url || resource.vault_path) button(actions, "Open", () => this.plugin.openResource(resource), "quiet");
      if (resource.source_id) {
        overflowMenu(actions, [
          ["Helpful", () => this.mutate(() => this.plugin.gateway.feedback(unit.id, stage.id, resource.source_id, "helpful"))],
          ["Too advanced", () => this.mutate(() => this.plugin.gateway.feedback(unit.id, stage.id, resource.source_id, "too-advanced"))],
          ["Useful for review", () => this.mutate(() => this.plugin.gateway.feedback(unit.id, stage.id, resource.source_id, "useful-for-review"))]
        ], `Rate ${resource.label}`);
      }
    }
    const criteria = Array.isArray(stage.done_when) ? stage.done_when.filter((row) => typeof row === "string" && row.trim()) : [];
    if (criteria.length) {
      const done = section(center, "Done when");
      const marks = this.plugin.getDoneWhen(unit.id, stage.id);
      const list = done.createDiv({ cls: "los-donewhen-list" });
      for (const [index, criterion] of criteria.entries()) {
        const row = list.createEl("label", { cls: "los-donewhen-row" });
        const box = row.createEl("input", {
          attr: { type: "checkbox", "aria-label": criterion }
        });
        if (marks[index]) box.setAttr("checked", "checked");
        box.checked = Boolean(marks[index]);
        box.addEventListener("change", () => {
          this.plugin.setDoneWhen(unit.id, stage.id, index, Boolean(box.checked));
          row.toggleClass("is-checked", Boolean(box.checked));
        });
        row.toggleClass("is-checked", Boolean(marks[index]));
        row.createSpan({ text: criterion });
      }
    }
    this.renderStageContext(center, unit, studyMap, stage);
  }
  /** One primary action and one menu. The primary is filled; nothing else on this
   *  screen may be. */
  renderActionBar(root, unit, studyMap, stage) {
    const bar = root.createDiv({ cls: "los-unit-actionbar" });
    button(bar, "Mark complete", () => this.mutate(
      () => this.plugin.gateway.progress(unit.id, stage.id, "complete"),
      () => this.plugin.clearDoneWhen(unit.id, stage.id)
    ), "cta");
    overflowMenu(bar, [
      stage.status !== "active" && ["Revisit stage", () => this.mutate(
        () => this.plugin.gateway.progress(unit.id, stage.id, "revisit")
      )],
      ["Pause unit", () => this.mutate(() => this.plugin.gateway.progress(unit.id, stage.id, "paused"))],
      ["Skip stage", () => this.mutate(() => this.plugin.gateway.progress(unit.id, stage.id, "skipped"))],
      ["Report prerequisite gap", () => this.mutate(
        () => this.plugin.gateway.detour(unit.id, stage.id, "Prerequisite gap", "required-now")
      )],
      ["Prepare shelving", () => this.plugin.openShelving(unit.id)],
      this.plugin.settings.showAiRecommendation && ["Ask AI with stage context", () => this.plugin.askAiScoped(
        "Help with this stage. Treat the active file as supplementary context only.",
        { moduleId: unit.module_id, projectId: this.plugin.store.projectForUnit(unit)?.id, unitId: unit.id, stageId: stage.id }
      )],
      ["End learning session", () => this.plugin.reviewSessionEnd()]
    ], "More unit actions");
  }
  renderStageContext(center, unit, studyMap, stage) {
    const stageAttachments = Array.isArray(stage.attachments) ? stage.attachments.filter(Boolean) : [];
    const detours = (studyMap.detours || []).filter((row) => row.spawned_by_stage === stage.id && row.status !== "resolved");
    const feedbackRows = Array.isArray(stage.source_feedback) ? stage.source_feedback : [];
    if (!stageAttachments.length && !detours.length && !feedbackRows.length) return;
    const detail = disclosure(center, "Stage context");
    for (const attachment of stageAttachments) {
      const path = typeof attachment === "string" ? attachment : attachment.path || attachment.vault_path;
      const label = typeof attachment === "string" ? attachment.split("/").pop() : attachment.label || path;
      if (path) button(detail, label, () => this.plugin.openAuthoredPath(path), "quiet");
    }
    for (const detour of detours) {
      const row = detail.createDiv({ cls: "los-detour-row" });
      row.createEl("strong", { text: "Open prerequisite detour" });
      row.createEl("p", { text: `${detour.title} \xB7 ${detour.classification} \xB7 returns here` });
      button(row, "Resolve and return", () => this.mutate(
        () => this.plugin.gateway.resolveDetour(unit.id, detour.id, "Resolved from the unit workspace.")
      ), "quiet");
    }
    for (const row of feedbackRows) detail.createDiv({ cls: "los-row", text: `${row.source_id} \xB7 ${row.feedback}` });
  }
  renderArtifacts(root, unit) {
    const wrap = section(root, "Unit artifacts", "Durable notes remain globally canonical; this unit owns stable references.");
    const labels = { ultimate_reference: "Ultimate Reference", exercise_bank: "Exercise Bank", mock_exam: "Mock Exam" };
    let count = 0;
    for (const [key, label] of Object.entries(labels)) {
      const id = unit.artifacts?.[key];
      if (!id) continue;
      count += 1;
      const card = wrap.createDiv({ cls: "los-artifact-card" });
      card.createEl("h3", { text: label });
      chip(card, this.plugin.store.get(id), (record) => this.plugin.openRecord(record));
    }
    for (const id of unit.artifacts?.other || []) {
      count += 1;
      chip(wrap, this.plugin.store.get(id), (record) => this.plugin.openRecord(record));
    }
    if (!count) empty(wrap, "No durable artifact linked yet", "Working notes stay with the stage until shelving is approved.");
  }
  /**
   * Every write goes through the plugin-wide queue, so two clicks in two views
   * can no longer race the same `--expected-snapshot`.
   */
  async mutate(action, onConfirmed = null) {
    if (this.plugin.gateway.isBusy) {
      new import_obsidian17.Notice("A LearningOS write is already running.");
      return;
    }
    try {
      await this.plugin.mutate(action);
      onConfirmed?.();
      this.render();
    } catch (error) {
      new import_obsidian17.Notice(error?.message || String(error));
    }
  }
  async selectStage(stageId) {
    this.stageId = stageId;
    this.plugin.setSelectedStage(this.unitId, stageId);
    await this.leaf.setViewState({
      type: VIEW_UNIT,
      active: true,
      state: { unitId: this.unitId, stageId: this.stageId }
    });
  }
};

// src/main.ts
var LearningOSUI = class extends import_obsidian18.Plugin {
  async onload() {
    this.settings = { ...DEFAULT_SETTINGS, ...await this.loadData() };
    this.settings.uiDrafts ||= { stages: {}, unitNotes: {}, selectedStages: {}, inbox: { title: "", text: "" } };
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
    const marks = [...this.settings.uiDrafts.doneWhen[key] || []];
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
    const candidates = [
      [configured, "configured in settings"],
      [nodePath2.join(base, ".venv", "bin", "python"), "project virtual environment"],
      [nodePath2.join(base, ".venv", "Scripts", "python.exe"), "project virtual environment (Windows)"]
    ].filter(([path]) => path);
    const attempted = candidates.map(([path]) => path);
    for (const [path, origin] of candidates) {
      if (fs2.existsSync(path)) return { path, origin, attempted };
    }
    const fallback = import_node_process.default?.platform === "win32" ? "python" : "python3";
    return { path: fallback, origin: "PATH fallback", attempted: [...attempted, fallback] };
  }
  runLos(args, callback) {
    const base = this.app.vault.adapter.getBasePath();
    const python = this.resolvePython().path;
    const script = nodePath2.join(base, "tools", "los.py");
    (0, import_node_child_process.execFile)(python, [script, ...args], { cwd: base, timeout: 18e4, maxBuffer: 8 * 1024 * 1024 }, callback);
  }
  async reloadStore() {
    const ok = await this.store.load();
    if (!ok) throw new Error(this.store.error);
    this.app.workspace.iterateAllLeaves((leaf) => leaf.view?.render?.());
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
    return this.router.navigate({ name: "project-detail", projectId, tab }, { pushHistory: !changingTab });
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
    return this.router.navigate({ name: "library-home", collection });
  }
  openLibraryGroup(collection, groupId, query = "", facet = "all") {
    return this.router.navigate({ name: "library-group", collection, groupId, query, facet });
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
  async mutate(action, { reload = true } = {}) {
    return this.gateway.enqueue(async () => {
      const result = await action();
      if (reload) await this.reloadStore();
      return result;
    });
  }
  async generate() {
    try {
      await this.mutate(async () => {
        await this.gateway.call(["validate"], { expectJson: false });
        await this.gateway.call(["generate"], { expectJson: false });
      });
      new import_obsidian18.Notice("LearningOS projection rebuilt.");
    } catch (error) {
      new import_obsidian18.Notice(error?.message || String(error));
    }
  }
  async reviewSessionEnd() {
    try {
      const review = await this.gateway.endSession();
      new SessionEndModal(this.app, this, review).open();
      return review;
    } catch (error) {
      new import_obsidian18.Notice(error?.message || String(error));
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
    if (resource.vault_path) return this.openVaultPath(resource.vault_path);
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
