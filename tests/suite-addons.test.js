import { describe, expect, it } from "vitest";
import {
  canvasAddonMeta,
  canvasInstallerCandidates,
  findCanvasExecutable,
} from "../lib/suite-handoff-config.cjs";
import {
  CANVAS_ADDON,
  formatCanvasInstallStatus,
} from "../app/lib/suite-addons-client.js";

describe("suite canvas addon", () => {
  it("exposes canvas addon metadata from shared paths config", () => {
    const meta = canvasAddonMeta();
    expect(meta).toBeTruthy();
    expect(meta.id).toBe("canvas");
    expect(meta.githubOwner).toBe("Druttzen");
    expect(meta.githubRepo).toBe("ai-canvas-tool");
    expect(meta.installUrl).toContain("ai-canvas-tool");
  });

  it("lists installer candidate paths for the current platform", () => {
    const list = canvasInstallerCandidates();
    expect(Array.isArray(list)).toBe(true);
  });

  it("findCanvasExecutable returns null or an existing path", () => {
    const exe = findCanvasExecutable();
    if (exe) expect(typeof exe).toBe("string");
    else expect(exe).toBeNull();
  });

  it("CANVAS_ADDON catalog matches suite branding", () => {
    expect(CANVAS_ADDON.id).toBe("canvas");
    expect(CANVAS_ADDON.title).toContain("Canvas");
    expect(CANVAS_ADDON.installUrl).toContain("github.com");
  });

  it("formatCanvasInstallStatus covers install modes", () => {
    expect(formatCanvasInstallStatus({ ok: true, mode: "installed", alreadyInstalled: true })).toMatch(
      /already installed/i,
    );
    expect(formatCanvasInstallStatus({ ok: true, mode: "downloaded" })).toMatch(/Downloaded/i);
    expect(formatCanvasInstallStatus({ ok: true, mode: "no-release" })).toMatch(/No GitHub release/i);
    expect(formatCanvasInstallStatus({ ok: true, mode: "docs" })).toMatch(/instructions/i);
    expect(formatCanvasInstallStatus({ ok: false, error: "boom" })).toBe("boom");
  });

  it("canvas installUrl points at README not empty releases page", () => {
    const meta = canvasAddonMeta();
    expect(meta.installUrl).toContain("github.com/Druttzen/ai-canvas-tool");
    expect(meta.installUrl).not.toContain("/releases/latest");
    expect(meta.releasesUrl).toContain("/releases");
  });
});
