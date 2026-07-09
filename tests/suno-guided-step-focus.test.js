import { describe, expect, it } from "vitest";
import {
  evaluateGuidedStepCoach,
  getGuidedPanelVisibility,
  guidedCoachFingerprint,
  GUIDED_PANEL_IDS,
  isGuidedPanelVisible,
} from "../app/lib/suno-guided-step-focus.js";

describe("suno-guided-step-focus", () => {
  it("shows all panels when not on Suno-like engine", () => {
    expect(isGuidedPanelVisible(GUIDED_PANEL_IDS.analyzers, "center", 0, "Standard", false)).toBe(
      true,
    );
  });

  it("hides analyzers on early guided steps", () => {
    expect(isGuidedPanelVisible(GUIDED_PANEL_IDS.analyzers, "center", 0, "Suno-like", false)).toBe(
      false,
    );
    expect(isGuidedPanelVisible(GUIDED_PANEL_IDS.analyzers, "center", 6, "Suno-like", false)).toBe(
      true,
    );
  });

  it("reveals all panels when showAll is enabled", () => {
    expect(isGuidedPanelVisible(GUIDED_PANEL_IDS.variations, "center", 1, "Suno-like", true)).toBe(
      true,
    );
  });

  it("always keeps guided path and save/load visible in focus mode", () => {
    const vis = getGuidedPanelVisibility(2, "Suno-like");
    expect(vis.center.has(GUIDED_PANEL_IDS.guidedPath)).toBe(true);
    expect(vis.left.has(GUIDED_PANEL_IDS.saveLoad)).toBe(true);
  });

  it("flags incomplete step 0 on blank project", () => {
    const report = evaluateGuidedStepCoach({
      guidedStep: 0,
      selectedGenres: [],
      tempo: "",
      vocal: "",
    });
    expect(report.complete).toBe(false);
    expect(report.missing.length).toBeGreaterThan(0);
    expect(report.improvements.some((x) => x.action === "fixSunoWarnings")).toBe(true);
  });

  it("marks step 2 complete when groove chips exist", () => {
    const report = evaluateGuidedStepCoach({
      guidedStep: 2,
      selectedGenres: ["Techno"],
      selectedRhythms: ["4/4"],
      selectedSounds: ["Heavy sub bass"],
      tempo: "128 BPM",
      vocal: "Female Lead",
    });
    expect(report.complete).toBe(true);
    expect(report.nextStepName).toBe("Vocal & rules");
  });

  it("suggests lyric generation on step 5 when lyrics are missing", () => {
    const report = evaluateGuidedStepCoach({
      guidedStep: 5,
      vocal: "Female Lead",
      lyricTheme: "night drive",
      lyricStyle: "Dark poetic",
      generatedLyrics: "",
    });
    expect(report.complete).toBe(false);
    expect(report.improvements.some((x) => x.action === "generateExampleLyrics")).toBe(true);
  });

  it("builds stable coach fingerprints", () => {
    const report = evaluateGuidedStepCoach({
      guidedStep: 7,
      sunoWarnings: ["Add at least one genre in DNA (genres row)."],
    });
    const a = guidedCoachFingerprint(report);
    const b = guidedCoachFingerprint(report);
    expect(a).toBe(b);
    expect(a).toContain("7:0:");
  });
});
