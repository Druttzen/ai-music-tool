/**
 * Music Video suite handoff (Glitchframe-oriented) — export folder + launch/docs.
 */

import { isTauriApp } from "./dsp-bridge";
import {
  getAddonStatus,
  installAddon,
  launchAddon,
  MUSIC_VIDEO_ADDON,
  formatAddonInstallStatus,
} from "./suite-addons-client";

function isElectronApp() {
  return typeof window !== "undefined" && Boolean(window.electronAPI);
}

/**
 * Write handoff payload via desktop bridge when available; otherwise open docs.
 * @param {{ audioUrl?: string|null, coverUrl?: string|null, prompt?: string, bpm?: string, idea?: string }} payload
 * @returns {Promise<{ ok: boolean, message: string, mode?: string }>}
 */
export async function openMusicVideoHandoff(payload = {}) {
  const meta = await getAddonStatus("musicVideo").catch(() => ({
    ...MUSIC_VIDEO_ADDON,
    installed: false,
  }));

  if (isTauriApp() && window.__TAURI__?.core?.invoke) {
    try {
      const result = await window.__TAURI__.core.invoke("export_music_video_handoff", {
        prompt: String(payload.prompt || ""),
        bpm: String(payload.bpm || ""),
        idea: String(payload.idea || ""),
        audioUrl: payload.audioUrl || null,
        coverUrl: payload.coverUrl || null,
      });
      if (result?.ok) {
        if (meta.installed) {
          await launchAddon("musicVideo");
          return {
            ok: true,
            message: result.message || "Music video handoff written — tool launched",
            mode: "handoff-launch",
          };
        }
        return {
          ok: true,
          message:
            result.message ||
            "Handoff folder ready — install Music Video (Glitchframe) from Suite Addons, then import the folder",
          mode: "handoff-only",
        };
      }
      return { ok: false, message: result?.error || "Music video handoff failed" };
    } catch {
      /* fall through to browser/docs */
    }
  }

  if (isElectronApp() && window.electronAPI?.exportMusicVideoHandoff) {
    const result = await window.electronAPI.exportMusicVideoHandoff({
      prompt: String(payload.prompt || ""),
      bpm: String(payload.bpm || ""),
      idea: String(payload.idea || ""),
      audioUrl: payload.audioUrl || null,
      coverUrl: payload.coverUrl || null,
    });
    if (result?.ok) {
      if (meta.installed) {
        await launchAddon("musicVideo");
      }
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
