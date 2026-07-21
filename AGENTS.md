# Agent Instructions

## Current status

`pi-workflow` has an approved thin-catalog architecture and a complete implementation recipe in `PLAN.md`. Implementation has not started.

The former FSM/SQLite/interagent design was abandoned and intentionally deleted. Do not recover it from Git history or reintroduce it during V1.

When the user explicitly authorizes implementation, one implementation agent follows Tasks 1 through 4 sequentially, reading each task's exact required sources before starting it. Do not create Architect/Sergeant/Worker routing for this implementation. Pause only for stated stop conditions or explicit user-facing acceptance gates.

## Product boundary

V1 is a lightweight Markdown workflow catalog and project configuration extension.

It provides:

- global workflow discovery from `join(getAgentDir(), "workflows")`;
- central project workflow lists grouped by managing role;
- one `/workflow` configuration command;
- one read-only `pi_workflow` tool;
- prompt guardrails for project-first discovery and explicit workflow approval.

It does not provide:

- workflow execution or lifecycle state;
- an FSM, database, revisions, gates, ownership, or history;
- session attachment;
- plan inspection or editing tools;
- role activation or validation;
- interagent integration;
- project-local or bundled workflows.

Workflow IDs are lowercase-kebab filename stems. There is no frontmatter ID.

## Role boundary

`pi-workflow` may scan global role filenames only as a best-effort configuration aid. It must not import, modify, or validate `pi-role`. `pi-role` remains independently usable and unaware of workflows.

Missing-role markers are nonblocking hints. Do not expand them into cross-package integration without user approval.

## Package style

Match maintained sibling packages in the Pi superproject:

- source-loaded TypeScript under `src/`;
- `pi.extensions` package metadata;
- Pi-provided packages as optional peers;
- no unnecessary runtime dependencies;
- Vitest, TypeScript, and Prettier;
- `README.md`, `CHANGELOG.md`, `LICENSE.md`, and accurate npm metadata;
- independently installable package behavior.

Keep modules focused. Do not create generic repositories, adapters, service locators, or plugin frameworks.

## User-facing guardrails

The exact tool and prompt behavior is specified in `PLAN.md`. Preserve these essentials:

- list project workflows in bulk before recommending;
- do not inspect the global catalog without explicit user permission;
- do not read full workflow Markdown before approval or a direct read request;
- present workflow approval as the first standalone numbered decision;
- do not let agents modify `projects.json` through any tool; only the user-operated `/workflow` command may change project workflow lists;
- do not make Workers select workflows when they only execute assigned work.

`/workflow` is the only user command. It configures project workflow lists through Pi TUI components.

## Verification

For package changes, run:

```bash
npm run typecheck
npm run test
npm run build
npm run format
npm pack --dry-run
```

Use temporary catalog directories in automated tests. Do not mutate the real global workflow catalog from tests.

New user-facing tool or UI behavior requires live Pi verification and explicit user acceptance before commit.

## Source control

Commit coherent completed work using Conventional Commits. Stage only task files. Commit this child repository before updating the Pi superproject pointer.

Do not push, publish, or release without explicit user authorization.
