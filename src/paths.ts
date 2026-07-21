import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { isAbsolute, join, resolve } from "node:path";
import { WorkflowError } from "./errors.js";

export interface WorkflowPathsOptions {
  agentDir?: string;
  workflowDir?: string;
  env?: NodeJS.ProcessEnv;
}

export interface WorkflowPaths {
  agentDir: string;
  workflowDir: string;
  projectsFile: string;
  rolesDir: string;
}

export function resolveWorkflowPaths(
  options: WorkflowPathsOptions = {},
): WorkflowPaths {
  const agentDir = resolve(options.agentDir ?? getAgentDir());
  const override = options.workflowDir ?? options.env?.PI_WORKFLOW_DIR;
  if (override !== undefined && !isAbsolute(override)) {
    throw new WorkflowError(
      "INVALID_ARGUMENT",
      "PI_WORKFLOW_DIR must be an absolute path.",
    );
  }

  const workflowDir = resolve(override ?? join(agentDir, "workflows"));
  return {
    agentDir,
    workflowDir,
    projectsFile: join(workflowDir, "projects.json"),
    rolesDir: join(agentDir, "roles"),
  };
}

export function productionWorkflowPaths(): WorkflowPaths {
  return resolveWorkflowPaths({ env: process.env });
}
