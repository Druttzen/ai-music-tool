/**
 * Style DNA search settings — Spotify Client Credentials (stored locally only).
 */

import { safeLocalStorage } from "./safe-local-storage";

export const STYLE_DNA_SETTINGS_KEY = "ai_music_creator_style_dna_v1";

export const DEFAULT_STYLE_DNA_SETTINGS = {
  spotifyClientId: "",
  spotifyClientSecret: "",
  auddApiToken: "",
};

export function loadStyleDnaSettings() {
  if (typeof window === "undefined") return { ...DEFAULT_STYLE_DNA_SETTINGS };
  const parsed = safeLocalStorage.getJSON(STYLE_DNA_SETTINGS_KEY, null);
  if (!parsed) return { ...DEFAULT_STYLE_DNA_SETTINGS };
  return { ...DEFAULT_STYLE_DNA_SETTINGS, ...parsed };
}

export function saveStyleDnaSettings(settings) {
  if (typeof window === "undefined") return;
  const next = {
    ...DEFAULT_STYLE_DNA_SETTINGS,
    spotifyClientId: String(settings.spotifyClientId || "").trim(),
    spotifyClientSecret: String(settings.spotifyClientSecret || "").trim(),
    auddApiToken: String(settings.auddApiToken || "").trim(),
  };
  safeLocalStorage.setJSON(STYLE_DNA_SETTINGS_KEY, next);
}

/**
 * @param {typeof DEFAULT_STYLE_DNA_SETTINGS} settings
 */
export function isSpotifyStyleDnaReady(settings) {
  return Boolean(
    String(settings?.spotifyClientId || "").trim() &&
      String(settings?.spotifyClientSecret || "").trim(),
  );
}
