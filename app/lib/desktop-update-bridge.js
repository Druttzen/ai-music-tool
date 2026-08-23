"use client";

import {
  checkForAppUpdates,
  isElectronApp,
  quitAndInstallUpdate,
  subscribeToUpdateStatus,
} from "./electron-bridge";
import { isTauriApp } from "./dsp-bridge";

function tauriInvoke(command) {
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) throw new Error("Tauri runtime not available");
  return invoke(command);
}

export function getDesktopUpdateRuntime() {
  if (isTauriApp()) return "tauri";
  if (isElectronApp()) return "electron";
  return null;
}

export async function checkForDesktopUpdates() {
  const runtime = getDesktopUpdateRuntime();
  if (runtime === "tauri") return tauriInvoke("check_studio_update");
  if (runtime === "electron") return checkForAppUpdates();
  return { ok: false, available: false, error: "Updates are only available in the desktop app" };
}

export async function installDesktopUpdate() {
  const runtime = getDesktopUpdateRuntime();
  if (runtime === "tauri") return tauriInvoke("update_studio_all");
  if (runtime === "electron") {
    await quitAndInstallUpdate();
    return { ok: true, available: true };
  }
  return { ok: false, available: false, error: "Updates are only available in the desktop app" };
}

export function subscribeToDesktopUpdateStatus(callback) {
  const runtime = getDesktopUpdateRuntime();
  if (runtime === "electron") return subscribeToUpdateStatus(callback);
  if (runtime !== "tauri") return () => {};
  const listen = window.__TAURI__?.event?.listen;
  if (typeof listen !== "function") return () => {};
  let unlisten = () => {};
  listen("studio-component-update-progress", (event) => {
    callback(event?.payload ?? event);
  })
    .then((fn) => {
      if (typeof fn === "function") unlisten = fn;
    })
    .catch(() => {});
  return () => unlisten();
}
