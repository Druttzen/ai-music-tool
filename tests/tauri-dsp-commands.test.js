import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function tauriInvokeCommands() {
  const libRs = readFileSync(join(root, "src-tauri/src/lib.rs"), "utf8");
  const match = libRs.match(/tauri::generate_handler!\[([\s\S]*?)\]/);
  expect(match).toBeTruthy();
  return match[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

describe("Tauri DSP commands", () => {
  it("does not let the webview measure loudness from an arbitrary filesystem path", () => {
    const cmds = tauriInvokeCommands();
    expect(cmds).toContain("measure_loudness_bytes");
    expect(cmds).not.toContain("measure_loudness");

    const bridge = readFileSync(join(root, "app/lib/dsp-bridge.ts"), "utf8");
    expect(bridge).toContain('"measure_loudness_bytes"');
    expect(bridge).not.toContain('"measure_loudness"');
    expect(bridge).not.toMatch(/function measureLoudness\s*\(/);
  });
});
