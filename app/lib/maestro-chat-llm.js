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
import { buildMusicGenPrompt } from "./musicgen-prompt";
import { buildMoodWords } from "./music-helpers";

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
    musicGenPrompt: z.coerce.string().optional(),
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
  })
  .strict();

/**
 * Fill MusicGen prompt artifact when the LLM requests generateMusicGen without one.
 * @param {{ reply: string, patch: object|null, commands: string[], artifacts?: object|null }} result
 * @param {object} snapshot
 */
export function enrichMaestroLlmResult(result, snapshot) {
  const commands = result.commands || [];
  if (!commands.includes("generateMusicGen")) {
    return result;
  }
  const artifacts = { ...(result.artifacts || {}) };
  if (!String(artifacts.musicGenPrompt || "").trim()) {
    artifacts.musicGenPrompt = buildMusicGenPrompt({
      selectedGenres: snapshot.selectedGenres,
      selectedSounds: snapshot.selectedSounds,
      selectedRhythms: snapshot.selectedRhythms,
      tempo: snapshot.tempo,
      idea: snapshot.idea,
      moodWords: buildMoodWords(snapshot.mood),
      audioAnalysis: snapshot.audioAnalysis,
    });
  }
  return { ...result, artifacts };
}

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
    },
    null,
    0,
  );

  const system = `You are Maestro, an expert music co-producer inside the "AI Music Creator" app. The user is building a Suno prompt project. Current project state: ${projectBrief}
${catalogGrounding ? `\n${catalogGrounding}\n` : ""}
Respond ONLY with a JSON object (no markdown fences): {"reply": string, "patch": object|null, "commands": string[]|null, "artifacts": object|null}
- "reply": short, friendly producer-speak (2-4 sentences max). You may include lyrics or hooks inside reply when asked.
- "patch": fields to update, or null. Allowed keys: ${MAESTRO_PATCHABLE_KEYS.join(", ")}.
  - selectedGenres/selectedRhythms/selectedSounds: string arrays (genres max 3).
  - mood: object with any of darkness/energy/aggression/emotion/complexity/space as 0-100 numbers.
  - tempo: like "128 BPM". vocal: a vocal role label. Others: strings.
- "commands": optional app actions, allowed values: ${MAESTRO_COMMANDS.join(", ")}.
  - mergeAudio/mergeImage: merge the user's analyzer results into the Suno fields (only when hasAudioAnalysis/hasImageAnalysis is true and the user asks to use them).
  - gotoPolish/gotoFinal: jump the guided path to the Polish or final copy step when the user asks to move on.
  - generateMusicGen: render a short MusicGen WAV preview from the current project style (only when musicGenAvailable is true and the user asks for a demo/preview/sketch). Often pair with gotoPolish.
- "artifacts": optional { "musicGenPrompt": string } when emitting generateMusicGen — a concise MusicGen text prompt (max 480 chars, instrumental groove description).
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
export function parseMaestroLlmResponse(raw, snapshot) {
  const text = String(raw || "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return { reply: text || "…", patch: null, commands: [], artifacts: null };
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
      };
    }
    const validated = schemaResult.data;
    const base = {
      reply: validated.reply.trim() || "…",
      patch: sanitizeMaestroPatch(validated.patch, snapshot),
      commands: validated.commands || [],
      artifacts: validated.artifacts || null,
    };
    return enrichMaestroLlmResult(base, snapshot);
  } catch {
    return { reply: text, patch: null, commands: [], artifacts: null };
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
      throw new Error(`Maestro LLM request failed (${res.status})${errText ? `: ${errText.slice(0, 120)}` : ""}`);
    }

    const data = await res.json();
    const content = String(data?.choices?.[0]?.message?.content || "").trim();
    if (!content) throw new Error("Maestro LLM returned an empty reply");
    return parseMaestroLlmResponse(content, snapshot);
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`Maestro LLM timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
