/**
 * Hand off analyzed track audio to Voice Character Studio (event + scroll target).
 */

export const VOICE_CHARACTER_ANALYZE_FILE_EVENT = "voice-character-analyze-file";
export const VOICE_CHARACTER_STUDIO_PANEL_ID = "voice-character-studio-panel";

/**
 * @param {File} file
 */
export function dispatchVoiceCharacterAnalyzeFile(file) {
  if (typeof window === "undefined" || !file) return;
  window.dispatchEvent(new CustomEvent(VOICE_CHARACTER_ANALYZE_FILE_EVENT, { detail: { file } }));
}

export function scrollToVoiceCharacterStudioPanel() {
  if (typeof document === "undefined") return;
  document.getElementById(VOICE_CHARACTER_STUDIO_PANEL_ID)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}
