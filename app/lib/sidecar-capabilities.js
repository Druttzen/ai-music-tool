/**
 * Registry-driven install hints from sidecar /health capabilities.
 */

/**
 * @typedef {{ id: string, title: string, install_hint: string, available?: boolean }} CapabilityLike
 */

/**
 * Prefer registry capabilities; fall back to legacy boolean health flags.
 * @param {{ capabilities?: CapabilityLike[]|null, generate_available?: boolean, stems_available?: boolean, vision_available?: boolean, genre_available?: boolean, vocal_synthesis_available?: boolean, vocal_ml_available?: boolean, vocal_rvc_available?: boolean }|null|undefined} health
 * @returns {{ id: string, title: string, install_hint: string }[]}
 */
export function missingSidecarInstallHints(health) {
  if (!health) return [];

  if (Array.isArray(health.capabilities) && health.capabilities.length) {
    const interesting = new Set(["stems", "generate", "genre", "vocal_synth", "vocal_ml", "vision", "rvc"]);
    return health.capabilities
      .filter((c) => interesting.has(c.id) && !c.available)
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
    {
      id: "vocal_synth",
      title: "Vocal embed synthesis",
      flag: "vocal_synthesis_available",
      install_hint: "npm run sidecar:vocal",
    },
    { id: "vocal_ml", title: "Vocal ML stack", flag: "vocal_ml_available", install_hint: "npm run sidecar:vocal-ml" },
    { id: "rvc", title: "RVC voice conversion", flag: "vocal_rvc_available", install_hint: "npm run sidecar:vocal-rvc" },
  ];

  return legacy
    .filter((row) => health[row.flag] === false)
    .map(({ id, title, install_hint }) => ({ id, title, install_hint }));
}

/**
 * @param {{ capabilities?: CapabilityLike[]|null, generate_available?: boolean }|null|undefined} health
 */
export function musicGenInstallHint(health) {
  const hit = missingSidecarInstallHints(health).find((c) => c.id === "generate");
  return hit?.install_hint || "npm run sidecar:generate";
}
