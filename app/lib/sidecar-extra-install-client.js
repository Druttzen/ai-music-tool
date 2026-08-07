/**
 * In-app install for opt-in sidecar extras (dev / writable ai-sidecar/.venv).
 */
import { isTauriApp } from "./dsp-bridge";
import { isDesktopAddonHost } from "./canvas-addon-client";
import { fetchSidecarHealth, resetSidecarHealthCache } from "./sidecar-bridge";

/** @type {Record<string, string>} */
export const SIDECAR_EXTRA_NPM = {
  stems: "npm run sidecar:stems",
  generate: "npm run sidecar:generate",
  classify: "npm run sidecar:classify",
  vision: "npm run sidecar:vision",
  cover: "npm run sidecar:cover",
  "cover-ref": "npm run sidecar:cover-ref",
  vocal: "npm run sidecar:vocal",
  "vocal-ml": "npm run sidecar:vocal-ml",
  "vocal-rvc": "npm run sidecar:vocal-rvc",
};

/** Normalize health capability ids to install script / npm keys. */
export function normalizeSidecarExtraId(id) {
  const raw = String(id || "").trim();
  if (raw === "vocal_ml") return "vocal";
  if (raw === "rvc") return "vocal-rvc";
  if (raw === "genre") return "classify";
  return raw;
}

export function sidecarExtraNpmHint(id) {
  const key = normalizeSidecarExtraId(id);
  return SIDECAR_EXTRA_NPM[key] || `npm run sidecar:${key}`;
}

export function isSidecarExtraAllowlisted(id) {
  const key = normalizeSidecarExtraId(id);
  return Object.prototype.hasOwnProperty.call(SIDECAR_EXTRA_NPM, key);
}

function tauriInvoke(command, args) {
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) throw new Error("Tauri runtime not available");
  return invoke(command, args);
}

function isElectronApp() {
  return typeof window !== "undefined" && Boolean(window.electronAPI);
}

/**
 * @param {string} extraId
 * @returns {Promise<{ ok: boolean, extraId?: string, mode?: string, message?: string, error?: string, installHint?: string }>}
 */
export async function installSidecarExtra(extraId) {
  const id = normalizeSidecarExtraId(extraId);
  const hint = sidecarExtraNpmHint(id);

  if (!isSidecarExtraAllowlisted(id)) {
    return { ok: false, extraId: id, error: `Unknown sidecar extra: ${id}`, installHint: hint };
  }

  if (isTauriApp()) {
    return tauriInvoke("install_sidecar_extra", { extraId: id });
  }
  if (isElectronApp() && window.electronAPI?.installSidecarExtra) {
    return window.electronAPI.installSidecarExtra(id);
  }

  // Browser / web: copy npm hint; do not pretend pip ran.
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(hint);
      return {
        ok: true,
        extraId: id,
        mode: "copied-command",
        message: `Copied “${hint}” — run in the repo, then restart the sidecar`,
        installHint: hint,
      };
    } catch {
      /* fall through */
    }
  }
  return {
    ok: false,
    extraId: id,
    mode: "desktop-or-cli",
    error: isDesktopAddonHost()
      ? "Sidecar extra install is unavailable in this shell"
      : `Run in the repo: ${hint}`,
    installHint: hint,
  };
}

export function formatSidecarExtraInstallStatus(result) {
  if (!result) return "Could not install sidecar extra";
  if (result.ok) {
    if (result.message) return result.message;
    if (result.mode === "copied-command") return result.message || "Install command copied";
    return `Installed ${result.extraId || "extra"} — restart sidecar if needed`;
  }
  if (result.mode === "bundled-readonly") {
    return (
      result.error ||
      "Packaged Studio sidecar cannot install pip extras — use a local ai-sidecar/.venv (dev) or run the npm hint"
    );
  }
  return result.error || result.message || "Could not install sidecar extra";
}

/** True when pip install actually ran (not clipboard / docs). */
export function sidecarExtraInstallCompleted(result) {
  return Boolean(result?.ok && result.mode === "installed");
}

/**
 * Bust health cache and re-fetch after an extra install / sidecar restart.
 * @returns {Promise<import("./sidecar-bridge").SidecarHealth | null>}
 */
export async function fetchSidecarHealthAfterExtraInstall() {
  resetSidecarHealthCache();
  try {
    return await fetchSidecarHealth();
  } catch {
    return null;
  }
}
