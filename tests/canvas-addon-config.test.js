import { describe, expect, it } from "vitest";
import {
  canvasAddonMeta,
  canvasInstallerCandidates,
  findCanvasExecutable,
} from "../lib/suite-handoff-config.cjs";
import {
  CANVAS_ADDON,
  formatCanvasInstallStatus,
} from "../app/lib/canvas-addon-client.js";

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
    expect(formatCanvasInstallStatus({ ok: true, mode: "no-release" })).toMatch(/No GitHub release/i);
    expect(formatCanvasInstallStatus({ ok: true, mode: "docs" })).toMatch(/instructions/i);
    expect(formatCanvasInstallStatus({ ok: false, error: "boom" })).toBe("boom");
  });

  it("uses the README install path and retains the releases link", () => {
    const meta = canvasAddonMeta();
    expect(meta.installUrl).toContain("github.com/Druttzen/ai-canvas-tool");
    expect(meta.installUrl).not.toContain("/releases/latest");
    expect(meta.releasesUrl).toContain("/releases");
  });
});
