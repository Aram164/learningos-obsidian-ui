# LearningOS and Obsidian Architecture Plan

## Purpose

LearningOS should remain a lean, plain-file, machine-validated learning system. Obsidian should gradually become its human-friendly desktop interface without becoming a second source of truth.

The intended relationship is:

> LearningOS is the kernel and data model. Obsidian is the desktop environment through which a human operates it. Claude or ChatGPT is the intelligent operator.

Obsidian is not technically the "hardware," but the metaphor captures the separation correctly: LearningOS must remain functional without Obsidian, while Obsidian gradually becomes the comfortable interface normally used to run it.

## 1. Preserve the lean LearningOS core

LearningOS should continue owning only canonical knowledge and operational state:

- Notes in plain Markdown.
- Concepts and aliases.
- Explicit concept relationships.
- Sources and source evaluations.
- Module records.
- Active workspaces and coordination state.
- Garden material waiting for promotion.
- Python validation, loading, and generation.
- Stable human-readable IDs.
- Git history.

Generated indexes, dashboards, search databases, and Obsidian views remain disposable. They must always be rebuildable from the canonical files.

This preserves the strongest qualities already present in LearningOS:

- Plain files.
- No vendor lock-in.
- Machine validation.
- Human inspectability.
- Git versioning.
- Compatibility with Claude, ChatGPT, VS Code, and future tools.
- No dependency on Obsidian for correctness.

## 2. The improved system metaphor

| Component | Role |
| --- | --- |
| LearningOS Markdown/YAML | Filesystem and persistent state |
| LearningOS Python loader | Kernel and business rules |
| LearningOS CLI | System-call interface |
| Obsidian | Desktop environment and control panel |
| Claude/ChatGPT | Intelligent operator and automation layer |
| Git/GitHub | Version history, backup, and recovery |
| QMD search index | Local search engine |
| Zotero | External research library |

All tools operate on the same canonical LearningOS. None receives its own independent copy of the knowledge.

## 3. Improvements inside LearningOS itself

These are core improvements because they make the system more reliable regardless of which interface is used.

### 3.1 Stable command interface

Add a small machine-readable LearningOS CLI:

```bash
python tools/los.py status --json
python tools/los.py validate
python tools/los.py generate
python tools/los.py capture --target inbox
python tools/los.py create-note
python tools/los.py create-workspace
python tools/los.py finish-session
python tools/los.py harvest-garden
```

The existing Python loader remains the authority. Obsidian and AI agents call these commands instead of interpreting YAML independently.

For example, `status --json` might return:

```json
{
  "active_modules": 3,
  "active_workspaces": 6,
  "unreviewed_notes": 12,
  "untranscribed_materials": 4,
  "validation": "passed"
}
```

This is the most important architectural improvement because it creates one safe gateway for every future interface.

### 3.2 Evidence and review completion

The current repository has substantial content, but its note-level evidence and review fields are barely being used.

Gradually introduce:

- `reviewed` or `last_reviewed`.
- Supporting source references.
- Confidence or maturity state.
- Open questions.
- Claims still requiring verification.
- Transcription status for handwritten material.

This should remain inside existing notes rather than becoming a large independent evidence subsystem.

The dashboard can then surface:

- Notes never reviewed.
- Notes changed after their last review.
- Claims without sources.
- Notes marked uncertain.
- Handwritten notes awaiting transcription.

### 3.3 Generated Reading Room

Generate a file such as:

```text
generated/reading-room.md
```

It becomes the human-facing home page containing:

- Current module priorities.
- Upcoming assessments.
- Active workspaces.
- Next actions.
- Recently changed notes.
- Handwritten PDF shelf.
- Notes awaiting transcription.
- Garden harvest queue.
- Validation status.
- Recently completed study sessions.

The file is generated and therefore disposable. It can be opened automatically when Obsidian starts.

### 3.4 Better source perspectives

Sources can be classified by the kind of understanding they provide:

- Intuition.
- Formal proof.
- Visual explanation.
- Implementation.
- Systems architecture.
- Optimization.
- Application.
- Historical background.
- Exam preparation.
- Engineering practice.

LearningOS could then identify gaps such as:

> I understand the implementation, but I have no visual or mathematical explanation yet.

This matches the goal of gaining the whole picture through multiple complementary perspectives.

This is a future schema change and should be introduced only after the basic Obsidian interface is stable.

## 4. Obsidian as the human desktop

Obsidian should open the LearningOS repository as its vault, but its configuration should remain local and excluded from the core repository.

```text
LearningOS/
├── repository/                # Aram164/LearningOS
├── materials/
├── projects/
└── obsidian-ui/               # Aram164/LearningOS-Obsidian
```

The separate `obsidian-ui` directory is its own Git repository.

### 4.1 Note shelf using Obsidian Bases

Obsidian Bases can show notes as tables, lists, or cards based on their YAML properties.

Useful shelves include:

- Notes by module.
- Notes by role or maturity.
- Recently modified notes.
- Notes awaiting review.
- Notes awaiting transcription.
- Notes with open questions.
- Notes missing evidence.
- Notes connected to the active workspace.

Because Bases operates primarily on files, it works naturally for Markdown notes. It does not naturally represent entries embedded inside large YAML registries, which is where the custom LearningOS plugin becomes useful.

### 4.2 LearningOS dashboard

The custom interface could show:

- Continue where I stopped.
- Today's learning objective.
- Active module and workspace.
- Current questions.
- Recent sources.
- Missing perspectives.
- Validation warnings.
- Git changes.
- One-click access to handwritten material.
- Session progress.

The objective is to eliminate the need to remember filenames, folder structure, and commands.

### 4.3 Source explorer

A custom view would convert `sources.yaml` into a readable research library:

- Title and authors.
- Source type.
- Local PDF or URL.
- Associated concepts.
- Associated modules.
- Evaluations.
- Perspective or lens.
- Reading status.
- Notes derived from the source.
- Zotero identifier.

This view should read the registry through the LearningOS CLI rather than parsing and rewriting it independently.

### 4.4 Concept Canvas

Generate an Obsidian Canvas from `concept-relations.yaml`:

- Each concept becomes a card.
- Relationships become labelled connections.
- Colors distinguish relationship types.
- Clicking a concept opens its associated notes and sources.
- Filters show concepts for one module or workspace.

Canvas uses the open JSON Canvas format, so the graph can be generated without making Canvas canonical.

### 4.5 Handwriting and PDF shelf

The Reading Room could show:

- PDF thumbnail or filename.
- Module.
- Date captured.
- Transcription status.
- Linked transcription note.
- Extracted concepts.
- Review status.
- Open PDF and Continue Transcription actions.

PDF++ could later improve precise PDF linking, but it should be optional. The system should not depend on a large collection of Obsidian plugins.

### 4.6 Human-safe action buttons

Examples:

- Capture thought.
- Add source.
- Start workspace.
- Resume study.
- Mark note for review.
- Create transcription.
- Promote Garden item.
- Finish session.
- Rebuild views.
- Validate repository.
- Show Git changes.
- Open current file in VS Code.

Every write action should ultimately call the LearningOS CLI and run validation.

## 5. Separate `LearningOS-Obsidian` repository

This repository contains only the interface:

```text
LearningOS-Obsidian/
├── src/
│   ├── dashboard/
│   ├── source-explorer/
│   ├── concept-canvas/
│   ├── capture-forms/
│   └── learningos-client/
├── fixture-vault/
├── styles/
├── tests/
├── manifest.json
├── CLAUDE.md
├── AGENTS.md
└── package.json
```

It contains:

- TypeScript plugin code.
- CSS and theme adjustments.
- Obsidian Bases templates.
- Canvas generation code.
- A fake test vault.
- Interface tests.
- Compatibility information.

It does not contain:

- Real notes.
- Real sources.
- Copies of LearningOS registries.
- LearningOS business rules.
- `node_modules`.
- Canonical generated views.
- User-specific Obsidian workspace state.

The compiled files are copied locally into:

```text
repository/.obsidian/plugins/learningos-ui/
```

The `.obsidian` directory remains excluded from the LearningOS Git repository. Only the plugin source is tracked in `LearningOS-Obsidian`.

Plugin development and testing must use the separate fixture vault, never the main LearningOS vault.

## 6. Managing it through a separate Claude project

Create two distinct Claude environments.

### 6.1 Project 1: LearningOS Core

Purpose:

- Notes and source structure.
- Schema and architecture.
- Python loader.
- Validation.
- Generated views.
- Study operations.

Permissions and rules:

- Work in `repository/`.
- May read `materials/` and `projects/` when needed.
- Must not inspect `Job/` without explicit permission.
- Must run `make check` and `make test` after applicable changes.
- Must request approval before schema or architecture changes.

### 6.2 Project 2: LearningOS Obsidian

Purpose:

- User experience.
- Plugin code.
- Dashboards.
- Styling.
- Forms.
- Generated Canvas views.
- Obsidian integration tests.

Normal access:

- `obsidian-ui/`.
- `fixture-vault/`.
- A documented JSON/CLI contract.
- No write access to real LearningOS knowledge during normal development.

A Claude Cowork project can use an existing local folder, making it suitable for this separation. A normal cloud Claude Project can track the GitHub repository for discussion, but it is not the same as operating on the live local vault.

### 6.3 UI-project instructions

Its `CLAUDE.md` should contain rules like:

```markdown
# LearningOS Obsidian Project

This repository implements a human interface for LearningOS.

## Ownership

LearningOS owns all canonical data, validation, and business rules.
This project owns only presentation and interaction.

## Required rules

- Develop against fixture-vault, never the real vault.
- Do not duplicate LearningOS validation rules in TypeScript.
- Read canonical state through the LearningOS CLI.
- Send mutations through explicit CLI commands.
- Treat generated files as disposable.
- Never directly rewrite YAML registries.
- Never rename or move canonical notes automatically.
- Keep ordinary Markdown compatible with other editors.
- Do not introduce Obsidian-only meaning into canonical notes.
- Run UI tests before installation.
- Installation into a real vault requires explicit confirmation.
```

For working with ChatGPT, the equivalent rules go into `AGENTS.md`. A ChatGPT Work session would normally open `LearningOS-Obsidian` alone. A separate integration session can temporarily access both repositories after the plugin passes fixture tests.

## 7. AI operating commands

The agent commands can exist in Claude and ChatGPT:

- `/los:resume` — reconstruct the current state and next action.
- `/los:study` — run a guided learning session.
- `/los:capture` — route a thought to inbox, Garden, or workspace.
- `/los:source` — register and evaluate a source.
- `/los:harvest` — promote valuable Garden material.
- `/los:finish-session` — summarize progress and update coordination.

These should be thin workflows around the LearningOS CLI rather than separate intelligence stored inside a Claude project.

Project memory can remember interaction preferences, but project memory must never become the only place containing:

- Learning progress.
- Open questions.
- Source evaluations.
- Decisions.
- Study plans.

Anything important must be written back into LearningOS.

## 8. Local retrieval with QMD

QMD can provide fast local keyword and semantic retrieval over:

- Canonical notes.
- Concepts.
- Sources.
- Active workspaces.
- Coordination state.

Exclude:

- Generated files.
- Archived workspaces.
- `.git`.
- `.obsidian`.
- The quarantined `Job/` folder.
- Large unrelated PDFs unless deliberately indexed.

Its index is a cache, never canonical knowledge. Claude, ChatGPT, and potentially the Obsidian plugin can all query the same index.

This improves queries such as "find what I previously understood about lowering rules" without requiring a second AI memory system.

## 9. Zotero integration

Use Zotero as the external research library for:

- PDF storage.
- Bibliographic metadata.
- Authors, publication, and DOI information.
- Highlights and annotations.
- Collections.

Use LearningOS for:

- Why the source matters.
- Which concepts it teaches.
- Quality evaluation.
- The user's synthesis.
- Relationships to modules and workspaces.

The connection can be stored as:

```yaml
identifiers:
  zotero_key: ABCD1234
```

This prevents bibliographic duplication while keeping the actual learning interpretation inside LearningOS.

## 10. Guardrails

Introduce lightweight hooks or command checks that:

- Prevent manual edits to generated files.
- Warn before changing schemas.
- Protect the `Job/` quarantine.
- Run validation after agent changes.
- Show the Git diff before committing.
- Prevent simultaneous writes by multiple agents.
- Block an Obsidian form if the underlying file changed while open.
- Use recoverable operations when deleting or moving material.

## 11. What should deliberately not be added

To avoid reproducing LearningOS inside Obsidian:

- No second canonical graph.
- No Dataview dependency for core meaning.
- No Obsidian-only `[[links]]` required for correctness.
- No separate Daily Notes inbox.
- No automatic folder restructuring.
- No uncontrolled YAML editing.
- No more than a small handful of carefully selected plugins.
- No duplicate Claude or ChatGPT memory database.
- No remote Obsidian REST API when the agent already has local folder access.
- No replacement with Foam, Logseq, IWE, or another competing graph system.
- No plugin source or Node build system inside LearningOS core.
- No two agents editing the same files simultaneously.

VS Code remains the engineering and bulk-editing interface. Obsidian becomes the reading, navigating, and everyday learning interface.

## 12. Recommended implementation order

1. Add the stable JSON/CLI interface.
2. Generate `reading-room.md`.
3. Improve note review, evidence, and transcription state.
4. Create `LearningOS-Obsidian` with a fixture vault.
5. Build a read-only dashboard.
6. Add note shelves and handwritten-material views.
7. Add the source explorer.
8. Generate the concept Canvas.
9. Add safe capture and workspace forms.
10. Add QMD retrieval.
11. Add Zotero linking.
12. Add controlled agent commands and guardrails.

## 13. Final architecture principle

The end result is one operating system with several replaceable interfaces:

- Obsidian for human use.
- VS Code for engineering.
- Claude or ChatGPT for guided operation.

LearningOS stays lean because interface code, indexing, styling, and agent-specific configuration all live outside its canonical core.
