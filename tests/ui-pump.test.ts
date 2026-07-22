/**
 * Exercises the REAL `ctx.ui.custom` renderers used by the `/workflows`
 * configurator by pumping synthetic terminal `keyData` into the component each
 * factory returns. The existing `command.test.ts` uses a scripted
 * `WorkflowConfiguratorUI` that calls `hotkeySelect`/`textInput`/
 * `noDefaultConfirm` directly and never enters `ctx.ui.custom`, so this file is
 * the only place the hotkey interception, No-default delete picker, and the
 * rename text-field cursor positioning are actually driven with key data.
 */
import type {
  ExtensionCommandContext,
  Theme,
} from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import {
  showHotkeySelection,
  showNoDefaultConfirm,
  showTextInput,
  type HotkeyResult,
} from "../src/ui/components.js";
import type { SelectItem } from "@earendil-works/pi-tui";

// A theme whose color/bold helpers return their text argument unchanged; that
// is all the renderers touch during factory execution (render itself is never
// invoked here, so no terminal is required).
const fakeTheme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
} as unknown as Theme;

interface FakeTui {
  requestRender(): void;
}
const fakeTui = { requestRender() {} } as unknown as FakeTui;

interface ComponentLike {
  handleInput?(data: string): void;
}

interface CapturedCtx {
  ctx: ExtensionCommandContext;
  /** Component produced by the most recent `ctx.ui.custom` factory. */
  getComponent(): ComponentLike;
}

/**
 * Minimal fake `ExtensionCommandContext` whose `ui.custom` runs the factory
 * synchronously (as the real interactive mode does), stashes the produced
 * component for key pumping, and resolves the returned promise with whatever
 * `done` is later called with.
 */
function makeCtx(): CapturedCtx {
  let component: ComponentLike | undefined;
  const ctx = {
    ui: {
      custom: (factory: unknown) =>
        new Promise<unknown>((resolve) => {
          component = (
            factory as (
              tui: FakeTui,
              theme: Theme,
              keybindings: undefined,
              done: (result: unknown) => void,
            ) => ComponentLike
          )(fakeTui, fakeTheme, undefined, resolve);
        }),
    },
  } as unknown as ExtensionCommandContext;
  return { ctx, getComponent: () => component as ComponentLike };
}

/** Drive a list of synthetic `keyData` strings into a captured component. */
function pump(ctx: CapturedCtx, ...keys: string[]): void {
  const component = ctx.getComponent();
  for (const key of keys) component.handleInput?.(key);
}

/** True when `promise` is still pending after a short timeout. */
async function isPending(promise: Promise<unknown>): Promise<boolean> {
  return await Promise.race([
    promise.then(
      () => false,
      () => false,
    ),
    new Promise<boolean>((resolve) => setImmediate(() => resolve(true))),
  ]);
}

const ITEMS: SelectItem[] = [
  { value: "alpha", label: "Alpha" },
  { value: "beta", label: "Beta" },
];

describe("showHotkeySelection (real ctx.ui.custom, synthetic keys)", () => {
  it("`n` creates without needing a hovered item", async () => {
    const ctx = makeCtx();
    const result = showHotkeySelection(ctx.ctx, "Projects", ITEMS);
    pump(ctx, "n");
    expect(await result).toEqual<HotkeyResult>({ kind: "create" });
  });

  it("`r` renames the hovered item", async () => {
    const ctx = makeCtx();
    const result = showHotkeySelection(ctx.ctx, "Projects", ITEMS);
    // Down to hover the second item ("beta"), then rename.
    pump(ctx, "\x1b[B", "r");
    expect(await result).toEqual<HotkeyResult>({
      kind: "rename",
      value: "beta",
    });
  });

  it("`d` deletes the hovered item (first item by default)", async () => {
    const ctx = makeCtx();
    const result = showHotkeySelection(ctx.ctx, "Projects", ITEMS);
    pump(ctx, "d");
    expect(await result).toEqual<HotkeyResult>({
      kind: "delete",
      value: "alpha",
    });
  });

  it("enter selects the hovered item; escape cancels", async () => {
    const selectCtx = makeCtx();
    const selectResult = showHotkeySelection(selectCtx.ctx, "Projects", ITEMS);
    pump(selectCtx, "\r");
    expect(await selectResult).toEqual<HotkeyResult>({
      kind: "select",
      value: "alpha",
    });

    const cancelCtx = makeCtx();
    const cancelResult = showHotkeySelection(cancelCtx.ctx, "Projects", ITEMS);
    pump(cancelCtx, "\x1b");
    expect(await cancelResult).toEqual<HotkeyResult>({ kind: "cancel" });
  });

  it("treats Kitty CSI-u for `n` as create but `a` as inert", async () => {
    const createCtx = makeCtx();
    const createResult = showHotkeySelection(createCtx.ctx, "Projects", ITEMS);
    // Kitty CSI-u encoding for `n` (codepoint 110) triggers create.
    pump(createCtx, "\x1b[110u");
    expect(await createResult).toEqual<HotkeyResult>({ kind: "create" });

    const inertCtx = makeCtx();
    const inertResult = showHotkeySelection(inertCtx.ctx, "Projects", ITEMS);
    // Kitty CSI-u for `a` (codepoint 97) is not a create/rename/delete trigger
    // and does not match any SelectList key, so the menu stays open.
    pump(inertCtx, "\x1b[97u");
    expect(await isPending(inertResult)).toBe(true);
  });
});

describe("showTextInput (real ctx.ui.custom, synthetic keys)", () => {
  it("rename pre-fill leaves the cursor at the end (typing appends)", async () => {
    const ctx = makeCtx();
    const result = showTextInput(ctx.ctx, "Rename project", "old-id");
    // The cursor must start at the end of `old-id`; typing `x` appends.
    pump(ctx, "x", "\r");
    expect(await result).toBe("old-idx");
    expect(await result).not.toBe("xold-id");
  });

  it("create starts empty and types normally (n/r/d are not intercepted)", async () => {
    const ctx = makeCtx();
    const result = showTextInput(ctx.ctx, "Create project", "");
    // `n` is a normal character here, not a create hotkey.
    pump(ctx, "n", "e", "w", "\r");
    expect(await result).toBe("new");
  });

  it("escape cancels with null", async () => {
    const ctx = makeCtx();
    const result = showTextInput(ctx.ctx, "Rename project", "old-id");
    pump(ctx, "\x1b");
    expect(await result).toBeNull();
  });
});

describe("showNoDefaultConfirm (real ctx.ui.custom, synthetic keys)", () => {
  it("defaults to No: a bare enter cancels (false)", async () => {
    const ctx = makeCtx();
    const result = showNoDefaultConfirm(ctx.ctx, "Delete project", "alpha");
    pump(ctx, "\r");
    expect(await result).toBe(false);
  });

  it("Up to Yes then Enter confirms (true)", async () => {
    const ctx = makeCtx();
    const result = showNoDefaultConfirm(ctx.ctx, "Delete project", "alpha");
    pump(ctx, "\x1b[A", "\r");
    expect(await result).toBe(true);
  });
});
