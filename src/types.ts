import type { WorkflowErrorCode } from "./errors.js";

export interface WorkflowRouteV1 {
  participants: Record<string, string>;
  use_when?: string[];
}

export interface WorkflowMetadataV1 {
  title: string;
  summary: string;
  managing_roles: string[];
  use_when: string[];
  avoid_when: string[];
  routing?: Record<string, WorkflowRouteV1>;
  [additionalField: string]: unknown;
}

export interface WorkflowDefinition {
  id: string;
  path: string;
  metadata: WorkflowMetadataV1;
  body: string;
  raw: string;
}

export interface Diagnostic {
  code: WorkflowErrorCode;
  message: string;
  path?: string;
}

export interface CatalogEntry {
  id: string;
  path: string;
  workflow?: WorkflowDefinition;
  diagnostics: Diagnostic[];
}

export interface WorkflowCatalog {
  directory: string;
  entries: CatalogEntry[];
  diagnostics: Diagnostic[];
}

export interface ProjectConfigV1 {
  roles: Record<string, string[]>;
}

export interface ProjectsFileV1 {
  version: 1;
  projects: Record<string, ProjectConfigV1>;
}

export interface LoadedProjectsFile {
  value: ProjectsFileV1;
  originalContent: string | null;
  path: string;
}

export interface RoleFilenameDiscovery {
  directory: string;
  roleIds: string[];
  diagnostics: Diagnostic[];
}
