# Agent Instructions

## Current status

`pi-workflow` V1 is implemented and release-ready: a thin global Markdown workflow catalog, a read-only `pi_workflow` tool with four actions, an atomic restrictive `projects.json`, and a `/workflows` configuration command that creates, renames, and deletes project and role ids via `n`/`r`/`d` hotkeys and assigns workflows through a searchable toggle list.

The former FSM/SQLite/interagent design was abandoned and intentionally deleted. Do not recover it from Git history or reintroduce it during V1.

When the user explicitly authorizes implementation, one implementation agent follows Tasks 1 through 4 sequentially, reading each task's exact required sources before starting it. Do not create Architect/Sergeant/Worker routing for this implementation. Pause only for stated stop conditions or explicit user-facing acceptance gates.

## Product boundary

V1 is a lightweight Markdown workflow catalog and project configuration extension.

It provides:

- global workflow discovery from `join(getAgentDir(), "workflows")`;
- central project workflow lists grouped by role;
- one `/workflows` configuration command;
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

The exact tool and prompt behavior lives in the tool's shipped prompt guidelines and this file's essentials. Preserve these essentials:

- list project workflows in bulk before recommending;
- do not inspect the global catalog without explicit user permission;
- do not read full workflow Markdown before approval or a direct read request;
- present workflow approval as the first standalone numbered decision;
- do not let agents modify `projects.json` through any tool; only the user-operated `/workflows` command may change project workflow lists;
- do not make Workers select workflows when they only execute assigned work.

`/workflows` is the only user command. It configures project workflow lists through Pi TUI components.

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

### Test-runner capture quirk

Vitest invocations intermittently return completely empty captured output (no `Test Files` line, no `END`) despite exiting `0` with passing tests — a harness/pipe capture artifact, not a test failure. Run it with file redirection and a sentinel so an empty capture is obvious, and kill the vitest process pattern with a bracketed class so the `pkill` cannot match its own shell:

```bash
cd /workspace/projects/pi/packages/pi-workflow && pkill -9 -f '[v]itest' || true; sleep 1
echo BEFORE; node node_modules/vitest/vitest.mjs run --reporter=default > /tmp/v.log 2>&1; echo "rc=$?"; tail -6 /tmp/v.log
```

Bare `pkill -9 -f vitest` can match the running shell itself; the `[v]itest` class avoids that. Run `pnpm --filter` from the superproject root `/workspace/projects/pi`, not from inside the package.

New user-facing tool or UI behavior requires live Pi verification and explicit user acceptance before commit.

## Source control

Commit coherent completed work using Conventional Commits. Stage only task files. Commit this child repository before updating the Pi superproject pointer.

Do not push, publish, or release without explicit user authorization.
