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

### Create / rename / delete projects and roles from `/workflows`

Full id-CRUD of projects and roles directly in the `/workflows` menus. Approved and input-free.

Scope and layers:

- The project menu and the role menu are list menus of ids. Each provides create / rename / delete via single-key hotkeys that act on the hovered item.
- The workflow layer is unchanged: it uses the existing searchable check/uncheck toggle list to pick which already-defined workflows belong to a role. No create/rename/delete there; workflows are defined by their Markdown files.
- CRUD touches ids and assignment entries in `projects.json` only. `/workflows` must not create, edit, or delete workflow `.md` files.

Hotkeys (project menu and role menu):

- `n` → **create**. Open an in-menu text field seeded empty. Enter commits the id (validate lowercase-kebab and no collision, looping on error). Esc returns to the menu with no change. No confirmation prompt.
- `r` → **rename** the hovered item. Open an in-menu text field pre-populated with the current id (editable). Enter commits the new id (validate lowercase-kebab and no collision; an unchanged id is a no-op return). Esc returns with no change. No confirmation prompt.
- `d` → **delete** the hovered item. Open a "Delete {project|role} {name}?" Yes/No picker. **Yes is the top item, No is the bottom item, and the cursor starts on No** (safe default). Esc or Enter-on-No → return to the menu, no change. Press Up to Yes then Enter → delete the item and (for projects) all its workflow assignments. No confirmation prompt on the cancel side.
- Enter (no modifier) on a hovered project or role → descend as today.

Implementation:

- Intercept `n`, `r`, `d` (and plain Enter) inside each custom list renderer's `handleInput(data)` **before** delegating to `SelectList.handleInput`. `SelectList` binds only up/down/enter/escape, so these keys do not conflict. This stays within pi-workflow V1's thin scope; do NOT add command-scoped `AppKeybinding`s to pi-coding-agent core.
- Create/rename text field: build a custom `ctx.ui.custom` renderer using pi-tui's `Input` component (which exposes `setValue()`/`getValue()`/`onSubmit`/`onEscape`) so the field can be pre-populated for rename. `ctx.ui.input(title, placeholder)` cannot pre-fill editable text, so it is not used here.
- Delete picker: a custom two-item Yes/No select with the cursor started on No, produced via `SelectList.setSelectedIndex`.
- Reuse the established atomic save path: project/role create/rename/delete acts on the staged config; all changes persist through the existing `saveProjectsFile` atomic write with the `CONFIG_CHANGED` guard, never by direct mutation of the on-disk file.

Existing behavior kept:

- Top-level Escape is unchanged: no staged changes → exit; staged changes → the existing save-before-exit confirmation (Yes top / No bottom), which stays Yes-default intentionally different from delete (an accidental Esc assumes save intent; delete requires intent). Delete pickers stay No-default.
- The data-integrity boundary in `projects.ts` is authoritative and unchanged: `parseProjectsFile` rejects invalid ids, non-arrays, duplicates, unknown fields; `normalizeProjectsFile` sorts, dedupes, and drops empty roles; `serializeProjectsFile` re-parses before writing; `saveProjectsFile` is atomic.

Supersedes and reworks the prior remove-project change:

- The "Remove project…"/"Add project…"/"Add role ID…" menu items and the `ctx.ui.confirm` delete path from the remove-project change are replaced by the `n`/`r`/`d` hotkey model. The shipped remove-project menu item is not kept alongside the hotkeys; the new UI folds it in.

Not in scope:

- No Ctrl+S save-and-exit feature (withdrawn in favor of the existing Esc behavior).
- No create/rename/delete of workflow `.md` files.
- No per-file validation beyond the existing frontmatter parser.

Verification:

- Update `tests/command.test.ts` scripted-UI cases for `n`/`r`/`d` create/rename/delete (including no-confirmation create/rename, no-default delete, Esc cancels, collision/no-op), plus role-menu parity.
- Re-run `pnpm --filter @arcanemachine/pi-workflow run typecheck/build/test` and a live `/workflows` smoke against `/workspace/.pi/agent/workflows`.
- Commit child-before-parent.
