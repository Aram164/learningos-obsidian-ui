import { createHash } from 'node:crypto';
/**
 * One serialized lifecycle for editable Atlas boards (P3 steps 19, 21).
 * The vault port is the only host surface; tests drive a fake port.
 */
import {
  mergeBoards, parseBoard, parseSidecar, serializeBoard, sidecarFor,
  type BoardSidecar, type CanvasData,
} from './board-merge';

export interface BoardCatalogEntry {
  kind: string;
  id: string;
  title?: string;
  parent_kind?: string | null;
  parent_id?: string | null;
  template_path: string;
  working_path: string;
  sha256: string;
  concept_count?: number;
  relation_count?: number;
}

/**
 * The board a plain Atlas opening means (P4 step 23): the named module when
 * the route provides one, else the one explicitly current program/semester.
 * Ambiguity yields null — the select then says "Choose a board".
 */
export function defaultBoardEntry(
  catalog: readonly BoardCatalogEntry[],
  moduleId: string | null,
  currentSemester: { id?: unknown; program_id?: unknown } | null,
): BoardCatalogEntry | null {
  if (moduleId) {
    const module = catalog.find((entry) => entry.kind === 'module' && entry.id === moduleId);
    if (module) return module;
  }
  if (typeof currentSemester?.id === 'string' && typeof currentSemester?.program_id === 'string') {
    const wanted = `${currentSemester.program_id}--${currentSemester.id}`;
    const matches = catalog.filter((entry) => entry.kind === 'semester' && entry.id === wanted);
    if (matches.length === 1) return matches[0] ?? null;
  }
  return null;
}

export interface BoardVaultPort {
  read(path: string): Promise<string | null>;
  create(path: string, text: string): Promise<void>;
  /** Atomic read-modify-write; `fn` returns null to refuse without writing. */
  process(path: string, fn: (latest: string) => string | null): Promise<boolean>;
  openLeaf(path: string): Promise<void>;
  managedCanvasOpen(): Promise<boolean>;
}

export type BoardResult =
  | { ok: true; action: 'opened' | 'created' | 'refreshed' | 'portal-target' }
  | { ok: false; reason: string };

export type BoardRefreshPreview = {
  readonly ok: true;
  readonly workingText: string;
  readonly templateText: string;
  readonly ownershipText: string;
  readonly changes: readonly string[];
};

export function sidecarPath(entry: BoardCatalogEntry): string {
  return `boards/atlas/.state/${entry.kind}/${entry.id}.json`;
}

export function advancedBoardAvailable(settingEnabled: boolean, pluginEnabled: boolean): boolean {
  return settingEnabled && pluginEnabled;
}

const SCOPE_KINDS = new Set(['semester', 'module', 'lecture', 'exam']);
const SCOPE_ID = /^[a-z0-9][a-z0-9._-]*$/;

function validPaths(entry: BoardCatalogEntry): boolean {
  if (!SCOPE_KINDS.has(entry.kind) || !SCOPE_ID.test(entry.id)) return false;
  const suffix = `${entry.kind}/${entry.id}.canvas`;
  return entry.template_path === `generated/atlas/templates/${suffix}`
    && entry.working_path === `boards/atlas/${suffix}`;
}

function verifiedTemplate(entry: BoardCatalogEntry, text: string | null): CanvasData | null {
  if (text === null || createHash('sha256').update(new TextEncoder().encode(text)).digest('hex') !== entry.sha256) return null;
  const template = parseBoard(text);
  if (!template || !mergeBoards([], {}, template).ok) return null;
  return template;
}

export class BoardController {
  private lane: Promise<unknown> = Promise.resolve();

  constructor(private readonly port: BoardVaultPort) {}

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.lane.then(task, task);
    this.lane = run.then(() => undefined, () => undefined);
    return run;
  }

  openBoard(entry: BoardCatalogEntry, templateText: string | null): Promise<BoardResult> {
    return this.enqueue(() => this.openBoardNow(entry, templateText));
  }

  previewRefresh(entry: BoardCatalogEntry): Promise<BoardRefreshPreview | { ok: false; reason: string }> {
    return this.enqueue(async () => {
      if (!validPaths(entry)) return { ok: false, reason: 'Board paths do not match the selected scope.' };
      if (await this.port.managedCanvasOpen()) {
        return { ok: false, reason: 'Close all managed Atlas boards before refreshing, and leave the Atlas pane open.' };
      }
      const [templateText, workingText, ownershipText] = await Promise.all([
        this.port.read(entry.template_path), this.port.read(entry.working_path), this.port.read(sidecarPath(entry)),
      ]);
      const template = verifiedTemplate(entry, templateText);
      const working = workingText === null ? null : parseBoard(workingText);
      const ownership = ownershipText === null ? null : parseSidecar(ownershipText);
      if (!template || !working || !ownership || templateText === null || workingText === null || ownershipText === null) {
        return { ok: false, reason: 'The board, template or ownership record is unavailable. Rebuild views and inspect the files.' };
      }
      const merge = mergeBoards(ownership.managed_ids, working, template);
      if (!merge.ok) return merge;
      const before = new Map([...(working.nodes ?? []), ...(working.edges ?? [])].map((object) => [object.id, object]));
      const after = new Map([...(merge.canvas.nodes ?? []), ...(merge.canvas.edges ?? [])].map((object) => [object.id, object]));
      const changes: string[] = [];
      for (const id of new Set([...ownership.managed_ids, ...merge.managedIds])) {
        if (!before.has(id) && after.has(id)) changes.push(`Add ${id}`);
        else if (!after.has(id) && before.has(id)) changes.push(`Remove ${id}`);
        else if (JSON.stringify(before.get(id)) !== JSON.stringify(after.get(id))) changes.push(`Update ${id}`);
      }
      return { ok: true, workingText, templateText, ownershipText, changes };
    });
  }

  refreshBoard(
    entry: BoardCatalogEntry, templateText: string | null, previewText: string, ownershipText?: string,
  ): Promise<BoardResult> {
    return this.enqueue(() => this.refreshBoardNow(entry, templateText, previewText, ownershipText));
  }

  private async openBoardNow(entry: BoardCatalogEntry, templateText: string | null): Promise<BoardResult> {
    if (!validPaths(entry)) return { ok: false, reason: 'Board paths do not match the selected scope.' };
    const existing = await this.port.read(entry.working_path);
    if (existing !== null) {
      await this.port.openLeaf(entry.working_path);
      return { ok: true, action: 'opened' };
    }
    const template = verifiedTemplate(entry, templateText);
    if (!template || templateText === null) {
      return { ok: false, reason: 'Board template is unavailable or changed. Rebuild views and try again.' };
    }
    if (await this.port.read(sidecarPath(entry)) !== null) {
      return { ok: false, reason: 'The board is absent but its ownership record exists. Restore the board before opening it.' };
    }
    await this.port.create(entry.working_path, templateText);
    const managed = [...(template.nodes ?? []), ...(template.edges ?? [])].map((node) => String(node.id));
    await this.port.create(sidecarPath(entry), JSON.stringify(sidecarFor(entry.sha256, managed)) + '\n');
    await this.port.openLeaf(entry.working_path);
    return { ok: true, action: 'created' };
  }

  private async refreshBoardNow(
    entry: BoardCatalogEntry, templateText: string | null, previewText: string, ownershipText?: string,
  ): Promise<BoardResult> {
    if (!validPaths(entry)) return { ok: false, reason: 'Board paths do not match the selected scope.' };
    if (await this.port.managedCanvasOpen()) {
      return {
        ok: false,
        reason: 'Close all managed Atlas boards before refreshing, and leave the Atlas pane open.',
      };
    }
    const template = verifiedTemplate(entry, templateText);
    if (!template || templateText === null) {
      return { ok: false, reason: 'Board template is unavailable or changed. Rebuild views and try again.' };
    }
    const sidecarText = await this.port.read(sidecarPath(entry));
    if (ownershipText !== undefined && sidecarText !== ownershipText) {
      return { ok: false, reason: 'Board ownership changed since the preview. Review it again.' };
    }
    const sidecar: BoardSidecar | null = sidecarText ? parseSidecar(sidecarText) : null;
    if (!sidecar) {
      return {
        ok: false,
        reason: 'Board ownership cannot be verified. Reopen it and review before refreshing.',
      };
    }
    let failure: string | null = null;
    let managed: string[] = [];
    const wrote = await this.port.process(entry.working_path, (latest) => {
      if (latest !== previewText) {
        failure = 'Board changed. Reopen it and review before refreshing.';
        return null;
      }
      const working = parseBoard(latest);
      if (!working) { failure = 'Board is malformed; nothing was written.'; return null; }
      const merged = mergeBoards(sidecar.managed_ids, working, template);
      if (!merged.ok) { failure = merged.reason; return null; }
      managed = merged.managedIds;
      return serializeBoard(merged.canvas);
    });
    if (!wrote) return { ok: false, reason: failure ?? 'Board refresh was refused.' };
    const settled = await this.port.process(sidecarPath(entry), (latest) =>
      latest === sidecarText ? JSON.stringify(sidecarFor(entry.sha256, managed)) + '\n' : null);
    if (!settled) return { ok: false, reason: 'Board merged but ownership changed. Review both files before refreshing again.' };
    return { ok: true, action: 'refreshed' };
  }

  /**
   * Point a parent board's managed child link at the editable child board
   * (step 21). The child board must already exist; the same closed-board
   * guard as refresh applies, and the portal flag is left exactly as found.
   */
  useEditableChild(
    parent: BoardCatalogEntry,
    child: BoardCatalogEntry,
  ): Promise<BoardResult> {
    return this.enqueue(async () => {
      if (!validPaths(parent) || !validPaths(child)
          || child.parent_kind !== parent.kind || child.parent_id !== parent.id) {
        return { ok: false, reason: 'The selected board is not a child of that parent.' };
      }
      if (await this.port.managedCanvasOpen()) {
        return {
          ok: false,
          reason: 'Close all managed Atlas boards before changing a portal target.',
        };
      }
      if (await this.port.read(child.working_path) === null) {
        return { ok: false, reason: 'Create the editable child board first (Open board on the child scope).' };
      }
      const childNodeId = `los-scope-${child.kind}--${child.id}`;
      let failure: string | null = null;
      const wrote = await this.port.process(parent.working_path, (latest) => {
        const board = parseBoard(latest);
        if (!board) { failure = 'Board is malformed; nothing was written.'; return null; }
        const nodes = (board.nodes ?? []).map((node) => {
          if (node.id !== childNodeId) return node;
          if (node.file !== child.template_path && node.file !== child.working_path) {
            failure = 'The child link no longer points at an accepted target.';
            return node;
          }
          return { ...node, file: child.working_path };
        });
        if (failure) return null;
        if (!nodes.some((node) => node.id === childNodeId)) {
          failure = 'This board has no link to that child scope.';
          return null;
        }
        return serializeBoard({ ...board, nodes });
      });
      if (!wrote) return { ok: false, reason: failure ?? 'Portal target change was refused.' };
      return { ok: true, action: 'portal-target' };
    });
  }
}
