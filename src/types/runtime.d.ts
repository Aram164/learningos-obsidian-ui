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
  export interface App {}

  export class Plugin {
    [key: string]: any;

    saveData(data: unknown): Promise<void>;
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
    readonly state?: Record<string, unknown>;

    setViewState(viewState: {
      type: string;
      active?: boolean;
      state?: Record<string, unknown>;
    }): Promise<void> | void;
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
  export function execFile(...args: any[]): any;
}

declare module 'node:fs' {
  const value: any;
  export = value;
}

declare module 'node:path' {
  const value: any;
  export = value;
}

declare module 'node:process' {
  const value: any;
  export default value;
}
