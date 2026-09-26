import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import sidecarBuildStamp from "../scripts/sidecar-build-stamp.cjs";

const { getSidecarBuildStamp } = sidecarBuildStamp;

const temporaryRoots = [];

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aimc-sidecar-stamp-"));
  temporaryRoots.push(root);
  fs.mkdirSync(path.join(root, "ai-sidecar", "ai_sidecar"), { recursive: true });
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ version: "1.2.3" }));
  fs.writeFileSync(path.join(root, "ai-sidecar", "ai_sidecar", "main.py"), "def run(): pass\n");
  fs.writeFileSync(path.join(root, "ai-sidecar", "pyproject.toml"), "[project]\nversion='1.2.3'\n");
  fs.writeFileSync(path.join(root, "ai-sidecar", "run_sidecar.py"), "from ai_sidecar import main\n");
  fs.writeFileSync(path.join(root, "scripts", "build-sidecar-bundle.ps1"), "Write-Host 'build'\n");
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("sidecar build stamp", () => {
  it("is stable for unchanged source files", () => {
    const root = makeFixture();

    expect(getSidecarBuildStamp(root)).toBe(getSidecarBuildStamp(root));
  });

  it("changes when sidecar source changes without a product version bump", () => {
    const root = makeFixture();
    const originalStamp = getSidecarBuildStamp(root);
    fs.writeFileSync(
      path.join(root, "ai-sidecar", "ai_sidecar", "main.py"),
      "def run(): return True\n",
    );

    expect(getSidecarBuildStamp(root)).not.toBe(originalStamp);
  });
});
