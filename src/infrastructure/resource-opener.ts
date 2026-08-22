import { shell } from 'electron';
import * as fs from 'node:fs';
import * as nodePath from 'node:path';
import { Notice, type App, type WorkspaceLeaf } from 'obsidian';
import type { ProjectionRecord } from '../contracts/manifest';
import { safeWebUrl } from '../security/safe-url';

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

const JOB_READABLE_ROOTS = new Set([
  'legacy-plans', 'notes', 'papers', 'plans', 'workspace-job-deem',
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

/** All paths and URLs leaving the projection cross this allowlisted adapter. */
export class ResourceOpener {
  private jobAccessGranted = false;
  private jobAllowedRoots = new Set<string>();

  constructor(private readonly app: App) {}

  grantJobAccess(value: unknown): boolean {
    const access = value && typeof value === 'object'
      ? value as Record<string, unknown>
      : {};
    const declaredRoots = Array.isArray(access.allowed_roots) ? access.allowed_roots : [];
    const allowedRoots = declaredRoots.filter(
      (root): root is string => typeof root === 'string' && JOB_READABLE_ROOTS.has(root),
    );
    const rootsAreExact = allowedRoots.length === declaredRoots.length
      && new Set(allowedRoots).size === allowedRoots.length;
    const stratum = access.stratum && typeof access.stratum === 'object'
      ? access.stratum as Record<string, unknown>
      : {};
    this.jobAccessGranted = access.scope === 'job-dashboard'
      && access.read_only === true
      && access.ephemeral === true
      && access.excluded_from_manifest === true
      && access.excluded_from_search === true
      && access.excluded_from_ai === true
      && access.writes_through_gateway === true
      && stratum.mode === 'read-only'
      && stratum.worktree_writes_allowed === false
      && stratum.git_metadata_writes_allowed === false
      && typeof access.snapshot_id === 'string'
      && access.snapshot_id.startsWith('sha256:')
      && rootsAreExact
      && allowedRoots.length > 0;
    this.jobAllowedRoots = this.jobAccessGranted ? new Set(allowedRoots) : new Set();
    return this.jobAccessGranted;
  }

  isQuarantinedPath(path: string): boolean {
    const posix = String(path || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
    return posix === 'Job' || posix.startsWith('Job/') || posix.includes('/Job/');
  }

  isStratumPath(path: string): boolean {
    const posix = String(path || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
    return posix === 'Job/stratum'
      || posix.startsWith('Job/stratum/')
      || posix.includes('/Job/stratum/');
  }

  refuseQuarantined(path: string): boolean {
    if (!this.isQuarantinedPath(path)) return false;
    new Notice('Job/ is quarantined — LearningOS never opens or displays it.');
    return true;
  }

  async openVaultPath(path: string): Promise<WorkspaceLeaf | undefined> {
    if (this.refuseQuarantined(path)) return undefined;
    const target = normalizedVaultPath(path);
    if (!target || target.startsWith('/') || target.split('/').includes('..')) {
      new Notice(`Unsafe vault path refused: ${path || 'unknown path'}`);
      return undefined;
    }
    // Obsidian paths are lexical. Resolve a local symlink before asking the
    // vault to open it so an innocent-looking canonical path cannot tunnel
    // into Job (and especially not into the editable Stratum checkout).
    const candidate = nodePath.resolve(this.app.vault.adapter.getBasePath(), target);
    if (fs.existsSync(candidate)) {
      try {
        if (this.refuseQuarantined(fs.realpathSync(candidate))) return undefined;
      } catch (_) {
        new Notice(`File unavailable: ${target}`);
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
    allowJob = false,
  ): Promise<boolean> {
    let realPath = '';
    try { realPath = fs.realpathSync(path); } catch (_) {
      new Notice(`File unavailable: ${path || 'unknown path'}`);
      return Promise.resolve(false);
    }
    if (this.isQuarantinedPath(realPath)
        && (!allowJob || this.isStratumPath(realPath))) {
      new Notice(this.isStratumPath(realPath)
        ? 'Stratum is strictly read-only and cannot be opened in an editor.'
        : 'Job/ is quarantined — LearningOS never opens or displays it.');
      return Promise.resolve(false);
    }
    return this.isCodePath(realPath)
      ? this.openCodePath(realPath)
      : this.openSystemPath(realPath, systemMessage);
  }

  async openExternalPath(path: string, successMessage = 'Opened in the default app.'): Promise<boolean> {
    if (this.refuseQuarantined(path)) return false;
    if (!path || !fs.existsSync(path)) { new Notice(`File unavailable: ${path || 'unknown path'}`); return false; }
    let realPath = '';
    try { realPath = fs.realpathSync(path); } catch (_) {
      new Notice(`File unavailable: ${path || 'unknown path'}`);
      return false;
    }
    if (this.refuseQuarantined(realPath)) return false;
    return this.openSystemPath(realPath, successMessage);
  }

  /**
   * Deliberate Job-session exception. Ordinary open helpers still refuse every
   * Job path; only a validated, in-memory dashboard grant can reach this one.
   */
  async openJobPath(relativePath: string): Promise<boolean> {
    if (!this.jobAccessGranted) {
      new Notice('Open the confidential Job workspace before opening Job files.');
      return false;
    }
    const relative = String(relativePath || '').replace(/\\/g, '/').replace(/^\.\//, '');
    const top = relative.split('/')[0] || '';
    if (!relative || relative.startsWith('/') || relative.split('/').includes('..')
        || !this.jobAllowedRoots.has(top)) {
      new Notice('The Job dashboard refused a path outside its read-only allowlist.');
      return false;
    }
    const vault = this.app.vault.adapter.getBasePath();
    const semesterRoot = nodePath.dirname(nodePath.dirname(vault));
    const jobRoot = nodePath.resolve(semesterRoot, 'Job');
    const fullPath = nodePath.resolve(jobRoot, relative);
    if (!fs.existsSync(nodePath.join(jobRoot, 'README.md')) || !fs.existsSync(fullPath)) {
      new Notice(`Job file unavailable: ${relative || 'unknown path'}`);
      return false;
    }
    let realJobRoot = '';
    let realFullPath = '';
    try {
      realJobRoot = fs.realpathSync(jobRoot);
      realFullPath = fs.realpathSync(fullPath);
    } catch (_) {
      new Notice(`Job file unavailable: ${relative || 'unknown path'}`);
      return false;
    }
    const escaped = nodePath.relative(realJobRoot, realFullPath);
    const realTop = escaped.split(nodePath.sep)[0] || '';
    if (!escaped || escaped.startsWith('..') || nodePath.isAbsolute(escaped)
        || !this.jobAllowedRoots.has(realTop)) {
      new Notice('The Job dashboard refused a symlink outside its read-only allowlist.');
      return false;
    }
    return this.openPreferredLocalPath(
      realFullPath,
      'Opened from the confidential Job workspace.',
      true,
    );
  }

  /** Web references shown inside the ephemeral Job reader stay protocol-safe. */
  async openJobUrl(value: string): Promise<boolean> {
    if (!this.jobAccessGranted) {
      new Notice('Open the confidential Job workspace before opening its links.');
      return false;
    }
    const url = safeWebUrl(value);
    if (!url) {
      new Notice(`Refused an unsupported Job link: ${String(value || '').slice(0, 80)}`);
      return false;
    }
    try {
      await shell.openExternal(url.href);
      return true;
    } catch (_) {
      new Notice('Could not open the Job link in your browser.');
      return false;
    }
  }

  /**
   * Job may cite LearningOS one-way. This deliberately accepts only an
   * explicit `LearningOS/…` path and can never resolve back into Job/.
   */
  async openJobLearningPath(value: string): Promise<boolean> {
    if (!this.jobAccessGranted) {
      new Notice('Open the confidential Job workspace before opening its learning material.');
      return false;
    }
    const portable = normalizedVaultPath(value);
    const prefix = 'LearningOS/';
    if (!portable.startsWith(prefix) || portable.split('/').includes('..')) {
      new Notice('The Job dashboard refused a learning path outside LearningOS.');
      return false;
    }
    const relative = portable.slice(prefix.length);
    const vault = this.app.vault.adapter.getBasePath();
    const learningRoot = nodePath.dirname(vault);
    const fullPath = nodePath.resolve(learningRoot, relative);
    const escaped = nodePath.relative(learningRoot, fullPath);
    if (!relative || escaped.startsWith('..') || nodePath.isAbsolute(escaped)
        || !fs.existsSync(fullPath)) {
      new Notice(`Learning material unavailable: ${portable || 'unknown path'}`);
      return false;
    }
    return this.openPreferredLocalPath(fullPath, 'Opened the LearningOS material.');
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
    if (!fs.existsSync(fullPath)) {
      new Notice(`File unavailable: ${path || 'unknown path'}`);
      return false;
    }
    return this.openPreferredLocalPath(
      fullPath,
      'Opened the authored file in its default app.',
    );
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
      return Promise.resolve(shell.openExternal(url.href)).catch(() => {
        new Notice('Could not open the link in your browser.');
        return false;
      });
    }
    return false;
  }

  copyText(value: string): void {
    try { void navigator.clipboard.writeText(value); new Notice(`Copied ${value}`); }
    catch (_) { new Notice(value); }
  }
}
