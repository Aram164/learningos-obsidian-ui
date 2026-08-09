import { shell } from 'electron';
import * as fs from 'node:fs';
import * as nodePath from 'node:path';
import { Notice, type App, type WorkspaceLeaf } from 'obsidian';
import type { ProjectionRecord } from '../contracts/manifest-v4';
import { safeWebUrl } from '../security/safe-url';

export interface ResourceOpenPorts {
  openMaterialPath(path: string): unknown;
  openVaultPath(path: string): unknown;
}

/** All paths and URLs leaving the projection cross this allowlisted adapter. */
export class ResourceOpener {
  constructor(private readonly app: App) {}

  isQuarantinedPath(path: string): boolean {
    const posix = String(path || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
    return posix === 'Job' || posix.startsWith('Job/') || posix.includes('/Job/');
  }

  refuseQuarantined(path: string): boolean {
    if (!this.isQuarantinedPath(path)) return false;
    new Notice('Job/ is quarantined — LearningOS never opens or displays it.');
    return true;
  }

  async openVaultPath(path: string): Promise<WorkspaceLeaf | undefined> {
    if (this.refuseQuarantined(path)) return undefined;
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file) { new Notice(`File unavailable: ${path}`); return undefined; }
    let existing: WorkspaceLeaf | null = null;
    this.app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
      if (!existing && leaf.view?.file?.path === path) existing = leaf;
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

  async openExternalPath(path: string, successMessage = 'Opened in the default app.'): Promise<boolean> {
    if (this.refuseQuarantined(path)) return false;
    if (!path || !fs.existsSync(path)) { new Notice(`File unavailable: ${path || 'unknown path'}`); return false; }
    const error = await shell.openPath(path);
    if (error) { new Notice(`Could not open file: ${error}`); return false; }
    new Notice(successMessage);
    return true;
  }

  openMaterialPath(path: string): Promise<boolean> | false {
    const vault = this.app.vault.adapter.getBasePath();
    const learningRoot = nodePath.dirname(vault);
    const materialsRoot = nodePath.resolve(learningRoot, 'materials');
    const fullPath = nodePath.resolve(learningRoot, path || '');
    const relative = nodePath.relative(materialsRoot, fullPath);
    if (!path || relative.startsWith('..') || nodePath.isAbsolute(relative)) {
      new Notice(`Unsafe material path refused: ${path || 'unknown path'}`);
      return false;
    }
    return this.openExternalPath(fullPath, 'Opened the local material in its default app.');
  }

  openAuthoredPath(path: string): Promise<boolean | WorkspaceLeaf | undefined> | false {
    if (this.refuseQuarantined(path)) return false;
    const extension = nodePath.extname(path || '').toLocaleLowerCase();
    if (['.md', '.pdf', '.canvas', '.base'].includes(extension)) return this.openVaultPath(path);
    const base = this.app.vault.adapter.getBasePath();
    const fullPath = nodePath.resolve(base, path || '');
    const relative = nodePath.relative(base, fullPath);
    if (!path || relative.startsWith('..') || nodePath.isAbsolute(relative)) {
      new Notice(`Unsafe vault path refused: ${path || 'unknown path'}`);
      return false;
    }
    return this.openExternalPath(fullPath, 'Opened the authored file in its default app.');
  }

  openResource(
    resource: ProjectionRecord,
    ports: ResourceOpenPorts = this,
  ): unknown {
    const materialPath = typeof resource.material_path === 'string' ? resource.material_path : '';
    if (materialPath.trim()) return ports.openMaterialPath(materialPath);
    const vaultPath = typeof resource.vault_path === 'string' ? resource.vault_path : '';
    if (vaultPath.trim()) {
      if (vaultPath.trim().toLowerCase().startsWith('material://')) {
        new Notice(`Refused an unresolved material link: ${vaultPath.trim().slice(0, 80)}`);
        return false;
      }
      return ports.openVaultPath(vaultPath);
    }
    if (resource.url) {
      const url = safeWebUrl(resource.url);
      if (!url) { new Notice(`Refused an unsupported link: ${String(resource.url).slice(0, 80)}`); return false; }
      const leaf = this.app.workspace.getLeaf(true);
      return leaf.setViewState({ type: 'webviewer', active: true, state: { url: url.href } });
    }
    return false;
  }

  copyText(value: string): void {
    try { void navigator.clipboard.writeText(value); new Notice(`Copied ${value}`); }
    catch (_) { new Notice(value); }
  }
}
