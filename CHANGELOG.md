# Changelog

## 0.1.0 - Unreleased

- Add a thin workflow-catalog extension for Pi.
- Discover global Markdown workflows under Pi's agent directory by filename stem; parse and validate frontmatter (title, summary, managing_roles, use_when, avoid_when, optional routing) without bundled workflow definitions.
- Add `projects.json` project workflow lists: exact lowercase-kebab project IDs mapped to workflow-managing roles and workflow IDs, stored without paths or active state, written atomically with restrictive permissions.
- Add the `/workflows` TUI for project, role, and multi-select workflow configuration, with hierarchical Escape navigation, save-before-exit confirmation, and a `CONFIG_CHANGED` abort-on-change write contract.
- Add the read-only `pi_workflow` tool with four actions: `list`, `list_global`, `read_metadata`, and `read`. Bounded 48 KiB results, with `CATALOG_TOO_LARGE` and `WORKFLOW_TOO_LARGE` overflow codes.
- Encode agent workflow-selection guidance (bulk-first listing, explicit user approval before `read`, active-role selection as a behavioral contract) in tool prompt guidelines.
- Render `pi_workflow` with a compact collapsible summary; keep model-visible content unchanged.
