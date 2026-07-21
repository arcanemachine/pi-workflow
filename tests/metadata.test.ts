import { describe, expect, it } from "vitest";
import { parseWorkflowContent } from "../src/metadata.js";
import { validWorkflow } from "./helpers.js";

describe("parseWorkflowContent", () => {
  it("parses required metadata, routing, additional fields, and body", () => {
    const parsed = parseWorkflowContent(
      validWorkflow({
        extra: [
          "future_field:",
          "  nested: true",
          "routing:",
          "  direct:",
          "    participants:",
          "      planner: architect",
          "    use_when:",
          "      - Direct review is enough.",
        ].join("\n"),
      }),
    );

    expect(parsed.metadata).toMatchObject({
      title: "Bounded work",
      managing_roles: ["architect"],
      future_field: { nested: true },
      routing: {
        direct: {
          participants: { planner: "architect" },
          use_when: ["Direct review is enough."],
        },
      },
    });
    expect(parsed.body).toContain("Follow the instructions.");
  });

  it.each([
    ["frontmatter ID", "id: redundant", /frontmatter id is not allowed/],
    ["empty title", 'title: ""', /title must be a non-empty string/],
    [
      "duplicate role",
      "  - architect\n  - architect",
      /must not contain duplicates/,
    ],
    ["invalid role", "  - Architect", /invalid ID/],
  ])("rejects %s", (_name, replacement, expected) => {
    let source = validWorkflow();
    if (_name === "frontmatter ID") {
      source = source.replace("summary:", `${replacement}\nsummary:`);
    } else if (_name === "empty title") {
      source = source.replace('title: "Bounded work"', replacement as string);
    } else {
      source = source.replace("  - architect", replacement as string);
    }
    expect(() => parseWorkflowContent(source)).toThrow(expected);
  });

  it("rejects malformed routing and empty bodies", () => {
    expect(() =>
      parseWorkflowContent(validWorkflow({ extra: "routing: {}" })),
    ).toThrow(/routing must be a non-empty object/);
    expect(() => parseWorkflowContent(validWorkflow({ body: "   " }))).toThrow(
      /body must be non-empty/,
    );
  });
});
