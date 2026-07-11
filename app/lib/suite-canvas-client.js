/**
 * Derive track title/artist for AI Canvas Tool handoff.
 * @param {{ idea?: string, lyricTheme?: string, audioAnalysis?: { fileName?: string } | null, imageAnalysis?: { fileName?: string } | null, imageFileName?: string | null }} ctx
 */
export function deriveCanvasTrackMeta(ctx) {
  const idea = String(ctx.idea || ctx.lyricTheme || "").trim();
  if (ctx.audioAnalysis?.fileName) {
    const title = ctx.audioAnalysis.fileName.replace(/\.[^.]+$/, "").trim() || "Untitled Track";
    return {
      title,
      artist: idea ? idea.slice(0, 60) : "Unknown Artist",
    };
  }
  if (idea) {
    const firstLine = idea.split(/\r?\n/)[0].trim();
    return {
      title: firstLine.slice(0, 80) || "Untitled Track",
      artist: "Unknown Artist",
    };
  }
  const imageName =
    ctx.imageFileName ||
    ctx.imageAnalysis?.fileName ||
    "";
  if (imageName) {
    return {
      title: String(imageName).replace(/\.[^.]+$/, "").trim() || "Untitled Track",
      artist: "Unknown Artist",
    };
  }
  return { title: "Untitled Track", artist: "Unknown Artist" };
}

/**
 * Build motion hint from image DNA analysis.
 * @param {{ visualMood?: string, summary?: string } | null | undefined} imageAnalysis
 */
export function deriveCanvasMotionHint(imageAnalysis) {
  if (!imageAnalysis) return "cinematic drift, soft glow, 8 seconds";
  const mood = String(imageAnalysis.visualMood || "cinematic").trim();
  return `${mood} drift, gentle pulse, 8 seconds`;
}

/**
 * Open AI Canvas Tool with current image preview (Tauri primary, Electron legacy).
 * @param {{ imagePreviewUrl: string, title: string, artist: string, motionHint?: string, ext?: string }} payload
 */
export async function openImageInCanvasTool(payload) {
  const res = await fetch(payload.imagePreviewUrl);
  if (!res.ok) throw new Error("Could not read image preview");
  const buffer = await res.arrayBuffer();

  const { exportCanvasHandoffNative } = await import("./canvas-handoff-bridge");
  const { isTauriApp } = await import("./dsp-bridge");

  if (isTauriApp()) {
    return exportCanvasHandoffNative({
      title: payload.title,
      artist: payload.artist,
      imageBytes: buffer,
      ext: payload.ext || "png",
      motionHint: payload.motionHint,
      durationSec: 8,
    });
  }

  if (typeof window !== "undefined" && window.electronAPI?.openInCanvasTool) {
    return window.electronAPI.openInCanvasTool({
      title: payload.title,
      artist: payload.artist,
      buffer,
      ext: payload.ext || "png",
      motionHint: payload.motionHint || "cinematic drift, 8 seconds",
      durationSec: 8,
    });
  }

  throw new Error("Open in Canvas Tool requires the desktop app (Tauri Studio or Electron)");
}
