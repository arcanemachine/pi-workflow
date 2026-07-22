import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  WORKFLOW_COMMAND_DESCRIPTION,
  createWorkflowCommandHandler,
  registerWorkflowCommand,
} from "../src/command.js";
import { resolveWorkflowPaths } from "../src/paths.js";
import {
  configureProjectWorkflows,
  type WorkflowConfiguratorUI,
} from "../src/ui/configure.js";
import type { HotkeyResult } from "../src/ui/components.js";
import type { WorkflowToggleItem } from "../src/ui/components.js";
import type { ProjectsFileV1 } from "../src/types.js";
import {
  cleanupTempDirectories,
  makeTempDirectory,
  validWorkflow,
} from "./helpers.js";

afterEach(cleanupTempDirectories);

function setup() {
  const agentDir = makeTempDirectory();
  const workflowDir = join(agentDir, "workflows");
  mkdirSync(workflowDir);
  return resolveWorkflowPaths({ agentDir, workflowDir });
}

function fakeContext(mode: "tui" | "rpc" = "tui") {
  const notifications: Array<{ message: string; type?: string }> = [];
  return {
    context: {
      mode,
      cwd: "/workspace/projects/demo",
      ui: {
        notify(message: string, type?: string) {
          notifications.push({ message, type });
        },
      },
    } as never,
    notifications,
  };
}

interface ScriptedOptions {
  /** Consumed in call order across every project/role hotkey menu. */
  hotkey?: Array<HotkeyResult>;
  /** Consumed in call order across every create/rename text field. */
  text?: Array<string | null>;
  /** Consumed in call order across every delete confirmation. */
  deleteConfirm?: Array<boolean>;
  /** Consumed in call order across every plain `select` (exit-save dialog). */
  selections?: Array<string | null>;
  /** Workflows returned by every toggle list. */
  selected?: string[];
  inspectToggles?: (items: WorkflowToggleItem[]) => void;
  onNotify?: (message: string, type?: string) => void;
}

function scriptedUI(options: ScriptedOptions): WorkflowConfiguratorUI {
  const hotkey = [...(options.hotkey ?? [])];
  const text = [...(options.text ?? [])];
  const deleteConfirm = [...(options.deleteConfirm ?? [])];
  const selections = [...(options.selections ?? [])];
  return {
    async select() {
      return selections.shift() ?? null;
    },
    async hotkeySelect() {
      return hotkey.shift() ?? { kind: "cancel" };
    },
    async textInput() {
      return text.shift() ?? null;
    },
    async noDefaultConfirm() {
      return deleteConfirm.shift() ?? false;
    },
    async toggles(_title, items) {
      options.inspectToggles?.(items);
      return new Set(options.selected ?? []);
    },
    notify(message, type) {
      options.onNotify?.(message, type);
    },
  };
}

const select = (value: string): HotkeyResult => ({ kind: "select", value });
const cancel = (): HotkeyResult => ({ kind: "cancel" });
const create = (): HotkeyResult => ({ kind: "create" });
const rename = (value: string): HotkeyResult => ({ kind: "rename", value });
const del = (value: string): HotkeyResult => ({ kind: "delete", value });

describe("/workflows registration and guards", () => {
  it("registers exactly the workflow command with its approved description", () => {
    let name: string | undefined;
    let description: string | undefined;
    registerWorkflowCommand({
      registerCommand(commandName, options) {
        name = commandName;
        description = options.description;
      },
    });
    expect(name).toBe("workflows");
    expect(description).toBe(WORKFLOW_COMMAND_DESCRIPTION);
  });

  it("rejects arguments with usage and does not resolve paths", async () => {
    const { context, notifications } = fakeContext();
    let resolved = false;
    await createWorkflowCommandHandler(() => {
      resolved = true;
      return setup();
    })("extra", context);

    expect(resolved).toBe(false);
    expect(notifications[0].message).toContain("Usage: /workflows");
  });

  it("rejects non-TUI modes without changing configuration", async () => {
    const { context, notifications } = fakeContext("rpc");
    let resolved = false;
    await createWorkflowCommandHandler(() => {
      resolved = true;
      return setup();
    })("", context);

    expect(resolved).toBe(false);
    expect(notifications[0].message).toContain("UI_UNAVAILABLE");
  });
});

describe("workflow configurator", () => {
  it("cancels project selection without writing", async () => {
    const paths = setup();
    const { context } = fakeContext();

    await configureProjectWorkflows(
      context,
      paths,
      scriptedUI({ hotkey: [cancel()] }),
    );

    expect(existsSync(paths.projectsFile)).toBe(false);
  });

  it("creates a project, accepts a custom role, and saves selected workflows", async () => {
    const paths = setup();
    writeFileSync(join(paths.workflowDir, "bounded-work.md"), validWorkflow());
    const { context } = fakeContext();

    await configureProjectWorkflows(
      context,
      paths,
      scriptedUI({
        hotkey: [
          create(), // project: n
          select("demo"), // project: enter (descend)
          create(), // role: n
          select("architect"), // role: enter (descend)
          cancel(), // role: esc (back to project)
          cancel(), // project: esc (exit)
        ],
        text: ["demo", "architect"],
        selections: ["save"],
        selected: ["bounded-work"],
      }),
    );

    const saved = JSON.parse(readFileSync(paths.projectsFile, "utf8"));
    expect(saved).toEqual({
      version: 1,
      projects: {
        demo: { roles: { architect: ["bounded-work"] } },
      },
    });
  });

  it("deletes a project and its workflow assignments on save via d-key", async () => {
    const paths = setup();
    writeFileSync(join(paths.workflowDir, "bounded-work.md"), validWorkflow());
    const projects: ProjectsFileV1 = {
      version: 1,
      projects: {
        demo: { roles: { architect: ["bounded-work"] } },
        keep: { roles: { architect: ["bounded-work"] } },
      },
    };
    writeFileSync(paths.projectsFile, JSON.stringify(projects));
    const { context } = fakeContext();

    await configureProjectWorkflows(
      context,
      paths,
      scriptedUI({
        hotkey: [del("demo"), cancel()],
        deleteConfirm: [true],
        selections: ["save"],
      }),
    );

    const saved = JSON.parse(readFileSync(paths.projectsFile, "utf8"));
    expect(saved).toEqual({
      version: 1,
      projects: { keep: { roles: { architect: ["bounded-work"] } } },
    });
  });

  it("keeps a project when its delete is cancelled at the No-default picker", async () => {
    const paths = setup();
    writeFileSync(join(paths.workflowDir, "bounded-work.md"), validWorkflow());
    const projects: ProjectsFileV1 = {
      version: 1,
      projects: { demo: { roles: { architect: ["bounded-work"] } } },
    };
    writeFileSync(paths.projectsFile, JSON.stringify(projects));
    const { context } = fakeContext();

    await configureProjectWorkflows(
      context,
      paths,
      scriptedUI({
        // d on demo, then No at the picker, then esc out. No staged change
        // (delete was declined), so the configurator exits with no save dialog.
        hotkey: [del("demo"), cancel()],
        deleteConfirm: [false],
      }),
    );

    expect(readFileSync(paths.projectsFile, "utf8")).toBe(
      JSON.stringify(projects),
    );
  });

  it("creates a project, renames it, deletes the renamed one, and saves", async () => {
    const paths = setup();
    writeFileSync(join(paths.workflowDir, "bounded-work.md"), validWorkflow());
    const { context } = fakeContext();

    await configureProjectWorkflows(
      context,
      paths,
      scriptedUI({
        hotkey: [
          create(), // n: create "alpha"
          rename("alpha"), // r on alpha: rename alpha -> beta
          del("beta"), // d on beta: delete it (No-default picker -> Yes)
          cancel(), // project: esc (exit)
        ],
        text: ["alpha", "beta"],
        deleteConfirm: [true],
      }),
    );

    // alpha was created, renamed to beta, then beta was deleted: no
    // projects survive normalization, so nothing is staged and nothing is
    // written.
    expect(existsSync(paths.projectsFile)).toBe(false);
  });

  it("renames a project and preserves its roles through save", async () => {
    const paths = setup();
    writeFileSync(join(paths.workflowDir, "bounded-work.md"), validWorkflow());
    const projects: ProjectsFileV1 = {
      version: 1,
      projects: { demo: { roles: { architect: ["bounded-work"] } } },
    };
    writeFileSync(paths.projectsFile, JSON.stringify(projects));
    const { context } = fakeContext();

    await configureProjectWorkflows(
      context,
      paths,
      scriptedUI({
        hotkey: [rename("demo"), cancel()],
        text: ["demo-renamed"],
        selections: ["save"],
      }),
    );

    const saved = JSON.parse(readFileSync(paths.projectsFile, "utf8"));
    expect(saved).toEqual({
      version: 1,
      projects: { "demo-renamed": { roles: { architect: ["bounded-work"] } } },
    });
  });

  it("create project rejects an invalid id, notifies, then commits on a valid one", async () => {
    const paths = setup();
    writeFileSync(join(paths.workflowDir, "bounded-work.md"), validWorkflow());
    const { context } = fakeContext();
    const notifications: string[] = [];

    await configureProjectWorkflows(
      context,
      paths,
      scriptedUI({
        hotkey: [create(), select("demo"), cancel(), cancel()],
        text: ["Bad Id!", "demo"],
        selected: [],
        selections: ["discard"],
        onNotify: (message) => notifications.push(message),
      }),
    );

    expect(notifications).toContain("Project ID must be lowercase kebab-case.");
  });

  it("create project reports a collision and keeps the existing project", async () => {
    const paths = setup();
    writeFileSync(join(paths.workflowDir, "bounded-work.md"), validWorkflow());
    const projects: ProjectsFileV1 = {
      version: 1,
      projects: { demo: { roles: { architect: ["bounded-work"] } } },
    };
    writeFileSync(paths.projectsFile, JSON.stringify(projects));
    const { context } = fakeContext();
    const notifications: string[] = [];

    await configureProjectWorkflows(
      context,
      paths,
      scriptedUI({
        // n -> "demo" (collision, notify, loop) -> text exhausted -> null (esc)
        hotkey: [create(), cancel()],
        text: ["demo"],
        onNotify: (message) => notifications.push(message),
      }),
    );

    expect(notifications).toContain("Project demo already exists.");
    expect(readFileSync(paths.projectsFile, "utf8")).toBe(
      JSON.stringify(projects),
    );
  });

  it("shows unavailable roles and configured missing or invalid workflows as removable", async () => {
    const paths = setup();
    writeFileSync(join(paths.workflowDir, "valid.md"), validWorkflow());
    writeFileSync(join(paths.workflowDir, "invalid.md"), "invalid");
    const projects: ProjectsFileV1 = {
      version: 1,
      projects: {
        demo: {
          roles: { architect: ["invalid", "missing", "valid"] },
        },
      },
    };
    writeFileSync(paths.projectsFile, JSON.stringify(projects));
    const { context } = fakeContext();
    let roleItems: string[] = [];

    const ui = scriptedUI({
      hotkey: [select("demo"), select("architect"), cancel(), cancel()],
      selected: ["valid"],
      selections: ["discard"],
      inspectToggles(items) {
        expect(items.map((item) => item.label)).toEqual([
          "invalid [invalid]",
          "missing [missing]",
          "valid — Bounded work",
        ]);
      },
    });
    const originalHotkey = ui.hotkeySelect;
    ui.hotkeySelect = async (title, items) => {
      if (title.startsWith("Select role for"))
        roleItems = items.map((item) => item.label);
      return originalHotkey(title, items);
    };

    await configureProjectWorkflows(context, paths, ui);

    expect(roleItems).toContain("architect [unavailable]");
    expect(readFileSync(paths.projectsFile, "utf8")).toBe(
      JSON.stringify(projects),
    );
  });

  it("creates then deletes a role within a project via n / d hotkeys", async () => {
    const paths = setup();
    writeFileSync(join(paths.workflowDir, "bounded-work.md"), validWorkflow());
    const projects: ProjectsFileV1 = {
      version: 1,
      projects: { demo: { roles: {} } },
    };
    writeFileSync(paths.projectsFile, JSON.stringify(projects));
    const { context } = fakeContext();

    await configureProjectWorkflows(
      context,
      paths,
      scriptedUI({
        hotkey: [
          select("demo"),
          create(), // role: n -> "planner"
          del("planner"), // role: d on planner -> No-default confirm -> yes
          cancel(), // role: back to project
          cancel(), // project: exit (no surviving staged change)
        ],
        text: ["planner"],
        deleteConfirm: [true],
      }),
    );

    // planner had no assignments and was deleted; nothing is staged, no write.
    expect(readFileSync(paths.projectsFile, "utf8")).toBe(
      JSON.stringify(projects),
    );
  });

  it("keeps a freshly created role after backing out of its toggle list without assigning workflows", async () => {
    const paths = setup();
    writeFileSync(join(paths.workflowDir, "bounded-work.md"), validWorkflow());
    const projects: ProjectsFileV1 = {
      version: 1,
      projects: { demo: { roles: {} } },
    };
    writeFileSync(paths.projectsFile, JSON.stringify(projects));
    const { context } = fakeContext();

    let roleItems: string[] = [];
    const ui = scriptedUI({
      hotkey: [
        select("demo"),
        create(), // role: n -> "planner"
        select("planner"), // enter the new role's toggle list
        cancel(), // role: back out of toggles without assigning anything
        cancel(), // role: back to project
        cancel(), // project: exit
      ],
      // Backing out with no enabled workflows leaves an empty assignment;
      // because the role persists, that staged change triggers save-on-exit.
      text: ["planner"],
      selected: [],
      selections: ["save"],
    });
    const originalHotkey = ui.hotkeySelect;
    ui.hotkeySelect = async (title, items) => {
      if (title.startsWith("Select role for"))
        roleItems = items.map((item) => item.label);
      return originalHotkey(title, items);
    };

    await configureProjectWorkflows(context, paths, ui);

    // After backing out of the toggle list, planner must still be listed
    // (regression: it used to vanish because the empty assignment pruned it).
    // The [unavailable] suffix is expected: there is no global planner.md
    // role file in the temp agent dir, so the role is annotated accordingly.
    expect(roleItems).toContain("planner [unavailable]");
    expect(readFileSync(paths.projectsFile, "utf8")).toBe(
      `${JSON.stringify(
        {
          version: 1,
          projects: { demo: { roles: { planner: [] } } },
        },
        null,
        2,
      )}\n`,
    );
  });

  it("opens a save-before-exit confirmation on Esc with staged changes and discards when chosen", async () => {
    const paths = setup();
    writeFileSync(join(paths.workflowDir, "bounded-work.md"), validWorkflow());
    const projects: ProjectsFileV1 = {
      version: 1,
      projects: {
        demo: { roles: { architect: ["bounded-work"] } },
      },
    };
    writeFileSync(paths.projectsFile, JSON.stringify(projects));
    const { context } = fakeContext();
    const ui = scriptedUI({
      hotkey: [select("demo"), select("architect"), cancel(), cancel()],
      selections: ["discard"],
      selected: [],
    });
    const titles: string[] = [];
    const originalHotkey = ui.hotkeySelect;
    ui.hotkeySelect = async (title, items, cancelLabel) => {
      titles.push(title);
      return originalHotkey(title, items, cancelLabel);
    };
    const originalSelect = ui.select;
    ui.select = async (title, items, cancelLabel) => {
      titles.push(title);
      return originalSelect(title, items, cancelLabel);
    };

    await configureProjectWorkflows(context, paths, ui);

    expect(titles).toEqual([
      "Select project",
      "Select role for demo",
      "Select role for demo",
      "Select project",
      "Save staged workflow-list changes before exiting?",
    ]);
    expect(readFileSync(paths.projectsFile, "utf8")).toBe(
      JSON.stringify(projects),
    );
  });

  it("returns to the project menu when Esc cancels the save-before-exit confirmation", async () => {
    const paths = setup();
    writeFileSync(join(paths.workflowDir, "bounded-work.md"), validWorkflow());
    const projects: ProjectsFileV1 = {
      version: 1,
      projects: {
        demo: { roles: { architect: ["bounded-work"] } },
      },
    };
    writeFileSync(paths.projectsFile, JSON.stringify(projects));
    const { context } = fakeContext();
    const ui = scriptedUI({
      hotkey: [
        select("demo"),
        select("architect"),
        cancel(),
        cancel(),
        cancel(),
        cancel(),
      ],
      selections: [null, "discard"],
      selected: [],
    });
    const titles: string[] = [];
    const originalHotkey = ui.hotkeySelect;
    ui.hotkeySelect = async (title, items, cancelLabel) => {
      titles.push(title);
      return originalHotkey(title, items, cancelLabel);
    };
    const originalSelect = ui.select;
    ui.select = async (title, items, cancelLabel) => {
      titles.push(title);
      return originalSelect(title, items, cancelLabel);
    };

    await configureProjectWorkflows(context, paths, ui);

    expect(titles).toEqual([
      "Select project",
      "Select role for demo",
      "Select role for demo",
      "Select project",
      "Save staged workflow-list changes before exiting?",
      "Select project",
      "Save staged workflow-list changes before exiting?",
    ]);
    expect(readFileSync(paths.projectsFile, "utf8")).toBe(
      JSON.stringify(projects),
    );
  });

  it("moves Escape from the role menu back to project selection", async () => {
    const paths = setup();
    writeFileSync(
      paths.projectsFile,
      JSON.stringify({ version: 1, projects: { demo: { roles: {} } } }),
    );
    const { context } = fakeContext();
    const ui = scriptedUI({ hotkey: [select("demo"), cancel(), cancel()] });
    const titles: string[] = [];
    const originalHotkey = ui.hotkeySelect;
    ui.hotkeySelect = async (title, items, cancelLabel) => {
      titles.push(title);
      return originalHotkey(title, items, cancelLabel);
    };

    await configureProjectWorkflows(context, paths, ui);

    expect(titles).toEqual([
      "Select project",
      "Select role for demo",
      "Select project",
    ]);
  });

  it("does not overwrite invalid configuration", async () => {
    const paths = setup();
    const invalid = '{"version":1,"projects":{},"unknown":true}';
    writeFileSync(paths.projectsFile, invalid);
    const { context } = fakeContext();

    await expect(
      configureProjectWorkflows(context, paths, scriptedUI({})),
    ).rejects.toMatchObject({ code: "INVALID_PROJECTS_FILE" });
    expect(readFileSync(paths.projectsFile, "utf8")).toBe(invalid);
  });
});
