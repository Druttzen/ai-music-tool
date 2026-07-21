/**
 * Music Video suite handoff (Glitchframe-oriented) — export folder + launch/docs.
 */

import { isTauriApp } from "./dsp-bridge";
import {
  installAddon,
  MUSIC_VIDEO_ADDON,
  formatAddonInstallStatus,
} from "./suite-addons-client";

function isElectronApp() {
  return typeof window !== "undefined" && Boolean(window.electronAPI);
}

const MIME_EXTENSIONS = {
  "audio/aac": "m4a",
  "audio/flac": "flac",
  "audio/m4a": "m4a",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function assetExtension(name, mimeType, fallback) {
  const fromName = String(name || "").match(/\.([a-z0-9]{2,5})$/i)?.[1];
  return String(fromName || MIME_EXTENSIONS[String(mimeType || "").toLowerCase()] || fallback)
    .toLowerCase();
}

async function readHandoffAsset(url, name, fallbackExt, signal) {
  if (!url) return null;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Could not read ${name || "handoff asset"}`);
  const blob = await res.blob();
  return {
    buffer: await blob.arrayBuffer(),
    ext: assetExtension(name, blob.type, fallbackExt),
  };
}

/**
 * Write handoff payload via desktop bridge when available; otherwise open docs.
 * @param {{ audioUrl?: string|null, audioName?: string|null, coverUrl?: string|null, coverName?: string|null, prompt?: string, bpm?: string, idea?: string, signal?: AbortSignal }} payload
 * @returns {Promise<{ ok: boolean, message: string, mode?: string }>}
 */
export async function openMusicVideoHandoff(payload = {}) {
  const tauriAvailable = isTauriApp() && window.__TAURI__?.core?.invoke;
  const electronAvailable = isElectronApp() && window.electronAPI?.exportMusicVideoHandoff;
  if (!tauriAvailable && !electronAvailable) {
    if (typeof window !== "undefined") {
      window.open(MUSIC_VIDEO_ADDON.installUrl, "_blank", "noopener,noreferrer");
    }
    return {
      ok: true,
      message:
        "Opened Music Video (Glitchframe) docs — export media from a desktop build",
      mode: "docs",
    };
  }

  const [audioAsset, coverAsset] = await Promise.all([
    readHandoffAsset(payload.audioUrl, payload.audioName || "track.wav", "wav", payload.signal),
    readHandoffAsset(payload.coverUrl, payload.coverName || "cover.png", "png", payload.signal),
  ]);

  if (tauriAvailable) {
    try {
      const result = await window.__TAURI__.core.invoke("export_music_video_handoff", {
        prompt: String(payload.prompt || ""),
        bpm: String(payload.bpm || ""),
        idea: String(payload.idea || ""),
        audioBytes: audioAsset ? Array.from(new Uint8Array(audioAsset.buffer)) : null,
        audioExt: audioAsset?.ext || null,
        coverBytes: coverAsset ? Array.from(new Uint8Array(coverAsset.buffer)) : null,
        coverExt: coverAsset?.ext || null,
      });
      if (result?.ok) {
        return {
          ok: true,
          message:
            result.message ||
            "Handoff folder ready — upload the exported assets in Music Video (Glitchframe)",
          mode: result.mode || "handoff",
        };
      }
      return { ok: false, message: result?.error || "Music video handoff failed" };
    } catch {
      /* fall through to browser/docs */
    }
  }

  if (electronAvailable) {
    const result = await window.electronAPI.exportMusicVideoHandoff({
      prompt: String(payload.prompt || ""),
      bpm: String(payload.bpm || ""),
      idea: String(payload.idea || ""),
      audioBuffer: audioAsset?.buffer || null,
      audioExt: audioAsset?.ext || null,
      coverBuffer: coverAsset?.buffer || null,
      coverExt: coverAsset?.ext || null,
    });
    if (result?.ok) {
      return {
        ok: true,
        message: result.message || "Music video handoff written",
        mode: result.mode || "handoff",
      };
    }
    return { ok: false, message: result?.error || "Music video handoff failed" };
  }

  // Web / no desktop handoff: open install docs and advise Suite Addons.
  if (typeof window !== "undefined") {
    window.open(MUSIC_VIDEO_ADDON.installUrl, "_blank", "noopener,noreferrer");
  }
  return {
    ok: true,
    message:
      "Opened Music Video (Glitchframe) docs — use Suite Addons to install, then re-run handoff from desktop",
    mode: "docs",
  };
}

export { MUSIC_VIDEO_ADDON, installAddon, formatAddonInstallStatus };
