import { describe, expect, it } from "vitest";
import {
  canvasExecutableCandidates,
  expandPathTemplate,
  suiteDir,
} from "../lib/suite-handoff-config.cjs";

describe("suite-handoff-config", () => {
  it("suiteDir uses Documents/AI Suite under home", () => {
    const dir = suiteDir();
    expect(dir.replace(/\\/g, "/")).toMatch(/Documents\/AI Suite$/);
  });

  it("expandPathTemplate replaces HOME placeholder", () => {
    const home = process.env.HOME || process.env.USERPROFILE || "";
    const expanded = expandPathTemplate("$HOME/.local/bin/ai-canvas-tool");
    expect(expanded).toContain(home);
    expect(expanded).toContain(".local");
  });

  it("canvasExecutableCandidates returns paths for current platform", () => {
    const candidates = canvasExecutableCandidates();
    expect(Array.isArray(candidates)).toBe(true);
    expect(candidates.length).toBeGreaterThan(0);
  });
});
