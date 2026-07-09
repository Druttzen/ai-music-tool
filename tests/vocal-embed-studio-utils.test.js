import { describe, expect, it } from "vitest";
import {
  computeVocalEmbedCapabilities,
  resolveVocalEmbedEngineLabel,
  vocalEmbedSynthesizeButtonLabel,
} from "../app/lib/vocal-embed-studio-utils.js";

describe("vocal-embed-studio-utils", () => {
  const readyPlan = {
    stage: "ready",
    sidecarMode: "lyrics-to-vocal-synthesis",
    guideForLyricTiming: true,
  };

  it("computes OpenVPI inference readiness", () => {
    const caps = computeVocalEmbedCapabilities({
      plan: readyPlan,
      sidecarHealth: { vocal_ml_available: true },
      vocalModels: { diffsinger_openvpi: { ready: true } },
      alignPreview: null,
    });
    expect(caps.openvpiInferenceReady).toBe(true);
    expect(caps.canLyricsOnlySynth).toBe(true);
  });

  it("resolves OpenVPI engine label when models report ready", () => {
    expect(
      resolveVocalEmbedEngineLabel({
        guideVocalFile: null,
        plan: readyPlan,
        vocalModels: { diffsinger_openvpi: { ready: true } },
      }),
    ).toBe("openvpi-diffsinger-v1");
  });

  it("prefers sidecar response engine when provided", () => {
    expect(
      resolveVocalEmbedEngineLabel({
        responseEngine: "openvpi-diffsinger-v1",
        guideVocalFile: null,
        plan: readyPlan,
        vocalModels: {},
      }),
    ).toBe("openvpi-diffsinger-v1");
  });

  it("builds synthesize button label for lyrics-only mode", () => {
    expect(
      vocalEmbedSynthesizeButtonLabel({
        plan: readyPlan,
        canLyricsOnlySynth: true,
        hasStoredAlign: false,
        guideVocalFile: null,
        sidecarBusy: false,
      }),
    ).toBe("Synthesize lyrics-only preview");
  });
});
