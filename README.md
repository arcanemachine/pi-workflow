# pi-workflow

A planned thin workflow-catalog extension for [Pi](https://pi.dev).

`pi-workflow` will let users maintain a central project workflow list grouped by managing role, while keeping complete workflow guidance in global Markdown files. Agents will be able to list project metadata in bulk, recommend an appropriate workflow, obtain explicit user approval, and then read only the selected workflow.

Implementation has not started. [`PLAN.md`](./PLAN.md) is the authoritative V1 implementation recipe.

## Planned V1 model

Global workflows live under Pi's agent directory:

```text
~/.pi/agent/workflows/
├── projects.json
├── bounded-work.md
├── bounded-series.md
├── seed-planning.md
└── full-phase.md
```

The actual location is resolved through Pi's `getAgentDir()` API rather than hardcoded.

A workflow's filename stem is its ID:

```text
full-phase.md → full-phase
```

Workflow frontmatter contains bulk selection metadata. The Markdown body contains the complete workflow guidance. The package will ship no workflow definitions.

`projects.json` maps exact lowercase-kebab project IDs to workflow-managing roles and workflow IDs. It stores no project paths and no active workflow state.

## Planned surfaces

### User command

```text
/workflow
```

The command opens a Pi TUI for selecting a project and role, then adding or removing workflows through a searchable on/off list.

### Agent tool

One read-only `pi_workflow` tool will provide:

- `list` — all configured workflow metadata for one project, grouped by role;
- `list_global` — all global workflow metadata, only after explicit user permission;
- `read_metadata` — complete frontmatter for one workflow;
- `read` — one complete approved workflow Markdown file.

The agent tool will not modify configuration, edit plans, execute workflows, or track lifecycle state.

## Explicitly absent from V1

V1 has no FSM, SQLite database, transitions, revisions, gates, participant bindings, session attachment, role activation, or interagent protocol integration.

See [`IDEAS.md`](./IDEAS.md) only for small deferred catalog improvements. The deleted prior enforcement architecture remains available in Git history if ever needed.

## Development

After implementation begins:

```bash
npm install
npm run typecheck
npm run test
npm run build
npm run format
npm pack --dry-run
```

## License

MIT. See [LICENSE.md](./LICENSE.md).
