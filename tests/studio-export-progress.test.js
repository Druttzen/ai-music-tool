import { afterEach, expect, it, vi } from "vitest";
import { getProcesses, dismissProcess } from "../app/lib/process-status";
import { exportEnhancedFromBlob } from "../app/lib/studio-export-client";

const mocks = vi.hoisted(() => ({ save: vi.fn(), master: vi.fn() }));
vi.mock("../app/lib/dsp-bridge", () => ({ isTauriApp: () => true, exportMasteredNative: (...args) => mocks.master(...args) }));
vi.mock("../app/lib/audio-export-formats", async (original) => ({ ...await original(), downloadFormatBlob: (...args) => mocks.save(...args) }));
afterEach(() => { for (const p of getProcesses()) dismissProcess(p.id); vi.clearAllMocks(); });

it("keeps mastering open until the encoded file has actually been saved", async () => {
  let finishSave;
  mocks.master.mockImplementation(async (...args) => {
    args[5]({ phase: "mastering", pct: 42, completed: 42, total: 100 });
    return { wav_bytes: [1, 2, 3] };
  });
  mocks.save.mockImplementation(() => new Promise(resolve => { finishSave = resolve; }));
  const exportPromise = exportEnhancedFromBlob(new Blob(["wav"]), "streaming", "song", { format: "flac" });
  await vi.waitFor(() => expect(finishSave).toBeTypeOf("function"));
  expect(getProcesses().at(-1)).toMatchObject({ state: "running", phase: "saving", pct: null });
  finishSave({ mode: "studio", path: "song.flac" });
  await exportPromise;
  expect(getProcesses().at(-1)).toMatchObject({ state: "done", pct: 100 });
});

it("shows a failed save as failure even after encoding succeeded", async () => {
  mocks.master.mockResolvedValue({ wav_bytes: [1] });
  mocks.save.mockRejectedValue(Error("disk full"));
  await expect(exportEnhancedFromBlob(new Blob(["wav"]), "streaming", "song", { format: "flac" })).rejects.toThrow("disk full");
  expect(getProcesses().at(-1)).toMatchObject({ state: "error", pct: null });
});
