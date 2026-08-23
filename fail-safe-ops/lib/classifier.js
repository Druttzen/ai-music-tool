/**
 * Fail-Safe Ops classifier entry.
 *
 * SOURCE OF TRUTH: ../../app/lib/fail-safe-bot.js
 * Do not copy FAILURE_PLAYBOOKS here — keep a single heuristic set.
 * Deferred: move playbooks into this package and re-export from the app.
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
} from "../../app/lib/fail-safe-bot.js";
