/**
 * Obsidian Vault adapter for Atlas working boards (P3). Public APIs only:
 * Vault reads/creates, the atomic Vault.process transform, and leaf scans
 * that include pop-outs via iterateAllLeaves.
 *
 * Obsidian's vault index skips every path with a dot-segment, so the
 * ownership records under `boards/atlas/.state/` are invisible to
 * `getAbstractFileByPath`, `vault.create` returns null for them, and a second
 * `createFolder` throws "Folder already exists." (observed in Obsidian
 * 1.15.1, 2026-11-23). Hidden paths therefore go through the vault's
 * DataAdapter, whose `exists`/`read`/`write`/`mkdir`/`process` reach them.
 */
import { Notice, type App, type TFile, type WorkspaceLeaf } from 'obsidian';
import { BoardController, type BoardVaultPort } from '../features/atlas/board-controller';

const controllers = new WeakMap<App, BoardController>();

export function atlasBoardController(app: App): BoardController {
  const existing = controllers.get(app);
  if (existing) return existing;
  const controller = new BoardController(new AtlasBoardVault(app));
  controllers.set(app, controller);
  return controller;
}

/** Whether Obsidian's vault index ignores this path (any dot-segment). */
export function hiddenVaultPath(path: string): boolean {
  return path.split('/').some((segment) => segment.startsWith('.'));
}

function parentFolder(path: string): string {
  return path.split('/').slice(0, -1).join('/');
}

export class AtlasBoardVault implements BoardVaultPort {
  constructor(private readonly app: App) {}

  private file(path: string): TFile | null {
    const found = this.app.vault.getAbstractFileByPath(path);
    return found && 'extension' in found ? (found as TFile) : null;
  }

  async read(path: string): Promise<string | null> {
    if (hiddenVaultPath(path)) {
      const adapter = this.app.vault.adapter;
      return await adapter.exists(path) ? adapter.read(path) : null;
    }
    const file = this.file(path);
    return file ? this.app.vault.read(file) : null;
  }

  async create(path: string, text: string): Promise<void> {
    const folder = parentFolder(path);
    if (hiddenVaultPath(path)) {
      const adapter = this.app.vault.adapter;
      if (await adapter.exists(path)) throw new Error(`File already exists: ${path}`);
      if (folder) await adapter.mkdir(folder);
      await adapter.write(path, text);
      return;
    }
    if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
      await this.app.vault.createFolder(folder);
    }
    await this.app.vault.create(path, text);
  }

  async process(path: string, fn: (latest: string) => string | null): Promise<boolean> {
    const unchanged = new Error('No board edit to write');
    let accepted = false;
    const transform = (latest: string): string => {
      const next = fn(latest);
      accepted = next !== null;
      if (next === null || next === latest) throw unchanged;
      return next;
    };
    try {
      if (hiddenVaultPath(path)) {
        if (!(await this.app.vault.adapter.exists(path))) return false;
        await this.app.vault.adapter.process(path, transform);
      } else {
        const file = this.file(path);
        if (!file) return false;
        await this.app.vault.process(file, transform);
      }
    } catch (error) {
      if (error !== unchanged) throw error;
    }
    return accepted;
  }

  async openLeaf(path: string): Promise<void> {
    const file = this.file(path);
    if (!file) { new Notice(`Board not found: ${path}`); return; }
    const existing = this.leafFor(path);
    if (existing) {
      await this.app.workspace.revealLeaf(existing);
      return;
    }
    await this.app.workspace.getLeaf(true).openFile(file);
  }

  private leafFor(path: string): WorkspaceLeaf | undefined {
    let match: WorkspaceLeaf | undefined;
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view as { file?: TFile } | undefined;
      if (view?.file?.path === path) match = leaf;
    });
    return match;
  }

  isManagedCanvasOpenSync(): boolean {
    let open = false;
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view as { file?: TFile } | undefined;
      if (view?.file?.path.startsWith('boards/atlas/') && view.file.path.endsWith('.canvas')) open = true;
    });
    return open;
  }

  async managedCanvasOpen(): Promise<boolean> {
    return this.isManagedCanvasOpenSync();
  }
}
