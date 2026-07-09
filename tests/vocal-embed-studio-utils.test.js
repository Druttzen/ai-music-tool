import { describe, expect, it } from "vitest";
import { buildOpenvpiDsExport } from "../app/lib/openvpi-ds-export.js";
import {
  buildAlignPreviewPersistence,
  computeVocalEmbedCapabilities,
  hydrateAlignFromStoredSession,
  resolveVocalEmbedEngineLabel,
  shouldClearAlignOnGuideChange,
  shouldClearAlignOnInstrumentalChange,
  shouldClearAlignOnLyricsChange,
  vocalEmbedSynthesizeButtonLabel,
} from "../app/lib/vocal-embed-studio-utils.js";
import { buildVocalEmbedPlan } from "../app/lib/vocal-embed-engine.js";

const AUDIO = { fileName: "beat.wav", duration: 120, estimatedBpm: "120 BPM", estimatedKey: "Am" };

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

  it("clears align when instrumental file name changes", () => {
    expect(shouldClearAlignOnInstrumentalChange("a.wav", "b.wav")).toBe(true);
    expect(shouldClearAlignOnInstrumentalChange("a.wav", "a.wav")).toBe(false);
    expect(shouldClearAlignOnInstrumentalChange(undefined, "a.wav")).toBe(false);
  });

  it("clears align when guide vocal file reference changes", () => {
    const a = new File(["a"], "guide-a.wav", { type: "audio/wav" });
    const b = new File(["b"], "guide-b.wav", { type: "audio/wav" });
    expect(shouldClearAlignOnGuideChange(a, b)).toBe(true);
    expect(shouldClearAlignOnGuideChange(a, a)).toBe(false);
  });

  it("clears align when generated lyrics change and preview exists", () => {
    expect(shouldClearAlignOnLyricsChange("[Verse]\nOne", "[Verse]\nTwo", { word_count: 1 })).toBe(
      true,
    );
    expect(shouldClearAlignOnLyricsChange("[Verse]\nOne", "[Verse]\nOne", { word_count: 1 })).toBe(
      false,
    );
    expect(shouldClearAlignOnLyricsChange("[Verse]\nOne", "[Verse]\nTwo", null)).toBe(false);
  });

  it("hydrates stored align when instrumental names match", () => {
    const preview = { align_method: "heuristic", word_count: 2, sections: [] };
    const hydrated = hydrateAlignFromStoredSession(
      { instrumentalName: "beat.wav", preview, openvpiDs: { segment_count: 1 } },
      "beat.wav",
    );
    expect(hydrated?.alignPreview).toBe(preview);
    expect(hydrated?.storedOpenvpiDs).toEqual({ segment_count: 1 });
    expect(hydrateAlignFromStoredSession({ instrumentalName: "other.wav", preview }, "beat.wav")).toBe(
      null,
    );
  });

  it("buildAlignPreviewPersistence writes OpenVPI ds when plan is ready", () => {
    const plan = buildVocalEmbedPlan({
      audioAnalysis: AUDIO,
      generatedLyrics: "[Verse]\nSing this line",
      voiceStyleLine: "warm baritone",
      vocal: "Male Lead",
    });
    const preview = {
      align_method: "heuristic",
      word_count: 3,
      sections: [{ alignedWords: [{ word: "Sing", start: 0, end: 0.2 }] }],
    };
    const persisted = buildAlignPreviewPersistence({
      plan,
      preview,
      instrumentalName: "beat.wav",
      guideName: "guide.wav",
      buildOpenvpiDs: buildOpenvpiDsExport,
    });
    expect(persisted.storage?.instrumentalName).toBe("beat.wav");
    expect(persisted.storedOpenvpiDs?.segment_count).toBeGreaterThan(0);
    expect(persisted.storage?.openvpiDs?.segments?.length).toBeGreaterThan(0);
  });

  it("buildAlignPreviewPersistence clears storage when preview is null", () => {
    const plan = buildVocalEmbedPlan({ audioAnalysis: AUDIO, generatedLyrics: "[Verse]\nLine" });
    const cleared = buildAlignPreviewPersistence({
      plan,
      preview: null,
      buildOpenvpiDs: buildOpenvpiDsExport,
    });
    expect(cleared.alignPreview).toBeNull();
    expect(cleared.storage).toBeNull();
  });
});
