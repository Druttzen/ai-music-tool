/** @vitest-environment happy-dom */
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MusicGenPreviewControls } from "../app/components/musicgen-preview-controls";

afterEach(cleanup);

it("creates a 30-second stereo draft without replacing the intended project style", () => {
  const generate = vi.fn();
  render(createElement(MusicGenPreviewControls, { defaultPrompt: "French house, 121 bpm", available: true, onGenerate: generate }));
  fireEvent.click(screen.getByRole("button", { name: "Generate & play" }));
  expect(generate).toHaveBeenCalledWith("French house, 121 bpm", 30, expect.objectContaining({ model: "stereo-small", mergeAfterGenerate: false }));
  fireEvent.change(screen.getByLabelText("Model"), { target: { value: "stereo-medium" } });
  fireEvent.click(screen.getByRole("button", { name: "Generate & play" }));
  expect(generate).toHaveBeenLastCalledWith("French house, 121 bpm", 30, expect.objectContaining({ model: "stereo-medium" }));
});

it("restores the last take when the controls move into the newly attached player", () => {
  const generate = vi.fn();
  render(createElement(MusicGenPreviewControls, {
    available: true, onGenerate: generate, defaultPrompt: "Changed analysis summary",
    lastTake: { prompt: "French house, 121 bpm", durationSec: 5, model: "facebook/musicgen-stereo-medium", seed: 123, temperature: 0.8, cfgCoef: 4, topK: 200, topP: 0.1 },
  }));
  fireEvent.click(screen.getByRole("button", { name: "Generate & play" }));
  expect(generate).toHaveBeenCalledWith("French house, 121 bpm", 5, expect.objectContaining({ model: "stereo-medium", seed: 123, temperature: 0.8, cfgCoef: 4, topK: 200, topP: 0.1, mergeAfterGenerate: false }));
});
