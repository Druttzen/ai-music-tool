/** @vitest-environment happy-dom */
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  desktop: true,
  env: { mode: "writable", writable: true },
  installed: new Set(),
  health: null,
  install: vi.fn(),
  status: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("../app/hooks/use-desktop-host", () => ({ useDesktopHost: () => mocks.desktop }));
vi.mock("../app/context/project-workspace-context", () => ({
  useProjectWorkspaceActions: () => ({ setStatusWithTime: mocks.status, refreshSidecarCapabilities: mocks.refresh }),
  useProjectWorkspaceAnalyzerState: () => ({ sidecarAiStatus: "ready" }),
}));
vi.mock("../app/components/ui-blocks", () => ({ Panel: ({ children }) => children }));
vi.mock("../app/components/guided-focus-panel", () => ({ GuidedFocusPanel: ({ children }) => children }));
vi.mock("../app/lib/canvas-addon-client", () => ({
  CANVAS_ADDON: { title: "Canvas" }, CANVAS_DESKTOP_REQUIRED: "Desktop required",
  getCanvasAddonStatus: async () => ({ installed: false }),
  formatCanvasInstallStatus: vi.fn(), installCanvasAddon: vi.fn(),
  launchCanvasAddon: vi.fn(), uninstallCanvasAddon: vi.fn(),
  isDesktopAddonHost: () => mocks.desktop,
}));
vi.mock("../app/lib/sidecar-bridge", () => ({
  fetchSidecarHealth: async () => mocks.health,
}));
vi.mock("../app/lib/sidecar-extra-install-client", async (original) => ({
  ...await original(),
  installSidecarExtra: (...args) => mocks.install(...args),
  listInstalledSidecarExtras: async () => [...mocks.installed],
  probeSidecarExtraInstallEnv: async () => mocks.env,
  subscribeSidecarExtraInstallProgress: () => () => {},
  reportSidecarExtraInstallIfFailed: vi.fn(),
}));

import { AddonsPanel } from "../app/components/addons-panel";
import { SIDECAR_EXTRA_NPM } from "../app/lib/sidecar-extra-install-client";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.desktop = true;
  mocks.env = { mode: "writable", writable: true };
  mocks.health = null;
  mocks.installed = new Set();
  mocks.install.mockImplementation(async (id) => {
    mocks.installed.add(id);
    return { ok: true, mode: "installed", extraId: id };
  });
});
afterEach(cleanup);

async function ready() {
  render(createElement(AddonsPanel));
  const button = screen.getByTestId("addons-download-all");
  await waitFor(() => expect(button.disabled).toBe(false));
  return button;
}

describe("Sidecar Download all", () => {
  it("installs every managed extra sequentially, without duplicating derived capabilities or double clicks", async () => {
    let finishFirst;
    mocks.install.mockImplementationOnce((id) => new Promise((resolve) => {
      finishFirst = () => {
        mocks.installed.add(id);
        resolve({ ok: true, mode: "installed", extraId: id });
      };
    }));
    const button = await ready();
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(mocks.install).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("addons-download-all-status").textContent).toContain("Downloading Demucs stems");
    expect(screen.getByTestId("addons-refresh-status").disabled).toBe(true);
    expect(screen.getByTestId("addons-install-ffmpeg").disabled).toBe(true);
    await act(async () => finishFirst());
    await waitFor(() => expect(screen.getByTestId("addons-download-all-status").textContent).toBe("15 installed · 0 failed"));
    const ids = mocks.install.mock.calls.map(([id]) => id);
    expect(new Set(ids)).toEqual(new Set(Object.keys(SIDECAR_EXTRA_NPM)));
    expect(ids).toHaveLength(15);
    expect(button.disabled).toBe(true);
    expect(screen.getByRole("progressbar").value).toBe(15);
  });

  it("skips installed engines even when their voice setup is incomplete", async () => {
    mocks.installed = new Set(Object.keys(SIDECAR_EXTRA_NPM).filter((id) => !["ffmpeg", "diffsinger"].includes(id)));
    mocks.health = { capabilities: [{ id: "diffsinger", available: false, dependenciesInstalled: true,
      runtimeReady: false, install_hint: "npm run sidecar:diffsinger" }] };
    fireEvent.click(await ready());
    await waitFor(() => expect(screen.getByTestId("addons-download-all-status").textContent).toBe("1 installed · 0 failed"));
    expect(mocks.install.mock.calls).toEqual([["ffmpeg"]]);
  });

  it("continues after returned errors and thrown errors, preserves details, and retries only missing plugins", async () => {
    mocks.installed = new Set(Object.keys(SIDECAR_EXTRA_NPM).filter((id) => !["stems", "generate", "ffmpeg"].includes(id)));
    mocks.install.mockImplementationOnce(async () => ({ ok: false, error: "Download interrupted" }))
      .mockRejectedValueOnce(new Error("Connection lost"));
    const button = await ready();
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByTestId("addons-download-all-status").textContent).toBe("1 installed · 2 failed"));
    expect(mocks.install.mock.calls).toEqual([["stems"], ["generate"], ["ffmpeg"]]);
    expect(screen.getByText("Download interrupted")).toBeTruthy();
    expect(screen.getByText("Connection lost")).toBeTruthy();
    expect(mocks.status).toHaveBeenLastCalledWith(expect.stringContaining("2 failed"), "error");
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByTestId("addons-download-all-status").textContent).toBe("2 installed · 0 failed"));
    expect(mocks.install.mock.calls.slice(3)).toEqual([["stems"], ["generate"]]);
    expect(screen.queryByText("Download interrupted")).toBeNull();
  });

  it.each([
    [false, { mode: "cli-only", writable: false }],
    [true, { mode: "bundled-readonly", writable: false }],
  ])("disables bulk installation when the host cannot install (%s, %j)", async (desktop, env) => {
    mocks.desktop = desktop;
    mocks.env = env;
    render(createElement(AddonsPanel));
    await waitFor(() => expect(screen.getByTestId("addons-install-env").textContent).not.toBe("Checking…"));
    const button = screen.getByTestId("addons-download-all");
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(mocks.install).not.toHaveBeenCalled();
  });
});
