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
