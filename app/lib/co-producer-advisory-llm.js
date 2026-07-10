/**
 * Optional LLM backend for Co-Producer "Improve Prompt" advisory reports.
 * Falls back to heuristic buildCoProducerAdvisoryReport in use-project-actions.
 */

import { z } from "zod";
import { uniq } from "./music-helpers";
import { buildMusicGenPrompt } from "./musicgen-prompt";
import { appendMusicGenSketchToReport, formatMusicGenSketchBrief } from "./co-producer-engine";
import { DEFAULT_LLM_SETTINGS, LLM_REQUEST_TIMEOUT_MS } from "./co-producer-llm";
import { formatApiError } from "./api-error-messages";

const AdvisoryLlmSchema = z
  .object({
    output: z.coerce.string().min(24),
    addSounds: z.array(z.coerce.string()).max(8).optional().default([]),
    addRhythms: z.array(z.coerce.string()).max(4).optional().default([]),
    suggestMode: z.enum(["Control", "Hybrid", "Creative"]).nullish(),
    musicGenSketch: z.coerce.boolean().optional().default(false),
  })
  .strict();

/** @param {string} raw */
export function parseCoProducerAdvisoryLlmResponse(raw) {
  const text = String(raw || "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("Co-Producer LLM did not return JSON");
  }
  const parsed = JSON.parse(text.slice(start, end + 1));
  const result = AdvisoryLlmSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("Co-Producer LLM response failed validation");
  }
  return result.data;
}

/**
 * @param {ReturnType<typeof parseCoProducerAdvisoryLlmResponse>} advisory
 * @param {{ mode?: string, promptIntensity?: number, mood?: object }} ctx
 */
export function coProducerAdvisoryLlmToPatch(advisory, ctx = {}) {
  /** @type {Record<string, unknown>} */
  const patch = {};
  const sounds = (advisory.addSounds || []).map((s) => String(s).trim()).filter(Boolean);
  const rhythms = (advisory.addRhythms || []).map((r) => String(r).trim()).filter(Boolean);

  if (sounds.length) {
    patch.selectedSounds = (s) => uniq([...s, ...sounds]);
  }
  if (rhythms.length) {
    patch.selectedRhythms = (r) => uniq([...r, ...rhythms]);
  }
  if (
    advisory.suggestMode &&
    ctx.mode === "Control" &&
    Number(ctx.promptIntensity) > 75
  ) {
    patch.mode = advisory.suggestMode;
  }
  if (ctx.mood?.energy > 75 && !rhythms.length) {
    patch.selectedRhythms = (r) => uniq([...r, "4/4"]);
  }
  return patch;
}

/**
 * @param {object} input — same shape as buildCoProducerAdvisoryReport
 */
export function buildCoProducerAdvisoryLlmMessages(input) {
  const musicGenSketch = formatMusicGenSketchBrief(input.audioAnalysis);
  const brief = JSON.stringify(
    {
      genres: input.selectedGenres,
      sounds: input.selectedSounds,
      rhythms: input.selectedRhythms,
      mood: input.mood,
      moodWords: input.moodWords,
      tempo: input.tempo,
      vocal: input.vocal,
      lyricTheme: input.lyricTheme,
      promptIntensity: input.promptIntensity,
      mode: input.mode,
      musicGenAvailable: !!input.musicGenAvailable,
      musicGenPrompt: input.musicGenAvailable
        ? buildMusicGenPrompt({
            selectedGenres: input.selectedGenres,
            selectedSounds: input.selectedSounds,
            selectedRhythms: input.selectedRhythms,
            tempo: input.tempo,
            idea: input.idea,
            moodWords: input.moodWords,
            audioAnalysis: input.audioAnalysis,
          })
        : "",
      musicGenSketch,
    },
    null,
    0,
  );

  const system = `You are Co-Producer AI inside "AI Music Creator". Analyze the Suno prompt project and return ONLY JSON (no markdown):
{"output": string, "addSounds": string[], "addRhythms": string[], "suggestMode": "Control"|"Hybrid"|"Creative"|null, "musicGenSketch": boolean}
- "output": multi-line report starting with "CO-PRODUCER AI REPORT" — concise producer advice (fixes, direction, tempo/mood translation). Plain text with newlines.
- "addSounds" / "addRhythms": optional tokens to auto-merge (max 8 sounds, 4 rhythms). Empty arrays if none.
- "suggestMode": only when mode is Control and prompt intensity is high (>75); otherwise null.
- "musicGenSketch": true when genre identity is thin AND musicGenAvailable is true — mention the sketch in output.
When musicGenSketch in the project brief is non-null, reference the loaded local sketch (prompt, BPM, key, melody/highlight mode) in your report.`;

  const user = `Project: ${brief}`;
  return { system, user };
}

/**
 * @param {object} input
 * @param {object} settings
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<{ output: string, patch: Record<string, unknown>, source: "llm" }>}
 */
export async function generateCoProducerAdvisoryWithLlm(input, settings, options = {}) {
  const timeoutMs = options.timeoutMs ?? LLM_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { system, user } = buildCoProducerAdvisoryLlmMessages(input);
    const res = await fetch(String(settings.apiUrl || DEFAULT_LLM_SETTINGS.apiUrl).trim(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${String(settings.apiKey || "").trim()}`,
      },
      body: JSON.stringify({
        model: settings.model || DEFAULT_LLM_SETTINGS.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.65,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(formatApiError(res.status, errText, "Co-Producer LLM"));
    }

    const data = await res.json();
    const content = String(data?.choices?.[0]?.message?.content || "").trim();
    if (!content) throw new Error("Co-Producer LLM returned empty content");

    const advisory = parseCoProducerAdvisoryLlmResponse(content);
    let output = appendMusicGenSketchToReport(
      advisory.output.trim(),
      formatMusicGenSketchBrief(input.audioAnalysis),
    );
    if (advisory.musicGenSketch && input.musicGenAvailable && !formatMusicGenSketchBrief(input.audioAnalysis)) {
      if (!/musicgen sketch/i.test(output)) {
        output += `\n\nTip: Genre identity is thin — try MusicGen sketch (Co-Producer buttons or Polish analyzers) for a local reference loop before Suno.`;
      }
    }

    return {
      output,
      patch: coProducerAdvisoryLlmToPatch(advisory, input),
      source: "llm",
    };
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`Co-Producer LLM timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
