/**
 * Bridge to the local Python AI sidecar (FastAPI on localhost).
 *
 * In the Tauri build the sidecar is spawned on demand when analysis runs and
 * auto-stops after idle timeout. In browser/dev you can run it via `npm run sidecar`.
 */

import { isTauriApp } from "./dsp-bridge";

export interface SidecarHealth {
  status: string;
  device: string;
  version: string;
}

export interface SidecarAnalysis {
  duration_sec: number;
  tempo_bpm: number;
  key_estimate: string;
  spectral_centroid_hz: number;
  device: string;
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

let healthCache: { ok: boolean; at: number } | null = null;

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
  if (shouldReuseHealthCache(healthCache, Date.now())) {
    return healthCache!.ok;
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(`${sidecarBaseUrl()}/health`, { signal: ctrl.signal });
    clearTimeout(timer);
    const ok = res.ok;
    healthCache = { ok, at: Date.now() };
    return ok;
  } catch {
    healthCache = { ok: false, at: Date.now() };
    return false;
  }
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
