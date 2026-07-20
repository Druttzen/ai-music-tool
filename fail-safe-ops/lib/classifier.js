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
} from "../../app/lib/fail-safe-bot.js";
