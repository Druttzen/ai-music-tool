import { describe, expect, it } from "vitest";
import {
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
    });
    expect(hints.map((h) => h.id).sort()).toEqual(["generate", "genre", "stems"]);
    expect(hints.find((h) => h.id === "genre")?.install_hint).toBe("npm run sidecar:classify");
  });
});
