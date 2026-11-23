/**
 * Obsidian Vault adapter for Atlas working boards (P3). Public APIs only:
 * Vault reads/creates, the atomic Vault.process transform, and leaf scans
 * that include pop-outs via iterateAllLeaves.
 */
import { Notice, type App, type TFile } from 'obsidian';
import type { BoardVaultPort } from '../features/atlas/board-controller';

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
    let wrote = false;
    await this.app.vault.process(file, (latest) => {
      const next = fn(latest);
      if (next === null) return latest;
      wrote = true;
      return next;
    });
    return wrote;
  }

  async openLeaf(path: string): Promise<void> {
    const file = this.file(path);
    if (!file) { new Notice(`Board not found: ${path}`); return; }
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.openFile(file);
  }

  async managedCanvasOpen(workingPaths: readonly string[]): Promise<boolean> {
    let open = false;
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view as { file?: TFile } | undefined;
      const path = view?.file?.path;
      if (path && workingPaths.includes(path)) open = true;
    });
    return open;
  }
}
