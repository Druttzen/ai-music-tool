/**
 * Pick a CI run that fail-safe should actually try to fix.
 * Skipped/cancelled jobs and the fail-safe workflow itself are not failures.
 */

/**
 * @param {{ conclusion?: string|null, workflowName?: string|null }|null|undefined} run
 */
function isActionableFailedRun(run) {
  if (!run || run.conclusion !== "failure") return false;
  const name = String(run.workflowName || "");
  if (/fail-safe/i.test(name)) return false;
  return true;
}

/**
 * @param {Array<{ conclusion?: string|null, workflowName?: string|null }>|null|undefined} runs
 */
function selectActionableFailedRun(runs) {
  return (Array.isArray(runs) ? runs : []).find(isActionableFailedRun) || null;
}

module.exports = {
  isActionableFailedRun,
  selectActionableFailedRun,
};
