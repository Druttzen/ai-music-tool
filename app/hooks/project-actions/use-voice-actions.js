"use client";

import { useCallback } from "react";
import { resolveAudioCacheBlob } from "../../lib/audio-cache";
import { buildStyleDnaPatch } from "../../lib/track-style-dna";
import { resolvePolishStepIndex } from "../../lib/suno-guided-workflow";
import {
  buildSunoVoiceStyleLine,
  formatPublicName,
  presetToVoiceProfile,
} from "../../lib/suno-voice-style";
import {
  buildVoiceStyleFromProfile,
  fetchArtistVoiceProfile,
  lookupArtistVoiceProfile,
} from "../../lib/voice-style-lookup";
import {
  dispatchVoiceCharacterAnalyzeFile,
  scrollToVoiceCharacterStudioPanel,
} from "../../lib/voice-character-handoff";

export function useVoiceActions(deps) {
  const {
    audioAnalysis,
    audioPreviewUrl,
    captureSnapshot,
    moodWords,
    patch,
    promptEngine,
    selectedGenres,
    setGuidedStep,
    setPromptEngine,
    setStatusWithTime,
    setVoiceStyleLine,
    styleDnaSettings,
    voiceRefFirstName,
    voiceRefLastName,
  } = deps;

  const generateVoiceStyleFromNames = useCallback(
    async (options = {}) => {
      const name = formatPublicName(voiceRefFirstName, voiceRefLastName).trim();
      if (!name) {
        setStatusWithTime("Enter at least a first name (last name optional for mononyms)");
        return null;
      }

      if (options.profile) {
        const built = buildVoiceStyleFromProfile(options.profile, {
          selectedGenres,
          referenceName: name,
        });
        setVoiceStyleLine(built.voiceStyleLine);
        setStatusWithTime(
          `Voice style from ${built.sources.join(" + ") || "reference"} — Suno 5.5 tokens ready`,
        );
        return built;
      }

      if (options.offlineProfile) {
        const built = buildVoiceStyleFromProfile(options.offlineProfile, {
          selectedGenres,
          referenceName: name,
        });
        setVoiceStyleLine(built.voiceStyleLine);
        setStatusWithTime("Voice style from preset seed — use Search for live MusicBrainz data");
        return built;
      }

      setStatusWithTime(`Looking up ${name} online…`);
      try {
        const profile = await lookupArtistVoiceProfile(name, styleDnaSettings);
        if (!profile) {
          const line = buildSunoVoiceStyleLine({
            firstName: voiceRefFirstName,
            lastName: voiceRefLastName,
            selectedGenres,
            moodWords,
          });
          setVoiceStyleLine(line);
          setStatusWithTime("No MusicBrainz match — used generic template", "warning");
          return { voiceStyleLine: line, sources: [] };
        }
        const built = buildVoiceStyleFromProfile(profile, {
          selectedGenres,
          referenceName: name,
        });
        setVoiceStyleLine(built.voiceStyleLine);
        setStatusWithTime(
          `Voice style from ${built.sources.join(" + ")} — ${profile.genres.slice(0, 2).join(", ") || "artist match"}`,
        );
        return built;
      } catch (err) {
        const line = buildSunoVoiceStyleLine({
          firstName: voiceRefFirstName,
          lastName: voiceRefLastName,
          selectedGenres,
          moodWords,
        });
        setVoiceStyleLine(line);
        setStatusWithTime(
          err instanceof Error ? err.message : "Online lookup failed — used generic template",
          "warning",
        );
        return { voiceStyleLine: line, sources: [] };
      }
    },
    [
      moodWords,
      selectedGenres,
      setStatusWithTime,
      setVoiceStyleLine,
      styleDnaSettings,
      voiceRefFirstName,
      voiceRefLastName,
    ],
  );

  const generateVoiceStyleFromPreset = useCallback(
    (preset) => {
      const profile = presetToVoiceProfile(preset);
      return generateVoiceStyleFromNames({ offlineProfile: profile });
    },
    [generateVoiceStyleFromNames],
  );

  const generateVoiceStyleFromArtistId = useCallback(
    async (mbid, displayName) => {
      setStatusWithTime(`Loading ${displayName || "artist"} from MusicBrainz…`);
      try {
        const profile = await fetchArtistVoiceProfile(mbid, styleDnaSettings);
        if (!profile) {
          setStatusWithTime("Artist lookup failed", "error");
          return null;
        }
        return generateVoiceStyleFromNames({
          profile,
        });
      } catch (err) {
        setStatusWithTime(err instanceof Error ? err.message : "Artist lookup failed", "error");
        return null;
      }
    },
    [generateVoiceStyleFromNames, setStatusWithTime, styleDnaSettings],
  );

  const applyStyleDnaToProject = useCallback(
    (dna) => {
      if (!dna) return;
      captureSnapshot("before style DNA merge");
      patch(buildStyleDnaPatch(dna));
      if (promptEngine !== "Suno-like") {
        setPromptEngine("Suno-like");
      }
      setGuidedStep(resolvePolishStepIndex());
      setStatusWithTime(`Applied Style DNA: ${dna.artist} — ${dna.title}`);
    },
    [captureSnapshot, patch, promptEngine, setGuidedStep, setPromptEngine, setStatusWithTime],
  );

  const handoffTrackToVoiceCharacterStudio = useCallback(async () => {
    if (!audioAnalysis) {
      setStatusWithTime("Analyze a track first", "warning");
      return;
    }
    captureSnapshot("before vocal character handoff");
    let blob = (await resolveAudioCacheBlob(audioAnalysis))?.blob;
    if (!blob && audioPreviewUrl) {
      try {
        blob = await fetch(audioPreviewUrl).then((r) => r.blob());
      } catch {
        blob = null;
      }
    }
    if (!blob) {
      setStatusWithTime("Re-attach the audio file for vocal character analysis", "warning");
      return;
    }
    const file = new File([blob], audioAnalysis.fileName || "track.wav", {
      type: blob.type || "audio/wav",
    });
    dispatchVoiceCharacterAnalyzeFile(file);
    scrollToVoiceCharacterStudioPanel();
    const vocalsTag = String(audioAnalysis.vocals || "").toLowerCase();
    if (vocalsTag.includes("instrumental")) {
      setStatusWithTime(
        "Handoff sent — acapella or isolated lead works best for trait analysis",
        "warning",
      );
    } else {
      setStatusWithTime("Analyzing vocal character in Voice Character Studio…", "info");
    }
    if (promptEngine === "Suno-like") {
      setGuidedStep(resolvePolishStepIndex());
    }
  }, [
    audioAnalysis,
    audioPreviewUrl,
    captureSnapshot,
    promptEngine,
    setGuidedStep,
    setStatusWithTime,
  ]);

  return {
    generateVoiceStyleFromNames,
    generateVoiceStyleFromPreset,
    generateVoiceStyleFromArtistId,
    applyStyleDnaToProject,
    handoffTrackToVoiceCharacterStudio,
  };
}
