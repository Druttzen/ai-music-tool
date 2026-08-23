/**
 * Always-on left-menu plugin catalog (sidecar extras).
 * Live /health overlays install state; the list does not wait for the sidecar.
 */
import { SIDECAR_EXTRA_NPM, normalizeSidecarExtraId } from "./sidecar-extra-install-client";
import { listSidecarCapabilityRows } from "./sidecar-capabilities";
import { STARTUP_INSTALL_SPECS, formatByteSize, parsePipProgressBytes } from "./sidecar-startup-install";

/** @type {{ id: string, title: string, blurb: string }[]} */
export const STUDIO_SIDECAR_PLUGIN_CATALOG = [
  { id: "stems", title: "Demucs stems", blurb: "Split a mix into drums, bass, vocals, and other." },
  { id: "generate", title: "MusicGen preview", blurb: "Local text-to-music preview clips." },
  { id: "genre", title: "Genre classifier", blurb: "Tag tracks with predicted genres." },
  { id: "vision", title: "Image caption / CLIP", blurb: "Caption stills and score image tags." },
  { id: "cover", title: "Album cover (FLUX)", blurb: "Generate cover art from a text prompt." },
  { id: "cover-ref", title: "Album cover from image", blurb: "Restyle a reference image into cover art." },
  { id: "vocal_ml", title: "Vocal DSP", blurb: "Scipy vocal processing extras." },
  { id: "vocal-ml", title: "Vocal ML", blurb: "Torch vocal models." },
  { id: "rvc", title: "RVC voice conversion", blurb: "Convert vocals with RVC." },
];

/**
 * Full plugin list for the left menu. Sidecar health only toggles Installed vs Missing.
 * @param {{ capabilities?: object[] }|null|undefined} health
 */
export function listStudioPluginCatalog(health) {
  const liveRows = listSidecarCapabilityRows(health);
  const liveById = new Map();
  for (const row of liveRows) {
    liveById.set(row.id, row);
    liveById.set(normalizeSidecarExtraId(row.id), row);
  }

  return STUDIO_SIDECAR_PLUGIN_CATALOG.map((plugin) => {
    const extraId = normalizeSidecarExtraId(plugin.id);
    const live = liveById.get(extraId) || liveById.get(plugin.id);
    return {
      id: plugin.id,
      extraId,
      title: live?.title || plugin.title,
      blurb: plugin.blurb,
      install_hint: live?.install_hint || SIDECAR_EXTRA_NPM[extraId] || `npm run sidecar:${extraId}`,
      available: Boolean(live?.available),
      commercial_use: live?.commercial_use ?? null,
      license: live?.license || "",
      tasks: Array.isArray(live?.tasks) ? live.tasks : [],
    };
  });
}

/**
 * Normalize a Tauri pip-progress event for a plugin row.
 * @param {{ extraId?: string, extra_id?: string, line?: string|null, parsedBytes?: number|null, parsed_bytes?: number|null }|null|undefined} payload
 * @returns {{ extraId: string, line: string, parsedBytes: number|null }}
 */
export function sidecarPluginInstallProgressFromEvent(payload) {
  if (!payload || typeof payload !== "object") {
    return { extraId: "", line: "", parsedBytes: null };
  }
  const extraId = normalizeSidecarExtraId(payload.extraId || payload.extra_id || "");
  const line = String(payload.line || "").trim();
  const parsedBytes =
    typeof payload.parsedBytes === "number"
      ? payload.parsedBytes
      : typeof payload.parsed_bytes === "number"
        ? payload.parsed_bytes
        : parsePipProgressBytes(line);
  return { extraId, line, parsedBytes };
}

/**
 * Rough percent from downloaded bytes vs typical extra size. Null when unknown.
 * @param {string} extraId
 * @param {number|null|undefined} parsedBytes
 * @returns {number|null}
 */
export function sidecarPluginInstallPercent(extraId, parsedBytes) {
  const spec = STARTUP_INSTALL_SPECS[normalizeSidecarExtraId(extraId)];
  const bytes = typeof parsedBytes === "number" ? parsedBytes : 0;
  if (!spec?.estimatedBytes || bytes <= 0) return null;
  return Math.min(99, Math.max(1, Math.round((bytes / spec.estimatedBytes) * 100)));
}

/**
 * Status line under an installing plugin row.
 * @param {{ extraId?: string, line?: string, parsedBytes?: number|null }|null|undefined} progress
 */
export function formatSidecarPluginInstallProgress(progress) {
  if (!progress) return "";
  const percent = sidecarPluginInstallPercent(progress.extraId, progress.parsedBytes);
  const line = String(progress.line || "").trim();
  const size =
    typeof progress.parsedBytes === "number" && progress.parsedBytes > 0
      ? formatByteSize(progress.parsedBytes)
      : "";
  const parts = [];
  if (percent != null) parts.push(`${percent}%`);
  else if (size) parts.push(size);
  if (line) parts.push(line);
  return parts.join(" · ");
}

/**
 * Install button label while pip is running.
 * @param {{ extraId?: string, parsedBytes?: number|null }|null|undefined} progress
 */
export function formatSidecarPluginInstallBusyLabel(progress) {
  const percent = sidecarPluginInstallPercent(progress?.extraId, progress?.parsedBytes);
  if (percent != null) return `${percent}%`;
  return "Installing…";
}
