# pi-workflow

A thin workflow-catalog extension for [Pi](https://pi.dev).

`pi-workflow` lets users maintain a central project workflow list grouped by managing role, while keeping complete workflow guidance in global Markdown files. Agents can list project metadata in bulk, recommend an appropriate workflow, obtain explicit user approval, and then read only the selected workflow.

Implementation is in progress. The deterministic core and accepted tool/TUI behavior are complete; migration, final documentation, and superproject integration remain. [`PLAN.md`](./PLAN.md) is the authoritative V1 implementation recipe and progress checkpoint.

## V1 model

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

Workflow frontmatter contains bulk selection metadata. The Markdown body contains the complete workflow guidance. The package ships no workflow definitions.

`projects.json` maps exact lowercase-kebab project IDs to workflow-managing roles and workflow IDs. It stores no project paths and no active workflow state.

## Surfaces

### User command

```text
/workflows
```

The command opens a Pi TUI for selecting a project and role, then adding or removing workflows through a searchable on/off list.

### Agent tool

One read-only `pi_workflow` tool provides:

- `list` — all configured workflow metadata for one project, grouped by role;
- `list_global` — all global workflow metadata, only after explicit user permission;
- `read_metadata` — complete frontmatter for one workflow;
- `read` — one complete approved workflow Markdown file.

The agent tool does not modify configuration, edit plans, execute workflows, or track lifecycle state.

## Explicitly absent from V1

V1 has no FSM, SQLite database, transitions, revisions, gates, participant bindings, session attachment, role activation, or interagent protocol integration.

See [`IDEAS.md`](./IDEAS.md) only for small deferred catalog improvements. The deleted prior enforcement architecture remains available in Git history if ever needed.

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

## License

MIT. See [LICENSE.md](./LICENSE.md).
