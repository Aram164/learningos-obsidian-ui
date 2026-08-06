/** Minimal host declarations used for offline typechecking.
 * Production builds resolve the real runtime modules from Obsidian/Electron/Node.
 */
declare module 'obsidian' {
  export class Plugin { [key: string]: any; }
  export class PluginSettingTab { [key: string]: any; constructor(...args: any[]); }
  export class ItemView { [key: string]: any; constructor(...args: any[]); }
  export class Modal { [key: string]: any; constructor(...args: any[]); }
  export class Notice { constructor(...args: any[]); }
  export class Setting { [key: string]: any; constructor(...args: any[]); }
  export function setIcon(element: any, iconId: string): void;
}

declare module 'electron' {
  export const shell: { openExternal(url: string): Promise<void> | void; openPath(path: string): Promise<string> | string };
  export const webUtils: { getPathForFile(file: unknown): string };
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
