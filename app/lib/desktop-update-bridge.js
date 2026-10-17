"use client";

import { isTauriApp } from "./dsp-bridge";
import { runProcess, listenProcessEvent } from "./process-status";

function tauriInvoke(command) {
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) throw new Error("Tauri runtime not available");
  return invoke(command);
}

export function getDesktopUpdateRuntime() {
  if (isTauriApp()) return "tauri";
  return null;
}

export async function checkForDesktopUpdates() {
  if (getDesktopUpdateRuntime() === "tauri") return runProcess("Check published Studio version", async () => tauriInvoke("check_studio_update"));
  return { ok: false, available: false, error: "Updates are only available in the desktop app" };
}

export async function installDesktopUpdate() {
  if (getDesktopUpdateRuntime() === "tauri") return trackedUpdate("Check Studio and update installed addons", "update_studio_all");
  return { ok: false, available: false, error: "Updates are only available in the desktop app" };
}

export async function installStudioAppUpdate() {
  if (getDesktopUpdateRuntime() === "tauri") return trackedUpdate("Check and install Studio app update", "install_studio_update");
  return { ok: false, available: false, error: "Updates are only available in the desktop app" };
}

async function trackedUpdate(label, command) {
  return runProcess(label, async (process) => {
    const stop = await listenProcessEvent("studio-component-update-progress", (payload) => {
      process.progress({ phase: payload.message || payload.phase || "Updating", pct: payload.pct ?? null });
    });
    try {
      return await tauriInvoke(command);
    } finally {
      stop();
    }
  });
}

export function subscribeToDesktopUpdateStatus(callback) {
  if (getDesktopUpdateRuntime() !== "tauri") return () => {};
  const listen = window.__TAURI__?.event?.listen;
  if (typeof listen !== "function") return () => {};
  let unlisten = () => {};
  let cancelled = false;
  listen("studio-component-update-progress", (event) => {
    callback(event?.payload ?? event);
  })
    .then((fn) => {
      if (typeof fn !== "function") return;
      if (cancelled) {
        fn();
        return;
      }
      unlisten = fn;
    })
    .catch(() => {});
  return () => {
    cancelled = true;
    unlisten();
  };
}
