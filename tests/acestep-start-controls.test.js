/** @vitest-environment happy-dom */
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AceStepSongControls } from "../app/components/acestep-song-controls";
import { ensureAceStepApi, fetchAceStepPresets } from "../app/lib/sidecar-bridge";

vi.mock("../app/lib/sidecar-bridge", () => ({ ensureAceStepApi: vi.fn(), fetchAceStepPresets: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("starts the real service through the bridge and requests a live readiness refresh", async () => {
  ensureAceStepApi.mockResolvedValue({ ok: true, url: "http://127.0.0.1:8001" });
  const refresh = vi.fn();
  window.addEventListener("aimc-sidecar-refresh", refresh);
  render(React.createElement(AceStepSongControls, { available: false, onGenerate: vi.fn() }));
  fireEvent.click(screen.getByRole("button", { name: "Start local ACE-Step" }));
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  expect(ensureAceStepApi).toHaveBeenCalledOnce();
  expect(screen.getByRole("status").textContent).toContain("checking readiness");
  // Service startup does not fake the separately probed available flag.
  expect(screen.getByRole("button", { name: "ACE-Step API unreachable" }).disabled).toBe(true);
  window.removeEventListener("aimc-sidecar-refresh", refresh);
});

it("keeps generation unavailable and exposes startup errors", async () => {
  ensureAceStepApi.mockRejectedValue(new Error("Local checkout missing"));
  render(React.createElement(AceStepSongControls, { available: false, onGenerate: vi.fn() }));
  fireEvent.click(screen.getByRole("button", { name: "Start local ACE-Step" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Local checkout missing"));
  expect(screen.getByRole("button", { name: "ACE-Step API unreachable" }).disabled).toBe(true);
});

it("disables repeated startup requests until the first finishes", async () => {
  let finish;
  ensureAceStepApi.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  render(React.createElement(AceStepSongControls, { available: false, onGenerate: vi.fn() }));
  fireEvent.click(screen.getByRole("button", { name: "Start local ACE-Step" }));
  expect(screen.getByRole("button", { name: "Starting ACE-Step…" }).disabled).toBe(true);
  await act(async () => { finish({ ok: true, url: "http://127.0.0.1:8001" }); });
  expect(ensureAceStepApi).toHaveBeenCalledOnce();
});

it("uses the actual installed SFT checkpoint with 50 steps and explicit guidance", async () => {
  fetchAceStepPresets.mockResolvedValue({ sft_available: true, quality_available: false });
  const generate = vi.fn();
  render(React.createElement(AceStepSongControls, { available: true, defaultPrompt: "Pop", onGenerate: generate }));
  await waitFor(() => expect(screen.getByRole("option", { name: "Detail (SFT · 50 steps)" }).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText("Quality"), { target: { value: "sft" } });
  fireEvent.change(screen.getByLabelText("Prompt guidance"), { target: { value: "8.5" } });
  fireEvent.click(screen.getByRole("button", { name: "Generate full song" }));
  expect(generate).toHaveBeenCalledWith("Pop", expect.objectContaining({ model: "acestep-v15-sft",
    inferenceSteps: 50, guidanceScale: 8.5 }));
});

it("restores generated song settings after controls remount", async () => {
  fetchAceStepPresets.mockResolvedValue({ sft_available: true });
  const generate = vi.fn();
  render(React.createElement(AceStepSongControls, { available: true, onGenerate: generate, defaultBpm: 134, defaultKey: "E major",
    lastTake: { model: "acestep-v15-sft", prompt: "Original song prompt", lyrics: "[Verse]\nTest",
      seed: 123, durationSec: 30, thinking: false, guidanceScale: 6, bpm: null, keyScale: "" } }));
  await waitFor(() => expect(screen.getByRole("option", { name: "Detail (SFT · 50 steps)" }).disabled).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: "Generate full song" }));
  expect(generate).toHaveBeenCalledWith("Original song prompt", expect.objectContaining({ model: "acestep-v15-sft",
    lyrics: "[Verse]\nTest", seed: 123, durationSec: 30, thinking: false, guidanceScale: 6, useDna: false, bpm: null, keyScale: "" }));
});

it("restores the original DNA instead of applying newly estimated song tempo and key", async () => {
  fetchAceStepPresets.mockResolvedValue({ sft_available: true });
  const generate = vi.fn();
  render(React.createElement(AceStepSongControls, { available: true, onGenerate: generate, defaultBpm: 134, defaultKey: "E major",
    lastTake: { model: "acestep-v15-sft", prompt: "Trance", useDna: true, bpm: 125, keyScale: "A minor" } }));
  await waitFor(() => expect(screen.getByRole("option", { name: "Detail (SFT · 50 steps)" }).disabled).toBe(false));
  expect(screen.getByRole("checkbox", { name: "Use track DNA (125 BPM · A minor)" }).checked).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Generate full song" }));
  expect(generate).toHaveBeenCalledWith("Trance", expect.objectContaining({ useDna: true, bpm: 125, keyScale: "A minor" }));
});

it("keeps an explicit SFT choice when readiness is missing and blocks generation instead of falling back", async () => {
  fetchAceStepPresets.mockResolvedValue({ sft_available: false });
  const generate = vi.fn();
  const props = { onGenerate: generate, lastTake: { model: "acestep-v15-sft", prompt: "Trance" } };
  const view = render(React.createElement(AceStepSongControls, { ...props, available: false }));
  expect(screen.getByLabelText("Quality").value).toBe("sft");
  view.rerender(React.createElement(AceStepSongControls, { ...props, available: true }));
  await waitFor(() => expect(fetchAceStepPresets).toHaveBeenCalled());
  expect(screen.getByLabelText("Quality").value).toBe("sft");
  const button = screen.getByRole("button", { name: "Selected checkpoint unavailable" });
  expect(button.disabled).toBe(true);
  fireEvent.click(button);
  expect(generate).not.toHaveBeenCalled();
});
