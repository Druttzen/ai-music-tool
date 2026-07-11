/**
 * Cross-panel reset: clears session/local storage that lives outside project reducer state
 * and notifies mounted panels to drop in-memory UI state.
 */

import { clearStoredCredentials } from "./credential-storage";
import { MAESTRO_CHAT_STORAGE_KEY } from "./maestro-chat-engine";
import { VOCAL_ALIGN_PREVIEW_STORAGE_KEY } from "./vocal-embed-handoff";
import { safeLocalStorage } from "./safe-local-storage";

export const PROJECT_WORKSPACE_RESET_EVENT = "ai-music-project-workspace-reset";

const GUIDED_FOCUS_SHOW_ALL_KEY = "ai_music_creator_guided_show_all";
const MAESTRO_PREFILL_KEY = "aimc_maestro_prefill_pending";

/** Clear auxiliary workspace session keys and broadcast reset to mounted panels. */
export function clearWorkspaceSessionOnReset() {
  clearStoredCredentials();
  safeLocalStorage.remove(MAESTRO_CHAT_STORAGE_KEY);
  safeLocalStorage.remove(VOCAL_ALIGN_PREVIEW_STORAGE_KEY);
  safeLocalStorage.remove(GUIDED_FOCUS_SHOW_ALL_KEY);
  if (typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.removeItem(MAESTRO_PREFILL_KEY);
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PROJECT_WORKSPACE_RESET_EVENT));
  }
}
