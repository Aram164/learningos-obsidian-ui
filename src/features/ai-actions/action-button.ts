import { Notice } from 'obsidian';
import { button } from '../../components';

/** Compact, action-specific launcher. There is deliberately no generic
 * "Ask AI" entry point: the action ID, target and provider are visible before
 * the core prepares any context. */
export function renderGardenShelveAction(parent, plugin, target, onChanged = null) {
  const wrap = parent.createDiv({ cls: 'los-ai-action-row' });
  const providers = plugin.aiActions.providers();
  const available = providers.filter((row) => row.available);
  let provider = available.some((row) => row.id === plugin.settings.preferredAiProvider)
    ? plugin.settings.preferredAiProvider : (available[0]?.id || 'manual-bundle');
  let jobConfirmed = !target.job_derived;

  const select = wrap.createEl('select', {
    cls: 'los-ai-provider',
    attr: { 'aria-label': `AI provider for ${target.title}` },
  });
  for (const row of providers) {
    const option = select.createEl('option', {
      text: row.available ? row.id : `${row.id} (unavailable)`,
      attr: { value: row.id },
    });
    option.value = row.id;
    if (!row.available) option.setAttr('disabled', 'disabled');
  }
  select.value = provider;
  select.addEventListener('change', () => {
    provider = select.value;
    plugin.settings.preferredAiProvider = provider;
    plugin.scheduleDraftSave();
  });

  if (target.job_derived) {
    const consent = wrap.createEl('label', { cls: 'los-ai-consent' });
    const checkbox = consent.createEl('input', { attr: { type: 'checkbox' } });
    consent.createSpan({ text: 'Confirm this exported item may leave the Job boundary' });
    checkbox.addEventListener('change', () => { jobConfirmed = Boolean(checkbox.checked); });
  }

  const launch = button(wrap, 'Shelve with AI', async () => {
    if (target.job_derived && !jobConfirmed) {
      new Notice('Explicit export confirmation is required for job-derived material.');
      return;
    }
    launch.setAttr('disabled', 'disabled');
    launch.setText('Preparing…');
    try {
      const result = await plugin.aiActions.prepareGardenShelving(target.id, provider, jobConfirmed);
      const bundlePath = result.bundle_path || result.request?.bundle_path;
      new Notice(bundlePath ? `AI request prepared: ${bundlePath}` : 'AI request prepared.');
      onChanged?.(result);
    } catch (error) {
      new Notice(error?.message || String(error));
      launch.removeAttribute?.('disabled');
      launch.setText('Shelve with AI');
    }
  }, 'quiet');
  launch.addClass('los-ai-action-button');
  if (!available.length) launch.setAttr('disabled', 'disabled');
  return wrap;
}
