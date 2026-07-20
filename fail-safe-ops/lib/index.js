/**
 * Fail-Safe Ops public stub API (phase 0–1).
 * Full GitHub auto-fix / review UI lands in phase 2+.
 */

export {
  FAILURE_PLAYBOOKS,
  classifyFailureText,
  formatAgentFixPrompt,
  formatReportSummary,
  overallSeverity,
  getActionableIssues,
} from "./classifier.js";

/** @typedef {"ops-scaffold"} FailSafeOpsProductId */

export const FAIL_SAFE_OPS_PRODUCT = {
  id: /** @type {FailSafeOpsProductId} */ ("ops-scaffold"),
  name: "Fail-Safe Ops",
  phase: "0-1",
  docsPath: "docs/fail-safe-split.md",
};
