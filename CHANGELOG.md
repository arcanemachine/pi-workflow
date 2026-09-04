# Changelog

## 0.1.0 - Unreleased

- Add a top-level `/workflows` menu with separate **Edit project workflows** and **Invoke workflow** actions. Invocation lists valid global workflows, warns and omits invalid entries, inserts the selected Markdown source as a visible persisted custom message, and starts an agent turn without changing project configuration.
- Make semantic and operational workflow-tool failures reject as Pi tool errors, preserving specific error codes and visible collapsed recovery text instead of rendering successful result rows.
- Clarify contextual project/global scope selection, configured project IDs, and retrying without `project` when global context may help.

- Add `n`/`r`/`d` hotkey CRUD to the `/workflows` project and role menus: `n` creates an id in an in-menu text field, `r` renames the hovered id (field pre-populated), and `d` deletes the hovered id through a No-default Yes/No picker. Hotkeys are intercepted in each custom list renderer before delegating to `SelectList` (no core `AppKeybinding`); deletes use a custom No-default picker; the workflow layer keeps its searchable on/off toggle list. CRUD touches only `projects.json` ids and assignments through the existing atomic `saveProjectsFile` path.
- Remove the `managing_roles` workflow frontmatter field and "managing role" wording across the surface; the project listing now reads `Workflows assigned by role:`.
- Remove the completed `TODO.md` and `PLAN.md` tracking files once no items remained.

- Add a thin workflow-catalog extension for Pi.
- Discover global Markdown workflows under Pi's agent directory by filename stem; parse and validate frontmatter (title, summary, use_when, avoid_when, optional routing) without bundled workflow definitions.
- Add `projects.json` project workflow lists: exact lowercase-kebab project IDs mapped to roles and workflow IDs, stored without paths or active state, written atomically with restrictive permissions.
- Add the `/workflows` TUI for project, role, and multi-select workflow configuration, with hierarchical Escape navigation, save-before-exit confirmation, and a `CONFIG_CHANGED` abort-on-change write contract.
- Add namespaced read-only workflow tools for project/global listing, metadata inspection, and approved Markdown reads. Results are bounded to 48 KiB, with `CATALOG_TOO_LARGE` and `WORKFLOW_TOO_LARGE` overflow codes.
- Encode agent workflow-selection guidance (contextual project/global scope, bulk-first listing, explicit user approval before reading, active-role selection as a behavioral contract) in tool prompt guidelines.
- Render workflow tools with compact collapsible summaries; keep model-visible content unchanged.
