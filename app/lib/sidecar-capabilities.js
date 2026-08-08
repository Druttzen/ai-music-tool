/**
 * Registry-driven install hints from sidecar /health capabilities.
 */

/**
 * @typedef {{ id: string, title: string, install_hint: string, available?: boolean, prompt_install?: boolean }} CapabilityLike
 */

/**
 * Prefer registry capabilities; fall back to legacy boolean health flags.
 * @param {{ capabilities?: CapabilityLike[]|null, generate_available?: boolean, stems_available?: boolean, vision_available?: boolean, cover_available?: boolean, cover_ref_available?: boolean, genre_available?: boolean, vocal_synthesis_available?: boolean, vocal_ml_available?: boolean, vocal_rvc_available?: boolean }|null|undefined} health
 * @returns {{ id: string, title: string, install_hint: string }[]}
 */
export function missingSidecarInstallHints(health) {
  if (!health) return [];

  if (Array.isArray(health.capabilities) && health.capabilities.length) {
    return health.capabilities
      .filter((c) => c.prompt_install !== false && !c.available)
      .map((c) => ({
        id: c.id,
        title: c.title || c.id,
        install_hint: c.install_hint || "",
      }))
      .filter((c) => c.install_hint);
  }

  /** @type {{ id: string, title: string, flag: string, install_hint: string }[]} */
  const legacy = [
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

  return legacy
    .filter((row) => health[row.flag] === false)
    .map(({ id, title, install_hint }) => ({ id, title, install_hint }));
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
