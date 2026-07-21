import { describe, expect, it } from "vitest";
import { isValidId, requireValidId, suggestId } from "../src/ids.js";
import { resolveWorkflowPaths } from "../src/paths.js";

describe("workflow IDs", () => {
  it("accepts only lowercase kebab-case IDs", () => {
    expect(isValidId("full-phase")).toBe(true);
    expect(isValidId("phase2")).toBe(true);
    expect(isValidId("Full-Phase")).toBe(false);
    expect(isValidId("full_phase")).toBe(false);
    expect(isValidId("-phase")).toBe(false);
    expect(() => requireValidId("not valid")).toThrow(/lowercase kebab-case/);
  });

  it("suggests a normalized ID without making it authoritative", () => {
    expect(suggestId("  Café Project / API  ")).toBe("cafe-project-api");
  });
});

describe("workflow paths", () => {
  it("derives catalog, config, and role paths from an injected agent directory", () => {
    expect(resolveWorkflowPaths({ agentDir: "/tmp/pi-agent" })).toEqual({
      agentDir: "/tmp/pi-agent",
      workflowDir: "/tmp/pi-agent/workflows",
      projectsFile: "/tmp/pi-agent/workflows/projects.json",
      rolesDir: "/tmp/pi-agent/roles",
    });
  });

  it("accepts only an absolute isolation override", () => {
    expect(
      resolveWorkflowPaths({
        agentDir: "/tmp/pi-agent",
        env: { PI_WORKFLOW_DIR: "/tmp/isolated-workflows" },
      }).workflowDir,
    ).toBe("/tmp/isolated-workflows");
    expect(() =>
      resolveWorkflowPaths({
        agentDir: "/tmp/pi-agent",
        env: { PI_WORKFLOW_DIR: "relative" },
      }),
    ).toThrow(/absolute path/);
  });
});
