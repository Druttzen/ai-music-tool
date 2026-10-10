"use client";
import { useEffect, useState } from "react";
import { exportCanvasHandoffNative } from "../lib/canvas-handoff-bridge";
export default function CanvasPlugin() {
  const [preview, setPreview] = useState("");
  const [message, setMessage] = useState("Select artwork to create a Canvas loop.");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let disposed = false, url = "";
    const invoke = window.__TAURI__?.core?.invoke;
    if (invoke) invoke("canvas_preview_bytes").then(bytes => {
      if (disposed) return;
      url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "video/mp4" }));
      setPreview(url);
    }).catch(() => {});
    return () => { disposed = true; if (url) URL.revokeObjectURL(url); };
  }, [revision]);
  useEffect(() => {
    let disposed = false, unlisten;
    const listen = window.__TAURI__?.event?.listen;
    if (listen) listen("canvas-preview-ready", () => setRevision(value => value + 1)).then(stop => {
      if (disposed) stop(); else unlisten = stop;
    });
    return () => { disposed = true; unlisten?.(); };
  }, []);
  async function create(event) {
    const file = event.target.files?.[0]; if (!file) return;
    setBusy(true); setMessage("Creating your loop…");
    try {
      const result = await exportCanvasHandoffNative({ title: file.name, artist: "", imageBytes: await file.arrayBuffer(), ext: file.name.split(".").pop(), durationSec: 8 });
      if (!result.ok) throw new Error(result.error || "Canvas rendering failed");
      setRevision(value => value + 1); setMessage("Canvas saved in Studio’s exports folder.");
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-slate-950 p-6 text-white">
    <h1 className="text-2xl font-bold">Canvas plugin</h1>
    <p className="my-4">Create an eight-second portrait loop from your artwork.</p>
    <label className="block rounded-xl bg-emerald-300 p-3 font-bold text-black">Choose artwork
      <input aria-label="Canvas artwork" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={create} className="mt-2 block w-full" />
    </label>
    <p role="status" className="my-4">{message}</p>
    {preview ? <video aria-label="Canvas preview" src={preview} controls loop className="mx-auto max-h-[65vh]" /> : null}
  </main>;
}
