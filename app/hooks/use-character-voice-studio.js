"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isSupportedAudioFile, SUPPORTED_AUDIO_LABEL } from "../lib/analyzer-file-types";
import { buildMoodWords } from "../lib/music-helpers";
import { storageFailureMessage } from "../lib/safe-local-storage";
import { decodeAndAnalyzeVoiceFile } from "../lib/voice-character-analyzer";
import {
  buildSunoLinesFromVoiceCharacter,
  CHARACTER_VOICE_PRESETS_CHANGED_EVENT,
  createCharacterVoicePreset,
  loadCharacterPresetsFromStorage,
  mergeCharacterPresetsMaps,
  parseCharacterPresetsImport,
  regenerateCharacterVoicePreset,
  saveCharacterPresetsToStorage,
  serializeCharacterPresetsExport,
} from "../lib/voice-character-preset";
import {
  CHARACTER_VOICE_STUDIO_SESSION_CHANGED_EVENT,
  loadCharacterVoiceStudioSessionFromStorage,
  normalizeCharacterVoiceStudioSession,
  persistCharacterVoiceStudioSession,
  saveCharacterVoiceStudioSessionToStorage,
} from "../lib/voice-character-studio-session";
import {
  VOICE_CHARACTER_ANALYZE_FILE_EVENT,
} from "../lib/voice-character-handoff";
import { resolvePolishStepIndex } from "../lib/suno-guided-workflow";
import { fetchYoutubeTitle, parseYoutubeReference } from "../lib/youtube-reference";
import { APP_VERSION } from "../lib/music-config";
import { useProjectWorkspace } from "../context/project-workspace-context";

/**
 * Voice Character Studio — analyze vocal files, optional YouTube reference metadata, character presets.
 */
export function useCharacterVoiceStudio() {
  const ws = useProjectWorkspace();
  const [characterPresets, setCharacterPresets] = useState({});
  const [voiceAnalysis, setVoiceAnalysis] = useState(null);
  const [youtubeReference, setYoutubeReference] = useState(null);
  const [busy, setBusy] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [voiceStyleCompact, setVoiceStyleCompact] = useState({ style: "", lyricTag: "" });
  const skipSessionPersistRef = useRef(true);

  useEffect(() => {
    const syncFromStorage = () => setCharacterPresets(loadCharacterPresetsFromStorage());
    syncFromStorage();
    window.addEventListener(CHARACTER_VOICE_PRESETS_CHANGED_EVENT, syncFromStorage);
    return () => window.removeEventListener(CHARACTER_VOICE_PRESETS_CHANGED_EVENT, syncFromStorage);
  }, []);

  const applySessionState = useCallback((session) => {
    const normalized = normalizeCharacterVoiceStudioSession(session);
    setVoiceAnalysis(normalized.voiceAnalysis);
    setYoutubeReference(normalized.youtubeReference);
    setPresetName(normalized.presetName);
    setVoiceStyleCompact(normalized.voiceStyleCompact);
  }, []);

  useEffect(() => {
    const syncSessionFromStorage = () => {
      applySessionState(loadCharacterVoiceStudioSessionFromStorage());
      skipSessionPersistRef.current = false;
    };
    syncSessionFromStorage();
    window.addEventListener(CHARACTER_VOICE_STUDIO_SESSION_CHANGED_EVENT, syncSessionFromStorage);
    return () =>
      window.removeEventListener(CHARACTER_VOICE_STUDIO_SESSION_CHANGED_EVENT, syncSessionFromStorage);
  }, [applySessionState]);

  useEffect(() => {
    if (skipSessionPersistRef.current) return;
    saveCharacterVoiceStudioSessionToStorage({
      voiceAnalysis,
      voiceStyleCompact,
      youtubeReference,
      presetName,
    });
  }, [voiceAnalysis, voiceStyleCompact, youtubeReference, presetName]);

  const projectCtx = useCallback(
    () => ({
      selectedGenres: ws.selectedGenres,
      moodWords: buildMoodWords(ws.mood),
    }),
    [ws.selectedGenres, ws.mood],
  );

  const applyLinesToProject = useCallback(
    (lines, { appendRules = true } = {}) => {
      ws.setVoiceStyleLine(lines.voiceStyleLine);
      ws.setVocal(lines.vocalRole);
      ws.setVoiceRefFirstName("");
      ws.setVoiceRefLastName("");
      setVoiceStyleCompact(
        lines.voiceStyleCompact && typeof lines.voiceStyleCompact === "object"
          ? lines.voiceStyleCompact
          : { style: "", lyricTag: "" },
      );
      if (appendRules && lines.rulesAddition) {
        ws.setRules((prev) => {
          const p = String(prev || "").trim();
          if (p.includes(lines.rulesAddition.slice(0, 24))) return prev;
          return p ? `${p}\n${lines.rulesAddition}` : lines.rulesAddition;
        });
      }
    },
    [ws],
  );

  const analyzeVoiceFile = useCallback(
    async (file) => {
      if (!file || !isSupportedAudioFile(file)) {
        ws.setStatusWithTime(`Use ${SUPPORTED_AUDIO_LABEL} with a clear lead vocal`, "warning");
        return;
      }
      setBusy(true);
      try {
        const meta = youtubeReference
          ? {
              type: "file+youtube",
              youtubeVideoId: youtubeReference.videoId,
              youtubeTitle: youtubeReference.title,
              youtubeUrl: youtubeReference.watchUrl,
            }
          : { type: "file" };
        const analysis = await decodeAndAnalyzeVoiceFile(file, meta);
        setVoiceAnalysis(analysis);
        const lines = buildSunoLinesFromVoiceCharacter(analysis, {
          ...projectCtx(),
          characterName: presetName.trim() || analysis.characterLabel,
          youtubeTitle: youtubeReference?.title,
        });
        applyLinesToProject(lines);
        ws.setStatusWithTime(
          analysis.vocalsLikely
            ? "Voice character analyzed — Suno voice block regenerated from traits"
            : "Weak vocal signal — try acapella; draft lines still generated",
          analysis.vocalsLikely ? "success" : "warning",
        );
        if (ws.promptEngine === "Suno-like") {
          ws.setGuidedStep(resolvePolishStepIndex());
        }
      } catch {
        ws.setStatusWithTime("Voice analysis failed — try WAV or MP3 acapella", "error");
      } finally {
        setBusy(false);
      }
    },
    [applyLinesToProject, presetName, projectCtx, ws, youtubeReference],
  );

  useEffect(() => {
    const onHandoffFile = (event) => {
      const file = event.detail?.file;
      if (file) analyzeVoiceFile(file);
    };
    window.addEventListener(VOICE_CHARACTER_ANALYZE_FILE_EVENT, onHandoffFile);
    return () => window.removeEventListener(VOICE_CHARACTER_ANALYZE_FILE_EVENT, onHandoffFile);
  }, [analyzeVoiceFile]);

  const linkYoutubeReference = useCallback(
    async (url) => {
      const ref = parseYoutubeReference(url);
      if (!ref) {
        ws.setStatusWithTime("Invalid YouTube link", "error");
        return;
      }
      setBusy(true);
      const title = await fetchYoutubeTitle(ref.watchUrl);
      setYoutubeReference({ ...ref, title: title || ref.videoId });
      setBusy(false);
      ws.setStatusWithTime(
        title
          ? `YouTube reference linked: ${title} — now drop exported vocal audio`
          : "YouTube reference linked — drop exported vocal audio for analysis",
        "info",
      );
    },
    [ws],
  );

  const saveCharacterPreset = useCallback(() => {
    const name = presetName.trim();
    if (!name) {
      ws.setStatusWithTime("Character preset name missing", "warning");
      return;
    }
    if (!voiceAnalysis) {
      ws.setStatusWithTime("Analyze a vocal file first", "warning");
      return;
    }
    const lines = buildSunoLinesFromVoiceCharacter(voiceAnalysis, {
      ...projectCtx(),
      characterName: name,
      youtubeTitle: youtubeReference?.title,
    });
    const preset = createCharacterVoicePreset(
      name,
      voiceAnalysis,
      lines,
      youtubeReference
        ? {
            youtubeVideoId: youtubeReference.videoId,
            youtubeUrl: youtubeReference.watchUrl,
            youtubeTitle: youtubeReference.title,
          }
        : voiceAnalysis.source || {},
    );
    const next = { ...characterPresets, [name]: preset };
    const result = saveCharacterPresetsToStorage(next);
    if (!result.ok) {
      ws.setStatusWithTime(storageFailureMessage(result), "error");
      return;
    }
    setCharacterPresets(next);
    setPresetName("");
    ws.setStatusWithTime(`Saved character preset: ${name}`);
  }, [characterPresets, presetName, projectCtx, voiceAnalysis, ws, youtubeReference]);

  const loadCharacterPreset = useCallback(
    (name) => {
      const preset = characterPresets[name];
      if (!preset) return;
      setVoiceAnalysis(preset.analysis);
      setPresetName(name);
      if (preset.source?.youtubeUrl) {
        setYoutubeReference({
          videoId: preset.source.youtubeVideoId,
          watchUrl: preset.source.youtubeUrl,
          title: preset.source.youtubeTitle,
        });
      } else {
        setYoutubeReference(null);
      }
      applyLinesToProject(preset, { appendRules: false });
      ws.setStatusWithTime(`Loaded character preset: ${name}`);
    },
    [applyLinesToProject, characterPresets, ws],
  );

  const regenerateCharacterVoice = useCallback(
    (name) => {
      const preset = name ? characterPresets[name] : null;
      const base = preset ||
        (voiceAnalysis
          ? { name: presetName || voiceAnalysis.characterLabel, analysis: voiceAnalysis }
          : null);
      if (!base?.analysis) {
        ws.setStatusWithTime("Nothing to regenerate — analyze or load a character preset", "warning");
        return;
      }
      const regen = regenerateCharacterVoicePreset(
        preset || {
          name: base.name || base.analysis.characterLabel,
          analysis: base.analysis,
          source: { youtubeTitle: youtubeReference?.title },
        },
        projectCtx(),
      );
      if (!regen) return;
      applyLinesToProject(regen);
      if (preset && name) {
        const updated = {
          ...preset,
          voiceStyleLine: regen.voiceStyleLine,
          voiceStyleCompact: regen.voiceStyleCompact,
          vocalRole: regen.vocalRole,
          rulesAddition: regen.rulesAddition,
        };
        const next = { ...characterPresets, [name]: updated };
        const result = saveCharacterPresetsToStorage(next);
        if (!result.ok) {
          ws.setStatusWithTime(storageFailureMessage(result), "error");
          return;
        }
        setCharacterPresets(next);
      }
      ws.setStatusWithTime("Regenerated Suno voice block from character DNA (max trait match)");
    },
    [applyLinesToProject, characterPresets, presetName, projectCtx, voiceAnalysis, ws, youtubeReference],
  );

  const deleteCharacterPreset = useCallback(
    (name) => {
      ws.captureSnapshot(`before delete character preset ${name}`);
      const next = { ...characterPresets };
      delete next[name];
      const result = saveCharacterPresetsToStorage(next);
      if (!result.ok) {
        ws.setStatusWithTime(storageFailureMessage(result), "error");
        return;
      }
      setCharacterPresets(next);
      ws.setStatusWithTime(`Deleted character preset: ${name}`);
    },
    [characterPresets, ws],
  );

  const clearStudio = useCallback(() => {
    setVoiceAnalysis(null);
    setYoutubeReference(null);
    setPresetName("");
    setVoiceStyleCompact({ style: "", lyricTag: "" });
    persistCharacterVoiceStudioSession({
      voiceAnalysis: null,
      voiceStyleCompact: { style: "", lyricTag: "" },
      youtubeReference: null,
      presetName: "",
    });
    ws.setStatusWithTime("Voice character studio cleared");
  }, [ws]);

  const exportCharacterPresets = useCallback(() => {
    const count = Object.keys(characterPresets).length;
    if (!count) {
      ws.setStatusWithTime("No character presets to export", "warning");
      return;
    }
    const payload = serializeCharacterPresetsExport(characterPresets, APP_VERSION);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "character-voice-presets.json";
    a.click();
    URL.revokeObjectURL(url);
    ws.setStatusWithTime(`Exported ${count} character preset${count === 1 ? "" : "s"} JSON`);
  }, [characterPresets, ws]);

  const importCharacterPresets = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      ws.captureSnapshot("before character preset import");
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const raw = JSON.parse(String(reader.result));
          const imported = parseCharacterPresetsImport(raw);
          const count = Object.keys(imported).length;
          if (!count) {
            ws.setStatusWithTime("No valid character presets in file", "error");
            return;
          }
          setCharacterPresets((prev) => {
            const next = mergeCharacterPresetsMaps(prev, imported);
            const result = saveCharacterPresetsToStorage(next);
            if (!result.ok) {
              queueMicrotask(() => ws.setStatusWithTime(storageFailureMessage(result), "error"));
              return prev;
            }
            queueMicrotask(() =>
              ws.setStatusWithTime(`Imported ${count} character preset${count === 1 ? "" : "s"}`),
            );
            return next;
          });
        } catch {
          ws.setStatusWithTime("Character preset import failed", "error");
        } finally {
          event.target.value = "";
        }
      };
      reader.onerror = () => {
        ws.setStatusWithTime("Character preset import failed", "error");
        event.target.value = "";
      };
      reader.readAsText(file);
    },
    [ws],
  );

  return {
    busy,
    characterPresets,
    deleteCharacterPreset,
    exportCharacterPresets,
    importCharacterPresets,
    linkYoutubeReference,
    analyzeVoiceFile,
    clearStudio,
    loadCharacterPreset,
    presetName,
    regenerateCharacterVoice,
    saveCharacterPreset,
    setPresetName,
    voiceAnalysis,
    voiceStyleCompact,
    youtubeReference,
  };
}
