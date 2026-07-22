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
  ])("rejects %s", (_name, replacement, expected) => {
    let source = validWorkflow();
    if (_name === "frontmatter ID") {
      source = source.replace("summary:", `${replacement}\nsummary:`);
    } else {
      source = source.replace('title: "Bounded work"', replacement as string);
    }
    expect(() => parseWorkflowContent(source)).toThrow(expected);
  });

  it("does not validate or require a managing_roles field", () => {
    const parsed = parseWorkflowContent(validWorkflow());
    expect(parsed.metadata).not.toHaveProperty("managing_roles");

    const withLegacyField = parseWorkflowContent(
      validWorkflow({ extra: "managing_roles:\n  - architect" }),
    );
    expect(withLegacyField.metadata.managing_roles).toEqual(["architect"]); // legacy extra field passes through
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
