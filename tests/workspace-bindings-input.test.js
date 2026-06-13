import { describe, it, expect } from "vitest";
import {
  pickPipelineInputFields,
  pickProjectActionInput,
  pickWorkspaceContextExtras,
} from "../app/lib/workspace-bindings-input.js";

describe("workspace-bindings-input", () => {
  const projectState = {
    idea: "test idea",
    patch: () => {},
    resetBlank: () => {},
    setIdea: () => {},
    scores: { bass: 4, rhythm: 4, identity: 4, clarity: 4 },
  };
  const analyzers = {
    audioAnalysis: null,
    imageAnalysis: null,
    applyAudioToSunoStyle: () => {},
    resetAnalyzers: () => {},
  };
  const pipeline = { prompt: "p", lyricPrompt: "lp", moodWords: [], vocalText: "v" };
  const snapshot = {
    captureSnapshot: () => {},
    currentState: {},
    lastAutosavePayloadRef: { current: "" },
    loadState: () => {},
    revertSnapshot: () => {},
  };
  const externals = {
    avgScore: "4.0",
    copyToClipboard: async () => true,
    resetSplash: () => {},
    setStatusWithTime: () => {},
  };

  it("pickProjectActionInput maps project, pipeline, and snapshot fields", () => {
    const input = pickProjectActionInput(projectState, analyzers, pipeline, snapshot, externals);
    expect(input.idea).toBe("test idea");
    expect(input.prompt).toBe("p");
    expect(input.avgScore).toBe("4.0");
    expect(input.captureSnapshot).toBe(snapshot.captureSnapshot);
  });

  it("pickWorkspaceContextExtras includes pipeline outputs and revert handler", () => {
    const extras = pickWorkspaceContextExtras(projectState, analyzers, pipeline, snapshot, externals);
    expect(extras.idea).toBe("test idea");
    expect(extras.revertSnapshot).toBe(snapshot.revertSnapshot);
    expect(extras.prompt).toBe("p");
  });

  it("pickPipelineInputFields passes analyzer refs through", () => {
    const fields = pickPipelineInputFields(projectState, {
      audioAnalysis: { summary: "audio" },
      imageAnalysis: { summary: "image" },
    });
    expect(fields.idea).toBe("test idea");
    expect(fields.audioAnalysis).toEqual({ summary: "audio" });
    expect(fields.imageAnalysis).toEqual({ summary: "image" });
  });
});
