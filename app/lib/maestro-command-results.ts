import { MAESTRO_COMMANDS } from "./maestro-chat-engine";

export type CommandStatus = "started" | "completed" | "failed" | "cancelled";
export type CommandResult = {
  command: string;
  status: CommandStatus;
  message?: string;
  jobId?: string;
  artifact?: { kind: "audio"; fileName: string; model?: string | null; durationSec?: number };
  error?: string;
};
type ActionResult = Omit<CommandResult, "command">;
type Report = (result: ActionResult) => void;
type Handler = (report: Report) => ActionResult | void | Promise<ActionResult | void>;

const allowedCommands = new Set<string>(MAESTRO_COMMANDS);
const statuses = new Set(["started", "completed", "failed", "cancelled"]);

function failed(command: string, error: unknown): CommandResult {
  const message = error instanceof Error ? error.message : String(error || "Command failed");
  return { command, status: "failed", error: message, message };
}

function normalize(command: string, value: unknown, previous?: CommandResult): CommandResult {
  if (!value || typeof value !== "object" || !statuses.has((value as ActionResult).status)) {
    return { ...failed(command, "Action did not return a valid result"), ...(previous?.jobId ? { jobId: previous.jobId } : {}) };
  }
  const action = value as ActionResult;
  const result: CommandResult = { command, status: action.status };
  if (typeof action.message === "string") result.message = action.message;
  if (typeof action.error === "string") result.error = action.error;
  const jobId = typeof action.jobId === "string" ? action.jobId : previous?.jobId;
  if (jobId) result.jobId = jobId;
  if (action.artifact?.kind === "audio" && typeof action.artifact.fileName === "string") {
    result.artifact = { kind: "audio", fileName: action.artifact.fileName };
    if (typeof action.artifact.model === "string" || action.artifact.model === null) result.artifact.model = action.artifact.model;
    if (typeof action.artifact.durationSec === "number") result.artifact.durationSec = action.artifact.durationSec;
  }
  return result;
}

/** Dispatch independent whitelisted actions. GPU execution remains in the analyzer/sidecar. */
export function runMaestroCommands(
  commands: string[],
  handlers: Record<string, Handler>,
  onResult?: (index: number, result: CommandResult) => void,
): CommandResult[] {
  const results: CommandResult[] = [];
  for (const [index, command] of commands.entries()) {
    const publish = (result: CommandResult) => {
      results[index] = result;
      // A display observer cannot undo an executed action or stop other commands.
      try { onResult?.(index, result); } catch { /* The action result remains available. */ }
    };
    if (!allowedCommands.has(command) || !Object.hasOwn(handlers, command)) {
      publish(failed(command, "Unsupported Maestro command"));
      continue;
    }
    try {
      const action = handlers[command]((value) => publish(normalize(command, value, results[index])));
      if (action && typeof (action as Promise<unknown>).then === "function") {
        if (!results[index]) publish({ command, status: "started" });
        void Promise.resolve(action).then(
          (value) => publish(normalize(command, value, results[index])),
          (error) => publish({ ...failed(command, error), ...(results[index]?.jobId ? { jobId: results[index].jobId } : {}) }),
        );
      } else {
        publish(action === undefined ? { command, status: "completed" } : normalize(command, action, results[index]));
      }
    } catch (error) {
      publish(failed(command, error));
    }
  }
  return results.map((result) => ({ ...result }));
}
