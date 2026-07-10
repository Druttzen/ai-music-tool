/**
 * Optional OpenAI-compatible backend for Maestro Chat.
 * Reuses Co-Producer LLM settings (key stays in localStorage). The model gets
 * the project snapshot and must answer with JSON: { reply, patch } — the patch
 * is sanitized before it touches project state.
 */

import { z } from "zod";
import { DEFAULT_LLM_SETTINGS } from "./co-producer-llm";
import { formatMaestroCatalogGrounding, latestMaestroUserMessage } from "./maestro-catalog-grounding";
import { MAESTRO_COMMANDS, MAESTRO_PATCHABLE_KEYS, sanitizeMaestroPatch } from "./maestro-chat-engine";
import { enrichMaestroLlmResult } from "./maestro-chat-llm-enrich";
import { formatApiError } from "./api-error-messages";

export { enrichMaestroLlmResult } from "./maestro-chat-llm-enrich";

export const MAESTRO_LLM_TIMEOUT_MS = 45_000;

const MaestroPatchSchema = z
  .object({
    idea: z.string().optional(),
    tempo: z.string().optional(),
    structure: z.string().optional(),
    selectedGenres: z.array(z.coerce.string()).optional(),
    selectedRhythms: z.array(z.coerce.string()).optional(),
    selectedSounds: z.array(z.coerce.string()).optional(),
    vocal: z.string().optional(),
    instrumentalVocalFx: z.coerce.boolean().optional(),
    mood: z
      .object({
        darkness: z.coerce.number().finite().optional(),
        energy: z.coerce.number().finite().optional(),
        aggression: z.coerce.number().finite().optional(),
        emotion: z.coerce.number().finite().optional(),
        complexity: z.coerce.number().finite().optional(),
        space: z.coerce.number().finite().optional(),
      })
      .strict()
      .optional(),
    lyricTheme: z.string().optional(),
    lyricLanguage: z.string().optional(),
    lyricStyle: z.string().optional(),
    rules: z.string().optional(),
  })
  .strict();

const MaestroArtifactsSchema = z
  .object({
    musicGenPrompt: z.coerce.string().max(480).optional(),
    stylePrompt: z.coerce.string().max(1000).optional(),
    lyrics: z.coerce.string().max(4000).optional(),
    hooks: z.coerce.string().max(2000).optional(),
    useHighlightMelody: z.coerce.boolean().optional(),
    vocalEmbedBrief: z.coerce.string().max(4000).optional(),
  })
  .strict();

const MaestroLlmResponseSchema = z
  .object({
    reply: z.coerce.string().default("…"),
    patch: MaestroPatchSchema.nullish().default(null),
    commands: z
      .preprocess(
        (value) => (Array.isArray(value) ? value.filter((c) => MAESTRO_COMMANDS.includes(c)) : value),
        z.array(z.enum(MAESTRO_COMMANDS)).nullish().default([]),
      ),
    artifacts: MaestroArtifactsSchema.nullish().default(null),
    suggestions: z
      .preprocess(
        (value) =>
          Array.isArray(value)
            ? value.map((s) => String(s).trim()).filter(Boolean).slice(0, 4)
            : value,
        z.array(z.string().max(80)).nullish().default([]),
      ),
  })
  .strict();

/**
 * @param {Array<{ role: string, text: string }>} history - prior chat turns (oldest first)
 * @param {object} snapshot - current project fields
 */
export function buildMaestroLlmMessages(history, snapshot) {
  const userMessage = latestMaestroUserMessage(history);
  const catalogGrounding = formatMaestroCatalogGrounding(snapshot, userMessage);
  const projectBrief = JSON.stringify(
    {
      idea: snapshot.idea,
      tempo: snapshot.tempo,
      genres: snapshot.selectedGenres,
      rhythms: snapshot.selectedRhythms,
      sounds: snapshot.selectedSounds,
      vocal: snapshot.vocal,
      mood: snapshot.mood,
      lyricTheme: snapshot.lyricTheme,
      lyricStyle: snapshot.lyricStyle,
      lyricLanguage: snapshot.lyricLanguage,
      structure: snapshot.structure,
      rules: snapshot.rules,
      hasAudioAnalysis: !!snapshot.hasAudioAnalysis,
      hasImageAnalysis: !!snapshot.hasImageAnalysis,
      musicGenAvailable: !!snapshot.musicGenAvailable,
      hasMusicGenSketch: !!snapshot.hasMusicGenSketch,
      hasHighlightMelody: !!snapshot.hasHighlightMelody,
      hasVocalAlign: !!snapshot.hasVocalAlign,
      vocalAlignMethod: snapshot.vocalAlignMethod || null,
      vocalAlignWordCount: snapshot.vocalAlignWordCount ?? null,
      openvpiDsSegmentCount: snapshot.openvpiDsSegmentCount ?? 0,
    },
    null,
    0,
  );

  const system = `You are Maestro, an expert music co-producer inside the "AI Music Creator" app. The user is building a Suno prompt project. Current project state: ${projectBrief}
${catalogGrounding ? `\n${catalogGrounding}\n` : ""}
Respond ONLY with a JSON object (no markdown fences): {"reply": string, "patch": object|null, "commands": string[]|null, "artifacts": object|null, "suggestions": string[]|null}
- "reply": short, friendly producer-speak (2-4 sentences max). You may include lyrics or hooks inside reply when asked.
- "patch": fields to update, or null. Allowed keys: ${MAESTRO_PATCHABLE_KEYS.join(", ")}.
  - selectedGenres/selectedRhythms/selectedSounds: string arrays (genres max 3).
  - mood: object with any of darkness/energy/aggression/emotion/complexity/space as 0-100 numbers.
  - tempo: like "128 BPM". vocal: a vocal role label. Others: strings.
- "commands": optional app actions, allowed values: ${MAESTRO_COMMANDS.join(", ")}.
  - mergeAudio/mergeImage: merge the user's analyzer results into the Suno fields (only when hasAudioAnalysis/hasImageAnalysis is true and the user asks to use them).
  - gotoPolish/gotoFinal: jump the guided path to the Polish or final copy step when the user asks to move on.
  - generateMusicGen: render a short MusicGen WAV preview from the current project style (only when musicGenAvailable is true and the user asks for a demo/preview/sketch). Often pair with gotoPolish.
  - generateMusicGenMelody: same as generateMusicGen but conditions on the loaded track audio (melody mode). Use when the user asks to regenerate with melody or has a MusicGen sketch loaded.
  - focusVocalEmbed: scroll to Vocal Embed Studio when the user asks about vocal embed, OpenVPI, DiffSinger, or .ds export (requires hasAudioAnalysis for a useful brief).
- "artifacts": optional { "musicGenPrompt"?: string, "stylePrompt"?: string (≤1000 chars), "lyrics"?: string, "hooks"?: string, "useHighlightMelody"?: boolean, "vocalEmbedBrief"?: string }. When the user asks to see/copy style, lyrics, or hooks, populate these fields directly in JSON (do not leave null and rely on offline fill). Set useHighlightMelody true with generateMusicGenMelody when the user wants the waveform highlight region only. For vocal embed / OpenVPI questions, set focusVocalEmbed in commands and optionally include vocalEmbedBrief (short studio status); the app can fill the brief offline when omitted.
- "suggestions": optional string[] (max 4 short follow-up chips, e.g. "Make it darker", "Show the style prompt", "Generate a MusicGen preview").
Only patch what the user asked to change. Never invent fields outside the allowed keys.`;

  const messages = [{ role: "system", content: system }];
  for (const turn of history.slice(-10)) {
    messages.push({
      role: turn.role === "assistant" ? "assistant" : "user",
      content: String(turn.text || "").slice(0, 2000),
    });
  }
  return messages;
}

/** Extract the first JSON object from an LLM response (tolerates fences/prose). */
export function parseMaestroLlmResponse(raw, snapshot, userMessage = "") {
  const text = String(raw || "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return { reply: text || "…", patch: null, commands: [], artifacts: null, suggestions: [] };
  }
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    const schemaResult = MaestroLlmResponseSchema.safeParse(parsed);
    if (!schemaResult.success) {
      return {
        reply: String(parsed?.reply || text || "…").trim() || "…",
        patch: null,
        commands: [],
        artifacts: null,
        suggestions: [],
      };
    }
    const validated = schemaResult.data;
    const base = {
      reply: validated.reply.trim() || "…",
      patch: sanitizeMaestroPatch(validated.patch, snapshot),
      commands: validated.commands || [],
      artifacts: validated.artifacts || null,
      suggestions: validated.suggestions || [],
    };
    return enrichMaestroLlmResult(base, snapshot, userMessage);
  } catch {
    return { reply: text, patch: null, commands: [], artifacts: null, suggestions: [] };
  }
}

/**
 * @param {Array<{ role: string, text: string }>} history
 * @param {object} snapshot
 * @param {{ apiUrl?: string, apiKey?: string, model?: string }} settings
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<{ reply: string, patch: Record<string, unknown>|null, commands: string[] }>}
 */
export async function sendMaestroChatToLlm(history, snapshot, settings, options = {}) {
  const timeoutMs = options.timeoutMs ?? MAESTRO_LLM_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(String(settings.apiUrl || DEFAULT_LLM_SETTINGS.apiUrl).trim(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${String(settings.apiKey || "").trim()}`,
      },
      body: JSON.stringify({
        model: settings.model || DEFAULT_LLM_SETTINGS.model,
        messages: buildMaestroLlmMessages(history, snapshot),
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(formatApiError(res.status, errText, "Maestro LLM request"));
    }

    const data = await res.json();
    const content = String(data?.choices?.[0]?.message?.content || "").trim();
    if (!content) throw new Error("Maestro LLM returned an empty reply");
    const userMessage =
      [...history].reverse().find((turn) => turn.role === "user")?.text || "";
    return parseMaestroLlmResponse(content, snapshot, userMessage);
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`Maestro LLM timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
