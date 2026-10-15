import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

describe("Windows Python resource generation", () => {
  it.each(["darwin", "linux"])("does not download or extract Windows assets on %s", async (platform) => {
    const require = createRequire(import.meta.url);
    const get = vi.fn(() => { throw new Error("Unexpected Windows download"); });
    const mkdirSync = vi.fn(() => { throw new Error("Unexpected embed directory mutation"); });
    const exit = vi.fn();
    vm.runInNewContext(fs.readFileSync("scripts/fetch-python-embed.cjs", "utf8"), {
      require: (id) => id === "https" ? { get } : id === "fs" ? { mkdirSync } : require(id),
      __dirname: path.resolve("scripts"), process: { platform, env: {}, exit },
      console: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });
    await Promise.resolve();
    expect(get).not.toHaveBeenCalled();
    expect(mkdirSync).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });
});
