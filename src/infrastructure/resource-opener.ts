import { shell } from 'electron';
import * as fs from 'node:fs';
import * as nodePath from 'node:path';
import { Notice, type App, type WorkspaceLeaf } from 'obsidian';
import type { ProjectionRecord } from '../contracts/manifest';
import { safeWebUrl } from '../security/safe-url';
import { isDirectMaterialFileTarget, isFileShapedPath } from './resource-target';

export interface ResourceOpenPorts {
  openMaterialPath(path: string): unknown;
  openVaultPath(path: string): unknown;
}

const CODE_EXTENSIONS = new Set([
  '.c', '.cc', '.cpp', '.cs', '.css', '.go', '.h', '.hpp', '.ini', '.ipynb',
  '.java', '.js', '.jsx', '.json', '.jsonl', '.kt', '.less', '.lua', '.md',
  '.mjs', '.php', '.properties', '.py', '.r', '.rb', '.rs', '.sass', '.scss',
  '.sh', '.sql', '.swift', '.tex', '.toml', '.ts', '.tsx', '.txt', '.xml',
  '.yaml', '.yml', '.zsh',
]);

/** VS Code's file URL keeps spaces, hashes and non-ASCII names attached to the
 * file they belong to instead of letting Electron interpret them as URL syntax. */
export function visualStudioCodeUrl(path: string): string {
  const url = new URL('vscode://file');
  const portable = String(path || '').replace(/\\/g, '/');
  url.pathname = portable.startsWith('/') ? portable : `/${portable}`;
  return url.href;
}

function normalizedVaultPath(value: string): string {
  let path = String(value || '').trim();
  const wiki = path.match(/^\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/);
  if (wiki?.[1]) path = wiki[1];
  const markdown = path.match(/^\[[^\]]*\]\((.+)\)$/);
  if (markdown?.[1]) path = markdown[1];
  path = path.replace(/\\/g, '/').replace(/^\.\//, '');
  const subpath = path.search(/[?#]/);
  if (subpath >= 0) path = path.slice(0, subpath);
  try { path = decodeURIComponent(path); } catch (_) { /* Keep the literal path. */ }
  return path;
}

function resolvedWithin(root: string, candidate: string): string | null {
  try {
    const realRoot = fs.realpathSync(root);
    const realCandidate = fs.realpathSync(candidate);
    const relative = nodePath.relative(realRoot, realCandidate);
    return relative.startsWith('..') || nodePath.isAbsolute(relative)
      ? null
      : realCandidate;
  } catch (_) {
    return null;
  }
}

/** All paths and URLs leaving the projection cross this allowlisted adapter. */
export class ResourceOpener {
  constructor(private readonly app: App) {}

  async openVaultPath(path: string): Promise<WorkspaceLeaf | undefined> {
    const target = normalizedVaultPath(path);
    if (!target || target.startsWith('/') || target.split('/').includes('..')) {
      new Notice(`Unsafe vault path refused: ${path || 'unknown path'}`);
      return undefined;
    }
    // Obsidian paths are lexical. Resolve a local symlink before asking the
    // vault to open it so a path cannot tunnel outside the vault.
    const candidate = nodePath.resolve(this.app.vault.adapter.getBasePath(), target);
    if (fs.existsSync(candidate)) {
      try {
        fs.realpathSync(candidate);
      } catch (_) {
        new Notice(`File unavailable: ${target}`);
        return undefined;
      }
      const realPath = resolvedWithin(
        this.app.vault.adapter.getBasePath(),
        candidate,
      );
      if (!realPath) {
        new Notice(`Unsafe vault symlink refused: ${target}`);
        return undefined;
      }
    }
    const file = this.app.vault.getAbstractFileByPath(target);
    if (!file) { new Notice(`File unavailable: ${target}`); return undefined; }
    let existing: WorkspaceLeaf | null = null;
    this.app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
      if (!existing && leaf.view?.file?.path === target) existing = leaf;
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

  private isCodePath(path: string): boolean {
    if (!fs.existsSync(path)) return false;
    const extension = nodePath.extname(path).toLocaleLowerCase();
    return !extension || CODE_EXTENSIONS.has(extension);
  }

  private async openSystemPath(path: string, successMessage: string): Promise<boolean> {
    const error = await shell.openPath(path);
    if (error) { new Notice(`Could not open file: ${error}`); return false; }
    new Notice(successMessage);
    return true;
  }

  private async openCodePath(path: string): Promise<boolean> {
    try {
      await shell.openExternal(visualStudioCodeUrl(path));
      new Notice('Opened in Visual Studio Code.');
      return true;
    } catch (_) {
      new Notice('Visual Studio Code was unavailable; opening in the system app instead.');
      return this.openSystemPath(path, 'Opened in the system app.');
    }
  }

  private openPreferredLocalPath(
    path: string,
    systemMessage: string,
  ): Promise<boolean> {
    let realPath = '';
    try { realPath = fs.realpathSync(path); } catch (_) {
      new Notice(`File unavailable: ${path || 'unknown path'}`);
      return Promise.resolve(false);
    }
    return this.isCodePath(realPath)
      ? this.openCodePath(realPath)
      : this.openSystemPath(realPath, systemMessage);
  }

  async openExternalPath(path: string, successMessage = 'Opened in the default app.'): Promise<boolean> {
    if (!path || !fs.existsSync(path)) { new Notice(`File unavailable: ${path || 'unknown path'}`); return false; }
    let realPath = '';
    try { realPath = fs.realpathSync(path); } catch (_) {
      new Notice(`File unavailable: ${path || 'unknown path'}`);
      return false;
    }
    return this.openSystemPath(realPath, successMessage);
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
    const realPath = resolvedWithin(materialsRoot, fullPath);
    if (!realPath) {
      new Notice(`Unsafe material symlink refused: ${path || 'unknown path'}`);
      return false;
    }
    return this.openExternalPath(realPath, 'Opened the local material in its default app.');
  }

  openAuthoredPath(path: string): Promise<boolean | WorkspaceLeaf | undefined> | false {
    const extension = nodePath.extname(path || '').toLocaleLowerCase();
    if (['.md', '.pdf', '.canvas', '.base'].includes(extension)) return this.openVaultPath(path);
    const base = this.app.vault.adapter.getBasePath();
    const fullPath = nodePath.resolve(base, path || '');
    const relative = nodePath.relative(base, fullPath);
    if (!path || relative.startsWith('..') || nodePath.isAbsolute(relative)) {
      new Notice(`Unsafe vault path refused: ${path || 'unknown path'}`);
      return false;
    }
    if (!fs.existsSync(fullPath)) {
      new Notice(`File unavailable: ${path || 'unknown path'}`);
      return false;
    }
    const realPath = resolvedWithin(base, fullPath);
    if (!realPath) {
      new Notice(`Unsafe vault symlink refused: ${path || 'unknown path'}`);
      return false;
    }
    return this.openPreferredLocalPath(
      realPath,
      'Opened the authored file in its default app.',
    );
  }

  openResource(
    resource: ProjectionRecord,
    ports: ResourceOpenPorts = this,
  ): unknown {
    const materialPath = typeof resource.material_path === 'string'
      ? resource.material_path
      : '';
    if (isDirectMaterialFileTarget(resource)) {
      return ports.openMaterialPath(materialPath);
    }
    const vaultPath = typeof resource.vault_path === 'string' ? resource.vault_path : '';
    if (vaultPath.trim()) {
      if (vaultPath.trim().toLowerCase().startsWith('material://')) {
        // A projected local file takes precedence above. An unresolved
        // material URI is not handed to Obsidian, but a safe web target on the
        // same source may still be the correct direct destination.
      } else if (isFileShapedPath(vaultPath)) {
        return ports.openVaultPath(vaultPath);
      }
    }
    if (resource.url) {
      const url = safeWebUrl(resource.url);
      if (!url) { new Notice(`Refused an unsupported link: ${String(resource.url).slice(0, 80)}`); return false; }
      return Promise.resolve(shell.openExternal(url.href)).catch(() => {
        new Notice('Could not open the link in your browser.');
        return false;
      });
    }
    if (materialPath.trim()) {
      new Notice(resource.material_exists === false
        ? `File unavailable: ${materialPath.trim()}`
        : 'Choose an exact file from this material collection.');
    } else if (vaultPath.trim().toLowerCase().startsWith('material://')) {
      new Notice(`Refused an unresolved material link: ${vaultPath.trim().slice(0, 80)}`);
    } else if (vaultPath.trim()) {
      new Notice('Choose an exact file from this vault collection.');
    }
    return false;
  }

  copyText(value: string): void {
    try { void navigator.clipboard.writeText(value); new Notice(`Copied ${value}`); }
    catch (_) { new Notice(value); }
  }
}
