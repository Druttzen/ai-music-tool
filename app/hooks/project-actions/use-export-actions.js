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

  const exportProject = useCallback(async () => {
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
    const { saveOrDownloadBlob } = await import("../../lib/studio-file-save");
    const saved = await saveOrDownloadBlob(blob, "ai-music-bundle.json");
    const credNote = hasStoredCredentials() ? ` ${CREDENTIAL_STORAGE_NOTICE}` : "";
    const where =
      saved.mode === "studio" && saved.path
        ? ` Saved to Studio exports (${saved.path}).`
        : "";
    setStatusWithTime(
      vocalEmbed
        ? openvpiDs
          ? `Exported project bundle (vocal align + OpenVPI .ds).${where}${credNote}`
          : `Exported project bundle (includes vocal align preview).${where}${credNote}`
        : `Exported project bundle (project + style presets + voice profile).${where}${credNote}`,
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
    let masteredSidecarName = null;
    let masteredBlob = null;
    let vocalHandoffName = null;

    if (audioAnalysis) {
      const resolved = await resolveAudioCacheBlob(audioAnalysis);
      audioBlob = resolved?.blob || null;
      if (audioBlob) {
        const rawName = String(audioAnalysis.fileName || "track.wav");
        const ext = rawName.includes(".") ? rawName.split(".").pop() : "wav";
        audioSidecarName = `${base}.${ext}`;

        try {
          const { isTauriApp, exportMasteredNative } = await import("../../lib/dsp-bridge");
          if (isTauriApp()) {
            const bytes = await audioBlob.arrayBuffer();
            const result = await exportMasteredNative(bytes, "streaming", "wav");
            if (result?.wav_bytes) {
              masteredBlob = new Blob([new Uint8Array(result.wav_bytes)], { type: "audio/wav" });
              masteredSidecarName = `${base}-mastered-streaming.wav`;
            }
          }
        } catch {
          // Mastered attach is best-effort; source audio still exports.
        }
      }
    }

    const storedAlign = readStoredVocalAlignPreview();
    let vocalHandoffPayload = null;
    if (storedAlign?.preview) {
      vocalHandoffName = `${base}.vocal-handoff.json`;
      vocalHandoffPayload = {
        kind: "vocal_embed_plan",
        exportedAt: new Date().toISOString(),
        instrumentalName: storedAlign.instrumentalName || "",
        guideName: storedAlign.guideName || "",
        preview: storedAlign.preview,
        openvpiDs: storedAlign.openvpiDs || null,
      };
    }

    const handoff = buildMusicProjectExchangeBlock({
      appVersion: APP_VERSION,
      audioAnalysis,
      imageAnalysis,
      sunoPasteStyle,
      sunoPasteLyrics,
      audioSidecarName,
      masteredAudio: masteredSidecarName,
      vocalHandoff: vocalHandoffName,
      stemsNote: "Export stems separately from Analyzers when needed",
      intent: resolveMusicExchangeIntent({ audioAnalysis, imageAnalysis }),
    });
    const payload = buildProjectBundleExport(currentState, customPresets, APP_VERSION, {
      handoff,
      bundleVersion: 2,
    });
    const json = JSON.stringify(payload, null, 2);

    downloadTextFile(json, bundleFileName);
    let delay = 400;
    if (audioBlob && audioSidecarName) {
      setTimeout(() => downloadBlobFile(audioBlob, audioSidecarName), delay);
      delay += 400;
    }
    if (masteredBlob && masteredSidecarName) {
      setTimeout(() => downloadBlobFile(masteredBlob, masteredSidecarName), delay);
      delay += 400;
    }
    if (vocalHandoffPayload && vocalHandoffName) {
      setTimeout(
        () => downloadTextFile(JSON.stringify(vocalHandoffPayload, null, 2), vocalHandoffName),
        delay,
      );
    }
    const extras = [
      audioSidecarName,
      masteredSidecarName,
      vocalHandoffName,
    ].filter(Boolean);
    setStatusWithTime(
      `Exported Music Exchange — share ${bundleFileName}${extras.length ? ` + ${extras.join(" + ")}` : ""} with another AI Creator project`,
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
