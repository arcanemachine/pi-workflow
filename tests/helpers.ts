import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempDirectories: string[] = [];

export function makeTempDirectory(prefix = "pi-workflow-"): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  tempDirectories.push(directory);
  return directory;
}

export function cleanupTempDirectories(): void {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
}

export function validWorkflow(
  overrides: {
    title?: string;
    summary?: string;
    extra?: string;
    body?: string;
  } = {},
): string {
  return [
    "---",
    `title: ${JSON.stringify(overrides.title ?? "Bounded work")}`,
    `summary: ${JSON.stringify(overrides.summary ?? "Do one bounded task.")}`,
    "managing_roles:",
    "  - architect",
    "use_when:",
    "  - Scope is bounded.",
    "avoid_when:",
    "  - Multiple tasks require coordination.",
    overrides.extra ?? "",
    "---",
    "",
    overrides.body ?? "# Bounded work\n\nFollow the instructions.",
  ]
    .filter(
      (line, index, lines) =>
        line !== "" ||
        lines[index - 1] === "---" ||
        index > lines.indexOf("---", 1),
    )
    .join("\n");
}

export function writeText(path: string, content: string): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content);
}
