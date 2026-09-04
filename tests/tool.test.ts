import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkflowError } from "../src/errors.js";
import { resolveWorkflowPaths } from "../src/paths.js";
import {
  WORKFLOW_PROMPT_GUIDELINES,
  WORKFLOW_PROMPT_SNIPPETS,
  createWorkflowListTool,
  createWorkflowReadMetadataTool,
  createWorkflowReadTool,
  executeWorkflowList,
  executeWorkflowRead,
  executeWorkflowReadMetadata,
  registerWorkflowTools,
} from "../src/tool.js";
import type { ProjectsFileV1 } from "../src/types.js";
import {
  cleanupTempDirectories,
  makeTempDirectory,
  validWorkflow,
} from "./helpers.js";

afterEach(cleanupTempDirectories);

function setup(): ReturnType<typeof resolveWorkflowPaths> {
  const agentDir = makeTempDirectory();
  const workflowDir = join(agentDir, "workflows");
  mkdirSync(workflowDir);
  return resolveWorkflowPaths({ agentDir, workflowDir });
}

function writeProjects(
  paths: ReturnType<typeof resolveWorkflowPaths>,
  value: ProjectsFileV1,
): void {
  writeFileSync(paths.projectsFile, JSON.stringify(value));
}

function text(result: ReturnType<typeof executeWorkflowList>): string {
  const content = result.content[0];
  if (!content || content.type !== "text")
    throw new Error("expected text result");
  return content.text;
}

function thrownError(action: () => unknown): WorkflowError {
  try {
    action();
  } catch (error) {
    if (error instanceof WorkflowError) return error;
    throw error;
  }
  throw new Error("expected WorkflowError");
}

async function rejectedError(
  action: () => Promise<unknown>,
): Promise<WorkflowError> {
  try {
    await action();
  } catch (error) {
    if (error instanceof WorkflowError) return error;
    throw error;
  }
  throw new Error("expected WorkflowError rejection");
}

const testTheme = {
  bold: (value: string) => value,
  fg: (color: string, value: string) => `[${color}]${value}`,
};

describe("workflow tool registration", () => {
  it("registers namespaced tools with focused schemas and prompt metadata", () => {
    const tools: Array<{
      name: string;
      promptSnippet?: string;
      promptGuidelines?: readonly string[];
      parameters: unknown;
    }> = [];
    registerWorkflowTools({
      registerTool(tool) {
        tools.push(tool);
      },
    });

    expect(tools.map((tool) => tool.name)).toEqual([
      "pi_workflow_list",
      "pi_workflow_read_metadata",
      "pi_workflow_read",
    ]);
    expect(tools.map((tool) => tool.promptSnippet)).toEqual([
      WORKFLOW_PROMPT_SNIPPETS.list,
      WORKFLOW_PROMPT_SNIPPETS.readMetadata,
      WORKFLOW_PROMPT_SNIPPETS.read,
    ]);
    const guidelineSets = [
      WORKFLOW_PROMPT_GUIDELINES.list,
      WORKFLOW_PROMPT_GUIDELINES.readMetadata,
      WORKFLOW_PROMPT_GUIDELINES.read,
    ];
    tools.forEach((tool, index) => {
      expect(tool.promptGuidelines).toEqual([...guidelineSets[index]!]);
      expect(
        tool.promptGuidelines?.every((guideline) =>
          guideline.includes("pi_workflow"),
        ),
      ).toBe(true);
    });

    const listSchema = JSON.stringify(tools[0]?.parameters);
    const readMetadataSchema = JSON.stringify(tools[1]?.parameters);
    const readSchema = JSON.stringify(tools[2]?.parameters);
    expect(listSchema).toContain("global workflow catalog");
    expect(listSchema).toContain("repository name");
    expect(readMetadataSchema).toContain("workflow filename stem");
    expect(readSchema).toContain("workflow filename stem");
  });

  it("encodes scope, fallback, approval, role, and mutation guardrails", () => {
    const guidance = Object.values(WORKFLOW_PROMPT_GUIDELINES)
      .flat()
      .join("\n");
    expect(guidance).toMatch(/known configured project/);
    expect(guidance).toMatch(/omit project/);
    expect(guidance).toMatch(/working directory or repository name/);
    expect(guidance).toMatch(/retry pi_workflow_list without project/);
    expect(guidance).toMatch(/conversational approval/);
    expect(guidance).toMatch(/first standalone item exactly/);
    expect(guidance).toMatch(/role instructions/);
    expect(guidance).toMatch(/other-role workflows as context/);
    expect(guidance).toMatch(/only \/workflows may change projects\.json/);
    expect(guidance).toMatch(/CATALOG_TOO_LARGE/);
  });
});

describe("workflow listing and reading", () => {
  it("lists project metadata when project is supplied and global metadata otherwise", () => {
    const paths = setup();
    mkdirSync(paths.rolesDir);
    writeFileSync(join(paths.rolesDir, "architect.md"), "filename only");
    writeFileSync(join(paths.workflowDir, "bounded-work.md"), validWorkflow());
    writeFileSync(
      join(paths.workflowDir, "invalid.md"),
      "---\ntitle: Invalid\n---\nBody",
    );
    writeFileSync(join(paths.workflowDir, "unconfigured.md"), "invalid");
    writeProjects(paths, {
      version: 1,
      projects: {
        demo: {
          roles: {
            architect: ["bounded-work", "missing"],
            sergeant: ["bounded-work", "invalid"],
          },
        },
      },
    });

    const project = text(executeWorkflowList({ project: "demo" }, paths));
    expect(project).toContain("Project workflow list: demo");
    expect(project.match(/bounded-work: Bounded work/g)).toHaveLength(1);
    expect(project).toContain("missing [missing]");
    expect(project).toContain("Workflows assigned by role:");
    expect(project).toContain("- architect: bounded-work, missing");
    expect(project).toContain(
      "- sergeant [unavailable]: bounded-work, invalid",
    );
    expect(project).toContain("invalid [invalid: INVALID_WORKFLOW]");
    expect(project).not.toContain("unconfigured");

    const global = text(executeWorkflowList({}, paths));
    expect(global).toContain("Global workflow catalog:");
    expect(global).toContain("bounded-work: Bounded work");
    expect(global).toContain("invalid [invalid:");
    expect(global).not.toContain("Follow the instructions");
  });

  it("supports global metadata and complete reads without a project file", () => {
    const paths = setup();
    const raw = validWorkflow({ extra: "custom:\n  nested: true" });
    writeFileSync(join(paths.workflowDir, "bounded-work.md"), raw);

    const metadata = text(
      executeWorkflowReadMetadata({ workflow: "bounded-work" }, paths),
    );
    const full = text(executeWorkflowRead({ workflow: "bounded-work" }, paths));

    expect(metadata).toContain(
      "Project assignment: not checked because no project was supplied.",
    );
    expect(metadata).toContain('"custom":{"nested":true}');
    expect(metadata).toContain("Source:");
    expect(metadata).not.toContain("Follow the instructions");
    expect(full).toContain(
      "Project assignment: not checked because no project was supplied.",
    );
    expect(full.endsWith(raw)).toBe(true);
  });

  it("keeps deliberate project assignment context on individual reads", () => {
    const paths = setup();
    const raw = validWorkflow();
    writeFileSync(join(paths.workflowDir, "bounded-work.md"), raw);
    writeProjects(paths, {
      version: 1,
      projects: { demo: { roles: { architect: ["bounded-work"] } } },
    });

    const metadata = text(
      executeWorkflowReadMetadata(
        { project: "demo", workflow: "bounded-work" },
        paths,
      ),
    );
    const full = text(
      executeWorkflowRead({ project: "demo", workflow: "bounded-work" }, paths),
    );

    expect(metadata).toContain(
      "Project assignment: bounded-work is configured for 1 role(s) in demo: architect.",
    );
    expect(full).toContain("configured for 1 role(s)");
    expect(full.endsWith(raw)).toBe(true);
  });

  it("keeps empty catalogs as successful results", () => {
    const paths = setup();
    writeProjects(paths, { version: 1, projects: { demo: { roles: {} } } });

    expect(text(executeWorkflowList({ project: "demo" }, paths))).toContain(
      "(empty",
    );
    expect(text(executeWorkflowList({}, paths))).toContain("(empty)");
  });
});

describe("workflow tool failure boundaries", () => {
  it("keeps project misses explicit while allowing a global retry", () => {
    const paths = setup();
    writeFileSync(join(paths.workflowDir, "bounded-work.md"), validWorkflow());
    writeProjects(paths, {
      version: 1,
      projects: { demo: { roles: {} } },
    });

    const error = thrownError(() =>
      executeWorkflowList({ project: "pi" }, paths),
    );
    expect(error).toMatchObject({ code: "PROJECT_NOT_FOUND" });
    expect(error.message).toContain("Configured projects: demo");
    expect(error.message).toMatch(/retry the operation without project/i);

    const global = text(executeWorkflowList({}, paths));
    expect(global).toContain("Global workflow catalog:");
    expect(global).toContain("bounded-work: Bounded work");
  });

  it("rejects inferred filesystem paths as project IDs", () => {
    const paths = setup();
    writeProjects(paths, { version: 1, projects: { demo: { roles: {} } } });

    const error = thrownError(() =>
      executeWorkflowList({ project: "/workspace/projects/pi" }, paths),
    );
    expect(error).toMatchObject({ code: "INVALID_ID" });
    expect(error.message).toContain("not a filesystem path");
    expect(error.message).toMatch(/without project/i);
    expect(Buffer.byteLength(error.message, "utf8")).toBeLessThan(48 * 1024);
  });

  it("preserves required-argument, workflow, project-file, and catalog errors", () => {
    const paths = setup();
    writeProjects(paths, { version: 1, projects: { demo: { roles: {} } } });

    expect(
      thrownError(() =>
        executeWorkflowReadMetadata({ workflow: undefined as never }, paths),
      ),
    ).toMatchObject({ code: "INVALID_ARGUMENT" });
    expect(
      thrownError(() => executeWorkflowRead({ workflow: "missing" }, paths)),
    ).toMatchObject({ code: "WORKFLOW_NOT_FOUND" });

    const malformedPaths = setup();
    writeFileSync(malformedPaths.projectsFile, "{");
    expect(
      thrownError(() =>
        executeWorkflowList({ project: "demo" }, malformedPaths),
      ),
    ).toMatchObject({ code: "INVALID_PROJECTS_FILE" });

    const unsupportedPaths = setup();
    writeFileSync(
      unsupportedPaths.projectsFile,
      JSON.stringify({ version: 2, projects: {} }),
    );
    expect(
      thrownError(() =>
        executeWorkflowList({ project: "demo" }, unsupportedPaths),
      ),
    ).toMatchObject({ code: "UNSUPPORTED_PROJECTS_VERSION" });

    const catalogPaths = setup();
    rmSync(catalogPaths.workflowDir, { recursive: true });
    writeFileSync(catalogPaths.workflowDir, "not a directory");
    expect(
      thrownError(() => executeWorkflowList({}, catalogPaths)),
    ).toMatchObject({
      code: "READ_FAILED",
      message: "Cannot inspect the workflow catalog.",
    });
  });

  it("preserves size errors for global catalogs and individual reads", () => {
    const paths = setup();
    for (const id of ["one", "two", "three"]) {
      writeFileSync(
        join(paths.workflowDir, `${id}.md`),
        validWorkflow({ summary: id.repeat(9_000) }),
      );
    }

    expect(thrownError(() => executeWorkflowList({}, paths))).toMatchObject({
      code: "CATALOG_TOO_LARGE",
    });

    writeFileSync(
      join(paths.workflowDir, "large.md"),
      `${validWorkflow()}\n${"x".repeat(33 * 1024)}`,
    );
    expect(
      thrownError(() => executeWorkflowRead({ workflow: "large" }, paths)),
    ).toMatchObject({ code: "WORKFLOW_TOO_LARGE" });
  });

  it("rejects public failures with one code prefix and no stack trace", async () => {
    const paths = setup();
    writeProjects(paths, { version: 1, projects: { demo: { roles: {} } } });
    const tool = createWorkflowListTool(() => paths);
    const readMetadataTool = createWorkflowReadMetadataTool(() => paths);
    const readTool = createWorkflowReadTool(() => paths);

    const failures = [
      [tool, { project: "unknown" }, "PROJECT_NOT_FOUND"],
      [readMetadataTool, { workflow: "missing" }, "WORKFLOW_NOT_FOUND"],
      [readTool, { workflow: "missing" }, "WORKFLOW_NOT_FOUND"],
    ] as const;

    for (const [registeredTool, params, code] of failures) {
      const error = await rejectedError(() =>
        registeredTool.execute(
          "call",
          params as never,
          undefined,
          undefined,
          undefined as never,
        ),
      );
      expect(error).toMatchObject({ code });
      expect(error.message).toMatch(new RegExp(`^${code}: `));
      expect(error.message.match(new RegExp(`${code}:`, "g"))).toHaveLength(1);
      expect(Buffer.byteLength(error.message, "utf8")).toBeLessThanOrEqual(
        48 * 1024,
      );
      expect(error.message).not.toMatch(/\n\s+at\s/);
    }
  });
});

describe("workflow tool rendering", () => {
  it("keeps successful collapsed output hidden and failed output visible", () => {
    const tool = createWorkflowListTool();
    const renderResult = tool.renderResult!;
    const renderCall = tool.renderCall!;
    const result = {
      content: [{ type: "text" as const, text: "PROJECT_NOT_FOUND: recover" }],
      details: {},
    };

    const successful = renderResult(
      result,
      { expanded: false, isPartial: false },
      testTheme as never,
      { isError: false } as never,
    );
    const failed = renderResult(
      result,
      { expanded: false, isPartial: false },
      testTheme as never,
      { isError: true } as never,
    );
    const expandedFailure = renderResult(
      result,
      { expanded: true, isPartial: false },
      testTheme as never,
      { isError: true } as never,
    );
    const call = renderCall(
      { project: "unknown" },
      testTheme as never,
      { isError: true, expanded: false } as never,
    );

    expect(successful.render(200).join("\n")).toBe("");
    expect(failed.render(200).join("\n")).toContain(
      "PROJECT_NOT_FOUND: recover",
    );
    expect(failed.render(200).join("\n")).toContain("[error]");
    expect(expandedFailure.render(200).join("\n")).toContain(
      "PROJECT_NOT_FOUND: recover",
    );
    expect(call.render(200).join("\n")).toContain("pi_workflow_list error");
    expect(call.render(200).join("\n")).toContain("[error]");
  });
});
