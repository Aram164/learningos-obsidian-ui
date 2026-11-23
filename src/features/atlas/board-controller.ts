/**
 * One serialized lifecycle for editable Atlas boards (P3 steps 19, 21).
 * The vault port is the only host surface; tests drive a fake port.
 */
import {
  mergeBoards, parseBoard, parseSidecar, serializeBoard, sidecarFor,
  type BoardSidecar,
} from './board-merge';

export interface BoardCatalogEntry {
  kind: string;
  id: string;
  template_path: string;
  working_path: string;
  sha256: string;
}

export interface BoardVaultPort {
  read(path: string): Promise<string | null>;
  create(path: string, text: string): Promise<void>;
  /** Atomic read-modify-write; `fn` returns null to refuse without writing. */
  process(path: string, fn: (latest: string) => string | null): Promise<boolean>;
  openLeaf(path: string): Promise<void>;
  managedCanvasOpen(workingPaths: readonly string[]): Promise<boolean>;
}

export type BoardResult =
  | { ok: true; action: 'opened' | 'created' | 'refreshed' }
  | { ok: false; reason: string };

export function sidecarPath(entry: BoardCatalogEntry): string {
  return `boards/atlas/.state/${entry.kind}/${entry.id}.json`;
}

export function advancedBoardAvailable(settingEnabled: boolean, pluginEnabled: boolean): boolean {
  return settingEnabled && pluginEnabled;
}

export class BoardController {
  private lane: Promise<unknown> = Promise.resolve();

  constructor(private readonly port: BoardVaultPort) {}

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.lane.then(task, task);
    this.lane = run.then(() => undefined, () => undefined);
    return run;
  }

  openBoard(entry: BoardCatalogEntry, templateText: string): Promise<BoardResult> {
    return this.enqueue(() => this.openBoardNow(entry, templateText));
  }

  refreshBoard(
    entry: BoardCatalogEntry, templateText: string, previewText: string,
  ): Promise<BoardResult> {
    return this.enqueue(() => this.refreshBoardNow(entry, templateText, previewText));
  }

  private async openBoardNow(entry: BoardCatalogEntry, templateText: string): Promise<BoardResult> {
    const existing = await this.port.read(entry.working_path);
    if (existing !== null) {
      await this.port.openLeaf(entry.working_path);
      return { ok: true, action: 'opened' };
    }
    const template = parseBoard(templateText);
    if (!template) return { ok: false, reason: 'Board template is unavailable.' };
    await this.port.create(entry.working_path, templateText);
    const managed = [...(template.nodes ?? []), ...(template.edges ?? [])].map((node) => String(node.id));
    await this.port.create(sidecarPath(entry), JSON.stringify(sidecarFor(entry.sha256, managed)) + '\n');
    await this.port.openLeaf(entry.working_path);
    return { ok: true, action: 'created' };
  }

  private async refreshBoardNow(
    entry: BoardCatalogEntry, templateText: string, previewText: string,
  ): Promise<BoardResult> {
    if (await this.port.managedCanvasOpen([entry.working_path])) {
      return {
        ok: false,
        reason: 'Close the board before refreshing it, and leave the Atlas pane open.',
      };
    }
    const template = parseBoard(templateText);
    if (!template) return { ok: false, reason: 'Board template is unavailable.' };
    const sidecarText = await this.port.read(sidecarPath(entry));
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
    await this.port.process(sidecarPath(entry), () =>
      JSON.stringify(sidecarFor(entry.sha256, managed)) + '\n');
    return { ok: true, action: 'refreshed' };
  }
}
