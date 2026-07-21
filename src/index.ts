import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerWorkflowCommand } from "./command.js";
import { registerWorkflowTool } from "./tool.js";

export default function piWorkflow(pi: ExtensionAPI): void {
  registerWorkflowTool(pi);
  registerWorkflowCommand(pi);
}
