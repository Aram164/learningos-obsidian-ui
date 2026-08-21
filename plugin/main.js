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
var import_obsidian22 = require("obsidian");

// src/app/global-search.ts
var import_obsidian2 = require("obsidian");

// src/components.ts
var import_obsidian = require("obsidian");
var import_electron = require("electron");

// src/contracts/manifest.ts
var MANIFEST_CONTRACT_VERSION = 5;
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function requireArray(record, key) {
  if (!Array.isArray(record[key])) {
    throw new TypeError(`Manifest field ${String(key)} must be an array.`);
  }
}
function assertManifest(value) {
  if (!isRecord(value) || !isRecord(value._generated)) {
    throw new TypeError("Manifest requires an _generated object.");
  }
  if (value._generated.contract_version !== MANIFEST_CONTRACT_VERSION) {
    throw new TypeError(
      `Unsupported manifest contract ${String(value._generated.contract_version)}; expected ${MANIFEST_CONTRACT_VERSION}.`
    );
  }
  for (const key of [
    "academic_deadlines",
    "garden_entries",
    "review_items",
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
    "topics",
    "units"
  ]) {
    requireArray(value, key);
  }
  for (const unit of value.units) {
    if (!isRecord(unit) || typeof unit.id !== "string" || typeof unit.notes_text !== "string" || !Array.isArray(unit.note_sections)) {
      throw new TypeError("Manifest unit rows require projected unit note fields.");
    }
  }
  for (const key of ["ai_actions", "artifact_revisions", "backlinks", "counts", "indexes", "progress", "project_aliases"]) {
    if (!isRecord(value[key])) {
      throw new TypeError(`Manifest field ${key} must be an object.`);
    }
  }
}

// src/constants.ts
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

// src/projection/readers.ts
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function asRecord(value) {
  return isRecord2(value) ? value : null;
}
function asRecordOrEmpty(value) {
  return asRecord(value) ?? {};
}
function asString(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}
function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}
function asText(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value);
  return text.length > 0 ? text : null;
}
function asBoolean(value) {
  return value === true || value === 1 || value === "true";
}
function asRecords(value) {
  return Array.isArray(value) ? value.filter(isRecord2) : [];
}
function asStrings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.length > 0) : [];
}
function asTrimmedStrings(value) {
  return Array.isArray(value) ? value.map(asTrimmedString).filter(Boolean) : [];
}
function asCount(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}
function asFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function asNumber(value) {
  return asFiniteNumber(value) ?? 0;
}
function asNumbers(value) {
  return Array.isArray(value) ? value.filter((item) => asFiniteNumber(item) !== null) : [];
}
function asNumberRecord(value) {
  const result = {};
  if (!isRecord2(value)) return result;
  for (const [key, entry] of Object.entries(value)) {
    const number = asFiniteNumber(entry);
    if (number !== null) result[key] = number;
  }
  return result;
}
function asListLength(value) {
  return Array.isArray(value) ? value.length : 0;
}
function optionalString(value) {
  return typeof value === "string" ? value : void 0;
}
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function asLabel(record, fallback = "Untitled") {
  if (!record) return fallback;
  return asString(record.title) ?? asString(record.label) ?? asString(record.name) ?? asString(record.id) ?? fallback;
}

// src/accessibility/button-group.ts
function enableButtonGroupKeyboardNavigation(group, orientation = "horizontal") {
  group.addEventListener("keydown", (event) => {
    const horizontal = orientation === "horizontal" || orientation === "both";
    const vertical = orientation === "vertical" || orientation === "both";
    const backward = event.key === "Home" || horizontal && event.key === "ArrowLeft" || vertical && event.key === "ArrowUp";
    const forward = event.key === "End" || horizontal && event.key === "ArrowRight" || vertical && event.key === "ArrowDown";
    if (!backward && !forward) return;
    const controls = typeof group.querySelectorAll === "function" ? Array.from(group.querySelectorAll("button")).filter(
      (control) => !control.disabled && control.getAttribute("aria-hidden") !== "true"
    ) : [];
    if (!controls.length) return;
    const current = controls.indexOf(event.target);
    if (current < 0) return;
    event.preventDefault();
    let target = current;
    if (event.key === "Home") target = 0;
    else if (event.key === "End") target = controls.length - 1;
    else target = (current + (forward ? 1 : -1) + controls.length) % controls.length;
    controls[target]?.focus();
  });
}

// src/security/safe-url.ts
function safeWebUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return SAFE_URL_PROTOCOLS.includes(url.protocol) ? url : null;
  } catch (_) {
    return null;
  }
}

// src/components.ts
function icon(el, name) {
  el.setAttrs({
    "aria-hidden": "true",
    focusable: "false"
  });
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
function pageHeader(parent, kicker, title, description = "", headingId = "") {
  const header = parent.createDiv({ cls: "los-page-header" });
  if (kicker) header.createDiv({ cls: "los-kicker", text: kicker });
  const heading = header.createEl("h1", { text: title });
  if (headingId) heading.setAttribute("id", headingId);
  if (description) header.createEl("p", { text: description });
  return header;
}
function section(parent, title, description = "") {
  const wrap = parent.createDiv({ cls: "los-section" });
  wrap.createEl("h2", { text: title });
  if (description) wrap.createEl("p", { cls: "los-muted", text: description });
  return wrap;
}
function filterTabs(parent, ariaLabel, tabs, active, choose, countOf = null) {
  const row = parent.createDiv({ cls: "los-filter-tabs" });
  row.setAttrs({ role: "group", "aria-label": ariaLabel });
  enableButtonGroupKeyboardNavigation(row);
  for (const [value, label] of tabs) {
    const count = countOf ? countOf(value) : 0;
    const control = button(
      row,
      count ? `${label} ${count}` : label,
      () => choose(value),
      "quiet"
    );
    control.addClass("los-filter-tab");
    control.toggleClass("is-active", value === active);
    control.setAttrs({ "aria-pressed": String(value === active) });
  }
  return row;
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
  const first = paragraph.replace(/\*{1,2}/g, "").replace(/`/g, "").replace(/(^|\n)\s*-\s*/g, "$1").replace(/\s+/g, " ").trim();
  if (first.length <= limit) return first;
  return `${Array.from(first).slice(0, limit - 1).join("")}\u2026`;
}
function boundaryPolicy(value) {
  const text = projectedExcerpt(value, 300);
  return /(^|[\s([<'"])Job\//.test(text) ? "" : text;
}
function workspaceCard(parent, plugin, workspace, moduleContext = null) {
  const workspaceTitle = asLabel(workspace);
  const workspaceStatus = asString(workspace.status) || "active";
  const card = parent.createDiv({ cls: `los-card los-workspace-card los-s-${workspaceStatus}` });
  const top = card.createDiv({ cls: "los-card-top" });
  top.createEl("h3", { text: workspaceTitle });
  badge(top, workspace.standing ? `${workspaceStatus} \xB7 standing` : workspaceStatus, workspaceStatus);
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
  const unitId = asString(unit.id);
  const unitTitle = asLabel(unit);
  const unitStatus = asString(unit.status) || "ready";
  const card = parent.createEl("button", {
    cls: `los-card los-unit-card los-s-${unitStatus} is-clickable`,
    attr: { type: "button", "aria-label": `Open unit: ${unitTitle}` }
  });
  const top = card.createDiv({ cls: "los-card-top" });
  top.createEl("h3", { text: unitTitle });
  badge(top, unitStatus, unitStatus);
  card.createEl("p", { text: asString(unit.scope) || "No scope projected." });
  const map = unitId ? plugin.store.mapForUnit(unitId) : null;
  if (map) {
    const stages = asRecords(map.stages);
    const done = stages.filter(
      (row) => row.status === "complete"
    ).length;
    card.createDiv({ cls: "los-progress-copy", text: `${done} of ${stages.length} stages complete` });
  } else {
    card.createDiv({ cls: "los-progress-copy", text: "No study map yet" });
  }
  if (unitId) card.addEventListener("click", () => plugin.openUnit(unitId));
  return card;
}
var OWNERSHIP_STATEMENT = "Presentation only \xB7 facts live in the LearningOS core \xB7 buttons are conveniences, never duties.";

// src/accessibility/modal.ts
var FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",");
function makeModalAccessible(content, options) {
  const document2 = content.ownerDocument ?? globalThis.document;
  const previousFocus = document2?.activeElement;
  const host = typeof content.closest === "function" ? content.closest(".modal") : null;
  const dialog = host ?? content;
  const focusRoot = dialog;
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", options.labelledBy);
  dialog.setAttribute("tabindex", "-1");
  host?.classList.add(options.hostClass);
  const workspaces = document2 && typeof document2.querySelectorAll === "function" ? Array.from(
    document2.querySelectorAll(".workspace")
  ) : [];
  const backgrounds = workspaces.filter(
    (element) => typeof element.contains !== "function" || !element.contains(dialog)
  ).map((element) => ({
    element,
    ariaHidden: element.getAttribute("aria-hidden"),
    inert: element.inert
  }));
  for (const background of backgrounds) {
    background.element.inert = true;
    background.element.setAttribute("aria-hidden", "true");
  }
  let cancelInitialFocus = null;
  if (options.initialFocus) {
    const view = document2?.defaultView ?? globalThis.window;
    const focus = () => options.initialFocus?.()?.focus?.();
    if (typeof view?.requestAnimationFrame === "function") {
      const frame = view.requestAnimationFrame(focus);
      cancelInitialFocus = () => view.cancelAnimationFrame?.(frame);
    } else {
      const timer = view.setTimeout(focus, 0);
      cancelInitialFocus = () => view.clearTimeout(timer);
    }
  }
  const focusable = () => {
    if (typeof focusRoot.querySelectorAll !== "function") {
      return [];
    }
    return Array.from(
      focusRoot.querySelectorAll(FOCUSABLE)
    ).filter(
      (element) => element.getAttribute("aria-hidden") !== "true" && !element.disabled
    );
  };
  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      options.close();
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    const controls = focusable();
    if (!controls.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = controls[0];
    const last = controls.at(-1);
    const active = document2?.activeElement;
    if (event.shiftKey && (active === first || !focusRoot.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !focusRoot.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  };
  focusRoot.addEventListener("keydown", onKeyDown);
  let cleaned = false;
  return () => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    cancelInitialFocus?.();
    cancelInitialFocus = null;
    focusRoot.removeEventListener?.("keydown", onKeyDown);
    host?.classList.remove(options.hostClass);
    for (const background of backgrounds) {
      background.element.inert = background.inert;
      if (background.ariaHidden === null) {
        background.element.removeAttribute("aria-hidden");
      } else {
        background.element.setAttribute(
          "aria-hidden",
          background.ariaHidden
        );
      }
    }
    previousFocus?.focus?.();
  };
}

// src/app/global-search.ts
var GlobalSearchModal = class extends import_obsidian2.Modal {
  plugin;
  query;
  filter;
  input;
  tabButtons = [];
  results;
  restoreAccessibility = null;
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
    copy.createEl("h2", {
      text: "Find a module, unit, source, or project",
      attr: { id: "los-global-search-heading" }
    });
    this.restoreAccessibility = makeModalAccessible(root, {
      close: () => this.close(),
      hostClass: "los-modal--global-search",
      initialFocus: () => this.input ?? null,
      labelledBy: "los-global-search-heading"
    });
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
    const tabs = root.createDiv({ cls: "los-search-tabs", attr: { role: "group", "aria-label": "Search result type" } });
    enableButtonGroupKeyboardNavigation(tabs);
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
      tab.setAttrs({ "data-filter": id, "aria-pressed": String(this.filter === id) });
      this.tabButtons.push(tab);
    }
    this.results = root.createDiv({ cls: "los-search-results", attr: { "aria-live": "polite" } });
    this.renderTabs();
    this.renderResults();
  }
  onClose() {
    this.plugin.router.clearOverlay();
    this.restoreAccessibility?.();
    this.restoreAccessibility = null;
    this.contentEl.empty();
  }
  renderTabs() {
    for (const tab of this.tabButtons || []) {
      const active = tab.getAttribute("data-filter") === this.filter;
      tab.toggleClass("is-active", active);
      tab.setAttribute("aria-pressed", String(active));
    }
  }
  candidates() {
    const rows = [];
    const add = (record, kind, subtitle, open) => {
      if (!record?.id || !record?.title) return;
      rows.push({
        id: record.id,
        title: record.title,
        aliases: [...record.aliases || []],
        authors: [...record.authors || []],
        kind,
        subtitle,
        open
      });
    };
    for (const module2 of this.plugin.store.modules()) {
      if (!module2.id) continue;
      const area = module2.area_id ? this.plugin.store.get(module2.area_id)?.title || module2.code || "Module" : module2.code || "Module";
      add(module2, "learning", `Module \xB7 ${area}`, () => this.plugin.openModule(module2.id));
    }
    for (const project of this.plugin.store.projects()) {
      if (!project.id) continue;
      add(
        project,
        "projects",
        `Project \xB7 ${project.project_type || project.status || "active"}`,
        () => this.plugin.openProject(project.id)
      );
    }
    for (const unit of this.plugin.store.units()) {
      if (!unit.id || !unit.module_id) continue;
      const module2 = this.plugin.store.get(unit.module_id);
      add(unit, "learning", `Unit \xB7 ${module2?.title || unit.module_id}`, () => this.plugin.openUnit(unit.id));
    }
    for (const source of this.plugin.store.sources()) {
      if (!source.id) continue;
      const byline = (source.authors || []).join(", ") || source.organization || source.kind || "Learning source";
      add(source, "sources", `Learning source \xB7 ${byline}`, () => this.plugin.openLibrary(source.id, "source"));
    }
    for (const pack of this.plugin.store.topicPacks()) {
      if (!pack.id) continue;
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
      if (!linkedProject.id) continue;
      add(workspace, "projects", `Project workspace \xB7 ${linkedProject.title || linkedProject.id}`, () => this.plugin.openProject(linkedProject.id));
    }
    return rows;
  }
  matches(candidate) {
    const words2 = this.query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!words2.length) return true;
    const haystack = [
      candidate.id,
      candidate.title,
      candidate.subtitle,
      ...candidate.aliases,
      ...candidate.authors
    ].filter(Boolean).join(" ").toLocaleLowerCase();
    return words2.every(
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

// src/settings.ts
var import_obsidian3 = require("obsidian");

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

// src/settings.ts
function errorMessage2(error) {
  return error instanceof Error ? error.message : String(error);
}
var LearningOSSettingsTab = class extends import_obsidian3.PluginSettingTab {
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
      new import_obsidian3.Setting(root).setName(name).setDesc(description).addToggle(
        (toggle) => toggle.setValue(this.plugin.settings[key]).onChange(
          async (value) => {
            this.plugin.settings[key] = value;
            await this.plugin.saveData(this.plugin.settings);
          }
        )
      );
    }
    new import_obsidian3.Setting(root).setName("Python interpreter").setDesc("Leave blank to auto-detect: the project virtual environment, then the system Python.").addText((text) => text.setValue(this.plugin.settings.pythonPath || "").onChange(async (value) => {
      this.plugin.settings.pythonPath = value.trim();
      await this.plugin.saveData(this.plugin.settings);
    }));
    new import_obsidian3.Setting(root).setName("Validate and rebuild").setDesc("Run the canonical core projection pipeline.").addButton(
      (control) => control.setButtonText("Rebuild").setCta().onClick(() => this.plugin.generate())
    );
    new import_obsidian3.Setting(root).setName("Diagnostics").setDesc("Contract versions, projection freshness, interpreter.").addButton(
      (control) => control.setButtonText("Open").onClick(() => this.plugin.openDiagnostics())
    );
    root.createEl("h3", { text: "About LearningOS" });
    root.createEl("p", { cls: "los-muted", text: OWNERSHIP_STATEMENT });
  }
};
var SessionEndModal = class extends import_obsidian3.Modal {
  plugin;
  review;
  restoreAccessibility = null;
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
      "Only files recorded by guarded learning actions can be staged. Unrelated changes remain untouched.",
      "los-session-end-heading"
    );
    this.restoreAccessibility = makeModalAccessible(root, {
      close: () => this.close(),
      hostClass: "los-modal--session-end",
      labelledBy: "los-session-end-heading"
    });
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
        new import_obsidian3.Notice("Enter a commit message first.");
        return;
      }
      try {
        const result = asSessionReview(
          await this.plugin.gateway.endSession(message.value.trim(), Boolean(push.checked))
        );
        new import_obsidian3.Notice(result.pushed ? "Learning session committed and pushed." : "Learning session committed.");
        this.close();
      } catch (error) {
        new import_obsidian3.Notice(errorMessage2(error));
      }
    }, "cta");
    button(actions, "Close without committing", () => this.close(), "quiet");
    message.focus();
  }
  onClose() {
    this.restoreAccessibility?.();
    this.restoreAccessibility = null;
    this.contentEl.empty();
  }
};

// src/views/atlas-view.ts
var import_obsidian4 = require("obsidian");

// src/features/atlas/model.ts
var ATLAS_ROLE_ORDER = [
  "crosswalk",
  "reference",
  "synthesis",
  "exercise-bank",
  "mock-exam"
];
function humanLabel(value) {
  const text = String(value || "cross-domain").replace(/^thematic-group-/, "").replace(/[-_]+/g, " ").trim();
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "Cross-domain";
}
function canonicalLabel(value) {
  return String(value || "").replace(/^thematic-group-/, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
function uniqueRecords(records) {
  const seen = /* @__PURE__ */ new Set();
  return records.filter(
    (record) => {
      const key = asString(record.id) || `${record.type || "record"}:${asLabel(record)}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    }
  );
}
function recordIds(records) {
  return new Set(
    records.map(
      (record) => asString(record.id)
    ).filter(
      (id) => Boolean(id)
    )
  );
}
function intersectionSize(left, right) {
  let count = 0;
  for (const value of left) {
    if (right.has(value)) {
      count += 1;
    }
  }
  return count;
}
function roleLabel(role) {
  return humanLabel(role);
}
function buildAtlasDomains(store) {
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
      shelves: [],
      modules: [],
      concepts: [],
      sources: []
    };
    domains.set(
      key,
      created
    );
    return created;
  };
  for (const note2 of store.of("note")) {
    bucket(note2.domain).notes.push(note2);
  }
  const shelves = uniqueRecords([
    ...store.of("collection"),
    ...store.topicPacks()
  ]);
  for (const shelf of shelves) {
    bucket(shelf.domain).shelves.push(shelf);
  }
  for (const domain of domains.values()) {
    const sourceIds = /* @__PURE__ */ new Set();
    const conceptIds = /* @__PURE__ */ new Set();
    const groupIds = /* @__PURE__ */ new Set();
    for (const note2 of domain.notes) {
      asStrings(note2.sources).forEach(
        (id) => sourceIds.add(id)
      );
      asStrings(note2.concepts).forEach(
        (id) => conceptIds.add(id)
      );
    }
    for (const shelf of domain.shelves) {
      asStrings(shelf.sources).forEach(
        (id) => sourceIds.add(id)
      );
      asStrings(shelf.thematic_group_ids).forEach(
        (id) => groupIds.add(id)
      );
      for (const entry of asRecords(shelf.entries)) {
        const sourceId = asString(entry.source);
        if (sourceId) {
          sourceIds.add(sourceId);
        }
      }
    }
    for (const group of store.thematicGroups()) {
      if (canonicalLabel(group.id) === canonicalLabel(domain.name) || canonicalLabel(group.title) === canonicalLabel(domain.name)) {
        const groupId = asString(group.id);
        if (groupId) {
          groupIds.add(groupId);
        }
      }
    }
    for (const source of store.sources()) {
      const sourceId = asString(source.id);
      const sourceGroups = asStrings(
        source.thematic_group_ids
      );
      if (sourceGroups.some(
        (id) => groupIds.has(id)
      ) && sourceId) {
        sourceIds.add(sourceId);
      }
    }
    const resolvedSources = [...sourceIds].map(
      (id) => store.get(id)
    ).filter(
      (record) => record?.type === "source"
    );
    domain.sources.push(
      ...uniqueRecords(resolvedSources)
    );
    const resolvedConcepts = [...conceptIds].map(
      (id) => store.get(id)
    ).filter(
      (record) => record?.type === "concept"
    );
    domain.concepts.push(
      ...uniqueRecords(resolvedConcepts)
    );
    const relatedModules = [
      ...domain.sources.flatMap(
        (source) => {
          const sourceId = asString(source.id);
          return sourceId ? store.useModules(sourceId) : [];
        }
      ),
      ...store.modules().filter(
        (module2) => asStrings(
          module2.thematic_group_ids
        ).some(
          (id) => groupIds.has(id)
        )
      )
    ];
    domain.modules.push(
      ...uniqueRecords(relatedModules)
    );
  }
  return [...domains.values()].sort(
    (left, right) => right.notes.length - left.notes.length || left.name.localeCompare(
      right.name
    )
  );
}

// src/views/atlas-view.ts
function projectedMetadata(values) {
  return values.filter(
    (value) => typeof value === "string" || typeof value === "number"
  ).map(String).filter(Boolean).join(" \xB7 ");
}
function plural(count, noun, pluralNoun = `${noun}s`) {
  return `${count} ${count === 1 ? noun : pluralNoun}`;
}
var AtlasView = class extends import_obsidian4.ItemView {
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
    return buildAtlasDomains(
      this.plugin.store
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
      "See where your learning lives, what connects across subjects, and which source or module to open next."
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
    glance.setAttrs({
      role: "group",
      "aria-label": "Choose a knowledge domain"
    });
    enableButtonGroupKeyboardNavigation(glance, "both");
    for (const domain of domains) {
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
        text: humanLabel(domain.name)
      });
      const summaryParts = [
        domain.modules.length ? plural(domain.modules.length, "module") : "",
        domain.concepts.length ? plural(domain.concepts.length, "concept") : "",
        domain.sources.length ? plural(domain.sources.length, "source") : "",
        !domain.modules.length && !domain.concepts.length && !domain.sources.length ? plural(domain.shelves.length, "shelf", "shelves") : ""
      ].filter((part) => Boolean(part));
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
    this.renderDomain(body, current, domains);
    this.renderBoundaries(body);
  }
  noteRow(parent, note2) {
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
      text: asLabel(note2)
    });
    const metadata = projectedMetadata([
      note2.role ? roleLabel(String(note2.role)) : "",
      note2.state ? humanLabel(note2.state) : ""
    ]);
    if (metadata) {
      copy.createSpan({
        cls: "los-micro",
        text: metadata
      });
    }
    const summary = asString(note2.summary);
    if (summary) {
      copy.createSpan({
        cls: "los-atlas-note-summary",
        text: projectedExcerpt(summary, 150)
      });
    }
    const path = asString(note2.path);
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
  renderCoveragePanel(parent, title, iconName, records, kind) {
    const panel = parent.createDiv({ cls: "los-atlas-map-panel" });
    const heading = panel.createDiv({ cls: "los-atlas-map-panel-head" });
    icon(heading.createSpan(), iconName);
    heading.createEl("h3", { text: title });
    heading.createSpan({ cls: "los-atlas-count", text: String(records.length) });
    if (!records.length) {
      panel.createDiv({
        cls: "los-atlas-panel-empty",
        text: kind === "concept" ? "No named concepts are linked yet." : `No ${kind}s are linked yet.`
      });
      return;
    }
    const rows = records.slice().sort((left, right) => asLabel(left).localeCompare(asLabel(right))).slice(0, 5);
    for (const record of rows) {
      if (kind === "concept") {
        const concept = panel.createDiv({ cls: "los-atlas-concept" });
        icon(concept.createSpan(), ICONS.concept);
        concept.createSpan({ text: asLabel(record) });
        continue;
      }
      const recordId = asString(record.id);
      const row = panel.createEl("button", {
        cls: "los-atlas-map-link is-clickable",
        attr: { type: "button" }
      });
      icon(row.createSpan(), kind === "module" ? ICONS.module : ICONS.source);
      const copy = row.createSpan({ cls: "los-item-copy" });
      copy.createSpan({ text: asLabel(record) });
      const context = kind === "module" ? projectedMetadata([record.code, record.kind ? humanLabel(record.kind) : ""]) : humanLabel(record.source_type || "source");
      if (context) copy.createSpan({ cls: "los-micro", text: context });
      row.addEventListener("click", () => {
        if (!recordId) return;
        if (kind === "module") void this.plugin.openModule(recordId);
        else void this.plugin.openSourceDetail(recordId);
      });
    }
    if (records.length > rows.length) {
      panel.createDiv({
        cls: "los-atlas-more",
        text: `+${records.length - rows.length} more`
      });
    }
  }
  renderConnections(parent, domain, domains) {
    const crosswalks = domain.notes.filter(
      (note2) => note2.role === "crosswalk"
    );
    const currentSourceIds = recordIds(domain.sources);
    const currentConceptIds = recordIds(domain.concepts);
    const currentModuleIds = recordIds(domain.modules);
    const peers = domains.filter((candidate) => candidate.name !== domain.name).map((candidate) => {
      const sources = intersectionSize(currentSourceIds, recordIds(candidate.sources));
      const concepts = intersectionSize(currentConceptIds, recordIds(candidate.concepts));
      const modules = intersectionSize(currentModuleIds, recordIds(candidate.modules));
      return { candidate, sources, concepts, modules, score: sources + concepts + modules };
    }).filter((peer) => peer.score > 0).sort((left, right) => right.score - left.score || left.candidate.name.localeCompare(right.candidate.name));
    if (!crosswalks.length && !peers.length) return;
    const wrap = section(
      parent,
      "Connections",
      "Use a narrative bridge or jump to a neighbouring domain that shares learning material."
    );
    const grid = wrap.createDiv({ cls: "los-atlas-connection-grid" });
    if (crosswalks.length) {
      const card = grid.createDiv({ cls: "los-atlas-connection-card" });
      card.createEl("h3", { text: "Narrative bridges" });
      card.createDiv({
        cls: "los-muted",
        text: "These notes explain how the pieces fit together."
      });
      for (const note2 of crosswalks) this.noteRow(card, note2);
    }
    if (peers.length) {
      const card = grid.createDiv({ cls: "los-atlas-connection-card" });
      card.createEl("h3", { text: "Connected domains" });
      card.createDiv({
        cls: "los-muted",
        text: "Shared sources, concepts, or modules create these links."
      });
      for (const peer of peers.slice(0, 6)) {
        const row = card.createEl("button", {
          cls: "los-atlas-domain-link is-clickable",
          attr: { type: "button" }
        });
        const copy = row.createSpan({ cls: "los-item-copy" });
        copy.createSpan({ text: humanLabel(peer.candidate.name) });
        const shared = [
          peer.modules ? plural(peer.modules, "module") : "",
          peer.concepts ? plural(peer.concepts, "concept") : "",
          peer.sources ? plural(peer.sources, "source") : ""
        ].filter(Boolean).join(" \xB7 ");
        copy.createSpan({ cls: "los-micro", text: `Shared: ${shared}` });
        row.createSpan({ cls: "los-atlas-arrow", text: "\u2192" });
        row.addEventListener("click", () => {
          this.domain = peer.candidate.name;
          this.render();
        });
      }
    }
  }
  renderShelves(parent, domain) {
    const wrap = section(
      parent,
      `Curated shelves (${domain.shelves.length})`,
      "Purpose-built reading routes, kept ahead of the full note inventory."
    );
    if (!domain.shelves.length) {
      empty(
        wrap,
        "No curated shelf yet",
        "Sources are mapped above, but this domain does not have a reading route yet."
      );
      return;
    }
    const grid = wrap.createDiv({ cls: "los-atlas-shelf-grid" });
    const shelves = domain.shelves.slice().sort((left, right) => asLabel(left).localeCompare(asLabel(right)));
    for (const shelf of shelves) {
      const card = grid.createDiv({ cls: "los-shelf-entry" });
      const head = card.createEl("button", {
        cls: "los-shelf-entry-title is-clickable",
        attr: { type: "button" }
      });
      icon(head.createSpan(), shelf.type === "topic-pack" ? ICONS["topic-pack"] : ICONS.collection);
      const copy = head.createSpan({ cls: "los-item-copy" });
      copy.createSpan({ text: asLabel(shelf) });
      copy.createSpan({
        cls: "los-micro",
        text: plural(asListLength(shelf.entries), "source")
      });
      const shelfId = asString(shelf.id);
      head.addEventListener("click", () => {
        if (shelfId) void this.plugin.openLibrary(shelfId, String(shelf.type || "collection"));
      });
      const summary = asString(shelf.summary) || asString(shelf.purpose);
      if (summary) {
        card.createDiv({
          cls: "los-shelf-why",
          text: projectedExcerpt(summary, 220)
        });
      }
    }
  }
  renderNoteInventory(parent, domain) {
    const notes = domain.notes.filter((note2) => note2.role !== "crosswalk");
    if (!notes.length) return;
    const wrap = section(
      parent,
      "Reference notes",
      "The complete inventory stays available without taking over the map."
    );
    const inventory = wrap.createEl("details", { cls: "los-atlas-inventory" });
    inventory.createEl("summary", { text: `Open all ${plural(notes.length, "note")}` });
    const body = inventory.createDiv({ cls: "los-atlas-inventory-body" });
    const byRole = /* @__PURE__ */ new Map();
    for (const note2 of notes) {
      const role = String(note2.role || "synthesis");
      const rows = byRole.get(role) ?? [];
      rows.push(note2);
      byRole.set(role, rows);
    }
    const roles = [...byRole.keys()].sort((left, right) => {
      const rank = (role) => ATLAS_ROLE_ORDER.indexOf(role) + 1 || 99;
      return rank(left) - rank(right) || left.localeCompare(right);
    });
    for (const role of roles) {
      const rows = (byRole.get(role) ?? []).slice().sort((left, right) => asLabel(left).localeCompare(asLabel(right)));
      const group = body.createEl("details", { cls: "los-atlas-group" });
      group.createEl("summary", { text: `${roleLabel(role)} (${rows.length})` });
      for (const note2 of rows) this.noteRow(group, note2);
    }
  }
  renderDomain(parent, domain, domains) {
    if (!domain) return;
    const header = parent.createDiv({ cls: "los-atlas-domain-head" });
    const copy = header.createDiv({ cls: "los-atlas-domain-copy" });
    copy.createEl("h2", { text: `${humanLabel(domain.name)} map` });
    copy.createEl("p", {
      text: [
        plural(domain.modules.length, "module"),
        plural(domain.concepts.length, "concept"),
        plural(domain.sources.length, "source"),
        plural(domain.shelves.length, "curated shelf", "curated shelves")
      ].join(" \xB7 ")
    });
    const actions = header.createDiv({ cls: "los-actions" });
    button(
      actions,
      "Browse domain in Library",
      () => this.plugin.openLibraryFiltered("note", domain.name),
      "quiet"
    );
    const coverage = parent.createDiv({ cls: "los-atlas-map-grid" });
    this.renderCoveragePanel(coverage, "Modules", ICONS.module, domain.modules, "module");
    this.renderCoveragePanel(coverage, "Concepts", ICONS.concept, domain.concepts, "concept");
    this.renderCoveragePanel(coverage, "Sources", ICONS.source, domain.sources, "source");
    this.renderConnections(parent, domain, domains);
    this.renderShelves(parent, domain);
    this.renderNoteInventory(parent, domain);
  }
  renderBoundaries(root) {
    const boundaries = this.plugin.store.rows(
      "quarantine_boundaries"
    );
    const details = root.createEl("details", {
      cls: "los-atlas-boundaries"
    });
    details.createEl("summary", {
      text: `Policy boundaries (${boundaries.length})`
    });
    const wrap = details.createDiv({ cls: "los-atlas-boundaries-body" });
    wrap.createEl("p", {
      cls: "los-muted",
      text: "Named only so their absence is visible. Their content is not part of the Atlas."
    });
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
        text: asLabel(boundary)
      });
      const description = asString(
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
      "Open generated map file",
      () => this.plugin.openVaultPath(
        "generated/domain-atlas.md"
      ),
      "quiet"
    );
  }
};

// src/views/boundary-view.ts
var import_obsidian7 = require("obsidian");

// src/features/job/cards.ts
function cardTop(card, title, sub = "") {
  const top = card.createDiv({ cls: "los-card-top" });
  const copy = top.createDiv({ cls: "los-card-copy" });
  copy.createEl("h3", { text: title });
  if (sub) copy.createDiv({ cls: "los-micro", text: sub });
  return top;
}
function factList(parent, facts) {
  const present = facts.filter(([, value]) => value);
  if (!present.length) return;
  const list = parent.createDiv({ cls: "los-fact-list" });
  for (const [label, value] of present) {
    const row = list.createDiv({ cls: "los-fact-row" });
    row.createDiv({ cls: "los-fact-label", text: label });
    row.createDiv({ cls: "los-fact-value", text: value });
  }
}
function noteCard(parent, host, note2) {
  const card = parent.createDiv({ cls: "los-card" });
  const top = cardTop(card, note2.title, note2.component);
  badge(top, note2.freshness, note2.freshness);
  if (note2.summary) card.createEl("p", { text: note2.summary });
  const actions = card.createDiv({ cls: "los-actions" });
  if (note2.verified_against) {
    actions.createSpan({ cls: "los-micro", text: `Verified ${note2.verified_against}` });
  }
  if (host.editNote) button(actions, "Edit note", () => host.editNote?.(note2), "quiet");
  button(actions, "Open note", () => host.openJobPath(note2.path), "quiet");
  return card;
}
function materialCard(parent, kicker, title, sub = "") {
  const card = parent.createDiv({ cls: "los-card" });
  card.createDiv({ cls: "los-kicker", text: kicker });
  return { card, top: cardTop(card, title, sub) };
}

// src/features/job/library.ts
var HORIZONS = ["now", "next", "later"];
var HORIZON_LABEL = {
  now: "Use now",
  next: "Use next",
  later: "Keep for later"
};
function entriesFor(horizon2, host, dashboard) {
  const tracks = dashboard.learning_tracks.filter((item) => item.horizon === horizon2).map((track2) => ({
    kicker: "Track",
    title: track2.title,
    sub: track2.cadence,
    note: [
      `${track2.completedSessions.length}/${track2.stages.length}`,
      track2.status
    ],
    body: track2.outcome,
    action: [
      "Open plan",
      host.openJobPlan ? () => host.openJobPlan?.(track2.id) : null
    ]
  }));
  const papers = dashboard.papers.filter((item) => item.horizon === horizon2).map((paper2) => ({
    kicker: "Paper",
    title: paper2.title,
    sub: paper2.authors.join(", "),
    note: (() => {
      const meta = [paper2.year, paper2.pages ? `${paper2.pages} pages` : ""].filter(Boolean).join(" \xB7 ");
      return meta ? [meta, horizon2] : null;
    })(),
    body: paper2.angle,
    action: paper2.available ? ["Open PDF", () => host.openJobPath(paper2.path)] : ["PDF unavailable", null]
  }));
  const books = dashboard.canonical_shelf.filter((item) => item.horizon === horizon2).map((source) => ({
    kicker: "Book",
    title: source.title,
    sub: source.authors.join(", "),
    note: null,
    body: source.why,
    action: ["Open in Library", () => host.openSourceDetail(source.source_id)]
  }));
  return [...tracks, ...papers, ...books];
}
function renderLibrary(root, host, dashboard) {
  const library = section(root, "Library", "Ordered by when you need it.");
  for (const horizon2 of HORIZONS) {
    const entries = entriesFor(horizon2, host, dashboard);
    if (!entries.length) continue;
    const group = library.createDiv({ cls: "los-job-horizon" });
    const head = group.createDiv({ cls: "los-card-top" });
    head.createEl("h3", { text: HORIZON_LABEL[horizon2] });
    badge(head, String(entries.length), horizon2);
    for (const entry of entries) {
      const { card, top } = materialCard(group, entry.kicker, entry.title, entry.sub);
      if (entry.note) badge(top, entry.note[0], entry.note[1]);
      if (entry.body) card.createEl("p", { text: entry.body });
      const [label, onClick] = entry.action;
      button(card.createDiv({ cls: "los-actions" }), label, onClick, "quiet");
    }
  }
}

// src/features/job/now.ts
function nextStage(dashboard) {
  for (const track2 of dashboard.learning_tracks) {
    const stage = track2.stages.find((item) => !item.done);
    if (stage) return { track: track2, stage };
  }
  return null;
}
function renderScope(root, host, dashboard) {
  const { workspace } = dashboard;
  const required = workspace.current_scope.find((item) => item.label === "required-now");
  const scope = section(root, "Required now");
  scope.createEl("p", {
    text: required ? required.text : workspace.next_action || "No required-now scope is recorded."
  });
  button(scope, "Open workspace context", () => host.openJobPath(workspace.path), "quiet");
}
function renderNextStage(root, host, dashboard) {
  const upcoming = nextStage(dashboard);
  if (!upcoming) return;
  const { track: track2, stage } = upcoming;
  const wrap = section(root, "Next stage");
  const card = wrap.createDiv({ cls: "los-card" });
  const top = cardTop(
    card,
    stage.title,
    `${track2.title} \xB7 stage ${String(stage.number).padStart(2, "0")}`
  );
  badge(top, `${track2.completedSessions.length}/${track2.stages.length} done`, track2.status);
  if (stage.objective) card.createEl("p", { text: stage.objective });
  factList(card, [
    ["Learn from", stage.resources.slice(0, 3).map((item) => item.label).join(" \xB7 ")],
    ["Read-only anchor", stage.jobContext.readOnlyAnchor],
    ["Done when", stage.doneWhen[0] || "Stage evidence is recorded."]
  ]);
  const actions = card.createDiv({ cls: "los-actions" });
  if (host.logJobSession) {
    button(actions, "Log this stage", () => host.logJobSession?.(track2.id, stage.number), "cta");
  }
  if (host.setJobSessionState) {
    button(
      actions,
      "Mark done",
      () => host.setJobSessionState?.(track2.id, stage.number, "done", track2.revision),
      "quiet"
    );
  }
  if (host.openJobPlan) {
    button(
      actions,
      "Open this stage",
      () => host.openJobPlan?.(track2.id, stage.number),
      "quiet"
    );
  }
}
function renderTaskPreview(root, host, dashboard) {
  const tasks = dashboard.tasks.filter((task2) => task2.status === "open").sort((left, right) => ["now", "next", "later"].indexOf(left.horizon) - ["now", "next", "later"].indexOf(right.horizon)).slice(0, 4);
  const wrap = section(root, "To do", tasks.length ? `${tasks.length} next action${tasks.length === 1 ? "" : "s"}` : "Nothing is waiting on you.");
  const actions = wrap.createDiv({ cls: "los-job-section-actions" });
  if (host.editTask) button(actions, "Add task", () => host.editTask?.(), "quiet");
  for (const task2 of tasks) {
    const row = wrap.createDiv({ cls: "los-job-task-row los-job-task-row--compact" });
    const toggle = row.createEl("input", {
      attr: { type: "checkbox", "aria-label": `Complete ${task2.title}` }
    });
    toggle.addEventListener("change", () => host.setTaskState?.(task2, "done"));
    const copy = row.createDiv({ cls: "los-job-task-copy" });
    copy.createEl("strong", { text: task2.title });
    copy.createDiv({ cls: "los-micro", text: task2.horizon });
  }
}
function planRunwayRow(parent, host, plan) {
  const total = plan.stages.length;
  const completed = plan.completedSessions.length;
  const row = parent.createDiv({ cls: "los-job-runway-row" });
  const copy = row.createDiv({ cls: "los-job-runway-copy" });
  copy.createEl("strong", { text: plan.title });
  copy.createDiv({ cls: "los-micro", text: plan.outcome || plan.cadence });
  badge(row, `${completed}/${total}`, plan.horizon);
  const progress = row.createDiv({ cls: "los-job-plan-progress" });
  progress.setAttrs({
    role: "progressbar",
    "aria-valuemin": "0",
    "aria-valuemax": String(total),
    "aria-valuenow": String(completed),
    "aria-label": `${plan.title}: ${completed} of ${total} stages complete`
  });
  const fill = progress.createDiv({ cls: "los-job-plan-progress-fill" });
  fill.style.width = `${total ? Math.round(completed / total * 100) : 0}%`;
  if (host.openJobPlan) {
    const next = plan.stages.find((stage) => !stage.done) || plan.stages[0];
    button(
      row,
      "Open plan",
      () => host.openJobPlan?.(plan.id, next?.number),
      "tertiary"
    );
  }
}
function renderPlanRunway(root, host, dashboard) {
  if (!dashboard.learning_tracks.length) return;
  const wrap = section(
    root,
    "Plan runway",
    "Long-term plans stay visible without competing with the next stage."
  );
  const runway = wrap.createDiv({ cls: "los-job-runway" });
  for (const plan of dashboard.learning_tracks.slice(0, 3)) planRunwayRow(runway, host, plan);
}
function renderNotePreview(root, host, dashboard) {
  const wrap = section(root, "Learning notes");
  const actions = wrap.createDiv({ cls: "los-job-section-actions" });
  if (host.editNote) button(actions, "New note", () => host.editNote?.(), "quiet");
  const note2 = dashboard.notes.learning[0];
  if (note2) noteCard(wrap, host, note2);
  else wrap.createEl("p", { cls: "los-muted", text: "Capture the first note from a study session." });
}
function renderDrift(root, host, dashboard) {
  const drifted = dashboard.notes.stratum.filter((note2) => note2.freshness !== "current");
  if (!drifted.length) return;
  const queue = section(
    root,
    "Needs re-verifying",
    "These notes describe code that has changed since they were last verified."
  );
  const list = queue.createDiv({ cls: "los-job-notes" });
  for (const note2 of drifted) noteCard(list, host, note2);
}
function renderQuestions(root, dashboard) {
  const { open_questions: questions } = dashboard.workspace;
  if (!questions.length) return;
  const wrap = section(root, "Open questions");
  const list = wrap.createEl("ul", { cls: "los-job-questions" });
  for (const question of questions) list.createEl("li", { text: question });
}
function renderNow(root, host, dashboard) {
  const grid = root.createDiv({ cls: "los-job-today-grid" });
  const focus = grid.createDiv({ cls: "los-job-today-focus" });
  const side = grid.createDiv({ cls: "los-job-today-side" });
  renderNextStage(focus, host, dashboard);
  renderPlanRunway(focus, host, dashboard);
  renderTaskPreview(side, host, dashboard);
  renderNotePreview(side, host, dashboard);
  renderDrift(side, host, dashboard);
  renderScope(root, host, dashboard);
  renderQuestions(root, dashboard);
}

// src/features/job/system.ts
var HEALTH_ORDER = ["current", "drifting", "stale", "unverified"];
function renderHealth(parent, health) {
  const row = parent.createDiv({ cls: "los-job-health" });
  for (const status of HEALTH_ORDER) {
    const value = health[status] || 0;
    if (value) badge(row, `${value} ${status}`, status);
  }
}
function renderLayer(parent, host, layer2, byId) {
  const group = parent.createDiv({ cls: "los-job-layer" });
  const head = group.createDiv({ cls: "los-card-top" });
  const copy = head.createDiv({ cls: "los-card-copy" });
  copy.createEl("h3", { text: layer2.title });
  if (layer2.summary) copy.createDiv({ cls: "los-micro", text: layer2.summary });
  if (!layer2.noteIds.length) {
    group.createEl("p", { cls: "los-muted", text: "No note describes this layer yet." });
    return;
  }
  badge(head, `${layer2.noteIds.length} documented`, "current");
  const list = group.createDiv({ cls: "los-job-notes" });
  for (const id of layer2.noteIds) {
    const note2 = byId.get(id);
    if (note2) noteCard(list, host, note2);
  }
}
function renderSystem(root, host, dashboard) {
  const map = section(root, "Stratum pipeline");
  renderHealth(map, dashboard.notes.health);
  const byId = /* @__PURE__ */ new Map();
  for (const note2 of [...dashboard.notes.skrub, ...dashboard.notes.stratum]) {
    byId.set(note2.id, note2);
  }
  for (const layer2 of dashboard.notes.layers) renderLayer(map, host, layer2, byId);
}

// src/features/job/notes.ts
function renderNotes(root, host, dashboard) {
  const learning = section(
    root,
    "Learning notes",
    "Capture in your own words, update when your understanding changes, and keep source verification separate."
  );
  const actions = learning.createDiv({ cls: "los-job-section-actions" });
  if (host.editNote) button(actions, "New note", () => host.editNote?.(), "cta");
  if (!dashboard.notes.learning.length) {
    empty(learning, "No learning notes yet", "Create the first note from a study session.");
  } else {
    const list = learning.createDiv({ cls: "los-job-note-grid" });
    for (const note2 of dashboard.notes.learning) noteCard(list, host, note2);
  }
  renderSystem(root, host, dashboard);
}

// src/features/stage-resources.ts
var TRIAGE_ORDER = [
  "required-now",
  "helpful-now",
  "deferred",
  "reference-only"
];
var TRIAGE_HEADING = {
  "required-now": "Do this",
  "helpful-now": "If you get stuck",
  deferred: "Depth \u2014 not now",
  "reference-only": "Reference \u2014 preserved, not reading for this stage"
};
function rankOf(value) {
  const index = value ? TRIAGE_ORDER.indexOf(value) : -1;
  return index < 0 ? 0 : index;
}
function hasOpenTarget(record) {
  return [record.material_path, record.url, record.vault_path].some(
    (value) => typeof value === "string" && value.trim().length > 0
  );
}
function renderStageResources(parent, resourcesValue, renderer) {
  const resources = section(parent, "Exact work");
  if (!resourcesValue.length) {
    empty(
      resources,
      renderer.emptyTitle || "No source action selected",
      renderer.emptyDetail || "Add a focused source or practice action to this stage."
    );
    return resources;
  }
  const ordered = [...resourcesValue].sort(
    (left, right) => rankOf(left.scopeTriage) - rankOf(right.scopeTriage)
  );
  const anyRanked = ordered.some((item) => Boolean(item.scopeTriage));
  let renderedHeading = null;
  for (const resource of ordered) {
    if (anyRanked) {
      const heading = resource.scopeTriage ? TRIAGE_HEADING[resource.scopeTriage] || resource.scopeTriage : TRIAGE_HEADING["required-now"] || "Do this";
      if (heading !== renderedHeading) {
        resources.createDiv({ cls: "los-kicker los-resource-tier", text: heading });
        renderedHeading = heading;
      }
    }
    const row = resources.createDiv({
      cls: `los-resource-row los-triage-${resource.scopeTriage || "unranked"}`
    });
    const iconName = resource.kind === "watch" ? "play" : resource.kind === "practise" ? "pencil-line" : "book-open";
    icon(row.createSpan(), iconName);
    const copy = row.createDiv({ cls: "los-resource-copy" });
    copy.createEl("strong", { text: resource.label });
    if (resource.locator) copy.createDiv({ cls: "los-micro", text: resource.locator });
    const source = resource.sourceId && renderer.sourceRecord ? renderer.sourceRecord(resource.sourceId) : null;
    if (source) chip(copy, source, renderer.openSource);
    const actions = row.createDiv({ cls: "los-actions los-resource-actions" });
    if (resource.canOpen && renderer.openResource) {
      button(actions, "Open", () => renderer.openResource?.(resource), "quiet");
    } else if (source && hasOpenTarget(source) && renderer.openSourceResource) {
      button(
        actions,
        "Open source",
        () => renderer.openSourceResource?.(source),
        "quiet"
      );
    }
    if (resource.sourceId && renderer.rateResource) {
      const sourceId = resource.sourceId;
      const resourceId = resource.id;
      const rate = (verdict) => renderer.rateResource?.(
        sourceId,
        resourceId,
        verdict
      );
      overflowMenu(actions, [
        ["Helpful", () => rate("helpful")],
        ["Too advanced", () => rate("too-advanced")],
        ["Useful for review", () => rate("useful-for-review")]
      ], resourceId ? `Rate ${resource.label}` : `Rate ${resource.label} (whole source)`);
    }
  }
  return resources;
}

// src/features/job/plans.ts
function planProgress(parent, plan) {
  const total = plan.stages.length;
  const completed = plan.completedSessions.length;
  const progress = parent.createDiv({ cls: "los-job-plan-progress" });
  progress.setAttrs({
    role: "progressbar",
    "aria-valuemin": "0",
    "aria-valuemax": String(total),
    "aria-valuenow": String(completed),
    "aria-label": `${plan.title}: ${completed} of ${total} stages complete`
  });
  const fill = progress.createDiv({ cls: "los-job-plan-progress-fill" });
  fill.style.width = `${total ? Math.round(completed / total * 100) : 0}%`;
}
function planCard(parent, host, plan) {
  const total = plan.stages.length;
  const completed = plan.completedSessions.length;
  const card = parent.createDiv({ cls: "los-card los-job-plan-card" });
  const top = cardTop(card, plan.title, `${total} stage${total === 1 ? "" : "s"}`);
  badge(top, plan.horizon, plan.horizon);
  if (plan.outcome) card.createEl("p", { text: plan.outcome });
  planProgress(card, plan);
  card.createDiv({ cls: "los-micro", text: `${completed} of ${total} stages complete` });
  const next = plan.stages.find((stage) => !stage.done) || plan.stages[0];
  if (next) {
    const preview = card.createDiv({ cls: "los-job-plan-next" });
    preview.createDiv({ cls: "los-kicker", text: next.done ? "Review" : "Next stage" });
    preview.createEl("strong", {
      text: `${String(next.number).padStart(2, "0")} \xB7 ${next.title}`
    });
  }
  const actions = card.createDiv({ cls: "los-actions" });
  if (host.openJobPlan) {
    button(actions, "Open plan", () => host.openJobPlan?.(plan.id, next?.number), "cta");
  }
  if (host.editPlan) {
    button(
      actions,
      plan.sourceKind === "structured" ? "Edit plan" : "Make editable",
      () => host.editPlan?.(plan),
      "quiet"
    );
  }
}
function renderMentalModels(parent, stage) {
  if (!stage.jobContext.mentalModels.length) return;
  const block = parent.createDiv({ cls: "los-job-stage-block" });
  const mirrored = stage.jobContext.mentalModels.some(
    (model) => model.label === "Pandas baseline" || model.label === "Polars mirror"
  );
  block.createEl("h3", { text: mirrored ? "Concept mirror" : "Mental model" });
  const grid = block.createDiv({ cls: "los-job-concept-grid" });
  for (const model of stage.jobContext.mentalModels) {
    const item = grid.createEl("article", { cls: "los-job-concept-part" });
    item.createDiv({ cls: "los-kicker", text: model.label });
    item.createEl("p", { text: model.text });
  }
}
function renderStage(parent, host, dashboard, plan, stage) {
  const workspace = parent.createEl("article", { cls: "los-job-stage-reader" });
  const heading = workspace.createDiv({ cls: "los-job-stage-heading" });
  const copy = heading.createDiv({ cls: "los-job-stage-heading-copy" });
  copy.createDiv({
    cls: "los-kicker",
    text: `Stage ${String(stage.number).padStart(2, "0")} of ${plan.stages.length}`
  });
  copy.createEl("h2", { text: stage.title });
  badge(heading, stage.done ? "Done" : "Open", stage.done ? "complete" : "ready");
  if (stage.estimateMinutes) badge(heading, `${stage.estimateMinutes} min`, "role");
  if (stage.objective) {
    const goal = workspace.createDiv({ cls: "los-stage-goal" });
    goal.createDiv({ cls: "los-kicker", text: "Goal" });
    goal.createEl("p", { text: stage.objective });
  }
  renderMentalModels(workspace, stage);
  renderStageResources(workspace, stage.resources, {
    sourceRecord: (sourceId) => {
      const source = dashboard.canonical_shelf.find((item) => item.source_id === sourceId);
      return source ? { id: source.source_id, type: "source", title: source.title } : null;
    },
    openSource: (source) => host.openSourceDetail(String(source.id || "")),
    openResource: (resource) => {
      const jobResource = stage.resources.find((item) => item.id === resource.id && item.label === resource.label);
      if (jobResource?.url) return host.openJobUrl?.(jobResource.url);
      if (jobResource?.vaultPath) return host.openJobLearningPath?.(jobResource.vaultPath);
      return void 0;
    }
  });
  if (stage.jobContext.readOnlyAnchor) {
    const anchor = workspace.createDiv({ cls: "los-job-stage-block los-job-stratum-reference" });
    anchor.createEl("h3", { text: "Stratum read-only reference" });
    anchor.createEl("p", { text: stage.jobContext.readOnlyAnchor });
  }
  if (stage.doneWhen.length) {
    const done = section(workspace, "Done when");
    const list = done.createEl("ul", { cls: "los-donewhen-list" });
    for (const criterion of stage.doneWhen) {
      list.createEl("li", { cls: "los-donewhen-row", text: criterion });
    }
  }
  const actions = workspace.createDiv({ cls: "los-actions los-job-stage-actions" });
  if (host.logJobSession) {
    button(actions, "Log this stage", () => host.logJobSession?.(plan.id, stage.number), "cta");
  }
  if (host.setJobSessionState) {
    button(
      actions,
      stage.done ? "Reopen stage" : "Mark stage done",
      () => host.setJobSessionState?.(
        plan.id,
        stage.number,
        stage.done ? "open" : "done",
        plan.revision
      ),
      "quiet"
    );
  }
}
function renderPlanDetail(root, host, dashboard, plan) {
  const page = root.createDiv({ cls: "los-section los-job-plan-page" });
  if (host.closeJobPlan) button(page, "\u2190 All plans", () => host.closeJobPlan?.(), "tertiary");
  const header = page.createDiv({ cls: "los-job-plan-detail-header" });
  const top = header.createDiv({ cls: "los-card-top" });
  const copy = top.createDiv({ cls: "los-card-copy" });
  copy.createDiv({ cls: "los-kicker", text: "Study plan" });
  copy.createEl("h1", { text: plan.title });
  badge(top, plan.horizon, plan.horizon);
  if (plan.outcome) header.createEl("p", { cls: "los-job-plan-outcome", text: plan.outcome });
  const completed = plan.completedSessions.length;
  header.createDiv({
    cls: "los-micro",
    text: `${completed} of ${plan.stages.length} stages complete`
  });
  planProgress(header, plan);
  if (plan.cadence) {
    const cadence = header.createDiv({ cls: "los-job-plan-cadence" });
    cadence.createDiv({ cls: "los-kicker", text: "Cadence" });
    cadence.createEl("p", { text: plan.cadence });
  }
  if (host.editPlan) {
    button(
      header.createDiv({ cls: "los-actions" }),
      plan.sourceKind === "structured" ? "Edit plan" : "Make editable",
      () => host.editPlan?.(plan),
      "quiet"
    );
  }
  if (!plan.stages.length) {
    empty(page, "No stages yet", "Edit this plan to add its first learning stage.");
    return;
  }
  const selected = plan.stages.find(
    (stage) => stage.number === host.selectedPlanSession
  ) || plan.stages.find((stage) => !stage.done) || plan.stages[0];
  if (!selected) {
    empty(page, "No stage selected", "Return to the plan and choose a stage.");
    return;
  }
  const layout = page.createDiv({ cls: "los-job-plan-layout" });
  const rail = layout.createEl("nav", { cls: "los-job-stage-rail" });
  rail.setAttrs({ "aria-label": `${plan.title} stages` });
  rail.createEl("h2", { text: "Stages" });
  for (const stage of plan.stages) {
    const control = button(
      rail,
      "",
      () => host.openJobPlan?.(plan.id, stage.number),
      "row"
    );
    control.addClass("los-job-stage-row");
    control.toggleClass("is-selected", stage.number === selected.number);
    control.toggleClass("is-done", stage.done);
    control.setAttrs({
      "aria-label": `Open stage ${stage.number}: ${stage.title}`,
      "aria-pressed": String(stage.number === selected.number)
    });
    control.createSpan({
      cls: "los-job-stage-number",
      text: String(stage.number).padStart(2, "0")
    });
    const stageCopy = control.createSpan({ cls: "los-job-stage-copy" });
    stageCopy.createSpan({ text: stage.title });
    stageCopy.createSpan({ cls: "los-micro", text: stage.done ? "Done" : "Open" });
  }
  renderStage(layout, host, dashboard, plan, selected);
}
function renderPlans(root, host, dashboard) {
  const selected = host.selectedPlanId ? dashboard.learning_tracks.find((plan) => plan.id === host.selectedPlanId) : null;
  if (selected) {
    renderPlanDetail(root, host, dashboard, selected);
    return;
  }
  const wrap = section(
    root,
    "Study plans",
    "Open a plan, then work through one focused stage at a time."
  );
  const top = wrap.createDiv({ cls: "los-job-section-actions" });
  if (host.editPlan) button(top, "New plan", () => host.editPlan?.(), "cta");
  if (!dashboard.learning_tracks.length) {
    empty(wrap, "No study plans yet", "Create a path from a job requirement to proof you can show.");
    return;
  }
  const grid = wrap.createDiv({ cls: "los-job-plan-grid" });
  for (const plan of dashboard.learning_tracks) planCard(grid, host, plan);
}

// src/features/job/tasks.ts
var HORIZONS2 = [
  ["now", "Today / now"],
  ["next", "Next"],
  ["later", "Later"]
];
function taskRow(parent, host, task2) {
  const row = parent.createDiv({ cls: "los-job-task-row" });
  const toggle = row.createEl("input", {
    attr: { type: "checkbox", "aria-label": `Complete ${task2.title}` }
  });
  toggle.checked = task2.status === "done";
  toggle.addEventListener("change", () => {
    host.setTaskState?.(task2, toggle.checked ? "done" : "open");
  });
  const copy = row.createDiv({ cls: "los-job-task-copy" });
  copy.createEl("strong", { text: task2.title });
  if (task2.details) copy.createDiv({ cls: "los-micro", text: task2.details });
  if (task2.trackId) badge(copy, task2.trackId, "role");
  button(row, "Edit", () => host.editTask?.(task2), "tertiary");
  row.toggleClass("is-done", task2.status === "done");
}
function renderTasks(root, host, dashboard) {
  const wrap = section(root, "Tasks", "A small Job-only action list, separate from the academic work graph.");
  const top = wrap.createDiv({ cls: "los-job-section-actions" });
  if (host.editTask) button(top, "Add task", () => host.editTask?.(), "cta");
  if (!dashboard.tasks.length) {
    empty(wrap, "No Job tasks yet", "Add the first concrete action for this workspace.");
    return;
  }
  for (const [horizon2, label] of HORIZONS2) {
    const tasks = dashboard.tasks.filter((task2) => task2.horizon === horizon2);
    if (!tasks.length) continue;
    const group = wrap.createDiv({ cls: "los-job-task-group" });
    const head = group.createDiv({ cls: "los-card-top" });
    head.createEl("h3", { text: label });
    badge(head, String(tasks.length), horizon2);
    for (const task2 of tasks) taskRow(group, host, task2);
  }
}

// src/features/job/shell.ts
var TABS = [
  ["now", "Today"],
  ["tasks", "Tasks"],
  ["plans", "Plans"],
  ["notes", "Notes"],
  ["library", "Library"]
];
var DESTINATIONS = {
  now: renderNow,
  tasks: renderTasks,
  plans: renderPlans,
  notes: renderNotes,
  library: renderLibrary
};
function renderJobDashboard(root, host, dashboard, active, choose) {
  const header = pageHeader(root, "Job workspace", dashboard.title, dashboard.subtitle);
  const actions = header.createDiv({ cls: "los-actions los-job-header-actions" });
  if (host.editTask) button(actions, "Add task", () => host.editTask?.(), "quiet");
  if (host.editNote) button(actions, "New note", () => host.editNote?.(), "cta");
  filterTabs(root, "Job workspace sections", TABS, active, choose);
  (DESTINATIONS[active] || renderNow)(root, host, dashboard);
}

// src/features/job/session-modal.ts
var import_obsidian5 = require("obsidian");
var JobSessionModal = class extends import_obsidian5.Modal {
  trackTitle;
  sessionNumber;
  submit;
  editor;
  restoreAccessibility = null;
  constructor(app, options) {
    super(app);
    this.trackTitle = options.trackTitle;
    this.sessionNumber = options.sessionNumber;
    this.submit = options.submit;
  }
  onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-job-session-modal");
    const heading = root.createEl("h2", { text: "Log a job session" });
    heading.id = "los-job-session-heading";
    root.createDiv({
      cls: "los-muted",
      text: this.sessionNumber > 0 ? `${this.trackTitle} \xB7 session ${String(this.sessionNumber).padStart(2, "0")}` : this.trackTitle
    });
    this.editor = root.createEl("textarea", { cls: "los-job-session-editor" });
    this.editor.rows = 10;
    this.editor.placeholder = "What did you actually do, and what did it teach you?";
    const status = root.createDiv({ cls: "los-micro", attr: { "aria-live": "polite" } });
    const actions = root.createDiv({ cls: "los-job-session-actions" });
    const save = button(actions, "Save to Job scratch", async () => {
      const text = this.editor.value.trim();
      if (!text) {
        status.setText("An empty entry records nothing \u2014 write a line first.");
        this.editor.focus();
        return;
      }
      save.setAttribute("disabled", "true");
      status.setText("Saving\u2026");
      try {
        await this.submit(text);
        this.close();
      } catch (error) {
        save.removeAttribute("disabled");
        status.setText(error instanceof Error ? error.message : String(error));
      }
    }, "cta");
    button(actions, "Cancel", () => this.close(), "quiet");
    this.restoreAccessibility = makeModalAccessible(root, {
      close: () => this.close(),
      hostClass: "los-modal--job-session",
      labelledBy: "los-job-session-heading"
    });
    this.editor.focus();
  }
  onClose() {
    this.restoreAccessibility?.();
    this.restoreAccessibility = null;
    this.contentEl.empty();
  }
};

// src/features/job/editor-modals.ts
var import_obsidian6 = require("obsidian");
function labelledInput(parent, label, value = "") {
  const field = parent.createDiv({ cls: "los-job-field" });
  field.createEl("label", { text: label });
  const input = field.createEl("input", { attr: { type: "text" } });
  input.value = value;
  return input;
}
function labelledTextarea(parent, label, value = "", rows = 7) {
  const field = parent.createDiv({ cls: "los-job-field" });
  field.createEl("label", { text: label });
  const editor = field.createEl("textarea");
  editor.rows = rows;
  editor.value = value;
  return editor;
}
function labelledSelect(parent, label, value, options) {
  const field = parent.createDiv({ cls: "los-job-field" });
  field.createEl("label", { text: label });
  const select = field.createEl("select");
  for (const [optionValue, optionLabel] of options) {
    const option = select.createEl("option", { text: optionLabel });
    option.value = optionValue;
  }
  select.value = value;
  return select;
}
var JobEditorModal = class extends import_obsidian6.Modal {
  restoreAccessibility = null;
  begin(title, detail) {
    const root = this.contentEl;
    root.empty();
    root.addClass("los-root", "los-job-editor-modal");
    const heading = root.createEl("h2", { text: title });
    heading.id = "los-job-editor-heading";
    root.createEl("p", { cls: "los-muted", text: detail });
    this.restoreAccessibility = makeModalAccessible(root, {
      close: () => this.close(),
      hostClass: "los-modal--job-editor",
      labelledBy: heading.id
    });
    return root;
  }
  actions(root, label, save) {
    const status = root.createDiv({ cls: "los-draft-status", attr: { "aria-live": "polite" } });
    const actions = root.createDiv({ cls: "los-actions los-job-editor-actions" });
    const submit = button(actions, label, async () => {
      submit.disabled = true;
      status.setText("Saving\u2026");
      try {
        await save();
        this.close();
      } catch (error) {
        submit.disabled = false;
        status.setText(error instanceof Error ? error.message : String(error));
      }
    }, "cta");
    button(actions, "Cancel", () => this.close(), "quiet");
  }
  onClose() {
    this.restoreAccessibility?.();
    this.restoreAccessibility = null;
    this.contentEl.empty();
  }
};
var JobTaskModal = class extends JobEditorModal {
  constructor(app, options) {
    super(app);
    this.options = options;
  }
  onOpen() {
    const { task: task2 } = this.options;
    const root = this.begin(
      task2 ? "Update task" : "Add task",
      "Keep the action concrete. Horizon decides where it appears; it does not create a deadline."
    );
    const title = labelledInput(root, "Task", task2?.title || "");
    const details = labelledTextarea(root, "Details", task2?.details || "", 5);
    const horizon2 = labelledSelect(root, "Horizon", task2?.horizon || "now", [
      ["now", "Today / now"],
      ["next", "Next"],
      ["later", "Later"]
    ]);
    const track2 = labelledSelect(root, "Linked plan", task2?.trackId || "", [
      ["", "No linked plan"],
      ...this.options.tracks.map((item) => [item.id, item.title])
    ]);
    this.actions(root, task2 ? "Save update" : "Save task", async () => {
      const value = title.value.trim();
      if (!value) throw new Error("Write a task title first.");
      await this.options.submit({
        ...task2 ? { id: task2.id } : {},
        title: value,
        details: details.value.trim(),
        horizon: horizon2.value,
        status: task2?.status || "open",
        track_id: track2.value
      }, task2?.revision);
    });
    title.focus();
  }
};
var JobPlanModal = class extends JobEditorModal {
  constructor(app, options) {
    super(app);
    this.options = options;
  }
  onOpen() {
    const { plan } = this.options;
    const root = this.begin(
      plan ? "Update study plan" : "Create study plan",
      "Define the long-term outcome, then make each stage small enough to finish and prove."
    );
    const title = labelledInput(root, "Plan name", plan?.title || "");
    const horizon2 = labelledSelect(root, "Horizon", plan?.horizon || "now", [
      ["now", "Use now"],
      ["next", "Use next"],
      ["later", "Keep for later"]
    ]);
    const cadence = labelledInput(root, "Cadence", plan?.cadence || "One stage per week");
    const outcome = labelledTextarea(root, "Outcome", plan?.outcome || "", 4);
    const stages = plan ? null : labelledTextarea(
      root,
      "Stages \u2014 one per line: title | objective | done when | resource link | read-only anchor",
      "",
      10
    );
    if (plan) {
      root.createEl("p", {
        cls: "los-muted",
        text: `${plan.stages.length} structured stages are preserved. Open a stage to review its goal, resources, mental models, and proof.`
      });
    }
    this.actions(root, plan ? "Save update" : "Save plan", async () => {
      const planTitle = title.value.trim();
      if (!planTitle) throw new Error("Give the plan a name first.");
      const rows = stages?.value.split("\n").map((line) => line.trim()).filter(Boolean) || [];
      if (!plan && !rows.length) throw new Error("Add at least one stage.");
      await this.options.submit({
        ...plan ? { id: plan.id } : {},
        title: planTitle,
        horizon: horizon2.value,
        cadence: cadence.value.trim(),
        outcome: outcome.value.trim(),
        status: plan?.status || "ready",
        stages: plan ? plan.stages.map((stage) => ({
          id: stage.id,
          number: stage.number,
          title: stage.title,
          status: stage.status,
          objective: stage.objective,
          done_when: [...stage.doneWhen],
          ...stage.estimateMinutes ? { estimate_minutes: stage.estimateMinutes } : {},
          exam_critical: stage.examCritical,
          concepts: [...stage.concepts],
          scope_triage: stage.scopeTriage,
          resources: stage.resources.map((resource) => ({
            ...resource.id ? { id: resource.id } : {},
            kind: resource.kind,
            label: resource.label,
            ...resource.sourceId ? { source_id: resource.sourceId } : {},
            ...resource.locator ? { locator: resource.locator } : {},
            ...resource.url ? { url: resource.url } : {},
            ...resource.vaultPath ? { vault_path: resource.vaultPath } : {},
            ...resource.scopeTriage ? { scope_triage: resource.scopeTriage } : {}
          })),
          attachments: [],
          source_feedback: [],
          job_context: {
            mental_models: stage.jobContext.mentalModels.map((model) => ({ ...model })),
            read_only_anchor: stage.jobContext.readOnlyAnchor
          }
        })) : rows.map((line, index) => {
          const [stageTitle = "", objective = "", proof = "", link = "", anchor = ""] = line.split("|").map((part) => part.trim());
          const linkedResource = link ? {
            kind: "read",
            label: `Learning material for ${stageTitle || `stage ${index + 1}`}`,
            ...link.startsWith("http") ? { url: link } : { vault_path: link },
            scope_triage: "required-now"
          } : null;
          return {
            id: `stage-${planTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${index + 1}`,
            number: index + 1,
            title: stageTitle,
            status: "pending",
            objective: objective || `Build working fluency in ${stageTitle}.`,
            done_when: [proof || `Explain and apply ${stageTitle} without notes.`],
            estimate_minutes: 90,
            exam_critical: false,
            concepts: [],
            scope_triage: "required-now",
            resources: linkedResource ? [linkedResource] : [],
            attachments: [],
            source_feedback: [],
            job_context: { mental_models: [], read_only_anchor: anchor }
          };
        })
      }, plan?.revision);
    });
    title.focus();
  }
};
var JobNoteModal = class extends JobEditorModal {
  constructor(app, options) {
    super(app);
    this.options = options;
  }
  onOpen() {
    const { note: note2 } = this.options;
    const root = this.begin(
      note2 ? "Update note" : "New learning note",
      "Capture what you learned in your own words. Source stamps remain a separate verification action."
    );
    const title = labelledInput(root, "Note title", note2?.title || "");
    const body = labelledTextarea(root, "Working note", note2?.body || "", 16);
    this.actions(root, note2 ? "Save update" : "Create note", async () => {
      const noteTitle = title.value.trim();
      const noteBody = body.value.trim();
      if (!noteTitle || !noteBody) throw new Error("A note needs both a title and some text.");
      await this.options.submit(note2?.id || "", noteTitle, noteBody, note2?.revision);
    });
    title.focus();
  }
};

// src/contracts/job-dashboard.ts
var JOB_DASHBOARD_CONTRACT = "job-dashboard-v2";

// src/features/job/model.ts
function horizon(value) {
  return value === "now" || value === "next" ? value : "later";
}
function relativeJobPath(value) {
  const path = asTrimmedString(value).replace(/\\/g, "/").replace(/^\.\//, "");
  if (!path || path.startsWith("/") || path.split("/").includes("..")) return "";
  return path;
}
function note(value) {
  const row = asRecordOrEmpty(value);
  const id = asTrimmedString(row.id);
  const title = asTrimmedString(row.title);
  const path = relativeJobPath(row.path);
  if (!id || !title || !path) return null;
  return {
    id,
    title,
    kind: row.kind === "stratum" ? "stratum" : row.kind === "learning" ? "learning" : "skrub",
    family: asTrimmedString(row.family),
    summary: asTrimmedString(row.summary),
    body: asTrimmedString(row.body),
    path,
    component: asTrimmedString(row.component),
    layer: asTrimmedString(row.layer),
    verified_against: asTrimmedString(row.verified_against),
    declared_status: asTrimmedString(row.declared_status),
    freshness: asTrimmedString(row.freshness) || "unverified",
    revision: asNumber(row.revision)
  };
}
function track(value) {
  const row = asRecordOrEmpty(value);
  const id = asTrimmedString(row.id);
  const title = asTrimmedString(row.title);
  const path = relativeJobPath(row.path);
  if (!id || !title || !path) return null;
  return {
    id,
    title,
    path,
    status: asTrimmedString(row.status) || "ready",
    cadence: asTrimmedString(row.cadence),
    horizon: horizon(row.horizon),
    outcome: asTrimmedString(row.outcome),
    stages: asRecords(row.stages).map((stage) => {
      const context = asRecordOrEmpty(stage.job_context);
      const resources = asRecords(stage.resources).map((resource) => {
        const url = asTrimmedString(resource.url) || null;
        const vaultPath = relativeJobPath(resource.vault_path) || null;
        const resourceRecord = { ...resource };
        if (url) resourceRecord.url = url;
        if (vaultPath) resourceRecord.vault_path = vaultPath;
        return {
          record: resourceRecord,
          id: asTrimmedString(resource.id) || null,
          kind: asTrimmedString(resource.kind) || "read",
          label: asTrimmedString(resource.label) || "Resource",
          locator: asTrimmedString(resource.locator) || null,
          sourceId: asTrimmedString(resource.source_id) || null,
          scopeTriage: asTrimmedString(resource.scope_triage) || null,
          canOpen: Boolean(url || vaultPath),
          url,
          vaultPath
        };
      });
      return {
        id: asTrimmedString(stage.id),
        number: asNumber(stage.number),
        title: asTrimmedString(stage.title),
        status: asTrimmedString(stage.status) || "pending",
        objective: asTrimmedString(stage.objective),
        doneWhen: asTrimmedStrings(stage.done_when),
        estimateMinutes: asNumber(stage.estimate_minutes) || null,
        examCritical: stage.exam_critical === true,
        concepts: asTrimmedStrings(stage.concepts),
        scopeTriage: asTrimmedString(stage.scope_triage) || "required-now",
        resources,
        jobContext: {
          mentalModels: asRecords(context.mental_models).map((model) => ({
            label: asTrimmedString(model.label),
            text: asTrimmedString(model.text)
          })).filter((model) => model.label && model.text),
          readOnlyAnchor: asTrimmedString(context.read_only_anchor)
        },
        done: stage.done === true
      };
    }).filter((stage) => stage.id && stage.number > 0 && stage.title),
    completedSessions: asNumbers(row.completed_sessions),
    lastSessionAt: asTrimmedString(row.last_session_at),
    sourceKind: row.source_kind === "structured" ? "structured" : "legacy-markdown",
    revision: asNumber(row.revision)
  };
}
function task(value) {
  const row = asRecordOrEmpty(value);
  const id = asTrimmedString(row.id);
  const title = asTrimmedString(row.title);
  if (!id || !title) return null;
  return {
    id,
    title,
    details: asTrimmedString(row.details),
    horizon: horizon(row.horizon),
    status: row.status === "done" ? "done" : "open",
    trackId: asTrimmedString(row.track_id),
    createdAt: asTrimmedString(row.created_at),
    updatedAt: asTrimmedString(row.updated_at),
    revision: asNumber(row.revision)
  };
}
function layer(value) {
  const row = asRecordOrEmpty(value);
  const id = asTrimmedString(row.id);
  if (!id) return null;
  return {
    id,
    title: asTrimmedString(row.title) || id,
    summary: asTrimmedString(row.summary),
    noteIds: Array.isArray(row.note_ids) ? row.note_ids.filter((item) => typeof item === "string") : []
  };
}
function paper(value) {
  const row = asRecordOrEmpty(value);
  const id = asTrimmedString(row.id);
  const title = asTrimmedString(row.title);
  const path = relativeJobPath(row.path);
  if (!id || !title || !path) return null;
  return {
    id,
    title,
    path,
    authors: asTrimmedStrings(row.authors),
    year: row.year == null ? "" : String(row.year),
    pages: asNumber(row.pages),
    horizon: horizon(row.horizon),
    angle: asTrimmedString(row.angle),
    available: row.available === true
  };
}
function shelfSource(value) {
  const row = asRecordOrEmpty(value);
  const sourceId = asTrimmedString(row.source_id);
  const title = asTrimmedString(row.title);
  if (!sourceId || !title) return null;
  return {
    source_id: sourceId,
    title,
    type: asTrimmedString(row.type) || "source",
    authors: asTrimmedStrings(row.authors),
    horizon: horizon(row.horizon),
    why: asTrimmedString(row.why)
  };
}
function asJobDashboard(result) {
  if (result.ok !== true || result.contract !== JOB_DASHBOARD_CONTRACT) return null;
  const raw = asRecordOrEmpty(result.dashboard);
  const workspaceRaw = asRecordOrEmpty(raw.workspace);
  const workspacePath = relativeJobPath(workspaceRaw.path);
  const title = asTrimmedString(raw.title);
  if (!title || !workspacePath) return null;
  const noteRaw = asRecordOrEmpty(raw.notes);
  return {
    id: asTrimmedString(raw.id) || "job-dashboard",
    title,
    subtitle: asTrimmedString(raw.subtitle),
    workspace: {
      id: asTrimmedString(workspaceRaw.id) || "workspace-job-deem",
      title: asTrimmedString(workspaceRaw.title) || title,
      status: asTrimmedString(workspaceRaw.status) || "active",
      standing: workspaceRaw.standing === true,
      objective: asTrimmedString(workspaceRaw.objective),
      current_scope: asRecords(workspaceRaw.current_scope).map((scope) => ({
        label: asTrimmedString(scope.label),
        text: asTrimmedString(scope.text)
      })).filter((scope) => scope.label && scope.text),
      next_action: asTrimmedString(workspaceRaw.next_action),
      open_questions: asTrimmedStrings(workspaceRaw.open_questions),
      path: workspacePath
    },
    notes: {
      learning: asRecords(noteRaw.learning).map(note).filter((item) => item !== null),
      skrub: asRecords(noteRaw.skrub).map(note).filter((item) => item !== null),
      stratum: asRecords(noteRaw.stratum).map(note).filter((item) => item !== null),
      health: asNumberRecord(noteRaw.health),
      layers: asRecords(noteRaw.layers).map(layer).filter((item) => item !== null)
    },
    learning_tracks: asRecords(raw.learning_tracks).map(track).filter((item) => item !== null),
    tasks: asRecords(raw.tasks).map(task).filter((item) => item !== null),
    papers: asRecords(raw.papers).map(paper).filter((item) => item !== null),
    canonical_shelf: asRecords(raw.canonical_shelf).map(shelfSource).filter((item) => item !== null),
    counts: asNumberRecord(raw.counts)
  };
}

// src/views/boundary-view.ts
var BoundaryView = class extends import_obsidian7.ItemView {
  plugin;
  boundaryId = null;
  tab = "now";
  planId = null;
  planSession = null;
  dashboard = null;
  loading = false;
  error = "";
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
      if (state.boundaryId !== this.boundaryId) {
        this.dashboard = null;
        this.error = "";
      }
      this.boundaryId = state.boundaryId;
    }
    if (state.tab === "system") {
      this.tab = "notes";
    } else if (["now", "tasks", "plans", "notes", "library"].includes(String(state.tab))) {
      this.tab = state.tab;
    }
    if ("planId" in state) {
      this.planId = typeof state.planId === "string" && state.planId.trim() ? state.planId.trim() : null;
    }
    if ("planSession" in state) {
      this.planSession = typeof state.planSession === "number" && Number.isInteger(state.planSession) && state.planSession > 0 ? state.planSession : null;
    }
    this.render();
    if (this.boundaryId === "program-job-boundary") void this.loadJobDashboard();
  }
  getState() {
    return {
      boundaryId: this.boundaryId,
      tab: this.tab,
      planId: this.planId,
      planSession: this.planSession
    };
  }
  async onOpen() {
    const boundaryId = this.leaf.state?.boundaryId;
    if (typeof boundaryId === "string") {
      this.boundaryId = boundaryId;
    }
    const planId = this.leaf.state?.planId;
    const planSession = this.leaf.state?.planSession;
    if (typeof planId === "string" && planId.trim()) this.planId = planId.trim();
    if (typeof planSession === "number" && Number.isInteger(planSession) && planSession > 0) {
      this.planSession = planSession;
    }
    this.render();
    if (this.boundaryId === "program-job-boundary") void this.loadJobDashboard();
  }
  async loadJobDashboard() {
    if (this.loading || this.dashboard || this.boundaryId !== "program-job-boundary") return;
    this.loading = true;
    this.error = "";
    this.render();
    try {
      const result = await this.plugin.gateway.jobDashboard();
      const dashboard = asJobDashboard(result);
      if (!dashboard || !this.plugin.resources.grantJobAccess(result.access)) {
        throw new Error("LearningOS refused an invalid Job dashboard response.");
      }
      this.dashboard = dashboard;
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.loading = false;
      this.render();
    }
  }
  chooseTab(tab) {
    this.tab = tab;
    this.render();
  }
  openJobPlan(trackId, session) {
    const plan = this.dashboard?.learning_tracks.find((item) => item.id === trackId);
    if (!plan) {
      new import_obsidian7.Notice("That study plan is no longer available.");
      return;
    }
    const requested = typeof session === "number" ? plan.stages.find((item) => item.number === session) : null;
    const selected = requested || plan.stages.find((item) => !item.done) || plan.stages[0];
    this.planId = plan.id;
    this.planSession = selected?.number || null;
    this.tab = "plans";
    this.render();
  }
  closeJobPlan() {
    this.planId = null;
    this.planSession = null;
    this.render();
  }
  /** The core refuses an empty entry, so the text is collected before writing. */
  openSessionLog(track2, session) {
    const title = this.dashboard?.learning_tracks.find((item) => item.id === track2)?.title || track2;
    new JobSessionModal(this.app, {
      trackTitle: title,
      sessionNumber: session,
      submit: async (text) => {
        await this.commitJobWrite(() => this.plugin.gateway.logJobSession(text, { track: track2, session }));
      }
    }).open();
  }
  openTaskEditor(task2) {
    new JobTaskModal(this.app, {
      ...task2 ? { task: task2 } : {},
      tracks: this.dashboard?.learning_tracks || [],
      submit: (value, revision) => this.commitJobWrite(
        () => this.plugin.gateway.saveJobTask(value, revision)
      )
    }).open();
  }
  openPlanEditor(plan) {
    new JobPlanModal(this.app, {
      ...plan ? { plan } : {},
      submit: (value, revision) => this.commitJobWrite(
        () => this.plugin.gateway.saveJobPlan(value, revision)
      )
    }).open();
  }
  openNoteEditor(note2) {
    new JobNoteModal(this.app, {
      ...note2 ? { note: note2 } : {},
      submit: (noteId, title, body, revision) => this.commitJobWrite(
        () => this.plugin.gateway.saveJobNote(noteId, title, body, revision)
      )
    }).open();
  }
  async commitJobWrite(write) {
    try {
      await this.plugin.gateway.enqueue(write);
    } catch (error) {
      if (isProjectionConflict(error)) {
        this.dashboard = null;
        await this.loadJobDashboard();
      }
      throw error;
    }
    this.dashboard = null;
    await this.loadJobDashboard();
  }
  /**
   * Run one bounded Job write, then reload the dashboard so the view reflects
   * what the core actually recorded rather than an optimistic local guess —
   * the response is ephemeral and the core owns the merge (ADR-010).
   */
  async runJobWrite(write) {
    try {
      await this.commitJobWrite(write);
    } catch (error) {
      new import_obsidian7.Notice(error instanceof Error ? error.message : String(error));
      this.error = "";
      this.render();
    }
  }
  render() {
    const root = this.contentEl;
    root.empty();
    root.removeClass("los-job-view");
    root.addClass("los-root", "los-boundary-view");
    const boundary = (this.plugin.store.data?.quarantine_boundaries || []).find(
      (row) => row.id === this.boundaryId
    );
    if (!boundary) {
      empty(root, "Boundary unavailable", "No quarantined content was loaded.");
      return;
    }
    if (boundary.id === "program-job-boundary") {
      root.addClass("los-job-view");
      if (this.dashboard) {
        renderJobDashboard(
          root,
          {
            openJobPath: (path) => this.plugin.resources.openJobPath(path),
            openSourceDetail: (sourceId) => this.plugin.openSourceDetail(sourceId),
            openJobPlan: (trackId, session) => this.openJobPlan(trackId, session),
            closeJobPlan: () => this.closeJobPlan(),
            selectedPlanId: this.planId,
            selectedPlanSession: this.planSession,
            openJobUrl: (url) => this.plugin.resources.openJobUrl(url),
            openJobLearningPath: (path) => this.plugin.resources.openJobLearningPath(path),
            logJobSession: (track2, session) => this.openSessionLog(track2, session),
            setJobSessionState: (track2, session, state, revision) => this.runJobWrite(
              () => this.plugin.gateway.recordJobTrackSession(track2, session, state, revision)
            ),
            editTask: (task2) => this.openTaskEditor(task2),
            setTaskState: (task2, state) => this.runJobWrite(
              () => this.plugin.gateway.saveJobTask({
                id: task2.id,
                title: task2.title,
                details: task2.details,
                horizon: task2.horizon,
                status: state,
                track_id: task2.trackId
              }, task2.revision)
            ),
            editPlan: (plan) => this.openPlanEditor(plan),
            editNote: (note2) => this.openNoteEditor(note2)
          },
          this.dashboard,
          this.tab,
          (tab) => this.chooseTab(tab)
        );
        return;
      }
      pageHeader(
        root,
        "Job \xB7 confidential workspace",
        asLabel(boundary, "Job"),
        boundaryPolicy(boundary.description)
      );
      if (this.loading) {
        empty(root, "Opening the confidential workspace", "Reading only the bounded Job dashboard. Nothing is being added to LearningOS search or the manifest.");
      } else if (this.error) {
        empty(root, "Job workspace unavailable", this.error, "Try again", () => void this.loadJobDashboard());
      } else {
        empty(root, "Job workspace is sealed", "Opening this destination creates an ephemeral Job session. Notes, plans, tasks, and progress can then be saved only through the guarded gateway.", "Open confidential workspace", () => void this.loadJobDashboard());
      }
      return;
    }
    pageHeader(root, "Deliberate boundary", asLabel(boundary, "Boundary"), boundaryPolicy(boundary.description));
    const guard = section(root, "What this means");
    guard.createEl("p", { text: "Master\u2019s planning is quarantined from current Bachelor\u2019s work and all default search. This surface exposes only the boundary record." });
    button(guard, "Open Master\u2019s Planning boundary", () => new import_obsidian7.Notice("Open the quarantined folder manually only for a deliberate planning session."), "warm");
  }
};

// src/views/garden-view.ts
var import_obsidian9 = require("obsidian");

// src/features/ai-actions/action-button.ts
var import_obsidian8 = require("obsidian");
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
  if (provider !== plugin.settings.preferredAiProvider) {
    plugin.settings.preferredAiProvider = provider;
    plugin.scheduleDraftSave();
  }
  if (target.job_derived) {
    const consent = wrap.createEl("label", { cls: "los-ai-consent" });
    const checkbox = consent.createEl("input", { attr: { type: "checkbox" } });
    consent.createSpan({ text: "Confirm this exported item may leave the Job boundary" });
    checkbox.addEventListener("change", () => {
      jobConfirmed = Boolean(checkbox.checked);
    });
  }
  const targetId = target.id;
  const launch = button(wrap, "Refine with AI", async () => {
    if (!targetId) {
      new import_obsidian8.Notice("This Garden item has no projected identity. Refresh LearningOS and try again.");
      return;
    }
    if (target.job_derived && !jobConfirmed) {
      new import_obsidian8.Notice("Explicit export confirmation is required for job-derived material.");
      return;
    }
    launch.setAttr("disabled", "disabled");
    launch.setText("Preparing\u2026");
    try {
      const result = await plugin.aiActions.prepareGardenShelving(
        targetId,
        provider,
        jobConfirmed
      );
      const bundlePath = result.bundle_path || result.request?.bundle_path;
      new import_obsidian8.Notice(bundlePath ? `AI request prepared: ${bundlePath}` : "AI request prepared.");
      onChanged?.(result);
    } catch (error) {
      new import_obsidian8.Notice(errorMessage(error));
      launch.removeAttribute?.("disabled");
      launch.setText("Refine with AI");
    }
  }, "warm");
  launch.addClass("los-ai-action-button");
  if (!available.length) launch.setAttr("disabled", "disabled");
  return wrap;
}

// src/views/garden-view.ts
var GARDEN_FILTERS = [
  ["all", "All"],
  ["seed", "Growing"],
  ["review-due", "Review due"],
  ["harvest-candidate", "Candidates"]
];
var GardenView = class extends import_obsidian9.ItemView {
  plugin;
  seedTitle = "";
  seedText = "";
  planting = false;
  filter = "all";
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
    root.addClass(
      "los-root",
      "los-garden-view"
    );
    if (!this.plugin.store.ready) {
      pageHeader(
        root,
        "Garden",
        "Garden unavailable"
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
      "Garden \xB7 Incubation",
      "Garden",
      "Ideas can stay messy here until you know what they want to become."
    );
    this.renderComposer(root);
    const entries = this.plugin.store.gardenEntries();
    filterTabs(
      root,
      "Garden filters",
      GARDEN_FILTERS,
      this.filter,
      (value) => {
        this.filter = value;
        this.render();
      },
      (value) => value === "all" ? entries.length : entries.filter(
        (entry) => String(entry.state || "seed") === value
      ).length
    );
    const listHeader = root.createDiv({
      cls: "los-garden-list-header"
    });
    listHeader.createEl("h2", {
      text: "Growing ideas"
    });
    listHeader.createSpan({
      cls: "los-micro",
      text: "Review eligibility is projected by Core"
    });
    const visible = this.filter === "all" ? entries : entries.filter(
      (entry) => String(entry.state || "seed") === this.filter
    );
    if (!visible.length) {
      empty(
        root,
        entries.length ? "Nothing in this view" : "No Garden seeds yet",
        entries.length ? "Choose another Garden filter." : "Plant one above. A seed needs no module, topic, destination, or AI."
      );
    } else {
      const list = root.createDiv({
        cls: "los-garden-list"
      });
      for (const target of visible) {
        this.card(list, target);
      }
    }
    const tools = disclosure(
      root,
      "Garden tools",
      "los-utility-disclosure"
    );
    button(
      tools,
      "Open Garden base",
      () => this.plugin.openVaultPath(
        "bases/garden.base"
      ),
      "info"
    );
    button(
      tools,
      "Refresh projection",
      () => this.plugin.generate(),
      "quiet"
    );
  }
  renderComposer(root) {
    const composer = root.createDiv({
      cls: "los-garden-seed-composer"
    });
    composer.createEl("h2", {
      text: "Plant something\u2026"
    });
    composer.createEl("p", {
      cls: "los-muted",
      text: "A thought, question, fragment, or connection. No filing required. No AI required."
    });
    const editor = composer.createEl(
      "textarea",
      {
        cls: "los-garden-seed-editor",
        attr: {
          rows: "2",
          placeholder: "What keeps returning to your mind?",
          "aria-label": "Garden seed text"
        }
      }
    );
    editor.value = this.seedText;
    editor.addEventListener(
      "input",
      () => {
        this.seedText = editor.value;
        syncAddState();
      }
    );
    const actions = composer.createDiv({
      cls: "los-actions los-garden-composer-actions"
    });
    const title = actions.createEl(
      "input",
      {
        cls: "los-garden-seed-title",
        attr: {
          type: "text",
          placeholder: "Title optional",
          "aria-label": "Optional Garden seed title"
        }
      }
    );
    title.value = this.seedTitle;
    title.addEventListener(
      "input",
      () => {
        this.seedTitle = title.value;
        syncAddState();
      }
    );
    const add = button(
      actions,
      this.planting ? "Adding\u2026" : "Add seed",
      () => {
        void this.plantSeed();
      },
      "cta"
    );
    const syncAddState = () => {
      add.disabled = this.planting || !this.seedText.trim();
      add.setAttribute(
        "aria-disabled",
        String(add.disabled)
      );
    };
    syncAddState();
  }
  async plantSeed() {
    if (this.planting) {
      return;
    }
    const text = this.seedText;
    const title = this.seedTitle.trim();
    if (!text.trim()) {
      new import_obsidian9.Notice(
        "Write something before adding the seed."
      );
      return;
    }
    this.planting = true;
    this.render();
    try {
      await this.plugin.mutate(
        () => this.plugin.gateway.createGardenSeed(
          text,
          title
        )
      );
      this.seedTitle = "";
      this.seedText = "";
      new import_obsidian9.Notice("Garden seed added.");
    } catch (error) {
      new import_obsidian9.Notice(errorMessage(error));
    } finally {
      this.planting = false;
      this.render();
    }
  }
  card(parent, target) {
    const targetId = asString(target.id);
    const targetState = asString(target.state) || "seed";
    const targetPath = asString(target.path);
    const card = parent.createDiv({
      cls: `los-card los-garden-card los-garden-${targetState}`
    });
    const top = card.createDiv({
      cls: "los-card-top"
    });
    top.createEl("h2", {
      text: asLabel(target, "Garden seed")
    });
    badge(
      top,
      targetState,
      targetState
    );
    card.createDiv({
      cls: "los-micro",
      text: targetPath || "Path unavailable"
    });
    if (target.tags?.length) {
      const tags = card.createDiv({
        cls: "los-garden-tags"
      });
      for (const tag of target.tags) {
        badge(
          tags,
          `#${tag}`,
          "role"
        );
      }
    }
    const latest = targetId ? this.plugin.store.latestAiRequest(targetId) : null;
    if (latest) {
      const bundlePath = asString(latest.bundle_path);
      const status = card.createDiv({
        cls: "los-ai-request-status"
      });
      status.createEl("strong", {
        text: `AI request \xB7 ${latest.status}`
      });
      status.createDiv({
        cls: "los-micro",
        text: `${latest.provider || "manual-bundle"} \xB7 ${latest.id}`
      });
      if (bundlePath) {
        status.createDiv({
          cls: "los-micro",
          text: bundlePath
        });
      }
      const statusActions = status.createDiv({
        cls: "los-actions"
      });
      if (bundlePath) {
        button(
          statusActions,
          "Copy bundle path",
          () => this.plugin.copyText(
            bundlePath
          ),
          "quiet"
        );
      }
      if (latest.delivery_id && latest.status !== "applied") {
        const deliveryId = latest.delivery_id;
        button(
          statusActions,
          "Apply approved delivery",
          async () => {
            try {
              await this.plugin.aiActions.applyApprovedDelivery(
                deliveryId
              );
              new import_obsidian9.Notice(
                "Approved AI delivery applied and projection refreshed."
              );
              this.render();
            } catch (error) {
              new import_obsidian9.Notice(
                errorMessage(error)
              );
            }
          },
          "success"
        );
      }
      if (latest.receipt_id) {
        badge(
          status,
          `receipt ${latest.receipt_id}`,
          "complete"
        );
      }
    }
    const actions = card.createDiv({
      cls: "los-garden-actions"
    });
    if (targetPath) {
      button(actions, "Open original", () => this.plugin.openVaultPath(targetPath), "info");
    }
    if (target.transcription_path) {
      const transcriptionPath = target.transcription_path;
      button(
        actions,
        "Open AI transcription",
        () => this.plugin.openVaultPath(
          transcriptionPath
        ),
        "info"
      );
    }
    if (targetId) {
      renderGardenShelveAction(actions, this.plugin, target, () => this.render());
    }
    return card;
  }
};

// src/features/home/model.ts
function readResumePointer(value) {
  if (!isRecord2(value)) {
    return {};
  }
  return {
    unit_id: asString(value.unit_id) ?? void 0,
    study_map_id: asString(value.study_map_id) ?? void 0,
    stage_id: asString(value.stage_id) ?? void 0,
    module_id: asString(value.module_id) ?? void 0
  };
}
function firstProjectedModuleId(value) {
  for (const candidate of asRecords(value)) {
    const moduleId = asString(candidate.module_id);
    if (moduleId) {
      return moduleId;
    }
  }
  return null;
}

// src/features/home/elsewhere.ts
function renderElsewhere(view, root) {
  const sectionEl = section(
    root,
    "Continue elsewhere",
    "Other active modules and projects, kept secondary to the current session."
  );
  const pointer = readResumePointer(
    view.plugin.store.data?.resume_pointer
  );
  const rows = [];
  for (const record of view.plugin.store.currentSemesterModules()) {
    const recordId = asString(record.id);
    if (!recordId || recordId === pointer.module_id) {
      continue;
    }
    if (record.is_actionable !== true) {
      continue;
    }
    rows.push({
      record,
      type: asString(record.kind) === "skill" ? "Skill" : "Module",
      open: () => view.plugin.openModule(
        recordId
      )
    });
  }
  for (const record of view.plugin.store.projects()) {
    const recordId = asString(record.id);
    if (!recordId) {
      continue;
    }
    const status = asString(record.status);
    if (status && ["completed", "archived"].includes(status)) {
      continue;
    }
    rows.push({
      record,
      type: "Project",
      open: () => view.plugin.openProject(
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
    const nextAction = row.type === "Project" ? "" : view.moduleNextAction(
      row.record
    );
    view.renderHomeRow(
      list,
      {
        title: asLabel(
          row.record
        ),
        detail: `${row.type}${nextAction ? ` \xB7 ${nextAction}` : ""}`,
        actionLabel: "Open",
        action: row.open
      }
    );
  }
}
function renderHomeRow(parent, item) {
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
function nextWorkspaceDate(view, workspace) {
  const directDeadline = asString(workspace.deadline);
  if (directDeadline) {
    return directDeadline;
  }
  const moduleIds = new Set(
    asStrings(
      workspace.module_ids
    )
  );
  const dates = [];
  for (const row of view.plugin.store.rows(
    "academic_deadlines"
  )) {
    const kind = asString(row.kind);
    const moduleId = asString(row.module_id);
    const startDate = asString(row.start_date);
    if (kind === "exam" && moduleId && startDate && moduleIds.has(moduleId)) {
      dates.push(startDate);
    }
    if (kind === "registration-window" && startDate && asRecords(
      row.modules
    ).some(
      (module2) => {
        const nestedModuleId = asString(
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
function moduleNextAction(view, module2) {
  const moduleId = asString(module2.id);
  if (!moduleId) {
    return "";
  }
  const workspace = view.plugin.store.of("workspace").filter(
    (row) => {
      const status = asString(row.status);
      return row.archived !== true && status !== "complete" && asStrings(
        row.module_ids
      ).includes(moduleId);
    }
  ).sort(
    (left, right) => view.nextWorkspaceDate(left).localeCompare(
      view.nextWorkspaceDate(
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
  for (const unit of view.plugin.store.unitsFor(moduleId)) {
    const unitId = asString(unit.id);
    if (!unitId) {
      continue;
    }
    const map = view.plugin.store.mapForUnit(
      unitId
    );
    if (!map) {
      continue;
    }
    const stages = asRecords(map.stages);
    const currentStageId = asString(
      map.current_stage
    );
    const stage = (currentStageId ? stages.find(
      (row) => asString(row.id) === currentStageId
    ) : void 0) ?? stages.find(
      (row) => asString(row.status) === "active"
    ) ?? stages.find(
      (row) => asString(row.status) !== "complete"
    );
    const stageTitle = stage ? asString(stage.title) : null;
    if (stageTitle) {
      return stageTitle;
    }
  }
  return "";
}

// src/features/home/focus.ts
function renderContinue(view, root) {
  const pointer = readResumePointer(
    view.plugin.store.data?.resume_pointer
  );
  const unit = pointer.unit_id ? view.plugin.store.get(pointer.unit_id) : null;
  const map = pointer.study_map_id ? view.plugin.store.get(
    pointer.study_map_id
  ) : null;
  const stage = pointer.stage_id ? view.plugin.store.stage(
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
      () => view.plugin.openLearn()
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
  const unitModuleId = asString(unit.module_id);
  const module2 = unitModuleId ? view.plugin.store.get(unitModuleId) : null;
  copy.createDiv({
    cls: "los-continue-module",
    text: `${module2 ? asLabel(module2) : unitModuleId ?? "Unknown module"} \xB7 ${asLabel(unit)}`
  });
  copy.createEl("h2", {
    text: asLabel(stage)
  });
  const stages = asRecords(map?.stages);
  const position = stages.findIndex(
    (row) => asString(row.id) === pointer.stage_id
  );
  const meta = copy.createDiv({
    cls: "los-continue-meta"
  });
  if (stages.length) {
    meta.createSpan({
      text: `Stage ${position >= 0 ? position + 1 : 1} of ${stages.length}`
    });
  }
  const estimate = asText(
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
    () => view.plugin.openUnit(
      pointer.unit_id,
      pointer.stage_id
    ),
    "cta"
  );
}
function renderToday(view, root) {
  const sectionEl = section(
    root,
    "Today",
    "Only items likely to affect the next decision."
  );
  const items = [];
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const upcoming = view.plugin.store.rows("academic_deadlines").filter(
    (row) => {
      const boundary = asString(row.end_date) ?? asString(
        row.start_date
      ) ?? "";
      return boundary >= today;
    }
  ).sort(
    (left, right) => {
      const leftDate = asString(
        left.start_date
      ) ?? asString(
        left.end_date
      ) ?? "";
      const rightDate = asString(
        right.start_date
      ) ?? asString(
        right.end_date
      ) ?? "";
      return leftDate.localeCompare(
        rightDate
      );
    }
  );
  for (const deadline of upcoming.slice(0, 2)) {
    const moduleId = asString(deadline.module_id) ?? firstProjectedModuleId(
      deadline.modules
    );
    const kind = asString(deadline.kind);
    const label = asString(deadline.label);
    const title = kind === "registration-window" ? label ?? asLabel(deadline) : asString(deadline.title) ?? label ?? asLabel(deadline);
    const startDate = asString(deadline.start_date);
    const endDate = asString(deadline.end_date);
    const date = endDate && startDate && endDate !== startDate ? `${startDate} \u2192 ${endDate}` : startDate ?? endDate ?? "Date pending";
    const registrationState = asString(
      deadline.registration_state
    );
    const registrationDetail = registrationState && registrationState !== "registered" ? ` \xB7 ${registrationState}` : "";
    items.push({
      title,
      detail: `${date}${registrationDetail}`,
      actionLabel: moduleId ? "Open module" : "",
      action: moduleId ? () => view.plugin.openModule(
        moduleId
      ) : null
    });
  }
  const reviewItems = view.plugin.store.reviewItems();
  const reviewCount = reviewItems.length;
  if (reviewCount) {
    const categories = /* @__PURE__ */ new Map();
    for (const item of reviewItems) {
      const category = asString(item.category) ?? "other";
      categories.set(
        category,
        (categories.get(category) ?? 0) + 1
      );
    }
    const details = [...categories.entries()].map(
      ([category, count]) => `${count} ${category.replaceAll("-", " ")}`
    );
    items.push({
      title: `${reviewCount} decision${reviewCount === 1 ? "" : "s"} waiting`,
      detail: details.join(" \xB7 "),
      actionLabel: "Open review",
      action: () => view.plugin.openReview()
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
    view.renderHomeRow(
      list,
      item
    );
  }
}

// src/views/home-view.ts
var import_obsidian10 = require("obsidian");
var HomeView = class extends import_obsidian10.ItemView {
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
    const search = button(
      actions,
      "Search modules, units, sources, notes\u2026",
      () => this.plugin.openGlobalSearch(),
      "quiet"
    );
    search.addClass("los-home-search-launcher");
    search.empty();
    icon(search.createSpan(), "search");
    search.createSpan({
      cls: "los-home-search-label",
      text: "Search modules, units, sources, notes\u2026"
    });
    search.createEl("kbd", {
      text: "\u2318K"
    });
    search.setAttribute(
      "aria-label",
      "Search LearningOS"
    );
    button(
      actions,
      "Capture",
      () => this.plugin.openCapture(),
      "warm"
    );
    this.renderContinue(root);
    this.renderToday(root);
    this.renderElsewhere(root);
  }
  /** The one filled action on Home. */
  renderContinue(root) {
    renderContinue(this, root);
  }
  renderToday(root) {
    renderToday(this, root);
  }
  renderElsewhere(root) {
    renderElsewhere(this, root);
  }
  renderHomeRow(parent, item) {
    return renderHomeRow(parent, item);
  }
  nextWorkspaceDate(workspace) {
    return nextWorkspaceDate(this, workspace);
  }
  moduleNextAction(module2) {
    return moduleNextAction(this, module2);
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
function asLibrarySourceFilters(value) {
  const record = typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
  const read = (key) => typeof record[key] === "string" ? record[key] : "";
  return {
    domain: read("domain"),
    topic: read("topic"),
    purpose: read("purpose"),
    form: read("form"),
    use: read("use")
  };
}
function asLibraryCollection(value) {
  return isLibraryCollection(value) ? value : "sources";
}
function asProjectDetailTab(value) {
  return isProjectDetailTab(value) ? value : "overview";
}

// src/features/library/model.ts
var SOURCE_FACETS = [
  ["all", "All"],
  ["local", "Local copy"],
  ["online", "Online"],
  ["in-unit", "Used in a unit"],
  ["topic", "By topic"],
  ["purpose", "By purpose"],
  ["form", "By form"],
  ["use", "By current use"]
];
var VALUED_FACETS = /* @__PURE__ */ new Set([
  "topic",
  "purpose",
  "form",
  "use"
]);
var SOURCE_FILTER_DIMENSIONS = [
  ["domain", "Domain"],
  ["topic", "Topic"],
  ["purpose", "Purpose"],
  ["form", "Form"],
  ["use", "Current use"]
];
var LIBRARY_COLLECTIONS2 = [
  ["sources", "Sources"],
  ["topic-packs", "Curated packs"]
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
  if (!isRecord2(value)) {
    return {
      screen: "home",
      collection: currentCollection,
      groupId: null,
      query: "",
      facet: "all",
      filters: asLibrarySourceFilters(null),
      resourceId: null,
      topicPackId: null,
      catalogueId: null,
      recordType: currentRecordType,
      domain: ""
    };
  }
  const recordId = asString(value.recordId);
  const screen = isLibraryScreen(
    value.screen
  ) ? value.screen : recordId ? "legacy-list" : "home";
  const collection = isLibraryCollection2(
    value.collection
  ) ? value.collection : currentCollection;
  const groupId = asString(value.groupId) ?? asString(value.fromGroupId);
  let filters = asLibrarySourceFilters(value.filters);
  if (collection === "sources" && screen === "group" && groupId && !filters.domain) {
    filters = {
      ...filters,
      domain: groupId
    };
  }
  return {
    screen,
    collection,
    groupId,
    query: asString(value.query) ?? "",
    facet: isSourceFacet(value.facet) ? value.facet : "all",
    filters,
    resourceId: asString(value.resourceId),
    topicPackId: asString(value.topicPackId),
    catalogueId: asString(value.catalogueId),
    recordType: asString(value.recordType) ?? currentRecordType,
    domain: asString(value.domain) ?? ""
  };
}
function readThematicGroup(value) {
  if (!isRecord2(value)) {
    return null;
  }
  const id = asString(value.id);
  if (!id) {
    return null;
  }
  return {
    id,
    title: asString(value.title) ?? id,
    description: asText(value.description) ?? ""
  };
}
function readCollectionEntry(value) {
  if (!isRecord2(value)) {
    return null;
  }
  const sourceId = asString(value.source);
  if (!sourceId) {
    return null;
  }
  return {
    sourceId,
    group: asText(value.group),
    why: asText(value.why)
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
  if (!isRecord2(value)) {
    return null;
  }
  const path = asString(value.path) ?? asString(value.vault_path);
  if (!path) {
    return null;
  }
  return {
    path,
    label: asText(value.label) ?? path
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
  if (!isRecord2(value)) {
    return null;
  }
  const section2 = asText(value.section);
  if (!section2) {
    return null;
  }
  return {
    section: section2,
    note: asText(value.note)
  };
}
function readEvaluation(value) {
  if (!isRecord2(value)) {
    return null;
  }
  const roles = asStrings(value.roles);
  const level = asText(value.level);
  const audience = asStrings(value.audience);
  const prerequisites = asStrings(value.prerequisites);
  const strengths = asStrings(value.strengths);
  const weaknesses = asStrings(value.weaknesses);
  const concepts = asStrings(value.concepts);
  const usefulSections = Array.isArray(
    value.useful_sections
  ) ? value.useful_sections.map(readUsefulSection).filter(
    (section2) => section2 !== null
  ) : [];
  if (!roles.length && !level && !audience.length && !prerequisites.length && !strengths.length && !weaknesses.length && !usefulSections.length) {
    return null;
  }
  return {
    roles,
    level,
    audience,
    prerequisites,
    strengths,
    weaknesses,
    concepts,
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
  if (!isRecord2(value)) {
    return null;
  }
  const id = asString(value.id);
  if (!id) {
    return null;
  }
  return {
    record: value,
    id,
    type: asString(value.type) ?? "record",
    title: asText(value.title) ?? id,
    summary: asText(value.summary) ?? "",
    purpose: asText(value.purpose) ?? "",
    sourceType: asText(value.source_type) ?? "",
    year: asText(value.year) ?? "",
    organization: asText(value.organization) ?? "",
    materialExists: asBoolean(value.material_exists),
    materialPath: asString(value.material_path),
    url: asString(value.url),
    path: asString(value.path),
    role: asText(value.role) ?? "",
    domain: asText(value.domain) ?? "",
    state: asText(value.state) ?? "",
    aliases: asStrings(value.aliases),
    authors: asStrings(value.authors),
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
    if (!isRecord2(candidate)) {
      continue;
    }
    const record = readLibraryRecord(candidate.rec);
    if (record) {
      records.push(record);
    }
  }
  return records;
}

// src/features/library/detail.ts
function renderRecordActions(view, detail, record) {
  const actions = detail.createDiv({
    cls: "los-actions"
  });
  if (record.url) {
    const url = record.url;
    button(
      actions,
      "Open online",
      () => view.plugin.openResource({
        url
      }),
      "info"
    );
  }
  if (record.materialPath) {
    button(
      actions,
      "Open local copy",
      () => view.plugin.openMaterialPath(
        record.materialPath
      ),
      "info"
    );
  }
  if (record.path) {
    button(
      actions,
      "Open authored file",
      () => view.plugin.openAuthoredPath(
        record.path
      ),
      "info"
    );
  }
}
function renderAttachments(view, detail, record) {
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
      () => view.plugin.openAuthoredPath(
        attachment.path
      ),
      "info"
    );
  }
}
function renderRelated(view, detail, record) {
  const related = readRelatedRecords(
    view.plugin.store.related(
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
        () => view.plugin.openRecord(
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
          () => view.plugin.openRecord(
            relatedRecord.record
          )
        );
      }
    }
  }
}
function renderSourceDetail(view, detail, record) {
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
  const memberships = view.shelfIndex().get(
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
          view.plugin.openTopicPackDetail(
            membership.shelf.id
          );
          return;
        }
        view.plugin.openCatalogueDetail(
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
    view.plugin.store.useUnits(
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
      () => view.plugin.openUnit(
        unit.id
      )
    );
  }
  if (record.evaluations.length) {
    const evidence = section(
      detail,
      "What this source is good for"
    );
    for (const evaluation of record.evaluations) {
      const card = evidence.createDiv({
        cls: "los-evidence-card"
      });
      if (evaluation.roles.length || evaluation.level) {
        const purpose = card.createDiv({ cls: "los-chip-row" });
        for (const role of evaluation.roles) badge(purpose, role, "role");
        if (evaluation.level) badge(purpose, evaluation.level, "level");
      }
      for (const [label, values] of [
        ["Strengths", evaluation.strengths],
        ["Weaknesses", evaluation.weaknesses],
        ["Assumes", evaluation.prerequisites],
        ["Written for", evaluation.audience]
      ]) {
        if (!values.length) continue;
        const block = card.createDiv({ cls: "los-row" });
        block.createEl("strong", { text: `${label}: ` });
        block.createSpan({ text: values.join(" \xB7 ") });
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
function renderTechnical(view, detail, record) {
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
    () => view.plugin.copyText(
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

// src/features/library/collections.ts
function renderRecordRow(view, list, record, isPack = false) {
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
      view.selectedElementId = record.id;
      if (isPack) {
        view.plugin.openTopicPackDetail(
          record.id,
          view.groupId,
          view.query
        );
        return;
      }
      view.plugin.openSourceDetail(
        record.id,
        view.groupId,
        view.query,
        view.facet,
        { ...view.filters }
      );
    }
  );
}
function renderSourcePage(view, root) {
  const record = readLibraryRecord(
    view.resourceId ? view.plugin.store.get(
      view.resourceId
    ) : null
  );
  const back = button(
    root,
    "\u2039 Learning Sources",
    () => view.plugin.back(),
    "quiet"
  );
  back.addClass("los-route-back");
  if (!record || record.type !== "source") {
    empty(
      root,
      "Learning source unavailable",
      "The projected source could not be found.",
      "Back",
      () => view.plugin.back()
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
  view.renderRecordActions(
    detail,
    record
  );
  view.renderAttachments(
    detail,
    record
  );
  view.renderSourceDetail(
    detail,
    record
  );
  view.renderRelated(
    detail,
    record
  );
  view.renderTechnical(
    detail,
    record
  );
}
function renderTopicPackPage(view, root) {
  const pack = readLibraryRecord(
    view.topicPackId ? view.plugin.store.get(
      view.topicPackId
    ) : null
  );
  const back = button(
    root,
    "\u2039 Topic Packs",
    () => view.plugin.back(),
    "quiet"
  );
  back.addClass("los-route-back");
  if (!pack || pack.type !== "topic-pack") {
    empty(
      root,
      "Topic Pack unavailable",
      "The projected Topic Pack could not be found.",
      "Back",
      () => view.plugin.back()
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
  view.renderOrderedCollection(
    detail,
    pack,
    "Pack contents"
  );
  view.renderRelated(
    detail,
    pack
  );
  view.renderTechnical(
    detail,
    pack
  );
}
function renderCataloguePage(view, root) {
  const catalogue = readLibraryRecord(
    view.catalogueId ? view.plugin.store.get(
      view.catalogueId
    ) : null
  );
  const back = button(
    root,
    "\u2039 Library",
    () => view.plugin.back(),
    "quiet"
  );
  back.addClass("los-route-back");
  if (!catalogue || catalogue.type !== "collection") {
    empty(
      root,
      "Source catalogue unavailable",
      "The projected catalogue could not be found.",
      "Back",
      () => view.plugin.back()
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
  view.renderOrderedCollection(
    detail,
    catalogue,
    "Catalogue entries"
  );
  view.renderRelated(
    detail,
    catalogue
  );
  view.renderTechnical(
    detail,
    catalogue
  );
}
function renderOrderedCollection(view, detail, collection, title) {
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
        view.plugin.store.get(
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
          view.plugin.openSourceDetail(
            source.id,
            view.groupId
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
function renderLegacyList(view, root) {
  const back = button(
    root,
    "\u2039 Library",
    () => view.plugin.back(),
    "quiet"
  );
  back.addClass("los-route-back");
  const title = `${view.recordType.charAt(0).toUpperCase()}${view.recordType.slice(1)} records`;
  pageHeader(
    root,
    "Compatibility view",
    title,
    view.domain ? `Domain: ${view.domain}` : "Legacy record families remain reachable until their migration gate closes."
  );
  const input = root.createEl(
    "input",
    {
      cls: "los-search los-route-search",
      attr: {
        type: "search",
        placeholder: `Search ${view.recordType} records\u2026`,
        "aria-label": `Search ${view.recordType}`
      }
    }
  );
  input.value = view.query;
  input.addEventListener(
    "input",
    async () => {
      view.query = input.value;
      await view.plugin.router.remember({
        name: "legacy-library-list",
        recordType: view.recordType,
        query: view.query,
        domain: view.domain
      });
      view.render();
    }
  );
  let rows = readLibraryRecords(
    view.plugin.store.search(
      view.query,
      [view.recordType]
    )
  );
  if (view.domain) {
    rows = rows.filter(
      (record) => record.domain === view.domain
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
      view.query ? "No matching records" : "No records",
      view.query ? "Try a shorter title, alias or ID." : `No ${view.recordType} records are projected.`
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
        view.selectedElementId = record.id;
        if (record.path) {
          view.plugin.openAuthoredPath(
            record.path
          );
          return;
        }
        view.plugin.openRecord(
          record.record
        );
      }
    );
  }
}

// src/features/library/home.ts
function renderHome(view, root) {
  if (view.collection === "sources") {
    view.renderSourceBrowser(root);
    return;
  }
  pageHeader(
    root,
    "Library",
    "Choose a thematic group",
    view.collection === "topic-packs" ? "Topic Packs are narrow, purpose-built and manually ordered collections." : "Open a domain to browse its learning sources."
  );
  view.renderCollectionSwitch(root);
  const groups = view.plugin.store.thematicGroups().map(readThematicGroup).filter(
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
    const count = view.collection === "topic-packs" ? view.plugin.store.topicPacksForGroup(group.id).length : view.plugin.store.sourcesForGroup(group.id).length;
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
    const countLabel = view.collection === "topic-packs" ? `pack${count === 1 ? "" : "s"}` : `source${count === 1 ? "" : "s"}`;
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
        view.selectedElementId = group.id;
        view.plugin.openLibraryGroup(
          view.collection,
          group.id
        );
      }
    );
  }
}
function renderCollectionSwitch(view, root) {
  const switcher = root.createDiv({
    cls: "los-collection-switch",
    attr: {
      role: "group",
      "aria-label": "Library collection"
    }
  });
  enableButtonGroupKeyboardNavigation(switcher);
  for (const [
    id,
    label
  ] of LIBRARY_COLLECTIONS2) {
    const control = button(
      switcher,
      label,
      () => view.plugin.openLibraryHome(id),
      view.collection === id ? "cta" : "quiet"
    );
    control.setAttrs({
      "aria-pressed": String(
        view.collection === id
      )
    });
  }
}
function renderGroup(view, root) {
  const group = readThematicGroup(
    view.groupId ? view.plugin.store.get(
      view.groupId
    ) : null
  );
  const back = button(
    root,
    "\u2039 Library",
    () => view.plugin.back(),
    "quiet"
  );
  back.addClass("los-route-back");
  if (!group) {
    empty(
      root,
      "Thematic group unavailable",
      "Return to Library and choose another group.",
      "Back",
      () => view.plugin.back()
    );
    return;
  }
  const isPacks = view.collection === "topic-packs";
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
  input.value = view.query;
  input.addEventListener(
    "input",
    async () => {
      view.query = input.value;
      await view.rememberGroup();
      view.render();
    }
  );
  if (!isPacks) {
    view.renderSourceFacets(toolbar);
    button(
      toolbar,
      "Full-text / OCR search",
      () => view.plugin.openFullTextSearch(
        view.query
      ),
      "quiet"
    );
  }
  const rawRecords = isPacks ? view.plugin.store.topicPacksForGroup(group.id) : view.plugin.store.sourcesForGroup(group.id);
  const all = readLibraryRecords(rawRecords);
  if (!isPacks) {
    view.renderFacetValues(toolbar, all);
  }
  const needle = view.query.trim().toLocaleLowerCase();
  const words2 = needle.split(/\s+/).filter(Boolean);
  const rows = all.filter((record) => {
    if (!isPacks && !view.matchesSourceFacet(
      record.record
    )) {
      return false;
    }
    if (!words2.length) {
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
    return words2.every(
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
        view.query = "";
        view.facet = "all";
        await view.rememberGroup();
        view.render();
      }
    );
    return;
  }
  const list = root.createDiv({
    cls: "los-route-list los-library-route-list"
  });
  for (const record of rows) {
    view.renderRecordRow(
      list,
      record,
      isPacks
    );
  }
}

// src/features/library/filters.ts
function sourceFilterValuesFor(view, source, dimension) {
  if (dimension === "domain") {
    return asStrings(
      source.record.thematic_group_ids
    );
  }
  if (dimension === "topic") {
    return asStrings(
      source.record.topics
    );
  }
  if (dimension === "purpose") {
    const values = /* @__PURE__ */ new Set();
    for (const evaluation of source.evaluations) {
      for (const role of evaluation.roles) {
        values.add(role);
      }
    }
    return [...values];
  }
  if (dimension === "form") {
    return source.sourceType ? [source.sourceType] : [];
  }
  return view.plugin.store.useModules(source.id).map(
    (module2) => asString(module2.id)
  ).filter(
    (id) => id !== null
  );
}
function sourceMatchesFilters(view, source, omit = null) {
  for (const [dimension] of SOURCE_FILTER_DIMENSIONS) {
    if (dimension === omit) {
      continue;
    }
    const selected = view.filters[dimension];
    if (selected && !view.sourceFilterValuesFor(
      source,
      dimension
    ).includes(selected)) {
      return false;
    }
  }
  return true;
}
function sourceFilterTally(view, sources, dimension) {
  const tally = /* @__PURE__ */ new Map();
  for (const source of sources) {
    if (!view.sourceMatchesFilters(source, dimension)) {
      continue;
    }
    for (const value of view.sourceFilterValuesFor(
      source,
      dimension
    )) {
      tally.set(
        value,
        (tally.get(value) ?? 0) + 1
      );
    }
  }
  return tally;
}
function sourceFilterLabel(view, dimension, value) {
  if (dimension === "domain") {
    const group = view.plugin.store.get(value);
    return group ? asString(group.title) ?? value : value;
  }
  if (dimension === "topic") {
    const topic = view.plugin.store.topics().find(
      (row) => asString(row.id) === value
    );
    return topic ? asString(topic.title) ?? value : value;
  }
  if (dimension === "use") {
    const module2 = view.plugin.store.get(value);
    return module2 ? asString(module2.title) ?? value : value;
  }
  return value.replace(/[-_]+/g, " ").replace(
    /\b\w/g,
    (letter) => letter.toLocaleUpperCase()
  );
}
function renderSourceBrowser(view, root) {
  pageHeader(
    root,
    "Library \xB7 Learning sources",
    "Library",
    "Everything you possess, searchable once and browsable through any useful facet."
  );
  view.renderCollectionSwitch(root);
  const all = readLibraryRecords(
    view.plugin.store.sources()
  );
  const browser = root.createDiv({
    cls: "los-library-browser"
  });
  const toolbar = browser.createDiv({
    cls: "los-library-browser-toolbar"
  });
  const input = toolbar.createEl(
    "input",
    {
      cls: "los-search los-route-search los-library-global-search",
      attr: {
        type: "search",
        placeholder: "Search all sources\u2026",
        "aria-label": "Search learning sources"
      }
    }
  );
  input.value = view.query;
  input.addEventListener(
    "input",
    async () => {
      view.query = input.value;
      view.screen = "home";
      view.groupId = null;
      await view.rememberSourceBrowser();
      view.render();
    }
  );
  const fullTextSearch = button(
    toolbar,
    "Full text / OCR",
    () => view.plugin.openFullTextSearch(
      view.query
    ),
    "quiet"
  );
  fullTextSearch.addClass(
    "los-library-ocr-action"
  );
  fullTextSearch.setAttribute(
    "aria-label",
    "Search full text and OCR content"
  );
  browser.createEl("h2", {
    cls: "los-library-filter-heading",
    text: "Browse / filter"
  });
  const facets = browser.createDiv({
    cls: "los-library-peer-facets",
    attr: {
      "aria-label": "Learning Source facets"
    }
  });
  for (const [
    dimension,
    label
  ] of SOURCE_FILTER_DIMENSIONS) {
    const control = facets.createDiv({
      cls: "los-library-peer-facet"
    });
    control.createEl(
      "label",
      {
        cls: "los-library-facet-label",
        text: label
      }
    );
    const select = control.createEl(
      "select",
      {
        cls: "los-library-facet-select",
        attr: {
          "data-facet": dimension,
          "aria-label": `Filter by ${label}`
        }
      }
    );
    const tally = view.sourceFilterTally(
      all,
      dimension
    );
    select.createEl(
      "option",
      {
        text: `All ${label.toLocaleLowerCase()}`,
        attr: {
          value: ""
        }
      }
    );
    const ordered = [...tally.entries()].sort(
      (left, right) => {
        const leftLabel = view.sourceFilterLabel(
          dimension,
          left[0]
        );
        const rightLabel = view.sourceFilterLabel(
          dimension,
          right[0]
        );
        return leftLabel.localeCompare(
          rightLabel
        );
      }
    );
    for (const [
      value,
      count
    ] of ordered) {
      select.createEl(
        "option",
        {
          text: `${view.sourceFilterLabel(
            dimension,
            value
          )} (${count})`,
          attr: {
            value
          }
        }
      );
    }
    select.value = view.filters[dimension];
    select.addEventListener(
      "change",
      () => {
        void view.setSourceFilter(
          dimension,
          select.value
        );
      }
    );
  }
  const active = SOURCE_FILTER_DIMENSIONS.filter(
    ([dimension]) => Boolean(
      view.filters[dimension]
    )
  );
  if (active.length) {
    const activeWrap = browser.createDiv({
      cls: "los-library-active-filters",
      attr: {
        "aria-label": "Active Library filters"
      }
    });
    for (const [
      dimension,
      label
    ] of active) {
      const value = view.filters[dimension];
      const control = button(
        activeWrap,
        `${label}: ${view.sourceFilterLabel(
          dimension,
          value
        )} \xD7`,
        () => void view.setSourceFilter(
          dimension,
          ""
        ),
        "quiet"
      );
      control.addClass(
        "los-library-filter-chip"
      );
    }
    button(
      activeWrap,
      "Clear filters",
      () => void view.clearSourceFilters(),
      "quiet"
    );
  }
  const words2 = view.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const rows = all.filter(
    (source) => view.sourceMatchesFilters(source)
  ).filter(
    (source) => {
      if (!words2.length) {
        return true;
      }
      const hay = [
        source.id,
        source.title,
        source.summary,
        source.purpose,
        source.organization,
        source.sourceType,
        ...source.aliases,
        ...source.authors
      ].filter(Boolean).join(" ").toLocaleLowerCase();
      return words2.every(
        (word) => hay.includes(word)
      );
    }
  ).sort(
    (left, right) => left.title.localeCompare(
      right.title
    )
  );
  browser.createDiv({
    cls: "los-library-result-summary",
    text: `${rows.length} of ${all.length} source${all.length === 1 ? "" : "s"}`
  });
  if (!all.length) {
    empty(
      browser,
      "No Learning Sources",
      "The Core projection currently contains no source records."
    );
    return;
  }
  if (!rows.length) {
    const hasQuery = Boolean(
      view.query.trim()
    );
    const hasFilters = SOURCE_FILTER_DIMENSIONS.some(
      ([dimension]) => Boolean(view.filters[dimension])
    );
    const resetLabel = hasQuery ? hasFilters ? "Clear search and filters" : "Clear search" : "Clear filters";
    const reset = () => {
      if (hasQuery) {
        void view.clearSourceSearchAndFilters();
      } else {
        void view.clearSourceFilters();
      }
    };
    empty(
      browser,
      "No matching sources",
      "No source matches the current search and facet combination.",
      resetLabel,
      reset
    );
    return;
  }
  const list = browser.createDiv({
    cls: "los-route-list los-library-route-list"
  });
  for (const source of rows) {
    view.renderRecordRow(
      list,
      source,
      false
    );
  }
}
function renderSourceFacets(view, parent) {
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
        view.facet = id;
        view.facetValue = null;
        await view.rememberGroup();
        view.render();
      },
      view.facet === id ? "row" : "quiet"
    );
    control.setAttribute(
      "aria-pressed",
      String(view.facet === id)
    );
  }
}
function renderFacetValues(view, parent, sources) {
  if (!VALUED_FACETS.has(view.facet)) {
    return;
  }
  const tally = view.facetTally(sources);
  const wrap = parent.createDiv({
    cls: "los-library-facet-values"
  });
  if (!tally.size) {
    wrap.createDiv({
      cls: "los-muted",
      text: view.facet === "topic" ? "No source in this view carries a topic yet. Topics are added when a source is actually used, never in a bulk pass." : "Nothing to filter by here yet."
    });
    return;
  }
  const clear = button(
    wrap,
    `All (${sources.length})`,
    () => {
      view.facetValue = null;
      view.render();
    },
    view.facetValue ? "quiet" : "row"
  );
  clear.setAttribute(
    "aria-pressed",
    String(!view.facetValue)
  );
  const ordered = [...tally.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );
  for (const [value, count] of ordered) {
    const control = button(
      wrap,
      `${view.facetValueLabel(value)} (${count})`,
      () => {
        view.facetValue = view.facetValue === value ? null : value;
        view.render();
      },
      view.facetValue === value ? "row" : "quiet"
    );
    control.setAttribute(
      "aria-pressed",
      String(view.facetValue === value)
    );
  }
  if (view.facet === "topic") {
    const untopiced = sources.filter(
      (source) => !asStrings(
        source.record.topics
      ).length
    ).length;
    if (untopiced) {
      wrap.createDiv({
        cls: "los-micro",
        text: `${untopiced} of ${sources.length} not yet classified by topic \u2014 expected, not a backlog.`
      });
    }
  }
}

// src/views/library-view.ts
var import_obsidian11 = require("obsidian");
var LibraryView = class extends import_obsidian11.ItemView {
  plugin;
  screen = "home";
  collection = "sources";
  groupId = null;
  query = "";
  facet = "all";
  filters = asLibrarySourceFilters(null);
  /** Selected value within a valued facet (a topic id, a role, a type, a
   *  module id). Null means "show the values to pick from". */
  facetValue = null;
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
    this.filters = parsed.filters;
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
      filters: { ...this.filters },
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
    if (VALUED_FACETS.has(this.facet)) {
      if (!this.facetValue) {
        return true;
      }
      return this.facetValuesFor(source).includes(this.facetValue);
    }
    return true;
  }
  /** Which values of the ACTIVE facet this source participates in.
   *
   *  Deliberately returns a list, not a value: a source belongs to several
   *  topics, serves several purposes and is used by several modules at once.
   *  Collapsing that to one would rebuild the single-placement tree ADR-009
   *  exists to remove. Every field here is read from the projection — the UI
   *  never parses generated/library.md, which is the human view of the same
   *  facts. */
  facetValuesFor(source) {
    if (this.facet === "topic") {
      return asStrings(
        source.record.topics
      );
    }
    if (this.facet === "form") {
      return source.sourceType ? [source.sourceType] : [];
    }
    if (this.facet === "purpose") {
      const roles = /* @__PURE__ */ new Set();
      for (const evaluation of source.evaluations) {
        for (const role of evaluation.roles) {
          roles.add(role);
        }
      }
      return [...roles];
    }
    if (this.facet === "use") {
      return this.plugin.store.useModules(source.id).map(
        (module2) => asString(module2.id)
      ).filter(
        (id) => id !== null
      );
    }
    return [];
  }
  /** Value → source count for the active facet, with overlap preserved. */
  facetTally(sources) {
    const tally = /* @__PURE__ */ new Map();
    for (const source of sources) {
      for (const value of this.facetValuesFor(source)) {
        tally.set(
          value,
          (tally.get(value) ?? 0) + 1
        );
      }
    }
    return tally;
  }
  /** Human label for a facet value. Topics carry titles in the projection;
   *  everything else is already readable. */
  facetValueLabel(value) {
    if (this.facet === "topic") {
      const topic = this.plugin.store.topics().find(
        (row) => asString(row.id) === value
      );
      return topic ? asString(topic.title) ?? value : value;
    }
    if (this.facet === "use") {
      const module2 = this.plugin.store.get(value);
      return module2 ? asString(module2.title) ?? value : value;
    }
    return value;
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
      if (this.collection === "sources") {
        this.renderSourceBrowser(root);
      } else {
        this.renderGroup(root);
      }
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
  sourceFilterValuesFor(source, dimension) {
    return sourceFilterValuesFor(this, source, dimension);
  }
  sourceMatchesFilters(source, omit = null) {
    return sourceMatchesFilters(this, source, omit);
  }
  sourceFilterTally(sources, dimension) {
    return sourceFilterTally(this, sources, dimension);
  }
  sourceFilterLabel(dimension, value) {
    return sourceFilterLabel(this, dimension, value);
  }
  async rememberSourceBrowser() {
    return this.plugin.router.remember({
      name: "library-home",
      collection: "sources",
      query: this.query,
      filters: { ...this.filters }
    });
  }
  async setSourceFilter(dimension, value) {
    this.filters = {
      ...this.filters,
      [dimension]: value
    };
    this.screen = "home";
    this.groupId = null;
    await this.rememberSourceBrowser();
    this.render();
  }
  async clearSourceFilters() {
    this.filters = asLibrarySourceFilters(null);
    this.screen = "home";
    this.groupId = null;
    await this.rememberSourceBrowser();
    this.render();
  }
  async clearSourceSearchAndFilters() {
    this.query = "";
    this.filters = asLibrarySourceFilters(null);
    this.screen = "home";
    this.groupId = null;
    await this.rememberSourceBrowser();
    this.render();
    const search = typeof this.contentEl.querySelector === "function" ? this.contentEl.querySelector(
      ".los-library-global-search"
    ) : null;
    search?.focus();
  }
  renderSourceBrowser(root) {
    renderSourceBrowser(this, root);
  }
  renderHome(root) {
    renderHome(this, root);
  }
  renderCollectionSwitch(root) {
    renderCollectionSwitch(this, root);
  }
  renderGroup(root) {
    renderGroup(this, root);
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
    renderSourceFacets(this, parent);
  }
  /** The values of the active valued facet, with counts.
   *
   *  This is the part that answers "the Library is a sea of ML". A domain
   *  heading says 73; this says Deep Learning 22 · ML Compilation 4 · … and
   *  lets those add to more than 73, because a source really does belong to
   *  several at once. */
  renderFacetValues(parent, sources) {
    renderFacetValues(this, parent, sources);
  }
  renderRecordRow(list, record, isPack = false) {
    renderRecordRow(this, list, record, isPack);
  }
  renderSourcePage(root) {
    renderSourcePage(this, root);
  }
  renderTopicPackPage(root) {
    renderTopicPackPage(this, root);
  }
  renderCataloguePage(root) {
    renderCataloguePage(this, root);
  }
  renderOrderedCollection(detail, collection, title) {
    renderOrderedCollection(this, detail, collection, title);
  }
  renderLegacyList(root) {
    renderLegacyList(this, root);
  }
  renderRecordActions(detail, record) {
    renderRecordActions(this, detail, record);
  }
  renderAttachments(detail, record) {
    renderAttachments(this, detail, record);
  }
  renderRelated(detail, record) {
    renderRelated(this, detail, record);
  }
  renderSourceDetail(detail, record) {
    renderSourceDetail(this, detail, record);
  }
  renderTechnical(detail, record) {
    renderTechnical(this, detail, record);
  }
};

// src/features/module/model.ts
var MODULE_TABS = [
  ["overview", "Overview"],
  ["units", "Units"],
  ["resources", "Resources"],
  ["logistics", "Logistics"]
];
function nonNull(value) {
  return value !== null;
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
  if (!isRecord2(value)) {
    return {
      screen: "groups",
      groupId: null,
      query: "",
      moduleId: null,
      hasComponentId: false,
      hasTab: false
    };
  }
  const moduleId = asString(value.moduleId);
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
  const componentId = !hasComponentId ? void 0 : value.componentId === null ? null : asString(
    value.componentId
  );
  const tab = !hasTab ? void 0 : value.tab === null ? null : isModuleTab(value.tab) ? value.tab : null;
  return {
    screen,
    groupId: asString(value.groupId),
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
  const id = asString(record.id);
  if (!id) {
    return null;
  }
  return {
    id,
    title: asString(record.title) ?? asString(record.label) ?? id,
    description: asText(record.description) ?? ""
  };
}
function readComponents(value) {
  return asRecords(value).map((record) => {
    const id = asString(record.id);
    if (!id) {
      return null;
    }
    return {
      id,
      title: asString(record.short_title) ?? asString(record.title) ?? id
    };
  }).filter(nonNull);
}
function readExamination(value) {
  const examination = isRecord2(value) ? value : {};
  return {
    type: asString(examination.type),
    notes: asText(examination.notes)
  };
}
function readModuleRecord(record, fallbackId = null) {
  if (!record) {
    return null;
  }
  const id = asString(record.id) ?? fallbackId;
  if (!id) {
    return null;
  }
  return {
    record,
    id,
    title: asString(record.title) ?? id,
    kind: asString(record.kind) ?? "Module",
    code: asText(record.code) ?? "",
    semester: asText(record.semester) ?? "",
    status: asString(record.status) ?? "unspecified",
    institution: asText(record.institution) ?? "",
    credits: asText(record.credits),
    examination: readExamination(record.examination),
    components: readComponents(record.components)
  };
}
function normalizeUnitRecord(record) {
  const id = asString(record.id);
  if (!id) {
    return null;
  }
  const title = asString(record.title) ?? id;
  const status = asString(record.status) ?? "unspecified";
  const normalized = {
    ...record,
    id,
    title,
    status,
    scope: asText(record.scope) ?? ""
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
    id: asString(record.id) ?? "",
    title: asString(record.title) ?? asString(record.id) ?? "Workspace",
    status: asString(record.status) ?? "unspecified",
    objective: asText(record.objective) ?? "",
    next_action: asText(record.next_action) ?? "",
    deadline: asText(record.deadline) ?? "",
    standing: record.standing === true,
    module_ids: asStrings(record.module_ids),
    unit_ids: asStrings(record.unit_ids)
  };
}
function readProgress(value) {
  const progress = isRecord2(value) ? value : {};
  return {
    stagesComplete: asCount(
      progress.stages_complete
    ),
    stagesTotal: asCount(
      progress.stages_total
    ),
    unitsTotal: asCount(
      progress.units_total
    )
  };
}
function readDeadlineModules(value) {
  return asRecords(value).map((record) => {
    const moduleId = asString(record.module_id);
    if (!moduleId) {
      return null;
    }
    return {
      moduleId,
      action: asText(record.action)
    };
  }).filter(nonNull);
}
function readAcademicDeadline(record) {
  const startDate = asString(record.start_date) ?? "";
  const endDate = asString(record.end_date) ?? "";
  return {
    record,
    kind: asString(record.kind) ?? "academic-date",
    label: asString(record.label) ?? asString(record.title) ?? "Academic date",
    title: asString(record.title) ?? "",
    startDate,
    endDate,
    time: asText(record.time),
    registrationState: asString(
      record.registration_state
    ) ?? "unregistered",
    directModuleId: asString(record.module_id),
    modules: readDeadlineModules(record.modules)
  };
}
function readSourceEntries(value) {
  return asRecords(value).map((record) => ({
    record,
    role: asString(record.role) ?? "unassigned",
    sourceId: asString(record.source_id),
    why: asText(record.why) ?? "",
    unitRouteCount: Array.isArray(record.unit_routes) ? record.unit_routes.length : 0
  }));
}

// src/features/module/actions.ts
async function selectTab(view, tab) {
  if (!view.moduleId) {
    return;
  }
  view.tab = tab;
  await view.plugin.router.remember({
    name: "module-detail",
    moduleId: view.moduleId,
    componentId: view.componentId,
    tab
  });
  await view.leaf.setViewState({
    type: VIEW_MODULE,
    active: true,
    state: {
      screen: "detail",
      moduleId: view.moduleId,
      componentId: view.componentId,
      tab
    }
  });
}
async function selectComponent(view, componentId) {
  if (!view.moduleId) {
    return;
  }
  view.componentId = componentId;
  const tab = view.tab ?? "units";
  await view.plugin.router.remember({
    name: "module-detail",
    moduleId: view.moduleId,
    componentId,
    tab
  });
  await view.leaf.setViewState({
    type: VIEW_MODULE,
    active: true,
    state: {
      screen: "detail",
      moduleId: view.moduleId,
      componentId,
      tab
    }
  });
}
function renderSources(view, root, module2) {
  const sourceMap = view.plugin.store.sourceMap(
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
      const source = entry.sourceId ? view.plugin.store.get(
        entry.sourceId
      ) : null;
      if (source) {
        chip(
          row,
          source,
          (record) => {
            const id = asString(
              record.id
            );
            if (!id) {
              return;
            }
            return view.plugin.openLibrary(id);
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

// src/features/module/logistics.ts
var EXAMINATION_LABELS = {
  klausur: "Written exam",
  muendlich: "Oral exam",
  portfolio: "Portfolio",
  project: "Project assessment"
};
function words(value) {
  const normalized = value.replaceAll("_", " ").replaceAll("-", " ").trim();
  return normalized ? normalized[0].toLocaleUpperCase() + normalized.slice(1) : "";
}
function semesterLabel(value) {
  const summer = /^sose-(\d{4})$/i.exec(value);
  if (summer) {
    return `Summer semester ${summer[1]}`;
  }
  const winter = /^wise-(\d{4})(?:-(\d{2,4}))?$/i.exec(value);
  if (winter) {
    const end = winter[2] ? `/${winter[2].length === 4 ? winter[2].slice(2) : winter[2]}` : "";
    return `Winter semester ${winter[1]}${end}`;
  }
  return words(value);
}
function examinationLabel(value) {
  return EXAMINATION_LABELS[value.toLocaleLowerCase()] ?? words(value);
}
function statusLabel(value) {
  return words(value);
}
function renderLogistics(view, root, module2) {
  const facts = root.createDiv({
    cls: "los-fact-list"
  });
  const factRows = [
    ["Status", statusLabel(module2.status)],
    ["Institution", module2.institution],
    ["Code", module2.code],
    ["Semester", semesterLabel(module2.semester)],
    ["Credits", module2.credits],
    [
      "Examination",
      module2.examination.type ? examinationLabel(
        module2.examination.type
      ) : null
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
  view.renderAcademicDates(
    root,
    module2
  );
}
function deadlinesFor(view, module2) {
  return view.plugin.store.rows("academic_deadlines").map(
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
function renderAcademicDates(view, root, module2) {
  const rows = view.deadlinesFor(module2);
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
    view.renderDeadlineRows(
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
    view.renderDeadlineRows(
      history,
      module2,
      past
    );
  }
}
function renderDeadlineRows(wrap, module2, rows) {
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

// src/features/module/detail.ts
function renderModuleDetail(view, root) {
  const moduleRecord = view.moduleId ? view.plugin.store.get(
    view.moduleId
  ) : null;
  const module2 = readModuleRecord(
    moduleRecord,
    view.moduleId
  );
  const back = button(
    root,
    "\u2039 Back",
    () => view.plugin.back(),
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
  const tab = view.tab ?? view.defaultTab(module2);
  const header = pageHeader(
    root,
    module2.kind,
    module2.title
  );
  header.createDiv({
    cls: "los-module-facts",
    text: view.headline(module2)
  });
  const tabs = root.createDiv({
    cls: "los-tabs",
    attr: {
      role: "group",
      "aria-label": "Module sections"
    }
  });
  enableButtonGroupKeyboardNavigation(tabs);
  for (const [key, label] of MODULE_TABS) {
    const control = button(
      tabs,
      label,
      () => view.selectTab(key),
      key === tab ? "cta" : "quiet"
    );
    control.setAttrs({
      "aria-pressed": String(key === tab)
    });
  }
  if (tab === "overview") {
    view.renderOverview(
      root,
      module2
    );
  } else if (tab === "units") {
    view.renderUnits(
      root,
      module2
    );
  } else if (tab === "resources") {
    view.renderSources(
      root,
      module2
    );
  } else {
    view.renderLogistics(
      root,
      module2
    );
  }
}
function headline(view, module2) {
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const nextDate = view.deadlinesFor(module2).filter(
    (row) => (row.endDate || row.startDate) >= today
  ).map((row) => row.startDate)[0];
  return [
    semesterLabel(module2.semester),
    module2.credits ? `${module2.credits} LP` : "",
    module2.examination.type ? `${examinationLabel(
      module2.examination.type
    )}${nextDate ? ` ${nextDate}` : ""}` : ""
  ].filter(Boolean).join(" \xB7 ");
}
function renderOverview(view, root, module2) {
  const progress = readProgress(
    view.plugin.store.progress(
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
  const workspaces = view.plugin.store.workspacesForModule(module2.id).map(
    (record) => normalizeWorkspaceRecord(record)
  );
  for (const workspace of workspaces) {
    workspaceCard(
      wrap,
      view.plugin,
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
  const units = view.plugin.store.unitsFor(module2.id).map(
    (record) => normalizeUnitRecord(record)
  ).filter(nonNull);
  const next = units.find(
    (unit) => unit.status === "active"
  ) ?? units[0];
  if (next) {
    button(
      wrap,
      `Continue ${next.title}`,
      () => view.plugin.openUnit(next.id),
      "cta"
    );
  }
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const ahead = view.deadlinesFor(module2).filter(
    (row) => (row.endDate || row.startDate) >= today
  );
  if (ahead.length) {
    view.renderDeadlineRows(
      wrap,
      module2,
      ahead.slice(0, 1)
    );
  }
}
function renderUnits(view, root, module2) {
  if (module2.components.length) {
    const tabs = root.createDiv({
      cls: "los-subtabs",
      attr: {
        role: "group",
        "aria-label": "Module components"
      }
    });
    enableButtonGroupKeyboardNavigation(tabs);
    const allTab = button(
      tabs,
      "All components",
      () => view.selectComponent(null),
      view.componentId ? "quiet" : "row"
    );
    allTab.setAttrs({
      "aria-pressed": String(!view.componentId)
    });
    for (const component of module2.components) {
      const control = button(
        tabs,
        component.title,
        () => view.selectComponent(
          component.id
        ),
        view.componentId === component.id ? "row" : "quiet"
      );
      control.setAttrs({
        "aria-pressed": String(
          view.componentId === component.id
        )
      });
    }
  }
  const units = view.plugin.store.unitsFor(
    module2.id,
    view.componentId
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
  const statusRank = (status) => {
    const index = STATUS_ORDER.indexOf(status);
    return index < 0 ? STATUS_ORDER.length : index;
  };
  const ordered = [...units].sort(
    (a, b) => statusRank(a.status) - statusRank(b.status) || a.title.localeCompare(b.title)
  );
  const heading = root.createDiv({
    cls: "los-section-heading los-module-units-heading"
  });
  heading.createEl("h2", {
    text: "Units"
  });
  heading.createSpan({
    text: `${ordered.length} unit${ordered.length === 1 ? "" : "s"} \xB7 ${ordered.filter(
      (unit) => unit.status === "active"
    ).length} in progress`
  });
  const list = root.createDiv({
    cls: "los-record-list los-module-unit-list"
  });
  for (const unit of ordered) {
    const map = view.plugin.store.mapForUnit(
      unit.id
    );
    const stages = map ? asRecords(map.stages) : [];
    const complete = stages.filter(
      (stage) => stage.status === "complete"
    ).length;
    const currentStageId = map ? asString(map.current_stage) : null;
    const currentStage = currentStageId ? stages.find(
      (stage) => stage.id === currentStageId
    ) : null;
    const row = list.createEl("button", {
      cls: "los-record-row is-clickable",
      attr: {
        type: "button",
        "aria-label": `Open unit: ${unit.title}`
      }
    });
    const copy = row.createDiv({
      cls: "los-record-copy"
    });
    copy.createEl("strong", {
      text: unit.title
    });
    const meta = [
      unit.status.replaceAll("-", " "),
      map ? `${complete} of ${stages.length} stages` : "No study map yet",
      currentStage ? `Current \xB7 ${asString(currentStage.title) ?? currentStageId}` : ""
    ].filter(Boolean).join(" \xB7 ");
    copy.createDiv({
      cls: "los-record-meta",
      text: meta
    });
    if (map) {
      row.createSpan({
        cls: "los-record-action",
        text: "Open \u2192"
      });
    } else {
      badge(
        row,
        "No map",
        "needs-map"
      );
    }
    row.addEventListener(
      "click",
      () => {
        view.selectedElementId = unit.id;
        return view.plugin.openUnit(unit.id);
      }
    );
  }
}

// src/features/module/navigation.ts
function renderGroups(view, root) {
  const semester = view.plugin.store.currentSemester();
  const modules = view.plugin.store.currentSemesterModules().map(
    (record) => readModuleRecord(record)
  ).filter(nonNull);
  pageHeader(
    root,
    typeof semester?.title === "string" ? `Modules \xB7 ${semester.title}` : "Modules",
    "Modules",
    "The modules you are taking this semester. Your complete source collection lives in Library."
  );
  if (!modules.length) {
    empty(
      root,
      "No current-semester modules",
      "The Core projection does not currently identify any enrolled academic modules for this semester."
    );
    return;
  }
  const summary = root.createDiv({
    cls: "los-semester-summary"
  });
  summary.createEl("strong", {
    text: typeof semester?.title === "string" ? semester.title : "Current semester"
  });
  summary.createSpan({
    text: `${modules.length} enrolled module${modules.length === 1 ? "" : "s"}`
  });
  const list = root.createDiv({
    cls: "los-route-list los-semester-module-list"
  });
  for (const module2 of modules) {
    const progress = readProgress(
      view.plugin.store.progress(module2.id)
    );
    const row = list.createEl(
      "button",
      {
        cls: "los-route-row los-semester-module-row is-clickable",
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
    const facts = [
      module2.code,
      progress.stagesTotal ? `${progress.stagesComplete} of ${progress.stagesTotal} stages` : `${progress.unitsTotal} unit${progress.unitsTotal === 1 ? "" : "s"}`
    ].filter(Boolean);
    copy.createDiv({
      cls: "los-route-meta",
      text: facts.join(" \xB7 ")
    });
    row.createSpan({
      cls: "los-route-open",
      text: "Open \u2192"
    });
    row.addEventListener(
      "click",
      () => {
        view.selectedElementId = module2.id;
        return view.plugin.openModuleDetail(module2.id);
      }
    );
  }
}
function renderGroupList(view, root) {
  const groupRecord = view.groupId ? view.plugin.store.get(
    view.groupId
  ) : null;
  const group = readThematicGroup2(groupRecord);
  const back = button(
    root,
    "\u2039 Modules",
    () => view.plugin.back(),
    "quiet"
  );
  back.addClass("los-route-back");
  if (!group) {
    empty(
      root,
      "Thematic group unavailable",
      "Return to Modules and choose another group.",
      "Back",
      () => view.plugin.back()
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
  search.value = view.query;
  search.addEventListener(
    "input",
    async () => {
      view.query = search.value;
      await view.plugin.router.remember({
        name: "module-list",
        groupId: group.id,
        query: view.query
      });
      view.render();
    }
  );
  const all = view.plugin.store.modulesForGroup(group.id).map(
    (record) => readModuleRecord(record)
  ).filter(nonNull);
  const needle = view.query.trim().toLocaleLowerCase();
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
      `Nothing in ${group.title} matches \u201C${view.query.trim()}\u201D.`,
      "Clear search",
      async () => {
        view.query = "";
        await view.plugin.router.remember({
          name: "module-list",
          groupId: group.id,
          query: ""
        });
        view.render();
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
        view.selectedElementId = module2.id;
        return view.plugin.openModuleDetail(module2.id);
      }
    );
  }
}

// src/views/module-view.ts
var import_obsidian12 = require("obsidian");
var ModuleView = class extends import_obsidian12.ItemView {
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
    renderGroups(this, root);
  }
  renderGroupList(root) {
    renderGroupList(this, root);
  }
  renderModuleDetail(root) {
    renderModuleDetail(this, root);
  }
  /** One line instead of six labelled facts; the rest is in Logistics. */
  headline(module2) {
    return headline(this, module2);
  }
  renderOverview(root, module2) {
    renderOverview(this, root, module2);
  }
  renderUnits(root, module2) {
    renderUnits(this, root, module2);
  }
  renderLogistics(root, module2) {
    renderLogistics(this, root, module2);
  }
  deadlinesFor(module2) {
    return deadlinesFor(this, module2);
  }
  renderAcademicDates(root, module2) {
    renderAcademicDates(this, root, module2);
  }
  renderDeadlineRows(wrap, module2, rows) {
    renderDeadlineRows(wrap, module2, rows);
  }
  async selectTab(tab) {
    await selectTab(this, tab);
  }
  async selectComponent(componentId) {
    await selectComponent(this, componentId);
  }
  renderSources(root, module2) {
    renderSources(this, root, module2);
  }
};

// src/views/nav-view.ts
var import_obsidian13 = require("obsidian");
var NavView = class extends import_obsidian13.ItemView {
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
    enableButtonGroupKeyboardNavigation(primary, "vertical");
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
    enableButtonGroupKeyboardNavigation(secondary, "vertical");
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
      "briefcase-business",
      "Job",
      "job",
      () => this.plugin.openBoundary("program-job-boundary")
    );
    this.nav(secondary, "activity", "Diagnostics", "diagnostics", () => this.plugin.openDiagnostics());
    this.nav(secondary, "refresh-cw", "Rebuild projection", "rebuild", () => this.plugin.generate());
  }
};

// src/views/program-view.ts
var import_obsidian14 = require("obsidian");
var COORDINATION_HEADINGS = [
  "Priorities",
  "Commitments",
  "Dependencies",
  "Deferrals"
];
function readProgramSemesters(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const semesters = [];
  for (const candidate of value) {
    if (!isRecord2(candidate) || typeof candidate.title !== "string" || typeof candidate.status !== "string") {
      continue;
    }
    semesters.push({
      title: candidate.title,
      status: candidate.status
    });
  }
  return semesters;
}
var ProgramView = class extends import_obsidian14.ItemView {
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
    if (this.programId === "inbox") {
      return "LearningOS \xB7 Capture";
    }
    if (this.programId === "queue-needs-map") {
      return "LearningOS \xB7 Planning";
    }
    const program = this.programId ? this.plugin.store.get(this.programId) : null;
    const title = typeof program?.title === "string" ? program.title : "Learn";
    return `LearningOS \xB7 ${title}`;
  }
  async setState(state = {}) {
    if (typeof state.programId === "string") {
      this.programId = state.programId;
    }
    this.render();
    this.leaf.updateHeader?.();
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
    this.leaf.updateHeader?.();
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
    pageHeader(
      root,
      "Learn",
      "Learning horizon",
      "Current commitments, long-running skills, and the degree structure they belong to."
    );
    const tabs = root.createDiv({
      cls: "los-tabs los-program-tabs",
      attr: {
        role: "group",
        "aria-label": "Learning areas"
      }
    });
    enableButtonGroupKeyboardNavigation(tabs);
    for (const [areaId, title] of LEARN_AREAS) {
      const active = areaId === program.id;
      const tab = button(
        tabs,
        title,
        () => this.plugin.openLearn(areaId),
        active ? "cta" : "quiet"
      );
      tab.setAttrs({
        "aria-pressed": String(active)
      });
    }
    if (typeof program.description === "string" && program.description) {
      root.createEl("p", {
        cls: "los-muted",
        text: program.description
      });
    }
    const semesters = readProgramSemesters(
      program.semesters
    );
    const currentSemester = semesters.find(
      (semester) => semester.status === "current"
    );
    const modules = program.id ? this.plugin.store.modulesFor(program.id) : [];
    const context = root.createDiv({
      cls: "los-learning-context"
    });
    context.createEl("h2", {
      text: currentSemester?.title ?? (program.id === "program-skills" ? "Long-running tracks" : projectedExcerpt(
        program.title,
        80
      ) || "Learning")
    });
    context.createSpan({
      text: `${modules.length} commitment${modules.length === 1 ? "" : "s"} \xB7 ${currentSemester?.status ?? projectedExcerpt(program.status, 40)}`
    });
    const list = root.createDiv({
      cls: "los-learning-list"
    });
    if (!modules.length) {
      if (program.id === "program-thesis-projects") {
        empty(
          root,
          "Projects have their own operating space",
          "The horizon keeps the commitment visible; project structure, decisions, and files stay together in Projects.",
          "Open Projects",
          () => this.plugin.openProjects()
        );
      } else {
        empty(
          root,
          "No commitments in this area yet",
          "Nothing is hidden."
        );
      }
    }
    for (const module2 of modules) {
      const row = list.createDiv({
        cls: "los-learning-row"
      });
      const copy = row.createDiv({
        cls: "los-learning-copy"
      });
      const title = button(
        copy,
        projectedExcerpt(
          module2.title,
          180
        ) || projectedExcerpt(module2.id, 180),
        () => this.plugin.openModule(
          projectedExcerpt(module2.id, 180)
        ),
        "row"
      );
      title.addClass("los-learning-title");
      const examination = isRecord2(
        module2.examination
      ) ? projectedExcerpt(
        module2.examination.type,
        80
      ) : "";
      const meta = [
        projectedExcerpt(module2.status, 60),
        module2.credits ? `${projectedExcerpt(module2.credits, 20)} LP` : "",
        examination
      ].filter(Boolean).join(" \xB7 ");
      row.createDiv({
        cls: "los-learning-meta los-micro",
        text: meta
      });
    }
    if (Boolean(program.semester_bound)) {
      const semesters2 = disclosure(root, "Semesters");
      for (const semester of readProgramSemesters(program.semesters)) {
        const row = semesters2.createDiv({
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
    const sections = isRecord2(coordination?.sections) ? coordination.sections : {};
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
      (row) => !row.id || !this.plugin.store.mapForUnit(row.id)
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
          new import_obsidian14.Notice(
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
    const fileCaptureButton = button(
      filePanel,
      "Capture selected file",
      () => {
        const localPath = localFilePath(picker.files?.[0]);
        if (!localPath) {
          new import_obsidian14.Notice(
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
    const syncFileCapture = () => {
      fileCaptureButton.disabled = !picker.files?.length;
      fileCaptureButton.setAttribute(
        "aria-disabled",
        String(fileCaptureButton.disabled)
      );
    };
    picker.addEventListener(
      "change",
      syncFileCapture
    );
    syncFileCapture();
  }
  async capture(action, clear = null) {
    if (this.plugin.gateway.isBusy) {
      new import_obsidian14.Notice(
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
      new import_obsidian14.Notice(
        "Captured to the LearningOS inbox."
      );
      this.render();
    } catch (error) {
      new import_obsidian14.Notice(errorMessage(error));
    }
  }
};

// src/features/project/files.ts
function renderFiles(view, root, project) {
  const wrap = section(
    root,
    "Files",
    "Project-owned references; canonical content remains in plain files."
  );
  const files = asRecords(project.files);
  if (!files.length) {
    empty(
      wrap,
      "No files linked",
      "Project files can be added through a declared core capability."
    );
    return;
  }
  for (const file of files) {
    const path = asString(file.path);
    const label = asString(file.label) ?? path ?? asString(file.id) ?? "Untitled file";
    const kind = asString(file.kind) ?? "file";
    const row = wrap.createDiv({
      cls: "los-record-row los-project-file"
    });
    const copy = row.createDiv({
      cls: "los-record-copy los-project-link-copy"
    });
    copy.createEl("strong", {
      text: label
    });
    copy.createDiv({
      cls: "los-record-meta",
      text: path ? `${kind} \xB7 ${path}` : kind
    });
    if (path) {
      button(
        row,
        "Open",
        () => view.plugin.openAuthoredPath(
          path
        ),
        "tertiary"
      );
    }
  }
}
function renderDecisions(root, project) {
  const wrap = section(
    root,
    "Decisions",
    "Open questions and durable decisions, without manufacturing a completion score."
  );
  const decisions = asRecords(project.decisions);
  if (!decisions.length) {
    empty(
      wrap,
      "No decisions recorded",
      "Decisions appear here when the project records them."
    );
    return;
  }
  for (const decision of decisions) {
    const status = asString(decision.status) ?? "open";
    const row = wrap.createDiv({
      cls: "los-record-row los-project-decision"
    });
    const copy = row.createDiv({
      cls: "los-record-copy"
    });
    copy.createEl("strong", {
      text: asLabel(decision)
    });
    copy.createDiv({
      cls: "los-record-summary",
      text: asText(decision.summary) ?? ""
    });
    badge(
      row,
      status,
      status
    );
  }
}

// src/features/project/model.ts
var PROJECT_TABS = [
  ["structure", "Structure"],
  ["decisions", "Decisions"],
  ["linked-materials", "Materials"],
  ["files", "Files"],
  ["overview", "Logistics"]
];
function isProjectTab(value) {
  return PROJECT_TABS.some(
    ([tab]) => tab === value
  );
}
function readProjectViewState(value) {
  if (!isRecord2(value)) {
    return {};
  }
  const screen = value.screen === "detail" ? "detail" : value.screen === "list" ? "list" : void 0;
  const projectId = value.projectId === null ? null : asString(value.projectId) ?? void 0;
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
  const boundaries = isRecord2(value) ? value : {};
  return {
    confidentiality: asString(
      boundaries.confidentiality
    ) ?? "unspecified",
    externalCodeAccess: asString(
      boundaries.external_code_access
    ) ?? "unspecified",
    notes: asString(boundaries.notes)
  };
}
function readProjectStructure(value) {
  const structure = isRecord2(value) ? value : {};
  return {
    kind: asString(structure.kind) ?? "none",
    nodes: asRecords(structure.nodes)
  };
}
function readProjectRelationship(value) {
  const id = asString(value.id);
  const toId = asString(value.to_id);
  if (!id || !toId) {
    return null;
  }
  return {
    id,
    toId,
    toType: asString(value.to_type) ?? "record",
    relationType: asString(value.relation_type) ?? "linked",
    reason: asString(value.reason) ?? "No rationale was projected.",
    contribution: asString(value.contribution) ?? "No contribution was projected.",
    path: asString(value.path)
  };
}

// src/features/project/structure.ts
function renderBoundaryBanner(root, project) {
  const boundaries = readProjectBoundaries(
    project.boundaries
  );
  const banner = root.createDiv({
    cls: "los-project-boundary"
  });
  banner.createDiv({
    cls: "los-kicker",
    text: "Boundary"
  });
  banner.createEl("p", {
    text: [
      `confidentiality: ${boundaries.confidentiality}`,
      `external code access: ${boundaries.externalCodeAccess}`,
      boundaries.notes
    ].filter(Boolean).join(" \xB7 ")
  });
}
function renderStructure(root, project) {
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
    cls: "los-record-list los-project-structure"
  });
  const renderNode = (parent, row, depth = 0) => {
    const item = parent.createDiv({
      cls: `los-record-row los-project-structure-row los-project-node-depth-${Math.min(depth, 4)}`
    });
    const copy = item.createDiv({
      cls: "los-record-copy"
    });
    copy.createEl("strong", {
      text: asLabel(row)
    });
    const status = asString(row.status);
    if (status) {
      copy.createDiv({
        cls: "los-record-meta",
        text: `${asString(row.kind) ?? "step"} \xB7 ${status}`
      });
    }
    const summary = asString(row.summary);
    if (summary) {
      copy.createDiv({
        cls: "los-record-summary",
        text: summary
      });
    }
    const children = asRecords(row.children);
    if (children.length) {
      for (const child of children) {
        renderNode(
          parent,
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

// src/features/project/detail.ts
function renderDetail(view, root) {
  const project = view.projectId ? view.plugin.store.get(
    view.projectId
  ) : null;
  const projectId = project ? asString(project.id) : null;
  if (!project || asString(project.type) !== "project" || !projectId) {
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
      () => view.plugin.openProjects()
    );
    return;
  }
  const title = asLabel(project);
  const status = asString(project.status) ?? "planned";
  const projectType = asString(project.project_type) ?? "project";
  const back = button(
    root,
    "\u2039 Back",
    () => view.plugin.back(),
    "quiet"
  );
  back.addClass("los-route-back");
  pageHeader(
    root,
    `Projects \xB7 ${projectType} \xB7 ${status}`,
    title,
    projectedExcerpt(
      project.objective,
      190
    )
  );
  const tabs = root.createDiv({
    cls: "los-project-tabs",
    attr: {
      role: "group",
      "aria-label": "Project sections"
    }
  });
  enableButtonGroupKeyboardNavigation(tabs);
  for (const [tabId, label] of PROJECT_TABS) {
    const tab = button(
      tabs,
      label,
      () => view.plugin.openProject(
        projectId,
        tabId
      ),
      "tertiary"
    );
    const active = view.tab === tabId;
    tab.toggleClass(
      "is-active",
      active
    );
    tab.setAttrs({
      "aria-pressed": String(active)
    });
  }
  const links = root.createDiv({
    cls: "los-project-chips"
  });
  const linkedIds = [
    ...asStrings(project.linked_module_ids),
    ...asStrings(project.unit_ids)
  ];
  for (const id of linkedIds) {
    const record = view.plugin.store.get(id);
    if (!record) continue;
    chip(
      links,
      record,
      (target) => view.plugin.openRecord(target)
    );
  }
  const body = root.createDiv({
    cls: "los-project-body"
  });
  switch (view.tab) {
    case "structure":
      view.renderStructure(
        body,
        project
      );
      view.renderDecisions(
        body,
        project
      );
      view.renderBoundaryBanner(
        body,
        project
      );
      break;
    case "linked-materials":
      view.renderLinked(
        body,
        project
      );
      break;
    case "files":
      view.renderFiles(
        body,
        project
      );
      break;
    case "decisions":
      view.renderDecisions(
        body,
        project
      );
      break;
    default:
      view.renderOverview(
        body,
        project
      );
  }
}
function renderOverview2(view, root, project) {
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
      asString(
        project.project_type
      ) ?? "Project"
    ],
    [
      "Status",
      asString(project.status) ?? "planned"
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
  const unitRows = asStrings(project.unit_ids).map(
    (id) => view.plugin.store.get(id)
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
    const unitId = asString(unit.id);
    if (!unitId) {
      continue;
    }
    button(
      units,
      asLabel(unit),
      () => view.plugin.openUnit(unitId),
      "row"
    );
  }
}

// src/features/project/list.ts
function renderList(view, root) {
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
  input.value = view.query;
  const results = root.createDiv({
    cls: "los-project-list"
  });
  const draw = () => {
    results.empty();
    const words2 = input.value.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const rows = view.plugin.store.projects().filter(
      (project) => {
        const id = asString(project.id);
        if (!id) {
          return false;
        }
        const hay = [
          id,
          asString(project.title),
          asString(project.objective),
          asString(
            project.project_type
          )
        ].filter(
          (value) => Boolean(value)
        ).join(" ").toLocaleLowerCase();
        return words2.every(
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
      const projectId = asString(project.id);
      if (!projectId) {
        continue;
      }
      const title = asLabel(project);
      const status = asString(project.status) ?? "planned";
      const projectType = asString(
        project.project_type
      ) ?? "project";
      const row = results.createEl("button", {
        cls: "los-record-row los-project-row is-clickable",
        attr: {
          type: "button",
          "aria-label": `Open project: ${title}`
        }
      });
      row.setAttr(
        "data-record-id",
        projectId
      );
      const copy = row.createDiv({
        cls: "los-record-copy"
      });
      copy.createEl("strong", {
        text: title
      });
      copy.createDiv({
        cls: "los-record-summary",
        text: projectedExcerpt(
          project.objective,
          170
        )
      });
      copy.createDiv({
        cls: "los-record-meta",
        text: `${projectType} \xB7 ${status} \xB7 ${asListLength(
          project.linked_module_ids
        )} linked modules`
      });
      row.createSpan({
        cls: "los-record-action",
        text: "Open \u2192"
      });
      row.addEventListener(
        "click",
        () => {
          view.selectedElementId = projectId;
          void view.plugin.openProject(
            projectId,
            "structure"
          );
        }
      );
    }
  };
  input.addEventListener(
    "input",
    () => {
      view.query = input.value;
      view.plugin.router.remember({
        name: "project-list",
        query: view.query
      });
      draw();
    }
  );
  draw();
}

// src/views/project-view.ts
var import_obsidian15 = require("obsidian");
var ProjectLinkReasonModal = class extends import_obsidian15.Modal {
  plugin;
  relationship;
  restoreAccessibility = null;
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
      "Why this is linked",
      "",
      "los-linked-reason-heading"
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
    const close = button(
      actions,
      "Close",
      () => this.close(),
      "quiet"
    );
    this.restoreAccessibility = makeModalAccessible(root, {
      close: () => this.close(),
      hostClass: "los-modal--linked-reason",
      labelledBy: "los-linked-reason-heading"
    });
    close.focus();
  }
  onClose() {
    this.plugin.router.clearOverlay();
    this.restoreAccessibility?.();
    this.restoreAccessibility = null;
    this.contentEl.empty();
  }
};
var ProjectView = class extends import_obsidian15.ItemView {
  plugin;
  screen = "list";
  projectId = null;
  tab = "structure";
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
    this.tab = state.tab ?? "structure";
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
    renderList(this, root);
  }
  renderDetail(root) {
    renderDetail(this, root);
  }
  renderOverview(root, project) {
    renderOverview2(this, root, project);
  }
  renderBoundaryBanner(root, project) {
    renderBoundaryBanner(root, project);
  }
  renderStructure(root, project) {
    renderStructure(root, project);
  }
  renderLinked(root, project) {
    const wrap = section(
      root,
      "Linked Materials",
      "Links retain a core-authored reason rather than implying ownership."
    );
    const projectId = asString(project.id);
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
        cls: "los-record-row los-project-link"
      });
      const copy = row.createDiv({
        cls: "los-record-copy los-project-link-copy"
      });
      copy.createEl("strong", {
        text: target ? asLabel(target) : relationship.toId
      });
      copy.createDiv({
        cls: "los-record-meta",
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
    renderFiles(this, root, project);
  }
  renderDecisions(root, project) {
    renderDecisions(root, project);
  }
};

// src/views/review-view.ts
var import_obsidian16 = require("obsidian");
var fs = __toESM(require("node:fs"));
var nodePath = __toESM(require("node:path"));
var REVIEW_FILTERS = [
  ["all", "All"],
  ["inbox", "Inbox"],
  ["shelving", "Shelving"],
  ["planning", "Planning"],
  ["garden", "Garden"]
];
var ReviewView = class extends import_obsidian16.ItemView {
  plugin;
  filter = "all";
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
    root.addClass(
      "los-root",
      "los-review-view"
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
    const items = this.plugin.store.reviewItems();
    const header = pageHeader(
      root,
      "Review \xB7 Decisions",
      "Review",
      "Everything here is waiting on a decision from you."
    );
    badge(
      header,
      `${items.length} decision${items.length === 1 ? "" : "s"} waiting`,
      "role"
    ).addClass("los-review-count-badge");
    filterTabs(
      root,
      "Review categories",
      REVIEW_FILTERS,
      this.filter,
      (value) => {
        this.filter = value;
        this.render();
      },
      (value) => value === "all" ? items.length : items.filter(
        (item) => item.category === value
      ).length
    );
    root.createDiv({
      cls: "los-micro los-review-queue-note",
      text: "Only items that require a decision appear here. Garden stays quiet until Core marks a seed review-due."
    });
    const visible = this.filter === "all" ? items : items.filter(
      (item) => item.category === this.filter
    );
    const list = root.createDiv({
      cls: "los-review-list"
    });
    if (!visible.length) {
      empty(
        list,
        items.length ? "Nothing in this category" : "Nothing waiting",
        items.length ? "Choose another Review filter." : "Core has not projected any current Review decisions."
      );
    } else {
      for (const item of visible) {
        this.decision(list, item);
      }
    }
  }
  decision(parent, item) {
    const id = typeof item.id === "string" ? item.id : "review-item";
    const category = typeof item.category === "string" ? item.category : "review";
    const title = typeof item.title === "string" ? item.title : id;
    const context = typeof item.context === "string" ? item.context : "";
    const reason = typeof item.reason === "string" ? item.reason : "";
    const row = parent.createDiv({
      cls: "los-review-decision-row",
      attr: {
        "data-review-id": id
      }
    });
    const copy = row.createDiv({
      cls: "los-review-decision-copy"
    });
    const top = copy.createDiv({
      cls: "los-review-decision-top"
    });
    badge(
      top,
      category.replace(/-/g, " "),
      "role"
    );
    top.createEl("h2", {
      text: title
    });
    if (context) {
      copy.createDiv({
        cls: "los-micro los-review-context",
        text: context
      });
    }
    if (reason) {
      copy.createEl("p", {
        cls: "los-review-reason",
        text: reason
      });
    }
    const action = this.actionFor(item);
    if (action) {
      button(
        row,
        action[0],
        action[1],
        "quiet"
      );
    } else {
      row.createSpan({
        cls: "los-micro los-review-clear",
        text: "No supported action"
      });
    }
    return row;
  }
  actionFor(item) {
    const target = isRecord2(item.target) ? item.target : null;
    if (!target) {
      return null;
    }
    const kind = typeof target.kind === "string" ? target.kind : "";
    if (kind === "study-map" && typeof target.unit_id === "string") {
      return [
        "Review proposal",
        () => this.plugin.openShelving(
          target.unit_id
        )
      ];
    }
    if (kind === "inbox-item" && typeof target.path === "string") {
      return [
        "Route",
        () => this.plugin.openVaultPath(
          target.path
        )
      ];
    }
    if (kind === "unit" && typeof target.id === "string") {
      return [
        "Open unit",
        () => this.plugin.openUnit(
          target.id
        )
      ];
    }
    if (kind === "garden-note" || kind === "garden-seed") {
      return [
        "Review seed",
        () => this.plugin.openGarden()
      ];
    }
    return null;
  }
};
var DiagnosticsView = class extends import_obsidian16.ItemView {
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
      manifest_contract_version: MANIFEST_CONTRACT_VERSION,
      source_revision: "unavailable",
      source_dirty: null,
      source_committed_at: "unavailable",
      source_fingerprint: "unavailable",
      bundle_sha256: "unavailable",
      node_version: "unavailable"
    };
    try {
      const app = this.app;
      const base = app.vault.adapter.getBasePath();
      const pluginInfo = this.plugin.manifest;
      const directory = pluginInfo?.dir || nodePath.join(
        ".obsidian",
        "plugins",
        pluginInfo?.id || "learningos-ui"
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
      if (!isRecord2(parsed)) {
        return fallback;
      }
      return {
        ui_version: typeof parsed.ui_version === "string" ? parsed.ui_version : fallback.ui_version,
        manifest_contract_version: typeof parsed.manifest_contract_version === "number" ? parsed.manifest_contract_version : fallback.manifest_contract_version,
        source_revision: typeof parsed.source_revision === "string" ? parsed.source_revision : fallback.source_revision,
        // A missing flag stays null: an older build-info predates the field,
        // and reading that absence as "clean" is the exact false reassurance
        // this row exists to remove.
        source_dirty: typeof parsed.source_dirty === "boolean" ? parsed.source_dirty : fallback.source_dirty,
        source_committed_at: typeof parsed.source_committed_at === "string" ? parsed.source_committed_at : fallback.source_committed_at,
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
      ["UI expects contract", MANIFEST_CONTRACT_VERSION],
      ["UI version", this.plugin.uiVersion()],
      ["UI source revision", build.source_revision],
      // The projection states its own staleness; before this the interface
      // stated nothing about its own, and a vault quietly ran a build 32
      // commits behind its source for a day.
      ["UI built from", build.source_dirty === null ? `${build.source_committed_at} (working tree unknown)` : build.source_dirty ? `${build.source_committed_at} + uncommitted sources` : build.source_committed_at],
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
    button(actions, "Validate and rebuild", () => this.plugin.generate(), "success");
    button(actions, "Test the interpreter", () => this.testInterpreter(), "info");
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
Failed: ${errorMessage(error)}
Tried: ${resolved.attempted.join(", ")}`;
    }
    this.render();
  }
};

// src/views/shelving-view.ts
var import_obsidian17 = require("obsidian");
function readShelvingProposal(value) {
  if (!isRecord2(value) || value.state !== "proposed" || !Array.isArray(value.items)) {
    return null;
  }
  const items = [];
  for (const candidate of value.items) {
    if (!isRecord2(candidate) || typeof candidate.id !== "string" || typeof candidate.title !== "string") {
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
var ShelvingView = class extends import_obsidian17.ItemView {
  plugin;
  unitId = null;
  proposal = null;
  selected = /* @__PURE__ */ new Set();
  selectionScope = null;
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
  selectionKey(unitId, map, proposal) {
    const mapId = typeof map?.id === "string" ? map.id : "";
    const revision = map?.revision == null ? "" : String(map.revision);
    const proposalIds = proposal?.items.map((item) => item.id).join("") ?? "";
    return JSON.stringify([
      unitId,
      mapId,
      revision,
      proposalIds
    ]);
  }
  syncSelection(unitId, map, proposal) {
    const scope = this.selectionKey(
      unitId,
      map,
      proposal
    );
    if (scope === this.selectionScope) {
      return;
    }
    this.selectionScope = scope;
    this.selected.clear();
    if (!proposal) {
      return;
    }
    for (const item of proposal.items) {
      if (item.selected !== false) {
        this.selected.add(item.id);
      }
    }
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
    if (!unit.id) {
      empty(root, "Unit unavailable", "The projection returned a unit without an identity.");
      return;
    }
    const map = this.plugin.store.mapForUnit(unit.id);
    const proposal = this.proposal ?? readShelvingProposal(map?.shelving);
    if (!proposal?.items?.length) {
      this.syncSelection(
        unit.id,
        map,
        null
      );
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
    this.syncSelection(
      unit.id,
      map,
      proposal
    );
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
    button(actions, "Approve selected changes", () => this.apply(), "success");
    button(actions, "Ask AI to review proposal", () => this.plugin.askAiScoped(
      `Review these shelving proposal IDs: ${[...this.selected].join(", ")}. Do not apply changes.`,
      { moduleId: unit.module_id, unitId: unit.id }
    ), "warm");
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
      new import_obsidian17.Notice("Choose a unit before preparing shelving.");
      return;
    }
    try {
      await this.plugin.mutate(
        () => this.plugin.gateway.prepareShelving(unitId)
      );
      await this.loadProposal();
      this.render();
    } catch (error) {
      new import_obsidian17.Notice(errorMessage(error));
    }
  }
  async apply() {
    const unitId = this.unitId;
    if (!unitId) {
      new import_obsidian17.Notice("Choose a unit before applying shelving.");
      return;
    }
    if (!this.selected.size) {
      new import_obsidian17.Notice("Select at least one proposal.");
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
      this.selectionScope = null;
      this.render();
    } catch (error) {
      new import_obsidian17.Notice(errorMessage(error));
    }
  }
};

// src/features/unit/model.ts
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
function errorMessage3(error) {
  return error instanceof Error ? error.message : String(error);
}
function readUnitViewState(value) {
  if (!isRecord2(value)) {
    return {
      hasStageId: false
    };
  }
  const hasStageId = Object.prototype.hasOwnProperty.call(
    value,
    "stageId"
  );
  const unitId = asString(value.unitId) ?? void 0;
  const stageId = !hasStageId ? void 0 : value.stageId === null ? null : asString(value.stageId);
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
  const id = asString(record.id) ?? fallbackId;
  const moduleId = asString(record.module_id);
  if (!id || !moduleId) {
    return null;
  }
  const knowledgeMap = isRecord2(
    record.knowledge_map
  ) ? record.knowledge_map : null;
  const knowledgeNodes = asRecords(
    knowledgeMap?.nodes
  ).map((node) => {
    const nodeId = asString(node.id);
    const title = asString(node.title);
    const summary = asText(node.summary);
    if (!nodeId || !title || !summary) {
      return null;
    }
    return {
      id: nodeId,
      title,
      summary,
      buildsOn: asStrings(
        node.builds_on
      )
    };
  }).filter(
    (node) => node !== null
  );
  return {
    record,
    id,
    moduleId,
    componentId: asString(record.component_id),
    kind: asString(record.kind) ?? "unit",
    title: asString(record.title) ?? id,
    scope: asText(record.scope) ?? "",
    knowledgeSummary: asText(
      knowledgeMap?.summary
    ) ?? "",
    knowledgeNodes
  };
}
function readMaterialOptions(value, unitId, selectionsValue) {
  const options = [];
  const selectionKeys = new Set(
    asRecords(selectionsValue).flatMap((selection) => {
      const sourceId = asString(selection.source_id);
      const locator = asText(selection.locator);
      return sourceId && locator ? [`${sourceId}\0${locator}`] : [];
    })
  );
  for (const entry of asRecords(value)) {
    for (const route of asRecords(entry.unit_routes)) {
      if (asString(route.unit_id) !== unitId) {
        continue;
      }
      const title = asString(route.title);
      const format = asString(route.format);
      const angle = asText(route.angle);
      if (!title || !format || !angle) {
        continue;
      }
      const sourceId = asString(route.source_id) ?? asString(entry.source_id);
      const locator = asText(route.locator);
      options.push({
        record: route,
        title,
        format,
        angle,
        covers: asStrings(route.covers),
        depth: asString(route.depth) ?? "course-aligned",
        scope: asString(route.scope) ?? "complementary",
        locator,
        sourceId,
        canOpen: Boolean(
          asString(
            route.material_path
          ) ?? asString(route.url) ?? asString(
            route.vault_path
          )
        ),
        canChoose: Boolean(sourceId && locator),
        selected: Boolean(
          sourceId && locator && selectionKeys.has(
            `${sourceId}\0${locator}`
          )
        )
      });
    }
  }
  return options;
}
function readResource(record) {
  const label = asString(record.label) ?? asString(record.title) ?? asString(record.source_id) ?? "Resource";
  return {
    record,
    id: asString(record.id),
    kind: asString(record.kind) ?? "read",
    label,
    locator: asText(record.locator),
    sourceId: asString(record.source_id),
    scopeTriage: asString(record.scope_triage),
    canOpen: Boolean(
      asString(record.material_path) ?? asString(record.url) ?? asString(record.vault_path)
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
  if (!isRecord2(value)) {
    return null;
  }
  const path = asString(value.path) ?? asString(value.vault_path);
  if (!path) {
    return null;
  }
  return {
    path,
    label: asString(value.label) ?? path
  };
}
function readStage(record) {
  const id = asString(record.id);
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
    title: asString(record.title) ?? id,
    status: asString(record.status) ?? "active",
    scopeTriage: asText(record.scope_triage) ?? "",
    objective: asText(record.objective),
    estimateMinutes: asText(record.estimate_minutes),
    examCritical: record.exam_critical === true,
    resources: asRecords(
      record.resources
    ).map(readResource),
    doneWhen: asStrings(
      record.done_when
    ).filter(
      (criterion) => Boolean(criterion.trim())
    ),
    attachments,
    sourceFeedback: asRecords(
      record.source_feedback
    )
  };
}
function readStudyMap(record) {
  const stages = asRecords(
    record.stages
  ).map(readStage).filter(
    (stage) => stage !== null
  );
  return {
    record,
    currentStageId: asString(
      record.current_stage
    ),
    stages,
    detours: asRecords(record.detours)
  };
}
function readArtifacts(value) {
  if (!isRecord2(value)) {
    return {
      named: [],
      other: []
    };
  }
  const named = [];
  for (const [key] of ARTIFACT_LABELS) {
    const id = asString(value[key]);
    if (id) {
      named.push([key, id]);
    }
  }
  return {
    named,
    other: asStrings(value.other)
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

// src/features/unit/context.ts
function renderStageContext(view, center, unit, studyMap, stage) {
  const detours = studyMap.detours.filter(
    (row) => asString(
      row.spawned_by_stage
    ) === stage.id && asString(
      row.status
    ) !== "resolved" && asString(
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
      () => view.plugin.openAuthoredPath(
        attachment.path
      ),
      "quiet"
    );
  }
  for (const detour of detours) {
    const detourId = asString(detour.id);
    if (!detourId) {
      continue;
    }
    const title = asString(detour.title) ?? "Prerequisite detour";
    const classification = asString(
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
      () => view.mutate(
        () => view.plugin.gateway.resolveDetour(
          unit.id,
          detourId,
          "Resolved from the unit workspace."
        )
      ),
      "quiet"
    );
  }
  for (const feedback of stage.sourceFeedback) {
    const sourceId = asString(
      feedback.source_id
    ) ?? "Unknown source";
    const value = asText(
      feedback.feedback
    ) ?? "Feedback recorded";
    detail.createDiv({
      cls: "los-row",
      text: `${sourceId} \xB7 ${value}`
    });
  }
}
function renderArtifacts(view, root, unit) {
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
    const record = view.plugin.store.get(id) ?? fallbackRecord(id);
    chip(
      card,
      record,
      (selected) => view.plugin.openRecord(
        selected
      )
    );
  }
  for (const id of artifacts.other) {
    count += 1;
    const record = view.plugin.store.get(id) ?? fallbackRecord(id);
    chip(
      wrap,
      record,
      (selected) => view.plugin.openRecord(
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

// src/features/unit/stage.ts
function renderStage2(view, layout, unit, studyMap, stage) {
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
  if (stage.doneWhen.length) {
    const done = section(
      center,
      "Done when"
    );
    const marks = view.plugin.getDoneWhen(
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
          view.plugin.setDoneWhen(
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
  renderStageResources(center, stage.resources, {
    emptyDetail: "Use the unit scope and ask AI for a proposal.",
    sourceRecord: (sourceId) => view.plugin.store.get(sourceId),
    openSource: (source) => {
      const sourceId = asString(source.id);
      return sourceId ? view.plugin.openLibrary(sourceId) : void 0;
    },
    openSourceResource: (source) => view.plugin.openResource(source),
    openResource: (resource) => view.plugin.openResource(resource.record),
    // ADR-009: when an id exists, feedback lands on the exact resource;
    // otherwise it deliberately describes the whole source.
    rateResource: (sourceId, resourceId, verdict) => view.mutate(
      () => view.plugin.gateway.feedback(
        unit.id,
        stage.id,
        sourceId,
        verdict,
        resourceId
      )
    )
  });
  view.renderStageContext(
    center,
    unit,
    studyMap,
    stage
  );
  view.renderActionBar(
    center,
    unit,
    stage
  );
}
function renderActionBar(view, root, unit, stage) {
  const bar = root.createDiv({
    cls: "los-unit-actionbar"
  });
  button(
    bar,
    "Mark complete",
    () => view.mutate(
      () => view.plugin.gateway.progress(
        unit.id,
        stage.id,
        "complete"
      ),
      () => view.plugin.clearDoneWhen(
        unit.id,
        stage.id
      )
    ),
    "success"
  );
  const menuItems = [
    stage.status !== "active" && [
      "Revisit stage",
      () => view.mutate(
        () => view.plugin.gateway.progress(
          unit.id,
          stage.id,
          "revisit"
        )
      )
    ],
    [
      "Pause unit",
      () => view.mutate(
        () => view.plugin.gateway.progress(
          unit.id,
          stage.id,
          "paused"
        )
      )
    ],
    [
      "Skip stage",
      () => view.mutate(
        () => view.plugin.gateway.progress(
          unit.id,
          stage.id,
          "skipped"
        )
      )
    ],
    [
      "Report prerequisite gap",
      () => view.mutate(
        () => view.plugin.gateway.detour(
          unit.id,
          stage.id,
          "Prerequisite gap",
          "required-now"
        )
      )
    ],
    [
      "Prepare shelving",
      () => view.plugin.openShelving(
        unit.id
      )
    ],
    view.plugin.settings.showAiRecommendation && [
      "Ask AI with stage context",
      () => {
        const project = view.plugin.store.projectForUnit(
          unit.record
        );
        const projectId = asString(project?.id) ?? void 0;
        return view.plugin.askAiScoped(
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
      () => view.plugin.reviewSessionEnd()
    ]
  ];
  overflowMenu(
    bar,
    menuItems,
    "More unit actions"
  );
}

// src/features/unit/materials.ts
var import_obsidian18 = require("obsidian");
var FORMAT_ORDER = [
  "course-material",
  "exercise",
  "book",
  "video",
  "course",
  "website",
  "documentation",
  "code",
  "paper"
];
var FORMAT_LABELS = {
  "course-material": "Course material",
  exercise: "Exercises and practice",
  book: "Books",
  video: "Videos",
  course: "Courses",
  website: "Websites",
  documentation: "Documentation",
  code: "Code and notebooks",
  paper: "Papers"
};
function optionIcon(format) {
  if (format === "video") return "play";
  if (format === "exercise") return "pencil-line";
  if (format === "code") return "code-2";
  if (format === "website" || format === "course" || format === "documentation") return "globe-2";
  return "book-open";
}
function renderMaterialOverview(view, root, unit, options) {
  const map = section(
    root,
    "Lecture knowledge map",
    unit.knowledgeSummary
  );
  const titleById = new Map(
    unit.knowledgeNodes.map(
      (node) => [node.id, node.title]
    )
  );
  const nodes = map.createDiv({
    cls: "los-knowledge-grid"
  });
  for (const node of unit.knowledgeNodes) {
    const card = nodes.createDiv({
      cls: "los-knowledge-node"
    });
    card.createEl("h3", {
      text: node.title
    });
    card.createEl("p", {
      text: node.summary
    });
    const dependencies = node.buildsOn.map((id) => titleById.get(id)).filter(
      (title) => Boolean(title)
    );
    if (dependencies.length) {
      card.createDiv({
        cls: "los-micro",
        text: `Builds on: ${dependencies.join(", ")}`
      });
    }
  }
  const materials = section(
    root,
    "Choose your learning material",
    "This is a complete menu, not a sequence. Pick the explanation angle and depth that fit your current need."
  );
  const grouped = /* @__PURE__ */ new Map();
  for (const option of options) {
    const group = grouped.get(option.format);
    if (group) group.push(option);
    else grouped.set(option.format, [option]);
  }
  const formats = [
    ...FORMAT_ORDER.filter(
      (format) => grouped.has(format)
    ),
    ...[...grouped.keys()].filter(
      (format) => !FORMAT_ORDER.includes(
        format
      )
    )
  ];
  for (const format of formats) {
    const group = materials.createDiv({
      cls: "los-material-group"
    });
    const entries = grouped.get(format) ?? [];
    const heading = group.createDiv({
      cls: "los-material-group-heading"
    });
    heading.createEl("h3", {
      text: FORMAT_LABELS[format] ?? format.replaceAll("-", " ")
    });
    heading.createSpan({
      cls: "los-micro",
      text: `${entries.length} option${entries.length === 1 ? "" : "s"}`
    });
    for (const option of entries) {
      const row = group.createDiv({
        cls: "los-material-option"
      });
      icon(
        row.createSpan({
          cls: "los-material-icon"
        }),
        optionIcon(option.format)
      );
      const copy = row.createDiv({
        cls: "los-material-copy"
      });
      copy.createEl("h4", {
        text: option.title
      });
      copy.createEl("p", {
        text: option.angle
      });
      if (option.locator) {
        copy.createDiv({
          cls: "los-micro",
          text: option.locator
        });
      }
      const metadata = copy.createDiv({
        cls: "los-material-metadata"
      });
      badge(
        metadata,
        option.depth.replaceAll("-", " "),
        "role"
      );
      badge(
        metadata,
        option.scope.replaceAll("-", " "),
        option.scope === "current" ? "status" : "role"
      );
      for (const knowledgeId of option.covers) {
        const label = titleById.get(knowledgeId);
        if (label) {
          metadata.createSpan({
            cls: "los-knowledge-chip",
            text: label
          });
        }
      }
      if (option.sourceId) {
        const source = view.plugin.store.get(
          option.sourceId
        );
        if (source) {
          chip(
            copy,
            source,
            (record) => {
              const id = asString(record.id);
              return id ? view.plugin.openLibrary(id) : void 0;
            }
          );
        }
      }
      if (option.canOpen || option.canChoose) {
        const actions = row.createDiv({
          cls: "los-actions los-material-actions"
        });
        if (option.canChoose && option.sourceId && option.locator) {
          const choice = button(
            actions,
            option.selected ? "Remove choice" : "Choose",
            () => {
              void view.plugin.mutate(
                () => view.plugin.gateway.sourceSelection(
                  unit.id,
                  option.sourceId ?? "",
                  option.locator ?? "",
                  option.angle,
                  !option.selected
                )
              ).then(
                () => new import_obsidian18.Notice(
                  option.selected ? "Material choice removed." : "Material chosen for this lecture."
                )
              ).catch(
                (error) => new import_obsidian18.Notice(
                  error instanceof Error ? error.message : String(error)
                )
              );
            },
            "choice"
          );
          choice.setAttr(
            "aria-pressed",
            option.selected ? "true" : "false"
          );
        }
        if (option.canOpen) {
          button(
            actions,
            "Open",
            () => view.plugin.openResource(
              option.record
            ),
            "info"
          );
        }
      }
    }
  }
}

// src/features/unit/shell.ts
function render(view) {
  const root = view.contentEl;
  root.empty();
  root.addClass(
    "los-root",
    "los-unit-view"
  );
  const routeUnitId = view.unitId;
  const projectedUnit = routeUnitId ? view.plugin.store.get(
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
  const module2 = view.plugin.store.get(
    unit.moduleId
  );
  const project = view.plugin.store.projectForUnit(
    unit.record
  );
  const ownerLabel = asLabel(
    project,
    asLabel(
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
      () => view.plugin.back(),
      "quiet"
    );
  } else {
    button(
      headerActions,
      "Back to module",
      () => view.plugin.openModule(
        unit.moduleId
      ),
      "quiet"
    );
  }
  const sourceMap = view.plugin.store.sourceMap(
    unit.moduleId
  );
  const materialOptions = readMaterialOptions(
    sourceMap?.sources,
    unit.id,
    unit.record.source_selections
  );
  const hasMaterialOverview = unit.knowledgeNodes.length > 0 && materialOptions.length > 0;
  if (hasMaterialOverview) {
    renderMaterialOverview(
      view,
      root,
      unit,
      materialOptions
    );
  }
  const projectedStudyMap = view.plugin.store.mapForUnit(
    unit.id
  );
  if (!projectedStudyMap) {
    const missing = section(
      root,
      hasMaterialOverview ? "Personal study path (optional)" : "Study map needed"
    );
    const projectId = asString(project?.id) ?? void 0;
    const componentId = unit.componentId ?? void 0;
    empty(
      missing,
      hasMaterialOverview ? "No personal path selected" : "This unit has no current study script",
      hasMaterialOverview ? "The material menu above is complete. Create a path only when you want progress tracking for choices you make." : "AI may propose a scoped map; the core imports it only after review.",
      hasMaterialOverview ? "Build optional path with AI" : "Create map with AI",
      () => view.plugin.askAiScoped(
        hasMaterialOverview ? "Propose an optional personal study-map JSON document using only materials I choose from this unit material overview. Do not replace or summarize the overview, and do not write files; include exact source actions and done-when criteria." : "Propose one study-map JSON document for this unit. Do not write files; include exact source actions and done-when criteria.",
        {
          moduleId: unit.moduleId,
          projectId,
          unitId: unit.id,
          componentId
        }
      )
    );
    view.renderArtifacts(
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
    view.renderArtifacts(
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
  if (!view.stageId || !stageIds.has(view.stageId)) {
    view.stageId = studyMap.currentStageId && stageIds.has(
      studyMap.currentStageId
    ) ? studyMap.currentStageId : firstStage.id;
    view.plugin.setSelectedStage(
      unit.id,
      view.stageId
    );
  }
  const stage = studyMap.stages.find(
    (candidate) => candidate.id === view.stageId
  ) ?? firstStage;
  const layout = root.createDiv({
    cls: "los-unit-layout"
  });
  view.renderRail(
    layout,
    unit,
    studyMap,
    stage
  );
  view.renderStage(
    layout,
    unit,
    studyMap,
    stage
  );
  const more = disclosure(
    root,
    "Unit artifacts and evidence",
    "los-unit-extras"
  );
  view.renderArtifacts(
    more,
    unit
  );
}
function renderRail(view, layout, unit, studyMap, current) {
  const rail = layout.createDiv({
    cls: "los-stage-rail"
  });
  rail.createEl("h2", {
    text: "Stages"
  });
  const currentIndex = studyMap.stages.findIndex(
    (stage) => stage.id === current.id
  );
  for (const [index, stage] of studyMap.stages.entries()) {
    const selected = stage.id === current.id;
    const row = rail.createEl(
      "button",
      {
        cls: `los-stage-row los-s-${stage.status} ${selected ? "is-selected" : index > currentIndex ? "is-upcoming" : "is-before"} is-clickable`,
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
    const marker = stage.status === "complete" ? "Complete" : stage.status === "skipped" ? "Skipped" : index === currentIndex ? `Done when \xB7 ${stage.doneWhen.length} criteria` : index > currentIndex ? "Not started" : "";
    if (marker) {
      copy.createSpan({
        cls: "los-micro",
        text: marker
      });
    }
    row.addEventListener(
      "click",
      () => {
        void view.selectStage(
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
    () => view.plugin.openUnitNote(
      unit.record,
      studyMap.record
    ),
    "quiet"
  );
  add.addClass(
    "los-add-unit-note"
  );
  const draft = view.plugin.getUnitNoteDraft(
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

// src/views/unit-view.ts
var import_obsidian19 = require("obsidian");
var UnitView = class extends import_obsidian19.ItemView {
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
    render(this);
  }
  renderRail(layout, unit, studyMap, current) {
    renderRail(this, layout, unit, studyMap, current);
  }
  renderStage(layout, unit, studyMap, stage) {
    renderStage2(this, layout, unit, studyMap, stage);
  }
  /**
   * One primary action and one menu. The primary is filled; nothing else on
   * this screen may be.
   */
  renderActionBar(root, unit, stage) {
    renderActionBar(this, root, unit, stage);
  }
  renderStageContext(center, unit, studyMap, stage) {
    renderStageContext(this, center, unit, studyMap, stage);
  }
  renderArtifacts(root, unit) {
    renderArtifacts(this, root, unit);
  }
  /**
   * Every write goes through the plugin-wide queue, so two clicks in two views
   * can no longer race the same `--expected-snapshot`.
   */
  async mutate(action, onConfirmed = null) {
    if (this.plugin.gateway.isBusy) {
      new import_obsidian19.Notice(
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
      new import_obsidian19.Notice(
        errorMessage3(error)
      );
    }
  }
  async selectStage(stageId) {
    const unitId = this.unitId;
    if (!unitId) {
      new import_obsidian19.Notice(
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

// src/app/registration.ts
var APPLICATION_VIEW_TYPES = [
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
];
function detachLegacyViews(plugin) {
  for (const type of LEGACY_VIEW_TYPES) plugin.app.workspace.detachLeavesOfType(type);
}
function registerApplication(plugin) {
  detachLegacyViews(plugin);
  plugin.registerView(VIEW_HOME, (leaf) => new HomeView(leaf, plugin));
  plugin.registerView(VIEW_NAV, (leaf) => new NavView(leaf, plugin));
  plugin.registerView(VIEW_PROGRAM, (leaf) => new ProgramView(leaf, plugin));
  plugin.registerView(VIEW_MODULE, (leaf) => new ModuleView(leaf, plugin));
  plugin.registerView(VIEW_PROJECT, (leaf) => new ProjectView(leaf, plugin));
  plugin.registerView(VIEW_UNIT, (leaf) => new UnitView(leaf, plugin));
  plugin.registerView(VIEW_LIBRARY, (leaf) => new LibraryView(leaf, plugin));
  plugin.registerView(VIEW_ATLAS, (leaf) => new AtlasView(leaf, plugin));
  plugin.registerView(VIEW_SHELVING, (leaf) => new ShelvingView(leaf, plugin));
  plugin.registerView(VIEW_BOUNDARY, (leaf) => new BoundaryView(leaf, plugin));
  plugin.registerView(VIEW_REVIEW, (leaf) => new ReviewView(leaf, plugin));
  plugin.registerView(VIEW_GARDEN, (leaf) => new GardenView(leaf, plugin));
  plugin.registerView(VIEW_DIAGNOSTICS, (leaf) => new DiagnosticsView(leaf, plugin));
  plugin.addSettingTab(new LearningOSSettingsTab(plugin.app, plugin));
  plugin.addRibbonIcon("route", "Open LearningOS", () => plugin.openHome());
  plugin.addCommand({ id: "open-home", name: "Open Home", callback: () => plugin.openHome() });
  plugin.addCommand({ id: "open-current-stage", name: "Open current stage", callback: () => plugin.openResume() });
  plugin.addCommand({ id: "open-modules", name: "Open Modules", callback: () => plugin.openModules() });
  plugin.addCommand({ id: "open-projects", name: "Open Projects", callback: () => plugin.openProjects() });
  plugin.addCommand({ id: "open-library", name: "Open Library", callback: () => plugin.openLibrary() });
  plugin.addCommand({ id: "open-global-search", name: "Search LearningOS", callback: () => plugin.openGlobalSearch() });
  plugin.addCommand({ id: "open-atlas", name: "Open Domain atlas", callback: () => plugin.openAtlas() });
  plugin.addCommand({ id: "open-garden", name: "Open Garden", callback: () => plugin.openGarden() });
  plugin.addCommand({ id: "open-review", name: "Open Review", callback: () => plugin.openReview() });
  plugin.addCommand({ id: "rebuild-projection", name: "Validate and rebuild projection", callback: () => plugin.generate() });
  plugin.addCommand({ id: "end-learning-session", name: "End learning session safely", callback: () => plugin.reviewSessionEnd() });
  plugin.app.workspace.onLayoutReady(async () => {
    detachLegacyViews(plugin);
    await plugin.router.openNavigator();
    plugin.app.workspace.leftSplit?.setSize?.(280);
    if (plugin.settings.collapseSidebars) plugin.app.workspace.rightSplit?.collapse();
    if (plugin.settings.openHomeOnStartup) await plugin.router.restore();
  });
}
function detachApplication(plugin) {
  for (const type of APPLICATION_VIEW_TYPES) plugin.app.workspace.detachLeavesOfType(type);
}

// src/app/router.ts
function asLegacyState(value) {
  return value && typeof value === "object" ? value : {};
}
function asText2(value, fallback = "") {
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
    const type = asText2(input.type);
    const state = asLegacyState(input.state);
    if (type === VIEW_PROGRAM) {
      return state.programId === "inbox" ? { name: "capture" } : { name: "learn", programId: asText2(state.programId, LEARN_AREAS[0][0]) };
    }
    if (type === VIEW_MODULE) {
      if (state.screen === "groups") return { name: "module-groups" };
      if (state.screen === "list") return { name: "module-list", groupId: asText2(state.groupId), query: asText2(state.query) };
      return {
        name: "module-detail",
        moduleId: asText2(state.moduleId),
        componentId: asNullableText(state.componentId),
        tab: asNullableText(state.tab)
      };
    }
    if (type === VIEW_UNIT) return { name: "unit", unitId: asText2(state.unitId), stageId: asNullableText(state.stageId) };
    if (type === VIEW_PROJECT) return state.projectId ? { name: "project-detail", projectId: asText2(state.projectId), tab: asProjectDetailTab(state.tab) } : { name: "project-list", query: asText2(state.query) };
    if (type === VIEW_LIBRARY) return this.libraryRouteFromState(state);
    if (type === VIEW_ATLAS) return { name: "atlas", domain: asNullableText(state.domain) };
    if (type === VIEW_SHELVING) return { name: "shelving", unitId: asNullableText(state.unitId) };
    if (type === VIEW_BOUNDARY) return { name: "boundary", boundaryId: asText2(state.boundaryId) };
    if (type === VIEW_REVIEW) return { name: "review" };
    if (type === VIEW_GARDEN) return { name: "garden" };
    if (type === VIEW_DIAGNOSTICS) return { name: "diagnostics" };
    return { name: "home" };
  }
  libraryRouteFromState(state = {}) {
    if (state.screen === "group") return {
      name: "library-group",
      collection: asLibraryCollection(state.collection),
      groupId: asText2(state.groupId),
      query: asText2(state.query),
      facet: asText2(state.facet, "all"),
      filters: asLibrarySourceFilters(state.filters)
    };
    if (state.screen === "source-detail") return {
      name: "source-detail",
      resourceId: asText2(state.resourceId),
      fromGroupId: asNullableText(state.fromGroupId),
      query: asText2(state.query),
      facet: asText2(state.facet, "all"),
      filters: asLibrarySourceFilters(state.filters)
    };
    if (state.screen === "topic-pack-detail") return {
      name: "topic-pack-detail",
      topicPackId: asText2(state.topicPackId),
      fromGroupId: asNullableText(state.fromGroupId),
      query: asText2(state.query)
    };
    if (state.screen === "catalogue-detail") return { name: "catalogue-detail", catalogueId: asText2(state.catalogueId) };
    const recordType = asText2(state.recordType);
    if (state.screen === "legacy-list") return {
      name: "legacy-library-list",
      recordType: recordType || "note",
      query: asText2(state.query),
      domain: asText2(state.domain)
    };
    const recordId = asText2(state.recordId);
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
      return { name: "legacy-library-list", recordType, query: asText2(state.query), domain: asText2(state.domain) };
    }
    return {
      name: "library-home",
      collection: recordType === "topic-pack" ? "topic-packs" : "sources",
      query: asText2(state.query),
      filters: asLibrarySourceFilters(state.filters)
    };
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
        return { type: VIEW_GARDEN, state: {}, nav: "garden" };
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
          state: { screen: "detail", projectId: route.projectId, tab: route.tab || "structure" },
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
          state: {
            screen: "home",
            collection: route.collection || "sources",
            query: route.query || "",
            filters: route.filters || asLibrarySourceFilters(null)
          },
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
            facet: route.facet || "all",
            filters: route.filters || asLibrarySourceFilters(null)
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
            facet: route.facet || "all",
            filters: route.filters || asLibrarySourceFilters(null)
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
var import_obsidian20 = require("obsidian");
var UnitNoteModal = class extends import_obsidian20.Modal {
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
  restoreAccessibility = null;
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
    const unitId = this.unit.id;
    if (!unitId) {
      empty(root, "Unit unavailable", "The projection returned a unit without an identity.");
      return;
    }
    const stages = asRecords(this.studyMap?.stages);
    const draft = this.plugin.getUnitNoteDraft(unitId, stages);
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
      "Attach one note after the stages you worked through. It belongs to the unit, not to one selected stage.",
      "los-unit-note-heading"
    );
    this.restoreAccessibility = makeModalAccessible(root, {
      close: () => this.close(),
      hostClass: "los-modal--unit-note",
      initialFocus: () => this.editor ?? null,
      labelledBy: "los-unit-note-heading"
    });
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
    const actions = root.createDiv({ cls: "los-actions los-unit-note-actions" });
    button(actions, "Cancel", () => this.close(), "quiet");
    const saveButton = button(actions, "Save note", () => this.save(), "cta");
    const persist = () => {
      this.plugin.setUnitNoteDraft(unitId, this.titleInput.value, this.editor.value);
      const hasNote = Boolean(this.editor.value.trim());
      status.setText(hasNote ? "Draft kept locally until the core confirms the save." : "Write a note to enable saving.");
      status.toggleClass("is-dirty", hasNote);
      saveButton.disabled = !hasNote;
      saveButton.setAttribute("aria-disabled", String(!hasNote));
    };
    this.titleInput.addEventListener("input", persist);
    this.editor.addEventListener("input", persist);
    persist();
  }
  unrecordedCompletedStages(stages) {
    const already = new Set(
      asRecords(this.unit.note_sections).flatMap(
        (section2) => Array.isArray(section2.stage_ids) ? section2.stage_ids.filter(
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
      new import_obsidian20.Notice("Write a note before saving.");
      this.editor?.focus();
      return;
    }
    if (this.plugin.gateway.isBusy) {
      new import_obsidian20.Notice("A LearningOS write is already running.");
      return;
    }
    const unitId = this.unit.id;
    if (!unitId) {
      new import_obsidian20.Notice("The unit identity is unavailable. Reload LearningOS and try again.");
      return;
    }
    const filePaths = this.files.map((file) => localFilePath(file)).filter((value) => Boolean(value));
    if (filePaths.length !== this.files.length) {
      new import_obsidian20.Notice("One selected attachment has no readable local path. Remove it and choose the file again.");
      return;
    }
    try {
      await this.plugin.mutate(() => this.plugin.gateway.saveUnitNote(unitId, {
        title: this.titleInput?.value || "",
        text,
        stageIds: this.referencedStageIds,
        filePaths
      }));
      this.plugin.clearUnitNoteDraft(unitId, this.recoveredStageIds);
      new import_obsidian20.Notice("Learning-session note saved.");
      this.close();
    } catch (error) {
      new import_obsidian20.Notice(errorMessage(error));
    }
  }
  onClose() {
    this.restoreAccessibility?.();
    this.restoreAccessibility = null;
    this.contentEl.empty();
  }
};

// src/application/draft-store.ts
function emptyUiDrafts() {
  return {
    stages: {},
    unitNotes: {},
    selectedStages: {},
    inbox: { title: "", text: "" },
    doneWhen: {}
  };
}
function normalizeUiDrafts(value) {
  const empty2 = emptyUiDrafts();
  return {
    stages: value?.stages ?? empty2.stages,
    unitNotes: value?.unitNotes ?? empty2.unitNotes,
    selectedStages: value?.selectedStages ?? empty2.selectedStages,
    inbox: value?.inbox ?? empty2.inbox,
    doneWhen: value?.doneWhen ?? empty2.doneWhen
  };
}
var DraftStore = class {
  constructor(settings, persist) {
    this.settings = settings;
    this.persist = persist;
  }
  saveTimer = null;
  scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.persist();
    }, 250);
  }
  dispose() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
  }
  stageKey(unitId, stageId) {
    return `${unitId}::${stageId}`;
  }
  getStage(unitId, stageId, savedText = "") {
    const entry = this.settings.uiDrafts.stages[this.stageKey(unitId, stageId)];
    return { text: entry?.text ?? savedText, dirty: entry != null && entry.text !== savedText };
  }
  setStage(unitId, stageId, text, savedText = "") {
    const key = this.stageKey(unitId, stageId);
    if (text === savedText) delete this.settings.uiDrafts.stages[key];
    else this.settings.uiDrafts.stages[key] = { text };
    this.scheduleSave();
  }
  clearStage(unitId, stageId) {
    delete this.settings.uiDrafts.stages[this.stageKey(unitId, stageId)];
    this.scheduleSave();
  }
  getUnitNote(unitId, stages = []) {
    const saved = this.settings.uiDrafts.unitNotes[unitId];
    const recovered = [];
    for (const stage of stages) {
      const stageId = asString(stage.id);
      if (!stageId) continue;
      const entry = this.settings.uiDrafts.stages[this.stageKey(unitId, stageId)];
      if (entry?.text?.trim()) recovered.push({ id: stageId, title: asLabel(stage, stageId), text: entry.text });
    }
    const recoveredText = recovered.map((row) => `### ${row.title}

${row.text.trim()}`).join("\n\n");
    return {
      title: saved?.title || (recovered.length ? "Recovered stage drafts" : ""),
      text: [String(saved?.text || "").trim(), recoveredText].filter(Boolean).join("\n\n"),
      recoveredStageIds: recovered.map((row) => row.id)
    };
  }
  setUnitNote(unitId, title, text) {
    if (!title.trim() && !text.trim()) delete this.settings.uiDrafts.unitNotes[unitId];
    else this.settings.uiDrafts.unitNotes[unitId] = { title, text };
    this.scheduleSave();
  }
  clearUnitNote(unitId, recoveredStageIds = []) {
    delete this.settings.uiDrafts.unitNotes[unitId];
    for (const stageId of recoveredStageIds) {
      delete this.settings.uiDrafts.stages[this.stageKey(unitId, stageId)];
    }
    this.scheduleSave();
  }
  getSelectedStage(unitId) {
    return this.settings.uiDrafts.selectedStages[unitId] || null;
  }
  setSelectedStage(unitId, stageId) {
    if (stageId) this.settings.uiDrafts.selectedStages[unitId] = stageId;
    else delete this.settings.uiDrafts.selectedStages[unitId];
    this.scheduleSave();
  }
  getDoneWhen(unitId, stageId) {
    return this.settings.uiDrafts.doneWhen[this.stageKey(unitId, stageId)] || [];
  }
  setDoneWhen(unitId, stageId, index, checked) {
    const key = this.stageKey(unitId, stageId);
    const marks = [...this.settings.uiDrafts.doneWhen[key] || []];
    marks[index] = checked;
    if (marks.some(Boolean)) this.settings.uiDrafts.doneWhen[key] = marks;
    else delete this.settings.uiDrafts.doneWhen[key];
    this.scheduleSave();
  }
  clearDoneWhen(unitId, stageId) {
    delete this.settings.uiDrafts.doneWhen[this.stageKey(unitId, stageId)];
    this.scheduleSave();
  }
  getInbox() {
    return { ...this.settings.uiDrafts.inbox };
  }
  setInbox(title, text) {
    this.settings.uiDrafts.inbox = { title, text };
    this.scheduleSave();
  }
  clearInbox() {
    this.settings.uiDrafts.inbox = { title: "", text: "" };
    this.scheduleSave();
  }
};

// src/gateway-client.ts
var requestCounter = 0;
function nextRequestId(capability) {
  requestCounter += 1;
  return `req-${capability.replace(/\./g, "-")}-${Date.now()}-${requestCounter}`;
}
var GatewayClient = class {
  plugin;
  chain;
  jobSnapshotId = null;
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
  enqueue(task2) {
    this.pending += 1;
    const run = this.chain.then(task2, task2);
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
  capability(name, payload, options = {}) {
    const envelope = {
      request_id: nextRequestId(name),
      capability: name,
      expected_snapshot: options.expectedSnapshot || this.snapshotId(),
      ...options.expectedRevisions && Object.keys(options.expectedRevisions).length ? { expected_revisions: options.expectedRevisions } : {},
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
  sourceSelection(unitId, sourceId, locator, purpose, selected) {
    return this.capability(
      "unit.source-selection.set",
      {
        unit_id: unitId,
        source_id: sourceId,
        locator,
        action: selected ? "select" : "remove",
        ...selected ? { purpose } : {}
      }
    );
  }
  feedback(unitId, stageId, sourceId, feedback, resourceId) {
    return this.capability("source.feedback.record", {
      unit_id: unitId,
      stage_id: stageId,
      source_id: sourceId,
      feedback,
      ...resourceId ? { resource_id: resourceId } : {}
    });
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
  createGardenSeed(text, title = "") {
    const payload = { text };
    if (title.trim()) payload.title = title.trim();
    return this.capability(
      "garden.seed.create",
      payload
    );
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
  /**
   * The Job dashboard is the sole read outside the normal projection. The
   * confirmation flag is the learner's deliberate navigation gesture; the
   * core still owns path bounding and returns no durable cache.
   */
  async jobDashboard() {
    const result = await this.call(["job-dashboard", "--confirm-job-access"]);
    const access = result.access && typeof result.access === "object" ? result.access : {};
    this.jobSnapshotId = typeof access.snapshot_id === "string" && access.snapshot_id.startsWith("sha256:") ? access.snapshot_id : null;
    return result;
  }
  jobCapability(name, payload, expectedRevisions = {}) {
    if (!this.jobSnapshotId) {
      throw new Error("Reload the confidential Job workspace before saving; nothing was written.");
    }
    return this.capability(name, payload, {
      expectedSnapshot: this.jobSnapshotId,
      expectedRevisions
    });
  }
  /**
   * Bounded Job writes (ADR-010). Each carries the same deliberate-gesture flag
   * as the read, and each is a declared capability rooted at Job/ — the view
   * never writes a Job file itself, exactly as it never writes a canonical one.
   */
  logJobSession(text, options = {}) {
    const payload = { text, confirm_job_access: true };
    if (options.track) payload.track = options.track;
    if (options.session !== void 0) payload.session = options.session;
    if (options.minutes !== void 0) payload.minutes = options.minutes;
    return this.jobCapability("job.session.log", payload);
  }
  stampJobNote(noteId, commit, status = "current") {
    return this.jobCapability("job.note.stamp", {
      note: noteId,
      commit,
      status,
      confirm_job_access: true
    });
  }
  saveJobNote(noteId, title, body, revision) {
    return this.jobCapability("job.note.save", {
      note: noteId || title,
      title,
      body,
      folder: "learning",
      approve: true,
      confirm_job_access: true
    }, noteId && revision !== void 0 ? { [`job-note:${noteId}`]: revision } : {});
  }
  saveJobPlan(plan, revision) {
    const id = typeof plan.id === "string" ? plan.id : "";
    return this.jobCapability("job.plan.save", {
      plan,
      approve: true,
      confirm_job_access: true
    }, id && revision !== void 0 ? { [`job-plan:${id}`]: revision } : {});
  }
  saveJobTask(task2, revision) {
    const id = typeof task2.id === "string" ? task2.id : "";
    return this.jobCapability("job.task.save", {
      task: task2,
      confirm_job_access: true
    }, id && revision !== void 0 ? { [`job-task:${id}`]: revision } : {});
  }
  recordJobTrackSession(trackId, session, state, revision) {
    return this.jobCapability("job.track.progress", {
      track: trackId,
      session,
      state,
      confirm_job_access: true
    }, { [`job-track:${trackId}`]: revision });
  }
};
function explicitAiContext(plugin, context = {}) {
  const unit = context.unitId ? plugin.store.get(context.unitId) : null;
  const module2 = context.moduleId ? plugin.store.get(context.moduleId) : unit?.module_id ? plugin.store.get(unit.module_id) : null;
  const stage = context.stageId ? plugin.store.stage(context.stageId) : null;
  const stageResources = Array.isArray(stage?.resources) ? stage.resources : [];
  const unitSelections = Array.isArray(unit?.source_selections) ? unit.source_selections.filter(
    (row) => typeof row === "object" && row !== null && !Array.isArray(row)
  ) : [];
  const resources = stageResources.length ? stageResources : unitSelections;
  return {
    area_program_id: context.programId || module2?.area_id || null,
    module_id: module2?.id || context.moduleId || null,
    component_id: context.componentId || unit?.component_id || null,
    unit_id: unit?.id || context.unitId || null,
    stage_id: stage?.id || context.stageId || null,
    selected_source_ids: [...new Set(resources.map((row) => row.source_id).filter((value) => typeof value === "string" && value.length > 0))],
    selected_materials: resources.map((row) => row.material_uri || row.vault_path || row.url || row.material_path || row.locator).filter((value) => typeof value === "string" && value.length > 0),
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

// src/infrastructure/los-runtime.ts
var import_node_child_process = require("node:child_process");
var fs2 = __toESM(require("node:fs"));
var nodePath2 = __toESM(require("node:path"));
var import_node_process = __toESM(require("node:process"));
var LosRuntime = class {
  constructor(app, configuredPython) {
    this.app = app;
    this.configuredPython = configuredPython;
  }
  resolvePython() {
    const base = this.app.vault.adapter.getBasePath();
    const configured = this.configuredPython().trim();
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
    const fallback = import_node_process.default.platform === "win32" ? "python" : "python3";
    return { path: fallback, origin: "PATH fallback", attempted: [...attempted, fallback] };
  }
  run(args, callback, stdin) {
    const base = this.app.vault.adapter.getBasePath();
    const script = nodePath2.join(base, "tools", "los.py");
    const child = (0, import_node_child_process.execFile)(
      this.resolvePython().path,
      [script, ...args],
      { cwd: base, timeout: 18e4, maxBuffer: 8 * 1024 * 1024 },
      callback
    );
    if (stdin !== void 0) child.stdin?.end(stdin);
  }
};

// src/infrastructure/resource-opener.ts
var import_electron2 = require("electron");
var fs3 = __toESM(require("node:fs"));
var nodePath3 = __toESM(require("node:path"));
var import_obsidian21 = require("obsidian");
var CODE_EXTENSIONS = /* @__PURE__ */ new Set([
  ".c",
  ".cc",
  ".cpp",
  ".cs",
  ".css",
  ".go",
  ".h",
  ".hpp",
  ".ini",
  ".ipynb",
  ".java",
  ".js",
  ".jsx",
  ".json",
  ".jsonl",
  ".kt",
  ".less",
  ".lua",
  ".md",
  ".mjs",
  ".php",
  ".properties",
  ".py",
  ".r",
  ".rb",
  ".rs",
  ".sass",
  ".scss",
  ".sh",
  ".sql",
  ".swift",
  ".tex",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
  ".zsh"
]);
function visualStudioCodeUrl(path) {
  const url = new URL("vscode://file");
  const portable = String(path || "").replace(/\\/g, "/");
  url.pathname = portable.startsWith("/") ? portable : `/${portable}`;
  return url.href;
}
function normalizedVaultPath(value) {
  let path = String(value || "").trim();
  const wiki = path.match(/^\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/);
  if (wiki?.[1]) path = wiki[1];
  const markdown = path.match(/^\[[^\]]*\]\((.+)\)$/);
  if (markdown?.[1]) path = markdown[1];
  path = path.replace(/\\/g, "/").replace(/^\.\//, "");
  const subpath = path.search(/[?#]/);
  if (subpath >= 0) path = path.slice(0, subpath);
  try {
    path = decodeURIComponent(path);
  } catch (_) {
  }
  return path;
}
var ResourceOpener = class {
  constructor(app) {
    this.app = app;
  }
  jobAccessGranted = false;
  jobAllowedRoots = /* @__PURE__ */ new Set();
  grantJobAccess(value) {
    const access = value && typeof value === "object" ? value : {};
    const allowedRoots = Array.isArray(access.allowed_roots) ? access.allowed_roots.filter(
      (root) => typeof root === "string" && /^[a-z0-9][a-z0-9-]*$/.test(root) && root !== "stratum"
    ) : [];
    this.jobAccessGranted = access.scope === "job-dashboard" && access.read_only === true && access.ephemeral === true && access.excluded_from_manifest === true && access.excluded_from_search === true && access.excluded_from_ai === true && access.writes_through_gateway === true && typeof access.snapshot_id === "string" && access.snapshot_id.startsWith("sha256:") && allowedRoots.length > 0;
    this.jobAllowedRoots = this.jobAccessGranted ? new Set(allowedRoots) : /* @__PURE__ */ new Set();
    return this.jobAccessGranted;
  }
  isQuarantinedPath(path) {
    const posix = String(path || "").replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
    return posix === "Job" || posix.startsWith("Job/") || posix.includes("/Job/");
  }
  refuseQuarantined(path) {
    if (!this.isQuarantinedPath(path)) return false;
    new import_obsidian21.Notice("Job/ is quarantined \u2014 LearningOS never opens or displays it.");
    return true;
  }
  async openVaultPath(path) {
    if (this.refuseQuarantined(path)) return void 0;
    const target = normalizedVaultPath(path);
    if (!target || target.startsWith("/") || target.split("/").includes("..")) {
      new import_obsidian21.Notice(`Unsafe vault path refused: ${path || "unknown path"}`);
      return void 0;
    }
    const file = this.app.vault.getAbstractFileByPath(target);
    if (!file) {
      new import_obsidian21.Notice(`File unavailable: ${target}`);
      return void 0;
    }
    let existing = null;
    this.app.workspace.iterateAllLeaves((leaf2) => {
      if (!existing && leaf2.view?.file?.path === target) existing = leaf2;
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
  isCodePath(path) {
    if (!fs3.existsSync(path)) return false;
    const extension = nodePath3.extname(path).toLocaleLowerCase();
    return !extension || CODE_EXTENSIONS.has(extension);
  }
  async openSystemPath(path, successMessage) {
    const error = await import_electron2.shell.openPath(path);
    if (error) {
      new import_obsidian21.Notice(`Could not open file: ${error}`);
      return false;
    }
    new import_obsidian21.Notice(successMessage);
    return true;
  }
  async openCodePath(path) {
    try {
      await import_electron2.shell.openExternal(visualStudioCodeUrl(path));
      new import_obsidian21.Notice("Opened in Visual Studio Code.");
      return true;
    } catch (_) {
      new import_obsidian21.Notice("Visual Studio Code was unavailable; opening in the system app instead.");
      return this.openSystemPath(path, "Opened in the system app.");
    }
  }
  openPreferredLocalPath(path, systemMessage) {
    return this.isCodePath(path) ? this.openCodePath(path) : this.openSystemPath(path, systemMessage);
  }
  async openExternalPath(path, successMessage = "Opened in the default app.") {
    if (this.refuseQuarantined(path)) return false;
    if (!path || !fs3.existsSync(path)) {
      new import_obsidian21.Notice(`File unavailable: ${path || "unknown path"}`);
      return false;
    }
    return this.openSystemPath(path, successMessage);
  }
  /**
   * Deliberate Job-session exception. Ordinary open helpers still refuse every
   * Job path; only a validated, in-memory dashboard grant can reach this one.
   */
  async openJobPath(relativePath) {
    if (!this.jobAccessGranted) {
      new import_obsidian21.Notice("Open the confidential Job workspace before opening Job files.");
      return false;
    }
    const relative2 = String(relativePath || "").replace(/\\/g, "/").replace(/^\.\//, "");
    const top = relative2.split("/")[0] || "";
    if (!relative2 || relative2.startsWith("/") || relative2.split("/").includes("..") || !this.jobAllowedRoots.has(top)) {
      new import_obsidian21.Notice("The Job dashboard refused a path outside its read-only allowlist.");
      return false;
    }
    const vault = this.app.vault.adapter.getBasePath();
    const semesterRoot = nodePath3.dirname(nodePath3.dirname(vault));
    const jobRoot = nodePath3.resolve(semesterRoot, "Job");
    const fullPath = nodePath3.resolve(jobRoot, relative2);
    const escaped = nodePath3.relative(jobRoot, fullPath);
    if (!escaped || escaped.startsWith("..") || nodePath3.isAbsolute(escaped) || !fs3.existsSync(nodePath3.join(jobRoot, "README.md")) || !fs3.existsSync(fullPath)) {
      new import_obsidian21.Notice(`Job file unavailable: ${relative2 || "unknown path"}`);
      return false;
    }
    return this.openPreferredLocalPath(
      fullPath,
      "Opened from the confidential Job workspace."
    );
  }
  /** Web references shown inside the ephemeral Job reader stay protocol-safe. */
  async openJobUrl(value) {
    if (!this.jobAccessGranted) {
      new import_obsidian21.Notice("Open the confidential Job workspace before opening its links.");
      return false;
    }
    const url = safeWebUrl(value);
    if (!url) {
      new import_obsidian21.Notice(`Refused an unsupported Job link: ${String(value || "").slice(0, 80)}`);
      return false;
    }
    try {
      await import_electron2.shell.openExternal(url.href);
      return true;
    } catch (_) {
      new import_obsidian21.Notice("Could not open the Job link in your browser.");
      return false;
    }
  }
  /**
   * Job may cite LearningOS one-way. This deliberately accepts only an
   * explicit `LearningOS/…` path and can never resolve back into Job/.
   */
  async openJobLearningPath(value) {
    if (!this.jobAccessGranted) {
      new import_obsidian21.Notice("Open the confidential Job workspace before opening its learning material.");
      return false;
    }
    const portable = normalizedVaultPath(value);
    const prefix = "LearningOS/";
    if (!portable.startsWith(prefix) || portable.split("/").includes("..")) {
      new import_obsidian21.Notice("The Job dashboard refused a learning path outside LearningOS.");
      return false;
    }
    const relative2 = portable.slice(prefix.length);
    const vault = this.app.vault.adapter.getBasePath();
    const learningRoot = nodePath3.dirname(vault);
    const fullPath = nodePath3.resolve(learningRoot, relative2);
    const escaped = nodePath3.relative(learningRoot, fullPath);
    if (!relative2 || escaped.startsWith("..") || nodePath3.isAbsolute(escaped) || !fs3.existsSync(fullPath)) {
      new import_obsidian21.Notice(`Learning material unavailable: ${portable || "unknown path"}`);
      return false;
    }
    return this.openPreferredLocalPath(fullPath, "Opened the LearningOS material.");
  }
  openMaterialPath(path) {
    const vault = this.app.vault.adapter.getBasePath();
    const learningRoot = nodePath3.dirname(vault);
    const materialsRoot = nodePath3.resolve(learningRoot, "materials");
    const fullPath = nodePath3.resolve(learningRoot, path || "");
    const relative2 = nodePath3.relative(materialsRoot, fullPath);
    if (!path || relative2.startsWith("..") || nodePath3.isAbsolute(relative2)) {
      new import_obsidian21.Notice(`Unsafe material path refused: ${path || "unknown path"}`);
      return false;
    }
    return this.openExternalPath(fullPath, "Opened the local material in its default app.");
  }
  openAuthoredPath(path) {
    if (this.refuseQuarantined(path)) return false;
    const extension = nodePath3.extname(path || "").toLocaleLowerCase();
    if ([".md", ".pdf", ".canvas", ".base"].includes(extension)) return this.openVaultPath(path);
    const base = this.app.vault.adapter.getBasePath();
    const fullPath = nodePath3.resolve(base, path || "");
    const relative2 = nodePath3.relative(base, fullPath);
    if (!path || relative2.startsWith("..") || nodePath3.isAbsolute(relative2)) {
      new import_obsidian21.Notice(`Unsafe vault path refused: ${path || "unknown path"}`);
      return false;
    }
    if (!fs3.existsSync(fullPath)) {
      new import_obsidian21.Notice(`File unavailable: ${path || "unknown path"}`);
      return false;
    }
    return this.openPreferredLocalPath(
      fullPath,
      "Opened the authored file in its default app."
    );
  }
  openResource(resource, ports = this) {
    const materialPath = typeof resource.material_path === "string" ? resource.material_path : "";
    if (materialPath.trim()) return ports.openMaterialPath(materialPath);
    const vaultPath = typeof resource.vault_path === "string" ? resource.vault_path : "";
    if (vaultPath.trim()) {
      if (vaultPath.trim().toLowerCase().startsWith("material://")) {
        new import_obsidian21.Notice(`Refused an unresolved material link: ${vaultPath.trim().slice(0, 80)}`);
        return false;
      }
      return ports.openVaultPath(vaultPath);
    }
    if (resource.url) {
      const url = safeWebUrl(resource.url);
      if (!url) {
        new import_obsidian21.Notice(`Refused an unsupported link: ${String(resource.url).slice(0, 80)}`);
        return false;
      }
      return Promise.resolve(import_electron2.shell.openExternal(url.href)).catch(() => {
        new import_obsidian21.Notice("Could not open the link in your browser.");
        return false;
      });
    }
    return false;
  }
  copyText(value) {
    try {
      void navigator.clipboard.writeText(value);
      new import_obsidian21.Notice(`Copied ${value}`);
    } catch (_) {
      new import_obsidian21.Notice(value);
    }
  }
};

// src/manifest-store.ts
function isRecord3(value) {
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
      const generated = isRecord3(parsed) && isRecord3(parsed._generated) ? parsed._generated : null;
      const version = generated?.contract_version;
      if (version !== MANIFEST_CONTRACT_VERSION) {
        throw new Error(
          `Unsupported manifest contract ${String(version ?? "unknown")}; LearningOS UI requires contract ${MANIFEST_CONTRACT_VERSION}.`
        );
      }
      assertManifest(parsed);
      const manifest = parsed;
      this.data = manifest;
      this.contractVersion = version;
      this.snapshotId = manifest._generated.snapshot_id;
      this.records = (manifest.records || []).filter((row) => row && typeof row === "object");
      this.byId = new Map(
        this.records.flatMap((row) => typeof row.id === "string" ? [[row.id, row]] : [])
      );
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
  currentSemester() {
    return this.rows("semesters").filter((row) => row.status === "current").sort((a, b) => Number(a.order || 0) - Number(b.order || 0))[0] || null;
  }
  /**
   * Modules is a semester surface, not a second subject catalogue.
   *
   * Semester records use ids such as `semester-sose-2026`, while authored
   * modules retain the shorter `sose-2026` value. Both spellings are accepted
   * at this read boundary; the UI does not infer membership from thematic
   * groups or from source usage.
   */
  currentSemesterModules() {
    const semester = this.currentSemester();
    const semesterIds = /* @__PURE__ */ new Set();
    if (typeof semester?.id === "string") {
      semesterIds.add(semester.id);
      semesterIds.add(semester.id.replace(/^semester-/, ""));
    }
    return this.modules().filter((row) => {
      if (row.kind !== "academic") return false;
      if (["completed", "archived", "dropped"].includes(String(row.status || ""))) return false;
      if (!semesterIds.size) return row.status === "enrolled";
      return semesterIds.has(String(row.semester || ""));
    }).sort((a, b) => String(a.title || a.id || "").localeCompare(String(b.title || b.id || "")));
  }
  projects() {
    return this.rows("projects");
  }
  projectRelationships(projectId = null) {
    const rows = [...this.data?.project_relationships || []];
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
    return [...this.data?.units.find((unit) => unit.id === unitId)?.note_sections || []];
  }
  studyMaps() {
    return this.rows("study_maps");
  }
  gardenEntries() {
    return this.rows("garden_entries");
  }
  reviewItems() {
    return this.rows("review_items");
  }
  /** The ADR-009 topic vocabulary: {id, title, domain}. `domain` groups topics
   *  for display only — it never constrains which sources may carry one. */
  topics() {
    return this.rows("topics");
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
    return this.data?.progress?.[moduleId] || {
      stages_complete: 0,
      stages_total: 0,
      units_total: 0,
      units_needing_map: 0
    };
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
  useModules(sourceId) {
    const rawIds = this.data?.indexes?.source_to_modules?.[sourceId];
    const ids = Array.isArray(rawIds) ? rawIds.filter(
      (id) => typeof id === "string"
    ) : [];
    return ids.map((id) => this.get(id)).filter(
      (row) => row !== null && row.type === "module"
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
    const words2 = String(query || "").toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const allowed = types ? new Set(types) : null;
    const rows = this.records.filter((row) => !allowed || typeof row.type === "string" && allowed.has(row.type));
    if (!words2.length) return rows;
    const strict = rows.filter((row) => {
      const hay = [
        row.id,
        row.title,
        ...row.aliases || [],
        ...row.authors || [],
        row.organization,
        row.domain
      ].filter(Boolean).join(" ").toLocaleLowerCase();
      return words2.every((word) => hay.includes(word));
    });
    if (strict.length) return strict;
    const needle = words2.join("");
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
      for (const value of asStrings(record[key])) ids.add(value);
    }
    for (const table of Object.values(this.data?.backlinks || {})) {
      if (isRecord3(table) && Array.isArray(table[id])) {
        for (const value of table[id]) {
          if (typeof value === "string") ids.add(value);
          else if (isRecord3(value) && typeof value.from === "string") ids.add(value.from);
        }
      }
    }
    for (const relationship of this.projectRelationships()) {
      if (relationship.from_project_id === id) ids.add(relationship.to_id);
      if (relationship.to_id === id) ids.add(relationship.from_project_id);
    }
    return [...ids].map((value) => ({ rec: this.get(value) })).filter((row) => row.rec);
  }
};

// src/main.ts
function errorMessage4(error) {
  return error instanceof Error ? error.message : String(error);
}
var LearningOSUI = class extends import_obsidian22.Plugin {
  lastAiPrompt = "";
  async onload() {
    const loadedSettings = await this.loadData();
    const savedSettings = loadedSettings ?? {};
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...savedSettings,
      uiDrafts: normalizeUiDrafts(savedSettings.uiDrafts)
    };
    this.drafts = new DraftStore(this.settings, () => this.saveData(this.settings));
    this.store = new ManifestStore(this.app);
    this.runtime = new LosRuntime(this.app, () => this.settings.pythonPath);
    this.resources = new ResourceOpener(this.app);
    this.gateway = new GatewayClient(this);
    this.aiActions = new AIActionClient(this);
    this.router = new ApplicationRouter(this);
    await this.store.load();
    registerApplication(this);
  }
  onunload() {
    this.drafts.dispose();
    void this.saveData(this.settings);
    detachApplication(this);
  }
  scheduleDraftSave() {
    this.drafts.scheduleSave();
  }
  stageDraftKey(unitId, stageId) {
    return this.drafts.stageKey(unitId, stageId);
  }
  getStageDraft(unitId, stageId, savedText = "") {
    return this.drafts.getStage(unitId, stageId, savedText);
  }
  setStageDraft(unitId, stageId, text, savedText = "") {
    this.drafts.setStage(unitId, stageId, text, savedText);
  }
  clearStageDraft(unitId, stageId) {
    this.drafts.clearStage(unitId, stageId);
  }
  getUnitNoteDraft(unitId, stages = []) {
    return this.drafts.getUnitNote(unitId, stages);
  }
  setUnitNoteDraft(unitId, title, text) {
    this.drafts.setUnitNote(unitId, title, text);
  }
  clearUnitNoteDraft(unitId, recoveredStageIds = []) {
    this.drafts.clearUnitNote(unitId, recoveredStageIds);
  }
  openUnitNote(unit, studyMap) {
    const modal = new UnitNoteModal(this.app, this, unit, studyMap);
    modal.open();
    return modal;
  }
  getSelectedStage(unitId) {
    return this.drafts.getSelectedStage(unitId);
  }
  setSelectedStage(unitId, stageId) {
    this.drafts.setSelectedStage(unitId, stageId);
  }
  /** Done-when ticks are UI-owned working state: they help the learner see how
   *  far through a stage's criteria they are, and are never a second record of
   *  completion. The core still learns only "complete" from `stage-progress`. */
  getDoneWhen(unitId, stageId) {
    return this.drafts.getDoneWhen(unitId, stageId);
  }
  setDoneWhen(unitId, stageId, index, checked) {
    this.drafts.setDoneWhen(unitId, stageId, index, checked);
  }
  clearDoneWhen(unitId, stageId) {
    this.drafts.clearDoneWhen(unitId, stageId);
  }
  getInboxDraft() {
    return this.drafts.getInbox();
  }
  setInboxDraft(title, text) {
    this.drafts.setInbox(title, text);
  }
  clearInboxDraft() {
    this.drafts.clearInbox();
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
    return this.runtime.resolvePython();
  }
  /**
   * Run the CLI. `stdin` carries a capability envelope when there is one.
   *
   * Envelopes go down stdin rather than a `--payload-file` temp file: a temp
   * file would put canonical intent on disk on every write, including the
   * ones that fail, leaving cleanup as a thing that can be forgotten.
   */
  runLos(args, callback, stdin) {
    this.runtime.run(args, callback, stdin);
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
  openProject(projectId, tab = "structure") {
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
  openLibraryHome(collection = "sources", query = "", filters) {
    return this.router.navigate({
      name: "library-home",
      collection: asLibraryCollection(collection),
      query,
      ...filters ? { filters } : {}
    });
  }
  openLibraryGroup(collection, groupId, query = "", facet = "all", filters) {
    return this.router.navigate({
      name: "library-group",
      collection: asLibraryCollection(collection),
      groupId,
      query,
      facet,
      ...filters ? { filters } : {}
    });
  }
  openSourceDetail(resourceId, fromGroupId = null, query = "", facet = "all", filters) {
    return this.router.navigate({
      name: "source-detail",
      resourceId,
      fromGroupId,
      query,
      facet,
      ...filters ? { filters } : {}
    });
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
    if (!ok) new import_obsidian22.Notice("Omnisearch is unavailable; structural Library search still works.");
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
    new import_obsidian22.Notice("Canonical files changed since this view loaded \u2014 rebuilding the projection, then retrying.");
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
      new import_obsidian22.Notice("LearningOS projection rebuilt.");
    } catch (error) {
      new import_obsidian22.Notice(errorMessage4(error));
    }
  }
  async reviewSessionEnd() {
    try {
      const review = asSessionReview(await this.gateway.endSession());
      new SessionEndModal(this.app, this, review).open();
      return review;
    } catch (error) {
      new import_obsidian22.Notice(errorMessage4(error));
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
    return this.resources.isQuarantinedPath(path);
  }
  refuseQuarantined(path) {
    return this.resources.refuseQuarantined(path);
  }
  async openVaultPath(path) {
    return this.resources.openVaultPath(path);
  }
  async openExternalPath(path, successMessage = "Opened in the default app.") {
    return this.resources.openExternalPath(path, successMessage);
  }
  openMaterialPath(path) {
    return this.resources.openMaterialPath(path);
  }
  openAuthoredPath(path) {
    return this.resources.openAuthoredPath(path);
  }
  openJobPath(path) {
    return this.resources.openJobPath(path);
  }
  openRecord(record) {
    if (!record) return;
    const recordId = asString(record.id);
    if (record.type === "unit" && recordId) return this.openUnit(recordId);
    if (record.type === "module" && recordId) return this.openModule(recordId);
    if (record.type === "project" && recordId) return this.openProject(recordId);
    if (record.type === "program" && recordId) return this.openProgram(recordId);
    if (record.type === "source" && recordId) return this.openSourceDetail(recordId);
    if (record.type === "topic-pack" && recordId) return this.openTopicPackDetail(recordId);
    if (record.type === "collection" && recordId) return this.openCatalogueDetail(recordId);
    if (record.type === "note" || record.type === "concept") {
      if (record.path) return this.openAuthoredPath(record.path);
      return this.openLibraryFiltered(record.type);
    }
    if (record.type === "workspace") {
      if (record.project_id) return this.openProject(record.project_id);
      const unit = (record.unit_ids || []).map((id) => this.store.get(id)).find(Boolean);
      if (unit?.id) return this.openUnit(unit.id);
      const module2 = (record.module_ids || []).map((id) => this.store.get(id)).find(Boolean);
      return module2?.id ? this.openModule(module2.id) : this.openHome();
    }
    if (record.path) return this.openAuthoredPath(record.path);
  }
  openResource(resource) {
    return this.resources.openResource(resource, this);
  }
  copyText(value) {
    this.resources.copyText(value);
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
      new import_obsidian22.Notice("Scoped prompt copied. Open Agentic Copilot to continue.");
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
