"use client";

import { isTauriApp } from "./dsp-bridge";

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
  if (getDesktopUpdateRuntime() === "tauri") return tauriInvoke("check_studio_update");
  return { ok: false, available: false, error: "Updates are only available in the desktop app" };
}

export async function installDesktopUpdate() {
  if (getDesktopUpdateRuntime() === "tauri") return tauriInvoke("update_studio_all");
  return { ok: false, available: false, error: "Updates are only available in the desktop app" };
}

export function subscribeToDesktopUpdateStatus(callback) {
  if (getDesktopUpdateRuntime() !== "tauri") return () => {};
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
