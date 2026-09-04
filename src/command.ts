import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import type { SelectItem } from "@earendil-works/pi-tui";
import { discoverWorkflowCatalog } from "./catalog.js";
import { WorkflowError, errorDetail } from "./errors.js";
import { productionWorkflowPaths, type WorkflowPaths } from "./paths.js";
import { configureProjectWorkflows } from "./ui/configure.js";
import { showSelection } from "./ui/components.js";

export const WORKFLOW_COMMAND_DESCRIPTION =
  "Configure which workflows are available to each role in a project.";

const EDIT_PROJECT_WORKFLOWS = "edit-project-workflows";
const INVOKE_WORKFLOW = "invoke-workflow";

export interface WorkflowCommandUI {
  select(
    title: string,
    items: SelectItem[],
    cancelLabel?: string,
  ): Promise<string | null>;
  notify(message: string, type?: "info" | "warning" | "error"): void;
}

export type WorkflowMessageAction = (
  message: {
    customType: "pi-workflow";
    content: string;
    display: true;
  },
  options: { triggerTurn: true },
) => void;

export type WorkflowCommandUIFactory = (
  ctx: ExtensionCommandContext,
) => WorkflowCommandUI;

export type WorkflowConfigurator = (
  ctx: ExtensionCommandContext,
  paths: WorkflowPaths,
) => Promise<void>;

export type WorkflowCommandHandler = (
  args: string,
  ctx: ExtensionCommandContext,
) => Promise<void>;

export function createWorkflowCommandUI(
  ctx: ExtensionCommandContext,
): WorkflowCommandUI {
  return {
    select: (title, items, cancelLabel) =>
      showSelection(ctx, title, items, cancelLabel),
    notify: (message, type) => ctx.ui.notify(message, type),
  };
}

const topLevelItems: SelectItem[] = [
  { value: EDIT_PROJECT_WORKFLOWS, label: "Edit project workflows" },
  { value: INVOKE_WORKFLOW, label: "Invoke workflow" },
];

async function invokeWorkflow(
  paths: WorkflowPaths,
  ui: WorkflowCommandUI,
  sendMessage: WorkflowMessageAction | undefined,
): Promise<"inserted" | "back"> {
  const catalog = discoverWorkflowCatalog(paths.workflowDir);
  for (const issue of catalog.diagnostics) {
    if (issue.code === "READ_FAILED" && issue.path === catalog.directory) {
      throw new WorkflowError(issue.code, issue.message);
    }
    ui.notify(`${issue.code}: ${issue.message}`, "warning");
  }

  const workflows = catalog.entries
    .filter((entry) => entry.workflow !== undefined)
    .map((entry) => ({
      value: entry.id,
      label: entry.id,
      description: entry.workflow!.metadata.summary,
    }));

  if (workflows.length === 0) {
    ui.notify("No valid workflows are available to invoke.", "warning");
    return "back";
  }

  const selected = await ui.select("Invoke workflow", workflows, "back");
  if (selected === null) return "back";

  const workflow = catalog.entries.find(
    (entry) => entry.id === selected,
  )?.workflow;
  if (!workflow) {
    throw new WorkflowError(
      "WORKFLOW_NOT_FOUND",
      `Workflow ${JSON.stringify(selected)} was not found.`,
    );
  }
  if (!sendMessage) {
    throw new WorkflowError(
      "UI_UNAVAILABLE",
      "Workflow invocation is unavailable in this command context.",
    );
  }

  sendMessage(
    {
      customType: "pi-workflow",
      content: workflow.raw,
      display: true,
    },
    { triggerTurn: true },
  );
  return "inserted";
}

async function showWorkflowMenu(
  ctx: ExtensionCommandContext,
  paths: WorkflowPaths,
  ui: WorkflowCommandUI,
  sendMessage: WorkflowMessageAction | undefined,
  configure: WorkflowConfigurator,
): Promise<void> {
  while (true) {
    const selected = await ui.select("Workflows", topLevelItems, "exit");
    if (selected === null) return;

    if (selected === EDIT_PROJECT_WORKFLOWS) {
      await configure(ctx, paths);
      continue;
    }

    if (selected === INVOKE_WORKFLOW) {
      const result = await invokeWorkflow(paths, ui, sendMessage);
      if (result === "inserted") return;
      continue;
    }
  }
}

export function createWorkflowCommandHandler(
  pathsProvider: () => WorkflowPaths = productionWorkflowPaths,
  sendMessage?: WorkflowMessageAction,
  uiFactory: WorkflowCommandUIFactory = createWorkflowCommandUI,
  configure: WorkflowConfigurator = configureProjectWorkflows,
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
      await showWorkflowMenu(
        ctx,
        pathsProvider(),
        uiFactory(ctx),
        sendMessage,
        configure,
      );
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
  sendMessage?: WorkflowMessageAction,
  uiFactory: WorkflowCommandUIFactory = createWorkflowCommandUI,
): void {
  pi.registerCommand("workflows", {
    description: WORKFLOW_COMMAND_DESCRIPTION,
    handler: createWorkflowCommandHandler(
      pathsProvider,
      sendMessage,
      uiFactory,
    ),
  });
}
