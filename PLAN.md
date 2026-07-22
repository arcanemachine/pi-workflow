# Plan: Rename/create text field cursor should start at the end

> This is a transient, self-contained plan. It exists only to guide the fix
> below. **When the fix is implemented, verified, and committed, delete this
> file** (last step). Do not reference it from README/AGENTS/CHANGELOG — it is
> intentionally unreferenced and must not leave tracking scaffolding behind.

## Problem

`showTextInput` in `src/ui/components.ts` builds rename/create text fields on
pi-tui's `Input` component:

```ts
const input = new Input();
input.setValue(initial);
```

`Input` seeds `cursor = 0` in its constructor. `setValue(value)` then does
`this.cursor = Math.min(this.cursor, value.length)`, which leaves the cursor at
`0` when pre-filling for **rename** (initial = the existing id). So the user
opens a rename field with the cursor at the **front** of the text: typing
_inserts before_ the existing id rather than editing at the conventional end.

- **Create** (initial = `""`): cursor 0 equals length 0 → correctly at the end.
  No change needed, but the fix is harmless for empty values.
- **Rename** (initial = existing id): BUG. Cursor at front instead of end.

Confirmed against the installed source:
`node_modules/@earendil-works/pi-tui/dist/components/input.js` — constructor
`cursor = 0`; `setValue` clamps with `Math.min(cursor, value.length)`.

## Fix

In `showTextInput` (`src/ui/components.ts`), move the cursor to the end of the
field immediately after `input.setValue(initial)`, before the component is
returned to the TUI.

`Input.cursor` is a TypeScript-private field (compile-time only; a normal
property at runtime). The public `Input` surface is `getValue`/`setValue`/
`handleInput` only — there is no public cursor setter. The robust, public-API
mechanism is to dispatch the **End** key through `handleInput`: the End key maps
to `tui.editor.cursorLineEnd`, whose handler sets `this.cursor =
this.value.length`.

The End key is `\x1bOF` (confirmed at
`node_modules/@earendil-works/pi-tui/dist/keys.js`: `"\x1bOF": "end"`). It does
NOT match `tui.select.cancel` (escape is the bare ESC byte), so dispatching it
is safe and will not trigger `onEscape`.

Apply:

```ts
const input = new Input();
input.setValue(initial);
input.focused = true;
if (initial.length > 0) {
  input.handleInput("\x1bOF"); // End key -> cursorLineEnd -> cursor at value.length
}
input.onSubmit = (value) => done(value);
input.onEscape = () => done(null);
```

Add a one-line comment at the `handleInput("\x1bOF")` call explaining it moves
the cursor to the end for rename pre-fill (why, not the mechanism trivia).

### Fallback if `\x1bOF` ever proves terminal-dependent

`\x1bOF` is the application-key-mode End sequence pi-tui itself recognizes. If
a future pi-tui change shifts the End binding, the equivalent fix is a minimal
private-field cast applied locally (not exported), e.g.:

```ts
(input as unknown as { cursor: number }).cursor = initial.length;
```

Prefer the End-key dispatch; only fall back to the cast if the dev environment
shows the End key no longer reaches `cursorLineEnd`.

## Verification (the real gap — the hotkey interception was never exercised with actual key data)

The CRUD interception layer (`hotkeyLetter` → `decodeKittyPrintable`,
`SelectList.getSelectedItem()` for `r`/`d`, `setSelectedIndex(1)` for the
No-default picker, and now the rename cursor) is only verified by **reading** it;
the existing `tests/command.test.ts` uses a scripted `WorkflowConfiguratorUI`
that calls `hotkeySelect`/`textInput`/`noDefaultConfirm` directly and bypasses
`ctx.ui.custom` entirely. Add a new test file that exercises the **real**
component factories through `ctx.ui.custom` by pumping synthetic `keyData`
strings into the returned `handleInput`.

Add `tests/ui-pump.test.ts` (use vitest; isolated temp catalog dirs via
`makeTempDirectory`/`cleanupTempDirectories` from `helpers.ts`). It needs a fake
`ExtensionCommandContext` whose `ui.custom` returns the factory's component and
captures the `done()` result. Sketch:

```ts
function pumpCustom<T>(factory): { handle(data: string): void; result(): Promise<T> } {
  let resolve: (v: T) => void;
  const done = (v: T) => resolve(v);
  // Minimal fakes: a TUI exposing requestRender(), a Theme exposing fg()/bold(),
  // a KeybindingsManager exposing matches() delegating to pi-tui's getKeybindings().
  const tui = { requestRender() {} } as never;
  const theme = { fg: (_c: string, t: string) => t, bold: (t: string) => t, ... } as never;
  const keybindings = getKeybindings(); // from @earendil-works/pi-tui
  const comp = factory(tui, theme, keybindings, done);
  const result = new Promise<T>((r) => (resolve = r));
  return { handle: (d) => comp.handleInput?.(d), result: () => result };
}
```

Then assert the real renderers — each is independent:

1. **`showHotkeySelection` create path:** pump `"n"` → `result()` resolves to
   `{ kind: "create" }`.
2. **`showHotkeySelection` rename path:** build items, pump arrow-down to hover
   the second item, then `"r"` → resolves to `{ kind: "rename", value: <that id> }`.
3. **`showHotkeySelection` delete path:** hover an item, `"d"` → resolves to
   `{ kind: "delete", value: ... }`.
4. **`showHotkeySelection` select/Enter/cancel:** Enter on the hovered item →
   `{ kind: "select", value }`; Escape → `{ kind: "cancel" }`.
5. **Kitty CSI-u parity:** pump `"\x1b[97u"` (Kitty encoding for `a`) is NOT an
   n/r/d trigger (returns through to the list); pump the Kitty encoding for `n`
   (`"\x1b[110u"`) DOES trigger create. Confirms `decodeKittyPrintable` works.
6. **`showTextInput` rename cursor-at-end (this plan's core fix):** build
   `showTextInput(ctx, "Rename", "old-id")`, then type a single char (`"x"`)
   through `handle`, then `"\r"` (Enter) to submit; `result()` resolves to
   `"old-idx"` (append), NOT `"xold-id"` (front-insert). This is the observable
   proof the cursor is at the end.
7. **`showTextInput` create:** `showTextInput(ctx, "Create", "")`, type `"n"` +
   `"e"` + `"w"`, Enter → `"new"`. (Confirms n/r/d interception does NOT eat
   typing inside the text field, since `showTextInput` delegates directly to
   `Input.handleInput`, which treats `n`/`r`/`d` as normal characters.)
8. **`showNoDefaultConfirm` No-default:** build it, assert the first Enter
   resolves `false` (cursor starts on No). Pump Up then Enter → resolves `true`.

Theme fake: `showHotkeySelection` uses `theme.bold` and `theme.fg("dim", …)`
and `theme.fg("accent", …)`; `showTextInput` uses `theme.bold`, `theme.fg("dim",…)`,
`theme.fg("accent",…)` via `DynamicBorder`/`Text`. `DynamicBorder` takes a fn
`(text) => theme.fg("accent", text)` — the fake `fg` returning its text arg
suffices. If `Text`/`Container`/`SelectList` need more theme members, add no-op
returns until it renders without throwing.

Keep the fakes minimal and local to this test file; do not export them or fold
them into `helpers.ts` unless a second test needs them.

## Acceptance

- Rename field opens with the cursor at the **end**; typing appends.
- Create field still works (cursor 0 on empty = length 0).
- All existing tests still pass; the new `tests/ui-pump.test.ts` passes.
- `pnpm --filter @arcanemachine/pi-workflow run typecheck/build/test/format`,
  and `npm pack --dry-run` are green. (Always `pkill -9 -f vitest` first; run
  vitest via `node node_modules/vitest/vitest.mjs run --reporter=default` to
  avoid the intermittent empty-capture artifact.)
- Commit child-before-parent with Conventional Commits. Do not push/publish/release.

## Self-removal (final step)

Once the fix + `tests/ui-pump.test.ts` are implemented, verified, and committed:

```bash
cd /workspace/projects/pi/packages/pi-workflow
git rm PLAN.md
git commit -m "chore: remove transient cursor-fix plan after implementation"
cd /workspace/projects/pi
git add packages/pi-workflow
git commit -m "chore: update pi-workflow submodule pointer"
```

Then confirm `PLAN.md` no longer exists and `README.md`/`AGENTS.md` carry no
references to it. No tracking scaffolding should remain.
