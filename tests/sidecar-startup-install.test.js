import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildStartupInstallJobs,
  computeStartupInstallSnapshot,
  formatByteSize,
  formatEtaMs,
  listMissingSidecarExtrasForInstall,
  parsePipProgressBytes,
  shouldSkipStartupAddonInstall,
} from "../app/lib/sidecar-startup-install.js";
import {
  resetStartupAddonInstallForTests,
  runStartupAddonInstall,
} from "../app/lib/sidecar-startup-install-runner.js";

describe("startup addon install planner", () => {
  it("skips e2e and non-desktop shells", () => {
    expect(shouldSkipStartupAddonInstall({ e2eFlag: "1", isDesktop: true })).toBe(true);
    expect(shouldSkipStartupAddonInstall({ e2eFlag: "", isDesktop: false })).toBe(true);
    expect(shouldSkipStartupAddonInstall({ e2eFlag: "", isDesktop: true })).toBe(false);
  });

  it("skips the runner entirely in e2e", async () => {
    const installExtra = vi.fn();
    const result = await runStartupAddonInstall(
      {
        e2eFlag: "1",
        isDesktop: true,
        installExtra,
      },
      () => {},
    );
    expect(result).toEqual({ skipped: true, reason: "skip-env" });
    expect(installExtra).not.toHaveBeenCalled();
  });

  it("lists missing allowlisted extras from registry capabilities", () => {
    const missing = listMissingSidecarExtrasForInstall({
      capabilities: [
        { id: "generate", title: "MusicGen preview", install_hint: "npm run sidecar:generate", available: false },
        { id: "stems", title: "Demucs", install_hint: "npm run sidecar:stems", available: true },
        { id: "vocal_ml", title: "Vocal DSP", install_hint: "npm run sidecar:vocal", available: false },
        { id: "vocal_synth", title: "Base", install_hint: "npm run sidecar", available: false, prompt_install: false },
      ],
    });
    expect(missing.map((row) => row.extraId).sort()).toEqual(["generate", "vocal"]);
  });

  it("orders jobs smallest-first and optional Canvas", () => {
    const jobs = buildStartupInstallJobs(
      [
        { extraId: "cover", title: "Album cover (FLUX text)" },
        { extraId: "vocal", title: "Vocal DSP (scipy)" },
      ],
      { includeCanvas: true, canvasInstalled: false },
    );
    expect(jobs.map((job) => job.id)).toEqual(["vocal", "cover", "canvas"]);
    expect(jobs.every((job) => job.estimatedBytes > 0 && job.typicalMs > 0)).toBe(true);
  });

  it("omits Canvas unless it is known missing", () => {
    const jobs = buildStartupInstallJobs([{ extraId: "classify", title: "Genre" }], {
      includeCanvas: true,
      canvasInstalled: true,
    });
    expect(jobs.map((job) => job.id)).toEqual(["classify"]);
  });

  it("formats size and ETA", () => {
    expect(formatByteSize(2_500_000_000)).toBe("2.5 GB");
    expect(formatEtaMs(5_000)).toBe("Less than a minute left");
    expect(formatEtaMs(10 * 60_000)).toBe("About 10 min left");
    expect(parsePipProgressBytes("Downloading torch (2.5 GB)")).toBe(2_500_000_000);
    expect(parsePipProgressBytes("12.3/45.6 MB")).toBe(12_300_000);
  });

  it("computes live percent, remaining size, and ETA from elapsed time", () => {
    const jobs = buildStartupInstallJobs(
      [
        { extraId: "vocal", title: "Vocal" },
        { extraId: "classify", title: "Genre" },
      ],
      { includeCanvas: false },
    );
    const snap = computeStartupInstallSnapshot({
      jobs,
      completedIds: ["vocal"],
      currentId: "classify",
      startedAt: 0,
      currentStartedAt: 4_000,
      now: 8_000,
      liveParsedBytes: null,
    });
    expect(snap.completedCount).toBe(1);
    expect(snap.totalCount).toBe(2);
    expect(snap.percent).toBeGreaterThan(10);
    expect(snap.percent).toBeLessThan(99);
    expect(snap.sizeLabel).toMatch(/left/);
    expect(snap.etaLabel).toMatch(/left|Done|Calculating/i);
  });
});

describe("startup addon install runner", () => {
  beforeEach(() => {
    resetStartupAddonInstallForTests();
  });

  it("does not install when every extra is already available", async () => {
    const installExtra = vi.fn();
    const waitForSidecar = vi.fn(async () => true);
    const states = [];
    const result = await runStartupAddonInstall(
      {
        e2eFlag: "",
        isDesktop: true,
        waitForSidecar,
        fetchHealth: async () => ({
          capabilities: [
            { id: "stems", title: "Demucs", install_hint: "npm run sidecar:stems", available: true },
          ],
        }),
        probeEnv: async () => ({ mode: "writable", writable: true, message: "ok" }),
        getCanvasStatus: async () => ({ installed: true }),
        installExtra,
        tickMs: 60_000,
        sleep: async () => {},
      },
      (state) => states.push(state),
    );
    expect(result).toEqual({ skipped: true, reason: "all-installed" });
    expect(installExtra).not.toHaveBeenCalled();
    expect(waitForSidecar).not.toHaveBeenCalled();
    expect(states.at(-1)?.open).toBe(false);
  });

  it("installs missing extras even when /health is unowned", async () => {
    const installExtra = vi.fn().mockResolvedValue({ ok: true, mode: "installed", extraId: "vision" });
    const result = await runStartupAddonInstall(
      {
        e2eFlag: "",
        isDesktop: true,
        waitForSidecar: async () => false,
        fetchHealth: async () => ({
          owned: false,
          capabilities: [
            {
              id: "vision",
              title: "Image caption / CLIP",
              install_hint: "npm run sidecar:vision",
              available: false,
            },
          ],
        }),
        probeEnv: async () => ({ mode: "writable", writable: true, message: "ok" }),
        getCanvasStatus: async () => ({ installed: true }),
        installExtra,
        waitExtraReady: async () => ({}),
        subscribeProgress: () => () => {},
        tickMs: 60_000,
        sleep: async () => {},
        now: () => 10_000,
      },
      () => {},
    );
    expect(installExtra).toHaveBeenCalledWith("vision");
    expect(result.completedIds).toEqual(["vision"]);
  });

  it("does not pretend extras are installed when sidecar health is missing", async () => {
    const result = await runStartupAddonInstall(
      {
        e2eFlag: "",
        isDesktop: true,
        waitForSidecar: async () => false,
        fetchHealth: async () => null,
        probeEnv: async () => ({ mode: "writable", writable: true, message: "ok" }),
        getCanvasStatus: async () => ({ installed: true }),
        installExtra: vi.fn(),
        tickMs: 60_000,
        sleep: async () => {},
      },
      () => {},
    );
    expect(result.reason).toBe("no-health");
  });

  it("auto-installs missing extras and reports progress fields", async () => {
    const installExtra = vi.fn().mockResolvedValue({ ok: true, mode: "installed", extraId: "vocal" });
    const states = [];
    const result = await runStartupAddonInstall(
      {
        e2eFlag: "",
        isDesktop: true,
        waitForSidecar: async () => true,
        fetchHealth: async () => ({
          capabilities: [
            { id: "vocal_ml", title: "Vocal DSP", install_hint: "npm run sidecar:vocal", available: false },
          ],
        }),
        probeEnv: async () => ({ mode: "writable", writable: true, message: "ok" }),
        getCanvasStatus: async () => ({ installed: true }),
        installExtra,
        waitExtraReady: async () => ({}),
        subscribeProgress: () => () => {},
        tickMs: 60_000,
        sleep: async () => {},
        now: () => 10_000,
      },
      (state) => states.push(state),
    );
    expect(installExtra).toHaveBeenCalledWith("vocal");
    expect(result.skipped).toBe(false);
    expect(result.completedIds).toEqual(["vocal"]);
    expect(states.some((s) => s.phase === "installing" && s.sizeLabel)).toBe(true);
    expect(states.some((s) => s.etaLabel)).toBe(true);
    expect(states.filter((s) => s.phase === "installing").some((s) => s.open)).toBe(true);
  });

  it("blocks pip extras when the venv is read-only", async () => {
    const installExtra = vi.fn();
    const result = await runStartupAddonInstall(
      {
        e2eFlag: "",
        isDesktop: true,
        waitForSidecar: async () => true,
        fetchHealth: async () => ({
          capabilities: [
            { id: "generate", title: "MusicGen", install_hint: "npm run sidecar:generate", available: false },
          ],
        }),
        probeEnv: async () => ({
          mode: "bundled-readonly",
          writable: false,
          message: "Need Python 3.10–3.12",
        }),
        getCanvasStatus: async () => ({ installed: true }),
        installExtra,
        tickMs: 60_000,
        sleep: async () => {},
      },
      () => {},
    );
    expect(installExtra).not.toHaveBeenCalled();
    expect(result.reason).toBe("blocked-env");
  });
});
