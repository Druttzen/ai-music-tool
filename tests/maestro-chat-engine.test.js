import { describe, expect, it } from "vitest";
import {
  MAESTRO_COMMANDS,
  buildExtendedStructure,
  buildMaestroReply,
  buildMaestroStylePreview,
  buildRemixPatch,
  buildSurprisePatch,
  createMaestroGreeting,
  matchCatalogOptions,
  parseLanguage,
  parseLyricTheme,
  parseMoodPatch,
  parseTempo,
  parseVocal,
  sanitizeMaestroPatch,
} from "../app/lib/maestro-chat-engine.js";
import { parseMaestroLlmResponse, buildMaestroLlmMessages, enrichMaestroLlmResult } from "../app/lib/maestro-chat-llm.js";
import { SUNO_STYLE_CHAR_CAP } from "../app/lib/suno-limits.js";

const SNAPSHOT = {
  idea: "test track",
  tempo: "120 BPM",
  structure: "intro → outro",
  selectedGenres: ["Techno"],
  selectedRhythms: ["4/4"],
  selectedSounds: ["Heavy sub bass"],
  vocal: "Instrumental",
  instrumentalVocalFx: false,
  mood: { darkness: 50, energy: 50, aggression: 50, emotion: 50, complexity: 50, space: 50 },
  rules: "",
  lyricTheme: "",
  lyricLanguage: "English",
  lyricStyle: "Dark poetic",
  lyricMode: "Structured Song",
  lyricStructure: "verse → chorus",
  lyricDensity: 55,
  voiceStyleLine: "",
};

describe("maestro-chat-engine parsing", () => {
  it("parses explicit BPM", () => {
    expect(parseTempo("give me something at 140 bpm")).toBe("140 BPM");
  });

  it("parses relative tempo changes from current tempo", () => {
    expect(parseTempo("make it faster", "120 BPM")).toBe("130 BPM");
    expect(parseTempo("way slower please", "120 BPM")).toBe("100 BPM");
  });

  it("clamps BPM to sane range", () => {
    expect(parseTempo("999 bpm")).toBe("260 BPM");
  });

  it("matches catalog genres with word boundaries", () => {
    const genres = matchCatalogOptions("dark deep house with acid techno flavor", [
      "Deep House",
      "House",
      "Acid Techno",
      "Techno",
    ]);
    expect(genres).toContain("Deep House");
    expect(genres).toContain("Acid Techno");
    expect(genres).not.toContain("House");
  });

  it("parses vocal intents", () => {
    expect(parseVocal("with a female vocal please")).toBe("Female Lead");
    expect(parseVocal("make it instrumental only")).toBe("Instrumental");
    expect(parseVocal("add whispered vocals")).toBe("Whispered Lead");
  });

  it("parses mood adjustments", () => {
    const mood = parseMoodPatch("make it darker and more minimal", SNAPSHOT.mood);
    expect(mood.darkness).toBeGreaterThan(50);
    expect(mood.complexity).toBeLessThan(50);
  });

  it("parses lyric theme from 'about' phrasing", () => {
    expect(parseLyricTheme("write lyrics about neon rain")).toBe("neon rain");
  });

  it("parses lyric language", () => {
    expect(parseLanguage("write the lyrics in Spanish")).toBe("Spanish");
  });
});

describe("maestro-chat-engine replies", () => {
  it("returns help for empty or help messages", () => {
    const res = buildMaestroReply("help", SNAPSHOT);
    expect(res.reply).toMatch(/Maestro/);
    expect(res.patch).toBeNull();
  });

  it("builds a patch from a full direction message", () => {
    const res = buildMaestroReply("dark techno at 140 bpm with a female vocal", SNAPSHOT);
    expect(res.patch.tempo).toBe("140 BPM");
    expect(res.patch.selectedGenres).toContain("Techno");
    expect(res.patch.vocal).toBe("Female Lead");
    expect(res.patch.mood.darkness).toBeGreaterThan(50);
    expect(res.artifacts.stylePrompt).toBeTruthy();
    expect(res.artifacts.stylePrompt.length).toBeLessThanOrEqual(SUNO_STYLE_CHAR_CAP);
  });

  it("generates lyrics when asked", () => {
    const res = buildMaestroReply("write lyrics about the night", SNAPSHOT, { rng: () => 0.5 });
    expect(res.artifacts.lyrics).toBeTruthy();
    expect(res.patch.lyricTheme).toBe("the night");
  });

  it("generates hooks when asked", () => {
    const res = buildMaestroReply("give me some hooks", SNAPSHOT, { rng: () => 0.25 });
    expect(res.artifacts.hooks).toBeTruthy();
  });

  it("treats long unmatched text as the track idea", () => {
    const res = buildMaestroReply("a soundtrack for walking through empty streets after rain", SNAPSHOT);
    expect(res.patch.idea).toMatch(/empty streets/);
  });

  it("surprise me applies a factory preset direction", () => {
    const res = buildMaestroReply("surprise me", SNAPSHOT, { rng: () => 0 });
    expect(res.patch.selectedGenres.length).toBeGreaterThan(0);
    expect(res.patch.tempo).toMatch(/BPM/);
    expect(res.artifacts.stylePrompt).toBeTruthy();
  });

  it("falls back gracefully for unclear input", () => {
    const res = buildMaestroReply("zzz", SNAPSHOT);
    expect(res.patch).toBeNull();
    expect(res.reply).toMatch(/didn't catch/i);
  });

  it("remix keeps genres but rerolls groove and palette", () => {
    const res = buildMaestroReply("remix it", SNAPSHOT, { rng: () => 0.4 });
    expect(res.patch.selectedGenres).toBeUndefined();
    expect(res.patch.selectedSounds.length).toBeGreaterThan(0);
    expect(res.patch.mood).toBeTruthy();
    expect(res.artifacts.stylePrompt).toBeTruthy();
  });

  it("extend lengthens the structure", () => {
    const res = buildMaestroReply("extend the track", SNAPSHOT);
    expect(res.patch.structure).toMatch(/final chorus → outro$/i);
  });

  it("buildExtendedStructure replaces trailing outro", () => {
    expect(buildExtendedStructure("intro → drop → outro")).toMatch(/^intro → drop → verse/);
    expect(buildExtendedStructure("")).toMatch(/^intro/);
  });

  it("merge audio analysis emits mergeAudio command when analysis exists", () => {
    const res = buildMaestroReply("use the track analysis", { ...SNAPSHOT, hasAudioAnalysis: true });
    expect(res.commands).toContain("mergeAudio");
  });

  it("musicgen preview emits generateMusicGen when sidecar extra is available", () => {
    const res = buildMaestroReply("generate a quick demo", {
      ...SNAPSHOT,
      musicGenAvailable: true,
      selectedGenres: ["Techno"],
      tempo: "128 BPM",
    });
    expect(res.commands).toContain("generateMusicGen");
    expect(res.commands).toContain("gotoPolish");
    expect(res.artifacts.musicGenPrompt).toMatch(/Techno/);
  });

  it("musicgen preview explains install when unavailable", () => {
    const res = buildMaestroReply("musicgen preview please", { ...SNAPSHOT, musicGenAvailable: false });
    expect(res.commands).not.toContain("generateMusicGen");
    expect(res.reply).toMatch(/sidecar:generate/i);
  });

  it("merge audio analysis without analysis explains what to do", () => {
    const res = buildMaestroReply("use the track analysis", SNAPSHOT);
    expect(res.commands).toEqual([]);
    expect(res.reply).toMatch(/no track analysis yet/i);
  });

  it("merge image analysis emits mergeImage command when analysis exists", () => {
    const res = buildMaestroReply("merge the image analysis", { ...SNAPSHOT, hasImageAnalysis: true });
    expect(res.commands).toContain("mergeImage");
  });

  it("navigation requests emit guided-path commands", () => {
    expect(buildMaestroReply("take me to polish", SNAPSHOT).commands).toContain("gotoPolish");
    const final = buildMaestroReply("go to the final step", SNAPSHOT);
    expect(final.commands).toContain("gotoFinal");
    expect(final.artifacts.stylePrompt).toBeTruthy();
  });

  it("suggests analyzer merge when analysis is present", () => {
    const res = buildMaestroReply("make it darker", { ...SNAPSHOT, hasAudioAnalysis: true });
    expect(res.suggestions).toContain("Use the track analysis");
  });

  it("buildRemixPatch caps sounds and rhythms", () => {
    const remix = buildRemixPatch(SNAPSHOT, () => 0.1);
    expect(remix.patch.selectedSounds.length).toBeLessThanOrEqual(8);
    expect(remix.patch.selectedRhythms.length).toBeLessThanOrEqual(4);
  });
});

describe("maestro-chat-engine safety", () => {
  it("sanitizes patches to allowed keys and shapes", () => {
    const patch = sanitizeMaestroPatch(
      {
        idea: "  ok  ",
        tempo: "128 BPM",
        selectedGenres: ["Techno", "Techno", 5, ""],
        mood: { darkness: 250, energy: -10, bogus: 99 },
        evilKey: "hack",
        instrumentalVocalFx: 1,
      },
      SNAPSHOT,
    );
    expect(patch.idea).toBe("ok");
    expect(patch.selectedGenres).toEqual(["Techno", "5"]);
    expect(patch.mood.darkness).toBe(100);
    expect(patch.mood.energy).toBe(0);
    expect(patch.mood.bogus).toBeUndefined();
    expect(patch.evilKey).toBeUndefined();
    expect(patch.instrumentalVocalFx).toBe(true);
  });

  it("returns null for empty/invalid patches", () => {
    expect(sanitizeMaestroPatch(null, SNAPSHOT)).toBeNull();
    expect(sanitizeMaestroPatch({ evil: 1 }, SNAPSHOT)).toBeNull();
  });

  it("style preview respects the Suno cap", () => {
    const long = {
      ...SNAPSHOT,
      selectedSounds: Array.from({ length: 20 }, (_, i) => `Sound texture number ${i} with long name`),
      rules: Array.from({ length: 30 }, (_, i) => `rule line ${i}`).join("\n"),
    };
    expect(buildMaestroStylePreview(long).length).toBeLessThanOrEqual(SUNO_STYLE_CHAR_CAP);
  });

  it("buildSurprisePatch is deterministic with a seeded rng", () => {
    const a = buildSurprisePatch(() => 0);
    const b = buildSurprisePatch(() => 0);
    expect(a.presetName).toBe(b.presetName);
  });

  it("greeting has suggestions", () => {
    const greeting = createMaestroGreeting();
    expect(greeting.role).toBe("assistant");
    expect(greeting.suggestions.length).toBeGreaterThan(0);
  });
});

describe("maestro-chat-llm", () => {
  it("parses clean JSON responses", () => {
    const res = parseMaestroLlmResponse(
      '{"reply":"Done.","patch":{"tempo":"140 BPM"}}',
      SNAPSHOT,
    );
    expect(res.reply).toBe("Done.");
    expect(res.patch.tempo).toBe("140 BPM");
    expect(res.commands).toEqual([]);
  });

  it("parses and filters commands to the allowed set", () => {
    const res = parseMaestroLlmResponse(
      '{"reply":"Merging.","patch":null,"commands":["mergeAudio","rm -rf","gotoFinal"]}',
      SNAPSHOT,
    );
    expect(res.commands).toEqual(["mergeAudio", "gotoFinal"]);
    for (const c of res.commands) expect(MAESTRO_COMMANDS).toContain(c);
  });

  it("extracts JSON from fenced/prose responses", () => {
    const res = parseMaestroLlmResponse(
      'Sure! ```json\n{"reply":"Set.","patch":{"vocal":"Choir"}}\n```',
      SNAPSHOT,
    );
    expect(res.reply).toBe("Set.");
    expect(res.patch.vocal).toBe("Choir");
  });

  it("rejects LLM responses with unknown top-level keys", () => {
    const res = parseMaestroLlmResponse(
      '{"reply":"Done.","patch":{"tempo":"132 BPM"},"extraTool":"danger"}',
      SNAPSHOT,
    );
    expect(res.reply).toBe("Done.");
    expect(res.patch).toBeNull();
    expect(res.commands).toEqual([]);
    expect(res.artifacts).toBeNull();
  });

  it("rejects malformed patch shapes before sanitizing", () => {
    const res = parseMaestroLlmResponse(
      '{"reply":"Bad patch.","patch":{"mood":{"darkness":80,"bogus":99}}}',
      SNAPSHOT,
    );
    expect(res.reply).toBe("Bad patch.");
    expect(res.patch).toBeNull();
  });

  it("degrades to plain text when JSON is broken", () => {
    const res = parseMaestroLlmResponse("just words, no json", SNAPSHOT);
    expect(res.reply).toBe("just words, no json");
    expect(res.patch).toBeNull();
  });

  it("parses musicGenPrompt artifacts and enriches on generateMusicGen", () => {
    const res = parseMaestroLlmResponse(
      '{"reply":"Sketch ready.","patch":null,"commands":["generateMusicGen","gotoPolish"],"artifacts":{"musicGenPrompt":"dark techno loop"}}',
      SNAPSHOT,
    );
    expect(res.commands).toEqual(["generateMusicGen", "gotoPolish"]);
    expect(res.artifacts?.musicGenPrompt).toBe("dark techno loop");
  });

  it("fills musicGenPrompt when LLM omits artifacts", () => {
    const res = enrichMaestroLlmResult(
      {
        reply: "Generating.",
        patch: null,
        commands: ["generateMusicGen"],
        artifacts: null,
        suggestions: [],
      },
      SNAPSHOT,
    );
    expect(res.artifacts?.musicGenPrompt).toMatch(/Techno/i);
    expect(res.suggestions.length).toBeGreaterThan(0);
  });

  it("parses LLM suggestion chips", () => {
    const res = parseMaestroLlmResponse(
      '{"reply":"Done.","patch":null,"commands":[],"artifacts":null,"suggestions":["Make it darker","Show the style prompt"]}',
      SNAPSHOT,
    );
    expect(res.suggestions).toEqual(["Make it darker", "Show the style prompt"]);
  });

  it("builds system message containing project state and allowed keys", () => {
    const messages = buildMaestroLlmMessages(
      [{ role: "user", text: "darker" }],
      SNAPSHOT,
    );
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toMatch(/selectedGenres/);
    expect(messages[0].content).toMatch(/Techno/);
    expect(messages[0].content).toMatch(/Licensed style catalog hints/);
    expect(messages[0].content).toMatch(/musicGenAvailable/);
    expect(messages[1]).toEqual({ role: "user", content: "darker" });
  });
});
