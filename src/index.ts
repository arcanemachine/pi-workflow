import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerWorkflowCommand } from "./command.js";
import { registerWorkflowTools } from "./tool.js";

export default function piWorkflow(pi: ExtensionAPI): void {
  registerWorkflowTools(pi);
  registerWorkflowCommand(pi, undefined, (message, options) => {
    pi.sendMessage(message, options);
  });
}
