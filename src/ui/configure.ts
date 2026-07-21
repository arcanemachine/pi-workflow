import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { SelectItem } from "@earendil-works/pi-tui";
import { discoverWorkflowCatalog } from "../catalog.js";
import { isValidId, suggestId } from "../ids.js";
import type { WorkflowPaths } from "../paths.js";
import { loadProjectsFile, saveProjectsFile } from "../projects.js";
import { discoverGlobalRoleFilenames } from "../roles.js";
import type { Diagnostic, ProjectsFileV1 } from "../types.js";
import {
  showSelection,
  showWorkflowToggles,
  type WorkflowToggleItem,
} from "./components.js";

const ADD_PROJECT = "__add-project__";
const ADD_ROLE = "__add-role__";

export interface WorkflowConfiguratorUI {
  select(title: string, items: SelectItem[]): Promise<string | null>;
  input(title: string, placeholder?: string): Promise<string | undefined>;
  toggles(title: string, workflows: WorkflowToggleItem[]): Promise<Set<string>>;
  confirm(title: string, message: string): Promise<boolean>;
  notify(message: string, type?: "info" | "warning" | "error"): void;
}

export function createWorkflowConfiguratorUI(
  ctx: ExtensionCommandContext,
): WorkflowConfiguratorUI {
  return {
    select: (title, items) => showSelection(ctx, title, items),
    input: (title, placeholder) => ctx.ui.input(title, placeholder),
    toggles: (title, workflows) => showWorkflowToggles(ctx, title, workflows),
    confirm: (title, message) => ctx.ui.confirm(title, message),
    notify: (message, type) => ctx.ui.notify(message, type),
  };
}

async function chooseProject(
  ui: WorkflowConfiguratorUI,
  ctx: ExtensionCommandContext,
  config: ProjectsFileV1,
): Promise<string | null> {
  const projectIds = Object.keys(config.projects).sort();
  const selection = await ui.select("Select project", [
    ...projectIds.map((id) => ({ value: id, label: id })),
    {
      value: ADD_PROJECT,
      label: "Add project…",
      description: "Create a project workflow list without storing a path",
    },
  ]);
  if (selection === null || selection !== ADD_PROJECT) return selection;

  const suggestion = suggestId(
    ctx.cwd.split(/[\\/]/).filter(Boolean).pop() ?? "",
  );
  while (true) {
    const entered = await ui.input(
      "New project ID",
      suggestion || "project-id",
    );
    if (entered === undefined) return null;
    if (!isValidId(entered)) {
      ui.notify("Project ID must be lowercase kebab-case.", "error");
      continue;
    }
    if (config.projects[entered]) {
      ui.notify(`Project ${entered} already exists.`, "error");
      continue;
    }
    return entered;
  }
}

async function chooseRole(
  ui: WorkflowConfiguratorUI,
  projectId: string,
  configuredRoleIds: string[],
  globalRoleIds: string[],
): Promise<string | null> {
  const available = new Set(globalRoleIds);
  const items = new Map<string, SelectItem>();
  for (const roleId of configuredRoleIds) {
    items.set(roleId, {
      value: roleId,
      label: `${roleId}${available.has(roleId) ? "" : " [unavailable]"}`,
      description: available.has(roleId)
        ? "Configured managing role"
        : "Configured role filename is absent globally; this does not block configuration",
    });
  }
  for (const roleId of globalRoleIds) {
    if (!items.has(roleId)) {
      items.set(roleId, {
        value: roleId,
        label: roleId,
        description: "Globally present role filename (not yet configured)",
      });
    }
  }

  const selection = await ui.select(`Select managing role for ${projectId}`, [
    ...[...items.values()].sort((left, right) =>
      left.value.localeCompare(right.value),
    ),
    {
      value: ADD_ROLE,
      label: "Add role ID…",
      description: "Enter a role ID without claiming that the role exists",
    },
  ]);
  if (selection === null || selection !== ADD_ROLE) return selection;

  while (true) {
    const entered = await ui.input("Managing role ID", "role-id");
    if (entered === undefined) return null;
    if (!isValidId(entered)) {
      ui.notify("Role ID must be lowercase kebab-case.", "error");
      continue;
    }
    return entered;
  }
}

function cloneProjectsFile(config: ProjectsFileV1): ProjectsFileV1 {
  return JSON.parse(JSON.stringify(config)) as ProjectsFileV1;
}

function workflowToggleItems(
  paths: WorkflowPaths,
  configuredIds: readonly string[],
): { items: WorkflowToggleItem[]; diagnostics: Diagnostic[] } {
  const configured = new Set(configuredIds);
  const catalog = discoverWorkflowCatalog(paths.workflowDir);
  const items = new Map<string, WorkflowToggleItem>();
  for (const entry of catalog.entries) {
    if (entry.workflow) {
      items.set(entry.id, {
        id: entry.id,
        label: `${entry.id} — ${entry.workflow.metadata.title}`,
        description: entry.workflow.metadata.summary,
        enabled: configured.has(entry.id),
      });
    } else if (configured.has(entry.id)) {
      items.set(entry.id, {
        id: entry.id,
        label: `${entry.id} [invalid]`,
        description: entry.diagnostics.map((item) => item.message).join("; "),
        enabled: true,
      });
    }
  }
  for (const workflowId of configured) {
    if (!items.has(workflowId)) {
      items.set(workflowId, {
        id: workflowId,
        label: `${workflowId} [missing]`,
        description:
          "Configured workflow file is absent; turn it off to remove the reference",
        enabled: true,
      });
    }
  }
  return {
    items: [...items.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    diagnostics: catalog.diagnostics,
  };
}

export async function configureProjectWorkflows(
  ctx: ExtensionCommandContext,
  paths: WorkflowPaths,
  ui: WorkflowConfiguratorUI = createWorkflowConfiguratorUI(ctx),
): Promise<void> {
  const loaded = loadProjectsFile(paths.projectsFile);
  const roleDiscovery = discoverGlobalRoleFilenames(paths.rolesDir);
  for (const issue of roleDiscovery.diagnostics) {
    ui.notify(`${issue.code}: ${issue.message}`, "warning");
  }

  const staged = cloneProjectsFile(loaded.value);
  const projectId = await chooseProject(ui, ctx, staged);
  if (projectId === null) return;
  const isNewProject = staged.projects[projectId] === undefined;
  if (isNewProject) staged.projects[projectId] = { roles: {} };

  const roleId = await chooseRole(
    ui,
    projectId,
    Object.keys(staged.projects[projectId].roles),
    roleDiscovery.roleIds,
  );
  if (roleId === null) return;

  const before = [...(staged.projects[projectId].roles[roleId] ?? [])].sort();
  const workflows = workflowToggleItems(paths, before);
  for (const issue of workflows.diagnostics) {
    ui.notify(`${issue.code}: ${issue.message}`, "warning");
  }
  const selected = await ui.toggles(
    `Workflows for ${projectId} / ${roleId}`,
    workflows.items,
  );
  const after = [...selected].sort();

  if (after.length === 0) delete staged.projects[projectId].roles[roleId];
  else staged.projects[projectId].roles[roleId] = after;

  const beforeText = before.length === 0 ? "(none)" : before.join(", ");
  const afterText = after.length === 0 ? "(none)" : after.join(", ");
  const changed = isNewProject || beforeText !== afterText;
  if (!changed) {
    ui.notify("No workflow assignment changes to save.", "info");
    return;
  }

  const confirmed = await ui.confirm(
    "Save project workflow list?",
    `Project: ${projectId}\nRole: ${roleId}\nBefore: ${beforeText}\nAfter: ${afterText}`,
  );
  if (!confirmed) return;

  saveProjectsFile(paths.projectsFile, staged, loaded.originalContent);
  ui.notify(`Saved ${projectId} / ${roleId}: ${afterText}`, "info");
}
