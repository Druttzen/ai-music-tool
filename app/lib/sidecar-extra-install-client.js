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

/**
 * /health boolean field for a given install extra id.
 * @param {string} id
 * @returns {keyof import("./sidecar-bridge").SidecarHealth | null}
 */
export function sidecarExtraHealthFlag(id) {
  switch (normalizeSidecarExtraId(id)) {
    case "stems":
      return "stems_available";
    case "generate":
      return "generate_available";
    case "classify":
      return "genre_available";
    case "vision":
      return "vision_available";
    case "cover":
      return "cover_available";
    case "cover-ref":
      return "cover_ref_available";
    case "vocal":
      return "vocal_ml_available";
    case "vocal-rvc":
      return "vocal_rvc_available";
    default:
      return null;
  }
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
 * Probe whether pip extras can install (writable ai-sidecar/.venv).
 * @returns {Promise<{ mode: string, writable: boolean, message: string }>}
 */
export async function probeSidecarExtraInstallEnv() {
  if (isTauriApp()) {
    return tauriInvoke("probe_sidecar_extra_install_env");
  }
  if (isElectronApp() && window.electronAPI?.probeSidecarExtraInstallEnv) {
    return window.electronAPI.probeSidecarExtraInstallEnv();
  }
  // Browser / web: Install copies the npm hint; environment is not desktop-writable here.
  return {
    mode: "cli-only",
    writable: false,
    message: "Browser mode copies the npm install command — use a desktop shell or local checkout for pip extras.",
  };
}

/**
 * @param {string} extraId
 * @returns {Promise<{ ok: boolean, extraId?: string, mode?: string, message?: string, error?: string, installHint?: string, restarted?: boolean }>}
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
        ok: false,
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
  if (result.mode === "copied-command") {
    return result.message || "Install command copied — run it in the repo, then restart the sidecar";
  }
  if (result.ok) {
    if (result.message) return result.message;
    return `Installed ${result.extraId || "extra"} — restart sidecar if needed`;
  }
  if (result.mode === "bundled-readonly") {
    return (
      result.error ||
      "Cannot install pip extras here — need Python 3.10–3.12 (packaged) or a local ai-sidecar/.venv, or run the npm hint"
    );
  }
  if (result.mode === "user-data-bootstrap") {
    return (
      result.message ||
      "Ready to create a user-data sidecar venv — Install will bootstrap Python packages first"
    );
  }
  if (result.mode === "install-timeout") {
    return result.error || "Sidecar extra install timed out — run the npm hint in a terminal";
  }
  return result.error || result.message || "Could not install sidecar extra";
}

/** Status toast tone for an install result. */
export function sidecarExtraInstallStatusTone(result) {
  if (!result) return "error";
  if (sidecarExtraInstallCompleted(result)) return "info";
  if (result.mode === "copied-command") return "warning";
  if (result.ok) return "info";
  return "error";
}

/** True when pip install actually ran (not clipboard / docs). */
export function sidecarExtraInstallCompleted(result) {
  return Boolean(result?.ok && result.mode === "installed");
}

/** True when Install should run pip (checkout or user-data), not clipboard. */
export function sidecarExtraInstallEnvAllowsPip(env) {
  if (!env) return false;
  if (env.writable === true) return true;
  return env.mode === "writable" || env.mode === "user-data-bootstrap";
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll /health until the extra's availability flag is true (or timeout).
 * @param {string} extraId
 * @param {{ timeoutMs?: number, intervalMs?: number }} [options]
 * @returns {Promise<import("./sidecar-bridge").SidecarHealth | null>}
 */
export async function waitForSidecarExtraReady(extraId, options = {}) {
  const timeoutMs = options.timeoutMs ?? 45_000;
  const intervalMs = options.intervalMs ?? 1_000;
  const flag = sidecarExtraHealthFlag(extraId);
  const deadline = Date.now() + timeoutMs;
  let health = await fetchSidecarHealthAfterExtraInstall();
  if (!flag) return health;
  if (health?.[flag]) return health;

  while (Date.now() < deadline) {
    await sleep(intervalMs);
    health = await fetchSidecarHealthAfterExtraInstall();
    if (health?.[flag]) return health;
  }
  return health;
}
