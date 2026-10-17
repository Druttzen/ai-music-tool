import { afterEach, expect, it, vi } from "vitest";
import { installSidecarExtra } from "../app/lib/sidecar-extra-install-client";
import { dismissProcess, getProcesses } from "../app/lib/process-status";

afterEach(() => { vi.unstubAllGlobals(); for (const p of getProcesses()) dismissProcess(p.id); });

it("observes installation output before invoke, filters the addon and retains errors", async () => {
  let listener;
  const unlisten = vi.fn();
  vi.stubGlobal("window", { __TAURI__: {
    event: { listen: vi.fn(async (_name, fn) => { listener = fn; return unlisten; }) },
    core: { invoke: vi.fn(async () => {
      expect(listener).toBeTypeOf("function");
      listener({ payload: { extraId: "cover", line: "Wrong operation" } });
      expect(getProcesses().at(-1).phase).toBe("Working");
      listener({ payload: { extraId: "vocal-rvc", phase: "install", line: "Downloading HuBERT" } });
      expect(getProcesses().at(-1)).toMatchObject({ state: "running", phase: "Downloading HuBERT", pct: null });
      return { ok: false, error: "Download failed" };
    }) },
  } });
  await installSidecarExtra("vocal-rvc");
  expect(getProcesses().at(-1)).toMatchObject({ state: "error", detail: "Download failed", pct: null });
  expect(unlisten).toHaveBeenCalledOnce();
});
