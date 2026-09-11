'use strict';

const {
  path,
  fs,
  makeApp,
  Notice,
  stub,
  ROOT,
  FIXTURE,
  LearningOSUI,
  FIXTURE_GROUP_COUNT,
  VIEW,
  tick,
  frame,
  check,
  heading,
  build,
  boot,
} = require('./support');

function paletteBlocks(css) {
  return [...css.matchAll(
    /(?:^|\n)((?:body\[data-los-palette="[a-z]+"\] )?(?:\.theme-dark )?\.los-root)\s*\{([\s\S]*?)\n\}/g,
  )].map((match) => ({
    selector: match[1],
    tokens: new Map([...match[2].matchAll(
      /^\s*(--los-[a-z0-9-]+)\s*:\s*([^;]+);/gm,
    )].map((declaration) => [declaration[1], declaration[2].trim()])),
  }));
}

function resolvePaletteToken(tokens, name, seen = new Set()) {
  if (seen.has(name)) return null;
  seen.add(name);
  const value = tokens.get(name);
  if (!value) return null;
  const reference = value.match(/^var\((--los-[a-z0-9-]+)\)$/);
  if (reference) return resolvePaletteToken(tokens, reference[1], seen);
  const hex = value.match(/^#([0-9a-f]{6})\b/i);
  return hex ? `#${hex[1].toLowerCase()}` : null;
}

function relativeLuminance(hex) {
  const channel = (offset) => {
    const encoded = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return encoded <= 0.04045
      ? encoded / 12.92
      : ((encoded + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrastRatio(left, right) {
  const light = Math.max(relativeLuminance(left), relativeLuminance(right));
  const dark = Math.min(relativeLuminance(left), relativeLuminance(right));
  return (light + 0.05) / (dark + 0.05);
}

module.exports = async function run() {
  heading('material consumer contract (red gate)');
  {
    const { plugin } = await boot();
    const materialCalls = [];
    const vaultCalls = [];
    plugin.openMaterialPath = (value) => {
      materialCalls.push(value);
      return 'material-opened';
    };
    plugin.openVaultPath = async (value) => {
      vaultCalls.push(value);
      return 'vault-opened';
    };

    const projected = {
      material_uri: 'material://source-fixture/paper.pdf',
      material_path: 'materials/source-fixture/paper.pdf',
      material_exists: true,
      vault_path: 'material://source-fixture/paper.pdf',
    };
    const projectedResult = await Promise.resolve(plugin.openResource(projected));
    check('material_path takes precedence over a material URI in vault_path',
      projectedResult === 'material-opened'
      && materialCalls.join('|') === 'materials/source-fixture/paper.pdf');
    check('material opening never delegates a material URI to openVaultPath',
      vaultCalls.length === 0,
      `openVaultPath calls: ${JSON.stringify(vaultCalls)}`);

    const callsBeforeLoneUri = vaultCalls.length;
    const loneUriResult = await Promise.resolve(plugin.openResource({
      vault_path: 'material://source-fixture/lone.pdf',
    }));
    check('a lone material URI without material_path is refused',
      loneUriResult === false && vaultCalls.length === callsBeforeLoneUri,
      `result=${String(loneUriResult)} calls=${JSON.stringify(vaultCalls)}`);

    const ordinaryResult = await Promise.resolve(plugin.openResource({
      vault_path: 'knowledge/notes/supplementary.md',
    }));
    check('ordinary vault paths still delegate to openVaultPath',
      ordinaryResult === 'vault-opened'
      && vaultCalls.at(-1) === 'knowledge/notes/supplementary.md');

    plugin.onunload();
  }
  {
    const { app, plugin } = await boot();
    const originalGetLeaf = app.workspace.getLeaf;
    let webState = null;
    app.workspace.getLeaf = () => ({
      setViewState(state) {
        webState = state;
        return state;
      },
    });
    Notice.log.length = 0;

    const safe = plugin.openResource({ url: 'https://example.org/material.pdf' });
    const unsafeJavascript = plugin.openResource({ url: 'javascript:alert(1)' });
    const unsafeFile = plugin.openResource({ url: 'file:///etc/passwd' });

    check('safe HTTPS resources open in the real browser, not an embedded view',
      safe instanceof Promise
      && webState === null);
    check('unsafe URL schemes remain refused by the material consumer patch',
      unsafeJavascript === false && unsafeFile === false
      && Notice.log.filter((line) => line.includes('Refused an unsupported link')).length === 2);

    app.workspace.getLeaf = originalGetLeaf;
    plugin.onunload();
  }
  {
    const { app, plugin } = await boot();
    const map = plugin.store.get('study-map-fixture-sad-l04');
    const stage = map.stages.find((row) => row.id === 'stage-fixture-conditioning');
    stage.resources = [{
      kind: 'read',
      label: 'A whole lecture collection is not one exact resource',
      locator: 'Choose lecture 11',
      source_id: 'source-fixture-book',
    }];
    const source = plugin.store.get('source-fixture-book');
    source.material_path = 'materials/fixture-lectures';
    source.material_exists = true;

    await plugin.nav.openUnit('unit-fixture-sad-l04', 'stage-fixture-conditioning');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    check('a source collection never becomes a stage-level Open source button',
      !view.contentEl.findText('los-btn', 'Open source'));

    plugin.onunload();
  }
  {
    const { app, plugin } = await boot({
      patchManifest: (manifest) => {
        const unit = manifest.units.find(
          (row) => row.id === 'unit-fixture-sad-l04');
        unit.knowledge_map = {
          summary: 'One projected target exercises the opening gate.',
          nodes: [{
            id: 'knowledge-fixture-missing',
            title: 'Missing target',
            summary: 'The file is not available locally.',
          }],
        };
        const sourceMap = manifest.module_source_maps.find(
          (row) => row.module_id === 'module-fixture-m2');
        sourceMap.sources[0].unit_routes = [{
          id: 'route-fixture-missing',
          unit_id: 'unit-fixture-sad-l04',
          title: 'Missing projected lecture',
          format: 'course-material',
          angle: 'This target is deliberately absent.',
          covers: ['knowledge-fixture-missing'],
          depth: 'course-aligned',
          scope: 'current',
          locator: 'lectures/missing.pdf',
          source_id: 'source-fixture-book',
          material_path: 'materials/lectures/missing.pdf',
          material_exists: false,
        }];
      },
    });

    await plugin.nav.openUnit('unit-fixture-sad-l04', 'stage-fixture-conditioning');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    /* The choose-a-source menu lives in the comparison drawer once a stage is
     * on screen (Figma 05 · 36:12). The contract is unchanged: a file the
     * projection says is absent never gets an Open button. */
    view.contentEl.findText('los-btn', 'Compare all').fire('click');
    const drawer = stub.Modal.last.contentEl;
    const scope = drawer.find('los-source-scope')[0]; scope.value = 'unit'; scope.fire('change');
    const missing = drawer.find('los-source-entry').find((card) => card.allText().includes('Missing projected lecture'));
    check('a projected missing file never renders a broken Open button',
      Boolean(missing) && !missing.findText('los-btn', 'Open'),
      `screen=${drawer.allText()}`);

    plugin.onunload();
  }
  {
    const { app, plugin } = await boot();
    const map = plugin.store.get('study-map-fixture-sad-l04');
    const stage = map.stages.find((row) => row.id === 'stage-fixture-conditioning');
    stage.resources = [{
      kind: 'read',
      label: 'Projected local material',
      material_uri: 'material://source-fixture/projected.pdf',
      material_path: 'materials/source-fixture/projected.pdf',
      material_exists: true,
    }];

    await plugin.nav.openUnit('unit-fixture-sad-l04', 'stage-fixture-conditioning');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    check('a resource containing only material_path receives an Open button',
      Boolean(view.contentEl.findText('los-btn', 'Open')));

    plugin.onunload();
  }
  {
    const { app, plugin } = await boot();
    const opened = [];
    plugin.openResource = (record) => {
      opened.push(record.id);
      return true;
    };

    await plugin.nav.openUnit('unit-fixture-sad-l04', 'stage-fixture-conditioning');
    const view = app.workspace.getLeavesOfType(VIEW.unit)[0].view;
    /* This resource is not the one the stage promotes, so it is reached
     * through the drawer. The fallback rule itself is untouched. */
    view.contentEl.findText('los-btn', 'Compare all').fire('click');
    const fallback = stub.Modal.last.contentEl.findText('los-btn', 'Open source');
    check('a locator-only resource can fall back to its openable source',
      Boolean(fallback));
    fallback?.fire('click');
    check('the source fallback uses the same safe resource opener',
      opened.includes('source-fixture-islp'),
      `opened=${JSON.stringify(opened)}`);

    plugin.onunload();
  }
  {
    const { plugin } = await boot();
    const stage = plugin.store.stage('stage-fixture-conditioning');
    stage.resources = [
      {
        label: 'All identities',
        material_uri: 'material://source-fixture/semantic.pdf',
        vault_path: 'material://source-fixture/wrong-precedence.pdf',
        url: 'https://example.org/wrong-precedence.pdf',
        material_path: 'materials/source-fixture/wrong-precedence.pdf',
      },
      {
        label: 'Vault fallback',
        vault_path: 'knowledge/notes/supplementary.md',
        url: 'https://example.org/wrong-vault-fallback.pdf',
        material_path: 'materials/source-fixture/wrong-vault-fallback.pdf',
      },
      {
        label: 'URL fallback',
        url: 'https://example.org/url-fallback.pdf',
        material_path: 'materials/source-fixture/wrong-url-fallback.pdf',
      },
      {
        label: 'Physical fallback',
        material_path: 'materials/source-fixture/physical-fallback.pdf',
      },
      {
        label: 'No identity',
        material_uri: '',
        vault_path: '',
        url: '',
        material_path: '',
      },
    ];

    plugin.copyText = () => {};
    await plugin.askAiScoped('Probe selected material identity.', {
      moduleId: 'module-fixture-sad',
      unitId: 'unit-fixture-sad-l04',
      stageId: 'stage-fixture-conditioning',
    });

    const match = plugin.lastAiPrompt.match(
      /LearningOS explicit context \(authoritative\):\n([\s\S]*?)\n\nThe active file/,
    );
    let envelope = null;
    try {
      envelope = match ? JSON.parse(match[1]) : null;
    } catch (_) {
      envelope = null;
    }
    const selected = Array.isArray(envelope?.selected_materials)
      ? envelope.selected_materials
      : [];
    const expected = [
      'material://source-fixture/semantic.pdf',
      'knowledge/notes/supplementary.md',
      'https://example.org/url-fallback.pdf',
      'materials/source-fixture/physical-fallback.pdf',
    ];

    check('AI selected_materials prefers material_uri',
      selected[0] === expected[0],
      `selected=${JSON.stringify(selected)}`);
    check('AI selected_materials falls back to vault_path',
      selected[1] === expected[1],
      `selected=${JSON.stringify(selected)}`);
    check('AI selected_materials falls back to URL',
      selected[2] === expected[2],
      `selected=${JSON.stringify(selected)}`);
    check('AI selected_materials finally falls back to material_path',
      selected[3] === expected[3],
      `selected=${JSON.stringify(selected)}`);
    check('AI selected_materials excludes rows without an identity',
      selected.every((value) => typeof value === 'string' && Boolean(value)));
    check('AI selected_materials preserves the frozen identity precedence',
      JSON.stringify(selected) === JSON.stringify(expected),
      `expected=${JSON.stringify(expected)} actual=${JSON.stringify(selected)}`);

    plugin.onunload();
  }

  {
    /* Diagnostics has to be able to say which interpreter was tried. */
    const { plugin } = await boot({ settings: { pythonPath: '/nonexistent/python3.99' } });
    const resolved = plugin.resolvePython();
    check('a configured interpreter that does not exist falls through, and is reported',
      resolved.origin === 'PATH fallback'
      && resolved.attempted.includes('/nonexistent/python3.99')
      && resolved.attempted.some((entry) => entry.includes('.venv')));
    check('the Windows virtual-environment layout is attempted too',
      resolved.attempted.some((entry) => entry.includes('Scripts')));
    plugin.onunload();
  }
  {
    const { plugin, home } = await boot();
    const workspace = plugin.store.of('workspace')[0];
    // An emoji sits exactly on the 120-code-point cut used by the module row,
    // which is where a plain .slice() left a lone high surrogate.
    workspace.module_ids = [...new Set([...(workspace.module_ids || []), 'module-fixture-aml'])];
    workspace.next_action = `${'a'.repeat(98)}😀 ${'b'.repeat(1500)}😀 tail`;
    home.view.render();
    const text = home.view.contentEl.allText();
    check('excerpt truncation never leaves half an emoji in the DOM',
      text.includes('😀') && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(text));
    plugin.onunload();
  }
  {
    const source = fs.readFileSync(
      process.env.LEARNINGOS_TEST_BUNDLE || path.join(ROOT, 'plugin', 'main.js'),
      'utf8',
    );
    for (const [label, pattern] of [
      ['vault.modify', /vault\.modify\s*\(/], ['vault.delete', /vault\.delete\s*\(/],
      ['vault.rename/copy', /vault\.(rename|copy)\s*\(/], ['frontmatter writes', /processFrontMatter/],
      ['filesystem writes', /fs\.(writeFile|appendFile|unlink|rename|mkdir)/],
      ['direct canonical parsing', /cachedRead|records\/modules\.yaml|work\/active\/.*paths/],
      /* Matched as command strings, not as bare words. Unanchored, `path-note`
       * also matches an unrelated CSS class — it fired on the Atlas path lens's
       * own `los-atlas-path-note`, which is not a CLI call at all. A gate that
       * cries wolf is a gate somebody eventually loosens for the wrong reason. */
      ['legacy global-path commands', /["'`]path-(note|progress)["'`]|openLearningPath\(/],
    ]) check(`bundle has no ${label}`, !pattern.test(source));
    check('bundle uses only the atomic manifest projection', /generated\/manifest\.json/.test(source)
      && !/generated\/backlinks\.json/.test(source));
    check('python resolution covers configured, POSIX venv, Windows venv and PATH',
      /\.join\(\s*base\s*,\s*["']\.venv["']\s*,\s*["']bin["']\s*,\s*["']python["']\s*\)/.test(source)
      && /\.join\(\s*base\s*,\s*["']\.venv["']\s*,\s*["']Scripts["']\s*,\s*["']python\.exe["']\s*\)/.test(source)
      && /this\.settings\.pythonPath/.test(source)
      && /["']python3["']/.test(source));
    check('every mutation is serialized through one queue',
      /enqueue\(task\d*\)/.test(source) && !/this\.busy\s*=\s*true/.test(source));
    check('external links pass a protocol allowlist',
      source.includes('SAFE_URL_PROTOCOLS') && source.includes('safeWebUrl'));
    check('the repeated ownership footer no longer exists as a component',
      !source.includes('function viewFooter'));
    check('view refresh uses Obsidian public leaf iteration', source.includes('iterateAllLeaves')
      && !source.includes('workspace._leaves'));
    const viewStateSources = fs.readdirSync(path.join(ROOT, 'src', 'views'))
      .filter((name) => name.endsWith('.ts'))
      .map((name) => fs.readFileSync(path.join(ROOT, 'src', 'views', name), 'utf8'))
      .join('\n');
    check('persisted view state uses the public Obsidian accessor',
      !viewStateSources.includes('.leaf.state')
      && viewStateSources.includes('.leaf.getViewState().state'));
    /* `gateway.isBusy` reports that *someone else* is writing. The gateway's
     * own queue already serialises writes, so that is a reason to say "you are
     * queued" and carry on — never a reason to drop the action. Refusing on it
     * discards work the learner authored: the unit-note modal did exactly that
     * for a whole release, one directory outside any views-only scan. So this
     * walks all of src/ and reads the guard body rather than the file. */
    const tsSources = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.ts') && entry.name !== 'gateway-client.ts') {
          tsSources.push([path.relative(ROOT, full), fs.readFileSync(full, 'utf8')]);
        }
      }
    }(path.join(ROOT, 'src')));
    const refusals = [];
    for (const [file, text] of tsSources) {
      const lines = text.split('\n');
      lines.forEach((line, index) => {
        if (!line.includes('isBusy')) return;
        const depthOf = (value) =>
          (value.match(/\{/g) || []).length - (value.match(/\}/g) || []).length;
        let body = line;
        let depth = depthOf(line);
        for (let j = index + 1; depth > 0 && j < lines.length; j += 1) {
          body += `\n${lines[j]}`;
          depth += depthOf(lines[j]);
        }
        if (/\breturn\b/.test(body)) refusals.push(`${file}:${index + 1}`);
      });
    }
    check(`no surface refuses a write merely because another one is running${
      refusals.length ? ` (${refusals.join(', ')})` : ''}`, refusals.length === 0);
    check('local file paths use Electron webUtils', source.includes('webUtils.getPathForFile(file)')
      && !/function localFilePath\([\s\S]*?return file\??\.path/.test(source));
    /* Writes are declared capabilities now, so the bundle must name them —
     * an "ask the AI to do something" style generic write would show up here
     * as the absence of these exact identifiers. */
    check('bundle exposes action-specific writes', ['unit.note.append', 'stage.note.write',
      'stage.progress.update', 'source.feedback.record', 'stage.attachment.add',
      'detour.create', 'detour.resolve', 'review.prepare', 'review.apply',
      'session-end'].every((command) => source.includes(command)));
    const buildSource = fs.readFileSync(path.join(ROOT, 'build.mjs'), 'utf8');
    const registrationSource = fs.readFileSync(
      path.join(ROOT, 'src', 'app', 'registration.ts'), 'utf8');
    check('bundle is generated from an explicit module graph',
      fs.readdirSync(path.join(ROOT, 'src', 'views')).length >= 8
      && buildSource.includes("entryPoints: ['src/main.ts']")
      && buildSource.includes('bundle: true')
      && registrationSource.includes("from '../views/unit-view'")
      && !buildSource.includes('const files = ['));
    const css = fs.readFileSync(
      process.env.LEARNINGOS_TEST_STYLESHEET || path.join(ROOT, 'plugin', 'styles.css'),
      'utf8',
    );
    /* The same rule the bundle already lives under, applied to the cascade: a
     * stylesheet assembled from whatever happens to be in a directory has no
     * declared order, and cascade order is the one thing a stylesheet cannot
     * leave implicit. Every module present must be named in the cascade, and
     * the shipped file must announce that it is an artifact. */
    const stylesSource = fs.readFileSync(path.join(ROOT, 'build-styles.mjs'), 'utf8');
    const declaredStyleModules = (stylesSource.match(/'\d\d-[a-z0-9-]+\.css'/g) || [])
      .map((quoted) => quoted.slice(1, -1));
    const presentStyleModules = fs.readdirSync(path.join(ROOT, 'src', 'styles'))
      .filter((name) => name.endsWith('.css'));
    check('the stylesheet is composed from an explicit cascade',
      presentStyleModules.length >= 10
      && presentStyleModules.every((name) => declaredStyleModules.includes(name))
      && buildSource.includes('writeStylesheet(')
      && css.startsWith('/* GENERATED by build-styles.mjs'));
    /* Any literal colour, not just hex. A palette written in rgb()/hsl() is
     * exactly as theme-breaking as one written in #rrggbb, and grepping only
     * for hex let a 13-colour hardcoded palette through unnoticed. */
    /* Was 'theme variables only': zero hex anywhere, because the plugin had no
     * palette and inherited Obsidian's. It has one now (DESIGN.md principle 2,
     * revised 2026-08-08), so that assertion tested a rule that no longer
     * exists. The constraint it was really protecting — no component may name a
     * colour, and light/dark must not drift apart — is stronger here: raw colour
     * is legal ONLY inside the two token blocks, and both must define the same
     * token names. */
    /* Selectable schemes (25-palettes.css) are palette blocks too: raw colour
     * is legal inside one and nowhere else, and every one of them must declare
     * the same token names, so a scheme cannot ship with a token the others
     * have and it lacks. */
    const tokenBlocks = css.match(
      /(?:^|\n)(?:body\[data-los-palette="[a-z]+"\] )?(?:\.theme-dark )?\.los-root \{[\s\S]*?\n\}/g) || [];
    const cssOutsideTokens = tokenBlocks.reduce(
      (rest, block) => rest.replace(block, ''), css);
    const tokenNames = tokenBlocks.map((block) =>
      (block.match(/--los-[a-z0-9-]+(?=\s*:)/g) || [])
        .filter((name) => /^--los-(paper|ink|rule|accent|st)/.test(name))
        .sort()
        .join(','));

    check('raw colour appears only in the palette token blocks',
      (cssOutsideTokens.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length === 0
      && (cssOutsideTokens.match(/\b(rgba?|hsla?)\(/g) || []).length === 0
      && !/color-scheme:/.test(css));
    check('every component colour resolves through a --los-* token',
      (cssOutsideTokens.match(
        /var\(--(?:color|text|background|interactive)[a-z0-9-]*\)/g) || [])
        .length === 0);
    check('every palette defines the same tokens',
      tokenBlocks.length >= 2
      && tokenNames[0].length > 0
      && tokenNames.every((names) => names === tokenNames[0]),
      `${tokenBlocks.length} palette block(s)`);
    const paletteSource = fs.readFileSync(
      path.join(ROOT, 'src', 'styles', '00-tokens.css'), 'utf8');
    const parsedPalettes = paletteBlocks(paletteSource);
    const lightPalette = parsedPalettes.find((block) => block.selector === '.los-root');
    const darkOverrides = parsedPalettes.find(
      (block) => block.selector === '.theme-dark .los-root');
    /* A scheme states only what it changes, so each one is checked as the base
     * palette with its own overrides laid over it — which is exactly how the
     * cascade resolves it at runtime. */
    const schemeSource = fs.readFileSync(
      path.join(ROOT, 'src', 'styles', '25-palettes.css'), 'utf8');
    const overrideBlocks = [
      ...(darkOverrides ? [{ name: 'dark', tokens: darkOverrides.tokens }] : []),
      ...paletteBlocks(schemeSource).map((block) => ({
        name: (block.selector.match(/palette="([a-z]+)"/) || [])[1] || block.selector,
        tokens: block.tokens,
      })),
    ];
    const palettes = lightPalette && darkOverrides ? [
      { name: 'light', tokens: new Map(lightPalette.tokens) },
      ...overrideBlocks.map((override) => ({
        name: override.name,
        tokens: new Map([...lightPalette.tokens, ...override.tokens]),
      })),
    ] : [];
    const normalTextPairs = [
      ['--los-ink', '--los-paper'],
      ['--los-ink', '--los-paper-2'],
      ['--los-ink-soft', '--los-paper'],
      ['--los-ink-soft', '--los-paper-2'],
      ['--los-ink-soft', '--los-paper-3'],
      ['--los-ink-soft', '--los-accent-wash'],
      ['--los-ink-soft', '--los-rule'],
      ['--los-ink-faint', '--los-paper'],
      ['--los-ink-faint', '--los-selected'],
      ['--los-on-accent', '--los-accent'],
      ['--los-on-accent', '--los-accent-strong'],
      ['--los-on-accent', '--los-success'],
      ['--los-on-accent', '--los-success-strong'],
      ['--los-accent-strong', '--los-accent-wash'],
      ['--los-success-strong', '--los-success-wash'],
      ['--los-info-strong', '--los-info-wash'],
      ['--los-warning-strong', '--los-warning-wash'],
      /* Status words are text, so the state hues have to clear the text floor
       * on every palette — not just the 3:1 non-text floor they met as dots. */
      ['--los-st-active', '--los-paper'],
      ['--los-st-active', '--los-paper-2'],
      ['--los-st-done', '--los-paper'],
      ['--los-st-paused', '--los-paper'],
      ['--los-st-paused', '--los-paper-2'],
      ['--los-st-attention', '--los-paper'],
    ];
    const nonTextPairs = [
      ['--los-line', '--los-paper'],
      ['--los-line', '--los-paper-2'],
      ['--los-line-strong', '--los-paper'],
      ['--los-accent', '--los-accent-wash'],
      ['--los-success', '--los-paper'],
      ['--los-info', '--los-info-wash'],
      ['--los-warning', '--los-warning-wash'],
    ];
    const contrastFailures = [];
    for (const palette of palettes) {
      for (const [foreground, background, minimum] of [
        ...normalTextPairs.map((pair) => [...pair, 4.5]),
        ...nonTextPairs.map((pair) => [...pair, 3]),
      ]) {
        const foregroundColor = resolvePaletteToken(palette.tokens, foreground);
        const backgroundColor = resolvePaletteToken(palette.tokens, background);
        const ratio = foregroundColor && backgroundColor
          ? contrastRatio(foregroundColor, backgroundColor)
          : 0;
        if (ratio + Number.EPSILON < minimum) {
          contrastFailures.push(
            `${palette.name} ${foreground}/${background} ${ratio.toFixed(2)} < ${minimum}`,
          );
        }
      }
    }
    check('every selectable palette meets numeric WCAG 2.2 AA contrast',
      palettes.length >= 2 && contrastFailures.length === 0,
      contrastFailures.join('; '));
    check('narrow-screen workspace is responsive', css.includes('.los-unit-layout') && css.includes('@media (max-width: 720px)'));
    check('button-like components are insulated from Obsidian theme distortion',
      css.includes('appearance: none') && css.includes('min-width: 0')
      && css.includes('overflow-wrap: break-word') && css.includes('word-break: normal'));
    check('deadline layout cannot allocate a third action column',
      /\.los-date-row\s*\{[^}]*grid-template-columns:\s*minmax\(126px, 148px\)\s+minmax\(0, 1fr\)/.test(css)
      && !/\.los-date-row\s*\{[^}]*grid-template-columns:[^;]*\sauto\s*;/.test(css));
    check('the unit workspace is two columns and notes are a temporary modal',
      /\.los-unit-layout\s*\{[\s\S]*?grid-template-columns:\s*232px\s+minmax\(0, 1fr\)/.test(css)
      && css.includes('.los-unit-note-modal') && !css.includes('.los-note-panel'));
    check('LearningOS modals size their host and never overflow their content box',
      css.includes('.modal.los-modal--unit-note')
      && css.includes('.modal.los-modal--global-search')
      && css.includes('.modal.los-modal--map-import')
      && /\.los-unit-note-modal\s*\{[^}]*width:\s*100%/.test(css)
      && /\.los-global-search\s*\{[^}]*width:\s*100%/.test(css)
      && css.includes('max-width: calc(100vw - 32px)')
      && css.includes('overflow-x: hidden'));
    const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
    /*
     * One lock on disk, one lock named in the README, and the two agree.
     *
     * This used to hardcode v5 and separately assert the README did not mention
     * v3 — which made it the only thing in the repository that still referred to
     * v3 at all, while manifest-v3.lock.json and manifest-v4.lock.json sat in
     * contracts/ unreferenced by anything. A retired lock left behind is a
     * second answer to "which contract is current". Deriving the version from
     * the single lock file also means this assertion survives the next bump
     * instead of becoming one more thing to remember to edit.
     */
    const locks = fs.readdirSync(path.join(ROOT, 'contracts'))
      .filter((name) => /^manifest-v\d+\.lock\.json$/.test(name));
    const currentContract = locks.length === 1 ? locks[0].match(/v(\d+)/)[1] : null;
    const namedContracts = [...readme.matchAll(/contracts\/manifest-v(\d+)\.lock\.json/g)]
      .map((match) => match[1]);
    check('the UI documentation names the active manifest contract',
      currentContract !== null
      && namedContracts.length === 0
      && readme.includes('contracts/manifest-v<N>.lock.json')
      && readme.includes(`manifest.json\` contract v${currentContract}`));
    /*
     * ECOSYSTEM.md once said "Reads manifest v2 only" — three major contract
     * bumps stale, and the only place in the repository still naming v2. This
     * derives the check from the same single lock file rather than hardcoding
     * the current number, for the same reason as the README check above: it
     * survives the next bump instead of becoming one more thing to forget.
     */
    const ecosystem = fs.readFileSync(path.join(ROOT, 'ECOSYSTEM.md'), 'utf8');
    const ecosystemStaleContracts = [...ecosystem.matchAll(/manifest v(\d+)/g)]
      .map((match) => match[1])
      .filter((version) => version !== currentContract);
    check('ECOSYSTEM.md names the active manifest contract, not a retired one',
      currentContract !== null
      && ecosystemStaleContracts.length === 0
      && ecosystem.includes(`manifest contract v${currentContract}`));
    check('ECOSYSTEM.md documents Text Extractor and PDF++ as supplemental, never authoritative',
      /Text Extractor[\s\S]*?(?:[Uu]nmaintained|supplemental)/.test(ecosystem)
      && /PDF\+\+[\s\S]*?[Ss]upplemental/.test(ecosystem));
    const runtimeSources = [
      'src/app/global-search.ts',
      'src/views/review-view.ts',
      'src/views/garden-view.ts',
      'src/views/program-view.ts',
      'src/features/library/home.ts',
      'src/features/project/detail.ts',
      'src/features/module/detail.ts',
    ].map((file) => fs.readFileSync(path.join(ROOT, file), 'utf8')).join('\n');
    check('button filters do not claim incomplete ARIA tab semantics',
      !runtimeSources.includes("role: 'tablist'")
      && !runtimeSources.includes("role: 'tab'")
      && !runtimeSources.includes('aria-selected')
      && runtimeSources.includes("role: 'group'")
      && runtimeSources.includes('aria-pressed'));
    /* Both of these assert INTENT — a filled primary, an unmistakable active
     * destination. The accent token was renamed --interactive-accent →
     * --los-accent when the palette landed; the intent did not change, so the
     * assertions track the token rather than being deleted. */
    check('the primary button is filled, not an outline',
      /\.los-btn--cta\s*\{[^}]*background: var\(--los-accent\)/.test(css));
    check('semantic button colours remain token-driven and purpose-specific',
      /\.los-btn--success\s*\{[^}]*background: var\(--los-success\)/.test(css)
      && /\.los-btn--info\s*\{[^}]*background: var\(--los-info-wash\)/.test(css)
      && /\.los-btn--warm\s*\{[^}]*background: var\(--los-warning-wash\)/.test(css)
      && /\.los-btn--choice\s*\{[^}]*background: var\(--los-accent-wash\)/.test(css));
    check('the active navigation destination is visually obvious',
      /\.los-app-nav-item\.is-active\s*\{[^}]*inset 3px 0 0 var\(--los-accent\)/.test(css));
    /* The flag is optional: once the rule is scoped under .los-root it
     * outranks the base button rule on its own, so requiring !important here
     * would pin an implementation detail rather than the intent. */
    check('ordinary navigation rows carry no border',
      /\.los-app-nav-item\s*\{[^}]*border: 0\s*(!important)?\s*;/.test(css));
    check('compact type and control scale is explicit',
      css.includes('font-size: 14px') && css.includes('clamp(24px, 2.2vw, 28px)')
      && css.includes('min-height: 28px'));
    check('reduced motion is respected', css.includes('prefers-reduced-motion'));
  }
};
