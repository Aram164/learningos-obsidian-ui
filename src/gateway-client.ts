export class GatewayClient {
  constructor(plugin) { this.plugin = plugin; }

  call(args) {
    return new Promise((resolve, reject) => {
      this.plugin.runLos(args, (error, stdout, stderr) => {
        if (error) reject(new Error(stderr || error.message || String(error)));
        else {
          try { resolve(stdout ? JSON.parse(stdout) : { ok: true }); }
          catch (_) { resolve({ ok: true, stdout }); }
        }
      });
    });
  }

  guard() { return ['--expected-snapshot', this.plugin.store.snapshotId]; }
  saveNote(unitId, stageId, text) {
    return this.call(['stage-note', unitId, stageId, '--replace', '--text', text, ...this.guard()]);
  }
  progress(unitId, stageId, status) {
    return this.call(['stage-progress', unitId, stageId, status, ...this.guard()]);
  }
  feedback(unitId, stageId, sourceId, feedback) {
    return this.call(['source-feedback', unitId, stageId, sourceId, feedback, ...this.guard()]);
  }
  detour(unitId, stageId, title, classification = 'required-now') {
    return this.call(['detour-create', unitId, stageId, '--title', title,
      '--classification', classification, ...this.guard()]);
  }
  resolveDetour(unitId, detourId, resolution = '') {
    const args = ['detour-resolve', unitId, detourId];
    if (resolution) args.push('--resolution', resolution);
    return this.call([...args, ...this.guard()]);
  }
  attach(unitId, stageId, filePath, label = '') {
    const args = ['stage-attach', unitId, stageId, '--file', filePath];
    if (label) args.push('--label', label);
    return this.call([...args, ...this.guard()]);
  }
  captureText(text, title = '') {
    const args = ['capture', '--text', text];
    if (title) args.push('--title', title);
    return this.call(args);
  }
  captureFile(filePath) {
    return this.call(['capture', '--file', filePath]);
  }
  prepareShelving(unitId) {
    return this.call(['shelving-prepare', unitId, ...this.guard()]);
  }
  applyShelving(unitId, selected) {
    return this.call(['shelving-apply', unitId, '--approve', '--selected', ...selected, ...this.guard()]);
  }
  endSession(commitMessage = null, push = false) {
    const args = ['session-end'];
    if (commitMessage) args.push('--commit-message', commitMessage);
    if (push) args.push('--push');
    return this.call(args);
  }
}

export function explicitAiContext(plugin, context = {}) {
  const unit = context.unitId ? plugin.store.get(context.unitId) : null;
  const module = context.moduleId ? plugin.store.get(context.moduleId) :
    (unit ? plugin.store.get(unit.module_id) : null);
  const studyMap = unit ? plugin.store.mapForUnit(unit.id) : null;
  const stage = context.stageId ? plugin.store.stage(context.stageId) : null;
  const resources = stage?.resources || [];
  return {
    area_program_id: context.programId || module?.area_id || null,
    module_id: module?.id || context.moduleId || null,
    component_id: context.componentId || unit?.component_id || null,
    unit_id: unit?.id || context.unitId || null,
    stage_id: stage?.id || context.stageId || null,
    selected_source_ids: [...new Set(resources.map((row) => row.source_id).filter(Boolean))],
    selected_materials: resources.filter((row) => row.vault_path || row.url)
      .map((row) => row.vault_path || row.url),
    manifest_snapshot: plugin.store.snapshotId,
    active_file_supplement: plugin.app.workspace.getActiveFile()?.path || null,
  };
}
