import { describe, expect, it, vi } from "vitest";
import { runMaestroCommands } from "../app/lib/maestro-command-results";

describe("Maestro command results", () => {
  it("returns a completed result for each synchronous action", () => {
    expect(runMaestroCommands(["gotoPolish", "gotoFinal"], {
      gotoPolish: () => {}, gotoFinal: () => ({ status: "completed", message: "Final opened" }),
    })).toEqual([
      { command: "gotoPolish", status: "completed" },
      { command: "gotoFinal", status: "completed", message: "Final opened" },
    ]);
  });

  it("rejects commands outside the whitelist even when a handler exists", () => {
    const handler = vi.fn();
    const [result] = runMaestroCommands(["deleteEverything"], { deleteEverything: handler });
    expect(result.status).toBe("failed");
    expect(handler).not.toHaveBeenCalled();
  });

  it("keeps independent actions running after a synchronous failure", () => {
    const next = vi.fn();
    const results = runMaestroCommands(["mergeAudio", "gotoFinal"], {
      mergeAudio: () => { throw new Error("No track"); }, gotoFinal: next,
    });
    expect(results[0]).toMatchObject({ command: "mergeAudio", status: "failed", error: "No track" });
    expect(results[1].status).toBe("completed");
    expect(next).toHaveBeenCalledOnce();
  });

  it("reports job starts and terminal results without owning the GPU job", async () => {
    let finish;
    const notify = vi.fn();
    const results = runMaestroCommands(["generateMusicGen", "gotoPolish"], {
      generateMusicGen: (report) => {
        report({ status: "started", jobId: "actual-job" });
        return new Promise((resolve) => { finish = resolve; });
      }, gotoPolish: () => {},
    }, notify);
    expect(results[0]).toEqual({ command: "generateMusicGen", status: "started", jobId: "actual-job" });
    expect(results[1].status).toBe("completed");
    finish({ status: "completed", artifact: { kind: "audio", fileName: "preview.wav" } });
    await Promise.resolve();
    expect(notify).toHaveBeenLastCalledWith(0, {
      command: "generateMusicGen", status: "completed", jobId: "actual-job",
      artifact: { kind: "audio", fileName: "preview.wav" },
    });
  });

  it("turns async rejections and missing async results into failures", async () => {
    const notify = vi.fn();
    runMaestroCommands(["mergeAudio", "generateMusicGen"], {
      mergeAudio: () => Promise.reject(new Error("Merge failed")),
      generateMusicGen: () => Promise.resolve(undefined),
    }, notify);
    await Promise.resolve();
    await Promise.resolve();
    expect(notify.mock.calls.filter(([, result]) => result.status === "failed")).toHaveLength(2);
  });

  it("preserves cancellation and never marks it completed", async () => {
    const notify = vi.fn();
    runMaestroCommands(["generateMusicGenMelody"], {
      generateMusicGenMelody: () => Promise.resolve({ status: "cancelled", message: "Cancelled" }),
    }, notify);
    await Promise.resolve();
    expect(notify).toHaveBeenLastCalledWith(0, {
      command: "generateMusicGenMelody", status: "cancelled", message: "Cancelled",
    });
  });

  it("rejects unsupported result states", () => {
    expect(runMaestroCommands(["gotoFinal"], {
      gotoFinal: () => ({ status: "pretend-success" }),
    })[0].status).toBe("failed");
  });
});
