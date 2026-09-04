# pi-workflow

A thin workflow-catalog extension for [Pi](https://pi.dev).

`pi-workflow` lets users maintain a central project workflow list grouped by role, while keeping complete workflow guidance in global Markdown files. Agents use project metadata when a relevant configured project is known, use the global catalog for non-project work, recommend an appropriate workflow from bulk metadata, obtain explicit user approval, and then read only the selected workflow.

V1 is implemented and release-ready: a deterministic catalog, namespaced read-only workflow tools, and a `/workflows` configuration command that manages project and role ids and their workflow assignments.

## V1 model

Pi has no built-in workflow engine in V1. `pi-workflow` is a thin catalog: it discovers Markdown files, parses their frontmatter, and exposes bulk metadata so an agent can recommend a workflow without reading every file.

Global workflows live under Pi's agent directory:

```text
~/.pi/agent/workflows/
├── projects.json
├── bounded-work.md
├── bounded-series.md
├── seed-planning.md
└── full-phase.md
```

The actual location is resolved through Pi's `getAgentDir()` API rather than hardcoded. For tests, isolated development, and disposable live acceptance, set `PI_WORKFLOW_DIR` to an absolute path to override the catalog directory; this override is never used in normal production documentation.

### Workflow files

A workflow is one Markdown file. Its filename stem is its ID:

```text
full-phase.md → full-phase
```

IDs are lowercase-kebab-case (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`). A workflow's ID must not appear in its frontmatter; the filename is the only source of identity.

Workflow frontmatter carries bulk selection metadata:

```yaml
---
title: Bounded work
summary: Execute one substantive, well-bounded task without full phase ceremony.
use_when:
  - One Worker can complete the substantive task.
avoid_when:
  - Two or more substantive execution tasks are required.
routing:
  direct:
    participants:
      planner: architect
      implementer: worker
    use_when:
      - The brief is clear enough for one Worker.
---
```

Required fields: `title`, `summary`, `use_when` (non-empty array), `avoid_when` (non-empty array). Optional: `routing`, a map of lowercase-kebab route IDs to `participants` (a non-empty role map) and an optional `use_when` array. The Markdown body must be non-empty and holds the complete workflow guidance.

The package ships no workflow definitions. Workflows are project-specific content stored outside the package.

### `projects.json`

`projects.json` maps exact lowercase-kebab project IDs to roles and workflow IDs. A tool `project` argument, when supplied, is one of these configured IDs, never a filesystem path, repository basename, or inferred working directory. Listing and individual workflow reads omit `project` for global work. It stores no project paths and no active workflow state.

```json
{
  "version": 1,
  "projects": {
    "practorium": {
      "roles": {
        "architect": [
          "bounded-series",
          "bounded-work",
          "full-phase",
          "seed-planning"
        ]
      }
    }
  }
}
```

Only a project's roles get entries. A role that coordinates or reviews inside an Architect-selected workflow but does not select workflows has no project workflow-list entry. Only the user-operated `/workflows` command writes this file — never the agent tool, and never general file-mutation tools.

`/workflows` writes `projects.json` atomically: it reads the file when the command opens, stages changes in memory, and on save re-reads the file; if the on-disk content changed (`CONFIG_CHANGED`), it aborts rather than overwrite. The write goes to a unique temporary file with mode `0600`, in a directory created with mode `0700`, then renames over the target. Stale `.projects.json.tmp-*` files from crashed processes are ignored and never collide.

## Surfaces

### User command: `/workflows`

The command opens a Pi TUI with three layers: a **project** menu, a **role** menu (within a project), and a **workflow toggle list** (within a role). Changing projects or roles stays staged in memory and is written atomically on save.

- `/workflows` takes no arguments in V1. Any non-whitespace arguments show `Usage: /workflows` and return without opening the UI or writing files.
- Project and role IDs are lowercase-kebab and stored without paths.
- **Project and role menus** are lists of ids with single-key hotkeys acting on the hovered item:
  - `n` — **create** an id. Opens an in-menu text field seeded empty; Enter commits (validates lowercase-kebab and rejects collisions, looping on error), Esc returns to the list with no change. No confirmation.
  - `r` — **rename** the hovered id. Opens the same text field pre-populated with the current id; Enter commits the rename (validates and collision-checks; an unchanged id is a no-op), Esc returns with no change. Renaming a project carries its roles and workflow assignments over; renaming a role carries its workflow assignments over. No confirmation.
  - `d` — **delete** the hovered id. Opens a "Delete …?" Yes/No picker with **No as the safe default** (Yes is above No, cursor starts on No). Esc or Enter-on-No cancels; move Up to Yes and Enter to delete. Deleting a project removes it and all its workflow assignments; deleting a role removes it and its assignments. No confirmation on the cancel path.
  - Enter (no modifier) on a hovered project or role descends to the next layer. A role with no global role filename under `~/.pi/agent/roles/` is shown once configured, annotated `[unavailable]`; configuring a role is done by creating its id with `n` and then assigning workflows.
- The **workflow layer** uses a searchable on/off toggle list to pick which already-defined global workflows belong to a role. Workflows are defined by their Markdown files; `/workflows` does not create, edit, or delete workflow files.
- A missing workflow stays visible (labelled `[missing]`) and is removable; an invalid workflow file stays visible (labelled `[invalid]`, with the validation message as the item description) without blocking configuration of valid ones. The workflow listing tool output separately marks invalid entries as `[invalid: CODE, …]`.
- Escape navigates one menu level upward. At the top level, Escape with staged changes opens a save-before-exit confirmation (saving is the default); Escape from that confirmation returns to the menu. With no staged changes, Escape exits immediately. Cancellation writes nothing.

### Agent tools

Three **read-only** namespaced tools keep listing, metadata inspection, and approved Markdown reads distinct. Results are bounded to 48 KiB; an oversized bulk listing returns `CATALOG_TOO_LARGE` and an oversized single workflow returns `WORKFLOW_TOO_LARGE`.

| Tool                        | Required args                  | Returns                                                                                                                                                                            |
| --------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pi_workflow_list`          | `project` optional             | With a configured `project`, all assigned workflow metadata for that project plus role assignments. Without `project`, all global workflow metadata (frontmatter only, no bodies). |
| `pi_workflow_read_metadata` | `workflow`, `project` optional | Complete frontmatter as JSON for one workflow, with a project-assignment line when `project` is supplied.                                                                          |
| `pi_workflow_read`          | `workflow`, `project` optional | The complete Markdown source for one approved workflow, with a project-assignment line when `project` is supplied.                                                                 |

Use project context when the task belongs to a known configured project. For non-project work, or when no relevant configured project is known, omit `project` and use the global catalog. Do not infer a project ID solely from the working directory or repository name. If a supplied project is not configured, the tool reports `PROJECT_NOT_FOUND`; retrying the same operation without `project` is allowed when global context may help.

The tools never modify configuration, edit plans, execute workflows, inspect plans, or track lifecycle state. For project workflow selection, an agent lists project metadata once, recommends from that metadata, asks for approval as a standalone numbered item, and only then reads the chosen workflow. The prompt guidelines also require the active role to come from role instructions, with workflows assigned to other roles treated as coordination context rather than candidates. This role-based selection is a behavioral contract, not runtime enforcement — the tools do not query or depend on any role extension.

### Tool presentation

The workflow tools render successful calls with compact one-line summaries and an expand hint. Collapsed successful results show nothing until expanded. Semantic and operational failures reject the tool call, so Pi renders its standard error state and keeps the bounded error and recovery text visible while collapsed. The model-visible success content is unchanged.

## Errors and recovery

| Code                           | Meaning                                                      | Recovery                                                                                                |
| ------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `INVALID_ARGUMENT`             | A required argument was missing or empty.                    | Supply the argument.                                                                                    |
| `INVALID_ID`                   | A project, role, or workflow ID is not lowercase-kebab-case. | For a project, use a configured lowercase-kebab ID, not a filesystem path.                              |
| `PROJECT_NOT_FOUND`            | The requested project is not in `projects.json`.             | Check configured project IDs; when global context may help, retry the same operation without `project`. |
| `WORKFLOW_NOT_FOUND`           | The requested workflow file does not exist.                  | Check the ID against `pi_workflow_list` output.                                                         |
| `INVALID_WORKFLOW`             | A workflow file has invalid frontmatter or an empty body.    | Fix the Markdown file; the entry stays visible as `[invalid: …]`.                                       |
| `INVALID_PROJECTS_FILE`        | `projects.json` is malformed.                                | `/workflows` shows the error and never overwrites the file; fix or remove it by hand.                   |
| `UNSUPPORTED_PROJECTS_VERSION` | `projects.json` uses a newer than supported `version`.       | Use a compatible version or update `pi-workflow`.                                                       |
| `WORKFLOW_TOO_LARGE`           | One workflow result exceeds 48 KiB.                          | Reduce the workflow file size.                                                                          |
| `CATALOG_TOO_LARGE`            | A bulk listing exceeds 48 KiB.                               | Reduce the project workflow list with `/workflows`; do not inspect workflows one by one.                |
| `CONFIG_CHANGED`               | `projects.json` changed after `/workflows` opened it.        | Reopen `/workflows` and reapply the change.                                                             |
| `READ_FAILED` / `WRITE_FAILED` | An underlying filesystem error occurred.                     | Check permissions and disk state.                                                                       |
| `UI_UNAVAILABLE`               | `/workflows` could not open a Pi TUI.                        | Run in a terminal that supports the Pi TUI.                                                             |

Invalid workflows and unavailable roles are surfaced as diagnostics alongside valid results rather than failing the whole call. Empty catalogs are also successful results; only an operation that cannot complete is a failed tool execution.

## Explicitly absent from V1

V1 has no FSM, SQLite database, transitions, revisions, gates, participant bindings, session attachment, role activation, interagent protocol integration, plan parsing, plan-editing tools, workflow execution tools, recursive workflow directories, project-local catalogs, bundled workflow definitions, workflow ID frontmatter fields or aliases, or automatic workflow selection.

## Development

Package checks:

```bash
npm install
npm run typecheck
npm run test
npm run build
npm run format
npm pack --dry-run
```

Requires Node `>=22.19.0`.

## License

MIT. See [LICENSE.md](./LICENSE.md).
