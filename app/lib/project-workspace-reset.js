/**
 * Cross-panel reset: clears session/local storage that lives outside project reducer state
 * and notifies mounted panels to drop in-memory UI state.
 */

import { clearStoredCredentials } from "./credential-storage";
import { HISTORY_KEY, STORAGE_KEY } from "./music-config";
import { MAESTRO_CHAT_STORAGE_KEY } from "./maestro-chat-engine";
import { VOCAL_ALIGN_PREVIEW_STORAGE_KEY } from "./vocal-embed-handoff";
import { clearCharacterVoiceStudioSessionOnReset } from "./voice-character-studio-session";
import { safeLocalStorage } from "./safe-local-storage";

export const PROJECT_WORKSPACE_RESET_EVENT = "ai-music-project-workspace-reset";
/** Must match src-tauri/src/lib.rs webview.eval hook. */
export const RESET_WORKSPACES_ON_EXIT_HOOK = "__AIMUSIC_RESET_WORKSPACES_ON_EXIT";

const GUIDED_FOCUS_SHOW_ALL_KEY = "ai_music_creator_guided_show_all";
const MAESTRO_PREFILL_KEY = "aimc_maestro_prefill_pending";
const UNDO_SNAPSHOT_SESSION_KEY = "ai_music_creator_undo_snapshot_v1";

let skipWorkspaceAutosave = false;

export function shouldSkipWorkspaceAutosave() {
  return skipWorkspaceAutosave;
}

export function setSkipWorkspaceAutosave(skip) {
  skipWorkspaceAutosave = Boolean(skip);
}

/**
 * Clear auxiliary workspace session keys and broadcast reset to mounted panels.
 * @param {{ credentials?: boolean }} [options]
 */
export function clearWorkspaceSessionOnReset({ credentials = true } = {}) {
  if (credentials) clearStoredCredentials();
  safeLocalStorage.remove(MAESTRO_CHAT_STORAGE_KEY);
  safeLocalStorage.remove(VOCAL_ALIGN_PREVIEW_STORAGE_KEY);
  safeLocalStorage.remove(GUIDED_FOCUS_SHOW_ALL_KEY);
  if (typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.removeItem(MAESTRO_PREFILL_KEY);
      sessionStorage.removeItem(UNDO_SNAPSHOT_SESSION_KEY);
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PROJECT_WORKSPACE_RESET_EVENT));
  }
}

/** Clear project/session workspaces on app exit. Keeps presets and API credentials. */
export function resetWorkspacesToDefaultOnExit() {
  skipWorkspaceAutosave = true;
  safeLocalStorage.remove(STORAGE_KEY);
  safeLocalStorage.remove(HISTORY_KEY);
  clearCharacterVoiceStudioSessionOnReset();
  clearWorkspaceSessionOnReset({ credentials: false });
}

export async function consumeWorkspaceResetIfPending() {
  const invoke = typeof window !== "undefined" ? window.__TAURI__?.core?.invoke : null;
  if (typeof invoke !== "function") return false;
  try {
    const pending = await invoke("workspace_reset_pending");
    if (!pending) return false;
    await invoke("consume_workspace_reset_flag");
    return true;
  } catch {
    return false;
  }
}
