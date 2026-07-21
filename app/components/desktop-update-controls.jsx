"use client";

import { useDesktopUpdates } from "../hooks/use-desktop-updates";

export function DesktopUpdateControls() {
  const { available, status, busy, installReady, installLabel, checkUpdates, restartToUpdate } =
    useDesktopUpdates();

  if (!available) return null;

  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <div className="text-xs text-white/50">Desktop updates</div>
      <div className="mt-1 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void checkUpdates()}
          className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-bold text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-50"
        >
          Check for updates
        </button>
        {installReady ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void restartToUpdate()}
            className="rounded-xl bg-emerald-300 px-3 py-1.5 text-[11px] font-bold text-black hover:bg-emerald-200 disabled:opacity-50"
          >
            {installLabel}
          </button>
        ) : null}
      </div>
      {status ? <p className="mt-2 text-[10px] leading-relaxed text-white/45">{status}</p> : null}
    </div>
  );
}
