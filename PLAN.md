# pi-workflow V1 implementation plan

Status: Product direction and V1 architecture are approved. Implementation is in progress. This plan replaces the abandoned FSM design.

## Progress checkpoint

- Task 1 is implemented, verified, and committed in the child repository.
- Task 2 tool, prompt guidance, and TUI behavior are implemented, accepted, and committed. The sole command is `/workflows`, with no compatibility alias; package checks and a live plural-command smoke test passed. The invalid-workflow warning observed during Task 2 acceptance came from the deliberately malformed `broken.md` fixture and demonstrated the intended diagnostic behavior.
- Task 3 is implemented, accepted, and committed: the global catalog under `join(getAgentDir(), "workflows")`, the four expanded global workflow bodies, and the Practorium migration (local catalog/schema/detail authority removed; role supplements and templates retain only project-specific material; stale plan reading-list entries cleaned). User-approved follow-ups were folded in: spaced expanded listings, plain collapsible tool presentation, active-role candidate prompt guidance, hierarchical Escape navigation, and a save-before-exit confirmation. The extension is registered in the Pi superproject `pi.extensions` list so `/workflows` loads with the superproject.
- Task 4 is implemented and committed: final user documentation in `README.md`, an accurate `CHANGELOG.md` 0.1.0 entry, and package metadata. The child `pi-workflow` package passes `typecheck`, `build`, and the 49-test suite; superproject `pnpm` is enabled from the declared `packageManager` pin and the suite passes under `pnpm --filter @arcanemachine/pi-workflow`, scoped so the unrelated in-flight `pi-supercompact` change is not exercised; Node 24.16.0 satisfies the `>=22.19.0` floor; `npm pack --dry-run` and the acceptance scenarios against the real catalog pass. The global catalog is committed to the workspace repo; child commits precede the `pi` parent submodule pointer, and the `pi` parent `pnpm-lock.yaml` was reconciled to onboard `pi-workflow` and drop stale removed-package entries.
- Two follow-up items remain in `TODO.md`, both fully specified with approved design decisions and needing no new input: (1) remove the display-only `managing_roles` frontmatter field entirely; (2) a Ctrl+S save-and-exit confirmation (reuse the existing atomic save, available at every menu level, in-scope `\x13` interception in each `ctx.ui.custom` `handleInput`).
- Do not push, publish, or release.

## Purpose of this plan

This is the authoritative implementation recipe for one fresh implementation agent. It records the approved product behavior, exact terminology, file contracts, package structure, task sequence, required reading, verification, acceptance gates, and stop conditions.

Do not reconstruct the former FSM architecture from Git history. Do not add lifecycle state, transition enforcement, SQLite, structured handoffs, or session attachment to V1.

## Execution protocol

When the user explicitly says to implement this plan, that authorizes one implementation agent to execute Tasks 1 through 4 sequentially. Do not ask the user to select a workflow, approve a route, approve a reading list, approve dispatch, or reauthorize each task.

For each task, the implementation agent must:

1. read only that task's required-reading list before starting the task;
2. implement only the stated scope and allowed files;
3. run the stated verification;
4. correct failures within scope and rerun affected checks;
5. commit the verified task when its completion rule permits it; and
6. proceed directly to the next task.

The agent must stop only at a stated stop condition, an explicit user-facing acceptance gate, or an unresolved material decision. User-facing acceptance is the only routine pause: implement and verify the requested behavior, present the specified live demonstration, and wait for explicit user approval before committing or advancing that user-facing work.

Do not delegate Tasks 1 through 4, invent Architect/Sergeant/Worker routing for this implementation, or require a separate workflow engine to execute this plan. Do not push, publish, or release without separate explicit authorization.

## Objective

Create `@arcanemachine/pi-workflow`, a thin source-loaded Pi extension that lets users maintain a project-specific list of globally available Markdown workflows and lets agents investigate that list without reading every workflow.

The extension provides:

- a global Markdown workflow catalog;
- central project-to-role-to-workflow configuration;
- one `/workflows` configuration command with a small Pi TUI;
- one read-only `pi_workflow` agent tool;
- strong prompt guidance for project-first discovery and explicit workflow approval;
- clear, nonblocking diagnostics for missing or invalid catalog entries.

The extension does not execute, track, enforce, or persist workflow lifecycles. Agents follow the selected Markdown workflow using their normal role instructions, plans, tools, and direct handoffs.

## Completion definition

V1 is complete only when:

- the package is independently installable and follows sibling package conventions;
- global workflow Markdown is discovered from the approved catalog directory;
- workflow IDs come only from filename stems;
- valid metadata can be listed in bulk without reading workflow bodies;
- project workflow lists are stored centrally by project and managing role;
- `/workflows` lets the user configure those lists through project, role, and workflow selection;
- `pi_workflow` provides exactly `list`, `list_global`, `read_metadata`, and `read` actions;
- agent prompt guidance implements every approved discovery and approval guardrail;
- missing workflows and best-effort missing global roles are visible but do not break valid entries;
- Practorium can use the global catalog and its project workflow list without duplicated catalog authority;
- deterministic checks, package checks, root integration checks, and live Pi acceptance pass;
- no abandoned FSM mechanism or deferred feature enters V1.

## Approved product model

### Workflow catalog

- All workflow definitions are user-owned Markdown files in one global directory.
- The package ships no built-in workflows.
- Production resolves the directory as `join(getAgentDir(), "workflows")`.
- In the current workspace this normally resolves to `/workspace/.pi/agent/workflows`, but implementation must use `getAgentDir()` rather than hardcoding that path.
- `PI_WORKFLOW_DIR` may override the catalog directory only for automated tests, isolated development, and disposable live acceptance. It must be an absolute path. Production documentation presents the `getAgentDir()` location as the normal catalog.
- Only direct, non-hidden `*.md` files are workflow definitions.
- Subdirectories are not recursively scanned in V1.
- A workflow file's basename without `.md` is its complete workflow ID.
- There is no `id` frontmatter field.
- IDs must be lowercase kebab-case matching `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
- Example: `full-phase.md` has workflow ID `full-phase`.
- Renaming a file changes its workflow ID. V1 has no aliases, redirects, or rename migration.

### Project workflow list

The approved term is **project workflow list**. Do not call it a workflow menu in prompts, docs, or tool output. `/workflows` is a menu-like UI, but the stored product concept is a project workflow list.

Each configured project contains only roles that manage workflows for that project. Participant roles that do not select or coordinate workflows do not need entries.

Example:

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

In the approved `practorium` configuration only the Architect manages workflows; the Sergeant coordinates and reviews inside an Architect-selected workflow but does not select or manage workflows, so it has no project workflow-list entry. Rules:

- Project IDs and role IDs use the same lowercase kebab-case pattern as workflow IDs.
- The user chooses project IDs. A directory basename may be suggested, but it is not authoritative until the user confirms it.
- No project root path is stored.
- Workflow references are exact workflow IDs.
- Role entries with no workflows are removed during normalized writes.
- Projects may remain with an empty `roles` object.
- Workflow arrays are de-duplicated and sorted by ID.
- Project and role keys are serialized in lexical order for stable diffs.

### Project identification

The extension cannot infer a project from natural-language conversation.

- Agent tool calls use an exact project ID, for example `practorium`.
- The agent may infer that ID only from an explicit project name or an unambiguous working path already present in its context.
- If the project is ambiguous, the agent asks the user rather than guessing.
- The tool performs exact lookup. It does not fuzzy-match or normalize an unknown requested project into an existing project.
- `/workflows` lists configured projects and lets the user select or create one.
- No repository scanning or hardcoded `/workspace/projects` convention exists in runtime code.

### Role boundary

Integration with roles is deliberately shallow and one-way.

`pi-workflow` may:

- store role IDs as grouping keys in project configuration;
- scan direct `*.md` filenames under `join(getAgentDir(), "roles")` as a best-effort list of globally present role IDs;
- suggest those IDs when configuring a project;
- retain manually entered role IDs;
- label a configured role `[unavailable]` when no same-named global role file is present.

`pi-workflow` must not:

- import or depend on `pi-role`;
- change `pi-role`;
- activate, disable, reload, or validate roles;
- inspect active role state;
- scan project-local role directories;
- block workflow reading or configuration because a role is unavailable;
- claim that filename presence proves a role is valid or active.

`pi-role` remains unaware of workflows. A Worker may participate in a workflow without having an entry in the project workflow list.

### Authority and state

- Workflow Markdown is authoritative for workflow selection guidance and execution instructions.
- `projects.json` is authoritative only for which workflows are exposed to each managing role in each configured project.
- Conversation and user instructions remain authoritative for workflow approval.
- Plans and project guidance remain authoritative for project-specific scope and execution.
- There is no active workflow record.
- There is no current workflow state, revision, owner, gate record, participant binding, or transition history.
- There is no session persistence or plan attachment.
- Interagent remains ordinary direct coordination and is not changed by this project.

## Filesystem contract

Production paths:

```text
<getAgentDir()>/workflows/
  projects.json
  <workflow-id>.md
```

The catalog directory may be absent. In that case:

- discovery returns an empty catalog;
- a missing `projects.json` means empty project configuration;
- read-only tool actions do not create files;
- `/workflows` creates the directory and `projects.json` only after the user confirms a configuration change.

Directory and file behavior:

- Create the catalog directory recursively when saving configuration.
- Use restrictive user permissions where supported: `0700` for the directory and `0600` for `projects.json`.
- Workflow Markdown permissions are user-managed.
- Ignore hidden files, non-Markdown files, and nested directories during workflow discovery.
- Accept direct regular files and symbolic links, as `pi-role` does.
- Do not follow directories through symlinks.
- Sort discovery results by workflow ID.
- Detect case-insensitive filename collisions and report both entries as invalid rather than picking one.
- Check the 32 KiB UTF-8 file limit during catalog discovery before frontmatter parsing. A larger file remains discoverable by ID but is classified as invalid with a `WORKFLOW_TOO_LARGE` diagnostic.
- `list` and `list_global` retain that ID as an inline invalid entry; `read_metadata` and `read` return `WORKFLOW_TOO_LARGE`, which takes precedence over `INVALID_WORKFLOW`.
- Never truncate or partially parse an oversized workflow.
- Limit every rendered tool result to 48 KiB, leaving margin beneath Pi's 50 KiB limit.
- If a bulk result cannot fit, return `CATALOG_TOO_LARGE`; never silently omit workflows. The agent must stop workflow selection, report that the complete list cannot be represented, and ask the user to reduce the project workflow list through `/workflows`. It must not fall back to per-workflow inspection.
- If a `read` result cannot fit despite the 32 KiB file limit, return `WORKFLOW_TOO_LARGE` without a partial body. Keep its project-assignment preamble below 2 KiB by reporting role count plus a bounded role list when necessary.

## `projects.json` contract

Use this exact version-1 shape:

```ts
interface ProjectsFileV1 {
  version: 1;
  projects: Record<
    string,
    {
      roles: Record<string, string[]>;
    }
  >;
}
```

Validation rules:

- The root must be an object with exactly `version` and `projects`.
- `version` must equal `1`.
- `projects` must be an object.
- Every project key and role key must be a valid lowercase kebab-case ID.
- Every project value must contain exactly `roles`.
- Every role value must be an array of valid workflow IDs.
- Duplicate workflow IDs are invalid on read; normalized UI writes remove duplicates.
- Unknown fields are rejected because this is extension-owned configuration.
- Invalid configuration is never silently repaired or overwritten.
- A newer version fails closed with a clear unsupported-version diagnostic.

Writes:

1. Read and validate the current file when `/workflows` opens.
2. Preserve the exact original content token in memory.
3. Stage all UI changes in memory.
4. On save, read the file again.
5. If its content differs from the opening token, abort with `CONFIG_CHANGED` and tell the user to reopen `/workflows`.
6. Serialize normalized JSON with two-space indentation and one trailing newline.
7. Write with mode `0600` to a same-directory file named `.projects.json.tmp-<crypto.randomUUID()>`.
8. Rename that temporary file over `projects.json` atomically.
9. Remove that operation's temporary file on a caught failure.
10. Ignore stale `.projects.json.tmp-*` files from crashed processes; unique names prevent collision, and workflow discovery ignores non-Markdown files.

Do not add a database, lock service, daemon, or cross-process transaction system. The compare-before-write check is sufficient for this user-operated configuration surface.

## Workflow Markdown contract

Example:

```markdown
---
title: Bounded work
summary: Execute one substantive, well-bounded task.
managing_roles:
  - architect
  - sergeant
use_when:
  - Scope, verification, and stop conditions can be stated before execution.
  - One Worker can execute the substantive task.
avoid_when:
  - Two or more substantive tasks need milestone coordination.
routing:
  direct:
    participants:
      planner: architect
      implementer: worker
    use_when:
      - Architect review is sufficient.
  coordinated:
    participants:
      planner: architect
      coordinator: sergeant
      implementer: worker
    use_when:
      - A separate coordination and review layer is useful.
---

# Bounded work

Complete workflow guidance follows here.
```

Required frontmatter:

```ts
interface WorkflowMetadataV1 {
  title: string;
  summary: string;
  managing_roles: string[];
  use_when: string[];
  avoid_when: string[];
  routing?: Record<
    string,
    {
      participants: Record<string, string>;
      use_when?: string[];
    }
  >;
  [additionalField: string]: unknown;
}
```

Validation:

- Parse with Pi's `parseFrontmatter`.
- `title` and `summary` are required non-empty strings.
- `managing_roles`, `use_when`, and `avoid_when` are required non-empty arrays.
- Managing role values must be valid lowercase kebab-case role IDs and must not repeat.
- Every selection-guidance entry must be a non-empty string.
- `routing`, when present, must be a non-empty object.
- Route keys and participant role values must be valid lowercase kebab-case IDs.
- Every route must have a non-empty `participants` object.
- Route responsibility keys are non-empty strings; V1 does not impose a fixed responsibility taxonomy.
- Route `use_when`, when present, is a non-empty array of non-empty strings.
- The Markdown body must be non-empty.
- Additional frontmatter other than `id` is tolerated and preserved by `read_metadata`, but bulk `list` output ignores it.
- An `id` frontmatter field is invalid because the filename stem is the sole workflow ID.

Discovery returns valid workflows and diagnostics for invalid files. One invalid workflow must not prevent valid workflows from being listed or read.

## Agent tool contract

Register exactly one tool named `pi_workflow`.

Parameters:

```ts
{
  action: "list" | "list_global" | "read_metadata" | "read";
  project?: string;
  workflow?: string;
}
```

Build the parameter schema with `Type.Object`, `Type.Optional`, and `Type.String` imported from the bare `typebox` package. Use `StringEnum` imported from `@earendil-works/pi-ai` for the action enum. Both packages are Pi-provided optional peers; do not rely on one transitively exposing the other.

The tool is read-only. It never writes `projects.json`, workflow Markdown, plans, roles, or session state. Prompt guidance also forbids agents from bypassing this boundary with general file-mutation tools; only the user-operated `/workflows` command may change `projects.json`.

### `list`

Requirements:

- `project` is required and must be a valid exact project ID.
- Load and validate `projects.json`.
- Return every role and configured workflow for that project in one result.
- Group workflows by configured role.
- Include compact normalized metadata for each valid workflow:
  - ID;
  - title;
  - summary;
  - managing roles;
  - `use_when`;
  - `avoid_when`;
  - route names.
- Mark missing or invalid workflows inline without dropping them.
- Mark configured roles absent from the global role filename scan as `[unavailable]`.
- Include catalog/config warnings after the complete project list.
- An unknown project returns `PROJECT_NOT_FOUND` and names configured project IDs.
- An empty project workflow list is a valid result and tells the agent the user can configure it with `/workflows`.

### `list_global`

- Return compact normalized metadata for every valid global workflow in one result.
- Include invalid-file diagnostics.
- Do not read or return Markdown bodies.
- Prompt guidance, not runtime state, requires explicit user permission before an agent calls this action.
- `/workflows` may inspect the same metadata without a separate permission because the user directly invoked the configuration command.

### `read_metadata`

- `workflow` is required and must be an exact workflow ID.
- A missing ID returns `WORKFLOW_NOT_FOUND`.
- A present file with invalid frontmatter or metadata returns `INVALID_WORKFLOW` with its bounded diagnostics and no partial metadata.
- Return a valid workflow's complete parsed frontmatter plus source path.
- Do not return the Markdown body.
- If `project` is supplied, require that exact configured project to exist or return `PROJECT_NOT_FOUND`; otherwise state which of its configured roles reference the workflow.
- Prompt guidance requires explicit permission before reading metadata for a workflow outside the project workflow list.

### `read`

- `workflow` is required and must be an exact workflow ID.
- Return the complete raw Markdown file, including frontmatter and body.
- If `project` is supplied, require that exact configured project to exist or return `PROJECT_NOT_FOUND`; otherwise state whether and where the workflow is configured before the raw content.
- Prompt guidance allows this action only after the user approves using that workflow or directly asks to read it.
- Do not infer, attach, start, or persist anything after reading.

### Errors

Use typed internal errors and concise actionable tool text. Required codes:

- `INVALID_ARGUMENT`;
- `INVALID_ID`;
- `PROJECT_NOT_FOUND`;
- `WORKFLOW_NOT_FOUND`;
- `INVALID_PROJECTS_FILE`;
- `UNSUPPORTED_PROJECTS_VERSION`;
- `INVALID_WORKFLOW`;
- `WORKFLOW_TOO_LARGE`;
- `CATALOG_TOO_LARGE`;
- `CONFIG_CHANGED`;
- `READ_FAILED`;
- `WRITE_FAILED`;
- `UI_UNAVAILABLE`.

Never expose unrelated Pi settings, credentials, complete project context, or role bodies in errors or tool results.

## Prompt-guidance contract

Use this exact `promptSnippet`:

> List project workflow metadata and read an approved workflow.

Encode all behavioral rules below as separate `promptGuidelines` entries, not in `promptSnippet`. Every registered guideline must explicitly name `pi_workflow` because Pi appends the entries as flat global bullets. Do not inject session messages or modify the entire system prompt in V1.

The guidelines must communicate all of these rules:

1. Before recommending a workflow, state briefly that you will list the project's workflows, then call `pi_workflow` action `list` once for the exact project.
2. Use the project workflow list by default.
3. Base recommendations on the bulk metadata; do not read every workflow.
4. Do not call `read_metadata` separately for every project workflow. Use it only when the bulk result lacks a material detail needed for the user's request or the user asks for that workflow's metadata.
5. Never call `pi_workflow` action `list_global` unless the user explicitly permitted global-catalog investigation.
6. If no project workflow fits, explain that and ask permission before listing the global catalog.
7. Never use `read_metadata` on an unconfigured global workflow without explicit user permission.
8. Never use `read` until the user explicitly approves that workflow or directly asks to read it.
9. After recommending a workflow, present the required approval as the first standalone numbered item and do not bury or combine it:

   > **1. Workflow approval:** Do you approve using `<workflow-id>`?

10. A direct user instruction such as “Use `full-phase`” is already explicit approval; do not ask redundantly.
11. Workflow frontmatter in a plan does not by itself replace explicit conversational approval to use the workflow.
12. Only agents responsible for workflow selection or coordination should investigate workflows. Workers and other roles with no configured workflows execute their assigned instructions without selecting a workflow.
13. Workflow approval authorizes plan edits required by that approved workflow. Do not edit a plan outside direct user instruction or approved workflow/task guidance.
14. Never add, remove, or edit project workflow assignments with `pi_workflow` or any general file-mutation tool. Only the user-operated `/workflows` command may change `projects.json`; tell the user to run it.
15. Treat unavailable-role and missing-workflow markers as diagnostics, not permission to silently rewrite configuration.
16. If `pi_workflow` returns `CATALOG_TOO_LARGE`, stop selection, explain that a complete bulk comparison is impossible, and ask the user to reduce the project workflow list with `/workflows`; do not inspect workflows one by one.

These are behavioral guardrails, not technical approval state. Do not add approval tokens, confirmation flags, session entries, or a hidden state machine to enforce them.

## `/workflows` command contract

Register one command:

```text
/workflows
```

Description:

> Configure which workflows are available to each workflow-managing role in a project.

V1 has no `/workflows` subcommands. If any non-whitespace arguments are supplied, show `Usage: /workflows` with the command description and return without opening the UI or writing files.

The command requires `ctx.mode === "tui"`. In RPC, JSON, or print mode, return `UI_UNAVAILABLE` without modifying files.

### Interaction

Use built-in Pi TUI components instead of inventing a component framework:

- `SelectList` for project selection;
- `SelectList` for role selection;
- `SettingsList` with `on`/`off` values for workflow toggles;
- `ctx.ui.input` to create a project or enter a custom role ID;
- `ctx.ui.confirm` before saving staged changes;
- textual `[unavailable]` or `[invalid]` markers for every known issue;
- Pi theme `warning` or `error` styling as optional presentation enhancement.

Flow:

1. Load workflow discovery, best-effort global role filenames, and validated `projects.json`.
2. If `projects.json` is invalid, show the error and stop. Never overwrite it.
3. Show configured projects plus `Add project…`.
4. When adding a project:
   - suggest a lowercase-kebab form of `basename(ctx.cwd)` only as input convenience;
   - require the user to confirm or replace it;
   - validate exact lowercase kebab-case;
   - reject collisions.
5. After project selection, show configured managing roles plus:
   - globally present role IDs not yet configured;
   - `Add role ID…`;
   - `[unavailable]` on configured role IDs absent from the global role filename scan.
6. Selecting an unconfigured discovered role stages it with no workflows.
7. `Add role ID…` accepts any valid lowercase-kebab role ID and does not claim it exists.
8. After role selection, show every valid global workflow in one searchable `SettingsList` with current `on`/`off` state.
9. Also show configured missing or invalid workflow IDs as `on` entries with `[missing]` or `[invalid]` markers so the user can remove them.
10. Stage toggles in memory. Do not write on each toggle.
11. On close, show a concise before/after summary and ask whether to save.
12. Cancellation or declined confirmation performs no write.
13. On save, perform the compare-before-write and atomic-write sequence.
14. If the selected role has no workflows after saving, remove that role entry from the project workflow list.
15. Notify the user of the saved project ID, role ID, and workflow IDs.

Opening `/workflows` is explicit user intent to inspect global workflow metadata for configuration. It does not constitute conversational approval to execute any workflow.

## Package architecture

Create this focused structure:

```text
AGENTS.md
CHANGELOG.md
IDEAS.md
LICENSE.md
PLAN.md
README.md
package.json
tsconfig.json
src/
  index.ts
  ids.ts
  paths.ts
  errors.ts
  metadata.ts
  catalog.ts
  projects.ts
  roles.ts
  tool.ts
  command.ts
  ui/
    configure.ts
    components.ts
  types.ts
tests/
  ids.test.ts
  metadata.test.ts
  catalog.test.ts
  projects.test.ts
  roles.test.ts
  tool.test.ts
  command.test.ts
  extension.integration.test.ts
  fixtures/
    workflows/
```

Boundaries:

- `ids.ts`: ID validation and input suggestion only.
- `paths.ts`: catalog/config/role paths derived from `getAgentDir()`, the absolute `PI_WORKFLOW_DIR` isolation override, and injectable pure-test paths.
- `metadata.ts`: frontmatter parsing and validation.
- `catalog.ts`: directory discovery, collisions, issues, size limits, and exact lookup.
- `projects.ts`: `projects.json` parsing, normalization, compare-before-write, and atomic persistence.
- `roles.ts`: best-effort global role filename discovery only.
- `tool.ts`: read-only action dispatch and bounded rendering.
- `command.ts`: `/workflows` registration and orchestration.
- `ui/`: minimal Pi component composition; no business rules or filesystem access.
- `index.ts`: load-safe extension registration.

Do not create repositories, service locators, workflow engines, state-machine abstractions, persistence adapters, interagent clients, role adapters, or plugin systems.

## Dependency and package policy

- Match maintained sibling package conventions.
- Set package name to `@arcanemachine/pi-workflow`.
- Require Node.js `>=22.19.0`, matching the current thin sibling baseline. The former Node 24.16 requirement existed only for abandoned SQLite work.
- Use source-loaded TypeScript with `pi.extensions: ["./src/index.ts"]`.
- Declare Pi-provided packages as optional peers:
  - `@earendil-works/pi-ai`;
  - `@earendil-works/pi-coding-agent`;
  - `@earendil-works/pi-tui`;
  - `typebox`.
- Use only Node built-ins and Pi-provided peer packages at runtime.
- Do not add YAML, schema, database, state-machine, or UI libraries.
- Use Vitest, TypeScript, Prettier, and Node types as dev dependencies, aligned with maintained siblings.
- Package only `src`, `README.md`, `CHANGELOG.md`, and `LICENSE.md`.
- Do not package tests, `PLAN.md`, `IDEAS.md`, workflow definitions, or user configuration.

## Testing strategy

### Pure tests

Cover:

- lowercase-kebab validation and suggestions;
- filename-stem IDs with no frontmatter ID;
- valid and invalid metadata fields;
- additional metadata preservation;
- empty body, 32 KiB file limit, 48 KiB rendered-output limit, case collision, symlink, hidden file, nested directory, and deterministic ordering;
- missing catalog directory;
- valid, invalid, duplicate, unknown-field, and unsupported-version `projects.json`;
- normalized stable serialization;
- atomic save and temporary-file cleanup;
- `CONFIG_CHANGED` detection;
- global role filename presence and unavailable configured roles;
- every tool action and required argument;
- project grouping and missing/invalid markers;
- bulk-output size failure without partial omission;
- command cancellation and no-write behavior.

### Static prompt tests

Assert that registered prompt guidance contains every mandatory guardrail, including:

- project-first bulk listing without per-workflow metadata reads;
- explicit permission before global listing;
- full read only after approval;
- standalone first-numbered workflow approval;
- no agent configuration writes;
- no redundant confirmation after direct instruction;
- no plan edits outside approved guidance;
- no Worker workflow selection.

### Integration tests

Use temporary injected agent/catalog directories. Do not touch the real global catalog during automated tests.

Verify:

- the extension loads without side effects;
- an absolute `PI_WORKFLOW_DIR` isolates automated and live-test catalogs, while a relative override is rejected;
- tool registration and schemas;
- command registration;
- list/read behavior through Pi test contexts;
- configuration UI orchestration with deterministic fake UI responses;
- a saved config is visible to the next tool call;
- malformed user files produce diagnostics without hiding valid entries.

### Live acceptance

Before accepting user-facing implementation, run Pi interactively and demonstrate:

1. `/workflows` creates a project, adds an Architect role, and toggles workflows.
2. Reopening `/workflows` shows the saved state.
3. A configured role absent from the global role filename scan is visibly marked `[unavailable]`.
4. A configured missing workflow remains visible and removable.
5. `pi_workflow list` returns all project workflow metadata in one call.
6. `pi_workflow list_global` returns metadata without bodies.
7. `read_metadata` returns complete frontmatter without body.
8. `read` returns one complete approved workflow.
9. Prompt guidance causes an agent to ask global-catalog permission and workflow approval correctly.
10. A Worker with no project workflows follows its assignment without catalog investigation.
11. Invalid configuration is not overwritten.
12. Cancellation does not write.

User approval is required before committing user-facing behavior or completing migration.

## Implementation sequence

### Task 1 — Package scaffold and deterministic catalog core

**Repository:** `/workspace/projects/pi/packages/pi-workflow`

**Owner:** single implementation agent

**Required reading:**

- `AGENTS.md`;
- this plan through **Testing strategy**;
- `/workspace/projects/pi/AGENTS.md`;
- `/workspace/projects/pi/packages/pi-role/AGENTS.md`;
- `/workspace/projects/pi/packages/pi-role/package.json`;
- `/workspace/projects/pi/packages/pi-role/tsconfig.json`;
- `/workspace/projects/pi/packages/pi-role/src/roles.ts` for sibling discovery/error style only;
- `/workspace/projects/pi/packages/pi-role/tests/roles.test.ts` for sibling test style only;
- `/usr/local/share/npm-global/lib/node_modules/@earendil-works/pi-coding-agent/docs/packages.md`.

**Allowed package files:**

- `package.json`;
- `tsconfig.json`;
- `CHANGELOG.md`;
- `src/ids.ts`;
- `src/paths.ts`;
- `src/errors.ts`;
- `src/types.ts`;
- `src/metadata.ts`;
- `src/catalog.ts`;
- `src/projects.ts`;
- `src/roles.ts`;
- minimal load-safe `src/index.ts`;
- matching tests and fixtures.

**Implement:**

- package metadata, scripts, peers, engine, and file allowlist;
- exact path and type contracts;
- ID validation;
- workflow metadata parser;
- catalog discovery and diagnostics;
- project configuration parsing/normalization/storage;
- best-effort global role filename discovery;
- no tool or UI behavior beyond a load-safe extension entrypoint.

**Verification:**

```bash
npm run typecheck
npm run test
npm run build
npm run format
npm pack --dry-run
```

Inspect the tarball file list. Run tests with temporary directories only.

**Completion:** all deterministic core contracts pass without a running Pi session or real global catalog. Commit the child repository task, then proceed to Task 2.

### Task 2 — Read-only agent tool, prompt guardrails, and `/workflows` UI

**Repository:** `/workspace/projects/pi/packages/pi-workflow`

**Owner:** single implementation agent

**Required reading:**

- `AGENTS.md`;
- this plan's **Agent tool contract**, **Prompt-guidance contract**, **`/workflows` command contract**, and **Testing strategy**;
- accepted Task 1 implementation and tests;
- `/usr/local/share/npm-global/lib/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md`;
- `/usr/local/share/npm-global/lib/node_modules/@earendil-works/pi-coding-agent/docs/tui.md`;
- `/usr/local/share/npm-global/lib/node_modules/@earendil-works/pi-coding-agent/examples/extensions/tools.ts` for `SettingsList` usage;
- `/usr/local/share/npm-global/lib/node_modules/@earendil-works/pi-coding-agent/examples/extensions/preset.ts` for `SelectList` usage;
- `/usr/local/share/npm-global/lib/node_modules/@earendil-works/pi-coding-agent/examples/extensions/questionnaire.ts` for bounded custom UI composition.

Read the named Pi Markdown documentation completely and follow its directly relevant UI cross-references before implementing.

**Allowed files:**

- `src/index.ts`;
- `src/tool.ts`;
- `src/command.ts`;
- `src/ui/configure.ts`;
- `src/ui/components.ts`;
- narrowly required Task 1 corrections;
- matching tests.

**Implement:**

- the single four-action read-only tool;
- bounded compact output and structured details;
- exact prompt snippet and guardrails;
- the single `/workflows` command;
- staged project/role/workflow configuration UI;
- cancellation, confirmation, unavailable markers, and conflict-safe saving;
- no session entries, state injection, workflow execution, or additional commands.

**Deterministic verification:** run all package checks and dry-run packaging.

**Live acceptance gate:** Create a disposable absolute catalog directory with representative workflow and project fixtures, start Pi with `PI_WORKFLOW_DIR=<absolute-temp-dir> pi -e ./src/index.ts`, demonstrate the applicable scenarios from **Live acceptance**, and obtain explicit user approval. Remove the disposable directory afterward. Do not commit Task 2 or proceed to Task 3 before that approval. If the user requests corrections, implement them within Task 2, rerun checks, and repeat acceptance.

**Completion:** user-approved tool and UI behavior are committed coherently in the child repository.

### Task 3 — Global workflow migration and Practorium adoption

**Areas:**

- global catalog under `join(getAgentDir(), "workflows")`;
- `/workspace/projects/practorium` documentation and agent workflow material;
- `pi-workflow` documentation only where migration reveals an in-scope correction.

**Owner:** single implementation agent

**Required reading:**

- `/workspace/AGENTS.md`;
- `/workspace/projects/practorium/AGENTS.md`;
- `/workspace/projects/practorium/.agents/roles.yaml`;
- `/workspace/projects/practorium/.agents/roles/architect.md`;
- `/workspace/projects/practorium/.agents/roles/sergeant.md`;
- `/workspace/projects/practorium/.agents/roles/worker.md`;
- `/workspace/projects/practorium/.agents/workflows.yaml`;
- `/workspace/projects/practorium/.agents/workflows.schema.json`;
- `/workspace/projects/practorium/.agents/workflows/README.md`;
- `/workspace/projects/practorium/.agents/workflows/bounded-work.md`;
- `/workspace/projects/practorium/.agents/workflows/bounded-series.md`;
- `/workspace/projects/practorium/.agents/workflows/seed-planning.md`;
- `/workspace/projects/practorium/.agents/workflows/full-phase.md`;
- `/workspace/projects/practorium/.agents/workflows/steps/process-feedback.md`;
- `/workspace/projects/practorium/.agents/workflows/steps/user-acceptance-gate.md`;
- `/workspace/projects/practorium/.agents/workflows/templates/architect-acceptance-review-task.md`;
- `/workspace/projects/practorium/.agents/workflows/templates/bounded-series-readme.md`;
- `/workspace/projects/practorium/.agents/workflows/templates/bounded-work-brief.md`;
- `/workspace/projects/practorium/.agents/workflows/templates/bounded-work-routing-prompt.md`;
- `/workspace/projects/practorium/.agents/workflows/templates/phase-readme.md`;
- `/workspace/projects/practorium/.agents/workflows/templates/plan-seed.md`;
- `/workspace/projects/practorium/.agents/workflows/templates/seed-planning-readme.md`;
- `/workspace/projects/practorium/.agents/workflows/templates/sergeant-closeout-task.md`;
- `/workspace/projects/practorium/.agents/workflows/templates/sergeant-review-task.md`;
- `/workspace/projects/practorium/.agents/workflows/templates/user-acceptance-demo.md`;
- `/workspace/projects/practorium/.agents/workflows/templates/worker-task.md`;
- `/workspace/projects/practorium/.agents/scripts/validate-schemas`;
- `/workspace/projects/practorium/package.json`;
- this plan's **Workflow Markdown contract**, **Prompt-guidance contract**, and **Live acceptance** requirements.

This task explicitly authorizes all three Practorium role supplements only to identify and update their workflow-catalog references. The implementation agent does not adopt or route through those project roles.

**Implement:**

- create self-contained global `bounded-work.md`, `bounded-series.md`, `seed-planning.md`, and `full-phase.md` files;
- move selection metadata into each file's frontmatter using the exact contract;
- set `managing_roles` exactly as follows, derived from the existing planning/coordinating/review responsibilities: `bounded-work` → `architect`, `sergeant`; `bounded-series` → `architect`, `sergeant`; `seed-planning` → `architect`; `full-phase` → `architect`, `sergeant`;
- keep the body generic but complete enough that an approved workflow can be followed without another global workflow-catalog read;
- do not include Practorium product rules or absolute project paths in global workflow files;
- configure `practorium` in `projects.json`:
  - Architect: all four workflows;
  - Sergeant: `bounded-work`, `bounded-series`, and `full-phase`;
  - no Worker entry;
- update Practorium guidance and schema-validation scripts to use the project workflow list and selected global Markdown;
- treat the extension's `promptGuidelines` as the sole authority for `pi_workflow` invocation, approval, global-catalog permission, and Worker-exclusion behavior; Practorium role supplements, task templates, and plans must not duplicate those tool-use instructions;
- migrate Practorium role supplements and templates by removing project-local workflow-catalog/detail references while retaining only their project-specific responsibilities and artifact guidance; do not replace removed references with `pi_workflow` command instructions;
- retain project-specific role supplements, templates, product rules, and active plans where they remain useful;
- remove duplicated Practorium catalog/schema/detail authority only after the live migration is accepted;
- preserve `docs/ideas/agent-workflow-priming.md` unchanged unless the user explicitly requests an edit.

**Do not:**

- migrate product-specific guidance into global workflows;
- duplicate extension-level tool-use or approval policy in project role supplements, templates, plans, or workflow bodies;
- give Workers catalog-selection, workflow-approval, or `pi_workflow` instructions; Workers execute assigned artifacts and have no project workflow-list entry;
- create project-local workflow definitions;
- add paths to `projects.json`;
- change Practorium product code;
- remove active plan or template material still required by project guidance.

**Verification:**

- run `pi-workflow` package checks;
- run Practorium `npm run check`;
- run catalog discovery against the real global files;
- verify `pi_workflow list` for `practorium` returns the expected role groupings;
- verify each global workflow can be read only after the intended approval interaction;
- run `git -C /workspace status --short` and `git check-ignore` for the created global catalog files; if those files are tracked by the workspace repository, commit only the approved catalog files there, and otherwise leave them as user configuration.

**User acceptance gate:** demonstrate the migrated `/workflows` list, project tool listing, one workflow recommendation/approval/read sequence, and one Worker handoff that does not invoke workflow discovery. Obtain explicit user approval before deleting duplicated Practorium catalog files, committing user-facing migration, or proceeding to Task 4.

**Completion:** accepted global workflows and Practorium guidance have one clear catalog authority. Commit each repository coherently, child repositories before any parent pointers, then proceed to Task 4. Do not commit private runtime data or unrelated global agent files.

### Task 4 — Documentation, superproject integration, and release readiness

**Repositories:** `/workspace/projects/pi/packages/pi-workflow`, then `/workspace/projects/pi`

**Owner:** single implementation agent

**Required reading:**

- `AGENTS.md`;
- `README.md`;
- `CHANGELOG.md`;
- `package.json`;
- accepted Tasks 1 through 3 and their verification evidence;
- `/workspace/projects/pi/AGENTS.md`;
- `/workspace/projects/pi/README.md`;
- `/workspace/projects/pi/package.json`;
- `/usr/local/share/npm-global/lib/node_modules/@earendil-works/pi-coding-agent/docs/packages.md`.

**Implement:**

- final user documentation for catalog files, metadata, project configuration, `/workflows`, tool actions, guardrails, errors, and recovery;
- accurate changelog and package metadata;
- Pi superproject extension path and package listing;
- no stale planned-FSM language;
- no bundled workflow definitions.

**Verification:**

```bash
npm run typecheck
npm run test
npm run build
npm run format
npm pack --dry-run
```

Then run available Pi superproject pnpm checks, revalidate the minimum Node 22.19 runtime, inspect the tarball, run the final live scenarios, and confirm clean relevant working trees.

If pnpm is unavailable, report that exact environmental blocker rather than substituting npm for root pnpm checks.

**Completion:** the package is verified and ready for a separately authorized push/publish/release. Commit the child package before the superproject pointer. Do not push or publish.

## Acceptance scenarios

Final evidence must cover all of the following:

1. A user opens `/workflows` and sees configured projects.
2. A user creates a lowercase-kebab project ID without storing a path.
3. A user selects or enters a managing role.
4. A user toggles all desired workflows in one searchable settings view.
5. Cancellation writes nothing.
6. A concurrent file change causes `CONFIG_CHANGED` rather than overwrite.
7. A configured missing workflow remains visible and removable.
8. Best-effort missing global roles are marked without blocking configuration.
9. Valid entries remain usable when another workflow file is invalid.
10. `list` returns all project workflow metadata in one call, grouped by role.
11. `list_global` returns all global metadata without bodies.
12. `read_metadata` returns complete frontmatter without a body.
13. `read` returns exactly one complete workflow Markdown file.
14. An agent lists project workflows before recommending one.
15. An agent does not inspect the global catalog until the user explicitly permits it.
16. An agent asks workflow approval as the first standalone numbered item.
17. A direct user instruction to use a workflow is not redundantly reconfirmed.
18. An agent reads the full workflow only after approval or a direct read request.
19. A Worker with no configured workflow-management responsibility does not investigate workflows.
20. Approved workflow-required plan edits proceed without a redundant permission gate; unrelated plan edits do not.
21. Practorium uses the global catalog and project workflow list without duplicate selection authority.
22. Package and root checks pass at the required runtime baseline.

## Explicit non-goals

Do not implement:

- a workflow FSM or transition engine;
- SQLite or another database;
- active workflow state;
- lifecycle revisions, gates, ownership, or history;
- session attachment or compaction persistence;
- workflow approval tokens or enforcement state;
- plan parsing or plan frontmatter inspection tools;
- plan editing tools;
- workflow execution tools;
- role activation or active-role validation;
- changes to `pi-role`;
- interagent protocol or Pi integration changes;
- structured workflow handoffs;
- project-root registry paths;
- project-local workflow catalogs;
- bundled workflows;
- recursive workflow directories;
- workflow ID fields, aliases, or rename migration;
- arbitrary schema libraries;
- dashboards, daemons, pub/sub, or alternate transports;
- remote catalog synchronization;
- automatic workflow selection;
- automatic global-catalog investigation;
- publish or release automation.

## Stop conditions

Stop and return to the Architect and user if:

- Pi cannot provide the documented `SelectList` or `SettingsList` behavior;
- a single `/workflows` UI cannot safely stage and confirm configuration changes;
- implementing role presence requires changes to `pi-role`;
- the extension would need project root paths to satisfy active scope;
- bulk project or global metadata cannot remain bounded without abandoning the requested one-call listing model;
- a workflow metadata requirement conflicts with filename-as-ID authority;
- migration would remove Practorium product guidance or active execution artifacts;
- user-facing acceptance fails or is withheld;
- work would enter an explicit non-goal;
- a credential, destructive migration, trust, push, publish, or release decision appears.

Do not stop for routine module placement, local helper naming, fixture structure, exact nonsemantic UI spacing, or ordinary error prose already bounded by this plan.

## Source-control rules

- Keep each task atomic.
- Stage only current-task files.
- Do not commit failing checks, temporary catalogs, generated package archives, unrelated global agent files, or private runtime data.
- User-facing tool, UI, and migration changes require explicit user acceptance before commit.
- Commit child repositories before superproject pointer updates.
- Use durable Conventional Commit subjects.
- Do not mention agents, sessions, plan-task labels, or commit hashes in durable commit messages.
- Do not push, publish, or release without explicit user authorization.
