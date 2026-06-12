import { describe, it, expect } from "vitest";
import {
  DEFAULT_LLM_SETTINGS,
  buildCoProducerLlmMessages,
  isCoProducerLlmReady,
} from "../app/lib/co-producer-llm.js";

describe("co-producer-llm", () => {
  it("is not ready when disabled or missing key", () => {
    expect(isCoProducerLlmReady(DEFAULT_LLM_SETTINGS)).toBe(false);
    expect(isCoProducerLlmReady({ ...DEFAULT_LLM_SETTINGS, enabled: true })).toBe(false);
    expect(
      isCoProducerLlmReady({
        ...DEFAULT_LLM_SETTINGS,
        enabled: true,
        apiKey: "sk-test",
      }),
    ).toBe(true);
  });

  it("buildCoProducerLlmMessages includes Spanish language rules and section tags", () => {
    const { system, user } = buildCoProducerLlmMessages({
      lyricStyle: "Dark poetic",
      lyricLanguage: "Spanish",
      lyricMode: "Structured Song",
      lyricTheme: "night city",
      moodWords: "dark",
      selectedGenres: ["Techno"],
    });
    expect(system).toContain("Spanish");
    expect(system).toContain("no English ad-libs");
    expect(system).toContain("[Verse 1 — Spanish only");
    expect(user).toContain("full lyrics in Spanish");
  });
});
