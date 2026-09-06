import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * @vitest-environment happy-dom
 */

describe("studio-file-save", () => {
  beforeEach(() => {
    vi.resetModules();
    delete globalThis.window.__TAURI__;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete globalThis.window.__TAURI__;
  });

  it("uses browser download when not in Tauri", async () => {
    const clicks = [];
    const { saveOrDownloadBlob } = await import("../app/lib/studio-file-save.js");
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      const el = origCreate(tag);
      if (tag === "a") {
        el.click = () => clicks.push(el.download);
      }
      return el;
    });
    const result = await saveOrDownloadBlob(new Blob(["hi"]), "note.txt");
    expect(result.mode).toBe("browser");
    expect(clicks).toContain("note.txt");
  });

  it("invokes save_bytes_to_exports in Tauri", async () => {
    globalThis.window.__TAURI__ = {
      core: {
        invoke: vi.fn(async (cmd, args) => {
          expect(cmd).toBe("save_bytes_to_exports");
          expect(args.fileName).toBe("out.wav");
          expect(args.bytes).toBeInstanceOf(Uint8Array);
          return "C:/Apps/Studio/data/exports/out.wav";
        }),
      },
    };
    const { saveOrDownloadBlob } = await import("../app/lib/studio-file-save.js");
    const result = await saveOrDownloadBlob(new Blob(["wav"]), "out.wav");
    expect(result).toEqual({
      mode: "studio",
      path: "C:/Apps/Studio/data/exports/out.wav",
    });
    expect(globalThis.window.__TAURI__.core.invoke).toHaveBeenCalledTimes(1);
  });
});
