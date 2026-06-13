"use client";

import { ElectronUpdateControls } from "./electron-update-controls";

const LOGO_SRC = "./bones-logo.png";

export function SplashOverlay({ onDismiss }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0b0d10]">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(circle at center, rgba(184,115,51,.28), transparent 35%), radial-gradient(circle at 65% 35%, rgba(34,211,238,.18), transparent 30%)",
        }}
      />
      <div className="relative mx-6 max-w-xl rounded-[2rem] border border-orange-300/25 bg-black/60 p-8 text-center shadow-2xl backdrop-blur">
        {/* eslint-disable-next-line @next/next/no-img-element -- static export/Electron friendly asset */}
        <img
          src={LOGO_SRC}
          alt="BONES VIBRATION logo"
          className="mx-auto mb-4 max-h-44 w-auto object-contain drop-shadow-[0_0_35px_rgba(249,115,22,0.45)]"
        />
        <div className="text-xs font-black uppercase tracking-[0.35em] text-orange-300">
          BONES VIBRATION
        </div>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-white">AI Music Creator</h1>
        <p className="mt-3 text-sm text-white/55">Loading Prompt Control Room...</p>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-orange-300" />
        </div>
        <button
          onClick={onDismiss}
          className="mt-5 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white/70 hover:bg-white/20"
        >
          Skip intro
        </button>
      </div>
    </div>
  );
}

export function AppHeader({ appVersion, avgScore, saveStatus, statusPulseKey = 0 }) {
  return (
    <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="mb-2 inline-flex rounded-full border border-orange-300/25 bg-orange-300/10 px-3 py-1 text-xs font-black tracking-wider text-orange-200">
          BONES VIBRATION • AI MUSIC CREATOR
        </div>
        <h1 className="bg-gradient-to-r from-white via-orange-200 to-cyan-200 bg-clip-text text-4xl font-black tracking-tight text-transparent md:text-6xl">
          Prompt Control Room
        </h1>
        <p className="mt-2 max-w-2xl text-white/55">
          Level 2 prompt engine: Suno guided path, local track and image analyzers (waveforms,
          highlight, merge), EBU R128 loudness readout, studio WAV/MP3 export (16- and 24-bit), presets, variations,
          history, and Pro Mode.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider text-white/45">
          <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1">
            v{appVersion}
          </span>
          <span className="rounded-full border border-orange-300/20 bg-orange-300/10 px-3 py-1 text-orange-200">
            DJ M@D
          </span>
          <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-violet-200">
            Studio export
          </span>
        </div>
      </div>
      <div className="hidden items-center justify-center rounded-[2rem] border border-orange-300/15 bg-black/25 p-3 shadow-2xl md:flex">
        {/* eslint-disable-next-line @next/next/no-img-element -- static export/Electron friendly asset */}
        <img
          src={LOGO_SRC}
          alt="BONES VIBRATION logo"
          className="max-h-48 w-auto object-contain drop-shadow-[0_0_35px_rgba(249,115,22,0.45)]"
        />
      </div>
      <div
        key={statusPulseKey}
        className={`rounded-3xl border border-white/10 bg-white/[0.06] p-4 ${statusPulseKey ? "status-pulse" : ""}`}
      >
        <div className="text-xs text-white/50">Project status</div>
        <div className="text-sm font-bold text-cyan-100">{saveStatus}</div>
        <div className="mt-2 text-xs text-white/50">Average score</div>
        <div className="text-3xl font-black text-cyan-200">{avgScore}/5</div>
        <ElectronUpdateControls />
      </div>
    </header>
  );
}
