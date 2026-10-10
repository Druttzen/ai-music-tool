/**
 * Bridge to the local Python AI sidecar (FastAPI on localhost).
 *
 * In the Tauri build the sidecar is spawned on demand when analysis runs and
 * auto-stops after idle timeout. In browser/dev you can run it via `npm run sidecar`.
 */

import type * as SidecarContracts from "./generated/sidecar-contracts";

import { isTauriApp } from "./dsp-bridge";
import { formatApiError } from "./api-error-messages";

export type SidecarCapability = SidecarContracts.CapabilityContract;

export type SidecarDeviceInfo = SidecarContracts.DeviceInfo;

export type SidecarHealth = SidecarContracts.Health;

export type SidecarAnalysis = SidecarContracts.Analysis;

export interface SidecarManagedStatus {
  ready: boolean;
  spawned: boolean;
  bundled: boolean;
  port: number;
  error: string | null;
}

const SIDECAR_AUTH_HEADER = "X-AIMC-Sidecar-Token";

let cachedSidecarAuthToken: string | null | undefined;

/** @internal Remaining time until a waitForSidecar deadline. */
export function remainingSidecarWaitMs(deadlineMs: number, nowMs = Date.now()): number {
  return Math.max(0, deadlineMs - nowMs);
}

/**
 * Merge optional sidecar auth into fetch headers for production sidecar requests.
 */
export async function sidecarAuthHeaders(
  extra: Record<string, string> = {},
): Promise<Record<string, string>> {
  const headers = { ...extra };
  const token = await resolveSidecarAuthToken();
  if (token) headers[SIDECAR_AUTH_HEADER] = token;
  return headers;
}

export const HEALTH_OK_TTL_MS = 15_000;
export const HEALTH_FAIL_TTL_MS = 500;

let healthCache: { ok: boolean; at: number; body?: SidecarHealth } | null = null;

/** @internal Test helper — whether a cached health result should be reused. */
export function shouldReuseHealthCache(
  cache: { ok: boolean; at: number } | null,
  now: number,
  okTtl = HEALTH_OK_TTL_MS,
  failTtl = HEALTH_FAIL_TTL_MS,
): boolean {
  if (!cache) return false;
  const ttl = cache.ok ? okTtl : failTtl;
  return now - cache.at < ttl;
}

/** Studio only trusts /health when the sidecar proves it has our token. */
export function sidecarHttpHealthIsUsable(input: {
  isTauri: boolean;
  owned?: boolean | null;
}): boolean {
  if (!input.isTauri) return true;
  return input.owned === true;
}

function sidecarBaseUrl(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SIDECAR_URL) {
    return process.env.NEXT_PUBLIC_SIDECAR_URL.replace(/\/$/, "");
  }
  return "http://127.0.0.1:8723";
}

/** Clear cached health (e.g. after starting the sidecar). */
export function resetSidecarHealthCache(): void {
  healthCache = null;
  cachedSidecarAuthToken = undefined;
}

function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const w = window as unknown as {
    __TAURI__?: { core: { invoke: <R>(c: string, a?: Record<string, unknown>) => Promise<R> } };
  };
  if (!w.__TAURI__) {
    throw new Error("Tauri runtime not available");
  }
  return w.__TAURI__.core.invoke<T>(cmd, args);
}

/** @internal Resolve sidecar auth; invoke failures are not cached so the next call can retry. */
export async function resolveSidecarAuthToken(): Promise<string | null> {
  if (cachedSidecarAuthToken !== undefined) return cachedSidecarAuthToken;
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SIDECAR_TOKEN) {
    cachedSidecarAuthToken = String(process.env.NEXT_PUBLIC_SIDECAR_TOKEN);
    return cachedSidecarAuthToken;
  }
  if (isTauriApp()) {
    try {
      const token = await tauriInvoke<string | null>("sidecar_auth_token");
      cachedSidecarAuthToken = token?.trim() || null;
      return cachedSidecarAuthToken;
    } catch {
      return null;
    }
  }
  cachedSidecarAuthToken = null;
  return null;
}

/** Managed sidecar status from the Tauri host (null outside Tauri). */
export async function getManagedSidecarStatus(): Promise<SidecarManagedStatus | null> {
  if (!isTauriApp()) return null;
  return tauriInvoke<SidecarManagedStatus>("sidecar_status");
}

/**
 * Ask Tauri to ensure the sidecar is running and wait until ready.
 * No-op outside Tauri (returns false).
 */
export async function ensureManagedSidecar(timeoutMs = 30_000): Promise<boolean> {
  if (!isTauriApp()) return false;
  resetSidecarHealthCache();
  const status = await tauriInvoke<SidecarManagedStatus>("ensure_sidecar", { timeoutMs });
  return status.ready;
}

/** Poll /health until available or timeout (one deadline for spawn + HTTP). */
export async function waitForSidecar(timeoutMs = 45_000): Promise<boolean> {
  resetSidecarHealthCache();
  const deadline = Date.now() + timeoutMs;
  if (isTauriApp()) {
    const ok = await ensureManagedSidecar(remainingSidecarWaitMs(deadline));
    if (ok) return true;
  }
  while (Date.now() < deadline) {
    if (await isSidecarAvailable()) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

/** True when the sidecar responds to GET /health (cold ML imports can take several seconds). */
export async function isSidecarAvailable(): Promise<boolean> {
  const health = await fetchSidecarHealth();
  return health !== null;
}

async function requestSidecarHealthJson(): Promise<SidecarHealth | null> {
  try {
    const ctrl = new AbortController();
    // Cold /health with optional ML extras can exceed 2s (torch/capability imports).
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    const headers = await sidecarAuthHeaders();
    const res = await fetch(`${sidecarBaseUrl()}/health`, { signal: ctrl.signal, headers });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as SidecarHealth;
  } catch {
    return null;
  }
}

export async function fetchSidecarHealth(): Promise<SidecarHealth | null> {
  if (shouldReuseHealthCache(healthCache, Date.now())) {
    return healthCache!.ok ? (healthCache!.body ?? null) : null;
  }
  const body = await requestSidecarHealthJson();
  if (!body) {
    healthCache = { ok: false, at: Date.now() };
    return null;
  }
  const usable = sidecarHttpHealthIsUsable({
    isTauri: isTauriApp(),
    owned: body.owned,
  });
  if (!usable) {
    healthCache = { ok: false, at: Date.now() };
    return null;
  }
  healthCache = { ok: true, at: Date.now(), body };
  return body;
}

/**
 * Sidecar /health for extras inventory. Token ownership is not required
 * (dev watcher on :8723 may be unowned) and the analysis health cache is left alone.
 */
export async function fetchSidecarHealthInventory(): Promise<SidecarHealth | null> {
  return requestSidecarHealthJson();
}

export type YoutubeResolvePayload = SidecarContracts.YoutubeResolveResponse;

/** Resolve YouTube metadata server-side (avoids browser CORS on oEmbed). */
export async function resolveYoutubeViaSidecar(watchUrl: string): Promise<YoutubeResolvePayload> {
  const res = await fetch(`${sidecarBaseUrl()}/youtube/resolve`, {
    method: "POST",
    headers: await sidecarAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ url: watchUrl }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(formatApiError(res.status, detail, "YouTube resolve"));
  }
  return res.json() as Promise<YoutubeResolvePayload>;
}

export type SonicChordPoint = SidecarContracts.ChordPoint;

export type SonicTimelineSegment = SidecarContracts.TimelineSegment;

export type SonicSignaturePayload = SidecarContracts.SonicSignatureResponse;

export type AcousticBrainzPayload = SidecarContracts.AcousticBrainzResponse;

export async function fetchYoutubeSonicViaSidecar(watchUrl: string): Promise<SonicSignaturePayload> {
  const res = await fetch(`${sidecarBaseUrl()}/youtube/sonic-signature`, {
    method: "POST",
    headers: await sidecarAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ url: watchUrl }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(formatApiError(res.status, detail, "YouTube sonic signature"));
  }
  return res.json() as Promise<SonicSignaturePayload>;
}

/** POST audio to /sonic-signature for rich librosa analysis. */
export async function fetchSonicSignatureViaSidecar(
  file: Blob,
  fileName = "audio",
): Promise<SonicSignaturePayload> {
  const form = new FormData();
  form.append("file", file, fileName);
  const res = await fetch(`${sidecarBaseUrl()}/sonic-signature`, {
    method: "POST",
    headers: await sidecarAuthHeaders(),
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `sonic signature failed (${res.status})`);
  }
  return res.json() as Promise<SonicSignaturePayload>;
}

/** GET AcousticBrainz archive features by MusicBrainz recording MBID. */
export async function fetchAcousticBrainzViaSidecar(
  recordingMbid: string,
  timeoutMs = 8_000,
): Promise<AcousticBrainzPayload> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${sidecarBaseUrl()}/acousticbrainz/${encodeURIComponent(recordingMbid)}`, {
      headers: await sidecarAuthHeaders(),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new Error(`AcousticBrainz lookup failed (${res.status})`);
    }
    return res.json() as Promise<AcousticBrainzPayload>;
  } finally {
    clearTimeout(timer);
  }
}

export type SidecarStemFile = SidecarContracts.StemFile;

export type SidecarSeparateResult = SidecarContracts.SeparateResult;

/**
 * POST audio to /separate and return stem download URLs.
 */
export async function separateStemsViaSidecar(
  file: Blob,
  fileName = "audio",
  modelName = "auto",
): Promise<SidecarSeparateResult> {
  const form = new FormData();
  form.append("file", file, fileName);
  form.append("model_name", modelName);

  const res = await fetch(`${sidecarBaseUrl()}/separate`, {
    method: "POST",
    headers: await sidecarAuthHeaders(),
    body: form,
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.detail ?? JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new Error(detail || `sidecar separate failed (${res.status})`);
  }

  return res.json() as Promise<SidecarSeparateResult>;
}

/** Download one stem WAV from the sidecar by relative download_url. */
export async function downloadSidecarStem(relativeUrl: string, saveAs: string): Promise<void> {
  const url = `${sidecarBaseUrl()}${relativeUrl.startsWith("/") ? relativeUrl : `/${relativeUrl}`}`;
  const res = await fetch(url, { headers: await sidecarAuthHeaders() });
  if (!res.ok) {
    throw new Error(`stem download failed (${res.status})`);
  }
  const blob = await res.blob();
  const { saveOrDownloadBlob } = await import("./studio-file-save");
  await saveOrDownloadBlob(blob, saveAs);
}

export type SidecarVocalEmbedPlanResponse = SidecarContracts.VocalEmbedPlanResponse;

export type SidecarOpenVpiStatus = SidecarContracts.OpenVpiStatus;

export type SidecarImageAnalysis = SidecarContracts.ImageAnalysis;

export type SidecarVocalModelStatus = SidecarContracts.VocalModelStatus;

/** GET /vocal-embed/models — RVC / DiffSinger configuration status. */
export async function fetchVocalEmbedModels(): Promise<SidecarVocalModelStatus | null> {
  try {
    const res = await fetch(`${sidecarBaseUrl()}/vocal-embed/models`, {
      headers: await sidecarAuthHeaders(),
    });
    if (!res.ok) return null;
    return res.json() as Promise<SidecarVocalModelStatus>;
  } catch {
    return null;
  }
}

/**
 * POST Vocal Embed Studio plan JSON to the sidecar for validation / synthesize / align.
 */
export async function submitVocalEmbedPlanToSidecar(
  envelope: Record<string, unknown>,
): Promise<SidecarVocalEmbedPlanResponse> {
  const res = await fetch(`${sidecarBaseUrl()}/vocal-embed/plan`, {
    method: "POST",
    headers: await sidecarAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(envelope),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.detail ?? JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new Error(detail || `vocal embed plan failed (${res.status})`);
  }

  return res.json() as Promise<SidecarVocalEmbedPlanResponse>;
}

export async function synthesizeVocalEmbedViaSidecar(
  envelope: Record<string, unknown>,
  instrumental: Blob,
  instrumentalName: string,
  guideVocal?: Blob | null,
  guideName = "guide-vocal.wav",
): Promise<{ blob: Blob; engine: string | null }> {
  const form = new FormData();
  form.append("plan_json", JSON.stringify(envelope));
  form.append("instrumental", instrumental, instrumentalName || "instrumental.wav");
  if (guideVocal) {
    form.append("guide_vocal", guideVocal, guideName || "guide-vocal.wav");
  }

  const res = await fetch(`${sidecarBaseUrl()}/vocal-embed/synthesize`, {
    method: "POST",
    headers: await sidecarAuthHeaders(),
    body: form,
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.detail ?? JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new Error(detail || `vocal embed synthesis failed (${res.status})`);
  }

  return {
    blob: await res.blob(),
    engine: res.headers.get("X-Vocal-Embed-Engine"),
  };
}

/**
 * POST audio file bytes to /analyze and return librosa tempo/key/centroid.
 */
export async function analyzeAudioViaSidecar(
  file: Blob,
  fileName = "audio",
): Promise<SidecarAnalysis> {
  const form = new FormData();
  form.append("file", file, fileName);

  const res = await fetch(`${sidecarBaseUrl()}/analyze`, {
    method: "POST",
    headers: await sidecarAuthHeaders(),
    body: form,
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.detail ?? JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new Error(detail || `sidecar analyze failed (${res.status})`);
  }

  return res.json() as Promise<SidecarAnalysis>;
}

/**
 * POST image bytes to /analyze-image (optional BLIP caption when vision extra is installed).
 */
export async function analyzeImageViaSidecar(
  file: Blob,
  fileName = "image",
  opts: { caption?: boolean } = {},
): Promise<SidecarImageAnalysis> {
  const form = new FormData();
  form.append("file", file, fileName);
  form.append("caption", opts.caption === false ? "false" : "true");

  const res = await fetch(`${sidecarBaseUrl()}/analyze-image`, {
    method: "POST",
    headers: await sidecarAuthHeaders(),
    body: form,
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.detail ?? JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new Error(detail || `sidecar image analyze failed (${res.status})`);
  }

  return res.json() as Promise<SidecarImageAnalysis>;
}

async function readSidecarError(res: Response, fallback: string): Promise<never> {
  let detail = "";
  try {
    const body = await res.json();
    detail = body?.detail ?? JSON.stringify(body);
  } catch {
    detail = await res.text();
  }
  throw new Error(detail || fallback);
}

/** Poll a background sidecar job until it finishes. */
export async function pollSidecarJob(
  jobId: string,
  options: { timeoutMs?: number; onProgress?: (progress: number, message: string) => void } = {},
): Promise<{ model: string | null; durationSec: number | null; mode: string | null }> {
  const deadline = Date.now() + (options.timeoutMs ?? 30 * 60_000);
  while (Date.now() < deadline) {
    const res = await fetch(`${sidecarBaseUrl()}/jobs/${encodeURIComponent(jobId)}`, {
      headers: await sidecarAuthHeaders(),
    });
    if (!res.ok) await readSidecarError(res, `job poll failed (${res.status})`);
    const body = (await res.json()) as SidecarContracts.PublicJobStatus;
    options.onProgress?.(Number(body.progress) || 0, String(body.message || body.status || ""));
    if (body.status === "done") {
      return {
        model: body.result?.model ?? null,
        durationSec: body.result?.duration_sec ?? null,
        mode: body.result?.mode ?? null,
      };
    }
    if (body.status === "error" || body.status === "cancelled") {
      if (body.status === "cancelled") throw new SidecarJobCancelledError(body.message || "Generation cancelled");
      throw new Error(body.error || body.message || `generation ${body.status}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("generation timed out");
}

export class SidecarJobCancelledError extends Error {
  constructor(message = "Generation cancelled") {
    super(message);
    this.name = "SidecarJobCancelledError";
  }
}

/** Ask the sidecar to cancel a queued or running job without interrupting unsafe inference. */
export async function cancelSidecarJob(jobId: string): Promise<SidecarContracts.JobCancelResponse> {
  const res = await fetch(`${sidecarBaseUrl()}/jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: "POST",
    headers: await sidecarAuthHeaders(),
  });
  if (!res.ok) await readSidecarError(res, `job cancellation failed (${res.status})`);
  return (await res.json()) as SidecarContracts.JobCancelResponse;
}

export type AceStepPresetCatalog = SidecarContracts.AceStepPresetCatalog;

/** Start the installed local ACE API through the managed sidecar. */
export async function ensureAceStepApi(): Promise<SidecarContracts.AceStepEnsureResult> {
  if (!(await waitForSidecar(120_000))) throw new Error("Local AI service is offline");
  const response = await fetch(`${sidecarBaseUrl()}/acestep/ensure`, {
    method: "POST", headers: await sidecarAuthHeaders(),
  });
  if (!response.ok) await readSidecarError(response, `ACE-Step startup failed (${response.status})`);
  return response.json() as Promise<SidecarContracts.AceStepEnsureResult>;
}

/** Report locally installed ACE-Step checkpoints so unsupported presets stay disabled. */
export async function fetchAceStepPresets(): Promise<AceStepPresetCatalog | null> {
  try {
    const res = await fetch(`${sidecarBaseUrl()}/acestep/presets`, {
      headers: await sidecarAuthHeaders(),
    });
    if (!res.ok) return null;
    return (await res.json()) as AceStepPresetCatalog;
  } catch {
    return null;
  }
}

async function downloadGenerateAudio(jobId: string, candidateIndex?: number): Promise<Blob> {
  const suffix = candidateIndex == null ? "" : `?candidate_index=${candidateIndex}`;
  const res = await fetch(`${sidecarBaseUrl()}/generate/audio/${encodeURIComponent(jobId)}${suffix}`, {
    headers: await sidecarAuthHeaders(),
  });
  if (!res.ok) await readSidecarError(res, `audio download failed (${res.status})`);
  return res.blob();
}

/** Sequential local takes; preserve every candidate rather than discarding runners-up. */
export async function generateMusicDraftsViaSidecar(prompt: string, durationSec: number, options: {
  candidateCount?: number; seed?: number; model?: string; temperature?: number;
  topK?: number; topP?: number; cfgCoef?: number; referenceBlob?: Blob;
  useMelodyReference?: boolean;
  onProgress?: (progress: number, message: string) => void;
  onJobStarted?: (jobId: string) => void;
}) {
  const form = new FormData();
  const values = { prompt, duration_sec: durationSec, candidate_count: options.candidateCount ?? 3,
    condition_melody: options.useMelodyReference ?? false,
    seed: options.seed, model: options.model, temperature: options.temperature,
    top_k: options.topK, top_p: options.topP, cfg_coef: options.cfgCoef };
  for (const [key, value] of Object.entries(values)) if (value != null) form.append(key, String(value));
  if (options.referenceBlob) form.append("reference", options.referenceBlob, "style-reference.wav");
  const response = await fetch(`${sidecarBaseUrl()}/generate/drafts/jobs`, {
    method: "POST", headers: await sidecarAuthHeaders(), body: form,
  });
  if (!response.ok) await readSidecarError(response, "Local draft search failed");
  const queued = await response.json() as SidecarContracts.JobSubmission;
  if (!queued.job_id) throw new Error("Draft search job id missing");
  options.onJobStarted?.(queued.job_id);
  const meta = await pollSidecarJob(queued.job_id, { onProgress: options.onProgress, timeoutMs: 60 * 60_000 });
  const searchResponse = await fetch(`${sidecarBaseUrl()}/generate/drafts/${encodeURIComponent(queued.job_id)}`, {
    headers: await sidecarAuthHeaders(),
  });
  if (!searchResponse.ok) await readSidecarError(searchResponse, "Draft comparison unavailable");
  const search = await searchResponse.json() as SidecarContracts.DraftSearchResult;
  const candidateFiles = [];
  for (const candidate of search.candidates) {
    candidateFiles.push({ ...candidate, blob: await downloadGenerateAudio(queued.job_id, candidate.index) });
  }
  const selected = candidateFiles.find(take => take.index === search.selected_index);
  if (!selected) throw new Error("Selected draft is missing");
  return { blob: selected.blob, model: meta.model, durationSec: meta.durationSec ?? durationSec,
    mode: meta.mode, search, candidateFiles };
}

/**
 * POST text prompt to /generate/jobs (optional MusicGen when generate extra is installed).
 */
export async function generateMusicViaSidecar(
  prompt: string,
  durationSec = 8,
  options: {
    temperature?: number;
    topK?: number;
    topP?: number;
    cfgCoef?: number;
    seed?: number;
    model?: string;
    onProgress?: (progress: number, message: string) => void;
    onJobStarted?: (jobId: string) => void;
  } = {},
): Promise<{ blob: Blob; model: string | null; durationSec: number | null; mode: string | null }> {
  const res = await fetch(`${sidecarBaseUrl()}/generate/jobs`, {
    method: "POST",
    headers: await sidecarAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      prompt,
      duration_sec: durationSec,
      temperature: options.temperature,
      top_k: options.topK,
      top_p: options.topP,
      cfg_coef: options.cfgCoef,
      seed: options.seed,
      model: options.model,
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.detail ?? JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new Error(detail || `sidecar generate failed (${res.status})`);
  }

  const queued = (await res.json()) as SidecarContracts.JobSubmission;
  if (!queued.job_id) throw new Error("MusicGen job id missing");
  options.onJobStarted?.(queued.job_id);
  const meta = await pollSidecarJob(queued.job_id, { onProgress: options.onProgress, timeoutMs: 15 * 60_000 });
  return {
    blob: await downloadGenerateAudio(queued.job_id),
    model: meta.model,
    durationSec: meta.durationSec || durationSec,
    mode: meta.mode,
  };
}

/** Queue prompt + melody reference clip for cancellation-aware generation. */
export async function generateMusicWithMelodyViaSidecar(
  prompt: string,
  durationSec: number,
  melody: Blob,
  melodyName = "melody-reference.wav",
  options: {
    temperature?: number;
    topK?: number;
    topP?: number;
    cfgCoef?: number;
    seed?: number;
    model?: string;
    onProgress?: (progress: number, message: string) => void;
    onJobStarted?: (jobId: string) => void;
  } = {},
): Promise<{ blob: Blob; model: string | null; durationSec: number | null; mode: string | null }> {
  const form = new FormData();
  form.append("prompt", prompt);
  form.append("duration_sec", String(durationSec));
  form.append("melody", melody, melodyName);
  if (options.temperature != null) form.append("temperature", String(options.temperature));
  if (options.topK != null) form.append("top_k", String(options.topK));
  if (options.topP != null) form.append("top_p", String(options.topP));
  if (options.cfgCoef != null) form.append("cfg_coef", String(options.cfgCoef));
  if (options.seed != null) form.append("seed", String(options.seed));
  if (options.model) form.append("model", options.model);

  const res = await fetch(`${sidecarBaseUrl()}/generate/melody/jobs`, {
    method: "POST",
    headers: await sidecarAuthHeaders(),
    body: form,
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.detail ?? JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new Error(detail || `sidecar melody generate failed (${res.status})`);
  }

  const queued = (await res.json()) as SidecarContracts.JobSubmission;
  if (!queued.job_id) throw new Error("MusicGen melody job id missing");
  options.onJobStarted?.(queued.job_id);
  const meta = await pollSidecarJob(queued.job_id, { onProgress: options.onProgress, timeoutMs: 15 * 60_000 });
  return {
    blob: await downloadGenerateAudio(queued.job_id),
    model: meta.model,
    durationSec: meta.durationSec || durationSec,
    mode: meta.mode || "melody",
  };
}

/**
 * POST text (+ optional lyrics/meta) to /generate/song (ACE-Step API bridge).
 */
export async function generateSongViaSidecar(options: {
  prompt: string;
  lyrics?: string;
  durationSec?: number | null;
  vocalLanguage?: string;
  bpm?: number | null;
  keyScale?: string;
  thinking?: boolean;
  audioFormat?: string;
  inferenceSteps?: number | null;
  guidanceScale?: number | null;
  seed?: number | null;
  model?: string;
  compose?: boolean;
  instrumental?: boolean;
  onProgress?: (progress: number, message: string) => void;
  onJobStarted?: (jobId: string) => void;
}): Promise<{ blob: Blob; model: string | null; durationSec: number | null; mode: string | null; compositionPlan: SidecarContracts.CompositionPlan | null }> {
  const res = await fetch(`${sidecarBaseUrl()}/generate/song/jobs`, {
    method: "POST",
    headers: await sidecarAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      prompt: options.prompt,
      lyrics: options.lyrics || "",
      duration_sec: options.durationSec ?? null,
      vocal_language: options.vocalLanguage || "",
      bpm: options.bpm ?? null,
      key_scale: options.keyScale || "",
      thinking: options.thinking !== false,
      audio_format: options.audioFormat || "wav",
      inference_steps: options.inferenceSteps ?? null,
      guidance_scale: options.guidanceScale ?? null,
      seed: options.seed ?? null,
      model: options.model || "",
      compose: !!options.compose,
      instrumental: options.instrumental !== false,
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.detail ?? JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new Error(detail || `sidecar ACE-Step song generate failed (${res.status})`);
  }

  const queued = (await res.json()) as SidecarContracts.JobSubmission;
  if (!queued.job_id) throw new Error("ACE-Step job id missing");
  options.onJobStarted?.(queued.job_id);
  const meta = await pollSidecarJob(queued.job_id, { onProgress: options.onProgress, timeoutMs: 35 * 60_000 });
  let compositionPlan: SidecarContracts.CompositionPlan | null = null;
  if (options.compose) {
    const planResponse = await fetch(`${sidecarBaseUrl()}/generate/song/plan/${encodeURIComponent(queued.job_id)}`, {
      headers: await sidecarAuthHeaders(),
    });
    if (!planResponse.ok) throw new Error("The composed song's AI plan could not be retrieved");
    compositionPlan = await planResponse.json() as SidecarContracts.CompositionPlan;
  }
  return {
    blob: await downloadGenerateAudio(queued.job_id),
    model: meta.model,
    durationSec: meta.durationSec || options.durationSec || null,
    mode: meta.mode || "song",
    compositionPlan,
  };
}

/**
 * POST mix + region list to /vocal-transform. Returns remix blob and optional vocals blob.
 */
export async function transformVocalsViaSidecar(options: {
  file: Blob;
  fileName?: string;
  mode?: string;
  regions?: { start_sec: number; end_sec: number }[];
  pitchSemitones?: number;
  formantShift?: number;
  output?: "remix" | "vocals" | "both";
}): Promise<{ remixBlob: Blob | null; vocalsBlob: Blob | null; mode: string | null; jobId: string | null }> {
  const form = new FormData();
  form.append("file", options.file, options.fileName || "mix.wav");
  form.append("mode", options.mode || "pitch");
  form.append("regions_json", JSON.stringify(options.regions || []));
  form.append("pitch_semitones", String(options.pitchSemitones ?? 0));
  form.append("formant_shift", String(options.formantShift ?? 0));
  form.append("output", options.output || "both");

  const res = await fetch(`${sidecarBaseUrl()}/vocal-transform`, {
    method: "POST",
    headers: await sidecarAuthHeaders(),
    body: form,
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.detail ?? JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new Error(detail || `sidecar vocal transform failed (${res.status})`);
  }

  const mode = res.headers.get("X-Vocal-Transform-Mode");
  const jobId = res.headers.get("X-Job-Id");
  const hasRemix = res.headers.get("X-Vocal-Transform-Has-Remix") === "1";
  const hasVocals = res.headers.get("X-Vocal-Transform-Has-Vocals") === "1";
  const primary = await res.blob();

  let remixBlob: Blob | null = hasRemix || (!hasVocals && primary) ? primary : null;
  let vocalsBlob: Blob | null = hasVocals && !hasRemix ? primary : null;

  const vocalsUrl = res.headers.get("X-Vocal-Transform-Vocals-Url");
  if (hasRemix && hasVocals && vocalsUrl) {
    const vRes = await fetch(`${sidecarBaseUrl()}${vocalsUrl}`, {
      headers: await sidecarAuthHeaders(),
    });
    if (vRes.ok) vocalsBlob = await vRes.blob();
  }

  return { remixBlob, vocalsBlob, mode, jobId };
}

/**
 * POST text prompt to /cover (optional FLUX when cover extra is installed).
 */
export async function generateCoverViaSidecar(options: {
  prompt: string;
  width?: number;
  height?: number;
  seed?: number | null;
  numInferenceSteps?: number;
  signal?: AbortSignal;
}): Promise<{ blob: Blob; model: string | null; mode: string | null; width: number | null; height: number | null }> {
  const res = await fetch(`${sidecarBaseUrl()}/cover`, {
    method: "POST",
    headers: await sidecarAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      prompt: options.prompt,
      width: options.width ?? 1024,
      height: options.height ?? 1024,
      seed: options.seed ?? null,
      num_inference_steps: options.numInferenceSteps ?? 4,
    }),
    signal: options.signal,
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.detail ?? JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new Error(detail || `sidecar cover failed (${res.status})`);
  }

  return {
    blob: await res.blob(),
    model: res.headers.get("X-Cover-Model"),
    mode: res.headers.get("X-Cover-Mode"),
    width: Number(res.headers.get("X-Cover-Width") || options.width || 1024) || null,
    height: Number(res.headers.get("X-Cover-Height") || options.height || 1024) || null,
  };
}

/**
 * POST reference image + prompt to /cover-ref (optional FLUX img2img).
 */
export async function generateCoverRefViaSidecar(options: {
  prompt: string;
  image: Blob;
  imageName?: string;
  strength?: number;
  width?: number;
  height?: number;
  seed?: number | null;
  numInferenceSteps?: number;
  signal?: AbortSignal;
}): Promise<{
  blob: Blob;
  model: string | null;
  mode: string | null;
  strength: number | null;
  width: number | null;
  height: number | null;
}> {
  const form = new FormData();
  form.append("prompt", options.prompt);
  form.append("strength", String(options.strength ?? 0.55));
  form.append("width", String(options.width ?? 1024));
  form.append("height", String(options.height ?? 1024));
  form.append("num_inference_steps", String(options.numInferenceSteps ?? 4));
  if (options.seed != null) form.append("seed", String(options.seed));
  form.append("image", options.image, options.imageName || "reference.png");

  const res = await fetch(`${sidecarBaseUrl()}/cover-ref`, {
    method: "POST",
    headers: await sidecarAuthHeaders(),
    body: form,
    signal: options.signal,
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.detail ?? JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new Error(detail || `sidecar cover-ref failed (${res.status})`);
  }

  return {
    blob: await res.blob(),
    model: res.headers.get("X-Cover-Model"),
    mode: res.headers.get("X-Cover-Mode"),
    strength: Number(res.headers.get("X-Cover-Strength") || options.strength || 0.55) || null,
    width: Number(res.headers.get("X-Cover-Width") || options.width || 1024) || null,
    height: Number(res.headers.get("X-Cover-Height") || options.height || 1024) || null,
  };
}

export type VocalAlignPreviewResponse = SidecarContracts.VocalAlignPreviewResponse;

export async function previewVocalAlignViaSidecar(
  envelope: Record<string, unknown>,
  guideVocal: Blob,
  guideName = "guide-vocal.wav",
): Promise<VocalAlignPreviewResponse> {
  const form = new FormData();
  form.append("plan_json", JSON.stringify(envelope));
  form.append("guide_vocal", guideVocal, guideName);

  const res = await fetch(`${sidecarBaseUrl()}/vocal-embed/align-preview`, {
    method: "POST",
    headers: await sidecarAuthHeaders(),
    body: form,
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.detail ?? JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new Error(detail || `align preview failed (${res.status})`);
  }

  return res.json() as Promise<VocalAlignPreviewResponse>;
}

export type OpenvpiDsExportResponse = SidecarContracts.OpenvpiDsExportResponse;

export async function exportOpenvpiDsViaSidecar(
  envelope: Record<string, unknown>,
  guideVocal?: Blob | null,
  guideName = "guide-vocal.wav",
): Promise<OpenvpiDsExportResponse> {
  const form = new FormData();
  form.append("plan_json", JSON.stringify(envelope));
  if (guideVocal) {
    form.append("guide_vocal", guideVocal, guideName || "guide-vocal.wav");
  }

  const res = await fetch(`${sidecarBaseUrl()}/vocal-embed/ds-export`, {
    method: "POST",
    headers: await sidecarAuthHeaders(),
    body: form,
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.detail ?? JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new Error(detail || `OpenVPI ds export failed (${res.status})`);
  }

  return res.json() as Promise<OpenvpiDsExportResponse>;
}

export type FailSafeFixPushResult = SidecarContracts.FixPushResponse;

export async function fetchFailSafeCapabilities(): Promise<SidecarContracts.FailSafeCapabilities | null> {
  try {
    const headers = await sidecarAuthHeaders();
    const res = await fetch(`${sidecarBaseUrl()}/fail-safe/capabilities`, { headers });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export type RuntimeDeliverResult = SidecarContracts.RuntimeDeliverResponse;

/** Maintainer mode: deliver top Runtime report to GitHub (issue / branch / draft PR). */
export async function deliverRuntimeReport(options: {
  payload: Record<string, unknown>;
  mode?: "issue" | "branch" | "pr";
  githubToken?: string;
}): Promise<RuntimeDeliverResult> {
  const headers = await sidecarAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(`${sidecarBaseUrl()}/fail-safe/runtime-deliver`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      payload: options.payload,
      mode: options.mode || "issue",
      github_token: options.githubToken || undefined,
    }),
  });
  let body: RuntimeDeliverResult;
  try {
    body = (await res.json()) as RuntimeDeliverResult;
  } catch {
    throw new Error(formatApiError(res.status, "", "Runtime deliver"));
  }
  if (!res.ok && body?.message) {
    throw new Error(body.message);
  }
  return body;
}

/** Maintainer mode: run fail-safe fix, commit, push (local git) or cloud dispatch. */
export async function runFailSafeFixPush(options: {
  mode?: "local" | "cloud";
  githubToken?: string;
} = {}): Promise<FailSafeFixPushResult> {
  const headers = await sidecarAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(`${sidecarBaseUrl()}/fail-safe/fix-push`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      mode: options.mode || "local",
      github_token: options.githubToken || undefined,
    }),
  });
  let body: FailSafeFixPushResult;
  try {
    body = (await res.json()) as FailSafeFixPushResult;
  } catch {
    throw new Error(formatApiError(res.status, "", "Fix & push"));
  }
  if (!res.ok && body?.message) {
    throw new Error(body.message);
  }
  return body;
}
