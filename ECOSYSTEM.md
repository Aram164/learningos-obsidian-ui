# LearningOS Obsidian ecosystem policy

Plugins are selected by workflow responsibility, not popularity. They may not
create a second source of truth, graph, inbox, scheduler, AI memory, or
unguarded writer. Versions, URLs and SHA-256 checksums are pinned in
`ecosystem-plugins.json`.

## Installed and integrated

| Integration | Responsibility | Managed boundary |
|---|---|---|
| [Agentic Copilot](https://github.com/spencermarx/obsidian-ai) 1.5.3 | In-vault local CLI AI panel. | `tools/codex_obsidian.py`, custom local agent, approval mode, one session. UI actions provide explicit area/module/component/unit/stage/source/snapshot context; active file is supplementary. General chat is read-only. |
| [Omnisearch](https://github.com/scambier/obsidian-omnisearch) 1.30.1 | Full-text, typo-tolerant retrieval. | PDF/image indexing on through Text Extractor; excluded strata hidden; HTTP API and remote image AI off. It is an index, never metadata. Supplemental: LearningOS's own structural Library search remains fully available if this plugin is disabled, and the interface reaches it only through the registered public `omnisearch:show-modal` command — never its internal DOM. |
| [Text Extractor](https://github.com/scambier/obsidian-text-extractor) 0.7.0 | Local text extraction for PDFs/images. | OCR languages `eng` and `deu`; extracted caches are disposable and make no evidence claim. Unmaintained upstream and supplemental: no canonical data, source identity, Gateway write, progress, or receipt depends on it, and LearningOS is fully correct with it disabled. |
| [PDF++](https://github.com/RyotaUshio/obsidian-pdf-plus) 0.40.31 | Precise native PDF links/annotations. | Direct PDF editing and default write-to-file toggle off. The version stays pinned because the plugin uses private Obsidian APIs and needs a smoke test after Obsidian updates. Supplemental: it is a reading convenience only, never authoritative, and LearningOS is fully correct with it disabled. |
| LearningOS UI | Module/unit/stage presentation and guarded actions. | Reads manifest contract v21 (`src/contracts/manifest.ts`'s `MANIFEST_CONTRACT_VERSION`) only, refusing any other contract version before exposing data; bundled output follows Obsidian custom-view/command/settings conventions. |

The installer merges only these managed keys so unrelated preferences survive.
App exclusions include `generated/`, `archive/`, `system/`, source registries,
`migration/`, `.venv/`, and `curriculum/quarantine/`. Job is outside the vault.

`ecosystem-plugins.json` remains the sole pin/checksum authority for every
integration above; this document is verification prose, never a second
declaration of a version or hash.

## Deliberately not installed

Dataview, Tasks, Breadcrumbs, QuickAdd, Templater, generic vault-writing MCP
servers, competing graph/semantic-memory plugins, and extra AI providers would
duplicate a canonical model or bypass the gateway. Excalidraw/sketch tooling is
deferred until one concrete stage-owned original/export workflow exists.

Yanki/Anki may be evaluated only through an approval-gated generated export
folder with automatic sync disabled. Zotero Integration may be evaluated only
through staging and source registration, never direct canonical-note overwrite.

## Experimental, fixture-only (Native Atlas branch)

Two optional plugins are pinned separately in
`scripts/experimental-atlas-plugins.json` — the only place their versions and
SHA-256 digests live — and installed only by
`scripts/install-experimental-plugin.py` into marked fixture vaults. Neither
is part of the production ecosystem above, neither is installed by default,
and the ordinary Atlas list, boards and authoring work with both absent.

- **Advanced Canvas 7.1.2** may be applied only to a vault carrying
  `.los-atlas-fixture`. It is an optional portal view over the same editable
  boards: enable the `atlasAdvancedCanvas` setting, open a board with
  **Advanced board**, create the editable child first, then use **Use
  editable child in portals** and the plugin's own card menu to open and
  close the portal. Portal state is presentation only; nothing is written
  back to Core. With the plugin absent or disabled, the standard Canvas,
  list, evidence and authoring paths stay fully operable.
- **LearnKit 1.8.6** may be applied only to a practice vault whose
  `.learningos-practice-vault.json` carries `experimental: true` (created by
  Core's `tools/export_learnkit.py --init`). Cards arrive append-only from
  that exporter; schedule, review log and plugin state stay in LearnKit.

The installer validates digests, the embedded manifest id and the exact
version before checking the destination marker; it stages a complete plugin
directory on the target filesystem and publishes only if absent. Existing
exact assets are a no-op; divergent bytes, symlink components, unmarked or
cross-marked roots, and Git checkouts refuse with no writes.

## Updating

Review the maintainer's primary release notes and license; update one pin and
checksum set; run build/fixture tests; install to a fixture; then install and
smoke-test the real nested vault. Never use a floating `latest` URL.
