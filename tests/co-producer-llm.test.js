import { describe, it, expect, vi, afterEach } from "vitest";
import {
  DEFAULT_LLM_SETTINGS,
  LLM_PROVIDER_PRESETS,
  applyLlmProviderPreset,
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

  it("provider presets are valid and applying one enables the backend", () => {
    for (const preset of LLM_PROVIDER_PRESETS) {
      expect(preset.apiUrl).toMatch(/^https?:\/\/.+\/chat\/completions$/);
      expect(preset.model.length).toBeGreaterThan(0);
    }
    const applied = applyLlmProviderPreset(DEFAULT_LLM_SETTINGS, LLM_PROVIDER_PRESETS[0]);
    expect(applied.enabled).toBe(true);
    expect(applied.apiUrl).toBe(LLM_PROVIDER_PRESETS[0].apiUrl);
  });

  it("local provider presets are ready without a real key; cloud presets keep the user's key", () => {
    const local = LLM_PROVIDER_PRESETS.find((p) => p.local);
    const applied = applyLlmProviderPreset(DEFAULT_LLM_SETTINGS, local);
    expect(isCoProducerLlmReady(applied)).toBe(true);

    const cloud = LLM_PROVIDER_PRESETS.find((p) => !p.local);
    const withKey = applyLlmProviderPreset({ ...DEFAULT_LLM_SETTINGS, apiKey: "sk-mine" }, cloud);
    expect(withKey.apiKey).toBe("sk-mine");
    const noKey = applyLlmProviderPreset(DEFAULT_LLM_SETTINGS, cloud);
    expect(isCoProducerLlmReady(noKey)).toBe(false);
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

  it("buildCoProducerLlmMessages includes voice character delivery traits", () => {
    const { system, user } = buildCoProducerLlmMessages({
      lyricStyle: "Dark poetic",
      lyricTheme: "night city",
      vocal: "Male Lead",
      voiceStyleCompact: {
        style: "Warm baritone narrator",
        lyricTag: "[Vocal character: Narrator — breathy; trait-based Suno direction]",
      },
    });
    expect(system).toContain("Vocal role for delivery: Male Lead");
    expect(system).toContain("Warm baritone narrator");
    expect(user).toContain("Vocal delivery traits: Warm baritone narrator");
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
