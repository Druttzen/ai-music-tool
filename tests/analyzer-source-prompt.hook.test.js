/** @vitest-environment happy-dom */
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { usePipelineInput } from "../app/hooks/use-pipeline-input";
import { DEFAULT_STATE } from "../app/lib/music-config";
import { buildUsableAnalyzerStylePrompt } from "../app/lib/analyzer-guided-merge";
afterEach(cleanup);

it("keeps actual analyzer style tags when the main pipeline uses summary-only refs", () => {
  const audioAnalysis = { summary: "Track report", suggestedGenres: ["Techno"], estimatedBpm: "140 BPM", suggestedSounds: ["Sub bass"], vocals: "Instrumental" };
  const { result } = renderHook(() => usePipelineInput({ ...DEFAULT_STATE, audioAnalysis, imageAnalysis: null }));
  expect(result.current.sourcePrompt).toBe("Techno, 140 BPM, Sub bass, Instrumental");
});

it("updates edited image tags and never emits a literal undefined token", () => {
  expect(buildUsableAnalyzerStylePrompt({ summary: "Only summary" }, null)).toBe("");
  const { result, rerender } = renderHook(({ imageAnalysis }) => usePipelineInput({ ...DEFAULT_STATE, audioAnalysis: null, imageAnalysis }), { initialProps: { imageAnalysis: { summary: "Art", suggestedGenres: ["Ambient"], visualMood: "Dreamy" } } });
  expect(result.current.sourcePrompt).toBe("Ambient, Dreamy");
  rerender({ imageAnalysis: { summary: "Art", suggestedGenres: ["House"], visualMood: "Warm" } });
  expect(result.current.sourcePrompt).toBe("House, Warm");
});
