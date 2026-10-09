/** @vitest-environment happy-dom */
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AceStepSongControls } from "../app/components/acestep-song-controls";
import { ensureAceStepApi } from "../app/lib/sidecar-bridge";

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
