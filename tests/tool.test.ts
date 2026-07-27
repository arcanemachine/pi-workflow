import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkflowError } from "../src/errors.js";
import { resolveWorkflowPaths } from "../src/paths.js";
import {
  WORKFLOW_PROMPT_GUIDELINES,
  WORKFLOW_PROMPT_SNIPPET,
  createWorkflowTool,
  executeWorkflowTool,
  registerWorkflowTool,
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

function text(result: ReturnType<typeof executeWorkflowTool>): string {
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

describe("pi_workflow registration", () => {
  it("registers one tool with clear schema actions and prompt metadata", () => {
    let registered: ReturnType<typeof createWorkflowTool> | undefined;
    registerWorkflowTool({
      registerTool(tool) {
        registered = tool as unknown as ReturnType<typeof createWorkflowTool>;
      },
    });

    expect(registered?.name).toBe("pi_workflow");
    expect(registered?.promptSnippet).toBe(WORKFLOW_PROMPT_SNIPPET);
    expect(registered?.promptGuidelines).toEqual([
      ...WORKFLOW_PROMPT_GUIDELINES,
    ]);
    expect(registered?.promptGuidelines).toHaveLength(20);
    expect(
      registered?.promptGuidelines?.every((guideline) =>
        guideline.includes("pi_workflow"),
      ),
    ).toBe(true);

    const schema = JSON.stringify(registered?.parameters);
    expect(schema).toContain("list_global");
    expect(schema).toContain("configured project");
    expect(schema).toContain("not a filesystem path");
    expect(schema).toContain("filename stem");
  });

  it("encodes every required behavioral guardrail", () => {
    const guidance = WORKFLOW_PROMPT_GUIDELINES.join("\n");
    expect(guidance).toMatch(/project workflow/);
    expect(guidance).toMatch(/direct user request.*global workflow/i);
    expect(guidance).toMatch(/without a project probe/);
    expect(guidance).toMatch(/explicitly permitted global-catalog/);
    expect(guidance).toMatch(/first standalone numbered item/);
    expect(guidance).toMatch(/already approval/);
    expect(guidance).toMatch(/Workers/);
    expect(guidance).toMatch(/only the user-operated \/workflows/);
    expect(guidance).toMatch(/CATALOG_TOO_LARGE/);
    expect(guidance).toMatch(/active role from your own role instructions/);
    expect(guidance).toMatch(/coordination context, not candidates/);
    expect(guidance).toMatch(/behavioral contract enforced by guidance/);
  });
});

describe("pi_workflow successful actions", () => {
  it("lists all project workflow metadata grouped by role with diagnostics", () => {
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

    const output = text(
      executeWorkflowTool({ action: "list", project: "demo" }, paths),
    );

    expect(output).toContain("Workflows:");
    expect(output.match(/bounded-work: Bounded work/g)).toHaveLength(1);
    expect(output).toContain("missing [missing]");
    expect(output).toContain("Workflows assigned by role:");
    expect(output).toContain("- architect: bounded-work, missing");
    expect(output).toContain("- sergeant [unavailable]: bounded-work, invalid");
    expect(output).toContain("invalid [invalid: INVALID_WORKFLOW]");
    expect(output).not.toContain("unconfigured");
  });

  it("keeps empty catalogs and individual invalid entries as successful results", () => {
    const paths = setup();
    writeProjects(paths, { version: 1, projects: { demo: { roles: {} } } });

    expect(
      text(executeWorkflowTool({ action: "list", project: "demo" }, paths)),
    ).toContain("(empty");
    expect(
      text(executeWorkflowTool({ action: "list_global" }, paths)),
    ).toContain("(empty)");

    writeFileSync(join(paths.workflowDir, "invalid.md"), "invalid");
    const global = text(executeWorkflowTool({ action: "list_global" }, paths));
    expect(global).toContain("invalid [invalid: INVALID_WORKFLOW]");
  });

  it("lists global metadata and invalid diagnostics without workflow bodies", () => {
    const paths = setup();
    writeFileSync(join(paths.workflowDir, "bounded-work.md"), validWorkflow());
    writeFileSync(join(paths.workflowDir, "invalid.md"), "invalid");

    const output = text(executeWorkflowTool({ action: "list_global" }, paths));

    expect(output).toContain("bounded-work: Bounded work");
    expect(output).toContain("invalid [invalid:");
    expect(output).not.toContain("Follow the instructions");
  });

  it("reads complete metadata without body and complete raw Markdown", () => {
    const paths = setup();
    const raw = validWorkflow({ extra: "custom:\n  nested: true" });
    writeFileSync(join(paths.workflowDir, "bounded-work.md"), raw);
    writeProjects(paths, {
      version: 1,
      projects: { demo: { roles: { architect: ["bounded-work"] } } },
    });

    const metadata = text(
      executeWorkflowTool(
        { action: "read_metadata", project: "demo", workflow: "bounded-work" },
        paths,
      ),
    );
    const full = text(
      executeWorkflowTool(
        { action: "read", project: "demo", workflow: "bounded-work" },
        paths,
      ),
    );

    expect(metadata).toContain('"custom":{"nested":true}');
    expect(metadata).toContain("Source:");
    expect(metadata).not.toContain("Follow the instructions");
    expect(full).toContain("configured for 1 role(s)");
    expect(full.endsWith(raw)).toBe(true);
  });
});

describe("pi_workflow failure boundaries", () => {
  it("throws typed domain errors and wraps only unexpected errors", () => {
    const paths = setup();
    writeProjects(paths, {
      version: 1,
      projects: { demo: { roles: {} } },
    });

    expect(
      thrownError(() => executeWorkflowTool({ action: "list" }, paths)),
    ).toMatchObject({ code: "INVALID_ARGUMENT" });
    expect(
      thrownError(() =>
        executeWorkflowTool({ action: "read", workflow: "missing" }, paths),
      ),
    ).toMatchObject({ code: "WORKFLOW_NOT_FOUND" });
    expect(
      thrownError(() =>
        executeWorkflowTool({ action: "list_global" }, {
          get workflowDir(): string {
            throw new Error("unexpected failure");
          },
        } as unknown as ReturnType<typeof resolveWorkflowPaths>),
      ),
    ).toMatchObject({ code: "READ_FAILED", message: "unexpected failure" });
  });

  it("preserves known size errors instead of converting them to READ_FAILED", () => {
    const paths = setup();
    for (const id of ["one", "two", "three"]) {
      writeFileSync(
        join(paths.workflowDir, `${id}.md`),
        validWorkflow({ summary: id.repeat(9_000) }),
      );
    }

    expect(
      thrownError(() => executeWorkflowTool({ action: "list_global" }, paths)),
    ).toMatchObject({ code: "CATALOG_TOO_LARGE" });

    writeFileSync(
      join(paths.workflowDir, "large.md"),
      `${validWorkflow()}\n${"x".repeat(33 * 1024)}`,
    );
    expect(
      thrownError(() =>
        executeWorkflowTool({ action: "read", workflow: "large" }, paths),
      ),
    ).toMatchObject({ code: "WORKFLOW_TOO_LARGE" });
  });

  it("preserves project-file errors and fails unusable catalog roots", () => {
    const malformedPaths = setup();
    writeFileSync(malformedPaths.projectsFile, "{");
    expect(
      thrownError(() =>
        executeWorkflowTool(
          { action: "list", project: "demo" },
          malformedPaths,
        ),
      ),
    ).toMatchObject({ code: "INVALID_PROJECTS_FILE" });

    const unsupportedPaths = setup();
    writeFileSync(
      unsupportedPaths.projectsFile,
      JSON.stringify({ version: 2, projects: {} }),
    );
    expect(
      thrownError(() =>
        executeWorkflowTool(
          { action: "list", project: "demo" },
          unsupportedPaths,
        ),
      ),
    ).toMatchObject({ code: "UNSUPPORTED_PROJECTS_VERSION" });

    const catalogPaths = setup();
    rmSync(catalogPaths.workflowDir, { recursive: true });
    writeFileSync(catalogPaths.workflowDir, "not a directory");
    expect(
      thrownError(() =>
        executeWorkflowTool({ action: "list_global" }, catalogPaths),
      ),
    ).toMatchObject({
      code: "READ_FAILED",
      message: "Cannot inspect the workflow catalog.",
    });
  });

  it("provides bounded, conditional recovery for invalid and unknown projects", () => {
    const paths = setup();
    const projects: ProjectsFileV1["projects"] = {};
    for (let index = 0; index < 300; index++) {
      projects[`project-${String(index).padStart(3, "0")}`] = { roles: {} };
    }
    writeProjects(paths, { version: 1, projects });

    const invalid = thrownError(() =>
      executeWorkflowTool(
        { action: "list", project: "/workspace/projects/pi" },
        paths,
      ),
    );
    const unknown = thrownError(() =>
      executeWorkflowTool({ action: "list", project: "unknown" }, paths),
    );

    for (const error of [invalid, unknown]) {
      expect(error.message).toContain("Configured projects:");
      expect(error.message).toContain('action "list_global" with no project');
      expect(error.message).toMatch(/explicitly requested the global catalog/i);
      expect(Buffer.byteLength(error.message, "utf8")).toBeLessThan(48 * 1024);
    }
    const noProjects = thrownError(() =>
      executeWorkflowTool(
        { action: "list", project: "/workspace/projects/pi" },
        setup(),
      ),
    );
    expect(noProjects.message).toContain("Configured projects: (none)");
    expect(invalid).toMatchObject({ code: "INVALID_ID" });
    expect(invalid.message).toContain("not a filesystem path");
    expect(unknown).toMatchObject({ code: "PROJECT_NOT_FOUND" });
    expect(unknown.message).toContain("project-000, project-001");
    expect(
      thrownError(() =>
        executeWorkflowTool(
          {
            action: "read_metadata",
            project: "/workspace/projects/pi",
            workflow: "missing",
          },
          paths,
        ),
      ),
    ).toMatchObject({ code: "INVALID_ID" });
  });

  it("rejects every public failure action with one code prefix and its code", async () => {
    const paths = setup();
    writeProjects(paths, { version: 1, projects: { demo: { roles: {} } } });
    for (const id of ["one", "two", "three"]) {
      writeFileSync(
        join(paths.workflowDir, `${id}.md`),
        validWorkflow({ summary: id.repeat(9_000) }),
      );
    }
    const tool = createWorkflowTool(() => paths);

    const failures = [
      [
        "list",
        { action: "list", project: "/workspace/projects/pi" },
        "INVALID_ID",
      ],
      ["list", { action: "list", project: "unknown" }, "PROJECT_NOT_FOUND"],
      ["list_global", { action: "list_global" }, "CATALOG_TOO_LARGE"],
      [
        "read_metadata",
        { action: "read_metadata", workflow: "missing" },
        "WORKFLOW_NOT_FOUND",
      ],
      ["read", { action: "read", workflow: "missing" }, "WORKFLOW_NOT_FOUND"],
    ] as const;

    for (const [_action, params, code] of failures) {
      const error = await rejectedError(() =>
        tool.execute("call", params, undefined, undefined, undefined as never),
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

describe("pi_workflow rendering", () => {
  it("keeps successful collapsed output hidden and failed output visible", () => {
    const tool = createWorkflowTool();
    const renderResult = tool.renderResult!;
    const renderCall = tool.renderCall!;
    const result = {
      content: [{ type: "text" as const, text: "PROJECT_NOT_FOUND: recover" }],
      details: { action: "list" as const },
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
      { action: "list", project: "unknown" },
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
    expect(call.render(200).join("\n")).toContain("pi_workflow error");
    expect(call.render(200).join("\n")).toContain("[error]");
  });
});
