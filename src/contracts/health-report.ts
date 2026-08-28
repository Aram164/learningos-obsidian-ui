export interface HealthCheckV1 {
  readonly id: string;
  readonly status: 'ok' | 'warning' | 'error' | 'unknown';
  readonly summary: string;
  readonly owner: string;
  readonly remedy: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface HealthReportV1 {
  readonly schema_version: 1;
  readonly type: 'health-report';
  readonly generated_at: string;
  readonly status: 'healthy' | 'attention-required';
  readonly checks: readonly HealthCheckV1[];
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function exactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key))
    && Object.keys(value).every((key) => allowed.has(key));
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function dateTime(value: unknown): value is string {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
}

/** Strict decoder for system/schema/health-report.schema.json. */
export function asHealthReport(value: unknown): HealthReportV1 | null {
  const report = record(value);
  if (!report || !exactKeys(
    report,
    ['schema_version', 'type', 'generated_at', 'status', 'checks'],
  ) || report.schema_version !== 1 || report.type !== 'health-report'
    || !dateTime(report.generated_at)
    || !['healthy', 'attention-required'].includes(String(report.status))
    || !Array.isArray(report.checks)) return null;

  const checks: HealthCheckV1[] = [];
  for (const valueCheck of report.checks) {
    const check = record(valueCheck);
    if (!check || !exactKeys(
      check,
      ['id', 'status', 'summary', 'owner', 'remedy'],
      ['details'],
    ) || !text(check.id)
      || !['ok', 'warning', 'error', 'unknown'].includes(String(check.status))
      || !text(check.summary) || !text(check.owner) || !text(check.remedy)
      || ('details' in check && record(check.details) === null)) return null;
    checks.push({
      id: check.id,
      status: check.status as HealthCheckV1['status'],
      summary: check.summary,
      owner: check.owner,
      remedy: check.remedy,
      ...(check.details ? { details: check.details as Readonly<Record<string, unknown>> } : {}),
    });
  }
  const aggregate = checks.every((check) => check.status === 'ok')
    ? 'healthy'
    : 'attention-required';
  if (report.status !== aggregate) return null;
  return {
    schema_version: 1,
    type: 'health-report',
    generated_at: report.generated_at,
    status: report.status as HealthReportV1['status'],
    checks,
  };
}
