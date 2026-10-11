/** @vitest-environment happy-dom */
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MusicGenPreviewControls } from "../app/components/musicgen-preview-controls";
import { LocalGeneratePanel } from "../app/components/local-generate-panel";

afterEach(() => {
  cleanup();
  delete window.__TAURI__;
});

it("shows the selected seed after changing a take and keeps edits on the same take", () => {
  const generate = vi.fn();
  const props = take => ({ music: { available: true, onGenerate: generate, lastTake: take } });
  const take = { takeId: "one", prompt: "Trance", model: "facebook/musicgen-stereo-medium", seed: 123, durationSec: 30 };
  const view = render(createElement(LocalGeneratePanel, props(take)));
  fireEvent.change(screen.getByLabelText("Seed (optional, reproducible)"), { target: { value: "456" } });
  view.rerender(createElement(LocalGeneratePanel, props({ ...take })));
  expect(screen.getByLabelText("Seed (optional, reproducible)").value).toBe("456");
  view.rerender(createElement(LocalGeneratePanel, props({ ...take, takeId: "two", seed: 124 })));
  expect(screen.getByLabelText("Seed (optional, reproducible)").value).toBe("124");
  fireEvent.click(screen.getByRole("button", { name: "Generate & play" }));
  expect(generate).toHaveBeenLastCalledWith("Trance", 30, expect.objectContaining({ seed: 124, model: "stereo-medium" }));
});

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

it("searches independent takes without accidentally turning on melody conditioning", () => {
  const generate = vi.fn();
  render(createElement(MusicGenPreviewControls, { defaultPrompt: "French house", available: true,
    canUseMelodyReference: true, onGenerate: generate }));
  fireEvent.click(screen.getByLabelText("Compare style with the current audio"));
  fireEvent.click(screen.getByRole("button", { name: "Explore 3 takes" }));
  expect(generate).toHaveBeenCalledWith("French house", 30, expect.objectContaining({ candidateCount: 3,
    compareReference: true, useMelodyReference: false, mergeAfterGenerate: false }));
});

it("prepares an uncached Medium model internally before enabling generation", async () => {
  const invoke = vi.fn().mockResolvedValue("Selected model is ready");
  window.__TAURI__ = { core: { invoke } };
  render(createElement(MusicGenPreviewControls, {
    available: true, onGenerate: vi.fn(), models: { "facebook/musicgen-stereo-small": true },
  }));
  fireEvent.change(screen.getByLabelText("Model"), { target: { value: "stereo-medium" } });
  expect(screen.getByRole("button", { name: "Generate & play" }).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Prepare stereo-medium for offline use" }));
  await waitFor(() => expect(invoke).toHaveBeenCalledWith("prepare_musicgen_model", { modelPreset: "stereo-medium" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Generate & play" }).disabled).toBe(false));
});
