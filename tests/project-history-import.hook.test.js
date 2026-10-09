/** @vitest-environment happy-dom */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useExportActions } from "../app/hooks/project-actions/use-export-actions";
import { APP_VERSION, HISTORY_KEY } from "../app/lib/music-config";
import { safeLocalStorage } from "../app/lib/safe-local-storage";

const entry = (id) => ({ id, label: "Snapshot", time: "12:00", prompt: "House", state: { idea: "Song" } });
const deps = { currentState: {}, customPresets: {}, lastAutosavePayloadRef: { current: "" }, loadState: vi.fn(), setCustomPresets: vi.fn(), setStatusWithTime: vi.fn(), captureSnapshot: vi.fn() };
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function importProject(project) {
  const { result } = renderHook(() => useExportActions(deps));
  const file = new File([JSON.stringify({ appVersion: APP_VERSION, ...project })], "project.json", { type: "application/json" });
  act(() => result.current.importProject({ target: { files: [file] } }));
  await waitFor(() => expect(deps.setStatusWithTime).toHaveBeenCalled());
}

it.each([123, "legacy-history-1"])("replaces separate history with imported %s IDs for reload", async (id) => {
  localStorage.setItem(HISTORY_KEY, JSON.stringify([entry("old")]));
  await importProject({ history: [entry(id), null], selectedHistoryId: id });
  expect(JSON.parse(localStorage.getItem(HISTORY_KEY))).toEqual([entry(id)]);
  expect(deps.loadState).toHaveBeenCalledWith(expect.objectContaining({ history: [entry(id)], selectedHistoryId: id }));
});

it("keeps separate history when a partial import has no history field", async () => {
  localStorage.setItem(HISTORY_KEY, JSON.stringify([entry("old")]));
  await importProject({ idea: "Partial" });
  expect(JSON.parse(localStorage.getItem(HISTORY_KEY))).toEqual([entry("old")]);
  expect(deps.loadState).toHaveBeenCalledWith(expect.not.objectContaining({ history: expect.anything() }));
});

it("does not load a replacement history when its persistent write fails", async () => {
  localStorage.setItem(HISTORY_KEY, JSON.stringify([entry("old")]));
  vi.spyOn(safeLocalStorage, "setJSON").mockReturnValue({ ok: false, reason: "quota" });
  await importProject({ history: [entry(123)] });
  expect(deps.loadState).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem(HISTORY_KEY))).toEqual([entry("old")]);
  expect(deps.setStatusWithTime).toHaveBeenCalledWith(expect.any(String), "error");
});
