import { describe, expect, it } from "vitest";
import {
  countAvailableSidecarCapabilities,
  formatSidecarDeviceSummary,
  formatSidecarExtraRowStatus,
  formatSidecarInstallEnvChip,
  formatSidecarProcessChip,
  listSidecarCapabilityRows,
  missingSidecarInstallHints,
  musicGenInstallHint,
  sortSidecarCapabilityRows,
} from "../app/lib/sidecar-capabilities.js";

describe("sidecar-capabilities", () => {
  it("reads missing hints from registry capabilities", () => {
    const hints = missingSidecarInstallHints({
      capabilities: [
        {
          id: "generate",
          title: "MusicGen preview",
          install_hint: "npm run sidecar:generate",
          available: false,
        },
        {
          id: "stems",
          title: "Demucs",
          install_hint: "npm run sidecar:stems",
          available: true,
        },
        {
          id: "vocal_synth",
          title: "Vocal embed synthesis",
          install_hint: "npm run sidecar",
          available: false,
          prompt_install: false,
        },
      ],
    });
    expect(hints).toEqual([
      {
        id: "generate",
        title: "MusicGen preview",
        install_hint: "npm run sidecar:generate",
      },
    ]);
    expect(musicGenInstallHint({ capabilities: hints.map((h) => ({ ...h, available: false })) })).toBe(
      "npm run sidecar:generate",
    );
  });

  it("falls back to legacy boolean flags", () => {
    const hints = missingSidecarInstallHints({
      generate_available: false,
      stems_available: false,
      vision_available: true,
      genre_available: false,
      vocal_ml_available: false,
    });
    expect(hints.map((h) => h.id).sort()).toEqual(["generate", "genre", "stems", "vocal_ml"]);
    expect(hints.find((h) => h.id === "genre")?.install_hint).toBe("npm run sidecar:classify");
    expect(hints.find((h) => h.id === "vocal_ml")?.install_hint).toBe("npm run sidecar:vocal");
  });

  it("formats device summary and capability counts", () => {
    expect(
      formatSidecarDeviceSummary({
        device: "cpu",
        device_info: { device: "cuda", backend: "cuda", name: "RTX", total_vram_gb: 8 },
      }),
    ).toMatch(/cuda.*RTX.*8\.0 GB VRAM/);
    expect(formatSidecarDeviceSummary({ device: "cpu" })).toBe("cpu");
    expect(
      countAvailableSidecarCapabilities({
        capabilities: [
          { id: "a", available: true },
          { id: "b", available: false },
        ],
      }),
    ).toEqual({ available: 1, total: 2 });
    expect(
      countAvailableSidecarCapabilities({
        generate_available: true,
        stems_available: false,
        vision_available: true,
      }),
    ).toEqual({ available: 2, total: 3 });
  });

  it("lists all installable capability rows with status", () => {
    const rows = listSidecarCapabilityRows({
      capabilities: [
        {
          id: "generate",
          title: "MusicGen preview",
          install_hint: "npm run sidecar:generate",
          available: true,
          commercial_use: false,
          tasks: ["generate"],
          license: "CC-BY-NC",
        },
        {
          id: "stems",
          title: "Demucs",
          install_hint: "npm run sidecar:stems",
          available: false,
          tasks: ["separate"],
        },
        {
          id: "vocal_synth",
          title: "Vocal embed synthesis",
          install_hint: "npm run sidecar",
          available: true,
          prompt_install: false,
        },
      ],
    });
    expect(rows.map((r) => r.id)).toEqual(["generate", "stems"]);
    expect(rows.find((r) => r.id === "generate")?.available).toBe(true);
    expect(rows.find((r) => r.id === "generate")?.commercial_use).toBe(false);
    expect(rows.find((r) => r.id === "generate")?.tasks).toEqual(["generate"]);
    expect(rows.find((r) => r.id === "stems")?.available).toBe(false);
  });

  it("sorts action-needed extras first and formats row status", () => {
    const sorted = sortSidecarCapabilityRows(
      [
        { id: "generate", title: "MusicGen", available: true },
        { id: "stems", title: "Demucs", available: false },
        { id: "vision", title: "Vision", available: false },
      ],
      { vision: "pip failed" },
      (id) => id,
    );
    expect(sorted.map((r) => r.id)).toEqual(["vision", "stems", "generate"]);
    expect(formatSidecarExtraRowStatus({ available: true }).label).toBe("Installed");
    expect(formatSidecarExtraRowStatus({ available: false }, { installing: true }).tone).toBe("info");
    expect(formatSidecarExtraRowStatus({ available: false }, { error: "x" }).label).toBe("Failed");
  });

  it("maps install env and process chips", () => {
    expect(formatSidecarInstallEnvChip({ mode: "writable", message: "ok" })).toMatchObject({
      label: "Writable",
      tone: "ok",
    });
    expect(formatSidecarInstallEnvChip({ mode: "user-data-bootstrap" }).label).toBe("First-time setup");
    expect(formatSidecarInstallEnvChip({ mode: "bundled-readonly" }).tone).toBe("warn");
    expect(formatSidecarInstallEnvChip({ mode: "cli-only" }).label).toBe("CLI only");
    expect(formatSidecarProcessChip("ready")).toEqual({ label: "Sidecar ready", tone: "ok" });
    expect(formatSidecarProcessChip("offline").tone).toBe("bad");
  });
});
