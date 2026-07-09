import { describe, expect, it } from "vitest";
import { useProjectActions } from "../app/hooks/project-actions/index.js";

describe("useProjectActions composition", () => {
  it("exports a composer function", () => {
    expect(typeof useProjectActions).toBe("function");
  });
});
