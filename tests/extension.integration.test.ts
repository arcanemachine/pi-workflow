import { describe, expect, it } from "vitest";
import piWorkflow from "../src/index.js";

describe("extension entrypoint", () => {
  it("registers the workflow tools and command without other side effects", () => {
    const tools: string[] = [];
    const commands: string[] = [];

    piWorkflow({
      registerTool(tool: { name: string }) {
        tools.push(tool.name);
      },
      registerCommand(name: string) {
        commands.push(name);
      },
    } as never);

    expect(tools).toEqual([
      "pi_workflow_list",
      "pi_workflow_read_metadata",
      "pi_workflow_read",
    ]);
    expect(commands).toEqual(["workflows"]);
  });
});
