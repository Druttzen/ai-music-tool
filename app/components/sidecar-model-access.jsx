"use client";

import { useState } from "react";
import { connectHuggingFace } from "../lib/sidecar-extra-install-client";

export function SidecarModelAccess() {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const connect = async () => {
    setBusy(true);
    try {
      setMessage(await connectHuggingFace(token));
      setToken("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : typeof error === "string" ? error : "Could not connect to Hugging Face");
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="mb-3 rounded-xl border border-white/10 p-3 text-[11px] text-white/65">
      <summary className="cursor-pointer font-bold text-cyan-100">Model download access</summary>
      <p className="mt-2">FLUX requires access from your own Hugging Face account. Accept the model conditions, connect a read token, then retry Cover and Cover reference.</p>
      <div className="my-2 flex gap-3">
        <a href="https://huggingface.co/black-forest-labs/FLUX.1-schnell" target="_blank" rel="noreferrer" className="underline">Accept model access</a>
        <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" className="underline">Create read token</a>
      </div>
      <label>Hugging Face read token
        <input type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off"
          className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 p-2" />
      </label>
      <button type="button" disabled={busy || !token.trim()} onClick={() => void connect()}
        className="mt-2 rounded-lg border border-cyan-400/30 px-3 py-2 disabled:opacity-40">{busy ? "Connecting…" : "Connect Hugging Face"}</button>
      {message ? <p role="status" className="mt-2 break-words">{message}</p> : null}
    </details>
  );
}
