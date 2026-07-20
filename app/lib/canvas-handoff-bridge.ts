"use client";

import { isTauriApp } from "./dsp-bridge";

export interface CanvasHandoffResult {
  ok: boolean;
  launched: boolean;
  album_art_path: string | null;
  handoff_path: string | null;
  error: string | null;
}

function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const w = window as unknown as {
    __TAURI__?: { core: { invoke: <R>(c: string, a?: Record<string, unknown>) => Promise<R> } };
  };
  if (!w.__TAURI__) throw new Error("Tauri runtime not available");
  return w.__TAURI__.core.invoke<T>(cmd, args);
}

/** Export artwork + optional audio + handoff.json and launch AI Canvas Tool (Tauri only). */
export async function exportCanvasHandoffNative(payload: {
  title: string;
  artist: string;
  imageBytes: ArrayBuffer;
  ext?: string;
  audioBytes?: ArrayBuffer | null;
  audioExt?: string;
  motionHint?: string;
  durationSec?: number;
}): Promise<CanvasHandoffResult> {
  if (!isTauriApp()) {
    throw new Error("Canvas handoff is only available in the Tauri desktop build");
  }
  const args: Record<string, unknown> = {
    title: payload.title,
    artist: payload.artist,
    imageBytes: Array.from(new Uint8Array(payload.imageBytes)),
    ext: payload.ext || "png",
    motionHint: payload.motionHint,
    durationSec: payload.durationSec ?? 8,
  };
  if (payload.audioBytes?.byteLength) {
    args.audioBytes = Array.from(new Uint8Array(payload.audioBytes));
    args.audioExt = payload.audioExt || "mp3";
  }
  return tauriInvoke<CanvasHandoffResult>("export_canvas_handoff", args);
}
