# LearningOS Obsidian ecosystem policy

Plugins are selected by workflow responsibility, not popularity. A plugin may
join the LearningOS vault only if it does not create a second source of truth,
bypass the operator gateway, weaken shelving approval, or cross the Job
quarantine. Versions and release checksums live in `ecosystem-plugins.json`.

## Installed and integrated

| Plugin / repository | Responsibility in LearningOS | Boundary |
|---|---|---|
| [Agentic Copilot](https://github.com/spencermarx/obsidian-ai) 1.5.3 | The **Ask AI** panel. Active-file/selection context and local CLI execution. | Configured to `tools/codex_obsidian.py`. Codex is read-only unless the clicked LearningOS action includes an explicit operational, shelving, or Job approval marker. Canonical shelving remains a separate proposal-and-approval flow. |
| [OpenAI Codex](https://github.com/openai/codex) | Local AI operator behind Agentic Copilot. | Uses official `codex exec`; read-only by default, workspace-write only after a LearningOS UI approval action. `system/OPERATOR.md` and `AGENTS.md` are the durable contract. |
| [Omnisearch](https://github.com/scambier/obsidian-omnisearch) 1.30.1 | Full-text/OCR search for authored notes and working notes. The Library button opens it for content search. | It is a retrieval index, never canonical metadata. `generated/`, registries, system files, archive, migration, and the external Job tree are excluded. |
| [Text Extractor](https://github.com/scambier/obsidian-text-extractor) 0.7.0 | Gives Omnisearch PDF/image text for stage-owned handwriting and durable attachments. | Extracted text is an index/cache, not a new note or evidence claim. |
| [PDF++](https://github.com/RyotaUshio/obsidian-pdf-plus) 0.40.31 | Opens stage-owned PDF captures with precise selection and annotation support. | PDFs remain owned by a stage or durable note. PDF++ does not choose filing or create canonical concepts. |

The custom LearningOS plugin itself follows the fixture-vault and official API
patterns from [Obsidian's sample plugin](https://github.com/obsidianmd/obsidian-sample-plugin),
while retaining its no-build distributable so the core repository never needs
a Node toolchain to run.

## Deliberately not installed

| Plugin family | Reason |
|---|---|
| Dataview / Breadcrumbs / Tasks | Reconstructs records and relationships from prose/frontmatter, creating a competing application model. The versioned manifest already owns this. |
| QuickAdd / Templater | Duplicates `los capture`, path-note, path-attach, and operator naming/routing. It would reintroduce filing decisions during learning. |
| Smart Connections / embedding chat plugins | A second semantic memory/index with its own exclusions and storage. LearningOS concepts, relations, and source judgments remain explicit; Omnisearch covers content retrieval without inventing semantic edges. |
| Obsidian MCP vault-write servers | Gives an agent direct vault mutation paths outside `tools/los.py`, optimistic snapshot checks, validation, and shelving approval. |
| Advanced Canvas / graph enhancers | The generated concept canvas is the curated graph. Enhancing the raw file graph would make the wrong relationship model more convincing. |
| Excalidraw | Useful in isolation, but its default files/attachments would need another ownership and export workflow. Stage-owned PDF/image attachment already covers the approved mixed-capture need without a new file type. Reconsider only with a concrete sketch-heavy workflow. |
| Generic AI-provider plugins | Duplicate authentication, prompts, and write permissions. Agentic Copilot reuses the local Codex operator and its repository contract. |

## Updating

Update one plugin at a time: review release notes and license, change the pinned
version/URLs/checksums, run fixture tests, install to the fixture vault, then to
the live nested vault. Never use a floating `latest` URL in the installer.
