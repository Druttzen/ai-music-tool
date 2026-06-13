import { describe, it, expect } from "vitest";
import { buildMoodWords, buildVocalTextForPrompt } from "../app/lib/music-helpers.js";

describe("music-helpers prompt builders", () => {
  it("buildMoodWords maps sliders to descriptive words", () => {
    const words = buildMoodWords({
      darkness: 80,
      energy: 75,
      aggression: 50,
      emotion: 50,
      complexity: 50,
      space: 50,
    });
    expect(words).toContain("dark");
    expect(words).toContain("high-energy");
  });

  it("buildMoodWords falls back to balanced", () => {
    expect(
      buildMoodWords({
        darkness: 50,
        energy: 50,
        aggression: 50,
        emotion: 50,
        complexity: 50,
        space: 50,
      }),
    ).toBe("balanced");
  });

  it("buildVocalTextForPrompt adds FX variant for instrumental", () => {
    const fx = buildVocalTextForPrompt("Instrumental", true);
    expect(fx).toContain("vocal FX only");
    const plain = buildVocalTextForPrompt("Instrumental", false);
    expect(plain).toContain("instrumental only");
  });
});
