import { describe, expect, it } from "vitest";
import {
  classifyFailureText,
  FAIL_SAFE_OPS_PRODUCT,
  FAILURE_PLAYBOOKS,
} from "../fail-safe-ops/lib/index.js";

describe("fail-safe-ops classifier re-export", () => {
  it("exposes Ops product stub metadata", () => {
    expect(FAIL_SAFE_OPS_PRODUCT.name).toBe("Fail-Safe Ops");
    expect(FAIL_SAFE_OPS_PRODUCT.docsPath).toBe("docs/fail-safe-split.md");
  });

  it("re-exports live playbooks from app/lib/fail-safe-bot.js", () => {
    expect(FAILURE_PLAYBOOKS.rust_lock_drift).toBeTruthy();
    const issues = classifyFailureText("ci-gates — FAILED at: check:full");
    expect(issues.some((i) => i.id === "ci_gate")).toBe(true);
  });
});
