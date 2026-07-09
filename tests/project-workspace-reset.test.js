import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PROJECT_WORKSPACE_RESET_EVENT,
  clearWorkspaceSessionOnReset,
} from "../app/lib/project-workspace-reset.js";
import { MAESTRO_CHAT_STORAGE_KEY } from "../app/lib/maestro-chat-engine.js";
import { VOCAL_ALIGN_PREVIEW_STORAGE_KEY } from "../app/lib/vocal-embed-handoff.js";

function createMockStorage() {
  /** @type {Record<string, string>} */
  const data = {};
  return {
    getItem: vi.fn((key) => (key in data ? data[key] : null)),
    setItem: vi.fn((key, value) => {
      data[key] = value;
    }),
    removeItem: vi.fn((key) => {
      delete data[key];
    }),
    _data: data,
  };
}

describe("clearWorkspaceSessionOnReset", () => {
  /** @type {ReturnType<typeof createMockStorage>} */
  let local;
  /** @type {ReturnType<typeof createMockStorage>} */
  let session;

  beforeEach(() => {
    local = createMockStorage();
    session = createMockStorage();
    vi.stubGlobal("localStorage", local);
    vi.stubGlobal("sessionStorage", session);
    vi.stubGlobal("window", {
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    local.setItem(MAESTRO_CHAT_STORAGE_KEY, "[]");
    local.setItem(VOCAL_ALIGN_PREVIEW_STORAGE_KEY, "{}");
    session.setItem("aimc_maestro_prefill_pending", "hello");
  });

  it("removes auxiliary keys and dispatches reset event", () => {
    clearWorkspaceSessionOnReset();
    expect(local.removeItem).toHaveBeenCalledWith(MAESTRO_CHAT_STORAGE_KEY);
    expect(local.removeItem).toHaveBeenCalledWith(VOCAL_ALIGN_PREVIEW_STORAGE_KEY);
    expect(session.removeItem).toHaveBeenCalledWith("aimc_maestro_prefill_pending");
    expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
    expect(window.dispatchEvent.mock.calls[0][0].type).toBe(PROJECT_WORKSPACE_RESET_EVENT);
  });
});
