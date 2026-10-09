/** @vitest-environment happy-dom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useHistoryActions } from "../app/hooks/project-actions/use-history-actions";
import { createInitialProjectState, projectReducer } from "../app/lib/project-state";
import { HistoryEntrySchema } from "../app/lib/project-entries";
afterEach(() => { cleanup(); localStorage.clear(); });

it.each([123, "legacy-id"])("restores snapshot %s without replacing the compare list", (id) => {
  const entry = { id, label: "Saved", time: "12:00", prompt: "Techno", state: { idea: "Saved idea", history: [], selectedHistoryId: null }, avgScore: "3.0" };
  let state = createInitialProjectState({ history: [entry], idea: "Changed" });
  const deps = { history: [entry], currentState: state, avgScore: "3.0", prompt: "Techno", copyToClipboard: vi.fn(), setCopied: vi.fn(), setHistory: vi.fn(), setStatusWithTime: vi.fn(), loadState: (payload) => { state = projectReducer(state, { type: "LOAD", payload }); }, setSelectedHistoryId: (value) => { state = { ...state, selectedHistoryId: value }; } };
  const { result } = renderHook(() => useHistoryActions(deps));
  act(() => result.current.restoreHistory(entry));
  expect(state.idea).toBe("Saved idea");
  expect(state.history).toEqual([entry]);
  expect(state.selectedHistoryId).toBe(id);
  expect(entry.state.history).toEqual([]);
});

it("produces entries accepted by the explicit contract", () => {
  const setHistory = vi.fn();
  const { result } = renderHook(() => useHistoryActions({ avgScore: "3.0", currentState: { idea: "Song" }, history: [], prompt: "Techno", setHistory, setStatusWithTime: vi.fn() }));
  act(() => result.current.addHistory("Snapshot"));
  expect(HistoryEntrySchema.safeParse(setHistory.mock.calls[0][0][0]).success).toBe(true);
});
