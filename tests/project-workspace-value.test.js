import { describe, expect, it } from "vitest";
import {
  buildProjectWorkspaceActions,
  buildProjectWorkspaceAnalyzerState,
  buildProjectWorkspaceProjectState,
  buildProjectWorkspacePromptState,
  buildProjectWorkspaceValue,
} from "../app/lib/project-workspace-value.js";

describe("project-workspace-value slices", () => {
  const source = {
    idea: "test idea",
    setIdea: () => {},
    analyzeAudioFile: async () => {},
    audioAnalysis: { bpm: 120 },
    prompt: "full prompt",
    sunoSlices: { style: "a", lyrics: "b" },
    intensityText: "balanced",
  };

  it("merged value equals spread of all slices", () => {
    const merged = buildProjectWorkspaceValue(source);
    const slices = {
      ...buildProjectWorkspaceActions(source),
      ...buildProjectWorkspaceProjectState(source),
      ...buildProjectWorkspaceAnalyzerState(source),
      ...buildProjectWorkspacePromptState(source),
    };
    expect(slices).toEqual(merged);
  });

  it("slices only expose their domain keys", () => {
    const actions = buildProjectWorkspaceActions(source);
    const project = buildProjectWorkspaceProjectState(source);
    const analyzer = buildProjectWorkspaceAnalyzerState(source);
    const prompt = buildProjectWorkspacePromptState(source);

    expect(actions).toHaveProperty("setIdea");
    expect(actions).not.toHaveProperty("idea");
    expect(project).toHaveProperty("idea");
    expect(project).not.toHaveProperty("setIdea");
    expect(analyzer).toHaveProperty("audioAnalysis");
    expect(analyzer).not.toHaveProperty("prompt");
    expect(prompt).toHaveProperty("prompt");
    expect(prompt).not.toHaveProperty("audioAnalysis");
  });
});
