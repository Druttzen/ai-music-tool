/**
 * Studio-colocated downloads: write into `{install}/data/exports` via Tauri.
 * Browser / web builds keep the classic Save-As download.
 */

import { isTauriApp } from "./dsp-bridge";

/**
 * @returns {{ core: { invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T> } } | null}
 */
function tauriApi() {
  if (typeof window === "undefined") return null;
  return window.__TAURI__ ?? null;
}

/**
 * Trigger a browser / WebView `<a download>` save (OS Downloads).
 * @param {Blob} blob
 * @param {string} fileName
 */
export function triggerBrowserDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  a.style.display = "none";
  if (document.body) {
    document.body.appendChild(a);
    a.click();
    a.remove();
  } else {
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * @param {Blob} blob
 * @param {string} fileName
 * @param {{ directory?: string|null }} [opts]
 * @returns {Promise<{ mode: "studio"|"browser", path?: string }>}
 */
export async function saveOrDownloadBlob(blob, fileName, opts = {}) {
  const name = String(fileName || "download").trim() || "download";
  const directory = String(opts.directory || "").trim();
  if (isTauriApp()) {
    const t = tauriApi();
    if (t?.core?.invoke) {
      const buffer = await blob.arrayBuffer();
      const args = {
        fileName: name,
        bytes: new Uint8Array(buffer),
      };
      if (directory) args.directory = directory;
      const path = await t.core.invoke("save_bytes_to_exports", args);
      return { mode: "studio", path: String(path || "") };
    }
  }
  triggerBrowserDownload(blob, name);
  return { mode: "browser" };
}

/**
 * @param {string} text
 * @param {string} fileName
 * @param {string} [mime]
 */
export async function saveOrDownloadText(text, fileName, mime = "application/json") {
  return saveOrDownloadBlob(new Blob([text], { type: mime }), fileName);
}
