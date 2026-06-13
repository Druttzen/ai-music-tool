/**
 * Voice Character Studio session — active analysis, compact lines, YouTube ref (project JSON + localStorage).
 */

import { safeLocalStorage } from "./safe-local-storage";
import { attachCharacterVoicePresetsToProjectExport } from "./voice-character-preset.js";

export const CHARACTER_VOICE_STUDIO_SESSION_KEY = "ai_music_creator_character_voice_studio_session_v1";
export const CHARACTER_VOICE_STUDIO_SESSION_CHANGED_EVENT = "character-voice-studio-session-changed";

const EMPTY_COMPACT = { style: "", lyricTag: "" };

/**
 * @param {unknown} analysis
 */
function normalizeVoiceAnalysis(analysis) {
  if (!analysis || typeof analysis !== "object") return null;
  if (!analysis.characterLabel) return null;
  const textureTags = Array.isArray(analysis.textureTags)
    ? analysis.textureTags.filter((tag) => typeof tag === "string" && tag.trim())
    : [];
  return { ...analysis, textureTags };
}

/**
 * @param {unknown} ref
 */
function normalizeYoutubeReference(ref) {
  if (!ref || typeof ref !== "object") return null;
  const videoId = String(ref.videoId || "").trim();
  const watchUrl = String(ref.watchUrl || ref.youtubeUrl || "").trim();
  if (!videoId && !watchUrl) return null;
  return {
    videoId: videoId || undefined,
    watchUrl: watchUrl || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : ""),
    title: typeof ref.title === "string" ? ref.title : ref.youtubeTitle || videoId || "",
  };
}

/**
 * @param {unknown} raw
 */
export function normalizeCharacterVoiceStudioSession(raw) {
  if (!raw || typeof raw !== "object") {
    return {
      voiceAnalysis: null,
      voiceStyleCompact: { ...EMPTY_COMPACT },
      youtubeReference: null,
      presetName: "",
    };
  }
  const session = /** @type {Record<string, unknown>} */ (raw);
  const voiceAnalysis = normalizeVoiceAnalysis(session.voiceAnalysis);
  const compact =
    session.voiceStyleCompact && typeof session.voiceStyleCompact === "object"
      ? {
          style: String(session.voiceStyleCompact.style || ""),
          lyricTag: String(session.voiceStyleCompact.lyricTag || ""),
        }
      : { ...EMPTY_COMPACT };
  return {
    voiceAnalysis,
    voiceStyleCompact: compact,
    youtubeReference: normalizeYoutubeReference(session.youtubeReference),
    presetName: String(session.presetName || "").trim(),
  };
}

/**
 * @param {ReturnType<typeof normalizeCharacterVoiceStudioSession>} session
 */
export function isCharacterVoiceStudioSessionEmpty(session) {
  return (
    !session.voiceAnalysis &&
    !session.youtubeReference &&
    !session.presetName &&
    !session.voiceStyleCompact.style &&
    !session.voiceStyleCompact.lyricTag
  );
}

/**
 * @returns {ReturnType<typeof normalizeCharacterVoiceStudioSession>}
 */
export function loadCharacterVoiceStudioSessionFromStorage() {
  const raw = safeLocalStorage.getJSON(CHARACTER_VOICE_STUDIO_SESSION_KEY, null);
  return normalizeCharacterVoiceStudioSession(raw);
}

/**
 * @param {ReturnType<typeof normalizeCharacterVoiceStudioSession>} session
 */
export function saveCharacterVoiceStudioSessionToStorage(session) {
  const normalized = normalizeCharacterVoiceStudioSession(session);
  if (isCharacterVoiceStudioSessionEmpty(normalized)) {
    safeLocalStorage.remove(CHARACTER_VOICE_STUDIO_SESSION_KEY);
    return { ok: true };
  }
  return safeLocalStorage.setJSON(CHARACTER_VOICE_STUDIO_SESSION_KEY, normalized);
}

export function notifyCharacterVoiceStudioSessionChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CHARACTER_VOICE_STUDIO_SESSION_CHANGED_EVENT));
  }
}

/**
 * @param {unknown} session
 */
export function persistCharacterVoiceStudioSession(session) {
  const normalized = normalizeCharacterVoiceStudioSession(session);
  const result = saveCharacterVoiceStudioSessionToStorage(normalized);
  if (result.ok) notifyCharacterVoiceStudioSessionChanged();
  return { ...result, session: normalized };
}

/** Clear active studio session (analysis, YouTube ref, compact lines) — saved character presets are kept. */
export function clearCharacterVoiceStudioSessionOnReset() {
  return persistCharacterVoiceStudioSession({});
}

/**
 * @param {unknown} raw
 */
export function extractCharacterVoiceStudioSessionFromProject(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (!Object.prototype.hasOwnProperty.call(raw, "characterVoiceStudioSession")) return null;
  return normalizeCharacterVoiceStudioSession(raw.characterVoiceStudioSession);
}

/**
 * @param {Record<string, unknown>} projectPayload
 * @param {ReturnType<typeof normalizeCharacterVoiceStudioSession>} [session]
 */
export function attachCharacterVoiceStudioSessionToProjectExport(projectPayload, session) {
  const normalized = normalizeCharacterVoiceStudioSession(
    session ?? loadCharacterVoiceStudioSessionFromStorage(),
  );
  if (isCharacterVoiceStudioSessionEmpty(normalized)) return projectPayload;
  return { ...projectPayload, characterVoiceStudioSession: normalized };
}

/**
 * @param {Record<string, unknown>} projectPayload
 */
export function attachCharacterVoiceFieldsToProjectExport(projectPayload) {
  return attachCharacterVoiceStudioSessionToProjectExport(
    attachCharacterVoicePresetsToProjectExport(projectPayload),
  );
}
