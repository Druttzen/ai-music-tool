/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openMusicVideoHandoff } from "../app/lib/suite-music-video-client.js";

vi.mock("../app/lib/dsp-bridge.js", () => ({
  isTauriApp: vi.fn(() => false),
}));

describe("suite music video client", () => {
  const exportHandoff = vi.fn();

  beforeEach(() => {
    exportHandoff.mockReset();
    exportHandoff.mockResolvedValue({ ok: true, mode: "handoff", message: "exported" });
    Object.defineProperty(window, "electronAPI", {
      configurable: true,
      value: { exportMusicVideoHandoff: exportHandoff },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => ({
        ok: true,
        blob: async () =>
          new Blob([url.includes("audio") ? Uint8Array.from([1, 2]) : Uint8Array.from([3, 4])], {
            type: url.includes("audio") ? "audio/wav" : "image/png",
          }),
      })),
    );
  });

  afterEach(() => {
    delete window.electronAPI;
    vi.unstubAllGlobals();
  });

  it("materializes renderer blob URLs before invoking Electron", async () => {
    const result = await openMusicVideoHandoff({
      audioUrl: "blob:audio",
      audioName: "track.wav",
      coverUrl: "blob:cover",
      coverName: "cover.png",
      prompt: "neon",
    });

    expect(result.ok).toBe(true);
    expect(exportHandoff).toHaveBeenCalledTimes(1);
    const payload = exportHandoff.mock.calls[0][0];
    expect(Array.from(new Uint8Array(payload.audioBuffer))).toEqual([1, 2]);
    expect(Array.from(new Uint8Array(payload.coverBuffer))).toEqual([3, 4]);
    expect(payload.audioExt).toBe("wav");
    expect(payload.coverExt).toBe("png");
    expect(payload).not.toHaveProperty("audioUrl");
    expect(payload).not.toHaveProperty("coverUrl");
  });
});
