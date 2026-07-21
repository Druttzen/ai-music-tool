import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "..");
const RUNTIME_TARGETS = ["app", "lib", "src-tauri/src", "main.js", "preload.js"];
const FORBIDDEN_CONSUMER_COUPLING = [
  "AI Video Creator",
  "Glitchframe",
  "exportVideoHandoff",
  "exportMusicVideoHandoff",
  "export_music_video_handoff",
];

function readRuntimeSources(target) {
  const absolute = path.join(ROOT, target);
  if (!fs.existsSync(absolute)) return [];
  if (fs.statSync(absolute).isFile()) return [[target, fs.readFileSync(absolute, "utf8")]];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) =>
    readRuntimeSources(path.join(target, entry.name)),
  );
}

describe("audio-only product boundary", () => {
  it("contains no consumer-specific video launch or export integration", () => {
    const sources = RUNTIME_TARGETS.flatMap(readRuntimeSources);
    for (const [file, source] of sources) {
      for (const forbidden of FORBIDDEN_CONSUMER_COUPLING) {
        expect(source, `${forbidden} found in ${file}`).not.toContain(forbidden);
      }
    }
  });

  it("keeps Canvas direct and every other project portable", () => {
    expect(fs.existsSync(path.join(ROOT, "app/lib/canvas-addon-client.js"))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, "app/lib/music-project-exchange.js"))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, "src-tauri/src/video_handoff.rs"))).toBe(false);
  });
});
