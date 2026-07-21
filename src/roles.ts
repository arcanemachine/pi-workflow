import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { errorDetail } from "./errors.js";
import { isValidId } from "./ids.js";
import type { Diagnostic, RoleFilenameDiscovery } from "./types.js";

export function discoverGlobalRoleFilenames(
  directory: string,
): RoleFilenameDiscovery {
  if (!existsSync(directory)) {
    return { directory, roleIds: [], diagnostics: [] };
  }

  try {
    if (!statSync(directory).isDirectory()) {
      return {
        directory,
        roleIds: [],
        diagnostics: [
          {
            code: "READ_FAILED",
            message: "Configured global roles path is not a directory.",
            path: directory,
          },
        ],
      };
    }
  } catch (error) {
    return {
      directory,
      roleIds: [],
      diagnostics: [
        {
          code: "READ_FAILED",
          message: `Cannot inspect global roles directory: ${errorDetail(error)}`,
          path: directory,
        },
      ],
    };
  }

  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true }).filter(
      (entry) => {
        if (entry.name.startsWith(".") || !entry.name.endsWith(".md"))
          return false;
        if (entry.isFile()) return true;
        if (!entry.isSymbolicLink()) return false;
        try {
          return !statSync(join(directory, entry.name)).isDirectory();
        } catch {
          return true;
        }
      },
    );
  } catch (error) {
    return {
      directory,
      roleIds: [],
      diagnostics: [
        {
          code: "READ_FAILED",
          message: `Cannot list global roles directory: ${errorDetail(error)}`,
          path: directory,
        },
      ],
    };
  }

  const diagnostics: Diagnostic[] = [];
  const ids = entries.map((entry) => basename(entry.name, ".md"));
  const counts = new Map<string, number>();
  for (const id of ids) {
    const normalized = id.toLowerCase();
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  const roleIds = ids.filter((id) => {
    const path = join(directory, `${id}.md`);
    if (!isValidId(id)) {
      diagnostics.push({
        code: "INVALID_ID",
        message: `Global role filename stem ${JSON.stringify(id)} must be lowercase kebab-case.`,
        path,
      });
      return false;
    }
    if ((counts.get(id.toLowerCase()) ?? 0) > 1) {
      diagnostics.push({
        code: "INVALID_ID",
        message: `Global role filenames collide case-insensitively for ID ${JSON.stringify(id)}.`,
        path,
      });
      return false;
    }
    return true;
  });

  return {
    directory,
    roleIds: [...new Set(roleIds)].sort((a, b) => a.localeCompare(b)),
    diagnostics,
  };
}
