/**
 * Optional Co-Producer LLM refine: image/audio analysis → Suno v5.5 Style line.
 * Falls back to the provided heuristic when LLM is unavailable or fails.
 */

import { z } from "zod";
import { DEFAULT_LLM_SETTINGS, LLM_REQUEST_TIMEOUT_MS, isCoProducerLlmReady } from "./co-producer-llm";
import { formatApiError } from "./api-error-messages";
import { SUNO_STYLE_CHAR_CAP } from "./suno-limits";

const StyleLlmSchema = z
  .object({
    styleLine: z.coerce.string().min(8).max(SUNO_STYLE_CHAR_CAP),
    negativeHints: z.coerce.string().max(160).optional().default(""),
    lyricThemeHint: z.coerce.string().max(120).optional().default(""),
  })
  .strict();

/**
 * @param {string} raw
 */
export function parseSunoStyleLlmResponse(raw) {
  const text = String(raw || "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("Style LLM did not return JSON");
  }
  const parsed = JSON.parse(text.slice(start, end + 1));
  const result = StyleLlmSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("Style LLM response failed validation");
  }
  return result.data;
}

/**
 * @param {"image"|"audio"} kind
 * @param {object} heuristic — from buildSunoV55StyleFrom*
 * @param {object} report — analysis report
 */
export function buildSunoStyleLlmMessages(kind, heuristic, report) {
  const system = `You are a Suno v5.5 Style engineer.
Return ONLY valid JSON with keys: styleLine, negativeHints, lyricThemeHint.
styleLine must be comma-separated Style tags in this order: genre, mood, instruments/sounds, production, era/vocal.
Keep styleLine under 280 characters. No lyrics. No markdown. No explanation.`;

  const brief =
    kind === "image"
      ? {
          caption: report?.caption || "",
          visualMood: report?.visualMood || "",
          clipTags: (report?.clipTags || []).slice(0, 5),
          suggestedGenres: report?.suggestedGenres || [],
          suggestedSounds: report?.suggestedSounds || [],
          brightness: report?.brightness,
          saturation: report?.saturation,
          heuristicStyle: heuristic?.styleLine || "",
        }
      : {
          bpm: report?.estimatedBpm || "",
          key: report?.estimatedKey || "",
          energy: report?.energy,
          aggression: report?.aggression,
          genres: report?.suggestedGenres || [],
          subgenres: report?.suggestedSubgenres || [],
          sounds: report?.suggestedSounds || [],
          moods: report?.suggestedMoods || [],
          vocals: report?.vocals || "",
          heuristicStyle: heuristic?.styleLine || "",
        };

  const user = `Refine this ${kind} analysis into a Suno v5.5 Style line:\n${JSON.stringify(brief)}`;

  return { system, user };
}

/**
 * @param {"image"|"audio"} kind
 * @param {ReturnType<import("./image-to-suno-style").buildSunoV55StyleFromImageAnalysis>} heuristic
 * @param {object} report
 * @param {object} settings
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 */
export async function refineSunoStyleWithLlm(kind, heuristic, report, settings, options = {}) {
  if (!isCoProducerLlmReady(settings)) {
    return { ...heuristic, source: "heuristic" };
  }

  const { system, user } = buildSunoStyleLlmMessages(kind, heuristic, report);
  const timeoutMs = options.timeoutMs ?? LLM_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (options.signal) {
    if (options.signal.aborted) {
      clearTimeout(timeoutId);
      controller.abort();
    } else {
      options.signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  try {
    const res = await fetch(String(settings.apiUrl).trim(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${String(settings.apiKey).trim()}`,
      },
      body: JSON.stringify({
        model: settings.model || DEFAULT_LLM_SETTINGS.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.55,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(formatApiError(res.status, errText, "Style LLM request"));
    }

    const data = await res.json();
    const content = String(data?.choices?.[0]?.message?.content || "").trim();
    const parsed = parseSunoStyleLlmResponse(content);

    return {
      ...heuristic,
      styleLine: parsed.styleLine.trim(),
      negativeHints: String(parsed.negativeHints || heuristic.negativeHints || "").trim(),
      lyricThemeHint: String(parsed.lyricThemeHint || heuristic.lyricThemeHint || "").trim(),
      source: "llm",
    };
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`Style LLM timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Refine with LLM when ready; otherwise return heuristic. Never throws for LLM failures.
 * @param {"image"|"audio"} kind
 * @param {object} heuristic
 * @param {object} report
 * @param {object|null|undefined} settings
 * @param {{ timeoutMs?: number, signal?: AbortSignal }} [options]
 */
export async function refineSunoStyleWithLlmOrHeuristic(kind, heuristic, report, settings, options = {}) {
  if (!isCoProducerLlmReady(settings)) {
    return { ...heuristic, source: "heuristic" };
  }
  try {
    return await refineSunoStyleWithLlm(kind, heuristic, report, settings, options);
  } catch {
    return { ...heuristic, source: "heuristic" };
  }
}
