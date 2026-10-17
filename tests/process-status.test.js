import { afterEach, describe, expect, it, vi } from "vitest";
import { beginProcess, dismissProcess, getProcesses, runProcess, subscribeProcesses } from "../app/lib/process-status";

afterEach(() => {
  for (const p of getProcesses()) dismissProcess(p.id);
  vi.useRealTimers();
});

describe("operation ledger", () => {
  it("keeps simultaneous operations separate and ignores late progress after completion", () => {
    const master = beginProcess("Mastering");
    const install = beginProcess("Install");
    master.progress({ phase: "mastering", pct: 42, completed: 42, total: 100 });
    install.progress({ phase: "Download", pct: null });
    dismissProcess(install.id);
    master.finish();
    master.progress({ phase: "stale", pct: 3 });
    expect(getProcesses().find(p => p.id === master.id)).toMatchObject({ state: "done", pct: 100, phase: "mastering" });
    expect(getProcesses().find(p => p.id === install.id)).toMatchObject({ state: "running", pct: null });
    install.finish("error", "Access required");
  });

  it("does not invent progress while waiting", () => {
    vi.useFakeTimers();
    const job = beginProcess("Long operation");
    vi.advanceTimersByTime(30_000);
    expect(getProcesses().find(p => p.id === job.id)).toMatchObject({ state: "running", pct: null });
    job.finish();
  });

  it("does not evict active jobs when many operations start", () => {
    const first = beginProcess("First");
    const jobs = Array.from({ length: 60 }, () => beginProcess("Other"));
    expect(getProcesses().find(p => p.id === first.id)?.state).toBe("running");
    [first, ...jobs].forEach(p => p.finish());
  });

  it("records rejected and value-returned failures without claiming completion", async () => {
    await expect(runProcess("Throws", async () => { throw Error("disk full"); })).rejects.toThrow("disk full");
    await runProcess("Returns error", async () => ({ ok: false, error: "401 access required" }));
    expect(getProcesses().map(p => [p.state, p.pct])).toEqual([["error", null], ["error", null]]);
  });

  it("retains cancellation and unsubscribes observers", async () => {
    const changed = vi.fn();
    const unsubscribe = subscribeProcesses(changed);
    await expect(runProcess("Cancel", async () => { const e = Error("cancelled"); e.name = "SidecarJobCancelledError"; throw e; })).rejects.toThrow();
    expect(getProcesses().at(-1).state).toBe("cancelled");
    unsubscribe();
    const count = changed.mock.calls.length;
    dismissProcess(getProcesses().at(-1).id);
    expect(changed).toHaveBeenCalledTimes(count);
  });
});
