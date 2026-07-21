import { describe, expect, it } from "vitest";
import piWorkflow from "../src/index.js";

describe("extension entrypoint", () => {
  it("registers exactly one tool and one command without other side effects", () => {
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

    expect(tools).toEqual(["pi_workflow"]);
    expect(commands).toEqual(["workflows"]);
  });
});
