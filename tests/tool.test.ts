import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  WORKFLOW_PROMPT_GUIDELINES,
  WORKFLOW_PROMPT_SNIPPET,
  createWorkflowTool,
  executeWorkflowTool,
  registerWorkflowTool,
} from "../src/tool.js";
import { resolveWorkflowPaths } from "../src/paths.js";
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

describe("pi_workflow registration", () => {
  it("registers one tool with the exact schema actions and prompt metadata", () => {
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
    expect(registered?.promptGuidelines).toHaveLength(16);
    expect(
      registered?.promptGuidelines?.every((guideline) =>
        guideline.includes("pi_workflow"),
      ),
    ).toBe(true);
    expect(JSON.stringify(registered?.parameters)).toContain("list_global");
  });

  it("encodes every required behavioral guardrail", () => {
    const guidance = WORKFLOW_PROMPT_GUIDELINES.join("\n");
    expect(guidance).toMatch(/list once/);
    expect(guidance).toMatch(/bulk metadata/);
    expect(guidance).toMatch(/explicitly permitted global-catalog/);
    expect(guidance).toMatch(/first standalone numbered item/);
    expect(guidance).toMatch(/already approval/);
    expect(guidance).toMatch(/Workers/);
    expect(guidance).toMatch(/only the user-operated \/workflows/);
    expect(guidance).toMatch(/CATALOG_TOO_LARGE/);
  });
});

describe("pi_workflow actions", () => {
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
            sergeant: ["invalid"],
          },
        },
      },
    });

    const output = text(
      executeWorkflowTool({ action: "list", project: "demo" }, paths),
    );

    expect(output).toContain("Role: architect");
    expect(output).toContain("bounded-work: Bounded work");
    expect(output).toContain("missing [missing]");
    expect(output).toContain("Role: sergeant [unavailable]");
    expect(output).toContain("invalid [invalid: INVALID_WORKFLOW]");
    expect(output).not.toContain("unconfigured");
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

  it("reads complete metadata without body and reads complete raw Markdown", () => {
    const paths = setup();
    const raw = validWorkflow({ extra: "custom:\n  nested: true" });
    writeFileSync(join(paths.workflowDir, "bounded-work.md"), raw);
    writeProjects(paths, {
      version: 1,
      projects: {
        demo: { roles: { architect: ["bounded-work"] } },
      },
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

  it("returns exact actionable argument, project, workflow, and size errors", () => {
    const paths = setup();
    writeProjects(paths, {
      version: 1,
      projects: { demo: { roles: {} } },
    });

    expect(text(executeWorkflowTool({ action: "list" }, paths))).toMatch(
      /^INVALID_ARGUMENT:/,
    );
    expect(
      text(executeWorkflowTool({ action: "list", project: "unknown" }, paths)),
    ).toContain("Configured projects: demo");
    expect(
      text(executeWorkflowTool({ action: "read", workflow: "missing" }, paths)),
    ).toMatch(/^WORKFLOW_NOT_FOUND:/);
  });

  it("fails a bulk result as a whole rather than omitting entries", () => {
    const paths = setup();
    const ids = ["one", "two", "three"];
    for (const id of ids) {
      writeFileSync(
        join(paths.workflowDir, `${id}.md`),
        validWorkflow({ summary: id.repeat(9_000) }),
      );
    }
    writeProjects(paths, {
      version: 1,
      projects: { demo: { roles: { architect: ids } } },
    });

    const result = executeWorkflowTool(
      { action: "list", project: "demo" },
      paths,
    );

    expect(text(result)).toMatch(/^CATALOG_TOO_LARGE:/);
    expect(result.details).toMatchObject({
      ok: false,
      code: "CATALOG_TOO_LARGE",
    });
  });
});
