"use client";

import { useDesktopUpdates } from "../hooks/use-desktop-updates";

export function DesktopUpdateStatusBar() {
  const { visible, status, busy, progressPct } = useDesktopUpdates();

  if (!visible) return null;

  const pct =
    typeof progressPct === "number" && Number.isFinite(progressPct)
      ? Math.max(0, Math.min(100, progressPct))
      : null;
  const label = status || (busy ? "Updating…" : "");

  return (
    <div
      className="pointer-events-none fixed bottom-3 left-1/2 z-50 w-[min(36rem,calc(100vw-12rem))] -translate-x-1/2"
      role="status"
      aria-live="polite"
      aria-busy={busy}
    >
      <div className="rounded-full border border-orange-400/30 bg-black/50 px-4 py-2 text-xs font-bold text-orange-300 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1 truncate text-center">{label}</span>
          {pct != null ? <span className="shrink-0 tabular-nums text-orange-200/90">{pct}%</span> : null}
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
          {pct != null ? (
            <div
              className="h-full rounded-full bg-orange-400/80 transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          ) : (
            <div className="h-full w-1/3 animate-pulse rounded-full bg-orange-400/70" />
          )}
        </div>
      </div>
    </div>
  );
}
