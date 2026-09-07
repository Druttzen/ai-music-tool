"use client";

import { useCallback, useState } from "react";
import { resolveAudioCacheBlob } from "../../lib/audio-cache";
import { normalizeStudioExportFormat } from "../../lib/audio-export-formats";
import { exportEnhancedFromBlob } from "../../lib/studio-export-client";
import { reportCaughtError } from "../../lib/fail-safe-runtime-capture";

export function useAnalyzerExport({ audioAnalysis, audioPreviewUrlRef, setStatusWithTime }) {
  const [audioExportBusy, setAudioExportBusy] = useState(false);
  const [audioExportProgress, setAudioExportProgress] = useState(null);

  const exportEnhancedAudio = useCallback(
    async (presetId, opts = {}) => {
      if (!audioAnalysis) {
        setStatusWithTime("No track loaded to export");
        return;
      }
      if (audioExportBusy) return;

      const format = normalizeStudioExportFormat(opts.format);
      const scope = opts.scope === "highlight" ? "highlight" : "full";

      setAudioExportBusy(true);
      setAudioExportProgress({ phase: "preparing", pct: 0 });
      setStatusWithTime("Studio export started…");

      try {
        // Prefer live preview blob (avoids IndexedDB stalls in e2e / private mode).
        let blob = null;
        if (audioPreviewUrlRef.current) {
          try {
            const res = await fetch(audioPreviewUrlRef.current);
            if (res.ok) blob = await res.blob();
          } catch {
            /* fall through to cache */
          }
        }
        if (!blob) {
          const resolved = await resolveAudioCacheBlob(audioAnalysis);
          blob = resolved?.blob ?? null;
        }
        if (!blob) {
          setStatusWithTime("Attach the audio file before studio export");
          return;
        }

        const baseName = String(audioAnalysis.fileName || "track").replace(/\.[^.]+$/, "");
        const suffix =
          scope === "highlight" ? `-highlight-${presetId}` : `-enhanced-${presetId}`;

        const startSec = scope === "highlight" ? Number(audioAnalysis.highlightStart) || 0 : undefined;
        const endSec =
          scope === "highlight"
            ? Number(audioAnalysis.highlightEnd) || audioAnalysis.duration || startSec + 1
            : undefined;

        const result = await exportEnhancedFromBlob(blob, presetId, `${baseName}${suffix}`, {
          format,
          startSec,
          endSec,
          onProgress: (p) => setAudioExportProgress(p),
        });

        const fmtLabel = (result?.format || format).toUpperCase();
        const fallbackNote = result?.formatFallback
          ? result?.engine === "native"
            ? " (native format fallback)"
            : " (browser format fallback)"
          : "";
        const where =
          result?.saveMode === "studio" && result?.savePath
            ? ` · Studio exports`
            : "";
        if (result?.afterLufs != null && Number.isFinite(result.afterLufs)) {
          setStatusWithTime(
            `${fmtLabel} downloaded${fallbackNote}${where} · ${result.afterLufs.toFixed(1)} LUFS (target ${result.targetLufs})`,
          );
        } else {
          setStatusWithTime(
            scope === "highlight"
              ? `Highlight ${fmtLabel} downloaded${fallbackNote}${where}`
              : `Enhanced ${fmtLabel} downloaded${fallbackNote}${where}`,
          );
        }
      } catch (err) {
        reportCaughtError("analyzers.exportEnhancedAudio", err);
        const msg = err instanceof Error ? err.message : "";
        setStatusWithTime(msg ? msg.slice(0, 80) : "Studio export failed");
      } finally {
        setAudioExportBusy(false);
        setAudioExportProgress(null);
      }
    },
    [audioAnalysis, audioExportBusy, audioPreviewUrlRef, setStatusWithTime],
  );

  return {
    audioExportBusy,
    audioExportProgress,
    exportEnhancedAudio,
  };
}
