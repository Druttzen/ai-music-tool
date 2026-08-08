import { describe, expect, it } from "vitest";
import {
  countAvailableSidecarCapabilities,
  formatSidecarDeviceSummary,
  missingSidecarInstallHints,
  musicGenInstallHint,
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
});
