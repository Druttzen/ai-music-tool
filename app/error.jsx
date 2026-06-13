"use client";

import { useEffect } from "react";
import { APP_VERSION } from "./lib/music-config";

/**
 * Catches render errors on the main page so a blank screen is not the only feedback.
 */
export default function Error({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0d10] p-6 text-white">
      <div className="max-w-md rounded-3xl border border-red-400/30 bg-red-500/10 p-6 text-center">
        <h1 className="text-lg font-bold text-red-100">Something went wrong</h1>
        <p className="mt-2 text-sm text-white/65">
          The prompt workspace hit an unexpected error. Your autosaved project in localStorage is
          usually still intact — reload and continue, or reset if the problem persists.
        </p>
        {error?.message ? (
          <pre className="mt-4 max-h-32 overflow-auto rounded-2xl border border-white/10 bg-black/40 p-3 text-left text-[10px] text-white/50">
            {error.message}
          </pre>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-2xl bg-cyan-300 px-4 py-2 text-sm font-bold text-black hover:bg-cyan-200"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-2xl border border-white/15 bg-black/30 px-4 py-2 text-sm font-bold text-white hover:bg-black/50"
          >
            Reload page
          </button>
        </div>
        <p className="mt-4 text-[10px] text-white/35">AI Music Creator v{APP_VERSION}</p>
      </div>
    </main>
  );
}
