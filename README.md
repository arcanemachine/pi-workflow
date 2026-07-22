# pi-workflow

A thin workflow-catalog extension for [Pi](https://pi.dev).

`pi-workflow` lets users maintain a central project workflow list grouped by role, while keeping complete workflow guidance in global Markdown files. Agents list project metadata in bulk, recommend an appropriate workflow from that metadata, obtain explicit user approval, and then read only the selected workflow.

V1 is implemented and release-ready: a deterministic catalog, a read-only `pi_workflow` tool, and a `/workflows` configuration command that manages project and role ids and their workflow assignments.

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

`projects.json` maps exact lowercase-kebab project IDs to roles and workflow IDs. It stores no project paths and no active workflow state.

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
- A missing workflow stays visible (labelled `[missing]`) and is removable; an invalid workflow file stays visible (labelled `[invalid]`, with the validation message as the item description) without blocking configuration of valid ones. The `pi_workflow` tool output separately marks invalid entries as `[invalid: CODE, …]`.
- Escape navigates one menu level upward. At the top level, Escape with staged changes opens a save-before-exit confirmation (saving is the default); Escape from that confirmation returns to the menu. With no staged changes, Escape exits immediately. Cancellation writes nothing.

### Agent tool: `pi_workflow`

One **read-only** tool provides four actions. Results are bounded to 48 KiB; an oversized project listing returns `CATALOG_TOO_LARGE` and an oversized single workflow returns `WORKFLOW_TOO_LARGE`.

| Action          | Required args                   | Returns                                                                                                                                                                                                                        |
| --------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `list`          | `project`                       | All configured workflow metadata for one project, listed per workflow, plus a `Workflows assigned by role` section that maps each role to its assigned workflows. An empty list is valid and points the agent to `/workflows`. |
| `list_global`   | —                               | All global workflow metadata (frontmatter only, no bodies). Reserved for explicit user permission to investigate the global catalog.                                                                                           |
| `read_metadata` | `workflow` (`project` optional) | Complete frontmatter as JSON for one workflow, with a project-assignment line.                                                                                                                                                 |
| `read`          | `workflow` (`project` optional) | The complete Markdown source for one approved workflow, with a project-assignment line.                                                                                                                                        |

The tool never modifies configuration, edits plans, executes workflows, inspects plans, or tracks lifecycle state. It is one call per logical action: an agent lists project workflows once, recommends from that metadata, asks for approval as a standalone numbered item, and only then reads the chosen workflow.

The prompt guidelines shipped with the tool encode this contract, including: the agent identifies its role from its own instructions and recommends only workflows assigned to that role; workflows assigned to other roles are coordination context, not candidates; and this role-based selection is a behavioral contract, not runtime enforcement — the tool does not query or depend on any role extension.

### Tool presentation

`pi_workflow` renders with a compact one-line summary in the call line (`pi_workflow List workflows for practorium`), with an expand hint. Collapsed results show nothing until expanded; expanded results show the full text. The model-visible tool `content` is unchanged either way.

## Errors and recovery

| Code                           | Meaning                                                      | Recovery                                                                                 |
| ------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `INVALID_ARGUMENT`             | A required argument was missing or empty.                    | Supply the argument.                                                                     |
| `INVALID_ID`                   | A project, role, or workflow ID is not lowercase-kebab-case. | Correct the ID.                                                                          |
| `PROJECT_NOT_FOUND`            | The requested project is not in `projects.json`.             | Run `/workflows` to configure it, or use a configured project.                           |
| `WORKFLOW_NOT_FOUND`           | The requested workflow file does not exist.                  | Check the ID against `list` output.                                                      |
| `INVALID_WORKFLOW`             | A workflow file has invalid frontmatter or an empty body.    | Fix the Markdown file; the entry stays visible as `[invalid: …]`.                        |
| `INVALID_PROJECTS_FILE`        | `projects.json` is malformed.                                | `/workflows` shows the error and never overwrites the file; fix or remove it by hand.    |
| `UNSUPPORTED_PROJECTS_VERSION` | `projects.json` uses a newer than supported `version`.       | Use a compatible version or update `pi-workflow`.                                        |
| `WORKFLOW_TOO_LARGE`           | One workflow result exceeds 48 KiB.                          | Reduce the workflow file size.                                                           |
| `CATALOG_TOO_LARGE`            | A bulk listing exceeds 48 KiB.                               | Reduce the project workflow list with `/workflows`; do not inspect workflows one by one. |
| `CONFIG_CHANGED`               | `projects.json` changed after `/workflows` opened it.        | Reopen `/workflows` and reapply the change.                                              |
| `READ_FAILED` / `WRITE_FAILED` | An underlying filesystem error occurred.                     | Check permissions and disk state.                                                        |
| `UI_UNAVAILABLE`               | `/workflows` could not open a Pi TUI.                        | Run in a terminal that supports the Pi TUI.                                              |

Invalid workflows and unavailable roles are surfaced as diagnostics alongside valid results rather than failing the whole call.

## Explicitly absent from V1

V1 has no FSM, SQLite database, transitions, revisions, gates, participant bindings, session attachment, role activation, interagent protocol integration, plan parsing, plan-editing tools, workflow execution tools, recursive workflow directories, project-local catalogs, bundled workflow definitions, workflow ID frontmatter fields or aliases, automatic workflow selection, or automatic global-catalog investigation.

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
