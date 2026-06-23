import { describe, it, expect } from "vitest";
import {
  PROJECT_BUNDLE_FORMAT,
  buildProjectBundleExport,
  mergeCustomPresetsMaps,
  parseProjectBundleImport,
  summarizeProjectBundle,
} from "../app/lib/project-bundle.js";

describe("project-bundle", () => {
  it("buildProjectBundleExport wraps project with custom presets and voice fields", () => {
    const bundle = buildProjectBundleExport(
      {
        idea: "test idea",
        guidedStep: 2,
        characterVoicePresets: { Hero: { firstName: "Ada" } },
      },
      { "My Techno": { genres: ["Techno"], vocal: "Instrumental" } },
      "0.9.10",
    );

    expect(bundle.bundleFormat).toBe(PROJECT_BUNDLE_FORMAT);
    expect(bundle.bundleVersion).toBe(2);
    expect(bundle.appVersion).toBe("0.9.10");
    expect(bundle.project.idea).toBe("test idea");
    expect(bundle.customPresets["My Techno"].genres).toEqual(["Techno"]);
    expect(bundle.characterVoicePresets.Hero.firstName).toBe("Ada");
  });

  it("parseProjectBundleImport accepts bundled and legacy flat JSON", () => {
    const bundled = parseProjectBundleImport({
      bundleFormat: PROJECT_BUNDLE_FORMAT,
      bundleVersion: 1,
      appVersion: "0.9.10",
      exportedAt: "2026-06-03T00:00:00.000Z",
      project: { idea: "bundled" },
      customPresets: { A: { genres: ["Ambient"] } },
      characterVoicePresets: { Lead: { firstName: "Sam" } },
    });
    expect(bundled.project.idea).toBe("bundled");
    expect(bundled.customPresets.A.genres).toEqual(["Ambient"]);
    expect(bundled.project.characterVoicePresets.Lead.firstName).toBe("Sam");

    const legacy = parseProjectBundleImport({
      idea: "legacy",
      customPresets: { B: { genres: ["House"] } },
    });
    expect(legacy.project.idea).toBe("legacy");
    expect(legacy.customPresets.B.genres).toEqual(["House"]);
    expect(legacy.bundleMeta).toBeNull();
  });

  it("mergeCustomPresetsMaps lets import win on name clash", () => {
    const merged = mergeCustomPresetsMaps(
      { A: { genres: ["Techno"] } },
      { A: { genres: ["House"] }, B: { genres: ["Ambient"] } },
    );
    expect(merged.A.genres).toEqual(["House"]);
    expect(merged.B.genres).toEqual(["Ambient"]);
  });

  it("summarizeProjectBundle reports bundle metadata", () => {
    const summary = summarizeProjectBundle({
      bundleFormat: PROJECT_BUNDLE_FORMAT,
      appVersion: "0.9.10",
      exportedAt: "2026-06-03T00:00:00.000Z",
      project: {
        guidedStep: 4,
        characterVoicePresets: {
          X: {
            name: "X",
            analysis: { characterLabel: "Test", textureTags: ["warm"] },
            voiceStyleLine: "Test, warm",
          },
        },
      },
      customPresets: { P: {} },
    });
    expect(summary.ok).toBe(true);
    expect(summary.isBundle).toBe(true);
    expect(summary.customPresetCount).toBe(1);
    expect(summary.characterPresetCount).toBe(1);
    expect(summary.guidedStep).toBe(4);
  });
});
