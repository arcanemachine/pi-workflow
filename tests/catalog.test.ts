import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  MAX_WORKFLOW_BYTES,
  discoverWorkflowCatalog,
  requireWorkflow,
} from "../src/catalog.js";
import {
  cleanupTempDirectories,
  makeTempDirectory,
  validWorkflow,
} from "./helpers.js";

afterEach(cleanupTempDirectories);

describe("discoverWorkflowCatalog", () => {
  it("returns an empty catalog when the directory is absent", () => {
    const directory = join(makeTempDirectory(), "missing");
    expect(discoverWorkflowCatalog(directory)).toEqual({
      directory,
      entries: [],
      diagnostics: [],
    });
  });

  it("discovers direct Markdown files and symlinks in deterministic ID order", () => {
    const directory = makeTempDirectory();
    writeFileSync(join(directory, "z-last.md"), validWorkflow({ title: "Z" }));
    writeFileSync(join(directory, "a-first.md"), validWorkflow({ title: "A" }));
    writeFileSync(join(directory, ".hidden.md"), validWorkflow());
    writeFileSync(join(directory, "ignored.txt"), validWorkflow());
    mkdirSync(join(directory, "nested"));
    writeFileSync(join(directory, "nested", "nested.md"), validWorkflow());
    symlinkSync(join(directory, "a-first.md"), join(directory, "linked.md"));
    symlinkSync(
      join(directory, "nested"),
      join(directory, "linked-directory.md"),
    );

    const result = discoverWorkflowCatalog(directory);

    expect(result.entries.map((entry) => entry.id)).toEqual([
      "a-first",
      "linked",
      "z-last",
    ]);
    expect(result.entries.every((entry) => entry.workflow)).toBe(true);
  });

  it("keeps invalid and oversized workflows visible without hiding valid entries", () => {
    const directory = makeTempDirectory();
    writeFileSync(join(directory, "valid.md"), validWorkflow());
    writeFileSync(
      join(directory, "invalid.md"),
      "---\ntitle: Missing fields\n---\nBody",
    );
    writeFileSync(
      join(directory, "oversized.md"),
      "x".repeat(MAX_WORKFLOW_BYTES + 1),
    );

    const result = discoverWorkflowCatalog(directory);

    expect(result.entries.map((entry) => entry.id)).toEqual([
      "invalid",
      "oversized",
      "valid",
    ]);
    expect(
      result.entries.find((entry) => entry.id === "valid")?.workflow,
    ).toBeDefined();
    expect(
      result.entries.find((entry) => entry.id === "invalid")?.diagnostics[0]
        .code,
    ).toBe("INVALID_WORKFLOW");
    expect(
      result.entries.find((entry) => entry.id === "oversized")?.diagnostics[0]
        .code,
    ).toBe("WORKFLOW_TOO_LARGE");
    expect(() => requireWorkflow(result, "oversized")).toThrow(/maximum/);
  });

  it("marks both sides of a case-insensitive filename collision invalid", () => {
    const directory = makeTempDirectory();
    writeFileSync(join(directory, "phase.md"), validWorkflow());
    writeFileSync(join(directory, "Phase.md"), validWorkflow());

    const result = discoverWorkflowCatalog(directory);

    expect(result.entries).toHaveLength(2);
    expect(result.entries.every((entry) => !entry.workflow)).toBe(true);
    expect(
      result.diagnostics.filter((item) => /collides/.test(item.message)),
    ).toHaveLength(2);
  });

  it("does exact validated lookup by filename ID", () => {
    const directory = makeTempDirectory();
    writeFileSync(join(directory, "bounded-work.md"), validWorkflow());
    const result = discoverWorkflowCatalog(directory);

    expect(requireWorkflow(result, "bounded-work").id).toBe("bounded-work");
    expect(() => requireWorkflow(result, "missing")).toThrow(/not found/);
    expect(() => requireWorkflow(result, "Bounded-Work")).toThrow(/lowercase/);
  });
});
