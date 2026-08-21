import { Notice } from 'obsidian';
import { button } from '../../components';
import type { ProjectionRecord } from '../../contracts/manifest';
import type { AppSurface } from '../../app/surface';
import { errorMessage } from '../../projection/readers';

/**
 * The launcher needs the AI-action client, the remembered provider preference,
 * and a way to persist that preference. Nothing else — in particular it never
 * reaches the gateway or the store directly.
 */
type AiActionHost = Pick<
  AppSurface,
  | 'aiActions'
  | 'scheduleDraftSave'
  | 'settings'
>;

/** Compact, action-specific launcher. There is deliberately no generic
 * "Ask AI" entry point: the action ID, target and provider are visible before
 * the core prepares any context. */
export function renderGardenShelveAction(
  parent: HTMLElement,
  plugin: AiActionHost,
  target: ProjectionRecord,
  onChanged: ((result: ProjectionRecord) => unknown) | null = null,
): HTMLElement {
  const wrap = parent.createDiv({ cls: 'los-ai-action-row' });
  const providers: ProjectionRecord[] = plugin.aiActions.providers();
  const available = providers.filter(
    (row: ProjectionRecord) => Boolean(row.available),
  );
  let provider: string = available.some(
    (row: ProjectionRecord) =>
      row.id === plugin.settings.preferredAiProvider,
  )
    ? plugin.settings.preferredAiProvider : (available[0]?.id || 'manual-bundle');
  let jobConfirmed = !target.job_derived;

  // Provider choice belongs in Settings. Repeating a technical adapter picker
  // on every seed made Garden look like an operator console and displaced the
  // human decision the row is actually for.
  if (provider !== plugin.settings.preferredAiProvider) {
    plugin.settings.preferredAiProvider = provider;
    plugin.scheduleDraftSave();
  }

  if (target.job_derived) {
    const consent = wrap.createEl('label', { cls: 'los-ai-consent' });
    const checkbox = consent.createEl('input', { attr: { type: 'checkbox' } });
    consent.createSpan({ text: 'Confirm this exported item may leave the Job boundary' });
    checkbox.addEventListener('change', () => { jobConfirmed = Boolean(checkbox.checked); });
  }

  const targetId = target.id;
  const launch = button(wrap, 'Refine with AI', async () => {
    if (!targetId) {
      new Notice('This Garden item has no projected identity. Refresh LearningOS and try again.');
      return;
    }
    if (target.job_derived && !jobConfirmed) {
      new Notice('Explicit export confirmation is required for job-derived material.');
      return;
    }
    launch.setAttr('disabled', 'disabled');
    launch.setText('Preparing…');
    try {
      const result: ProjectionRecord =
        await plugin.aiActions.prepareGardenShelving(
          targetId,
          provider,
          jobConfirmed,
        );
      const bundlePath = result.bundle_path || result.request?.bundle_path;
      new Notice(bundlePath ? `AI request prepared: ${bundlePath}` : 'AI request prepared.');
      onChanged?.(result);
    } catch (error: unknown) {
      new Notice(errorMessage(error));
      launch.removeAttribute?.('disabled');
      launch.setText('Refine with AI');
    }
  }, 'warm');
  launch.addClass('los-ai-action-button');
  if (!available.length) launch.setAttr('disabled', 'disabled');
  return wrap;
}
