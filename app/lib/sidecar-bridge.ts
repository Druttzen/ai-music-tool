/**
 * Bridge to the local Python AI sidecar (FastAPI on localhost).
 *
 * In the Tauri build the sidecar is spawned on demand when analysis runs and
 * auto-stops after idle timeout. In browser/dev you can run it via `npm run sidecar`.
 */

import { isTauriApp } from "./dsp-bridge";
import { formatApiError } from "./api-error-messages";

export interface SidecarHealth {
  status: string;
  device: string;
  version: string;
  stems_available?: boolean;
  genre_available?: boolean;
  vision_available?: boolean;
  vocal_embed_plan_available?: boolean;
  vocal_synthesis_available?: boolean;
  vocal_ml_available?: boolean;
  vocal_models_available?: boolean;
  vocal_rvc_available?: boolean;
  vocal_diffsinger_available?: boolean;
  generate_available?: boolean;
}

export interface SidecarAnalysis {
  duration_sec: number;
  tempo_bpm: number;
  key_estimate: string;
  key_confidence?: number;
  spectral_centroid_hz: number;
  spectral_bandwidth_hz?: number;
  spectral_rolloff_hz?: number;
  onset_strength?: number;
  beat_count?: number;
  beat_density?: number;
  percussive_ratio?: number;
  harmonic_ratio?: number;
  device: string;
  genre_predictions?: { label: string; score: number }[];
  genre_model?: string;
}

export interface SidecarManagedStatus {
  ready: boolean;
  spawned: boolean;
  bundled: boolean;
  port: number;
  error: string | null;
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

function sidecarBaseUrl(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SIDECAR_URL) {
    return process.env.NEXT_PUBLIC_SIDECAR_URL.replace(/\/$/, "");
  }
  return "http://127.0.0.1:8723";
}

/** Clear cached health (e.g. after starting the sidecar). */
export function resetSidecarHealthCache(): void {
  healthCache = null;
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

/** Poll /health until available or timeout. */
export async function waitForSidecar(timeoutMs = 15_000): Promise<boolean> {
  resetSidecarHealthCache();
  if (isTauriApp()) {
    const ok = await ensureManagedSidecar(timeoutMs);
    if (ok) return true;
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isSidecarAvailable()) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

/** True when the sidecar responds to GET /health within 2s. */
export async function isSidecarAvailable(): Promise<boolean> {
  const health = await fetchSidecarHealth();
  return health !== null;
}

export async function fetchSidecarHealth(): Promise<SidecarHealth | null> {
  if (shouldReuseHealthCache(healthCache, Date.now())) {
    return healthCache!.ok ? (healthCache!.body ?? null) : null;
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(`${sidecarBaseUrl()}/health`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) {
      healthCache = { ok: false, at: Date.now() };
      return null;
    }
    const body = (await res.json()) as SidecarHealth;
    healthCache = { ok: true, at: Date.now(), body };
    return body;
  } catch {
    healthCache = { ok: false, at: Date.now() };
    return null;
  }
}

export interface YoutubeResolvePayload {
  video_id: string;
  watch_url: string;
  title: string;
  author_name: string;
  thumbnail_url: string;
  duration_sec: number | null;
  parsed_artist: string;
  parsed_track: string;
  search_query: string;
  tags: string[];
  categories: string[];
  description_excerpt: string;
  provider: string;
}

/** Resolve YouTube metadata server-side (avoids browser CORS on oEmbed). */
export async function resolveYoutubeViaSidecar(watchUrl: string): Promise<YoutubeResolvePayload> {
  const res = await fetch(`${sidecarBaseUrl()}/youtube/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: watchUrl }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(formatApiError(res.status, detail, "YouTube resolve"));
  }
  return res.json() as Promise<YoutubeResolvePayload>;
}

export interface SonicChordPoint {
  time_sec: number;
  chord: string;
  strength: number;
}

export interface SonicTimelineSegment {
  start_sec: number;
  end_sec: number;
  energy: number;
  brightness_hz: number;
}

export interface SonicSignaturePayload {
  duration_sec: number;
  tempo_bpm: number;
  key_estimate: string;
  key_confidence: number;
  time_signature: number;
  loudness_db: number;
  spectral_centroid_hz: number;
  harmonic_ratio: number;
  percussive_ratio: number;
  beat_count: number;
  chord_progression: SonicChordPoint[];
  timeline_segments: SonicTimelineSegment[];
  provider: string;
}

export interface AcousticBrainzPayload {
  recording_mbid: string;
  provider: string;
  bpm?: number | null;
  key_key?: string | null;
  key_scale?: string | null;
  key_strength?: number | null;
  moods?: string[];
  genres?: string[];
}

export async function fetchYoutubeSonicViaSidecar(watchUrl: string): Promise<SonicSignaturePayload> {
  const res = await fetch(`${sidecarBaseUrl()}/youtube/sonic-signature`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  const res = await fetch(`${sidecarBaseUrl()}/sonic-signature`, { method: "POST", body: form });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `sonic signature failed (${res.status})`);
  }
  return res.json() as Promise<SonicSignaturePayload>;
}

/** GET AcousticBrainz archive features by MusicBrainz recording MBID. */
export async function fetchAcousticBrainzViaSidecar(
  recordingMbid: string,
): Promise<AcousticBrainzPayload> {
  const res = await fetch(
    `${sidecarBaseUrl()}/acousticbrainz/${encodeURIComponent(recordingMbid)}`,
  );
  if (!res.ok) {
    throw new Error(`AcousticBrainz lookup failed (${res.status})`);
  }
  return res.json() as Promise<AcousticBrainzPayload>;
}

export interface SidecarStemFile {
  name: string;
  download_url: string;
  filename: string;
}

export interface SidecarSeparateResult {
  device: string;
  model: string;
  sources: string[];
  job_id: string;
  stems: SidecarStemFile[];
}

/**
 * POST audio to /separate and return Demucs stem download URLs.
 */
export async function separateStemsViaSidecar(
  file: Blob,
  fileName = "audio",
  modelName = "htdemucs",
): Promise<SidecarSeparateResult> {
  const form = new FormData();
  form.append("file", file, fileName);

  const res = await fetch(`${sidecarBaseUrl()}/separate?model_name=${encodeURIComponent(modelName)}`, {
    method: "POST",
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
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`stem download failed (${res.status})`);
  }
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = saveAs;
  a.click();
  URL.revokeObjectURL(a.href);
}

export interface SidecarVocalEmbedPlanResponse {
  ok: boolean;
  stage: string;
  mode: string;
  section_count: number;
  message: string;
  synthesis_available: boolean;
  next_steps: string[];
}

export interface SidecarOpenVpiStatus {
  root: string | null;
  acoustic_exp: string | null;
  variance_exp: string | null;
  python: string | null;
  speaker: string | null;
  language: string | null;
  configured: boolean;
  ready: boolean;
}

export interface SidecarImageAnalysis {
  caption: string | null;
  caption_model: string | null;
  clip_tags: Array<{ label: string; score: number }> | null;
  clip_model: string | null;
  device: string;
}

export interface SidecarVocalModelStatus {
  rvc_python: boolean;
  rvc_api: boolean;
  rvc_model_configured: boolean;
  rvc_ready: boolean;
  rvc_model: string | null;
  rvc_index: string | null;
  rvc_models_dir: string | null;
  rvc_api_url: string | null;
  diffsinger_configured: boolean;
  diffsinger_ready?: boolean;
  diffsinger_cmd: string | null;
  diffsinger_url: string | null;
  diffsinger_model_dir: string | null;
  diffsinger_openvpi?: SidecarOpenVpiStatus;
  models_ready: boolean;
}

/** GET /vocal-embed/models — RVC / DiffSinger configuration status. */
export async function fetchVocalEmbedModels(): Promise<SidecarVocalModelStatus | null> {
  try {
    const res = await fetch(`${sidecarBaseUrl()}/vocal-embed/models`);
    if (!res.ok) return null;
    return res.json() as Promise<SidecarVocalModelStatus>;
  } catch {
    return null;
  }
}

/**
 * POST Vocal Embed Studio plan JSON to the sidecar for validation / future synthesis queue.
 */
export async function submitVocalEmbedPlanToSidecar(
  envelope: Record<string, unknown>,
): Promise<SidecarVocalEmbedPlanResponse> {
  const res = await fetch(`${sidecarBaseUrl()}/vocal-embed/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

/**
 * POST text prompt to /generate (optional MusicGen when generate extra is installed).
 */
export async function generateMusicViaSidecar(
  prompt: string,
  durationSec = 10,
): Promise<{ blob: Blob; model: string | null; durationSec: number | null; mode: string | null }> {
  const res = await fetch(`${sidecarBaseUrl()}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, duration_sec: durationSec }),
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

  return {
    blob: await res.blob(),
    model: res.headers.get("X-MusicGen-Model"),
    durationSec: Number(res.headers.get("X-MusicGen-Duration-Sec") || durationSec) || durationSec,
    mode: res.headers.get("X-MusicGen-Mode"),
  };
}

/** POST prompt + melody reference clip to /generate/melody. */
export async function generateMusicWithMelodyViaSidecar(
  prompt: string,
  durationSec: number,
  melody: Blob,
  melodyName = "melody-reference.wav",
): Promise<{ blob: Blob; model: string | null; durationSec: number | null; mode: string | null }> {
  const form = new FormData();
  form.append("prompt", prompt);
  form.append("duration_sec", String(durationSec));
  form.append("melody", melody, melodyName);

  const res = await fetch(`${sidecarBaseUrl()}/generate/melody`, {
    method: "POST",
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

  return {
    blob: await res.blob(),
    model: res.headers.get("X-MusicGen-Model"),
    durationSec: Number(res.headers.get("X-MusicGen-Duration-Sec") || durationSec) || durationSec,
    mode: res.headers.get("X-MusicGen-Mode") || "melody",
  };
}

export interface VocalAlignPreviewResponse {
  align_method: string;
  mfa_configured: boolean;
  word_count: number;
  sections: object[];
}

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

export type OpenvpiDsExportResponse = {
  format: string;
  version?: number;
  align_method?: string | null;
  segment_count: number;
  segments: Array<Record<string, string | number>>;
};

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
