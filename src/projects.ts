import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { WorkflowError, errorDetail } from "./errors.js";
import { isValidId } from "./ids.js";
import type {
  LoadedProjectsFile,
  ProjectConfigV1,
  ProjectsFileV1,
} from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactlyKeys(
  value: Record<string, unknown>,
  keys: string[],
): boolean {
  const actual = Object.keys(value).sort();
  return (
    actual.length === keys.length &&
    actual.every((key, i) => key === [...keys].sort()[i])
  );
}

function invalid(message: string): never {
  throw new WorkflowError("INVALID_PROJECTS_FILE", message);
}

export function emptyProjectsFile(): ProjectsFileV1 {
  return { version: 1, projects: {} };
}

export function parseProjectsFile(content: string): ProjectsFileV1 {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch (error) {
    throw new WorkflowError(
      "INVALID_PROJECTS_FILE",
      `projects.json is not valid JSON: ${errorDetail(error)}`,
      { cause: error },
    );
  }

  if (!isRecord(raw)) invalid("projects.json root must be an object.");
  if (raw.version !== 1) {
    if (typeof raw.version === "number" && raw.version > 1) {
      throw new WorkflowError(
        "UNSUPPORTED_PROJECTS_VERSION",
        `projects.json version ${raw.version} is newer than supported version 1.`,
      );
    }
    invalid('projects.json "version" must equal 1.');
  }
  if (!hasExactlyKeys(raw, ["projects", "version"])) {
    invalid(
      'projects.json root must contain exactly "version" and "projects".',
    );
  }
  if (!isRecord(raw.projects))
    invalid('projects.json "projects" must be an object.');

  const projects: Record<string, ProjectConfigV1> = {};
  for (const [projectId, projectValue] of Object.entries(raw.projects)) {
    if (!isValidId(projectId))
      invalid(`Invalid project ID ${JSON.stringify(projectId)}.`);
    if (!isRecord(projectValue) || !hasExactlyKeys(projectValue, ["roles"])) {
      invalid(
        `Project ${JSON.stringify(projectId)} must contain exactly "roles".`,
      );
    }
    if (!isRecord(projectValue.roles)) {
      invalid(`Project ${JSON.stringify(projectId)} roles must be an object.`);
    }

    const roles: Record<string, string[]> = {};
    for (const [roleId, workflows] of Object.entries(projectValue.roles)) {
      if (!isValidId(roleId))
        invalid(`Invalid role ID ${JSON.stringify(roleId)}.`);
      if (!Array.isArray(workflows)) {
        invalid(
          `Workflows for role ${JSON.stringify(roleId)} must be an array.`,
        );
      }
      const ids: string[] = [];
      for (const workflowId of workflows) {
        if (typeof workflowId !== "string" || !isValidId(workflowId)) {
          invalid(
            `Role ${JSON.stringify(roleId)} contains an invalid workflow ID.`,
          );
        }
        ids.push(workflowId);
      }
      if (new Set(ids).size !== ids.length) {
        invalid(
          `Role ${JSON.stringify(roleId)} contains duplicate workflow IDs.`,
        );
      }
      roles[roleId] = ids;
    }
    projects[projectId] = { roles };
  }
  return { version: 1, projects };
}

export function normalizeProjectsFile(value: ProjectsFileV1): ProjectsFileV1 {
  const projects: Record<string, ProjectConfigV1> = {};
  for (const projectId of Object.keys(value.projects).sort()) {
    const roles: Record<string, string[]> = {};
    for (const roleId of Object.keys(value.projects[projectId].roles).sort()) {
      const workflowIds = [
        ...new Set(value.projects[projectId].roles[roleId]),
      ].sort();
      // A role with no assigned workflows still persists; it is removed only
      // through the /workflows delete action, not by normalization.
      roles[roleId] = workflowIds;
    }
    projects[projectId] = { roles };
  }
  return { version: 1, projects };
}

export function serializeProjectsFile(value: ProjectsFileV1): string {
  const normalized = normalizeProjectsFile(value);
  parseProjectsFile(JSON.stringify(normalized));
  return `${JSON.stringify(normalized, null, 2)}\n`;
}

export function loadProjectsFile(path: string): LoadedProjectsFile {
  if (!existsSync(path)) {
    return { value: emptyProjectsFile(), originalContent: null, path };
  }

  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch (error) {
    throw new WorkflowError(
      "READ_FAILED",
      `Cannot read ${path}: ${errorDetail(error)}`,
      { cause: error },
    );
  }
  return { value: parseProjectsFile(content), originalContent: content, path };
}

function currentContent(path: string): string | null {
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    throw new WorkflowError(
      "READ_FAILED",
      `Cannot re-read ${path}: ${errorDetail(error)}`,
      { cause: error },
    );
  }
}

export function saveProjectsFile(
  path: string,
  value: ProjectsFileV1,
  expectedContent: string | null,
): void {
  if (currentContent(path) !== expectedContent) {
    throw new WorkflowError(
      "CONFIG_CHANGED",
      `${path} changed after it was opened; reopen /workflows and try again.`,
    );
  }

  const directory = dirname(path);
  const temporaryPath = join(
    directory,
    `.${basename(path)}.tmp-${randomUUID()}`,
  );
  try {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    writeFileSync(temporaryPath, serializeProjectsFile(value), {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    renameSync(temporaryPath, path);
  } catch (error) {
    try {
      rmSync(temporaryPath, { force: true });
    } catch {
      // Preserve the original write failure.
    }
    if (error instanceof WorkflowError) throw error;
    throw new WorkflowError(
      "WRITE_FAILED",
      `Cannot write ${path}: ${errorDetail(error)}`,
      { cause: error },
    );
  }
}
