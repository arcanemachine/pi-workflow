import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { WorkflowError, errorDetail } from "./errors.js";
import { isValidId, requireValidId } from "./ids.js";
import { parseWorkflowContent } from "./metadata.js";
import type {
  CatalogEntry,
  Diagnostic,
  WorkflowCatalog,
  WorkflowDefinition,
} from "./types.js";

export const MAX_WORKFLOW_BYTES = 32 * 1024;
export const MAX_RENDERED_RESULT_BYTES = 48 * 1024;

function diagnostic(
  code: Diagnostic["code"],
  message: string,
  path?: string,
): Diagnostic {
  return { code, message, ...(path === undefined ? {} : { path }) };
}

function workflowIdFromFilename(filename: string): string {
  return basename(filename, ".md");
}

function candidateNames(directory: string): {
  names: string[];
  diagnostics: Diagnostic[];
} {
  if (!existsSync(directory)) return { names: [], diagnostics: [] };

  try {
    if (!statSync(directory).isDirectory()) {
      return {
        names: [],
        diagnostics: [
          diagnostic(
            "READ_FAILED",
            "Configured workflow catalog path is not a directory.",
            directory,
          ),
        ],
      };
    }
  } catch (error) {
    return {
      names: [],
      diagnostics: [
        diagnostic(
          "READ_FAILED",
          `Cannot inspect workflow catalog: ${errorDetail(error)}`,
          directory,
        ),
      ],
    };
  }

  try {
    const names: string[] = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || !entry.name.endsWith(".md")) continue;
      if (entry.isFile()) {
        names.push(entry.name);
        continue;
      }
      if (entry.isSymbolicLink()) {
        try {
          if (statSync(join(directory, entry.name)).isDirectory()) continue;
        } catch {
          // Retain broken links so discovery reports the read failure.
        }
        names.push(entry.name);
      }
    }
    return { names: names.sort((a, b) => a.localeCompare(b)), diagnostics: [] };
  } catch (error) {
    return {
      names: [],
      diagnostics: [
        diagnostic(
          "READ_FAILED",
          `Cannot list workflow catalog: ${errorDetail(error)}`,
          directory,
        ),
      ],
    };
  }
}

function discoverEntry(
  directory: string,
  filename: string,
  collidingIds: ReadonlySet<string>,
): CatalogEntry {
  const id = workflowIdFromFilename(filename);
  const path = join(directory, filename);
  const diagnostics: Diagnostic[] = [];

  if (!isValidId(id)) {
    diagnostics.push(
      diagnostic(
        "INVALID_WORKFLOW",
        `Workflow filename stem ${JSON.stringify(id)} must be lowercase kebab-case.`,
        path,
      ),
    );
  }
  if (collidingIds.has(id.toLowerCase())) {
    diagnostics.push(
      diagnostic(
        "INVALID_WORKFLOW",
        `Workflow filename collides case-insensitively for ID ${JSON.stringify(id.toLowerCase())}.`,
        path,
      ),
    );
  }

  let buffer: Buffer;
  try {
    buffer = readFileSync(path);
  } catch (error) {
    diagnostics.push(
      diagnostic(
        "READ_FAILED",
        `Cannot read workflow: ${errorDetail(error)}`,
        path,
      ),
    );
    return { id, path, diagnostics };
  }

  if (buffer.byteLength > MAX_WORKFLOW_BYTES) {
    diagnostics.push(
      diagnostic(
        "WORKFLOW_TOO_LARGE",
        `Workflow is ${buffer.byteLength} bytes; maximum is ${MAX_WORKFLOW_BYTES}.`,
        path,
      ),
    );
    return { id, path, diagnostics };
  }
  if (diagnostics.length > 0) return { id, path, diagnostics };

  const raw = buffer.toString("utf8");
  try {
    const parsed = parseWorkflowContent(raw);
    const workflow: WorkflowDefinition = {
      id,
      path,
      metadata: parsed.metadata,
      body: parsed.body,
      raw,
    };
    return { id, path, workflow, diagnostics: [] };
  } catch (error) {
    const typed =
      error instanceof WorkflowError
        ? error
        : new WorkflowError("INVALID_WORKFLOW", errorDetail(error), {
            cause: error,
          });
    diagnostics.push(diagnostic(typed.code, typed.message, path));
    return { id, path, diagnostics };
  }
}

export function discoverWorkflowCatalog(
  directory: string,
  includeIds?: readonly string[],
): WorkflowCatalog {
  const candidates = candidateNames(directory);
  const byNormalizedId = new Map<string, string[]>();
  for (const filename of candidates.names) {
    const id = workflowIdFromFilename(filename).toLowerCase();
    const names = byNormalizedId.get(id) ?? [];
    names.push(filename);
    byNormalizedId.set(id, names);
  }
  const collisions = new Set(
    [...byNormalizedId.entries()]
      .filter(([, names]) => names.length > 1)
      .map(([id]) => id),
  );

  const included = includeIds === undefined ? undefined : new Set(includeIds);
  const entries = candidates.names
    .filter(
      (filename) =>
        included === undefined || included.has(workflowIdFromFilename(filename)),
    )
    .map((filename) => discoverEntry(directory, filename, collisions))
    .sort((left, right) => left.id.localeCompare(right.id));
  return {
    directory,
    entries,
    diagnostics: [
      ...candidates.diagnostics,
      ...entries.flatMap((entry) => entry.diagnostics),
    ],
  };
}

export function findCatalogEntry(
  catalog: WorkflowCatalog,
  workflowId: string,
): CatalogEntry | undefined {
  requireValidId(workflowId, "Workflow ID");
  return catalog.entries.find((entry) => entry.id === workflowId);
}

export function requireWorkflow(
  catalog: WorkflowCatalog,
  workflowId: string,
): WorkflowDefinition {
  const entry = findCatalogEntry(catalog, workflowId);
  if (!entry) {
    throw new WorkflowError(
      "WORKFLOW_NOT_FOUND",
      `Workflow ${JSON.stringify(workflowId)} was not found.`,
    );
  }
  const exactFailure = entry.diagnostics.find(
    (item) =>
      item.code === "WORKFLOW_TOO_LARGE" || item.code === "READ_FAILED",
  );
  if (exactFailure) {
    throw new WorkflowError(exactFailure.code, exactFailure.message);
  }
  if (!entry.workflow) {
    throw new WorkflowError(
      "INVALID_WORKFLOW",
      entry.diagnostics.map((item) => item.message).join("; ") ||
        `Workflow ${JSON.stringify(workflowId)} is invalid.`,
    );
  }
  return entry.workflow;
}
