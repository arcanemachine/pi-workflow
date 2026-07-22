# Follow-up work

Work requested beyond the original V1 plan. Completed items are retained as a record; upcoming items are the active backlog.

## Completed

The following user-requested improvements were implemented and committed as part of Task 3:

- **Expanded workflow-list spacing** — one blank line between workflow entries in expanded `pi_workflow` project and global catalog results, preserving the bounded result size.
- **Collapsible tool presentation** — plain one-line collapsed action summary with an expand hint; expanded shows the full result. No emoji. Model-visible content unchanged.
- **Active-role workflow candidates (prompt guidance)** — agents identify their role from their own instructions and recommend only their assigned workflows; other roles are coordination context. Behavioral contract, not runtime enforcement.
- **Configuration navigation and exit saving** — removed `Review and save…`; hierarchical Escape navigation; top-level Escape with staged changes opens a save-before-exit confirmation (Yes, save and exit / No, discard and exit); Escape returns to the project menu. Simplified `Add role ID…` wording.
- **Removed the `managing_roles` frontmatter field** — the display-only `managing_roles` workflow frontmatter field had no enforcement or functional lineage, so it was removed in full: dropped from the schema/validator/tests, removed from all four global workflow files, the per-workflow listing line was dropped, `Project availability by managing role:` was relabeled to `Workflows assigned by role:`, and the `managing role` wording in the `/workflows` command description, role-selection prompts, and prompt guidelines was neutralized to `role`.

## Upcoming

### Ctrl+S save-and-exit confirmation

Captured as a plan with approved design decisions; not yet implemented.

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

Resolved design decisions (approved):

- Yes-path save is identical to the existing Esc confirmation save; reuse that atomic save routine so Ctrl+S only routes to it (no separate save path).
- Ctrl+S is available from every menu level (project, role, workflow toggles), consistent with Escape's one-level-up navigation.
- Keybinding mechanism: in-scope interception of the raw Ctrl+S byte (`\x13`) inside each `ctx.ui.custom` `handleInput`, before delegating to the list. This stays within pi-workflow V1's thin scope; do NOT add a command-scoped `AppKeybinding` to pi-coding-agent core (out of V1 scope).
