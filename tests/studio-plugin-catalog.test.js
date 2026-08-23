import { describe, expect, it } from "vitest";
import {
  STUDIO_SIDECAR_PLUGIN_CATALOG,
  formatSidecarPluginInstallBusyLabel,
  formatSidecarPluginInstallProgress,
  listStudioPluginCatalog,
  sidecarPluginInstallPercent,
  sidecarPluginInstallProgressFromEvent,
} from "../app/lib/studio-plugin-catalog.js";

describe("studio-plugin-catalog", () => {
  it("lists every sidecar extra without waiting for /health", () => {
    const rows = listStudioPluginCatalog(null);
    expect(rows).toHaveLength(STUDIO_SIDECAR_PLUGIN_CATALOG.length);
    expect(rows.every((row) => row.available === false)).toBe(true);
    expect(rows.find((row) => row.extraId === "stems")?.install_hint).toMatch(/sidecar:stems/);
    expect(rows.find((row) => row.id === "genre")?.extraId).toBe("classify");
    expect(rows.find((row) => row.id === "rvc")?.extraId).toBe("vocal-rvc");
  });

  it("marks plugins installed from sidecar health", () => {
    const rows = listStudioPluginCatalog({
      capabilities: [
        {
          id: "stems",
          title: "Demucs stem separation",
          install_hint: "npm run sidecar:stems",
          available: true,
          tasks: ["separate"],
        },
        {
          id: "generate",
          title: "MusicGen preview",
          install_hint: "npm run sidecar:generate",
          available: false,
        },
      ],
    });
    expect(rows.find((row) => row.id === "stems")?.available).toBe(true);
    expect(rows.find((row) => row.id === "stems")?.tasks).toEqual(["separate"]);
    expect(rows.find((row) => row.id === "generate")?.available).toBe(false);
    expect(rows.find((row) => row.id === "vision")?.available).toBe(false);
  });

  it("parses Tauri pip-progress events and estimates row percent", () => {
    const fromSnake = sidecarPluginInstallProgressFromEvent({
      extra_id: "genre",
      line: "Downloading torch (400.0 MB)",
    });
    expect(fromSnake.extraId).toBe("classify");
    expect(fromSnake.parsedBytes).toBe(400_000_000);
    expect(sidecarPluginInstallPercent(fromSnake.extraId, fromSnake.parsedBytes)).toBe(99);
    expect(formatSidecarPluginInstallProgress(fromSnake)).toMatch(/99%.*Downloading torch/);

    const fromCamel = sidecarPluginInstallProgressFromEvent({
      extraId: "stems",
      parsedBytes: 250_000_000,
      line: "━━━━━━━━ 250.0/2500.0 MB",
    });
    expect(sidecarPluginInstallPercent("stems", fromCamel.parsedBytes)).toBe(10);
    expect(formatSidecarPluginInstallBusyLabel(fromCamel)).toBe("10%");
    expect(formatSidecarPluginInstallProgress(fromCamel)).toBe("10% · ━━━━━━━━ 250.0/2500.0 MB");

    expect(sidecarPluginInstallProgressFromEvent(null)).toEqual({
      extraId: "",
      line: "",
      parsedBytes: null,
    });
    expect(sidecarPluginInstallPercent("stems", null)).toBeNull();
    expect(formatSidecarPluginInstallBusyLabel(null)).toBe("Installing…");
    expect(formatSidecarPluginInstallProgress(null)).toBe("");
  });
});
