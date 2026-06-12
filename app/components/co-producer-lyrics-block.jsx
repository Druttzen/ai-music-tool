"use client";

import {
  formatLyricsCharBudget,
  getLyricStyleDirection,
} from "../lib/lyric-generator";

/**
 * Shared Co-Producer lyrics editor: generate, shuffle, edit, char budget, stale-style warning.
 */
export function CoProducerLyricsBlock({
  lyricStyle,
  generatedLyrics,
  generatedLyricsStyle,
  onLyricsChange,
  onGenerate,
  onAnotherTake,
  generateBusy = false,
  showStyleHint = true,
  className = "",
}) {
  const stale =
    !!generatedLyrics &&
    !!generatedLyricsStyle &&
    generatedLyricsStyle !== lyricStyle;
  const budget = formatLyricsCharBudget(generatedLyrics);

  return (
    <div className={`rounded-2xl border border-fuchsia-300/20 bg-fuchsia-950/20 p-3 ${className}`}>
      {showStyleHint && (
        <>
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-fuchsia-200/80">
            Co-Producer · Generate Lyrics
          </div>
          <p className="mb-3 text-[11px] leading-relaxed text-white/50">
            Builds lyric text from <strong className="text-white/70">{lyricStyle}</strong> (
            {getLyricStyleDirection(lyricStyle)}). Uses theme, mode, density, and mood — paste into
            Suno&apos;s Lyrics field.
          </p>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="co-producer-generate-lyrics"
          onClick={onGenerate}
          disabled={generateBusy}
          className="rounded-2xl bg-orange-300 px-4 py-2 text-sm font-bold text-black hover:bg-orange-200 disabled:opacity-50"
        >
          {generateBusy ? "Generating…" : "Generate Lyrics"}
        </button>
        <button
          type="button"
          onClick={onAnotherTake}
          disabled={generateBusy}
          className="rounded-2xl border border-orange-300/40 bg-black/30 px-4 py-2 text-sm font-bold text-orange-100 hover:bg-black/50 disabled:opacity-50"
        >
          Another take
        </button>
      </div>

      {stale && (
        <p className="mt-2 rounded-xl border border-amber-400/30 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">
          Lyric Style changed to <strong>{lyricStyle}</strong> — regenerate lyrics to match the new
          style prompt.
        </p>
      )}

      {generatedLyrics && (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-orange-200/75">
              {generatedLyricsStyle ? (
                <>
                  Generated for <strong className="text-orange-100">{generatedLyricsStyle}</strong>
                  {generatedLyricsStyle !== lyricStyle ? " (stale)" : ""}
                </>
              ) : (
                <>Lyric Style: {lyricStyle}</>
              )}
            </span>
            <span
              className={
                budget.isOver
                  ? "font-bold text-red-300"
                  : budget.isWarn
                    ? "text-amber-200"
                    : "text-white/45"
              }
            >
              {budget.label} chars
              {budget.isOver ? " — over typical Suno limit" : budget.isWarn ? " — near limit" : ""}
            </span>
          </div>
          <textarea
            value={generatedLyrics}
            onChange={(e) => onLyricsChange(e.target.value)}
            rows={14}
            className="mt-2 w-full resize-y rounded-2xl border border-orange-300/20 bg-black/50 p-4 font-mono text-xs leading-relaxed text-orange-50 outline-none focus:border-orange-300/50"
            spellCheck={false}
          />
        </>
      )}
    </div>
  );
}

export function CoProducerHooksBlock({
  lyricStyle,
  generatedHooks,
  generatedHooksStyle,
  hooksCharLabel,
}) {
  const stale =
    !!generatedHooks && !!generatedHooksStyle && generatedHooksStyle !== lyricStyle;

  return (
    <>
      {stale && (
        <p className="mt-2 rounded-xl border border-amber-400/30 bg-amber-950/30 px-3 py-2 text-xs text-amber-100">
          Hooks were generated for <strong>{generatedHooksStyle}</strong> — regenerate to match{" "}
          {lyricStyle}.
        </p>
      )}
      {generatedHooks && (
        <>
          <div className="mt-3 text-xs text-cyan-200/75">
            Hook style: <strong className="text-cyan-100">{generatedHooksStyle || lyricStyle}</strong>
            {hooksCharLabel ? ` · ${hooksCharLabel}` : ""}
          </div>
          <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap rounded-2xl border border-cyan-300/20 bg-black/50 p-4 text-xs leading-relaxed text-cyan-50">
            {generatedHooks}
          </pre>
        </>
      )}
    </>
  );
}

export function CoProducerLlmSettings({
  settings,
  onChange,
  onSave,
}) {
  return (
    <div className="mt-3 rounded-2xl border border-violet-300/20 bg-violet-950/20 p-3">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-violet-200/80">
        Optional LLM backend
      </div>
      <p className="mb-3 text-[11px] text-white/45">
        OpenAI-compatible API. Key stored locally in your browser only. Falls back to built-in
        templates if disabled or on error.
      </p>
      <label className="mb-2 flex items-center gap-2 text-sm text-white/70">
        <input
          type="checkbox"
          checked={!!settings.enabled}
          onChange={(e) => onChange({ ...settings, enabled: e.target.checked })}
        />
        Use LLM for Generate Lyrics
      </label>
      <div className="grid gap-2 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[10px] uppercase text-white/40">API URL</span>
          <input
            value={settings.apiUrl}
            onChange={(e) => onChange({ ...settings, apiUrl: e.target.value })}
            className="w-full rounded-xl border border-white/10 bg-black/30 p-2 text-xs text-white outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] uppercase text-white/40">Model</span>
          <input
            value={settings.model}
            onChange={(e) => onChange({ ...settings, model: e.target.value })}
            className="w-full rounded-xl border border-white/10 bg-black/30 p-2 text-xs text-white outline-none"
          />
        </label>
      </div>
      <label className="mt-2 block">
        <span className="mb-1 block text-[10px] uppercase text-white/40">API key</span>
        <input
          type="password"
          value={settings.apiKey}
          onChange={(e) => onChange({ ...settings, apiKey: e.target.value })}
          placeholder="sk-…"
          className="w-full rounded-xl border border-white/10 bg-black/30 p-2 text-xs text-white outline-none"
          autoComplete="off"
        />
      </label>
      <button
        type="button"
        onClick={onSave}
        className="mt-2 rounded-xl border border-violet-300/30 bg-violet-900/40 px-3 py-1.5 text-xs font-bold text-violet-100 hover:bg-violet-900/60"
      >
        Save LLM settings
      </button>
    </div>
  );
}
