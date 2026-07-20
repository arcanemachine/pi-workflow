/**
 * Pi Package Template — Sample Extension
 *
 * This extension demonstrates the core extension capabilities:
 *   1. Custom tool (callable by the LLM)
 *   2. Slash command with TUI (callable by the user)
 *   3. Event handler (reacts to session lifecycle)
 *
 * Remove or replace these with your own functionality.
 */

import { DynamicBorder, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Container, type SelectItem, SelectList, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  // ── 1. Custom tool ────────────────────────────────────────────────
  // The LLM can call this tool when the user asks it to greet someone.
  pi.registerTool({
    name: "hello",
    label: "Hello",
    description: "Greet someone by name. Returns a friendly greeting.",
    parameters: Type.Object({
      name: Type.String({ description: "Name to greet" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      return {
        content: [{ type: "text", text: `Hello, ${params.name}! 👋` }],
        details: { greeted: params.name },
      };
    },
  });

  // ── 2a. Slash command ──────────────────────────────────────────────
  // The user can type /hello to trigger this command.
  pi.registerCommand("hello", {
    description: "Say hello from the template package",
    handler: async (args, ctx) => {
      const name = args?.trim() || "world";
      ctx.ui.notify(`Hello, ${name}! 👋`, "info");
    },
  });

  // ── 2b. Slash command with TUI ─────────────────────────────────────
  // The user can type /pick to open an interactive selection dialog.
  pi.registerCommand("pick", {
    description: "Pick an item from a selection dialog",
    handler: async (_args, ctx) => {
      const items: SelectItem[] = [
        { value: "alpha", label: "Option A", description: "First option" },
        { value: "beta", label: "Option B", description: "Second option" },
        { value: "gamma", label: "Option C", description: "Third option" },
      ];

      const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
        const container = new Container();

        container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
        container.addChild(new Text(theme.fg("accent", theme.bold("Pick an Option")), 1, 0));

        const selectList = new SelectList(items, Math.min(items.length, 10), {
          selectedPrefix: (t) => theme.fg("accent", t),
          selectedText: (t) => theme.fg("accent", t),
          description: (t) => theme.fg("muted", t),
          scrollInfo: (t) => theme.fg("dim", t),
          noMatch: (t) => theme.fg("warning", t),
        });
        selectList.onSelect = (item) => done(item.value);
        selectList.onCancel = () => done(null);
        container.addChild(selectList);

        container.addChild(
          new Text(theme.fg("dim", "↑↓ navigate • enter select • esc cancel"), 1, 0),
        );
        container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

        return {
          render: (w) => container.render(w),
          invalidate: () => container.invalidate(),
          handleInput: (data) => {
            selectList.handleInput(data);
            tui.requestRender();
          },
        };
      });

      if (result) {
        ctx.ui.notify(`Selected: ${result}`, "info");
      }
    },
  });

  // ── 3. Event handler ──────────────────────────────────────────────
  // Fires when a session starts (startup, reload, new, resume, fork).
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("📦 Template package loaded!", "info");
  });
}
