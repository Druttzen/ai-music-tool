/** @vitest-environment happy-dom */
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useProjectPersistence } from "../app/hooks/use-project-persistence";
import { APP_VERSION, HISTORY_KEY, STORAGE_KEY } from "../app/lib/music-config";
import { safeLocalStorage } from "../app/lib/safe-local-storage";

vi.mock("../app/lib/project-workspace-reset", () => ({
  RESET_WORKSPACES_ON_EXIT_HOOK: "__testExit",
  consumeWorkspaceResetIfPending: async () => false,
  setSkipWorkspaceAutosave: vi.fn(), shouldSkipWorkspaceAutosave: () => false,
  resetWorkspacesToDefaultOnExit: vi.fn(), clearWorkspaceSessionOnReset: vi.fn(),
}));

const entry = { id: 123, label: "Snapshot", time: "12:00", prompt: "Techno", state: { idea: "Song" }, avgScore: "3.0" };
const deps = { currentState: {}, promptEngine: "Suno-like", loadState: vi.fn(), patch: vi.fn(), resetAnalyzers: vi.fn(), resetBlank: vi.fn(), setCustomPresets: vi.fn(), setGuidedStep: vi.fn(), setHistory: vi.fn(), setStatusMessage: vi.fn(), setStatusWithTime: vi.fn() };
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("hydrates real numeric history selection without quarantining the project", async () => {
  const project = { appVersion: APP_VERSION, idea: "Keep", history: [entry], variations: [{ id: 124, title: "V1", prompt: "House" }], selectedHistoryId: 123 };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  renderHook(() => useProjectPersistence(deps));
  await waitFor(() => expect(deps.loadState).toHaveBeenCalledWith(project));
  expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(project));
  expect(Object.keys(localStorage).some((key) => key.includes("_corrupt_"))).toBe(false);
});

it("loads the valid project and entries while backing up malformed collection data", async () => {
  const project = { appVersion: APP_VERSION, idea: "Keep", history: [entry, null], variations: [] };
  const raw = JSON.stringify(project);
  localStorage.setItem(STORAGE_KEY, raw);
  renderHook(() => useProjectPersistence(deps));
  await waitFor(() => expect(deps.loadState).toHaveBeenCalledWith({ ...project, history: [entry] }));
  const key = Object.keys(localStorage).find((key) => key.startsWith(`${STORAGE_KEY}_collections_recovery_`));
  expect(localStorage.getItem(key)).toBe(raw);
});

it("validates separate history storage and preserves its original for recovery", async () => {
  localStorage.setItem(HISTORY_KEY, JSON.stringify([false, entry]));
  renderHook(() => useProjectPersistence(deps));
  await waitFor(() => expect(deps.setHistory).toHaveBeenCalledWith([entry]));
  const key = Object.keys(localStorage).find((key) => key.startsWith(`${HISTORY_KEY}_recovery_`));
  expect(JSON.parse(localStorage.getItem(key))).toEqual([false, entry]);
});

it("does not overwrite the original autosave if a recovery backup cannot be stored", async () => {
  const raw = JSON.stringify({ appVersion: APP_VERSION, idea: "Keep", history: [entry, null] });
  localStorage.setItem(STORAGE_KEY, raw);
  const originalSet = safeLocalStorage.set.bind(safeLocalStorage);
  vi.spyOn(safeLocalStorage, "set").mockImplementation((key, value) => key.includes("_collections_recovery_") ? { ok: false, reason: "quota" } : originalSet(key, value));
  renderHook(() => useProjectPersistence(deps));
  await waitFor(() => expect(deps.setStatusWithTime).toHaveBeenCalledWith("Could not load saved data", "error"));
  await new Promise((resolve) => setTimeout(resolve, 2200));
  expect(deps.loadState).not.toHaveBeenCalled();
  expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
});
