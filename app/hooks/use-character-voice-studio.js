"use client";

import { useCallback, useState } from "react";
import { isSupportedAudioFile, SUPPORTED_AUDIO_LABEL } from "../lib/analyzer-file-types";
import { buildMoodWords } from "../lib/music-helpers";
import { safeLocalStorage, storageFailureMessage } from "../lib/safe-local-storage";
import { decodeAndAnalyzeVoiceFile } from "../lib/voice-character-analyzer";
import {
  buildSunoLinesFromVoiceCharacter,
  CHARACTER_VOICE_PRESET_KEY,
  createCharacterVoicePreset,
  mergeCharacterPresetsMaps,
  normalizeCharacterPresetsMap,
  parseCharacterPresetsImport,
  regenerateCharacterVoicePreset,
  serializeCharacterPresetsExport,
} from "../lib/voice-character-preset";
import { fetchYoutubeTitle, parseYoutubeReference } from "../lib/youtube-reference";
import { APP_VERSION } from "../lib/music-config";
import { useProjectWorkspace } from "../context/project-workspace-context";

function loadPresetsFromStorage() {
  const raw = safeLocalStorage.getJSON(CHARACTER_VOICE_PRESET_KEY, {});
  return normalizeCharacterPresetsMap(raw);
}

function savePresetsToStorage(presets) {
  return safeLocalStorage.setJSON(CHARACTER_VOICE_PRESET_KEY, presets);
}

/**
 * Voice Character Studio — analyze vocal files, optional YouTube reference metadata, character presets.
 */
export function useCharacterVoiceStudio() {
  const ws = useProjectWorkspace();
  const [characterPresets, setCharacterPresets] = useState(loadPresetsFromStorage);
  const [voiceAnalysis, setVoiceAnalysis] = useState(null);
  const [youtubeReference, setYoutubeReference] = useState(null);
  const [busy, setBusy] = useState(false);
  const [presetName, setPresetName] = useState("");

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
      } catch {
        ws.setStatusWithTime("Voice analysis failed — try WAV or MP3 acapella", "error");
      } finally {
        setBusy(false);
      }
    },
    [applyLinesToProject, presetName, projectCtx, ws, youtubeReference],
  );

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
    const result = savePresetsToStorage(next);
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
        savePresetsToStorage(next);
        setCharacterPresets(next);
      }
      ws.setStatusWithTime("Regenerated Suno voice block from character DNA (max trait match)");
    },
    [applyLinesToProject, characterPresets, presetName, projectCtx, voiceAnalysis, ws, youtubeReference],
  );

  const deleteCharacterPreset = useCallback(
    (name) => {
      const next = { ...characterPresets };
      delete next[name];
      const result = savePresetsToStorage(next);
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
          const next = mergeCharacterPresetsMaps(characterPresets, imported);
          const result = savePresetsToStorage(next);
          if (!result.ok) {
            ws.setStatusWithTime(storageFailureMessage(result), "error");
            return;
          }
          setCharacterPresets(next);
          ws.setStatusWithTime(`Imported ${count} character preset${count === 1 ? "" : "s"}`);
        } catch {
          ws.setStatusWithTime("Character preset import failed", "error");
        } finally {
          event.target.value = "";
        }
      };
      reader.readAsText(file);
    },
    [characterPresets, ws],
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
    youtubeReference,
  };
}
