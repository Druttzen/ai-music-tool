"use client";

import { useCallback, useEffect, useState } from "react";
import { isTauriApp } from "../lib/dsp-bridge";

async function getCurrentWindow() {
  const getCurrent = window.__TAURI__?.window?.getCurrentWindow;
  if (typeof getCurrent === "function") return getCurrent();
  return null;
}

export function DesktopWindowControls() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAvailable(isTauriApp()), 0);
    return () => clearTimeout(timer);
  }, []);

  const minimize = useCallback(async () => {
    try {
      const win = await getCurrentWindow();
      if (!win) return;
      if (typeof win.setFullscreen === "function") await win.setFullscreen(false);
      if (typeof win.unmaximize === "function") await win.unmaximize();
      if (typeof win.minimize === "function") await win.minimize();
    } catch {
      /* ignore */
    }
  }, []);

  const exitApp = useCallback(async () => {
    try {
      const win = await getCurrentWindow();
      if (win && typeof win.close === "function") {
        await win.close();
        return;
      }
      const exit = window.__TAURI__?.process?.exit;
      if (typeof exit === "function") await exit(0);
    } catch {
      /* ignore */
    }
  }, []);

  if (!available) return null;

  return (
    <div className="fixed right-3 top-3 z-[80] flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => void minimize()}
        className="rounded-lg border border-white/15 bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white/80 backdrop-blur hover:bg-white/10"
        title="Minimize"
        aria-label="Minimize Studio"
      >
        Minimize
      </button>
      <button
        type="button"
        onClick={() => void exitApp()}
        className="rounded-lg border border-red-400/35 bg-red-500/15 px-2.5 py-1 text-[11px] font-bold text-red-100 backdrop-blur hover:bg-red-500/25"
        title="Exit"
        aria-label="Exit Studio"
      >
        Exit
      </button>
    </div>
  );
}
