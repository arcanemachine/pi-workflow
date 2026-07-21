import { readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  loadProjectsFile,
  normalizeProjectsFile,
  parseProjectsFile,
  saveProjectsFile,
  serializeProjectsFile,
} from "../src/projects.js";
import type { ProjectsFileV1 } from "../src/types.js";
import { cleanupTempDirectories, makeTempDirectory } from "./helpers.js";

afterEach(cleanupTempDirectories);

const valid: ProjectsFileV1 = {
  version: 1,
  projects: {
    practorium: {
      roles: {
        architect: ["full-phase", "bounded-work"],
      },
    },
  },
};

describe("projects.json validation", () => {
  it("accepts the exact version-one shape", () => {
    expect(parseProjectsFile(JSON.stringify(valid))).toEqual(valid);
  });

  it.each([
    ["invalid JSON", "{", "INVALID_PROJECTS_FILE"],
    [
      "unknown root field",
      JSON.stringify({ ...valid, extra: true }),
      "INVALID_PROJECTS_FILE",
    ],
    [
      "unknown project field",
      JSON.stringify({
        version: 1,
        projects: { p: { roles: {}, extra: true } },
      }),
      "INVALID_PROJECTS_FILE",
    ],
    [
      "invalid project ID",
      JSON.stringify({ version: 1, projects: { "Bad ID": { roles: {} } } }),
      "INVALID_PROJECTS_FILE",
    ],
    [
      "invalid role ID",
      JSON.stringify({
        version: 1,
        projects: { p: { roles: { Architect: [] } } },
      }),
      "INVALID_PROJECTS_FILE",
    ],
    [
      "duplicate workflows",
      JSON.stringify({
        version: 1,
        projects: { p: { roles: { architect: ["one", "one"] } } },
      }),
      "INVALID_PROJECTS_FILE",
    ],
    [
      "newer version",
      JSON.stringify({ version: 2, projects: {} }),
      "UNSUPPORTED_PROJECTS_VERSION",
    ],
  ])("rejects %s", (_name, content, code) => {
    try {
      parseProjectsFile(content);
      throw new Error("expected parsing to fail");
    } catch (error) {
      expect(error).toMatchObject({ code });
    }
  });
});

describe("projects.json persistence", () => {
  it("normalizes project, role, and workflow order and removes empty roles", () => {
    const input: ProjectsFileV1 = {
      version: 1,
      projects: {
        zeta: { roles: { worker: [], architect: ["z", "a", "a"] } },
        alpha: { roles: {} },
      },
    };

    expect(normalizeProjectsFile(input)).toEqual({
      version: 1,
      projects: {
        alpha: { roles: {} },
        zeta: { roles: { architect: ["a", "z"] } },
      },
    });
    expect(serializeProjectsFile(input)).toBe(
      `${JSON.stringify(normalizeProjectsFile(input), null, 2)}\n`,
    );
    expect(() =>
      serializeProjectsFile({
        version: 1,
        projects: { "Invalid ID": { roles: {} } },
      }),
    ).toThrow(/Invalid project ID/);
  });

  it("loads a missing file as empty without creating it", () => {
    const path = join(makeTempDirectory(), "workflows", "projects.json");
    expect(loadProjectsFile(path)).toEqual({
      value: { version: 1, projects: {} },
      originalContent: null,
      path,
    });
  });

  it("writes atomically with restrictive permissions and leaves no temp file", () => {
    const directory = join(makeTempDirectory(), "workflows");
    const path = join(directory, "projects.json");

    saveProjectsFile(path, valid, null);

    expect(readFileSync(path, "utf8")).toBe(serializeProjectsFile(valid));
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(statSync(directory).mode & 0o777).toBe(0o700);
    expect(loadProjectsFile(path).value).toEqual(normalizeProjectsFile(valid));
  });

  it("detects a change made after opening instead of overwriting it", () => {
    const path = join(makeTempDirectory(), "projects.json");
    writeFileSync(path, JSON.stringify(valid));
    const loaded = loadProjectsFile(path);
    writeFileSync(path, `${JSON.stringify(valid)}\n`);

    expect(() =>
      saveProjectsFile(
        path,
        { version: 1, projects: {} },
        loaded.originalContent,
      ),
    ).toThrow(/changed after it was opened/);
    expect(readFileSync(path, "utf8")).toBe(`${JSON.stringify(valid)}\n`);
  });
});
