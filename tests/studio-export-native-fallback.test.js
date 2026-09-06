/**
 * Studio export native-only formats must not silently fall through in Tauri.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("exportEnhancedFromBlob native-only formats", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("../app/lib/dsp-bridge");
    vi.unstubAllGlobals();
  });

  it("rethrows FLAC failures in Tauri instead of JS WAV24 fallback", async () => {
    vi.doMock("../app/lib/dsp-bridge", () => ({
      isTauriApp: () => true,
      exportMasteredNative: vi.fn(async () => {
        throw new Error("native boom");
      }),
    }));
    const { exportEnhancedFromBlob } = await import("../app/lib/studio-export-client.js");
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" });
    await expect(
      exportEnhancedFromBlob(blob, "streaming", "track", { format: "flac" }),
    ).rejects.toThrow(/FLAC export needs Studio native encoder/);
  });

  it("rethrows M4A failures in Tauri instead of JS MP3 fallback", async () => {
    vi.doMock("../app/lib/dsp-bridge", () => ({
      isTauriApp: () => true,
      exportMasteredNative: vi.fn(async () => {
        throw new Error("mux failed");
      }),
    }));
    const { exportEnhancedFromBlob } = await import("../app/lib/studio-export-client.js");
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" });
    await expect(
      exportEnhancedFromBlob(blob, "streaming", "track", { format: "m4a" }),
    ).rejects.toThrow(/M4A export needs Studio native encoder/);
  });
});
