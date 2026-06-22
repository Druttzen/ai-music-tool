/**
 * Derive track title/artist for AI Canvas Tool handoff.
 * @param {{ idea?: string, lyricTheme?: string, audioAnalysis?: { fileName?: string } | null, imageFileName?: string | null }} ctx
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
  if (ctx.imageFileName) {
    return {
      title: ctx.imageFileName.replace(/\.[^.]+$/, "").trim() || "Untitled Track",
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
 * Open AI Canvas Tool with current image preview (Electron only).
 * @param {{ imagePreviewUrl: string, title: string, artist: string, motionHint?: string, ext?: string }} payload
 */
export async function openImageInCanvasTool(payload) {
  if (!window.electronAPI?.openInCanvasTool) {
    throw new Error("Open in Canvas Tool requires the desktop app");
  }
  const res = await fetch(payload.imagePreviewUrl);
  if (!res.ok) throw new Error("Could not read image preview");
  const buffer = await res.arrayBuffer();
  return window.electronAPI.openInCanvasTool({
    title: payload.title,
    artist: payload.artist,
    buffer,
    ext: payload.ext || "png",
    motionHint: payload.motionHint || "cinematic drift, 8 seconds",
    durationSec: 8,
  });
}
