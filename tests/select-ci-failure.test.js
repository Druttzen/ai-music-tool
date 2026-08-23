import { describe, expect, it } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { isActionableFailedRun, selectActionableFailedRun } = require("../scripts/select-ci-failure.cjs");

describe("select-ci-failure", () => {
  it("ignores skipped, cancelled, and fail-safe workflows", () => {
    expect(isActionableFailedRun({ conclusion: "skipped", workflowName: "Fail-safe bot" })).toBe(
      false,
    );
    expect(isActionableFailedRun({ conclusion: "cancelled", workflowName: "CI" })).toBe(false);
    expect(isActionableFailedRun({ conclusion: "failure", workflowName: "Fail-safe bot" })).toBe(
      false,
    );
    expect(isActionableFailedRun({ conclusion: "failure", workflowName: "CI" })).toBe(true);
  });

  it("selects the first real CI failure", () => {
    const picked = selectActionableFailedRun([
      { conclusion: "skipped", workflowName: "Fail-safe bot" },
      { conclusion: "success", workflowName: "CI" },
      { conclusion: "failure", workflowName: "CI" },
    ]);
    expect(picked.workflowName).toBe("CI");
    expect(selectActionableFailedRun([{ conclusion: "skipped", workflowName: "CI" }])).toBeNull();
  });
});
