"use client";

import { useCallback } from "react";
import {
  readStoredVocalAlignPreview,
  writeStoredVocalAlignPreview,
  buildVocalEmbedBundleSession,
} from "../../lib/vocal-embed-handoff";
import { buildVocalEmbedPlan } from "../../lib/vocal-embed-engine";
import { buildOpenvpiDsExport } from "../../lib/openvpi-ds-export";
import { APP_VERSION, PRESET_KEY, STORAGE_KEY } from "../../lib/music-config";
import { slimStateForPersistence, migrateImportedProject } from "../../lib/project-persistence";
import {
  extractCharacterVoicePresetsFromProject,
  persistCharacterVoicePresets,
} from "../../lib/voice-character-preset";
import {
  attachCharacterVoiceFieldsToProjectExport,
  extractCharacterVoiceStudioSessionFromProject,
  persistCharacterVoiceStudioSession,
} from "../../lib/voice-character-studio-session";
import { resolveAudioCacheBlob } from "../../lib/audio-cache";
import {
  buildProjectBundleExport,
  mergeCustomPresetsMaps,
  parseProjectBundleImport,
} from "../../lib/project-bundle";
import {
  buildVideoCreatorDirectorSettings,
  buildVideoCreatorHandoffBlock,
  downloadBlobFile,
  downloadTextFile,
  resolveHandoffIntent,
  slugifyHandoffBaseName,
} from "../../lib/video-creator-handoff";
import { isElectronApp } from "../../lib/electron-bridge";
import { isTauriApp } from "../../lib/dsp-bridge";
import { exportVideoHandoffNative } from "../../lib/video-handoff-bridge";
import { safeLocalStorage, storageFailureMessage } from "../../lib/safe-local-storage";

export function useExportActions(deps) {
  const {
    audioAnalysis,
    currentState,
    customPresets,
    imageAnalysis,
    lastAutosavePayloadRef,
    loadState,
    setCustomPresets,
    setStatusWithTime,
    sunoPasteLyrics,
    sunoPasteStyle,
    voiceStyleCompact,
    voiceStyleLine,
    captureSnapshot,
  } = deps;

  const saveProject = useCallback(() => {
    const slim = attachCharacterVoiceFieldsToProjectExport(slimStateForPersistence(currentState));
    const payload = JSON.stringify(slim, null, 2);
    const result = safeLocalStorage.set(STORAGE_KEY, payload);
    if (!result.ok) {
      setStatusWithTime(storageFailureMessage(result), "error");
      return;
    }
    lastAutosavePayloadRef.current = payload;
    setStatusWithTime("Saved");
  }, [currentState, lastAutosavePayloadRef, setStatusWithTime]);

  const exportProject = useCallback(() => {
    const storedAlign = readStoredVocalAlignPreview();
    let openvpiDs = storedAlign?.openvpiDs;
    if (!openvpiDs?.segments?.length && storedAlign?.preview && audioAnalysis) {
      const plan = buildVocalEmbedPlan({
        audioAnalysis,
        generatedLyrics: currentState.generatedLyrics,
        lyricStructure: currentState.lyricStructure,
        selectedGenres: currentState.selectedGenres,
        tempo: currentState.tempo,
        vocal: currentState.vocal,
        voiceStyleLine,
        voiceStyleCompact,
      });
      if (plan.stage === "ready") {
        const ds = buildOpenvpiDsExport(plan, storedAlign.preview);
        openvpiDs = ds.segments?.length ? ds : null;
      }
    }
    const vocalEmbed = storedAlign?.preview
      ? buildVocalEmbedBundleSession(
          storedAlign.preview,
          storedAlign.instrumentalName,
          storedAlign.guideName,
          openvpiDs,
        )
      : undefined;
    const payload = buildProjectBundleExport(currentState, customPresets, APP_VERSION, {
      vocalEmbed,
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ai-music-bundle.json";
    a.click();
    URL.revokeObjectURL(url);
    setStatusWithTime(
      vocalEmbed
        ? openvpiDs
          ? "Exported project bundle (vocal align + OpenVPI .ds)"
          : "Exported project bundle (includes vocal align preview)"
        : "Exported project bundle (project + style presets + voice profile)",
    );
  }, [
    audioAnalysis,
    currentState,
    customPresets,
    setStatusWithTime,
    voiceStyleCompact,
    voiceStyleLine,
  ]);

  const exportVideoHandoff = useCallback(async () => {
    const base = slugifyHandoffBaseName(currentState.idea);
    const bundleFileName = `${base}.aivbundle.json`;
    let audioSidecarName = null;
    let audioBlob = null;

    if (audioAnalysis) {
      const resolved = await resolveAudioCacheBlob(audioAnalysis);
      audioBlob = resolved?.blob || null;
      if (audioBlob) {
        const rawName = String(audioAnalysis.fileName || "track.wav");
        const ext = rawName.includes(".") ? rawName.split(".").pop() : "wav";
        audioSidecarName = `${base}.${ext}`;
      }
    }

    const handoff = buildVideoCreatorHandoffBlock({
      appVersion: APP_VERSION,
      audioAnalysis,
      imageAnalysis,
      sunoPasteStyle,
      sunoPasteLyrics,
      audioSidecarName,
      intent: resolveHandoffIntent({ audioAnalysis, imageAnalysis }),
    });
    const directorSettings = buildVideoCreatorDirectorSettings({ audioAnalysis, imageAnalysis });
    const payload = buildProjectBundleExport(currentState, customPresets, APP_VERSION, {
      handoff,
      directorSettings,
      bundleVersion: 2,
    });
    const json = JSON.stringify(payload, null, 2);

    if (isTauriApp()) {
      try {
        const res = await exportVideoHandoffNative({
          bundleJson: json,
          bundleFileName,
          audioBytes: audioBlob ? await audioBlob.arrayBuffer() : null,
          audioFileName: audioSidecarName,
        });
        if (res.canceled) {
          setStatusWithTime("Send to Video Creator canceled");
          return;
        }
        if (res.ok) {
          setStatusWithTime(
            res.launched
              ? `Opened AI Video Creator — ${String(res.path || bundleFileName).split(/[/\\]/).pop()}`
              : `Saved handoff — open in Video Creator: ${res.path || bundleFileName}`,
          );
          return;
        }
        setStatusWithTime(res.error || "Video handoff failed", "error");
        return;
      } catch (err) {
        setStatusWithTime(err instanceof Error ? err.message : "Video handoff failed", "error");
        return;
      }
    }

    if (isElectronApp() && window.electronAPI?.exportVideoHandoff) {
      const arrayBuffer = audioBlob ? await audioBlob.arrayBuffer() : null;
      const res = await window.electronAPI.exportVideoHandoff({
        bundleJson: json,
        bundleFileName,
        audioBuffer: arrayBuffer,
        audioFileName: audioSidecarName,
      });
      if (res?.canceled) {
        setStatusWithTime("Send to Video Creator canceled");
        return;
      }
      if (res?.ok) {
        setStatusWithTime(
          res.launched
            ? `Opened AI Video Creator — ${String(res.path || bundleFileName).split(/[/\\]/).pop()}`
            : `Saved handoff — open in Video Creator: ${res.path || bundleFileName}`,
        );
        return;
      }
      setStatusWithTime(res?.error || "Video handoff failed", "error");
      return;
    }

    downloadTextFile(json, bundleFileName);
    if (audioBlob && audioSidecarName) {
      setTimeout(() => downloadBlobFile(audioBlob, audioSidecarName), 400);
    }
    const note =
      handoff.intent === "music-video-path-e"
        ? "Path E beat-sync"
        : handoff.intent === "music-video-track"
          ? "track analysis"
          : "project fields";
    setStatusWithTime(
      `Exported for Video Creator (${note}) — import ${bundleFileName}${audioSidecarName ? ` + ${audioSidecarName}` : ""} in AI Video Creator`,
    );
  }, [
    audioAnalysis,
    currentState,
    customPresets,
    imageAnalysis,
    setStatusWithTime,
    sunoPasteLyrics,
    sunoPasteStyle,
  ]);

  const importProject = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onerror = () => {
        setStatusWithTime("Import failed — could not read file", "error");
      };
      reader.onload = () => {
        try {
          captureSnapshot("before import");
          const raw = JSON.parse(String(reader.result));
          const { project, customPresets: importedPresets, vocalEmbed } = parseProjectBundleImport(raw);
          const cvPresets = extractCharacterVoicePresetsFromProject(project);
          if (cvPresets && Object.keys(cvPresets).length > 0) {
            const presetResult = persistCharacterVoicePresets(cvPresets, { merge: true });
            if (!presetResult.ok) {
              setStatusWithTime(storageFailureMessage(presetResult), "error");
            }
          }
          const cvSession = extractCharacterVoiceStudioSessionFromProject(project);
          if (cvSession !== null) {
            persistCharacterVoiceStudioSession(cvSession);
          }
          if (importedPresets && Object.keys(importedPresets).length > 0) {
            setCustomPresets((prev) => {
              const next = mergeCustomPresetsMaps(prev, importedPresets);
              const result = safeLocalStorage.setJSON(PRESET_KEY, next);
              if (!result.ok) {
                setStatusWithTime(storageFailureMessage(result), "error");
              }
              return next;
            });
          }
          loadState(migrateImportedProject(project, APP_VERSION));
          if (vocalEmbed?.preview) {
            writeStoredVocalAlignPreview({
              instrumentalName: vocalEmbed.instrumentalName || "",
              guideName: vocalEmbed.guideName || "",
              preview: vocalEmbed.preview,
              openvpiDs: vocalEmbed.openvpiDs || null,
            });
          }
          setStatusWithTime(
            vocalEmbed?.openvpiDs?.segments?.length
              ? "Imported project bundle (vocal align + OpenVPI .ds)"
              : vocalEmbed?.preview
                ? "Imported project bundle (includes vocal align preview)"
                : "Imported project bundle",
          );
        } catch {
          setStatusWithTime("Import failed", "error");
        }
      };
      reader.readAsText(file);
    },
    [captureSnapshot, loadState, setCustomPresets, setStatusWithTime],
  );

  return { saveProject, exportProject, exportVideoHandoff, importProject };
}
