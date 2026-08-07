/**
 * Minimal host declarations used for offline typechecking.
 *
 * Production builds resolve the real runtime modules from
 * Obsidian, Electron and Node. These declarations intentionally expose only
 * the host surface exercised by the checked source.
 */

interface ObsidianDomElementOptions {
  cls?: string | string[];
  text?: string;
  attr?: Record<string, string>;
}

interface HTMLElement {
  createEl<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    options?: ObsidianDomElementOptions,
  ): HTMLElementTagNameMap[K];

  createDiv(
    options?: ObsidianDomElementOptions,
  ): HTMLDivElement;

  createSpan(
    options?: ObsidianDomElementOptions,
  ): HTMLSpanElement;

  empty(): void;
  addClass(...classNames: string[]): void;
  removeClass(...classNames: string[]): void;
  toggleClass(className: string, value: boolean): void;
  setText(text: string): void;
  setAttr(name: string, value: string): void;
  setAttrs(attributes: Record<string, string>): void;
}

declare module 'obsidian' {
  export interface TAbstractFile {
    readonly path: string;
  }

  export interface PluginManifest {
    readonly version?: string;
  }

  export interface WorkspaceView {
    readonly file?: TAbstractFile;

    /* Every leaf view is a View, which owns a scrollable content element. */
    readonly contentEl?: HTMLElement;

    render?(): unknown;
  }

  export interface WorkspaceSplit {
    collapse(): void;
  }

  export interface Workspace {
    readonly rightSplit?: WorkspaceSplit;

    detachLeavesOfType(
      viewType: string,
    ): void;

    onLayoutReady(
      callback: () => unknown,
    ): void;

    iterateAllLeaves(
      callback: (
        leaf: WorkspaceLeaf,
      ) => unknown,
    ): void;

    getLeavesOfType(
      viewType: string,
    ): WorkspaceLeaf[];

    getLeaf(
      newLeaf?: boolean | string,
    ): WorkspaceLeaf;

    getLeftLeaf?(
      split?: boolean,
    ): WorkspaceLeaf | null;

    getRightLeaf?(
      split?: boolean,
    ): WorkspaceLeaf | null;

    revealLeaf(
      leaf: WorkspaceLeaf,
    ): void;

    setActiveLeaf?(
      leaf: WorkspaceLeaf,
      options?: {
        focus?: boolean;
      },
    ): void;

    getActiveFile?():
      TAbstractFile | null;
  }

  export interface VaultAdapter {
    getBasePath(): string;

    exists(
      path: string,
    ): Promise<boolean>;

    read(
      path: string,
    ): Promise<string>;
  }

  export interface Vault {
    readonly adapter: VaultAdapter;

    getAbstractFileByPath(
      path: string,
    ): TAbstractFile | null;
  }

  export interface CommandManager {
    executeCommandById?(
      commandId: string,
    ): boolean | void;
  }

  export interface ChatAgent {
    sendToChat?(
      prompt: string,
    ): Promise<unknown> | unknown;
  }

  export interface PluginRegistry {
    readonly plugins?:
      Record<
        string,
        ChatAgent | undefined
      >;
  }

  export interface App {
    readonly workspace: Workspace;
    readonly vault: Vault;
    readonly commands?: CommandManager;
    readonly plugins?: PluginRegistry;
  }

  export interface Command {
    readonly id: string;
    readonly name: string;
    readonly callback: () => unknown;
  }

  export class Plugin {
    readonly app: App;
    readonly manifest?: PluginManifest;

    constructor(app: App);

    registerView(
      viewType: string,
      viewCreator: (
        leaf: WorkspaceLeaf,
      ) => ItemView,
    ): void;

    addSettingTab(
      tab: PluginSettingTab,
    ): void;

    addRibbonIcon(
      icon: string,
      title: string,
      callback: () => unknown,
    ): HTMLElement;

    addCommand(
      command: Command,
    ): void;

    loadData<T = unknown>():
      Promise<T>;

    saveData<T>(
      data: T,
    ): Promise<void>;
  }

  export interface ToggleComponent {
    setValue(value: boolean): this;
    onChange(
      callback: (value: boolean) => unknown,
    ): this;
  }

  export interface TextComponent {
    setValue(value: string): this;
    onChange(
      callback: (value: string) => unknown,
    ): this;
  }

  export interface ButtonComponent {
    setButtonText(text: string): this;
    setCta(): this;
    onClick(
      callback: () => unknown,
    ): this;
  }

  export class PluginSettingTab {
    readonly app: App;
    readonly plugin: Plugin;
    readonly containerEl: HTMLElement;

    constructor(
      app: App,
      plugin: Plugin,
    );

    display(): void;
  }

  export interface WorkspaceLeaf {
    readonly app: App;
    readonly state?: Record<string, unknown>;
    readonly view?: WorkspaceView;

    setViewState(viewState: {
      type: string;
      active?: boolean;
      state?: Record<string, unknown>;
    }): Promise<void> | void;

    setPinned?(
      pinned: boolean,
    ): void;

    openFile(
      file: TAbstractFile,
    ): Promise<void> | void;
  }

  export class ItemView {
    readonly app: App;
    readonly leaf: WorkspaceLeaf;
    readonly contentEl: HTMLElement;

    constructor(leaf: WorkspaceLeaf);
  }

  export class Modal {
    readonly app: App;
    readonly contentEl: HTMLElement;

    constructor(app: App);

    open(): void;
    close(): void;
  }

  export class Notice {
    constructor(message: string, timeout?: number);
  }

  export class Setting {
    constructor(containerEl: HTMLElement);

    setName(name: string): this;
    setDesc(description: string): this;

    addToggle(
      callback: (
        component: ToggleComponent,
      ) => unknown,
    ): this;

    addText(
      callback: (
        component: TextComponent,
      ) => unknown,
    ): this;

    addButton(
      callback: (
        component: ButtonComponent,
      ) => unknown,
    ): this;
  }

  export function setIcon(
    element: Element,
    iconId: string,
  ): void;
}

declare module 'electron' {
  export const shell: {
    openExternal(url: string): Promise<void> | void;
    openPath(path: string): Promise<string> | string;
  };

  export const webUtils: {
    getPathForFile(file: unknown): string;
  };
}

declare module 'node:child_process' {
  export interface ExecFileOptions {
    cwd?: string;
    timeout?: number;
    maxBuffer?: number;
  }

  export interface ChildProcess {}

  export type ExecFileCallback = (
    error: Error | null,
    stdout: string,
    stderr: string,
  ) => void;

  export function execFile(
    file: string,
    args: readonly string[],
    options: ExecFileOptions,
    callback: ExecFileCallback,
  ): ChildProcess;
}

declare module 'node:fs' {
  export function existsSync(
    path: string,
  ): boolean;

  export function readFileSync(
    path: string,
    encoding: 'utf8',
  ): string;
}

declare module 'node:path' {
  export function join(
    ...paths: string[]
  ): string;

  export function dirname(
    path: string,
  ): string;

  export function resolve(
    ...paths: string[]
  ): string;

  export function relative(
    from: string,
    to: string,
  ): string;

  export function isAbsolute(
    path: string,
  ): boolean;

  export function extname(
    path: string,
  ): string;
}

declare module 'node:process' {
  const process: {
    readonly platform: string;
  };

  export default process;
}
