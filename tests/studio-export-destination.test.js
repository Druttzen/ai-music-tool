import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * @vitest-environment happy-dom
 */

describe("studio-export-destination", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    delete globalThis.window.__TAURI__;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete globalThis.window.__TAURI__;
    localStorage.clear();
  });

  it("formats long paths with an ellipsis prefix", async () => {
    const { formatExportDirLabel } = await import("../app/lib/studio-export-destination.js");
    expect(formatExportDirLabel("")).toBe("Studio exports");
    expect(formatExportDirLabel("C:\\Music")).toBe("C:\\Music");
    const long = "C:\\Users\\micke\\Music\\AI Music Creator Studio\\very\\long\\export\\folder";
    const label = formatExportDirLabel(long, { max: 24 });
    expect(label.startsWith("…")).toBe(true);
    expect(label.endsWith("folder")).toBe(true);
    expect(label.length).toBeLessThanOrEqual(24);
  });

  it("stores and resolves a custom output folder", async () => {
    const {
      setStoredStudioExportDirectory,
      getStoredStudioExportDirectory,
      resolveStudioExportDirectory,
    } = await import("../app/lib/studio-export-destination.js");
    expect(getStoredStudioExportDirectory()).toBeNull();
    setStoredStudioExportDirectory("  D:\\Renders\\Studio  ");
    expect(getStoredStudioExportDirectory()).toBe("D:\\Renders\\Studio");
    expect(resolveStudioExportDirectory()).toBe("D:\\Renders\\Studio");
    expect(resolveStudioExportDirectory({ outputDir: "E:\\Out" })).toBe("E:\\Out");
    setStoredStudioExportDirectory(null);
    expect(getStoredStudioExportDirectory()).toBeNull();
  });

  it("picks a folder through Tauri and ignores cancel", async () => {
    const invoke = vi.fn(async (cmd, args) => {
      expect(cmd).toBe("pick_export_directory");
      expect(args.current).toBe("C:\\Music");
      return "D:\\Chosen";
    });
    globalThis.window.__TAURI__ = { core: { invoke } };
    const { pickStudioExportDirectory } = await import("../app/lib/studio-export-destination.js");
    await expect(pickStudioExportDirectory("C:\\Music")).resolves.toBe("D:\\Chosen");
    invoke.mockResolvedValueOnce(null);
    await expect(pickStudioExportDirectory("C:\\Music")).resolves.toBeNull();
  });

  it("rejects folder picking outside Studio", async () => {
    const { pickStudioExportDirectory } = await import("../app/lib/studio-export-destination.js");
    await expect(pickStudioExportDirectory()).rejects.toThrow(/Studio desktop/);
  });
});
