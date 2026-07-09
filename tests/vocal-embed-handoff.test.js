import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("vocal-embed-handoff align export", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("exportVocalEmbedHandoffPack accepts alignPreview in options", async () => {
    const { exportVocalEmbedHandoffPack } = await import("../app/lib/vocal-embed-handoff.js");
    expect(typeof exportVocalEmbedHandoffPack).toBe("function");
    expect(exportVocalEmbedHandoffPack.length).toBeGreaterThan(0);
  });

  it("triggers plan, readme, align-preview, and openvpi-ds downloads", async () => {
    const downloads = [];
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:mock"),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal("document", {
      createElement: vi.fn(() => {
        const anchor = { href: "", download: "", click: vi.fn() };
        anchor.click = vi.fn(() => {
          downloads.push(anchor.download);
        });
        return anchor;
      }),
    });

    const { exportVocalEmbedHandoffPack } = await import("../app/lib/vocal-embed-handoff.js");
    const exportPromise = exportVocalEmbedHandoffPack({
      planEnvelope: { plan: { stage: "ready" }, format: "vocal-embed-plan" },
      alignPreview: { align_method: "heuristic", word_count: 4, words: [] },
      openvpiDs: {
        format: "openvpi-ds-segments",
        segment_count: 2,
        segments: [{ text: "line" }, { text: "two" }],
      },
      instrumental: new Blob(["wav"], { type: "audio/wav" }),
      guideVocal: new Blob(["guide"], { type: "audio/wav" }),
    });

    await vi.runAllTimersAsync();
    await exportPromise;

    expect(downloads.some((name) => name.endsWith("-plan.json"))).toBe(true);
    expect(downloads.some((name) => name.endsWith("-README.txt"))).toBe(true);
    expect(downloads.some((name) => name.endsWith("-align-preview.json"))).toBe(true);
    expect(downloads.some((name) => name.endsWith("-openvpi-ds.json"))).toBe(true);
    expect(downloads.some((name) => name.endsWith("-instrumental.wav"))).toBe(true);
    expect(downloads.some((name) => name.endsWith("-guide-vocal.wav"))).toBe(true);
    expect(downloads.length).toBe(6);
  });
});
