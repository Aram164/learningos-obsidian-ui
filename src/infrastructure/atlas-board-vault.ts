/**
 * Obsidian Vault adapter for Atlas working boards (P3). Public APIs only:
 * Vault reads/creates, the atomic Vault.process transform, and leaf scans
 * that include pop-outs via iterateAllLeaves.
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

export class AtlasBoardVault implements BoardVaultPort {
  constructor(private readonly app: App) {}

  private file(path: string): TFile | null {
    const found = this.app.vault.getAbstractFileByPath(path);
    return found && 'extension' in found ? (found as TFile) : null;
  }

  async read(path: string): Promise<string | null> {
    const file = this.file(path);
    return file ? this.app.vault.read(file) : null;
  }

  async create(path: string, text: string): Promise<void> {
    const folder = path.split('/').slice(0, -1).join('/');
    if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
      await this.app.vault.createFolder(folder);
    }
    await this.app.vault.create(path, text);
  }

  async process(path: string, fn: (latest: string) => string | null): Promise<boolean> {
    const file = this.file(path);
    if (!file) return false;
    const unchanged = new Error('No board edit to write');
    let accepted = false;
    try {
      await this.app.vault.process(file, (latest) => {
        const next = fn(latest);
        accepted = next !== null;
        if (next === null || next === latest) throw unchanged;
        return next;
      });
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

  async managedCanvasOpen(): Promise<boolean> {
    let open = false;
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view as { file?: TFile } | undefined;
      if (view?.file?.path.startsWith('boards/atlas/') && view.file.path.endsWith('.canvas')) open = true;
    });
    return open;
  }
}
