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
import { parseYoutubeReference } from "../lib/youtube-reference";
import { resolveYoutubeMusicDna } from "../lib/youtube-music-dna";
import { APP_VERSION } from "../lib/music-config";
import {
  useProjectWorkspaceActions,
  useProjectWorkspaceProjectState,
} from "../context/project-workspace-context";

/**
 * Voice Character Studio — analyze vocal files, optional YouTube reference metadata, character presets.
 */
export function useCharacterVoiceStudio() {
  const { selectedGenres, mood, promptEngine, styleDnaSettings } = useProjectWorkspaceProjectState();
  const {
    setVoiceStyleLine,
    setVocal,
    setVoiceRefFirstName,
    setVoiceRefLastName,
    setRules,
    setStatusWithTime,
    setGuidedStep,
    captureSnapshot,
    applyStyleDnaToProject,
    setStructure,
    setIdea,
    copyToClipboard,
  } = useProjectWorkspaceActions();
  const [characterPresets, setCharacterPresets] = useState({});
  const [voiceAnalysis, setVoiceAnalysis] = useState(null);
  const [youtubeReference, setYoutubeReference] = useState(null);
  const [youtubeMusicDna, setYoutubeMusicDna] = useState(null);
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
    setYoutubeMusicDna(normalized.youtubeMusicDna || null);
    setPresetName(normalized.presetName);
    setVoiceStyleCompact(normalized.voiceStyleCompact);
  }, []);

  useEffect(() => {
    const syncSessionFromStorage = () => {
      applySessionState(loadCharacterVoiceStudioSessionFromStorage());
      skipSessionPersistRef.current = true;
    };
    syncSessionFromStorage();
    window.addEventListener(CHARACTER_VOICE_STUDIO_SESSION_CHANGED_EVENT, syncSessionFromStorage);
    return () =>
      window.removeEventListener(CHARACTER_VOICE_STUDIO_SESSION_CHANGED_EVENT, syncSessionFromStorage);
  }, [applySessionState]);

  useEffect(() => {
    if (skipSessionPersistRef.current) {
      skipSessionPersistRef.current = false;
      return;
    }
    saveCharacterVoiceStudioSessionToStorage({
      voiceAnalysis,
      voiceStyleCompact,
      youtubeReference,
      youtubeMusicDna,
      presetName,
    });
  }, [voiceAnalysis, voiceStyleCompact, youtubeReference, youtubeMusicDna, presetName]);

  const projectCtx = useCallback(
    () => ({
      selectedGenres,
      moodWords: buildMoodWords(mood),
    }),
    [selectedGenres, mood],
  );

  const applyLinesToProject = useCallback(
    (
      lines,
      {
        appendRules = true,
        voiceAnalysisOverride = undefined,
        youtubeReferenceOverride = undefined,
        youtubeMusicDnaOverride = undefined,
        presetNameOverride = undefined,
      } = {},
    ) => {
      setVoiceStyleLine(lines.voiceStyleLine);
      setVocal(lines.vocalRole);
      setVoiceRefFirstName("");
      setVoiceRefLastName("");
      const compact =
        lines.voiceStyleCompact && typeof lines.voiceStyleCompact === "object"
          ? lines.voiceStyleCompact
          : { style: "", lyricTag: "" };
      setVoiceStyleCompact(compact);
      if (appendRules && lines.rulesAddition) {
        setRules((prev) => {
          const p = String(prev || "").trim();
          if (p.includes(lines.rulesAddition.slice(0, 24))) return prev;
          return p ? `${p}\n${lines.rulesAddition}` : lines.rulesAddition;
        });
      }
      persistCharacterVoiceStudioSession({
        voiceAnalysis: voiceAnalysisOverride !== undefined ? voiceAnalysisOverride : voiceAnalysis,
        voiceStyleCompact: compact,
        youtubeReference:
          youtubeReferenceOverride !== undefined ? youtubeReferenceOverride : youtubeReference,
        youtubeMusicDna:
          youtubeMusicDnaOverride !== undefined ? youtubeMusicDnaOverride : youtubeMusicDna,
        presetName: presetNameOverride !== undefined ? presetNameOverride : presetName,
      });
    },
    [
      presetName,
      setRules,
      setVocal,
      setVoiceRefFirstName,
      setVoiceRefLastName,
      setVoiceStyleLine,
      voiceAnalysis,
      youtubeMusicDna,
      youtubeReference,
    ],
  );

  const analyzeVoiceFile = useCallback(
    async (file) => {
      if (!file || !isSupportedAudioFile(file)) {
        setStatusWithTime(`Use ${SUPPORTED_AUDIO_LABEL} with a clear lead vocal`, "warning");
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
        applyLinesToProject(lines, { voiceAnalysisOverride: analysis });
        setStatusWithTime(
          analysis.vocalsLikely
            ? "Voice character analyzed — Suno voice block regenerated from traits"
            : "Weak vocal signal — try acapella; draft lines still generated",
          analysis.vocalsLikely ? "success" : "warning",
        );
        if (promptEngine === "Suno-like") {
          setGuidedStep(resolvePolishStepIndex());
        }
      } catch {
        setStatusWithTime("Voice analysis failed — try WAV or MP3 acapella", "error");
      } finally {
        setBusy(false);
      }
    },
    [applyLinesToProject, presetName, projectCtx, promptEngine, setGuidedStep, setStatusWithTime, youtubeReference],
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
        setStatusWithTime("Invalid YouTube link", "error");
        return;
      }
      setBusy(true);
      try {
        const bundle = await resolveYoutubeMusicDna(url, styleDnaSettings);
        const nextRef = {
          videoId: bundle.youtube.videoId,
          watchUrl: bundle.youtube.watchUrl,
          title: bundle.youtube.title,
          authorName: bundle.youtube.authorName,
          parsedArtist: bundle.youtube.parsedArtist,
          parsedTrack: bundle.youtube.parsedTrack,
          durationSec: bundle.youtube.durationSec,
          provider: bundle.youtube.provider,
        };
        setYoutubeReference(nextRef);
        setYoutubeMusicDna(bundle);
        persistCharacterVoiceStudioSession({
          voiceAnalysis,
          voiceStyleCompact,
          youtubeReference: nextRef,
          youtubeMusicDna: bundle,
          presetName,
        });
        setStatusWithTime(
          `YouTube linked: ${bundle.dna.artist} — ${bundle.dna.title} (${bundle.provider}) — Suno replication pack ready`,
          "success",
        );
      } catch (err) {
        const fallbackRef = {
          ...ref,
          title: ref.videoId,
        };
        setYoutubeReference(fallbackRef);
        setYoutubeMusicDna(null);
        persistCharacterVoiceStudioSession({
          voiceAnalysis,
          voiceStyleCompact,
          youtubeReference: fallbackRef,
          youtubeMusicDna: null,
          presetName,
        });
        setStatusWithTime(
          err instanceof Error ? err.message : "YouTube resolve failed — start sidecar (npm run sidecar)",
          "warning",
        );
      } finally {
        setBusy(false);
      }
    },
    [presetName, setStatusWithTime, styleDnaSettings, voiceAnalysis, voiceStyleCompact],
  );

  const applyYoutubeMusicDnaToProject = useCallback(() => {
    if (!youtubeMusicDna?.replication) {
      setStatusWithTime("Link a YouTube track first", "warning");
      return;
    }
    captureSnapshot("before YouTube track DNA");
    applyStyleDnaToProject(youtubeMusicDna.dna);
    const rep = youtubeMusicDna.replication;
    if (rep.structure) setStructure(rep.structure);
    if (rep.ideaLine) setIdea(rep.ideaLine);
    if (rep.styleLine) setVoiceStyleLine(rep.styleLine);
    setStatusWithTime("Applied YouTube track DNA + Suno 5.5 replication pack to project");
  }, [
    applyStyleDnaToProject,
    captureSnapshot,
    setIdea,
    setStructure,
    setStatusWithTime,
    setVoiceStyleLine,
    youtubeMusicDna,
  ]);

  const saveCharacterPreset = useCallback(() => {
    const name = presetName.trim();
    if (!name) {
      setStatusWithTime("Character preset name missing", "warning");
      return;
    }
    if (!voiceAnalysis) {
      setStatusWithTime("Analyze a vocal file first", "warning");
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
      setStatusWithTime(storageFailureMessage(result), "error");
      return;
    }
    setCharacterPresets(next);
    setPresetName("");
    setStatusWithTime(`Saved character preset: ${name}`);
  }, [characterPresets, presetName, projectCtx, voiceAnalysis, setStatusWithTime, youtubeReference]);

  const loadCharacterPreset = useCallback(
    (name) => {
      const preset = characterPresets[name];
      if (!preset) return;
      const nextYoutube = preset.source?.youtubeUrl
        ? {
            videoId: preset.source.youtubeVideoId,
            watchUrl: preset.source.youtubeUrl,
            title: preset.source.youtubeTitle,
          }
        : null;
      setVoiceAnalysis(preset.analysis);
      setPresetName(name);
      setYoutubeReference(nextYoutube);
      setYoutubeMusicDna(null);
      applyLinesToProject(preset, {
        appendRules: false,
        voiceAnalysisOverride: preset.analysis,
        youtubeReferenceOverride: nextYoutube,
        youtubeMusicDnaOverride: null,
        presetNameOverride: name,
      });
      setStatusWithTime(`Loaded character preset: ${name}`);
    },
    [applyLinesToProject, characterPresets, setStatusWithTime],
  );

  const regenerateCharacterVoice = useCallback(
    (name) => {
      const preset = name ? characterPresets[name] : null;
      const base = preset ||
        (voiceAnalysis
          ? { name: presetName || voiceAnalysis.characterLabel, analysis: voiceAnalysis }
          : null);
      if (!base?.analysis) {
        setStatusWithTime("Nothing to regenerate — analyze or load a character preset", "warning");
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
          setStatusWithTime(storageFailureMessage(result), "error");
          return;
        }
        setCharacterPresets(next);
      }
      setStatusWithTime("Regenerated Suno voice block from character DNA (max trait match)");
    },
    [applyLinesToProject, characterPresets, presetName, projectCtx, voiceAnalysis, setStatusWithTime, youtubeReference],
  );

  const deleteCharacterPreset = useCallback(
    (name) => {
      captureSnapshot(`before delete character preset ${name}`);
      const next = { ...characterPresets };
      delete next[name];
      const result = saveCharacterPresetsToStorage(next);
      if (!result.ok) {
        setStatusWithTime(storageFailureMessage(result), "error");
        return;
      }
      setCharacterPresets(next);
      setStatusWithTime(`Deleted character preset: ${name}`);
    },
    [captureSnapshot, characterPresets, setStatusWithTime],
  );

  const clearStudio = useCallback(() => {
    setVoiceAnalysis(null);
    setYoutubeReference(null);
    setYoutubeMusicDna(null);
    setPresetName("");
    setVoiceStyleCompact({ style: "", lyricTag: "" });
    persistCharacterVoiceStudioSession({
      voiceAnalysis: null,
      voiceStyleCompact: { style: "", lyricTag: "" },
      youtubeReference: null,
      youtubeMusicDna: null,
      presetName: "",
    });
    setStatusWithTime("Voice character studio cleared");
  }, [setStatusWithTime]);

  const exportCharacterPresets = useCallback(() => {
    const count = Object.keys(characterPresets).length;
    if (!count) {
      setStatusWithTime("No character presets to export", "warning");
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
    setStatusWithTime(`Exported ${count} character preset${count === 1 ? "" : "s"} JSON`);
  }, [characterPresets, setStatusWithTime]);

  const importCharacterPresets = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      captureSnapshot("before character preset import");
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const raw = JSON.parse(String(reader.result));
          const imported = parseCharacterPresetsImport(raw);
          const count = Object.keys(imported).length;
          if (!count) {
            setStatusWithTime("No valid character presets in file", "error");
            return;
          }
          setCharacterPresets((prev) => {
            const next = mergeCharacterPresetsMaps(prev, imported);
            const result = saveCharacterPresetsToStorage(next);
            if (!result.ok) {
              queueMicrotask(() => setStatusWithTime(storageFailureMessage(result), "error"));
              return prev;
            }
            queueMicrotask(() =>
              setStatusWithTime(`Imported ${count} character preset${count === 1 ? "" : "s"}`),
            );
            return next;
          });
        } catch {
          setStatusWithTime("Character preset import failed", "error");
        } finally {
          event.target.value = "";
        }
      };
      reader.onerror = () => {
        setStatusWithTime("Character preset import failed", "error");
        event.target.value = "";
      };
      reader.readAsText(file);
    },
    [captureSnapshot, setStatusWithTime],
  );

  return {
    busy,
    characterPresets,
    deleteCharacterPreset,
    exportCharacterPresets,
    importCharacterPresets,
    linkYoutubeReference,
    applyYoutubeMusicDnaToProject,
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
    youtubeMusicDna,
    copyToClipboard,
  };
}
