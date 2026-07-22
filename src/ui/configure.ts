import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { SelectItem } from "@earendil-works/pi-tui";
import { discoverWorkflowCatalog } from "../catalog.js";
import { isValidId, suggestId } from "../ids.js";
import type { WorkflowPaths } from "../paths.js";
import {
  loadProjectsFile,
  saveProjectsFile,
  serializeProjectsFile,
} from "../projects.js";
import { discoverGlobalRoleFilenames } from "../roles.js";
import type { Diagnostic, ProjectsFileV1 } from "../types.js";
import {
  showHotkeySelection,
  showNoDefaultConfirm,
  showSelection,
  showTextInput,
  showWorkflowToggles,
  type HotkeyResult,
  type WorkflowToggleItem,
} from "./components.js";

const EXIT_SAVE = "save";
const EXIT_DISCARD = "discard";

export interface WorkflowConfiguratorUI {
  select(
    title: string,
    items: SelectItem[],
    cancelLabel?: string,
  ): Promise<string | null>;
  hotkeySelect(
    title: string,
    items: SelectItem[],
    cancelLabel?: string,
  ): Promise<HotkeyResult>;
  textInput(
    title: string,
    initial: string,
    placeholder?: string,
  ): Promise<string | null>;
  noDefaultConfirm(title: string, message: string): Promise<boolean>;
  toggles(title: string, workflows: WorkflowToggleItem[]): Promise<Set<string>>;
  notify(message: string, type?: "info" | "warning" | "error"): void;
}

export function createWorkflowConfiguratorUI(
  ctx: ExtensionCommandContext,
): WorkflowConfiguratorUI {
  return {
    select: (title, items, cancelLabel) =>
      showSelection(ctx, title, items, cancelLabel),
    hotkeySelect: (title, items, cancelLabel) =>
      showHotkeySelection(ctx, title, items, cancelLabel),
    textInput: (title, initial, placeholder) =>
      showTextInput(ctx, title, initial, placeholder),
    noDefaultConfirm: (title, message) =>
      showNoDefaultConfirm(ctx, title, message),
    toggles: (title, workflows) => showWorkflowToggles(ctx, title, workflows),
    notify: (message, type) => ctx.ui.notify(message, type),
  };
}

async function createProject(
  ui: WorkflowConfiguratorUI,
  ctx: ExtensionCommandContext,
  config: ProjectsFileV1,
): Promise<void> {
  const suggestion = suggestId(
    ctx.cwd.split(/[\\/]/).filter(Boolean).pop() ?? "",
  );
  while (true) {
    const entered = await ui.textInput(
      "Create project",
      "",
      suggestion || "project-id",
    );
    if (entered === null) return;
    if (!isValidId(entered)) {
      ui.notify("Project ID must be lowercase kebab-case.", "error");
      continue;
    }
    if (config.projects[entered]) {
      ui.notify(`Project ${entered} already exists.`, "error");
      continue;
    }
    config.projects[entered] = { roles: {} };
    ui.notify(`Created project ${entered}.`, "info");
    return;
  }
}

async function renameProject(
  ui: WorkflowConfiguratorUI,
  config: ProjectsFileV1,
  oldId: string,
): Promise<void> {
  while (true) {
    const entered = await ui.textInput(
      "Rename project",
      oldId,
      "new project id",
    );
    if (entered === null || entered === oldId) return;
    if (!isValidId(entered)) {
      ui.notify("Project ID must be lowercase kebab-case.", "error");
      continue;
    }
    if (config.projects[entered]) {
      ui.notify(`Project ${entered} already exists.`, "error");
      continue;
    }
    config.projects[entered] = config.projects[oldId];
    delete config.projects[oldId];
    ui.notify(`Renamed project ${oldId} → ${entered}.`, "info");
    return;
  }
}

async function deleteProject(
  ui: WorkflowConfiguratorUI,
  config: ProjectsFileV1,
  id: string,
): Promise<void> {
  const confirmed = await ui.noDefaultConfirm(
    "Delete project",
    `Delete project ${id} and all its workflow assignments?`,
  );
  if (!confirmed) return;
  delete config.projects[id];
  ui.notify(`Deleted project ${id}.`, "info");
}

async function chooseProject(
  ui: WorkflowConfiguratorUI,
  ctx: ExtensionCommandContext,
  config: ProjectsFileV1,
): Promise<string | null> {
  while (true) {
    const projectIds = Object.keys(config.projects).sort();
    const items: SelectItem[] = projectIds.map((id) => ({
      value: id,
      label: id,
    }));
    const result = await ui.hotkeySelect("Select project", items, "exit");
    if (result.kind === "cancel") return null;
    if (result.kind === "select") return result.value;
    if (result.kind === "create") {
      await createProject(ui, ctx, config);
      continue;
    }
    if (result.kind === "rename") {
      await renameProject(ui, config, result.value);
      continue;
    }
    if (result.kind === "delete") {
      await deleteProject(ui, config, result.value);
      continue;
    }
  }
}

async function createRole(
  ui: WorkflowConfiguratorUI,
  projectId: string,
  config: ProjectsFileV1,
  configuredRoleIds: Set<string>,
): Promise<void> {
  while (true) {
    const entered = await ui.textInput("Create role", "", "role-id");
    if (entered === null) return;
    if (!isValidId(entered)) {
      ui.notify("Role ID must be lowercase kebab-case.", "error");
      continue;
    }
    if (configuredRoleIds.has(entered)) {
      ui.notify(`Role ${entered} already exists.`, "error");
      continue;
    }
    config.projects[projectId].roles[entered] = [];
    ui.notify(`Created role ${entered}.`, "info");
    return;
  }
}

async function renameRole(
  ui: WorkflowConfiguratorUI,
  projectId: string,
  config: ProjectsFileV1,
  oldId: string,
  configuredRoleIds: Set<string>,
): Promise<void> {
  while (true) {
    const entered = await ui.textInput("Rename role", oldId, "new role id");
    if (entered === null || entered === oldId) return;
    if (!isValidId(entered)) {
      ui.notify("Role ID must be lowercase kebab-case.", "error");
      continue;
    }
    if (configuredRoleIds.has(entered)) {
      ui.notify(`Role ${entered} already exists.`, "error");
      continue;
    }
    const workflows = config.projects[projectId].roles[oldId];
    config.projects[projectId].roles[entered] = workflows;
    delete config.projects[projectId].roles[oldId];
    ui.notify(`Renamed role ${oldId} → ${entered}.`, "info");
    return;
  }
}

async function deleteRole(
  ui: WorkflowConfiguratorUI,
  projectId: string,
  config: ProjectsFileV1,
  id: string,
): Promise<void> {
  const confirmed = await ui.noDefaultConfirm(
    "Delete role",
    `Delete role ${id} and its workflow assignments?`,
  );
  if (!confirmed) return;
  delete config.projects[projectId].roles[id];
  ui.notify(`Deleted role ${id}.`, "info");
}

async function chooseRole(
  ui: WorkflowConfiguratorUI,
  projectId: string,
  config: ProjectsFileV1,
  globalRoleIds: Set<string>,
): Promise<string | null> {
  while (true) {
    const available = globalRoleIds;
    const configuredRoleIds = Object.keys(
      config.projects[projectId].roles,
    ).sort();
    const items: SelectItem[] = configuredRoleIds.map((id) => ({
      value: id,
      label: available.has(id) ? id : `${id} [unavailable]`,
      description: available.has(id)
        ? "Configured role"
        : "Configured role filename is absent globally; this does not block configuration",
    }));
    const configuredSet = new Set(configuredRoleIds);
    const result = await ui.hotkeySelect(
      `Select role for ${projectId}`,
      items,
      "back",
    );
    if (result.kind === "cancel") return null;
    if (result.kind === "select") return result.value;
    if (result.kind === "create") {
      await createRole(ui, projectId, config, configuredSet);
      continue;
    }
    if (result.kind === "rename") {
      await renameRole(ui, projectId, config, result.value, configuredSet);
      continue;
    }
    if (result.kind === "delete") {
      await deleteRole(ui, projectId, config, result.value);
      continue;
    }
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

function hasChanges(original: ProjectsFileV1, staged: ProjectsFileV1): boolean {
  return serializeProjectsFile(original) !== serializeProjectsFile(staged);
}

function assignmentText(ids: readonly string[]): string {
  return ids.length === 0 ? "(none)" : [...ids].sort().join(", ");
}

function changeSummary(
  original: ProjectsFileV1,
  staged: ProjectsFileV1,
): string[] {
  const lines: string[] = [];
  const projectIds = new Set([
    ...Object.keys(original.projects),
    ...Object.keys(staged.projects),
  ]);
  for (const projectId of [...projectIds].sort()) {
    const originalProject = original.projects[projectId];
    const stagedProject = staged.projects[projectId];
    if (!originalProject && stagedProject) {
      lines.push(`Project ${projectId}: new`);
    }
    const roleIds = new Set([
      ...Object.keys(originalProject?.roles ?? {}),
      ...Object.keys(stagedProject?.roles ?? {}),
    ]);
    for (const roleId of [...roleIds].sort()) {
      const before = originalProject?.roles[roleId] ?? [];
      const after = stagedProject?.roles[roleId] ?? [];
      if (assignmentText(before) !== assignmentText(after)) {
        lines.push(
          `${projectId} / ${roleId}: ${assignmentText(before)} → ${assignmentText(after)}`,
        );
      }
    }
  }
  return lines;
}

async function confirmExitWithStagedChanges(
  ui: WorkflowConfiguratorUI,
  paths: WorkflowPaths,
  original: ProjectsFileV1,
  originalContent: string | null,
  staged: ProjectsFileV1,
): Promise<"save" | "discard" | "back"> {
  const changes = changeSummary(original, staged);
  const selection = await ui.select(
    "Save staged workflow-list changes before exiting?",
    [
      {
        value: EXIT_SAVE,
        label: "Yes, save and exit",
        description: "Save all staged workflow-list changes, then exit",
      },
      {
        value: EXIT_DISCARD,
        label: "No, discard and exit",
        description: `Discard ${changes.length} staged change(s) and exit without saving`,
      },
    ],
    "back",
  );
  if (selection === null) return "back";
  if (selection === EXIT_DISCARD) return "discard";

  saveProjectsFile(paths.projectsFile, staged, originalContent);
  ui.notify(`Saved ${changes.length} staged change(s).`, "info");
  return "save";
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
  const globalRoleIds = new Set(roleDiscovery.roleIds);

  const staged = cloneProjectsFile(loaded.value);
  while (true) {
    const projectId = await chooseProject(ui, ctx, staged);
    if (projectId === null) {
      if (!hasChanges(loaded.value, staged)) return;
      const decision = await confirmExitWithStagedChanges(
        ui,
        paths,
        loaded.value,
        loaded.originalContent,
        staged,
      );
      if (decision === "back") continue;
      if (decision === "discard")
        ui.notify("Discarded staged workflow-list changes.", "info");
      return;
    }
    if (!staged.projects[projectId]) staged.projects[projectId] = { roles: {} };

    while (true) {
      const roleId = await chooseRole(ui, projectId, staged, globalRoleIds);
      if (roleId === null) break;

      const before = [
        ...(staged.projects[projectId].roles[roleId] ?? []),
      ].sort();
      const workflows = workflowToggleItems(paths, before);
      for (const issue of workflows.diagnostics) {
        ui.notify(`${issue.code}: ${issue.message}`, "warning");
      }
      const selected = await ui.toggles(
        `Workflows for ${projectId} / ${roleId}`,
        workflows.items,
      );
      const after = [...selected].sort();

      // A role persists once created; only the d-key delete removes it.
      // Keeping the empty list (rather than pruning) means a freshly created
      // role is not silently dropped when you back out of its toggle list
      // without assigning workflows yet.
      staged.projects[projectId].roles[roleId] = after;
    }
  }
}
