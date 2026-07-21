import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverGlobalRoleFilenames } from "../src/roles.js";
import { cleanupTempDirectories, makeTempDirectory } from "./helpers.js";

afterEach(cleanupTempDirectories);

describe("discoverGlobalRoleFilenames", () => {
  it("returns no roles or diagnostics for a missing directory", () => {
    const directory = join(makeTempDirectory(), "roles");
    expect(discoverGlobalRoleFilenames(directory)).toEqual({
      directory,
      roleIds: [],
      diagnostics: [],
    });
  });

  it("discovers only direct non-hidden Markdown filenames", () => {
    const directory = makeTempDirectory();
    writeFileSync(join(directory, "worker.md"), "irrelevant body");
    writeFileSync(join(directory, "architect.md"), "not parsed");
    writeFileSync(join(directory, ".hidden.md"), "hidden");
    writeFileSync(join(directory, "ignored.txt"), "ignored");
    mkdirSync(join(directory, "nested"));
    writeFileSync(join(directory, "nested", "sergeant.md"), "nested");
    symlinkSync(join(directory, "worker.md"), join(directory, "reviewer.md"));
    symlinkSync(join(directory, "nested"), join(directory, "linked-dir.md"));

    const result = discoverGlobalRoleFilenames(directory);

    expect(result.roleIds).toEqual(["architect", "reviewer", "worker"]);
    expect(result.diagnostics).toEqual([]);
  });

  it("reports invalid and colliding filename IDs without treating them as present", () => {
    const directory = makeTempDirectory();
    writeFileSync(join(directory, "Architect.md"), "one");
    writeFileSync(join(directory, "architect.md"), "two");
    writeFileSync(join(directory, "bad_role.md"), "three");
    writeFileSync(join(directory, "worker.md"), "four");

    const result = discoverGlobalRoleFilenames(directory);

    expect(result.roleIds).toEqual(["worker"]);
    expect(result.diagnostics).toHaveLength(3);
  });
});
