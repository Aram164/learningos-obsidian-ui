import type { GatewayResultV1 } from '../../contracts/gateway-v1';
import type { ProjectionRecord } from '../../contracts/manifest';
import {
  JOB_DASHBOARD_CONTRACT,
  type JobAnchorFreshness,
  type JobDashboard,
  type JobHorizon,
  type JobLayer,
  type JobLearningResource,
  type JobLearningTrack,
  type JobNote,
  type JobPaper,
  type JobShelfSource,
  type JobTask,
} from '../../contracts/job-dashboard';
import {
  asFiniteNumber,
  asNumber,
  asNumberRecord,
  asNumbers,
  asRecordOrEmpty,
  asRecords,
  asTrimmedString,
  asTrimmedStrings,
} from '../../projection/readers';

export type {
  JobDashboard,
  JobHorizon,
  JobLayer,
  JobLearningResource,
  JobLearningStage,
  JobLearningTrack,
  JobMentalModel,
  JobNote,
  JobPaper,
  JobShelfSource,
  JobTab,
  JobTask,
  JobWorkspace,
  JobWorkspaceScope,
} from '../../contracts/job-dashboard';

function horizon(value: unknown): JobHorizon {
  return value === 'now' || value === 'next' ? value : 'later';
}

/**
 * Narrow the producer's computed freshness label. An unrecognised value falls
 * to `unverified` rather than to `current`: the whole point of the field is
 * that an unanswered question must never read as a clean bill of health.
 */
function anchorFreshness(value: unknown): JobAnchorFreshness {
  if (value === '') return '';
  return value === 'current' || value === 'drifting' || value === 'stale'
    ? value
    : 'unverified';
}

function relativeJobPath(value: unknown): string {
  const path = asTrimmedString(value).replace(/\\/g, '/').replace(/^\.\//, '');
  if (!path || path.startsWith('/') || path.split('/').includes('..')) return '';
  return path;
}

function note(value: unknown): JobNote | null {
  const row = asRecordOrEmpty(value);
  const id = asTrimmedString(row.id);
  const title = asTrimmedString(row.title);
  const path = relativeJobPath(row.path);
  if (!id || !title || !path) return null;
  return {
    id,
    title,
    kind: row.kind === 'stratum'
      ? 'stratum'
      : row.kind === 'learning' ? 'learning' : 'skrub',
    family: asTrimmedString(row.family),
    summary: asTrimmedString(row.summary),
    body: asTrimmedString(row.body),
    path,
    component: asTrimmedString(row.component),
    layer: asTrimmedString(row.layer),
    verified_against: asTrimmedString(row.verified_against),
    declared_status: asTrimmedString(row.declared_status),
    freshness: asTrimmedString(row.freshness) || 'unverified',
    revision: asNumber(row.revision),
  };
}

function track(value: unknown): JobLearningTrack | null {
  const row = asRecordOrEmpty(value);
  const id = asTrimmedString(row.id);
  const title = asTrimmedString(row.title);
  const path = relativeJobPath(row.path);
  if (!id || !title || !path) return null;
  return {
    id,
    title,
    path,
    status: asTrimmedString(row.status) || 'ready',
    cadence: asTrimmedString(row.cadence),
    horizon: horizon(row.horizon),
    outcome: asTrimmedString(row.outcome),
    stages: asRecords(row.stages).map((stage) => {
      const context = asRecordOrEmpty(stage.job_context);
      const resources = asRecords(stage.resources).map((resource): JobLearningResource => {
        const url = asTrimmedString(resource.url) || null;
        const vaultPath = relativeJobPath(resource.vault_path) || null;
        const resourceRecord: ProjectionRecord = { ...resource };
        if (url) resourceRecord.url = url;
        if (vaultPath) resourceRecord.vault_path = vaultPath;
        return {
          record: resourceRecord,
          id: asTrimmedString(resource.id) || null,
          kind: asTrimmedString(resource.kind) || 'read',
          label: asTrimmedString(resource.label) || 'Resource',
          locator: asTrimmedString(resource.locator) || null,
          sourceId: asTrimmedString(resource.source_id) || null,
          scopeTriage: asTrimmedString(resource.scope_triage) || null,
          canOpen: Boolean(url || vaultPath),
          url,
          vaultPath,
        };
      });
      return {
        id: asTrimmedString(stage.id),
        number: asNumber(stage.number),
        title: asTrimmedString(stage.title),
        status: asTrimmedString(stage.status) || 'pending',
        objective: asTrimmedString(stage.objective),
        doneWhen: asTrimmedStrings(stage.done_when),
        estimateMinutes: asNumber(stage.estimate_minutes) || null,
        examCritical: stage.exam_critical === true,
        concepts: asTrimmedStrings(stage.concepts),
        scopeTriage: asTrimmedString(stage.scope_triage) || 'required-now',
        resources,
        jobContext: {
          mentalModels: asRecords(context.mental_models).map((model) => ({
            label: asTrimmedString(model.label),
            text: asTrimmedString(model.text),
          })).filter((model) => model.label && model.text),
          readOnlyAnchor: asTrimmedString(context.read_only_anchor),
          component: asTrimmedStrings(context.component),
          verifiedAgainst: asTrimmedString(context.verified_against),
          freshness: anchorFreshness(context.freshness),
        },
        done: stage.done === true,
      };
    }).filter((stage) => stage.id && stage.number > 0 && stage.title),
    completedSessions: asNumbers(row.completed_sessions),
    lastSessionAt: asTrimmedString(row.last_session_at),
    sourceKind: row.source_kind === 'structured' ? 'structured' : 'legacy-markdown',
    // Null and absent both mean "not authored from the current template", and
    // both must stay distinguishable from 0 — reading this with asNumber()
    // would turn a pre-standard plan into one claiming template version zero.
    planTemplateVersion: asFiniteNumber(row.plan_template_version),
    revision: asNumber(row.revision),
  };
}

function task(value: unknown): JobTask | null {
  const row = asRecordOrEmpty(value);
  const id = asTrimmedString(row.id);
  const title = asTrimmedString(row.title);
  if (!id || !title) return null;
  return {
    id,
    title,
    details: asTrimmedString(row.details),
    horizon: horizon(row.horizon),
    status: row.status === 'done' ? 'done' : 'open',
    trackId: asTrimmedString(row.track_id),
    createdAt: asTrimmedString(row.created_at),
    updatedAt: asTrimmedString(row.updated_at),
    revision: asNumber(row.revision),
  };
}

function layer(value: unknown): JobLayer | null {
  const row = asRecordOrEmpty(value);
  const id = asTrimmedString(row.id);
  if (!id) return null;
  return {
    id,
    title: asTrimmedString(row.title) || id,
    summary: asTrimmedString(row.summary),
    noteIds: Array.isArray(row.note_ids)
      ? row.note_ids.filter((item): item is string => typeof item === 'string')
      : [],
  };
}

function paper(value: unknown): JobPaper | null {
  const row = asRecordOrEmpty(value);
  const id = asTrimmedString(row.id);
  const title = asTrimmedString(row.title);
  const path = relativeJobPath(row.path);
  if (!id || !title || !path) return null;
  return {
    id,
    title,
    path,
    authors: asTrimmedStrings(row.authors),
    year: row.year == null ? '' : String(row.year),
    pages: asNumber(row.pages),
    horizon: horizon(row.horizon),
    angle: asTrimmedString(row.angle),
    available: row.available === true,
  };
}

function shelfSource(value: unknown): JobShelfSource | null {
  const row = asRecordOrEmpty(value);
  const sourceId = asTrimmedString(row.source_id);
  const title = asTrimmedString(row.title);
  if (!sourceId || !title) return null;
  return {
    source_id: sourceId,
    title,
    type: asTrimmedString(row.type) || 'source',
    authors: asTrimmedStrings(row.authors),
    horizon: horizon(row.horizon),
    why: asTrimmedString(row.why),
  };
}

export function asJobDashboard(result: GatewayResultV1): JobDashboard | null {
  if (result.ok !== true || result.contract !== JOB_DASHBOARD_CONTRACT) return null;
  const raw = asRecordOrEmpty(result.dashboard);
  const workspaceRaw = asRecordOrEmpty(raw.workspace);
  const workspacePath = relativeJobPath(workspaceRaw.path);
  const title = asTrimmedString(raw.title);
  if (!title || !workspacePath) return null;
  const noteRaw = asRecordOrEmpty(raw.notes);
  return {
    id: asTrimmedString(raw.id) || 'job-dashboard',
    title,
    subtitle: asTrimmedString(raw.subtitle),
    workspace: {
      id: asTrimmedString(workspaceRaw.id) || 'workspace-job-deem',
      title: asTrimmedString(workspaceRaw.title) || title,
      status: asTrimmedString(workspaceRaw.status) || 'active',
      standing: workspaceRaw.standing === true,
      objective: asTrimmedString(workspaceRaw.objective),
      current_scope: asRecords(workspaceRaw.current_scope).map((scope) => ({
        label: asTrimmedString(scope.label),
        text: asTrimmedString(scope.text),
      })).filter((scope) => scope.label && scope.text),
      next_action: asTrimmedString(workspaceRaw.next_action),
      open_questions: asTrimmedStrings(workspaceRaw.open_questions),
      path: workspacePath,
    },
    notes: {
      learning: asRecords(noteRaw.learning).map(note).filter((item): item is JobNote => item !== null),
      skrub: asRecords(noteRaw.skrub).map(note).filter((item): item is JobNote => item !== null),
      stratum: asRecords(noteRaw.stratum).map(note).filter((item): item is JobNote => item !== null),
      health: asNumberRecord(noteRaw.health),
      layers: asRecords(noteRaw.layers).map(layer).filter((item): item is JobLayer => item !== null),
    },
    learning_tracks: asRecords(raw.learning_tracks)
      .map(track).filter((item): item is JobLearningTrack => item !== null),
    tasks: asRecords(raw.tasks).map(task).filter((item): item is JobTask => item !== null),
    papers: asRecords(raw.papers).map(paper).filter((item): item is JobPaper => item !== null),
    canonical_shelf: asRecords(raw.canonical_shelf)
      .map(shelfSource).filter((item): item is JobShelfSource => item !== null),
    counts: asNumberRecord(raw.counts),
  };
}
