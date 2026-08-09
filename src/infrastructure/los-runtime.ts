import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as nodePath from 'node:path';
import process from 'node:process';

export interface PythonResolution {
  readonly path: string;
  readonly origin: string;
  readonly attempted: string[];
}

export type LosCallback = (
  error: Error | null,
  stdout: string,
  stderr: string,
) => void;

interface LosRuntimeHost {
  readonly vault: {
    readonly adapter: {
      getBasePath(): string;
    };
  };
}

/** Host-process adapter for the stable LearningOS CLI. */
export class LosRuntime {
  constructor(
    private readonly app: LosRuntimeHost,
    private readonly configuredPython: () => string,
  ) {}

  resolvePython(): PythonResolution {
    const base = this.app.vault.adapter.getBasePath();
    const configured = this.configuredPython().trim();
    const searchOrder: Array<readonly [string, string]> = [
      [configured, 'configured in settings'],
      [nodePath.join(base, '.venv', 'bin', 'python'), 'project virtual environment'],
      [nodePath.join(base, '.venv', 'Scripts', 'python.exe'), 'project virtual environment (Windows)'],
    ];
    const candidates = searchOrder.filter(([path]) => path);
    const attempted = candidates.map(([path]) => path);
    for (const [path, origin] of candidates) {
      if (fs.existsSync(path)) return { path, origin, attempted };
    }
    const fallback = process.platform === 'win32' ? 'python' : 'python3';
    return { path: fallback, origin: 'PATH fallback', attempted: [...attempted, fallback] };
  }

  run(args: string[], callback: LosCallback, stdin?: string): void {
    const base = this.app.vault.adapter.getBasePath();
    const script = nodePath.join(base, 'tools', 'los.py');
    const child = execFile(
      this.resolvePython().path,
      [script, ...args],
      { cwd: base, timeout: 180000, maxBuffer: 8 * 1024 * 1024 },
      callback,
    );
    if (stdin !== undefined) child.stdin?.end(stdin);
  }
}
