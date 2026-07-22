# Follow-up work

Work requested beyond the original V1 plan. Completed items are retained as a record; upcoming items are the active backlog.

## Completed

The following user-requested improvements were implemented and committed as part of Task 3:

- **Expanded workflow-list spacing** — one blank line between workflow entries in expanded `pi_workflow` project and global catalog results, preserving the bounded result size.
- **Collapsible tool presentation** — plain one-line collapsed action summary with an expand hint; expanded shows the full result. No emoji. Model-visible content unchanged.
- **Active-role workflow candidates (prompt guidance)** — agents identify their role from their own instructions and recommend only their assigned workflows; other managing roles are coordination context. Behavioral contract, not runtime enforcement.
- **Configuration navigation and exit saving** — removed `Review and save…`; hierarchical Escape navigation; top-level Escape with staged changes opens a save-before-exit confirmation (Yes, save and exit / No, discard and exit); Escape returns to the project menu. Simplified `Add role ID…` wording.

## Upcoming

### Ctrl+S save-and-exit confirmation

Capture only — finalized as a plan, not yet implemented. Do not implement until the user approves.

Behavior:

- Pressing Ctrl+S at any time inside `/workflows`:
  - when there are no staged changes → exit the configurator immediately, no dialog;
  - when there are staged workflow-list changes → open a save-and-exit confirmation dialog.
- The dialog asks `Save staged changes and exit? (y/N)`.
- Layout: **Yes** is the top item, **No** is the bottom item, and **No is the default selected item** (cursor starts on No).
- Esc → cancel the dialog and return to the current menu; staged state preserved, no save.
- Enter on the default **No** → cancel and return to the current menu; staged state preserved, no save.
- Press Up to reach **Yes**, then Enter → save staged changes atomically and exit the configurator.
- Safe-default design: the easy path (Esc, or Enter on the default No) preserves state without saving; saving-and-exiting requires deliberately moving Up to Yes.

Open questions to resolve before implementation:

- Whether saved state for the Yes path is identical to the existing Esc confirmation save.
- Whether Ctrl+S is available from every menu level (project, role, workflow toggles) or only the top-level project menu.
- Keybinding registration mechanism in pi for command-scoped shortcuts.

### Remove the managing_roles metadata field

`managing_roles` is not a preserved Practorium concept: the original `workflows.schema.json` required `title`, `detail`, `use_when`, `avoid_when`, `routing`, `active_state`, `process_feedback`, and `artifacts`, but never `managing_roles`. The field was introduced during the global Markdown migration as display-only metadata with no enforcement and no functional lineage.

Remove it entirely so the model is just workflows + projects + per-role assignment lists driven by `/workflows`:

- Drop `managing_roles` from the workflow frontmatter schema in `src/metadata.ts` and its validator/tests.
- Remove the `managing_roles:` block from all four global workflow files under `/workspace/.pi/agent/workflows/` (including the inconsistent Sergeant entries in `bounded-work.md`, `bounded-series.md`, `full-phase.md`).
- Stop printing the `workflow-managing roles:` line in `src/tool.ts` listing output.
- Make `Project availability by managing role:` in the listing the sole per-role source, relabeled to a neutral name (for example `Workflows assigned by role:`) since nothing is "managed" anymore.
- Update tool and metadata tests accordingly.

This supersedes the earlier Sergeant frontmatter edit; leave the existing frontmatter in place until this item removes the field wholesale.
