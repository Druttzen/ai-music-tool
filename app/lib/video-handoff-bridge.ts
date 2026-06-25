"use client";

import { isTauriApp } from "./dsp-bridge";

export interface VideoHandoffResult {
  ok: boolean;
  canceled: boolean;
  path: string | null;
  launched: boolean;
  error: string | null;
}

function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const w = window as unknown as {
    __TAURI__?: { core: { invoke: <R>(c: string, a?: Record<string, unknown>) => Promise<R> } };
  };
  if (!w.__TAURI__) throw new Error("Tauri runtime not available");
  return w.__TAURI__.core.invoke<T>(cmd, args);
}

/** Native save dialog + optional Video Creator launch (Tauri only). */
export async function exportVideoHandoffNative(payload: {
  bundleJson: string;
  bundleFileName: string;
  audioBytes: ArrayBuffer | null;
  audioFileName: string | null;
}): Promise<VideoHandoffResult> {
  if (!isTauriApp()) {
    throw new Error("Video handoff dialog is only available in the Tauri desktop build");
  }
  return tauriInvoke<VideoHandoffResult>("export_video_handoff", {
    bundleJson: payload.bundleJson,
    bundleFileName: payload.bundleFileName,
    audioBytes: payload.audioBytes ? Array.from(new Uint8Array(payload.audioBytes)) : null,
    audioFileName: payload.audioFileName,
  });
}
