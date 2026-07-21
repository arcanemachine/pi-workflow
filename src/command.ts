import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { WorkflowError, errorDetail } from "./errors.js";
import { productionWorkflowPaths, type WorkflowPaths } from "./paths.js";
import { configureProjectWorkflows } from "./ui/configure.js";

export const WORKFLOW_COMMAND_DESCRIPTION =
  "Configure which workflows are available to each workflow-managing role in a project.";

export type WorkflowCommandHandler = (
  args: string,
  ctx: ExtensionCommandContext,
) => Promise<void>;

export function createWorkflowCommandHandler(
  pathsProvider: () => WorkflowPaths = productionWorkflowPaths,
): WorkflowCommandHandler {
  return async (args, ctx) => {
    if (args.trim().length > 0) {
      ctx.ui.notify(
        `Usage: /workflows\n${WORKFLOW_COMMAND_DESCRIPTION}`,
        "warning",
      );
      return;
    }
    if (ctx.mode !== "tui") {
      ctx.ui.notify(
        `UI_UNAVAILABLE: /workflows requires TUI mode. No configuration was changed.`,
        "error",
      );
      return;
    }

    try {
      await configureProjectWorkflows(ctx, pathsProvider());
    } catch (error) {
      if (error instanceof WorkflowError) {
        ctx.ui.notify(`${error.code}: ${error.message}`, "error");
      } else {
        ctx.ui.notify(`READ_FAILED: ${errorDetail(error)}`, "error");
      }
    }
  };
}

export function registerWorkflowCommand(
  pi: Pick<ExtensionAPI, "registerCommand">,
  pathsProvider: () => WorkflowPaths = productionWorkflowPaths,
): void {
  pi.registerCommand("workflows", {
    description: WORKFLOW_COMMAND_DESCRIPTION,
    handler: createWorkflowCommandHandler(pathsProvider),
  });
}
