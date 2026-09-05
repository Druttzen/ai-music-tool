/**
 * Startup auto-install planner: missing extras + Canvas, progress/ETA/size.
 */
import { listSidecarCapabilityRows } from "./sidecar-capabilities";
import { isSidecarExtraAllowlisted, normalizeSidecarExtraId } from "./sidecar-extra-install-client";

const MB = 1_000_000;
const GB = 1_000_000_000;

export const SIDECAR_EXTRAS_CHANGED_EVENT = "aimc-sidecar-extras-changed";

/** Typical first-time download sizes (pip wheels + models). Used for the progress UI. */
export const STARTUP_INSTALL_SPECS = {
  vocal: {
    title: "Vocal DSP (scipy)",
    estimatedBytes: 80 * MB,
    typicalMs: 90_000,
  },
  classify: {
    title: "Genre classifier",
    estimatedBytes: 400 * MB,
    typicalMs: 180_000,
  },
  vision: {
    title: "Image caption / CLIP",
    estimatedBytes: 1.5 * GB,
    typicalMs: 480_000,
  },
  stems: {
    title: "Demucs stem separation",
    estimatedBytes: 2.5 * GB,
    typicalMs: 600_000,
  },
  "stems-melband": {
    title: "Mel-Band RoFormer stems",
    estimatedBytes: 1.2 * GB,
    typicalMs: 480_000,
  },
  generate: {
    title: "MusicGen preview",
    estimatedBytes: 3.5 * GB,
    typicalMs: 900_000,
  },
  "vocal-ml": {
    title: "Vocal ML (torch stack)",
    estimatedBytes: 2 * GB,
    typicalMs: 600_000,
  },
  "vocal-rvc": {
    title: "RVC voice conversion",
    estimatedBytes: 1.5 * GB,
    typicalMs: 600_000,
  },
  cover: {
    title: "Album cover (FLUX text)",
    estimatedBytes: 8 * GB,
    typicalMs: 1_200_000,
  },
  "cover-ref": {
    title: "Album cover from image",
    estimatedBytes: 2.5 * GB,
    typicalMs: 600_000,
  },
  canvas: {
    title: "AI Canvas Tool",
    estimatedBytes: 150 * MB,
    typicalMs: 120_000,
  },
};

/** Smaller extras first so something useful lands before multi-GB models. */
export const STARTUP_INSTALL_ORDER = [
  "vocal",
  "classify",
  "vision",
  "stems",
  "generate",
  "vocal-ml",
  "vocal-rvc",
  "cover",
  "cover-ref",
  "canvas",
];

/**
 * @param {{ e2eFlag?: string, isDesktop?: boolean }} [opts]
 */
export function shouldSkipStartupAddonInstall(opts = {}) {
  const flag = String(opts.e2eFlag ?? "").trim();
  if (flag === "1" || flag.toLowerCase() === "true") return true;
  if (opts.isDesktop === false) return true;
  return false;
}

/**
 * Allowlisted extras reported missing by sidecar /health.
 * @param {{ capabilities?: unknown[], [k: string]: unknown }|null|undefined} health
 * @returns {{ extraId: string, title: string }[]}
 */
export function listMissingSidecarExtrasForInstall(health) {
  if (!health) return [];
  const seen = new Set();
  const out = [];
  for (const row of listSidecarCapabilityRows(health)) {
    if (row.available) continue;
    const extraId = normalizeSidecarExtraId(row.id);
    if (!isSidecarExtraAllowlisted(extraId) || seen.has(extraId)) continue;
    seen.add(extraId);
    out.push({ extraId, title: row.title || extraId });
  }
  return out;
}

/**
 * @param {{ extraId: string, title: string }[]} missingExtras
 * @param {{ canvasInstalled?: boolean, includeCanvas?: boolean }} [opts]
 */
export function buildStartupInstallJobs(missingExtras, opts = {}) {
  const byId = new Map((missingExtras || []).map((row) => [row.extraId, row]));
  const jobs = [];
  const pushExtra = (id) => {
    const hit = byId.get(id);
    if (!hit) return;
    const spec = STARTUP_INSTALL_SPECS[id] || {
      title: hit.title,
      estimatedBytes: 500 * MB,
      typicalMs: 300_000,
    };
    jobs.push({
      id,
      kind: "sidecar-extra",
      title: hit.title || spec.title,
      estimatedBytes: spec.estimatedBytes,
      typicalMs: spec.typicalMs,
    });
    byId.delete(id);
  };

  for (const id of STARTUP_INSTALL_ORDER) {
    if (id === "canvas") {
      if (opts.includeCanvas && opts.canvasInstalled === false) {
        const spec = STARTUP_INSTALL_SPECS.canvas;
        jobs.push({
          id: "canvas",
          kind: "canvas",
          title: spec.title,
          estimatedBytes: spec.estimatedBytes,
          typicalMs: spec.typicalMs,
        });
      }
      continue;
    }
    pushExtra(id);
  }
  for (const leftover of byId.values()) {
    pushExtra(leftover.extraId);
  }
  return jobs;
}

/**
 * @param {number} bytes
 */
export function formatByteSize(bytes) {
  const n = Math.max(0, Number(bytes) || 0);
  if (n < 1000) return `${Math.round(n)} B`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)} KB`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(1)} MB`;
  return `${(n / 1_000_000_000).toFixed(1)} GB`;
}

/**
 * @param {number} ms
 */
export function formatEtaMs(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "Calculating time left…";
  if (ms < 15_000) return "Less than a minute left";
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `About ${minutes} min left`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (rem === 0) return `About ${hours} h left`;
  return `About ${hours} h ${rem} min left`;
}

/**
 * @param {string} line
 * @returns {number|null}
 */
export function parsePipProgressBytes(line) {
  const text = String(line || "");
  const paren = text.match(/\(([\d.]+)\s*(Ki?B|Mi?B|Gi?B)\)/i);
  if (paren) return sizeTokenToBytes(paren[1], paren[2]);
  const frac = text.match(/([\d.]+)\s*\/\s*([\d.]+)\s*(Ki?B|Mi?B|Gi?B)/i);
  if (frac) return sizeTokenToBytes(frac[1], frac[3]);
  return null;
}

function sizeTokenToBytes(value, unit) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  const u = String(unit || "").trim().toLowerCase();
  if (u === "gb" || u === "gib") return Math.round(n * GB);
  if (u === "mb" || u === "mib") return Math.round(n * MB);
  if (u === "kb" || u === "kib") return Math.round(n * 1000);
  return Math.round(n);
}

/**
 * @param {{
 *   jobs: { id: string, estimatedBytes: number, typicalMs: number }[],
 *   completedIds?: string[],
 *   currentId?: string|null,
 *   startedAt?: number,
 *   currentStartedAt?: number,
 *   now?: number,
 *   liveParsedBytes?: number|null,
 * }} input
 */
export function computeStartupInstallSnapshot(input) {
  const jobs = Array.isArray(input.jobs) ? input.jobs : [];
  const completedIds = new Set(input.completedIds || []);
  const currentId = input.currentId || null;
  const now = input.now ?? Date.now();
  const startedAt = input.startedAt ?? now;
  const currentStartedAt = input.currentStartedAt ?? now;
  const liveParsedBytes =
    typeof input.liveParsedBytes === "number" && input.liveParsedBytes >= 0 ? input.liveParsedBytes : null;

  const totalBytes = jobs.reduce((sum, job) => sum + (job.estimatedBytes || 0), 0);
  let doneBytes = 0;
  let remainingTypicalMs = 0;

  for (const job of jobs) {
    if (completedIds.has(job.id)) {
      doneBytes += job.estimatedBytes || 0;
      continue;
    }
    if (job.id === currentId) {
      const elapsed = Math.max(0, now - currentStartedAt);
      const typical = Math.max(1, job.typicalMs || 1);
      const timeFrac = Math.min(0.92, elapsed / typical);
      const fromTime = (job.estimatedBytes || 0) * timeFrac;
      const fromLogs =
        liveParsedBytes != null ? Math.min(liveParsedBytes, (job.estimatedBytes || 0) * 0.98) : 0;
      doneBytes += Math.max(fromTime, fromLogs);
      remainingTypicalMs += Math.max(0, typical - elapsed);
      continue;
    }
    remainingTypicalMs += job.typicalMs || 0;
  }

  const remainingBytes = Math.max(0, totalBytes - doneBytes);
  const elapsedTotal = Math.max(1, now - startedAt);
  const rate = doneBytes / elapsedTotal;
  const etaFromRate = rate > 0 && elapsedTotal > 3_000 ? remainingBytes / rate : remainingTypicalMs;
  const percent = totalBytes > 0 ? Math.min(99, Math.round((doneBytes / totalBytes) * 1000) / 10) : 0;

  return {
    percent,
    doneBytes,
    totalBytes,
    remainingBytes,
    etaMs: etaFromRate,
    etaLabel: formatEtaMs(etaFromRate),
    sizeLabel:
      totalBytes > 0
        ? `${formatByteSize(doneBytes)} of ${formatByteSize(totalBytes)} · ${formatByteSize(remainingBytes)} left`
        : "",
    completedCount: completedIds.size,
    totalCount: jobs.length,
  };
}
