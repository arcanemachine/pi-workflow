import {
  DynamicBorder,
  getSettingsListTheme,
  type ExtensionCommandContext,
  Theme,
} from "@earendil-works/pi-coding-agent";
import {
  Container,
  decodeKittyPrintable,
  Input,
  type SelectItem,
  SelectList,
  type SelectListTheme,
  type SettingItem,
  SettingsList,
  Text,
} from "@earendil-works/pi-tui";

function selectListTheme(theme: Theme): SelectListTheme {
  return {
    selectedPrefix: (text: string) => theme.fg("accent", text),
    selectedText: (text: string) => theme.fg("accent", text),
    description: (text: string) => theme.fg("muted", text),
    scrollInfo: (text: string) => theme.fg("dim", text),
    noMatch: (text: string) => theme.fg("warning", text),
  };
}

/**
 * Decode a single-keypress `data` buffer into a lowercase action letter
 * (`n`, `r`, or `d`) when the user pressed exactly that key, regardless of
 * whether the terminal sent the character raw or via Kitty CSI-u encoding.
 * Returns undefined for everything else (modifiers, escape sequences, uppercase).
 */
function hotkeyLetter(data: string): string | undefined {
  const kitty = decodeKittyPrintable(data);
  const candidate =
    kitty !== undefined && kitty.length === 1
      ? kitty
      : data.length === 1
        ? data
        : undefined;
  if (candidate === "n" || candidate === "r" || candidate === "d")
    return candidate;
  return undefined;
}

export async function showSelection(
  ctx: ExtensionCommandContext,
  title: string,
  items: SelectItem[],
  cancelLabel = "cancel",
): Promise<string | null> {
  return ctx.ui.custom<string | null>((tui, theme, _keybindings, done) => {
    const container = new Container();
    container.addChild(
      new DynamicBorder((text: string) => theme.fg("accent", text)),
    );
    container.addChild(new Text(theme.fg("accent", theme.bold(title)), 1, 0));
    const list = new SelectList(
      items,
      Math.min(Math.max(items.length, 1), 12),
      selectListTheme(theme),
    );
    list.onSelect = (item) => done(item.value);
    list.onCancel = () => done(null);
    container.addChild(list);
    container.addChild(
      new Text(
        theme.fg("dim", `↑↓ navigate • enter select • esc ${cancelLabel}`),
        1,
        0,
      ),
    );
    container.addChild(
      new DynamicBorder((text: string) => theme.fg("accent", text)),
    );

    return {
      render: (width) => container.render(width),
      invalidate: () => container.invalidate(),
      handleInput: (data) => {
        list.handleInput(data);
        tui.requestRender();
      },
    };
  });
}

export type HotkeyResult =
  | { kind: "select"; value: string; index: number }
  | { kind: "cancel"; index: number }
  | { kind: "create"; index: number }
  | { kind: "rename"; value: string; index: number }
  | { kind: "delete"; value: string; index: number };

/**
 * A list menu of ids that also accepts create / rename / delete hotkeys.
 * `n` opens a create text field (no hovered item needed). `r` and `d` act on
 * the currently hovered item via `SelectList.getSelectedItem()`. Enter (handled
 * by `SelectList` itself) selects the hovered item to descend. Esc cancels.
 * `initialIndex` preserves the caller's previous hover across menu re-entry.
 */
export async function showHotkeySelection(
  ctx: ExtensionCommandContext,
  title: string,
  items: SelectItem[],
  cancelLabel = "back",
  initialIndex = 0,
): Promise<HotkeyResult> {
  return ctx.ui.custom<HotkeyResult>((tui, theme, _keybindings, done) => {
    const container = new Container();
    container.addChild(
      new DynamicBorder((text: string) => theme.fg("accent", text)),
    );
    container.addChild(new Text(theme.bold(title), 1, 0));
    const maxVisible = Math.min(Math.max(items.length, 1), 12);
    const list = new SelectList(items, maxVisible, selectListTheme(theme));
    list.setSelectedIndex(initialIndex);
    const hoveredIndex = () => {
      const item = list.getSelectedItem();
      return item ? Math.max(items.indexOf(item), 0) : 0;
    };
    let resolved = false;
    const finish = (result: HotkeyResult) => {
      if (resolved) return;
      resolved = true;
      done(result);
    };
    list.onSelect = (item) =>
      finish({ kind: "select", value: item.value, index: hoveredIndex() });
    list.onCancel = () => finish({ kind: "cancel", index: hoveredIndex() });
    container.addChild(list);
    container.addChild(
      new Text(
        theme.fg(
          "dim",
          `n create • r rename • d delete • ↑↓ navigate • enter select • esc ${cancelLabel}`,
        ),
        1,
        0,
      ),
    );
    container.addChild(
      new DynamicBorder((text: string) => theme.fg("accent", text)),
    );

    return {
      render: (width) => container.render(width),
      invalidate: () => container.invalidate(),
      handleInput: (data) => {
        if (!resolved) {
          const letter = hotkeyLetter(data);
          if (letter === "n") {
            finish({ kind: "create", index: hoveredIndex() });
            return;
          }
          if (letter === "r" || letter === "d") {
            const item = list.getSelectedItem();
            if (item) {
              finish({
                kind: letter === "r" ? "rename" : "delete",
                value: item.value,
                index: hoveredIndex(),
              });
              return;
            }
          }
        }
        list.handleInput(data);
        tui.requestRender();
      },
    };
  });
}

/**
 * A single-line text input used for create (empty seed) and rename
 * (pre-populated via `Input.setValue`). Enter submits the value; Esc cancels
 * with null. `ctx.ui.input` cannot pre-fill editable text, so this custom
 * renderer is used instead.
 */
export async function showTextInput(
  ctx: ExtensionCommandContext,
  title: string,
  initial: string,
  placeholder?: string,
): Promise<string | null> {
  return ctx.ui.custom<string | null>((tui, theme, _keybindings, done) => {
    const input = new Input();
    input.setValue(initial);
    input.focused = true;
    // Pre-filling for rename leaves the cursor at position 0; move it to the
    // end so typing appends rather than inserting before the existing id.
    if (initial.length > 0) {
      input.handleInput("\x1bOF"); // End key -> cursorLineEnd
    }
    input.onSubmit = (value) => done(value);
    input.onEscape = () => done(null);

    const container = new Container();
    container.addChild(
      new DynamicBorder((text: string) => theme.fg("accent", text)),
    );
    container.addChild(new Text(theme.bold(title), 1, 0));
    if (placeholder)
      container.addChild(new Text(theme.fg("dim", placeholder), 0, 0));
    container.addChild(input);
    container.addChild(
      new Text(theme.fg("dim", "enter confirm • esc cancel"), 1, 0),
    );
    container.addChild(
      new DynamicBorder((text: string) => theme.fg("accent", text)),
    );

    return {
      render: (width) => container.render(width),
      invalidate: () => container.invalidate(),
      handleInput: (data) => {
        input.handleInput(data);
        tui.requestRender();
      },
    };
  });
}

/**
 * A Yes/No confirmation picker with No as the safe default: Yes is the top
 * item, No is the bottom item, and the cursor starts on No. Esc or Enter-on-No
 * resolve false; moving Up to Yes then Enter resolves true. `ctx.ui.confirm`
 * has no default-No option, so this custom renderer is used.
 */
export async function showNoDefaultConfirm(
  ctx: ExtensionCommandContext,
  title: string,
  message: string,
): Promise<boolean> {
  return ctx.ui.custom<boolean>((tui, theme, _keybindings, done) => {
    const items: SelectItem[] = [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ];
    const container = new Container();
    container.addChild(
      new DynamicBorder((text: string) => theme.fg("accent", text)),
    );
    container.addChild(new Text(theme.bold(title), 1, 0));
    container.addChild(new Text(theme.fg("muted", message), 1, 0));
    const list = new SelectList(items, 2, selectListTheme(theme));
    list.setSelectedIndex(1); // No is the bottom item; cursor starts on No
    list.onSelect = (item) => done(item.value === "yes");
    list.onCancel = () => done(false);
    container.addChild(list);
    container.addChild(
      new Text(
        theme.fg("dim", "↑↓ navigate • enter select • esc cancel"),
        1,
        0,
      ),
    );
    container.addChild(
      new DynamicBorder((text: string) => theme.fg("accent", text)),
    );

    return {
      render: (width) => container.render(width),
      invalidate: () => container.invalidate(),
      handleInput: (data) => {
        list.handleInput(data);
        tui.requestRender();
      },
    };
  });
}

export interface WorkflowToggleItem {
  id: string;
  label: string;
  description?: string;
  enabled: boolean;
}

export async function showWorkflowToggles(
  ctx: ExtensionCommandContext,
  title: string,
  workflows: WorkflowToggleItem[],
): Promise<Set<string>> {
  const selected = new Set(
    workflows
      .filter((workflow) => workflow.enabled)
      .map((workflow) => workflow.id),
  );

  await ctx.ui.custom<void>((tui, theme, _keybindings, done) => {
    const items: SettingItem[] = workflows.map((workflow) => ({
      id: workflow.id,
      label: workflow.label,
      description: workflow.description,
      currentValue: workflow.enabled ? "on" : "off",
      values: ["on", "off"],
    }));
    const container = new Container();
    container.addChild(
      new DynamicBorder((text: string) => theme.fg("accent", text)),
    );
    container.addChild(new Text(theme.fg("accent", theme.bold(title)), 1, 0));
    const settingsTheme = getSettingsListTheme();
    const settings = new SettingsList(
      items,
      Math.min(Math.max(items.length + 2, 3), 15),
      {
        ...settingsTheme,
        hint: (text) =>
          settingsTheme.hint(
            text.replace(
              "Esc to cancel",
              "Esc back; changes stay staged until saved",
            ),
          ),
      },
      (id, value) => {
        if (value === "on") selected.add(id);
        else selected.delete(id);
        tui.requestRender();
      },
      () => done(undefined),
      { enableSearch: true },
    );
    container.addChild(settings);
    container.addChild(
      new DynamicBorder((text: string) => theme.fg("accent", text)),
    );

    return {
      render: (width) => container.render(width),
      invalidate: () => container.invalidate(),
      handleInput: (data) => {
        settings.handleInput(data);
        tui.requestRender();
      },
    };
  });

  return selected;
}
