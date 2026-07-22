# Changelog

## 0.1.0 - Unreleased

- Add `n`/`r`/`d` hotkey CRUD to the `/workflows` project and role menus: `n` creates an id in an in-menu text field, `r` renames the hovered id (field pre-populated), and `d` deletes the hovered id through a No-default Yes/No picker. Hotkeys are intercepted in each custom list renderer before delegating to `SelectList` (no core `AppKeybinding`); deletes use a custom No-default picker; the workflow layer keeps its searchable on/off toggle list. CRUD touches only `projects.json` ids and assignments through the existing atomic `saveProjectsFile` path.
- Remove the `managing_roles` workflow frontmatter field and "managing role" wording across the surface; the project listing now reads `Workflows assigned by role:`.
- Remove the completed `TODO.md` and `PLAN.md` tracking files once no items remained.

- Add a thin workflow-catalog extension for Pi.
- Discover global Markdown workflows under Pi's agent directory by filename stem; parse and validate frontmatter (title, summary, use_when, avoid_when, optional routing) without bundled workflow definitions.
- Add `projects.json` project workflow lists: exact lowercase-kebab project IDs mapped to roles and workflow IDs, stored without paths or active state, written atomically with restrictive permissions.
- Add the `/workflows` TUI for project, role, and multi-select workflow configuration, with hierarchical Escape navigation, save-before-exit confirmation, and a `CONFIG_CHANGED` abort-on-change write contract.
- Add the read-only `pi_workflow` tool with four actions: `list`, `list_global`, `read_metadata`, and `read`. Bounded 48 KiB results, with `CATALOG_TOO_LARGE` and `WORKFLOW_TOO_LARGE` overflow codes.
- Encode agent workflow-selection guidance (bulk-first listing, explicit user approval before `read`, active-role selection as a behavioral contract) in tool prompt guidelines.
- Render `pi_workflow` with a compact collapsible summary; keep model-visible content unchanged.
