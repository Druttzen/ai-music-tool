import { describe, it, expect } from "vitest";
import { formatCorrelation, makePhaseFixtureBuffer, measureStereoPhase } from "../app/lib/stereo-phase.js";
import { gainToMatchLufs, measureIntegratedLufsFromBytes } from "../app/lib/preview-monitor.js";

describe("measureStereoPhase", () => {
  it("reports near +1 for in-phase stereo", () => {
    const r = measureStereoPhase(makePhaseFixtureBuffer("inPhase"));
    expect(r.correlation).toBeGreaterThan(0.99);
    expect(r.outOfPhase).toBe(false);
    expect(r.monoCancelDb).toBeGreaterThan(-1);
  });

  it("reports near −1 and mono warning for out-of-phase stereo", () => {
    const r = measureStereoPhase(makePhaseFixtureBuffer("outOfPhase"));
    expect(r.correlation).toBeLessThan(-0.99);
    expect(r.outOfPhase).toBe(true);
    expect(r.monoCancelDb).toBeLessThan(-40);
    expect(formatCorrelation(r.correlation)).toMatch(/-/);
  });
});

describe("gainToMatchLufs", () => {
  it("matches reference up to program loudness", () => {
    expect(gainToMatchLufs(-14, -20)).toBeCloseTo(Math.pow(10, 6 / 20), 5);
    expect(gainToMatchLufs(-14, -14)).toBeCloseTo(1, 5);
  });
});

describe("measureIntegratedLufsFromBytes", () => {
  it("is exported for Phase 9 A/B (Symphonia via dsp-bridge in Studio)", () => {
    expect(typeof measureIntegratedLufsFromBytes).toBe("function");
  });
});
