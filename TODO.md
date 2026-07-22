# Active follow-up work

These user-requested improvements are active scope. Implement them immediately after the current Task 3 migration is accepted and committed, before Task 4 documentation and release-readiness work.

## Expanded workflow-list spacing

Add one blank line between workflow entries in expanded `pi_workflow` project and global catalog results. Preserve compact role-assignment output and existing result-size bounds.

## Collapsible tool presentation

Add plain, concise collapsed rendering for `pi_workflow` tool calls and results using Pi's supported expanded/collapsed tool presentation APIs.

Examples:

- `Listing workflows for practorium`
- `Listing global workflows`
- `Reading bounded-work metadata`
- `Reading bounded-work`

Expanded presentation should retain the complete current tool result. Collapsed presentation should show only the short action summary. Use no emoji or decorative status text. This is a TUI presentation change only; it must not reduce or alter the model-visible tool result.

## Active-role workflow candidates

Clarify the existing `pi_workflow` prompt guidance without coupling to `pi-role`:

- an agent uses its active role instructions to identify its own role;
- it recommends only workflows assigned to that role in the project workflow list;
- workflows assigned to other roles remain visible as coordination context, not candidates for the active role;
- this remains a behavioral prompt contract, not runtime role enforcement.

## Configuration navigation and exit saving

Remove `Review and save…` from both the project and role menus.

Preserve hierarchical Escape navigation:

- workflow settings `Esc` stages the current toggles and returns to the role menu;
- role menu `Esc` returns to the project menu;
- project menu `Esc` exits immediately when there are no staged changes;
- project menu `Esc` with staged changes opens a save-before-exit confirmation instead of exiting or discarding.

The save-before-exit confirmation must:

- ask whether to save the staged changes before exiting;
- default to **Yes, save and exit**;
- require Enter to select Yes or No, so Escape alone cannot discard changes;
- save atomically and exit when Yes is selected;
- discard staged changes and exit when No is selected;
- return to the top-level project menu without saving or discarding when Escape cancels the confirmation.

Simplify role-entry wording:

- menu label: `Add role ID…`;
- help text: `Enter a role ID.`;
- avoid language about claiming whether a role exists, is valid, or is active.

## Ctrl+S save-and-exit (plan pending, not for immediate implementation)

Capture only — to be finalized as a plan at the end of the session, after Task 3 closeout and Task 4 work. Do not implement until the user approves the finalized plan.

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

Open questions to resolve in the finalized plan:

- Whether saved state for the Yes path is identical to the existing Esc confirmation save.
- Whether Ctrl+S is available from every menu level (project, role, workflow toggles) or only the top-level project menu.
- Keybinding registration mechanism in pi for command-scoped shortcuts.

## Remove the managing_roles metadata field (upcoming)

`managing_roles` is not a preserved Practorium concept: the original `workflows.schema.json` required `title`, `detail`, `use_when`, `avoid_when`, `routing`, `active_state`, `process_feedback`, and `artifacts`, but never `managing_roles`. The field was introduced during the global Markdown migration as display-only metadata with no enforcement and no functional lineage.

Remove it entirely so the model is just workflows + projects + per-role assignment lists driven by `/workflows`:

- Drop `managing_roles` from the workflow frontmatter schema in `src/metadata.ts` and its validator/tests.
- Remove the `managing_roles:` block from all four global workflow files under `/workspace/.pi/agent/workflows/` (including the inconsistent Sergeant entries in `bounded-work.md`, `bounded-series.md`, `full-phase.md`).
- Stop printing the `workflow-managing roles:` line in `src/tool.ts` listing output.
- Make `Project availability by managing role:` in the listing the sole per-role source, relabeled to a neutral name (for example `Workflows assigned by role:`) since nothing is "managed" anymore.
- Update tool and metadata tests accordingly.

This supersedes the earlier Sergeant frontmatter edit; leave the existing frontmatter in place until this item removes the field wholesale.
