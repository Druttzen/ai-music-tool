/**
 * Fail-Safe Ops classifier entry (phase 1).
 *
 * SOURCE OF TRUTH: ../../app/lib/fail-safe-bot.js
 * Do not copy FAILURE_PLAYBOOKS here — keep a single heuristic set.
 * Phase 2: move playbooks into this package and re-export from the app.
 */

export {
  FAILURE_PLAYBOOKS,
  classifyFailureText,
  formatAgentFixPrompt,
  formatReportSummary,
  overallSeverity,
  getActionableIssues,
} from "../../app/lib/fail-safe-bot.js";
