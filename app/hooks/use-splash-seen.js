"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

const SPLASH_KEY = "ai_music_splash_seen";
const listeners = new Set();

function emitSplashChange() {
  listeners.forEach((listener) => listener());
}

function subscribeSplash(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSplashOpenSnapshot() {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(SPLASH_KEY) !== "1";
  } catch {
    return true;
  }
}

function getServerSplashSnapshot() {
  return false;
}

export function useSplashOverlay() {
  const showSplash = useSyncExternalStore(
    subscribeSplash,
    getSplashOpenSnapshot,
    getServerSplashSnapshot,
  );

  const dismissSplash = useCallback(() => {
    try {
      sessionStorage.setItem(SPLASH_KEY, "1");
    } catch {
      /* ignore */
    }
    emitSplashChange();
  }, []);

  const resetSplash = useCallback(() => {
    try {
      sessionStorage.removeItem(SPLASH_KEY);
    } catch {
      /* ignore */
    }
    emitSplashChange();
  }, []);

  return { showSplash, dismissSplash, resetSplash };
}

/** Auto-dismiss splash after timeout or first user interaction. */
export function useSplashAutoDismiss(showSplash, dismissSplash) {
  useEffect(() => {
    if (!showSplash) return undefined;
    const timer = window.setTimeout(dismissSplash, 1800);
    const fallback = window.setTimeout(dismissSplash, 3500);
    window.addEventListener("pointerdown", dismissSplash, { once: true });
    window.addEventListener("keydown", dismissSplash, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(fallback);
      window.removeEventListener("pointerdown", dismissSplash);
      window.removeEventListener("keydown", dismissSplash);
    };
  }, [dismissSplash, showSplash]);
}
