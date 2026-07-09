"use client";

import { useCallback } from "react";
import { fixes } from "../../lib/music-config";
import { uniq } from "../../lib/music-helpers";
import { extractLyricsBodyFromPaste } from "../../lib/suno-reimport";
import { collectGenreAnchors } from "../../lib/suno-language-index";
import { SUNO_AUTO_FIX_DEFAULTS } from "../../lib/suno-rules";

export function useSunoActions(deps) {
  const {
    captureSnapshot,
    idea,
    instrumentalVocalFx,
    patch,
    rules,
    selectedGenres,
    selectedRhythms,
    selectedSounds,
    setGeneratedLyrics,
    setIdea,
    setRules,
    setSelectedGenres,
    setSelectedRhythms,
    setSelectedSounds,
    setStatusWithTime,
    setStructure,
    structure,
    sunoBuiltFieldSlices,
    sunoPasteLyrics,
    sunoPasteStyle,
    vocal,
  } = deps;

  const fixSunoWarnings = useCallback(() => {
    const d = SUNO_AUTO_FIX_DEFAULTS;
    if (!selectedGenres.length) setSelectedGenres(d.genres);
    if (!selectedSounds.length) setSelectedSounds(d.sounds);
    if (!selectedRhythms.length) setSelectedRhythms(d.rhythms);
    if (!structure || structure.trim().length < 8) setStructure(d.structure);
    if (!idea || idea.trim().length < 10) setIdea(d.idea);
    if (
      vocal === "Instrumental" &&
      !instrumentalVocalFx &&
      !rules.toLowerCase().includes("no vocal")
    ) {
      setRules((prev) => `${prev}${prev.trim() ? "\n" : ""}${d.instrumentalRule}`);
    }
    if (selectedGenres.length > d.maxGenres) {
      setSelectedGenres(selectedGenres.slice(0, d.maxGenres));
    }
    setStatusWithTime("Applied Suno-like auto-fixes");
  }, [
    idea,
    instrumentalVocalFx,
    rules,
    selectedGenres,
    selectedRhythms,
    selectedSounds,
    setIdea,
    setRules,
    setSelectedGenres,
    setSelectedRhythms,
    setSelectedSounds,
    setStatusWithTime,
    setStructure,
    structure,
    vocal,
  ]);

  const applyGenreAnchors = useCallback(() => {
    const { sounds: anchorSounds, rhythms: anchorRhythms, rules: ruleAdditions } =
      collectGenreAnchors(selectedGenres);

    if (!anchorSounds.length && !anchorRhythms.length && !ruleAdditions.length) {
      setStatusWithTime("No known genre anchors to apply");
      return;
    }

    if (anchorSounds.length) setSelectedSounds((prev) => uniq([...prev, ...anchorSounds]));
    if (anchorRhythms.length) setSelectedRhythms((prev) => uniq([...prev, ...anchorRhythms]));
    if (ruleAdditions.length) {
      setRules((prev) => {
        const merged = uniq([
          ...prev.split("\n").map((x) => x.trim()).filter(Boolean),
          ...ruleAdditions,
        ]);
        return merged.join("\n");
      });
    }
    setStatusWithTime("Applied genre anchors");
  }, [selectedGenres, setRules, setSelectedRhythms, setSelectedSounds, setStatusWithTime]);

  const captureSunoPasteFromProject = useCallback(() => {
    const style = sunoBuiltFieldSlices?.style || "";
    const lyrics = sunoBuiltFieldSlices?.lyrics || "";
    patch({
      sunoPasteStyle: style,
      sunoPasteLyrics: lyrics,
      sunoPasteActive: false,
    });
    setStatusWithTime("Captured current Style/Lyrics into re-import fields");
  }, [patch, setStatusWithTime, sunoBuiltFieldSlices]);

  const clearSunoPaste = useCallback(() => {
    patch({
      sunoPasteStyle: "",
      sunoPasteLyrics: "",
      sunoPasteActive: false,
    });
    setStatusWithTime("Cleared Suno re-import paste");
  }, [patch, setStatusWithTime]);

  const activateSunoPasteForCopy = useCallback(() => {
    if (!sunoPasteStyle?.trim() && !sunoPasteLyrics?.trim()) {
      setStatusWithTime("Paste Suno Style or Lyrics first");
      return;
    }
    patch({ sunoPasteActive: true });
    setStatusWithTime("Preview and copy now use pasted Suno fields");
  }, [patch, setStatusWithTime, sunoPasteLyrics, sunoPasteStyle]);

  const deactivateSunoPasteForCopy = useCallback(() => {
    patch({ sunoPasteActive: false });
    setStatusWithTime("Preview and copy use project-built paste again");
  }, [patch, setStatusWithTime]);

  const applyPastedLyricsToGenerated = useCallback(() => {
    const body = extractLyricsBodyFromPaste(sunoPasteLyrics);
    if (!body) {
      setStatusWithTime("Paste Lyrics from Suno first");
      return;
    }
    captureSnapshot("before apply pasted lyrics");
    setGeneratedLyrics(body);
    patch({ sunoPasteActive: false });
    setStatusWithTime("Applied pasted Lyrics to generated lyrics");
  }, [captureSnapshot, patch, setGeneratedLyrics, setStatusWithTime, sunoPasteLyrics]);

  const applyQuickFix = useCallback(
    (label) => {
      const line = fixes[label];
      if (!line) return;
      setRules((old) => (old.trim() ? `${old.trim()}\n${line}` : line));
      setStatusWithTime(`Applied fix: ${label}`);
    },
    [setRules, setStatusWithTime],
  );

  return {
    fixSunoWarnings,
    applyGenreAnchors,
    captureSunoPasteFromProject,
    clearSunoPaste,
    activateSunoPasteForCopy,
    deactivateSunoPasteForCopy,
    applyPastedLyricsToGenerated,
    applyQuickFix,
  };
}
