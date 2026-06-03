"use client";

import { useCallback, useRef } from "react";
import { slimStateForUndo } from "../lib/project-persistence";

const SESSION_KEY = "ai_music_creator_undo_snapshot_v1";

/**
 * One-level undo: capture before destructive edits, revert from memory or sessionStorage.
 * @param {() => object} getState
 * @param {(state: object) => void} applyState
 * @param {(msg: string) => void} setStatusWithTime
 */
export function useUndoSnapshot(getState, applyState, setStatusWithTime) {
  const snapshotRef = useRef(null);

  const captureSnapshot = useCallback(
    (label = "snapshot") => {
      try {
        const raw = getState();
        const slim = slimStateForUndo(raw);
        const json = JSON.stringify(slim);
        snapshotRef.current = { label, json, at: Date.now() };
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(SESSION_KEY, json);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("quota") || msg.includes("too large")) {
          setStatusWithTime("Snapshot too large — save JSON export instead");
        }
      }
    },
    [getState, setStatusWithTime],
  );

  const revertSnapshot = useCallback(() => {
    let json = snapshotRef.current?.json;
    if (!json && typeof sessionStorage !== "undefined") {
      json = sessionStorage.getItem(SESSION_KEY);
    }
    if (!json) {
      setStatusWithTime("No snapshot — capture runs before preset load, merge, import, or variations");
      return false;
    }
    try {
      const restored = JSON.parse(json);
      applyState(restored);
      const needsAudio =
        restored.audioAnalysis &&
        (!restored.audioAnalysis.waveformPeaks?.length ||
          !restored.audioAnalysis.audioCacheKey);
      setStatusWithTime(
        needsAudio
          ? "Reverted — audio cache will rehydrate; attach the same file if playback is missing"
          : "Reverted to last snapshot (guided step, variations, and history restored)",
      );
      return true;
    } catch {
      setStatusWithTime("Snapshot restore failed");
      return false;
    }
  }, [applyState, setStatusWithTime]);

  const hasSnapshot = useCallback(() => {
    return !!(
      snapshotRef.current?.json ||
      (typeof sessionStorage !== "undefined" && sessionStorage.getItem(SESSION_KEY))
    );
  }, []);

  return { captureSnapshot, revertSnapshot, hasSnapshot };
}
