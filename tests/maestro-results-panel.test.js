/** @vitest-environment happy-dom */
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DEFAULT_STATE } from "../app/lib/music-config";
import { CenterMaestroChatPanel } from "../app/components/center-maestro-chat-panel";

const { actions, reply } = vi.hoisted(() => ({
  actions: { generateMusicFromPrompt: vi.fn(), setGuidedStep: vi.fn(), setStatusWithTime: vi.fn(), captureSnapshot: vi.fn() },
  reply: vi.fn(),
}));
vi.mock("../app/context/project-workspace-context", () => ({
  useProjectWorkspaceProjectState: () => DEFAULT_STATE,
  useProjectWorkspaceAnalyzerState: () => ({ audioAnalysis: null, imageAnalysis: null, sidecarGenerateAvailable: true }),
  useProjectWorkspacePromptState: () => ({}), useProjectWorkspaceActions: () => actions,
}));
vi.mock("../app/context/guided-focus-context", () => ({ useGuidedFocus: () => ({ setShowAll: vi.fn() }) }));
vi.mock("../app/lib/maestro-chat-engine", async (original) => ({ ...await original(), buildMaestroReply: reply }));
vi.mock("../app/lib/awesome-suno-catalog-loader", async (original) => ({ ...await original(), preloadAwesomeSunoCatalog: vi.fn() }));
vi.mock("../app/lib/suno-catalog-loader", async (original) => ({ ...await original(), preloadSunoCatalogSync: vi.fn() }));

beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); });
afterEach(cleanup);

async function send() {
  render(React.createElement(CenterMaestroChatPanel));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1)); });
  fireEvent.change(screen.getByPlaceholderText(/Talk to Maestro/), { target: { value: "run preview" } });
  fireEvent.click(screen.getByRole("button", { name: "Send", exact: true }));
}

it("shows asynchronous job and terminal results on the same assistant turn", async () => {
  let finish;
  reply.mockReturnValue({ reply: "Preview requested", commands: ["generateMusicGen", "gotoPolish"], artifacts: { musicGenPrompt: "test" } });
  actions.generateMusicFromPrompt.mockImplementation((_prompt, _duration, options) => {
    options.onJobStarted("real-job-id");
    return new Promise((resolve) => { finish = resolve; });
  });
  await send();
  expect(screen.getByText("Music preview: Started")).toBeTruthy();
  expect(screen.getByText(/Polish: Completed/)).toBeTruthy();
  await act(async () => { finish({ status: "completed", artifact: { kind: "audio", fileName: "preview.wav" } }); });
  await waitFor(() => expect(screen.getByText("Music preview: Completed")).toBeTruthy());
  const turns = JSON.parse(localStorage.getItem("ai_music_creator_maestro_chat_v1"));
  expect(turns.at(-1).commandResults[0]).toMatchObject({ jobId: "real-job-id", status: "completed", artifact: { fileName: "preview.wav" } });
});

it("shows a failed preview while preserving an independent completed navigation", async () => {
  reply.mockReturnValue({ reply: "Preview requested", commands: ["generateMusicGen", "gotoPolish"], artifacts: { musicGenPrompt: "test" } });
  actions.generateMusicFromPrompt.mockResolvedValue({ status: "failed", message: "MusicGen is not installed" });
  await send();
  await waitFor(() => expect(screen.getByText(/Music preview: Failed — MusicGen is not installed/)).toBeTruthy());
  expect(screen.getByText(/Polish: Completed/)).toBeTruthy();
});
