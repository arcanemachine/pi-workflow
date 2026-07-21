export type WorkflowErrorCode =
  | "INVALID_ARGUMENT"
  | "INVALID_ID"
  | "PROJECT_NOT_FOUND"
  | "WORKFLOW_NOT_FOUND"
  | "INVALID_PROJECTS_FILE"
  | "UNSUPPORTED_PROJECTS_VERSION"
  | "INVALID_WORKFLOW"
  | "WORKFLOW_TOO_LARGE"
  | "CATALOG_TOO_LARGE"
  | "CONFIG_CHANGED"
  | "READ_FAILED"
  | "WRITE_FAILED"
  | "UI_UNAVAILABLE";

export class WorkflowError extends Error {
  readonly code: WorkflowErrorCode;

  constructor(
    code: WorkflowErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "WorkflowError";
    this.code = code;
  }
}

export function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
