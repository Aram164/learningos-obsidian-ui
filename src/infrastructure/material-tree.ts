import * as fs from 'node:fs';
import * as nodePath from 'node:path';
import { compareStrings, foldCase } from '../sorting';

/**
 * Reading the physical material tree, for the Library's folder browser.
 *
 * `ResourceOpener` already resolves a `material_path` to a real file and hands
 * it to the system opener. That is enough to *open* a leaf and not enough to
 * *browse*: a source such as `source-aml-ss26-lectures` is one registry record
 * whose material is a directory holding `lecture-slides/`, `exercise-slides/`
 * and `bonus-exercises/`. Those three folders are the distinction the learner
 * actually navigates by, and they exist only on disk — the projection carries
 * a single URI per source and says nothing about what is inside it.
 *
 * So the folder browser descends past the record into the directory, and this
 * module is the only place that touches the filesystem to do it.
 *
 * Containment is enforced the same way the opener enforces it, by realpath:
 * `materials/.flat/` is a directory of symlinks into the physical tree, so a
 * lexical prefix check would either reject every registered source or accept a
 * link pointing anywhere. A resolved path that escapes `materials/` yields an
 * empty listing rather than an error, because a Library folder that refuses to
 * render is worse feedback than a folder that is visibly empty.
 */

export interface MaterialEntry {
  /** Path relative to the learning root, i.e. `materials/…`, as the projection writes it. */
  readonly path: string;
  readonly name: string;
  readonly isDirectory: boolean;
  /** Bytes for a file; for a directory, its immediate item count. */
  readonly size: number;
  readonly childCount: number;
}

export interface MaterialTreeHost {
  readonly vault: {
    readonly adapter: {
      getBasePath(): string;
    };
  };
}

/*
 * Names that are storage mechanics rather than material.
 *
 * `.flat/` is the id-addressed symlink farm the registry resolves URIs
 * through; showing it would list all 84 material-bearing sources a second time
 * under every folder that happens to contain it.
 */
const HIDDEN_NAMES = new Set(['.flat', '.git', '.ds_store', '__pycache__']);

function hidden(name: string): boolean {
  return name.startsWith('.') || HIDDEN_NAMES.has(foldCase(name));
}

function containedRealPath(root: string, candidate: string): string | null {
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

/** Reads `materials/` for the Library folder browser, and nothing else. */
export class MaterialTree {
  constructor(private readonly app: MaterialTreeHost) {}

  private roots(): { learningRoot: string; materialsRoot: string } {
    const vault = this.app.vault.adapter.getBasePath();
    const learningRoot = nodePath.dirname(vault);
    return {
      learningRoot,
      materialsRoot: nodePath.resolve(learningRoot, 'materials'),
    };
  }

  /** The real, contained path for a projected `materials/…` path, or null. */
  resolve(path: string): string | null {
    if (!path) return null;
    const { learningRoot, materialsRoot } = this.roots();
    const full = nodePath.resolve(learningRoot, path);
    const lexical = nodePath.relative(materialsRoot, full);
    if (lexical.startsWith('..') || nodePath.isAbsolute(lexical)) return null;
    return containedRealPath(materialsRoot, full);
  }

  /** True when the projected path is a directory the browser can descend into. */
  isDirectory(path: string): boolean {
    const real = this.resolve(path);
    if (!real) return false;
    try {
      return fs.statSync(real).isDirectory();
    } catch (_) {
      return false;
    }
  }

  /** Immediate visible items, without stat-ing or descending into any of them. */
  count(path: string): number {
    const real = this.resolve(path);
    if (!real) return 0;
    try {
      return fs.readdirSync(real).filter((name) => !hidden(name)).length;
    } catch (_) {
      return 0;
    }
  }

  /**
   * One directory level, folders before files, each in the app's fixed
   * collation — which is numeric, so `VL 02` precedes `VL 11` rather than
   * sorting between `VL 10` and `VL 12`.
   *
   * `readdir` already reports the type, so the only syscalls past it are the
   * ones that answer a question the caller can see: one `stat` per file for its
   * size (and per symlink, to learn what it points at), and one `readdir` per
   * subdirectory for its item count. A `stat` on every plain directory would
   * buy nothing.
   */
  list(path: string): MaterialEntry[] {
    const real = this.resolve(path);
    if (!real) return [];
    let dirents: fs.Dirent[];
    try {
      dirents = fs.readdirSync(real, { withFileTypes: true });
    } catch (_) {
      return [];
    }

    const entries: MaterialEntry[] = [];
    const parent = path.replace(/\/+$/, '');
    for (const dirent of dirents) {
      if (hidden(dirent.name)) continue;
      const absolute = nodePath.join(real, dirent.name);
      let isDirectory = dirent.isDirectory();
      let size = 0;

      if (dirent.isSymbolicLink() || !isDirectory) {
        try {
          const stat = fs.statSync(absolute);
          isDirectory = stat.isDirectory();
          size = isDirectory ? 0 : stat.size;
        } catch (_) {
          // A broken link is still worth showing as the name it claims to be.
          isDirectory = false;
        }
      }

      entries.push({
        path: `${parent}/${dirent.name}`,
        name: dirent.name,
        isDirectory,
        size,
        childCount: isDirectory ? this.countAt(absolute) : 0,
      });
    }

    return entries.sort((left, right) => {
      if (left.isDirectory !== right.isDirectory) return left.isDirectory ? -1 : 1;
      return compareStrings(left.name, right.name);
    });
  }

  /** Item count for an already-resolved absolute directory. */
  private countAt(absolute: string): number {
    try {
      return fs.readdirSync(absolute).filter((name) => !hidden(name)).length;
    } catch (_) {
      return 0;
    }
  }
}

/** Human file size, in the units a file manager shows. */
export function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '';
  const units = ['bytes', 'KB', 'MB', 'GB'];
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = unit === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[unit]}`;
}
