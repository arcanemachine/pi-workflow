import { describe, expect, it } from "vitest";

describe("extension entrypoint", () => {
  it("loads without filesystem side effects", async () => {
    const extension = await import("../src/index.js");
    expect(extension.default).toBeTypeOf("function");
    expect(extension.default({} as never)).toBeUndefined();
  });
});
