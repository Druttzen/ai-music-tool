import { afterEach, expect, it, vi } from "vitest";
import { waitForSidecar } from "../app/lib/sidecar-bridge";
import { dismissProcess, getProcesses } from "../app/lib/process-status";

afterEach(() => { vi.unstubAllGlobals(); for (const p of getProcesses()) dismissProcess(p.id); });

it("records a readiness timeout as a failure while retaining the false return contract", async () => {
  await expect(waitForSidecar(0)).resolves.toBe(false);
  expect(getProcesses().at(-1)).toMatchObject({ label: "AI engine readiness", state: "error", pct: null });
});

it("keeps engine startup visible until a real health response arrives", async () => {
  let respond;
  vi.stubGlobal("fetch", vi.fn(() => new Promise(resolve => { respond = resolve; })));
  const ready = waitForSidecar(1000);
  await vi.waitFor(() => expect(respond).toBeTypeOf("function"));
  expect(getProcesses().at(-1)).toMatchObject({ state: "running", pct: null, phase: "Waiting for the local AI engine" });
  respond({ ok: true, json: async () => ({ owned: true }) });
  await expect(ready).resolves.toBe(true);
  expect(getProcesses().at(-1)).toMatchObject({ state: "done", pct: 100 });
});
