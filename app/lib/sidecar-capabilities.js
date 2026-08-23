/**
 * Registry-driven install hints from sidecar /health capabilities.
 */

/**
 * @typedef {{ id: string, title: string, install_hint: string, available?: boolean, prompt_install?: boolean, commercial_use?: boolean, license?: string, tasks?: string[] }} CapabilityLike
 */

/** @type {{ id: string, title: string, flag: string, install_hint: string }[]} */
const LEGACY_INSTALLABLE = [
  { id: "stems", title: "Demucs stem separation", flag: "stems_available", install_hint: "npm run sidecar:stems" },
  { id: "generate", title: "MusicGen preview", flag: "generate_available", install_hint: "npm run sidecar:generate" },
  { id: "genre", title: "Genre classifier", flag: "genre_available", install_hint: "npm run sidecar:classify" },
  { id: "vision", title: "Image caption / CLIP", flag: "vision_available", install_hint: "npm run sidecar:vision" },
  { id: "cover", title: "Album cover (FLUX text)", flag: "cover_available", install_hint: "npm run sidecar:cover" },
  {
    id: "cover-ref",
    title: "Album cover from image",
    flag: "cover_ref_available",
    install_hint: "npm run sidecar:cover-ref",
  },
  {
    id: "vocal_ml",
    title: "Vocal DSP (scipy)",
    flag: "vocal_ml_available",
    install_hint: "npm run sidecar:vocal",
  },
  { id: "rvc", title: "RVC voice conversion", flag: "vocal_rvc_available", install_hint: "npm run sidecar:vocal-rvc" },
];

/**
 * All installable sidecar capabilities with live available status (for Addons status UI).
 * @param {{ capabilities?: CapabilityLike[]|null, generate_available?: boolean, stems_available?: boolean, vision_available?: boolean, cover_available?: boolean, cover_ref_available?: boolean, genre_available?: boolean, vocal_ml_available?: boolean, vocal_rvc_available?: boolean }|null|undefined} health
 * @returns {{ id: string, title: string, install_hint: string, available: boolean, commercial_use?: boolean|null, license?: string, tasks?: string[] }[]}
 */
export function listSidecarCapabilityRows(health) {
  if (!health) return [];

  if (Array.isArray(health.capabilities) && health.capabilities.length) {
    return health.capabilities
      .filter((c) => c.prompt_install !== false)
      .map((c) => ({
        id: c.id,
        title: c.title || c.id,
        install_hint: c.install_hint || "",
        available: Boolean(c.available),
        commercial_use: typeof c.commercial_use === "boolean" ? c.commercial_use : null,
        license: c.license ? String(c.license) : "",
        tasks: Array.isArray(c.tasks) ? c.tasks.map(String).filter(Boolean) : [],
      }))
      .filter((c) => c.install_hint || c.available);
  }

  return LEGACY_INSTALLABLE.filter((row) => typeof health[row.flag] === "boolean").map(
    ({ id, title, install_hint, flag }) => ({
      id,
      title,
      install_hint,
      available: health[flag] === true,
      commercial_use: null,
      license: "",
      tasks: [],
    }),
  );
}

/**
 * Sort extras for the Addons list: action-needed first, then installed.
 * @param {{ id: string, available?: boolean }[]} rows
 * @param {Record<string, string>} [errorsByExtraId]
 * @param {(id: string) => string} [normalizeId]
 */
export function sortSidecarCapabilityRows(rows, errorsByExtraId = {}, normalizeId = (id) => id) {
  const rank = (row) => {
    const id = normalizeId(row.extraId || row.id);
    if (errorsByExtraId[id]) return 0;
    if (!row.available) return 1;
    return 2;
  };
  return [...rows].sort((a, b) => {
    const d = rank(a) - rank(b);
    if (d !== 0) return d;
    return String(a.title || a.id).localeCompare(String(b.title || b.id));
  });
}

/**
 * Per-extra visual status for Addons rows.
 * @param {{ available?: boolean }} row
 * @param {{ installing?: boolean, error?: string }} [opts]
 * @returns {{ label: string, tone: "ok"|"info"|"warn"|"muted"|"bad", borderClass: string }}
 */
export function formatSidecarExtraRowStatus(row, opts = {}) {
  if (opts.installing) {
    return {
      label: "Installing",
      tone: "info",
      borderClass: "border-cyan-400/35 bg-cyan-500/10",
    };
  }
  if (opts.error) {
    return {
      label: "Failed",
      tone: "bad",
      borderClass: "border-rose-400/35 bg-rose-500/10",
    };
  }
  if (row?.available) {
    return {
      label: "Installed",
      tone: "ok",
      borderClass: "border-emerald-400/25 bg-emerald-500/5",
    };
  }
  return {
    label: "Missing",
    tone: "muted",
    borderClass: "border-white/10 bg-black/25",
  };
}

/**
 * Prefer registry capabilities; fall back to legacy boolean health flags.
 * @param {{ capabilities?: CapabilityLike[]|null, generate_available?: boolean, stems_available?: boolean, vision_available?: boolean, cover_available?: boolean, cover_ref_available?: boolean, genre_available?: boolean, vocal_synthesis_available?: boolean, vocal_ml_available?: boolean, vocal_rvc_available?: boolean }|null|undefined} health
 * @returns {{ id: string, title: string, install_hint: string }[]}
 */
export function missingSidecarInstallHints(health) {
  return listSidecarCapabilityRows(health)
    .filter((c) => !c.available && c.install_hint)
    .map(({ id, title, install_hint }) => ({ id, title, install_hint }));
}

/**
 * Visual chip for pip install environment (probe mode).
 * @param {{ mode?: string, writable?: boolean, message?: string }|null|undefined} env
 * @returns {{ label: string, tone: "ok"|"info"|"warn"|"muted", detail: string }}
 */
export function formatSidecarInstallEnvChip(env) {
  const mode = String(env?.mode || "").trim();
  const detail = String(env?.message || "").trim();
  switch (mode) {
    case "writable":
      return { label: "Writable", tone: "ok", detail };
    case "user-data-bootstrap":
      return { label: "First-time setup", tone: "info", detail };
    case "bundled-readonly":
      return { label: "Read-only", tone: "warn", detail };
    case "cli-only":
      return { label: "CLI only", tone: "warn", detail };
    default:
      return {
        label: mode || "Unknown",
        tone: "muted",
        detail: detail || "Install environment not probed yet",
      };
  }
}

/**
 * Visual chip for sidecar process connectivity.
 * @param {string|null|undefined} status checking|ready|standby|offline
 * @returns {{ label: string, tone: "ok"|"info"|"warn"|"muted"|"bad" }}
 */
export function formatSidecarProcessChip(status) {
  switch (String(status || "").trim()) {
    case "ready":
      return { label: "Sidecar ready", tone: "ok" };
    case "standby":
      return { label: "Sidecar standby", tone: "info" };
    case "checking":
      return { label: "Checking sidecar…", tone: "muted" };
    case "offline":
      return { label: "Sidecar offline", tone: "bad" };
    default:
      return { label: "Sidecar unknown", tone: "muted" };
  }
}

/**
 * Short device line for Addons / status UI.
 * @param {{ device?: string, device_info?: { device?: string, backend?: string, name?: string, total_vram_gb?: number }|null }|null|undefined} health
 */
export function formatSidecarDeviceSummary(health) {
  if (!health) return "";
  const info = health.device_info;
  if (info && typeof info === "object") {
    const device = info.device || health.device || "cpu";
    const backend = info.backend || device;
    const name = info.name ? String(info.name).trim() : "";
    const vram =
      typeof info.total_vram_gb === "number" && info.total_vram_gb > 0
        ? ` · ${info.total_vram_gb.toFixed(1)} GB VRAM`
        : "";
    if (name) return `${device} (${backend}) · ${name}${vram}`;
    return `${device} (${backend})${vram}`;
  }
  return health.device ? String(health.device) : "";
}

/**
 * Count available registry capabilities (or legacy flags when registry absent).
 * @param {{ capabilities?: CapabilityLike[]|null, generate_available?: boolean, stems_available?: boolean, vision_available?: boolean, cover_available?: boolean, cover_ref_available?: boolean, genre_available?: boolean, vocal_ml_available?: boolean, vocal_rvc_available?: boolean }|null|undefined} health
 */
export function countAvailableSidecarCapabilities(health) {
  if (!health) return { available: 0, total: 0 };
  if (Array.isArray(health.capabilities) && health.capabilities.length) {
    const total = health.capabilities.length;
    const available = health.capabilities.filter((c) => c.available).length;
    return { available, total };
  }
  const flags = [
    "stems_available",
    "generate_available",
    "genre_available",
    "vision_available",
    "cover_available",
    "cover_ref_available",
    "vocal_ml_available",
    "vocal_rvc_available",
  ];
  const known = flags.filter((f) => typeof health[f] === "boolean");
  const available = known.filter((f) => health[f] === true).length;
  return { available, total: known.length };
}

/**
 * @param {{ capabilities?: CapabilityLike[]|null, generate_available?: boolean }|null|undefined} health
 */
export function musicGenInstallHint(health) {
  const hit = missingSidecarInstallHints(health).find((c) => c.id === "generate");
  return hit?.install_hint || "npm run sidecar:generate";
}

/**
 * @param {{ capabilities?: CapabilityLike[]|null, cover_available?: boolean }|null|undefined} health
 */
export function coverInstallHint(health) {
  const hit = missingSidecarInstallHints(health).find((c) => c.id === "cover");
  return hit?.install_hint || "npm run sidecar:cover";
}

/**
 * @param {{ capabilities?: CapabilityLike[]|null, cover_ref_available?: boolean }|null|undefined} health
 */
export function coverRefInstallHint(health) {
  const hit = missingSidecarInstallHints(health).find((c) => c.id === "cover-ref");
  return hit?.install_hint || "npm run sidecar:cover-ref";
}
