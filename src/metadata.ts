import { parseFrontmatter } from "@earendil-works/pi-coding-agent";
import { WorkflowError, errorDetail } from "./errors.js";
import { isValidId } from "./ids.js";
import type { WorkflowMetadataV1, WorkflowRouteV1 } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(
  value: unknown,
  field: string,
  issues: string[],
): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(`${field} must be a non-empty string`);
    return undefined;
  }
  return value.trim();
}

function nonEmptyStringArray(
  value: unknown,
  field: string,
  issues: string[],
): string[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push(`${field} must be a non-empty array`);
    return undefined;
  }

  const result: string[] = [];
  for (const [index, entry] of value.entries()) {
    const parsed = nonEmptyString(entry, `${field}[${index}]`, issues);
    if (parsed !== undefined) result.push(parsed);
  }
  return result.length === value.length ? result : undefined;
}

function parseRouting(
  value: unknown,
  issues: string[],
): Record<string, WorkflowRouteV1> | undefined {
  if (!isRecord(value) || Object.keys(value).length === 0) {
    issues.push("routing must be a non-empty object when present");
    return undefined;
  }

  const routing: Record<string, WorkflowRouteV1> = {};
  for (const [routeId, routeValue] of Object.entries(value)) {
    if (!isValidId(routeId)) {
      issues.push(
        `routing key ${JSON.stringify(routeId)} must be lowercase kebab-case`,
      );
    }
    if (!isRecord(routeValue)) {
      issues.push(`routing.${routeId} must be an object`);
      continue;
    }

    const participantsValue = routeValue.participants;
    if (
      !isRecord(participantsValue) ||
      Object.keys(participantsValue).length === 0
    ) {
      issues.push(`routing.${routeId}.participants must be a non-empty object`);
      continue;
    }

    const participants: Record<string, string> = {};
    for (const [responsibility, roleValue] of Object.entries(
      participantsValue,
    )) {
      if (responsibility.trim().length === 0) {
        issues.push(`routing.${routeId}.participants keys must be non-empty`);
      }
      const role = nonEmptyString(
        roleValue,
        `routing.${routeId}.participants.${responsibility}`,
        issues,
      );
      if (role !== undefined) {
        if (!isValidId(role)) {
          issues.push(
            `routing.${routeId}.participants.${responsibility} must be a lowercase-kebab role ID`,
          );
        }
        participants[responsibility] = role;
      }
    }

    let useWhen: string[] | undefined;
    if (routeValue.use_when !== undefined) {
      useWhen = nonEmptyStringArray(
        routeValue.use_when,
        `routing.${routeId}.use_when`,
        issues,
      );
    }

    routing[routeId] = {
      participants,
      ...(useWhen === undefined ? {} : { use_when: useWhen }),
    };
  }
  return routing;
}

export interface ParsedWorkflowContent {
  metadata: WorkflowMetadataV1;
  body: string;
}

export function parseWorkflowContent(raw: string): ParsedWorkflowContent {
  let parsed: ReturnType<typeof parseFrontmatter>;
  try {
    parsed = parseFrontmatter(raw);
  } catch (error) {
    throw new WorkflowError(
      "INVALID_WORKFLOW",
      `Invalid workflow frontmatter: ${errorDetail(error)}`,
      { cause: error },
    );
  }

  const frontmatter = parsed.frontmatter as Record<string, unknown>;
  const issues: string[] = [];
  if (Object.hasOwn(frontmatter, "id")) {
    issues.push(
      "frontmatter id is not allowed; the filename is the workflow ID",
    );
  }

  const title = nonEmptyString(frontmatter.title, "title", issues);
  const summary = nonEmptyString(frontmatter.summary, "summary", issues);
  const useWhen = nonEmptyStringArray(frontmatter.use_when, "use_when", issues);
  const avoidWhen = nonEmptyStringArray(
    frontmatter.avoid_when,
    "avoid_when",
    issues,
  );
  const routing =
    frontmatter.routing === undefined
      ? undefined
      : parseRouting(frontmatter.routing, issues);

  if (parsed.body.trim().length === 0)
    issues.push("Markdown body must be non-empty");
  if (issues.length > 0) {
    throw new WorkflowError("INVALID_WORKFLOW", issues.join("; "));
  }

  return {
    metadata: {
      ...frontmatter,
      title: title!,
      summary: summary!,
      use_when: useWhen!,
      avoid_when: avoidWhen!,
      ...(routing === undefined ? {} : { routing }),
    } as WorkflowMetadataV1,
    body: parsed.body,
  };
}
