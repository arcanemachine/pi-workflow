import { WorkflowError } from "./errors.js";

export const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidId(value: string): boolean {
  return ID_PATTERN.test(value);
}

export function requireValidId(value: string, label = "ID"): string {
  if (!isValidId(value)) {
    throw new WorkflowError(
      "INVALID_ID",
      `${label} must be lowercase kebab-case.`,
    );
  }
  return value;
}

export function suggestId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
