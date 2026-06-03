"use client";

import { useCallback, useSyncExternalStore } from "react";

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
