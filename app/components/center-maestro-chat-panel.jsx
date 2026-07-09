"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Panel } from "./ui-blocks";
import {
  useProjectWorkspaceActions,
  useProjectWorkspaceProjectState,
} from "../context/project-workspace-context";
import {
  MAESTRO_CHAT_MAX_MESSAGES,
  MAESTRO_CHAT_STORAGE_KEY,
  buildMaestroReply,
  createMaestroGreeting,
  sanitizeMaestroPatch,
} from "../lib/maestro-chat-engine";
import { sendMaestroChatToLlm } from "../lib/maestro-chat-llm";
import { isCoProducerLlmReady } from "../lib/co-producer-llm";
import { safeLocalStorage } from "../lib/safe-local-storage";

function loadStoredMessages() {
  const stored = safeLocalStorage.getJSON(MAESTRO_CHAT_STORAGE_KEY, null);
  if (Array.isArray(stored) && stored.length) return stored;
  return [createMaestroGreeting()];
}

function ArtifactBlock({ label, text, onCopy, onApply, applyLabel }) {
  if (!text) return null;
  return (
    <div className="mt-2 rounded-2xl border border-cyan-300/20 bg-black/40 p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-200/80">{label}</span>
        <span className="flex gap-2">
          {onApply && (
            <button
              type="button"
              onClick={onApply}
              className="rounded-xl bg-cyan-300 px-2 py-0.5 text-[10px] font-bold text-black hover:bg-cyan-200"
            >
              {applyLabel || "Apply"}
            </button>
          )}
          <button
            type="button"
            onClick={onCopy}
            className="rounded-xl border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-white/20"
          >
            Copy
          </button>
        </span>
      </div>
      <pre className="max-h-44 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-cyan-50">{text}</pre>
    </div>
  );
}

export const CenterMaestroChatPanel = memo(function CenterMaestroChatPanel() {
  const {
    idea,
    tempo,
    structure,
    selectedGenres,
    selectedRhythms,
    selectedSounds,
    vocal,
    instrumentalVocalFx,
    mood,
    rules,
    lyricTheme,
    lyricLanguage,
    lyricStyle,
    lyricMode,
    lyricStructure,
    lyricDensity,
    voiceRefFirstName,
    voiceStyleLine,
    coProducerLlmSettings,
  } = useProjectWorkspaceProjectState();
  const {
    setIdea,
    setTempo,
    setStructure,
    setSelectedGenres,
    setSelectedRhythms,
    setSelectedSounds,
    setVocal,
    setInstrumentalVocalFx,
    setMood,
    setRules,
    setLyricTheme,
    setLyricLanguage,
    setLyricStyle,
    setGeneratedLyrics,
    setStatusWithTime,
    copyToClipboard,
  } = useProjectWorkspaceActions();

  const [messages, setMessages] = useState(loadStoredMessages);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  const snapshot = useMemo(
    () => ({
      idea,
      tempo,
      structure,
      selectedGenres,
      selectedRhythms,
      selectedSounds,
      vocal,
      instrumentalVocalFx,
      mood,
      rules,
      lyricTheme,
      lyricLanguage,
      lyricStyle,
      lyricMode,
      lyricStructure,
      lyricDensity,
      voiceRefFirstName,
      voiceStyleLine,
    }),
    [
      idea,
      tempo,
      structure,
      selectedGenres,
      selectedRhythms,
      selectedSounds,
      vocal,
      instrumentalVocalFx,
      mood,
      rules,
      lyricTheme,
      lyricLanguage,
      lyricStyle,
      lyricMode,
      lyricStructure,
      lyricDensity,
      voiceRefFirstName,
      voiceStyleLine,
    ],
  );

  useEffect(() => {
    safeLocalStorage.setJSON(
      MAESTRO_CHAT_STORAGE_KEY,
      messages.slice(-MAESTRO_CHAT_MAX_MESSAGES),
    );
  }, [messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const applyPatch = useCallback(
    (patch) => {
      if (!patch) return;
      const setterMap = {
        idea: setIdea,
        tempo: setTempo,
        structure: setStructure,
        selectedGenres: setSelectedGenres,
        selectedRhythms: setSelectedRhythms,
        selectedSounds: setSelectedSounds,
        vocal: setVocal,
        instrumentalVocalFx: setInstrumentalVocalFx,
        mood: setMood,
        rules: setRules,
        lyricTheme: setLyricTheme,
        lyricLanguage: setLyricLanguage,
        lyricStyle: setLyricStyle,
      };
      for (const [key, value] of Object.entries(patch)) {
        const setter = setterMap[key];
        if (setter) setter(value);
      }
    },
    [
      setIdea,
      setTempo,
      setStructure,
      setSelectedGenres,
      setSelectedRhythms,
      setSelectedSounds,
      setVocal,
      setInstrumentalVocalFx,
      setMood,
      setRules,
      setLyricTheme,
      setLyricLanguage,
      setLyricStyle,
    ],
  );

  const llmReady = isCoProducerLlmReady(coProducerLlmSettings);

  const send = useCallback(
    async (rawText) => {
      const text = String(rawText ?? draft).trim();
      if (!text || busy) return;
      setDraft("");
      setBusy(true);

      const userTurn = { role: "user", text };
      setMessages((prev) => [...prev, userTurn].slice(-MAESTRO_CHAT_MAX_MESSAGES));

      let assistantTurn;
      try {
        if (llmReady) {
          const history = [...messages, userTurn].map((m) => ({ role: m.role, text: m.text }));
          const llm = await sendMaestroChatToLlm(history, snapshot, coProducerLlmSettings);
          const patch = sanitizeMaestroPatch(llm.patch, snapshot);
          if (patch) applyPatch(patch);
          assistantTurn = { role: "assistant", text: llm.reply, source: "llm" };
          if (patch) setStatusWithTime("Maestro (LLM) updated the project");
        } else {
          throw new Error("__use_heuristic__");
        }
      } catch (err) {
        const local = buildMaestroReply(text, snapshot);
        if (local.patch) {
          applyPatch(local.patch);
          setStatusWithTime("Maestro updated the project");
        }
        const fallbackNote =
          llmReady && err?.message !== "__use_heuristic__"
            ? `(LLM unavailable — answered locally: ${String(err?.message || "error").slice(0, 80)})\n\n`
            : "";
        assistantTurn = {
          role: "assistant",
          text: `${fallbackNote}${local.reply}`,
          artifacts: local.artifacts,
          suggestions: local.suggestions,
        };
      }

      setMessages((prev) => [...prev, assistantTurn].slice(-MAESTRO_CHAT_MAX_MESSAGES));
      setBusy(false);
    },
    [applyPatch, busy, coProducerLlmSettings, draft, llmReady, messages, setStatusWithTime, snapshot],
  );

  const clearChat = useCallback(() => {
    const fresh = [createMaestroGreeting()];
    setMessages(fresh);
    safeLocalStorage.setJSON(MAESTRO_CHAT_STORAGE_KEY, fresh);
    setStatusWithTime("Maestro chat cleared");
  }, [setStatusWithTime]);

  const lastSuggestions =
    [...messages].reverse().find((m) => m.role === "assistant" && m.suggestions?.length)
      ?.suggestions || [];

  return (
    <Panel
      title="Maestro — AI Chat Music Creator"
      hint={
        llmReady
          ? "Chat co-producer (LLM mode — falls back to offline engine on errors). Everything you say updates the project."
          : "Chat co-producer — fully offline. Enable the LLM in Co-Producer AI settings for smarter replies."
      }
    >
      <div
        ref={scrollRef}
        className="max-h-96 space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-3"
      >
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-sm bg-cyan-300/90 px-3 py-2 text-xs font-medium text-black"
                  : "max-w-[92%] rounded-2xl rounded-bl-sm border border-orange-300/20 bg-orange-300/10 px-3 py-2 text-xs leading-relaxed text-orange-50"
              }
            >
              <div className="whitespace-pre-wrap">{m.text}</div>
              {m.role === "assistant" && m.artifacts && (
                <>
                  <ArtifactBlock
                    label="Suno Style prompt"
                    text={m.artifacts.stylePrompt}
                    onCopy={() => copyToClipboard(m.artifacts.stylePrompt, "Style prompt copied")}
                  />
                  <ArtifactBlock
                    label="Lyrics draft"
                    text={m.artifacts.lyrics}
                    onCopy={() => copyToClipboard(m.artifacts.lyrics, "Lyrics copied")}
                    onApply={() => {
                      setGeneratedLyrics(m.artifacts.lyrics);
                      setStatusWithTime("Lyrics applied to project");
                    }}
                    applyLabel="Use in project"
                  />
                  <ArtifactBlock
                    label="Hook ideas"
                    text={m.artifacts.hooks}
                    onCopy={() => copyToClipboard(m.artifacts.hooks, "Hooks copied")}
                  />
                </>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm border border-orange-300/20 bg-orange-300/10 px-3 py-2 text-xs text-orange-200/70">
              Maestro is thinking…
            </div>
          </div>
        )}
      </div>

      {lastSuggestions.length > 0 && !busy && (
        <div className="mt-2 flex flex-wrap gap-2">
          {lastSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="rounded-2xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-bold text-cyan-100 hover:bg-cyan-500/20"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder='Talk to Maestro — e.g. "dark techno at 140 bpm with whispered vocals"'
          disabled={busy}
          className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none focus:border-cyan-300 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="rounded-2xl bg-cyan-300 px-4 py-2 text-sm font-bold text-black hover:bg-cyan-200 disabled:opacity-50"
        >
          Send
        </button>
        <button
          type="button"
          onClick={clearChat}
          title="Clear conversation"
          className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-bold text-white hover:bg-white/20"
        >
          ✕
        </button>
      </form>
    </Panel>
  );
});
