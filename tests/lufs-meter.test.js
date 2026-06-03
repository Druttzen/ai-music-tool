import { describe, it, expect } from "vitest";
import {
  STREAMING_TARGET_LUFS,
  formatLufs,
  formatTruePeak,
} from "../app/lib/lufs-meter.js";

describe("lufs-meter", () => {
  it("formats LUFS and true peak for display", () => {
    expect(formatLufs(-14.2)).toMatch(/-14\.2 LUFS/);
    expect(formatLufs(Number.NaN)).toBe("—");
    expect(formatTruePeak(-1.0)).toMatch(/-1\.0 dBTP/);
  });

  it("streaming target is -14", () => {
    expect(STREAMING_TARGET_LUFS).toBe(-14);
  });

  it("exports loudness helpers", async () => {
    const mod = await import("../app/lib/lufs-meter.js");
    expect(typeof mod.measureIntegratedLoudnessSync).toBe("function");
    expect(typeof mod.applyTargetIntegratedLufs).toBe("function");
  });
});
