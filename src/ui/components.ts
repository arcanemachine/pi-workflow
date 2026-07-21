import {
  DynamicBorder,
  getSettingsListTheme,
  type ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import {
  Container,
  type SelectItem,
  SelectList,
  type SettingItem,
  SettingsList,
  Text,
} from "@earendil-works/pi-tui";

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
      {
        selectedPrefix: (text) => theme.fg("accent", text),
        selectedText: (text) => theme.fg("accent", text),
        description: (text) => theme.fg("muted", text),
        scrollInfo: (text) => theme.fg("dim", text),
        noMatch: (text) => theme.fg("warning", text),
      },
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
