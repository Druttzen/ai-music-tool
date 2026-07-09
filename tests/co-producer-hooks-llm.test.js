import { describe, expect, it } from "vitest";
import { buildCoProducerHooksLlmMessages } from "../app/lib/co-producer-llm.js";

describe("co-producer hooks llm", () => {
  it("builds hook generation messages", () => {
    const { system, user, styleLabel } = buildCoProducerHooksLlmMessages({
      lyricStyle: "Dark poetic",
      lyricTheme: "neon rain",
      lyricLanguage: "English",
      vocal: "Female Lead",
      selectedGenres: ["Techno"],
      moodWords: "dark, driving",
      idea: "night city",
    });
    expect(system).toMatch(/hook sketches/i);
    expect(system).toMatch(/Dark poetic/);
    expect(user).toMatch(/neon rain/);
    expect(styleLabel).toBe("Dark poetic");
  });
});
