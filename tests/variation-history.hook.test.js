/** @vitest-environment happy-dom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useCoProducerActions } from "../app/hooks/project-actions/use-co-producer-actions";
import { DEFAULT_STATE } from "../app/lib/music-config";
import { VariationEntrySchema } from "../app/lib/project-entries";
afterEach(cleanup);

it("captures generated variations in the corresponding restorable history snapshot", () => {
  const setVariations = vi.fn();
  const addHistory = vi.fn();
  const currentState = { ...DEFAULT_STATE, variations: [], history: [] };
  const { result } = renderHook(() => useCoProducerActions({ ...DEFAULT_STATE, currentState, moodWords: "Dark", vocalText: "Instrumental", intensityText: "Steady", prompt: "Techno", addHistory, setVariations, setStatusWithTime: vi.fn(), captureSnapshot: vi.fn() }));
  act(() => result.current.generateVariations());
  const variations = setVariations.mock.calls[0][0];
  expect(variations).toHaveLength(DEFAULT_STATE.variationCount);
  expect(variations.every((entry) => VariationEntrySchema.safeParse(entry).success)).toBe(true);
  expect(addHistory.mock.calls[0][2].variations).toEqual(variations);
  expect(currentState.variations).toEqual([]);
});
