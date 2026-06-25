import { describe, it, expect, vi, afterEach } from "vitest";
import { separateStemsViaSidecar } from "../app/lib/sidecar-bridge.ts";

describe("separateStemsViaSidecar", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("surfaces sidecar 503 detail when Demucs stems extra is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 503,
        json: async () => ({
          detail: "stem separation unavailable — install the 'stems' extra (No module named 'demucs')",
        }),
      })),
    );

    await expect(separateStemsViaSidecar(new Blob(["RIFF"]), "tone.wav")).rejects.toThrow(
      /stem separation unavailable/i,
    );
  });

  it("returns stem download metadata on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          device: "cpu",
          model: "htdemucs",
          sources: ["drums", "bass", "other", "vocals"],
          job_id: "job-abc",
          stems: [
            {
              name: "vocals",
              download_url: "/separate/download/job-abc/vocals.wav",
              filename: "vocals.wav",
            },
          ],
        }),
      })),
    );

    const result = await separateStemsViaSidecar(new Blob(["RIFF"]), "tone.wav");
    expect(result.job_id).toBe("job-abc");
    expect(result.stems[0].download_url).toContain("vocals.wav");
  });
});
