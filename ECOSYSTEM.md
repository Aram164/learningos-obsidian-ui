# LearningOS Obsidian ecosystem policy

Plugins are selected by workflow responsibility, not popularity. They may not
create a second source of truth, graph, inbox, scheduler, AI memory, or
unguarded writer. Versions, URLs and SHA-256 checksums are pinned in
`ecosystem-plugins.json`.

## Installed and integrated

| Integration | Responsibility | Managed boundary |
|---|---|---|
| [Agentic Copilot](https://github.com/spencermarx/obsidian-ai) 1.5.3 | In-vault local CLI AI panel. | `tools/codex_obsidian.py`, custom local agent, approval mode, one session. UI actions provide explicit area/module/component/unit/stage/source/snapshot context; active file is supplementary. General chat is read-only. |
| [Omnisearch](https://github.com/scambier/obsidian-omnisearch) 1.30.1 | Full-text, typo-tolerant retrieval. | PDF/image indexing on through Text Extractor; excluded strata hidden; HTTP API and remote image AI off. It is an index, never metadata. |
| [Text Extractor](https://github.com/scambier/obsidian-text-extractor) 0.7.0 | Local text extraction for PDFs/images. | OCR languages `eng` and `deu`; extracted caches are disposable and make no evidence claim. |
| [PDF++](https://github.com/RyotaUshio/obsidian-pdf-plus) 0.40.31 | Precise native PDF links/annotations. | Direct PDF editing and default write-to-file toggle off. The version stays pinned because the plugin uses private Obsidian APIs and needs a smoke test after Obsidian updates. |
| LearningOS UI | Module/unit/stage presentation and guarded actions. | Reads manifest v2 only; bundled output follows Obsidian custom-view/command/settings conventions. |

The installer merges only these managed keys so unrelated preferences survive.
App exclusions include `generated/`, `archive/`, `system/`, source registries,
`migration/`, `.venv/`, and `curriculum/quarantine/`. Job is outside the vault.

## Deliberately not installed

Dataview, Tasks, Breadcrumbs, QuickAdd, Templater, generic vault-writing MCP
servers, competing graph/semantic-memory plugins, and extra AI providers would
duplicate a canonical model or bypass the gateway. Excalidraw/sketch tooling is
deferred until one concrete stage-owned original/export workflow exists.

Yanki/Anki may be evaluated only through an approval-gated generated export
folder with automatic sync disabled. Zotero Integration may be evaluated only
through staging and source registration, never direct canonical-note overwrite.

## Updating

Review the maintainer's primary release notes and license; update one pin and
checksum set; run build/fixture tests; install to a fixture; then install and
smoke-test the real nested vault. Never use a floating `latest` URL.
