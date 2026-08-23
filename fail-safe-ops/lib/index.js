/**
 * Fail-Safe Ops public API (CLI shipped; desktop Ops shell deferred).
 * See docs/fail-safe-split.md.
 */

export {
  FAILURE_PLAYBOOKS,
  classifyFailureText,
  formatAgentFixPrompt,
  formatReportSummary,
  overallSeverity,
  getActionableIssues,
  clipText,
  FAIL_SAFE_COMMENT_MAX_CHARS,
  FAIL_SAFE_LOG_EXCERPT_CHARS,
} from "./classifier.js";

/** @typedef {"fail-safe-ops"} FailSafeOpsProductId */

export const FAIL_SAFE_OPS_PRODUCT = {
  id: /** @type {FailSafeOpsProductId} */ ("fail-safe-ops"),
  name: "Fail-Safe Ops",
  phase: "2-3",
  docsPath: "docs/fail-safe-split.md",
};
