import { describe, expect, it } from "vitest";
import {
  canvasAddonMeta,
  canvasInstallerCandidates,
  findCanvasExecutable,
} from "../lib/suite-handoff-config.cjs";
import {
  CANVAS_ADDON,
  CANVAS_DESKTOP_REQUIRED,
  CANVAS_INSTALL_HINT,
  formatCanvasInstallStatus,
  isDesktopAddonHost,
} from "../app/lib/canvas-addon-client.js";
import { pickReleaseAsset } from "../lib/suite-bridge.cjs";

describe("Canvas integration", () => {
  it("exposes Canvas metadata from the shared paths config", () => {
    const meta = canvasAddonMeta();
    expect(meta).toBeTruthy();
    expect(meta.id).toBe("canvas");
    expect(meta.githubOwner).toBe("Druttzen");
    expect(meta.githubRepo).toBe("ai-canvas-tool");
    expect(meta.installUrl).toContain("ai-canvas-tool");
  });

  it("lists installer candidate paths for the current platform", () => {
    expect(canvasInstallerCandidates()).toBeInstanceOf(Array);
  });

  it("findCanvasExecutable returns null or an existing path", () => {
    const executable = findCanvasExecutable();
    if (executable) expect(typeof executable).toBe("string");
    else expect(executable).toBeNull();
  });

  it("keeps client and native metadata aligned", () => {
    expect(CANVAS_ADDON.id).toBe("canvas");
    expect(CANVAS_ADDON.title).toContain("Canvas");
    expect(CANVAS_ADDON.installUrl).toContain("github.com");
  });

  it("formats install modes", () => {
    expect(formatCanvasInstallStatus({ ok: true, mode: "installed", alreadyInstalled: true })).toMatch(
      /already installed/i,
    );
    expect(formatCanvasInstallStatus({ ok: true, mode: "downloaded" })).toMatch(/Downloaded/i);
    expect(formatCanvasInstallStatus({ ok: true, mode: "no-release" })).toMatch(/releases page/i);
    expect(formatCanvasInstallStatus({ ok: true, mode: "docs" })).toMatch(/instructions/i);
    expect(formatCanvasInstallStatus({ ok: false, mode: "download-failed", error: "network down" })).toBe(
      "network down",
    );
    expect(
      formatCanvasInstallStatus({
        ok: false,
        mode: "download-failed",
        error: "network down",
        url: "https://example.com/releases",
      }),
    ).toBe("network down — https://example.com/releases");
    expect(formatCanvasInstallStatus({ ok: false, error: "boom" })).toBe("boom");
    expect(formatCanvasInstallStatus({ ok: false, mode: "desktop-required" })).toBe(CANVAS_DESKTOP_REQUIRED);
  });

  it("lists dotted GitHub Setup names among Windows installer candidates", () => {
    const meta = canvasAddonMeta();
    expect(meta.releasesUrl).toContain("/releases");
    const windows = require("../lib/suite-handoff-paths.json").canvas.installerCandidates.windows;
    expect(windows.some((p) => p.includes("AI.Canvas.Tool-1.1.1-Setup.exe"))).toBe(true);
  });

  it("describes GitHub release download in the install hint", () => {
    expect(CANVAS_INSTALL_HINT).toMatch(/GitHub Releases/i);
    expect(CANVAS_INSTALL_HINT).not.toMatch(/No GitHub release yet/i);
  });

  it("reports non-desktop host in vitest (no Tauri/Electron)", () => {
    expect(isDesktopAddonHost()).toBe(false);
  });

  it("uses the README install path and retains the releases link", () => {
    const meta = canvasAddonMeta();
    expect(meta.installUrl).toContain("github.com/Druttzen/ai-canvas-tool");
    expect(meta.installUrl).not.toContain("/releases/latest");
    expect(meta.releasesUrl).toContain("/releases");
  });

  it("prefers Setup.exe assets over portable exe on Windows", () => {
    if (process.platform !== "win32") return;
    const asset = pickReleaseAsset([
      { name: "AI.Canvas.Tool-1.1.1.exe", browser_download_url: "https://example/portable.exe" },
      { name: "AI.Canvas.Tool-1.1.1-Setup.exe", browser_download_url: "https://example/setup.exe" },
      { name: "notes.txt", browser_download_url: "https://example/notes.txt" },
    ]);
    expect(asset?.name).toBe("AI.Canvas.Tool-1.1.1-Setup.exe");
  });

  it("picks platform installer extensions", () => {
    const assets = [
      { name: "App.dmg", browser_download_url: "https://example/a.dmg" },
      { name: "App.AppImage", browser_download_url: "https://example/a.AppImage" },
      { name: "App-Setup.exe", browser_download_url: "https://example/setup.exe" },
    ];
    const picked = pickReleaseAsset(assets);
    expect(picked).toBeTruthy();
    if (process.platform === "win32") expect(picked.name).toMatch(/Setup\.exe$/i);
    else if (process.platform === "darwin") expect(picked.name).toMatch(/\.dmg$/i);
    else if (process.platform === "linux") expect(picked.name).toMatch(/\.AppImage$/i);
  });
});
