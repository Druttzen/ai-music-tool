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
  buildMusicProjectExchangeBlock,
  downloadBlobFile,
  downloadTextFile,
  resolveMusicExchangeIntent,
  slugifyMusicExchangeBaseName,
} from "../../lib/music-project-exchange";
import { CREDENTIAL_STORAGE_NOTICE, hasStoredCredentials } from "../../lib/credential-storage";
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
    const credNote = hasStoredCredentials() ? ` ${CREDENTIAL_STORAGE_NOTICE}` : "";
    setStatusWithTime(
      vocalEmbed
        ? openvpiDs
          ? `Exported project bundle (vocal align + OpenVPI .ds).${credNote}`
          : `Exported project bundle (includes vocal align preview).${credNote}`
        : `Exported project bundle (project + style presets + voice profile).${credNote}`,
    );
  }, [
    audioAnalysis,
    currentState,
    customPresets,
    setStatusWithTime,
    voiceStyleCompact,
    voiceStyleLine,
  ]);

  const exportMusicExchange = useCallback(async () => {
    const base = slugifyMusicExchangeBaseName(currentState.idea);
    const bundleFileName = `${base}.aimusicbundle.json`;
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

    const handoff = buildMusicProjectExchangeBlock({
      appVersion: APP_VERSION,
      audioAnalysis,
      imageAnalysis,
      sunoPasteStyle,
      sunoPasteLyrics,
      audioSidecarName,
      intent: resolveMusicExchangeIntent({ audioAnalysis, imageAnalysis }),
    });
    const payload = buildProjectBundleExport(currentState, customPresets, APP_VERSION, {
      handoff,
      bundleVersion: 2,
    });
    const json = JSON.stringify(payload, null, 2);

    downloadTextFile(json, bundleFileName);
    if (audioBlob && audioSidecarName) {
      setTimeout(() => downloadBlobFile(audioBlob, audioSidecarName), 400);
    }
    setStatusWithTime(
      `Exported Music Exchange — share ${bundleFileName}${audioSidecarName ? ` + ${audioSidecarName}` : ""} with another AI Creator project`,
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

  return { saveProject, exportProject, exportMusicExchange, importProject };
}
