/** @vitest-environment happy-dom */
import { afterEach, expect, it } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { useWorkspaceActionsSlice } from "../app/hooks/workspace-slices/use-actions-slice";
import { useWorkspaceAnalyzerStateSlice } from "../app/hooks/workspace-slices/use-analyzer-state-slice";

afterEach(cleanup);

it("connects local cover/remix action and busy state to the workspace", () => {
  const runLocalCoverRemix = async () => {};
  const source = { runLocalCoverRemix, localCoverRemixBusy: true, analyzeAudioBusy: true, analyzeImageBusy: true };
  const { result } = renderHook(() => ({
    actions: useWorkspaceActionsSlice(source),
    state: useWorkspaceAnalyzerStateSlice(source),
  }));
  expect(result.current.actions.runLocalCoverRemix).toBe(runLocalCoverRemix);
  expect(result.current.state.localCoverRemixBusy).toBe(true);
  expect(result.current.state.analyzeAudioBusy).toBe(true);
  expect(result.current.state.analyzeImageBusy).toBe(true);
});
