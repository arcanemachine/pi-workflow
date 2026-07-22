import { StringEnum } from "@earendil-works/pi-ai";
import type {
  AgentToolResult,
  ExtensionAPI,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { keyText } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import {
  MAX_RENDERED_RESULT_BYTES,
  discoverWorkflowCatalog,
  findCatalogEntry,
  requireWorkflow,
} from "./catalog.js";
import {
  WorkflowError,
  errorDetail,
  type WorkflowErrorCode,
} from "./errors.js";
import { requireValidId } from "./ids.js";
import { productionWorkflowPaths, type WorkflowPaths } from "./paths.js";
import { loadProjectsFile } from "./projects.js";
import { discoverGlobalRoleFilenames } from "./roles.js";
import type {
  Diagnostic,
  ProjectConfigV1,
  WorkflowDefinition,
  WorkflowMetadataV1,
} from "./types.js";

export const WORKFLOW_PROMPT_SNIPPET =
  "List project workflow metadata and read an approved workflow.";

export const WORKFLOW_PROMPT_GUIDELINES = [
  "Before recommending a workflow, briefly state that you will list the project's workflows, then call pi_workflow with action list once for the exact project.",
  "Use the project workflow list returned by pi_workflow by default.",
  "Base workflow recommendations on pi_workflow bulk metadata; do not read every workflow.",
  "Do not call pi_workflow read_metadata separately for every project workflow; use it only for a material detail missing from bulk metadata or when the user asks for that metadata.",
  "Never call pi_workflow with action list_global unless the user explicitly permitted global-catalog investigation.",
  "If no project workflow fits, explain that and ask permission before calling pi_workflow with action list_global.",
  "Never call pi_workflow read_metadata for an unconfigured global workflow without explicit user permission.",
  "Never call pi_workflow read until the user explicitly approves that workflow or directly asks to read it.",
  "After recommending from pi_workflow metadata, make the first standalone numbered item exactly the workflow decision: **1. Workflow approval:** Do you approve using `<workflow-id>`? Do not bury or combine it.",
  "A direct user instruction to use a named workflow is already approval; do not ask redundantly before calling pi_workflow read.",
  "Workflow frontmatter in a plan does not replace explicit conversational approval before calling pi_workflow read.",
  "Only workflow-selection or coordination agents should investigate with pi_workflow; Workers and roles with no configured workflows execute their assignments without selecting a workflow.",
  "When using pi_workflow, workflow approval authorizes plan edits required by that approved workflow; do not edit a plan outside direct user instruction or approved workflow or task guidance.",
  "Never add, remove, or edit project workflow assignments with pi_workflow or general file-mutation tools; only the user-operated /workflows command may change projects.json.",
  "Treat pi_workflow unavailable-role and missing-workflow markers as diagnostics, not permission to rewrite configuration.",
  "If pi_workflow returns CATALOG_TOO_LARGE, stop selection, explain that bulk comparison is impossible, and ask the user to reduce the project workflow list with /workflows; do not inspect workflows one by one.",
  "Determine your active role from your own role instructions, not from pi_workflow; then recommend only workflows assigned to that role in the pi_workflow project list.",
  "Workflows assigned to other roles in the pi_workflow project list are coordination context, not candidates for your active role; describe them only when the user asks about them.",
  "This role-based selection is a behavioral contract enforced by guidance, not by pi_workflow; the tool does not query or depend on any role extension.",
] as const;

export const WorkflowToolParameters = Type.Object({
  action: StringEnum(["list", "list_global", "read_metadata", "read"] as const),
  project: Type.Optional(Type.String()),
  workflow: Type.Optional(Type.String()),
});

export interface WorkflowToolDetails {
  action: "list" | "list_global" | "read_metadata" | "read";
  ok: boolean;
  code?: WorkflowErrorCode;
}

type WorkflowToolParams = {
  action: "list" | "list_global" | "read_metadata" | "read";
  project?: string;
  workflow?: string;
};

type WorkflowToolResult = AgentToolResult<WorkflowToolDetails>;

function truncateUtf8(text: string, maximumBytes: number): string {
  const buffer = Buffer.from(text, "utf8");
  if (buffer.byteLength <= maximumBytes) return text;
  const suffix = "\n[truncated]";
  const prefix = buffer
    .subarray(0, maximumBytes - Buffer.byteLength(suffix) - 3)
    .toString("utf8")
    .replace(/�$/, "");
  return `${prefix}${suffix}`;
}

function displayId(id: string): string {
  return id.length <= 160 ? id : `${id.slice(0, 157)}…`;
}

function renderSummary(args: WorkflowToolParams, isError: boolean): string {
  if (isError) return "pi_workflow error";
  switch (args.action) {
    case "list":
      return args.project
        ? `List workflows for ${args.project}`
        : "List project workflows";
    case "list_global":
      return "List global workflows";
    case "read_metadata":
      return args.workflow
        ? `Read metadata: ${args.workflow}`
        : "Read workflow metadata";
    case "read":
      return args.workflow ? `Read ${args.workflow}` : "Read workflow";
  }
}

function result(
  action: WorkflowToolParams["action"],
  text: string,
): WorkflowToolResult {
  return {
    content: [{ type: "text", text }],
    details: { action, ok: true },
  };
}

function errorResult(
  action: WorkflowToolParams["action"],
  code: WorkflowErrorCode,
  message: string,
): WorkflowToolResult {
  const text = truncateUtf8(`${code}: ${message}`, MAX_RENDERED_RESULT_BYTES);
  return {
    content: [{ type: "text", text }],
    details: { action, ok: false, code },
  };
}

function ensureBounded(
  action: WorkflowToolParams["action"],
  text: string,
  overflowCode: "CATALOG_TOO_LARGE" | "WORKFLOW_TOO_LARGE",
): WorkflowToolResult {
  if (Buffer.byteLength(text, "utf8") > MAX_RENDERED_RESULT_BYTES) {
    const message =
      overflowCode === "CATALOG_TOO_LARGE"
        ? "The complete workflow metadata result exceeds 48 KiB. Reduce the project workflow list with /workflows; do not inspect workflows one by one."
        : "The complete workflow result exceeds the 48 KiB output limit.";
    return errorResult(action, overflowCode, message);
  }
  return result(action, text);
}

function requireArgument(
  value: string | undefined,
  name: "project" | "workflow",
): string {
  if (value === undefined || value.length === 0) {
    throw new WorkflowError(
      "INVALID_ARGUMENT",
      `${name} is required for this action.`,
    );
  }
  return requireValidId(
    value,
    name === "project" ? "Project ID" : "Workflow ID",
  );
}

function configuredProject(
  paths: WorkflowPaths,
  projectId: string,
): ProjectConfigV1 {
  const projects = loadProjectsFile(paths.projectsFile).value.projects;
  const project = projects[projectId];
  if (!project) {
    const available = Object.keys(projects).sort();
    throw new WorkflowError(
      "PROJECT_NOT_FOUND",
      `Project ${JSON.stringify(projectId)} is not configured. Configured projects: ${available.length === 0 ? "(none)" : available.join(", ")}.`,
    );
  }
  return project;
}

function metadataLines(workflow: WorkflowDefinition, indent: string): string[] {
  const { metadata } = workflow;
  return [
    `${indent}${workflow.id}: ${metadata.title}`,
    `${indent}  summary: ${metadata.summary}`,
    `${indent}  use when: ${metadata.use_when.join(" | ")}`,
    `${indent}  avoid when: ${metadata.avoid_when.join(" | ")}`,
    `${indent}  routes: ${metadata.routing ? Object.keys(metadata.routing).sort().join(", ") : "(none)"}`,
  ];
}

function diagnosticLines(diagnostics: readonly Diagnostic[]): string[] {
  if (diagnostics.length === 0) return [];
  return [
    "",
    "Warnings:",
    ...diagnostics.map(
      (item) =>
        `- ${item.code}: ${item.path ? `${item.path}: ` : ""}${item.message}`,
    ),
  ];
}

function listProject(
  projectId: string,
  paths: WorkflowPaths,
): WorkflowToolResult {
  const project = configuredProject(paths, projectId);
  const workflowRoles = new Map<string, string[]>();
  for (const [roleId, assignedIds] of Object.entries(project.roles)) {
    for (const workflowId of assignedIds) {
      const assignedRoles = workflowRoles.get(workflowId) ?? [];
      assignedRoles.push(roleId);
      workflowRoles.set(workflowId, assignedRoles);
    }
  }
  const workflowIds = [...workflowRoles.keys()].sort();
  const catalog = discoverWorkflowCatalog(paths.workflowDir, workflowIds);
  const roles = discoverGlobalRoleFilenames(paths.rolesDir);
  const availableRoles = new Set(roles.roleIds);
  const lines = [`Project workflow list: ${projectId}`];

  const roleIds = Object.keys(project.roles).sort();
  if (roleIds.length === 0) {
    lines.push(
      "(empty — the user can configure this project workflow list with /workflows)",
    );
  } else {
    lines.push("", "Workflows:");
    for (let index = 0; index < workflowIds.length; index++) {
      if (index > 0) lines.push("");
      const workflowId = workflowIds[index];
      const entry = findCatalogEntry(catalog, workflowId);
      if (!entry) {
        lines.push(`  ${workflowId} [missing]`);
      } else if (!entry.workflow) {
        const codes = [...new Set(entry.diagnostics.map((item) => item.code))];
        lines.push(`  ${workflowId} [invalid: ${codes.join(", ")}]`);
      } else {
        lines.push(...metadataLines(entry.workflow, "  "));
      }
    }

    lines.push("", "Workflows assigned by role:");
    for (const roleId of roleIds) {
      const assignments = [...project.roles[roleId]].sort();
      lines.push(
        `- ${roleId}${availableRoles.has(roleId) ? "" : " [unavailable]"}: ${assignments.length === 0 ? "(none)" : assignments.join(", ")}`,
      );
    }
  }

  lines.push(
    ...diagnosticLines([...catalog.diagnostics, ...roles.diagnostics]),
  );
  return ensureBounded("list", lines.join("\n"), "CATALOG_TOO_LARGE");
}

function listGlobal(paths: WorkflowPaths): WorkflowToolResult {
  const catalog = discoverWorkflowCatalog(paths.workflowDir);
  const lines = ["Global workflow catalog:"];
  if (catalog.entries.length === 0) lines.push("(empty)");
  for (let index = 0; index < catalog.entries.length; index++) {
    if (index > 0) lines.push("");
    const entry = catalog.entries[index];
    if (entry.workflow) {
      lines.push(...metadataLines(entry.workflow, ""));
    } else {
      const codes = [...new Set(entry.diagnostics.map((item) => item.code))];
      lines.push(`${entry.id} [invalid: ${codes.join(", ")}]`);
    }
  }
  lines.push(...diagnosticLines(catalog.diagnostics));
  return ensureBounded("list_global", lines.join("\n"), "CATALOG_TOO_LARGE");
}

function projectAssignment(
  paths: WorkflowPaths,
  projectId: string | undefined,
  workflowId: string,
): string {
  if (projectId === undefined) {
    return "Project assignment: not checked because no project was supplied.";
  }
  requireValidId(projectId, "Project ID");
  const project = configuredProject(paths, projectId);
  const roles = Object.keys(project.roles)
    .filter((roleId) => project.roles[roleId].includes(workflowId))
    .sort();
  if (roles.length === 0) {
    return `Project assignment: ${displayId(workflowId)} is not configured for project ${displayId(projectId)}.`;
  }

  const visible: string[] = [];
  let visibleBytes = 0;
  for (const roleId of roles) {
    const addedBytes = Buffer.byteLength(
      `${visible.length === 0 ? "" : ", "}${roleId}`,
    );
    if (visibleBytes + addedBytes > 1_200) break;
    visible.push(roleId);
    visibleBytes += addedBytes;
  }
  const omitted = roles.length - visible.length;
  const roleList =
    visible.length === 0
      ? "(role IDs omitted because they exceed the display bound)"
      : `${visible.join(", ")}${omitted > 0 ? `, … (${omitted} more)` : ""}`;
  return `Project assignment: ${displayId(workflowId)} is configured for ${roles.length} role(s) in ${displayId(projectId)}: ${roleList}.`;
}

function readMetadata(
  workflowId: string,
  projectId: string | undefined,
  paths: WorkflowPaths,
): WorkflowToolResult {
  const assignment = projectAssignment(paths, projectId, workflowId);
  const workflow = requireWorkflow(
    discoverWorkflowCatalog(paths.workflowDir, [workflowId]),
    workflowId,
  );
  const text = `${assignment}\nSource: ${workflow.path}\nMetadata: ${JSON.stringify(workflow.metadata)}`;
  return ensureBounded("read_metadata", text, "WORKFLOW_TOO_LARGE");
}

function readWorkflow(
  workflowId: string,
  projectId: string | undefined,
  paths: WorkflowPaths,
): WorkflowToolResult {
  const assignment = projectAssignment(paths, projectId, workflowId);
  const workflow = requireWorkflow(
    discoverWorkflowCatalog(paths.workflowDir, [workflowId]),
    workflowId,
  );
  return ensureBounded(
    "read",
    `${assignment}\n\n${workflow.raw}`,
    "WORKFLOW_TOO_LARGE",
  );
}

export function executeWorkflowTool(
  params: WorkflowToolParams,
  paths: WorkflowPaths,
): WorkflowToolResult {
  try {
    switch (params.action) {
      case "list":
        return listProject(requireArgument(params.project, "project"), paths);
      case "list_global":
        return listGlobal(paths);
      case "read_metadata":
        return readMetadata(
          requireArgument(params.workflow, "workflow"),
          params.project,
          paths,
        );
      case "read":
        return readWorkflow(
          requireArgument(params.workflow, "workflow"),
          params.project,
          paths,
        );
    }
  } catch (error) {
    if (error instanceof WorkflowError) {
      return errorResult(params.action, error.code, error.message);
    }
    return errorResult(params.action, "READ_FAILED", errorDetail(error));
  }
}

export function createWorkflowTool(
  pathsProvider: () => WorkflowPaths = productionWorkflowPaths,
): ToolDefinition<typeof WorkflowToolParameters, WorkflowToolDetails> {
  return {
    name: "pi_workflow",
    label: "Pi Workflow",
    description:
      "List project or explicitly permitted global workflow metadata, read exact metadata, or read one approved Markdown workflow. This tool is read-only. Results are limited to 48 KiB.",
    promptSnippet: WORKFLOW_PROMPT_SNIPPET,
    promptGuidelines: [...WORKFLOW_PROMPT_GUIDELINES],
    parameters: WorkflowToolParameters,
    async execute(_toolCallId, params) {
      return executeWorkflowTool(params, pathsProvider());
    },
    renderCall(args, theme, context) {
      const summary = `${theme.fg("toolTitle", theme.bold("pi_workflow"))} ${theme.fg("accent", renderSummary(args, false))}`;
      const hint = context.expanded
        ? ""
        : theme.fg("dim", ` (${keyText("app.tools.expand")} to expand)`);
      return new Text(`${summary}${hint}`, 0, 0);
    },
    renderResult(result, options, theme, _context) {
      if (!options.expanded) {
        return new Text("", 0, 0);
      }
      const content = result.content[0];
      const body = content && content.type === "text" ? content.text : "";
      return new Text(`\n${theme.fg("toolOutput", body)}`, 0, 0);
    },
  };
}

export function registerWorkflowTool(
  pi: Pick<ExtensionAPI, "registerTool">,
  pathsProvider: () => WorkflowPaths = productionWorkflowPaths,
): void {
  pi.registerTool(createWorkflowTool(pathsProvider));
}
