import { describe, it, expect, vi, afterEach } from "vitest";
import {
  DEFAULT_LLM_SETTINGS,
  buildCoProducerLlmMessages,
  generateLyricsWithLlm,
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

  it("generateLyricsWithLlm aborts hung requests", async () => {
    vi.useFakeTimers();
    global.fetch = vi.fn((_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            const err = new Error("Aborted");
            err.name = "AbortError";
            reject(err);
          },
          { once: true },
        );
      }),
    );

    const settings = {
      ...DEFAULT_LLM_SETTINGS,
      enabled: true,
      apiKey: "sk-test",
      apiUrl: "https://example.com/v1/chat/completions",
    };

    const promise = generateLyricsWithLlm(
      { lyricStyle: "Dark poetic", lyricTheme: "night", lyricMode: "Structured Song" },
      settings,
      { timeoutMs: 1000 },
    );
    const assertion = expect(promise).rejects.toThrow(/timed out after 1s/i);

    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});
