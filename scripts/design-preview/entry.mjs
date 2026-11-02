import { makeApp } from './obsidian-browser.mjs';
import { LearningOSUI } from '../../src/main';

const params = new URLSearchParams(location.search);
const manifestText = await (await fetch('manifest.json')).text();
const app = makeApp(document.getElementById('nav'), document.getElementById('main'), manifestText);
app.savedSettings = {
  uiDesign: params.get('design') ?? 'study-desk',
  ...(params.get('appearance') ? { uiDesignPalettes: { 'study-desk': params.get('appearance') } } : {}),
};
const plugin = new LearningOSUI(app, { id: 'learningos-ui', version: 'preview', dir: 'preview' });
// The preview has no materials folder to browse.
Object.assign(plugin, { listMaterialFolder: () => [], isMaterialFolder: () => false, materialFolderCount: () => 0 });
globalThis.__plugin = plugin;
globalThis.__notices = [];
await plugin.onload();
