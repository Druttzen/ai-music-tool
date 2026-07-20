/**
 * Fail-Safe Ops public API (CLI phase 2–3).
 * Desktop Ops shell remains deferred — see docs/fail-safe-split.md.
 */

export {
  FAILURE_PLAYBOOKS,
  classifyFailureText,
  formatAgentFixPrompt,
  formatReportSummary,
  overallSeverity,
  getActionableIssues,
} from "./classifier.js";

/** @typedef {"fail-safe-ops"} FailSafeOpsProductId */

export const FAIL_SAFE_OPS_PRODUCT = {
  id: /** @type {FailSafeOpsProductId} */ ("fail-safe-ops"),
  name: "Fail-Safe Ops",
  phase: "2-3",
  docsPath: "docs/fail-safe-split.md",
};
