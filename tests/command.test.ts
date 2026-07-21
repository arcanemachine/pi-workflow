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

function scriptedUI(options: {
  selections: Array<string | null>;
  inputs?: Array<string | undefined>;
  selected?: string[];
  confirm?: boolean;
  inspectToggles?: (items: WorkflowToggleItem[]) => void;
}): WorkflowConfiguratorUI {
  const selections = [...options.selections];
  const inputs = [...(options.inputs ?? [])];
  return {
    async select() {
      return selections.shift() ?? null;
    },
    async input() {
      return inputs.shift();
    },
    async toggles(_title, items) {
      options.inspectToggles?.(items);
      return new Set(options.selected ?? []);
    },
    async confirm() {
      return options.confirm ?? false;
    },
    notify() {},
  };
}

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
      scriptedUI({ selections: [null] }),
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
        selections: ["__add-project__", "__add-role__"],
        inputs: ["demo", "architect"],
        selected: ["bounded-work"],
        confirm: true,
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
      selections: ["demo", "architect"],
      selected: ["valid"],
      confirm: false,
      inspectToggles(items) {
        expect(items.map((item) => item.label)).toEqual([
          "invalid [invalid]",
          "missing [missing]",
          "valid — Bounded work",
        ]);
      },
    });
    const originalSelect = ui.select;
    ui.select = async (title, items) => {
      if (title.includes("managing role"))
        roleItems = items.map((item) => item.label);
      return originalSelect(title, items);
    };

    await configureProjectWorkflows(context, paths, ui);

    expect(roleItems).toContain("architect [unavailable]");
    expect(readFileSync(paths.projectsFile, "utf8")).toBe(
      JSON.stringify(projects),
    );
  });

  it("does not overwrite invalid configuration", async () => {
    const paths = setup();
    const invalid = '{"version":1,"projects":{},"unknown":true}';
    writeFileSync(paths.projectsFile, invalid);
    const { context } = fakeContext();

    await expect(
      configureProjectWorkflows(
        context,
        paths,
        scriptedUI({ selections: ["demo"] }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_PROJECTS_FILE" });
    expect(readFileSync(paths.projectsFile, "utf8")).toBe(invalid);
  });
});
