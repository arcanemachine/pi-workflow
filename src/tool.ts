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
import { WorkflowError, errorDetail } from "./errors.js";
import { isValidId } from "./ids.js";
import { productionWorkflowPaths, type WorkflowPaths } from "./paths.js";
import { loadProjectsFile } from "./projects.js";
import { discoverGlobalRoleFilenames } from "./roles.js";
import type {
  Diagnostic,
  ProjectConfigV1,
  WorkflowDefinition,
  WorkflowMetadataV1,
} from "./types.js";

export const WORKFLOW_PROMPT_SNIPPETS = {
  list: "List project workflow metadata or the global workflow catalog",
  readMetadata: "Read workflow metadata with optional project context",
  read: "Read an approved workflow with optional project context",
} as const;

export const WORKFLOW_PROMPT_GUIDELINES = {
  list: [
    "Use pi_workflow_list with a known configured project when the task belongs to that project; omit project for non-project work or when no relevant configured project is known.",
    "Do not infer a pi_workflow_list project ID solely from the working directory or repository name. If a project lookup fails and global context may help, retry pi_workflow_list without project.",
    "Before recommending a project workflow, call pi_workflow_list once for that project and use its bulk metadata.",
    "Only workflow-selection or coordination roles should use pi_workflow_list to select workflows; derive the active role from role instructions, recommend only its assigned workflows, and treat other-role workflows as context.",
    "Never let pi_workflow_list modify workflow assignments; only /workflows may change projects.json. Treat unavailable or missing markers diagnostically; on CATALOG_TOO_LARGE ask the user to reduce the project workflow list.",
  ],
  readMetadata: [
    "Use pi_workflow_read_metadata for a material detail missing from a listing; do not read every workflow one by one.",
    "Omitting project from pi_workflow_read_metadata reads the global workflow; supplying project adds an assignment-context check.",
  ],
  read: [
    "Use pi_workflow_read only after conversational approval or a direct read/use request; plan frontmatter is not approval.",
    "Omitting project from pi_workflow_read reads the global workflow; supplying project adds an assignment-context check.",
    "When recommending from pi_workflow_list metadata, make the first standalone item exactly: **1. Workflow approval:** Do you approve using `<workflow-id>`? Approval permits only required plan edits.",
  ],
} as const;

export const WorkflowListParameters = Type.Object({
  project: Type.Optional(
    Type.String({
      description:
        "Configured project ID from /workflows when the task belongs to that project; omit for the global workflow catalog. Do not infer it from a path or repository name.",
    }),
  ),
});

export const WorkflowReadMetadataParameters = Type.Object({
  workflow: Type.String({
    description: "Lowercase-kebab workflow filename stem.",
  }),
  project: Type.Optional(
    Type.String({
      description:
        "Optional configured project ID for assignment context; omit for global workflow work.",
    }),
  ),
});

export const WorkflowReadParameters = Type.Object({
  workflow: Type.String({
    description: "Lowercase-kebab workflow filename stem.",
  }),
  project: Type.Optional(
    Type.String({
      description:
        "Optional configured project ID for assignment context; omit for global workflow work.",
    }),
  ),
});

export interface WorkflowToolDetails {
  project?: string;
  workflow?: string;
}

type WorkflowListParams = { project?: string };
type WorkflowReadParams = { project?: string; workflow: string };
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

function renderSummary(
  toolName:
    | "pi_workflow_list"
    | "pi_workflow_read_metadata"
    | "pi_workflow_read",
  args: WorkflowListParams | WorkflowReadParams,
  isError: boolean,
): string {
  if (isError) return `${toolName} error`;
  if (toolName === "pi_workflow_list") {
    return args.project
      ? `List workflows for ${args.project}`
      : "List global workflows";
  }
  const workflow = "workflow" in args ? args.workflow : "workflow";
  return toolName === "pi_workflow_read_metadata"
    ? `Read metadata: ${workflow}`
    : `Read ${workflow}`;
}

function result(
  text: string,
  details: WorkflowToolDetails = {},
): WorkflowToolResult {
  return {
    content: [{ type: "text", text }],
    details,
  };
}

function ensureBounded(
  text: string,
  overflowCode: "CATALOG_TOO_LARGE" | "WORKFLOW_TOO_LARGE",
): void {
  if (Buffer.byteLength(text, "utf8") > MAX_RENDERED_RESULT_BYTES) {
    const message =
      overflowCode === "CATALOG_TOO_LARGE"
        ? "The complete workflow metadata result exceeds 48 KiB. Reduce the project workflow list with /workflows; do not inspect workflows one by one."
        : "The complete workflow result exceeds the 48 KiB output limit.";
    throw new WorkflowError(overflowCode, message);
  }
}

function requireArgument(
  value: string | undefined,
  name: "project" | "workflow",
): string {
  if (value === undefined || value.length === 0) {
    throw new WorkflowError(
      "INVALID_ARGUMENT",
      `${name} is required for this operation.`,
    );
  }
  return value;
}

const MAX_CONFIGURED_PROJECTS_BYTES = 1_200;
const GLOBAL_RECOVERY_HINT =
  "If this task is not tied to a known configured project, retry the operation without project to inspect the global workflow catalog.";

function configuredProjectIds(
  projects: Record<string, ProjectConfigV1>,
): string {
  const visible: string[] = [];
  const ids = Object.keys(projects).sort();
  let visibleBytes = 0;
  for (const id of ids) {
    const displayed = displayId(id);
    const addedBytes = Buffer.byteLength(
      `${visible.length === 0 ? "" : ", "}${displayed}`,
      "utf8",
    );
    if (visibleBytes + addedBytes > MAX_CONFIGURED_PROJECTS_BYTES) break;
    visible.push(displayed);
    visibleBytes += addedBytes;
  }
  if (visible.length === 0) return ids.length === 0 ? "(none)" : "(omitted)";
  const omitted = ids.length - visible.length;
  return `${visible.join(", ")}${omitted > 0 ? `, … (${omitted} more)` : ""}`;
}

function configuredProject(
  paths: WorkflowPaths,
  projectId: string,
): ProjectConfigV1 {
  const projects = loadProjectsFile(paths.projectsFile).value.projects;
  const available = configuredProjectIds(projects);
  if (!isValidId(projectId)) {
    throw new WorkflowError(
      "INVALID_ID",
      `Project must be a configured lowercase-kebab ID, not a filesystem path. Configured projects: ${available}. ${GLOBAL_RECOVERY_HINT}`,
    );
  }
  const project = projects[projectId];
  if (!project) {
    throw new WorkflowError(
      "PROJECT_NOT_FOUND",
      `Project ${JSON.stringify(projectId)} is not configured. Configured projects: ${available}. ${GLOBAL_RECOVERY_HINT}`,
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

function readableCatalog(
  paths: WorkflowPaths,
  includeIds?: readonly string[],
): ReturnType<typeof discoverWorkflowCatalog> {
  const catalog = discoverWorkflowCatalog(paths.workflowDir, includeIds);
  if (
    catalog.diagnostics.some(
      (diagnostic) =>
        diagnostic.code === "READ_FAILED" &&
        diagnostic.path === catalog.directory,
    )
  ) {
    throw new WorkflowError(
      "READ_FAILED",
      "Cannot inspect the workflow catalog.",
    );
  }
  return catalog;
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
  const catalog = readableCatalog(paths, workflowIds);
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
  const text = lines.join("\n");
  ensureBounded(text, "CATALOG_TOO_LARGE");
  return result(text, { project: projectId });
}

function listGlobal(paths: WorkflowPaths): WorkflowToolResult {
  const catalog = readableCatalog(paths);
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
  const text = lines.join("\n");
  ensureBounded(text, "CATALOG_TOO_LARGE");
  return result(text);
}

function projectAssignment(
  paths: WorkflowPaths,
  projectId: string | undefined,
  workflowId: string,
): string {
  if (projectId === undefined) {
    return "Project assignment: not checked because no project was supplied.";
  }
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
    readableCatalog(paths, [workflowId]),
    workflowId,
  );
  const text = `${assignment}\nSource: ${workflow.path}\nMetadata: ${JSON.stringify(workflow.metadata)}`;
  ensureBounded(text, "WORKFLOW_TOO_LARGE");
  return result(text, { project: projectId, workflow: workflowId });
}

function readWorkflow(
  workflowId: string,
  projectId: string | undefined,
  paths: WorkflowPaths,
): WorkflowToolResult {
  const assignment = projectAssignment(paths, projectId, workflowId);
  const workflow = requireWorkflow(
    readableCatalog(paths, [workflowId]),
    workflowId,
  );
  const text = `${assignment}\n\n${workflow.raw}`;
  ensureBounded(text, "WORKFLOW_TOO_LARGE");
  return result(text, { project: projectId, workflow: workflowId });
}

export function executeWorkflowList(
  params: WorkflowListParams,
  paths: WorkflowPaths,
): WorkflowToolResult {
  try {
    return params.project === undefined
      ? listGlobal(paths)
      : listProject(params.project, paths);
  } catch (error) {
    if (error instanceof WorkflowError) throw error;
    throw new WorkflowError("READ_FAILED", errorDetail(error), {
      cause: error,
    });
  }
}

export function executeWorkflowReadMetadata(
  params: WorkflowReadParams,
  paths: WorkflowPaths,
): WorkflowToolResult {
  try {
    return readMetadata(
      requireArgument(params.workflow, "workflow"),
      params.project,
      paths,
    );
  } catch (error) {
    if (error instanceof WorkflowError) throw error;
    throw new WorkflowError("READ_FAILED", errorDetail(error), {
      cause: error,
    });
  }
}

export function executeWorkflowRead(
  params: WorkflowReadParams,
  paths: WorkflowPaths,
): WorkflowToolResult {
  try {
    return readWorkflow(
      requireArgument(params.workflow, "workflow"),
      params.project,
      paths,
    );
  } catch (error) {
    if (error instanceof WorkflowError) throw error;
    throw new WorkflowError("READ_FAILED", errorDetail(error), {
      cause: error,
    });
  }
}

function toolError(error: WorkflowError): WorkflowError {
  const prefix = `${error.code}: `;
  const message = error.message.startsWith(prefix)
    ? error.message.slice(prefix.length)
    : error.message;
  return new WorkflowError(
    error.code,
    truncateUtf8(`${prefix}${message}`, MAX_RENDERED_RESULT_BYTES),
    { cause: error },
  );
}

function renderCall(
  toolName:
    | "pi_workflow_list"
    | "pi_workflow_read_metadata"
    | "pi_workflow_read",
  args: WorkflowListParams | WorkflowReadParams,
  theme: Parameters<NonNullable<ToolDefinition["renderCall"]>>[1],
  context: Parameters<NonNullable<ToolDefinition["renderCall"]>>[2],
): Text {
  const summary = `${theme.fg("toolTitle", theme.bold(toolName))} ${theme.fg(context.isError ? "error" : "accent", renderSummary(toolName, args, context.isError))}`;
  const hint = context.expanded
    ? ""
    : theme.fg("dim", ` (${keyText("app.tools.expand")} to expand)`);
  return new Text(`${summary}${hint}`, 0, 0);
}

function renderResult(
  result: WorkflowToolResult,
  options: Parameters<NonNullable<ToolDefinition["renderResult"]>>[1],
  theme: Parameters<NonNullable<ToolDefinition["renderResult"]>>[2],
  context: Parameters<NonNullable<ToolDefinition["renderResult"]>>[3],
): Text {
  if (!options.expanded && !context.isError) return new Text("", 0, 0);
  const content = result.content[0];
  const body = content && content.type === "text" ? content.text : "";
  return new Text(
    `\n${theme.fg(context.isError ? "error" : "toolOutput", body)}`,
    0,
    0,
  );
}

function executeTool<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof WorkflowError) throw toolError(error);
    throw toolError(
      new WorkflowError("READ_FAILED", errorDetail(error), {
        cause: error,
      }),
    );
  }
}

export function createWorkflowListTool(
  pathsProvider: () => WorkflowPaths = productionWorkflowPaths,
): ToolDefinition<typeof WorkflowListParameters, WorkflowToolDetails> {
  return {
    name: "pi_workflow_list",
    label: "Pi Workflow List",
    description:
      "List project workflow metadata when project is supplied, or the global workflow catalog when it is omitted. Results are limited to 48 KiB.",
    promptSnippet: WORKFLOW_PROMPT_SNIPPETS.list,
    promptGuidelines: [...WORKFLOW_PROMPT_GUIDELINES.list],
    parameters: WorkflowListParameters,
    async execute(_toolCallId, params) {
      return executeTool(() => executeWorkflowList(params, pathsProvider()));
    },
    renderCall(args, theme, context) {
      return renderCall("pi_workflow_list", args, theme, context);
    },
    renderResult(result, options, theme, context) {
      return renderResult(result, options, theme, context);
    },
  };
}

export function createWorkflowReadMetadataTool(
  pathsProvider: () => WorkflowPaths = productionWorkflowPaths,
): ToolDefinition<typeof WorkflowReadMetadataParameters, WorkflowToolDetails> {
  return {
    name: "pi_workflow_read_metadata",
    label: "Pi Workflow Metadata",
    description:
      "Read one workflow's metadata with optional project assignment context. Results are limited to 48 KiB.",
    promptSnippet: WORKFLOW_PROMPT_SNIPPETS.readMetadata,
    promptGuidelines: [...WORKFLOW_PROMPT_GUIDELINES.readMetadata],
    parameters: WorkflowReadMetadataParameters,
    async execute(_toolCallId, params) {
      return executeTool(() =>
        executeWorkflowReadMetadata(params, pathsProvider()),
      );
    },
    renderCall(args, theme, context) {
      return renderCall("pi_workflow_read_metadata", args, theme, context);
    },
    renderResult(result, options, theme, context) {
      return renderResult(result, options, theme, context);
    },
  };
}

export function createWorkflowReadTool(
  pathsProvider: () => WorkflowPaths = productionWorkflowPaths,
): ToolDefinition<typeof WorkflowReadParameters, WorkflowToolDetails> {
  return {
    name: "pi_workflow_read",
    label: "Pi Workflow Read",
    description:
      "Read one approved workflow's complete Markdown with optional project assignment context. Results are limited to 48 KiB.",
    promptSnippet: WORKFLOW_PROMPT_SNIPPETS.read,
    promptGuidelines: [...WORKFLOW_PROMPT_GUIDELINES.read],
    parameters: WorkflowReadParameters,
    async execute(_toolCallId, params) {
      return executeTool(() => executeWorkflowRead(params, pathsProvider()));
    },
    renderCall(args, theme, context) {
      return renderCall("pi_workflow_read", args, theme, context);
    },
    renderResult(result, options, theme, context) {
      return renderResult(result, options, theme, context);
    },
  };
}

export function registerWorkflowTools(
  pi: Pick<ExtensionAPI, "registerTool">,
  pathsProvider: () => WorkflowPaths = productionWorkflowPaths,
): void {
  pi.registerTool(createWorkflowListTool(pathsProvider));
  pi.registerTool(createWorkflowReadMetadataTool(pathsProvider));
  pi.registerTool(createWorkflowReadTool(pathsProvider));
}
