import { makeApp } from './obsidian-browser.mjs';
import { LearningOSUI } from '../../src/main';
import { answerAbilityRead } from '../../tests/ability-fixtures.js';

const params = new URLSearchParams(location.search);
const manifestText = await (await fetch('manifest.json')).text();
const preview = await (await fetch('preview-config.json')).json();
const app = makeApp(document.getElementById('nav'), document.getElementById('main'), manifestText);
app.savedSettings = {
  uiDesign: params.get('design') ?? 'study-desk',
  ...(params.get('appearance') ? { uiDesignPalettes: { [params.get('design') ?? 'study-desk']: params.get('appearance') } } : {}),
};
const plugin = new LearningOSUI(app, { id: 'learningos-ui', version: 'preview', dir: 'preview' });
// The synthetic preview can show the real graph/detail renderers without a
// Core process. Only these fixture reads are answered; every write and every
// unsupported command fails explicitly. A custom manifest never receives
// synthetic evidence or ability state.
plugin.runLos = (args, callback) => {
  const result = preview.synthetic ? answerAbilityRead(args) : null;
  if (result) callback(null, JSON.stringify(result), '');
  else callback(new Error('This read-only design preview has no Core connection for that action.'), '', 'Preview action unavailable');
};
// The preview has no materials folder to browse.
Object.assign(plugin, { listMaterialFolder: () => [], isMaterialFolder: () => false, materialFolderCount: () => 0 });
globalThis.__plugin = plugin;
globalThis.__notices = [];
await plugin.onload();
