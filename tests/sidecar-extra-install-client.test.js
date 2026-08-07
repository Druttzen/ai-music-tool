import { describe, expect, it } from "vitest";
import {
  formatSidecarExtraInstallStatus,
  isSidecarExtraAllowlisted,
  normalizeSidecarExtraId,
  sidecarExtraHealthFlag,
  sidecarExtraInstallCompleted,
  sidecarExtraInstallStatusTone,
  sidecarExtraNpmHint,
} from "../app/lib/sidecar-extra-install-client.js";
import { SCRIPT_STEM } from "../lib/sidecar-extra-install.cjs";

describe("sidecar extra install client", () => {
  it("normalizes legacy capability ids", () => {
    expect(normalizeSidecarExtraId("vocal_ml")).toBe("vocal");
    expect(normalizeSidecarExtraId("rvc")).toBe("vocal-rvc");
    expect(normalizeSidecarExtraId("genre")).toBe("classify");
    expect(normalizeSidecarExtraId("cover-ref")).toBe("cover-ref");
  });

  it("maps npm hints and allowlist", () => {
    expect(sidecarExtraNpmHint("generate")).toBe("npm run sidecar:generate");
    expect(sidecarExtraNpmHint("genre")).toBe("npm run sidecar:classify");
    expect(isSidecarExtraAllowlisted("cover")).toBe(true);
    expect(isSidecarExtraAllowlisted("vocal_ml")).toBe(true);
    expect(isSidecarExtraAllowlisted("nope")).toBe(false);
  });

  it("maps extras to /health flags", () => {
    expect(sidecarExtraHealthFlag("generate")).toBe("generate_available");
    expect(sidecarExtraHealthFlag("genre")).toBe("genre_available");
    expect(sidecarExtraHealthFlag("cover-ref")).toBe("cover_ref_available");
    expect(sidecarExtraHealthFlag("vocal_ml")).toBe("vocal_ml_available");
  });

  it("formats install results", () => {
    expect(formatSidecarExtraInstallStatus({ ok: true, extraId: "stems", mode: "installed" })).toMatch(
      /Installed stems/i,
    );
    expect(
      formatSidecarExtraInstallStatus({
        ok: false,
        mode: "copied-command",
        message: "Copied hint",
      }),
    ).toBe("Copied hint");
    expect(
      formatSidecarExtraInstallStatus({
        ok: false,
        mode: "bundled-readonly",
        error: "frozen",
      }),
    ).toBe("frozen");
    expect(formatSidecarExtraInstallStatus({ ok: false, error: "boom" })).toBe("boom");
  });

  it("detects completed pip installs vs clipboard copy", () => {
    expect(sidecarExtraInstallCompleted({ ok: true, mode: "installed" })).toBe(true);
    expect(sidecarExtraInstallCompleted({ ok: false, mode: "copied-command" })).toBe(false);
    expect(sidecarExtraInstallCompleted({ ok: false, mode: "installed" })).toBe(false);
  });

  it("picks toast tone for copy vs install", () => {
    expect(sidecarExtraInstallStatusTone({ ok: true, mode: "installed" })).toBe("info");
    expect(sidecarExtraInstallStatusTone({ ok: false, mode: "copied-command" })).toBe("warning");
    expect(sidecarExtraInstallStatusTone({ ok: false, error: "nope" })).toBe("error");
  });

  it("keeps Electron script stem map aligned with allowlist", () => {
    expect(SCRIPT_STEM.generate).toBe("install-sidecar-generate");
    expect(SCRIPT_STEM.cover).toBe("install-sidecar-cover");
    expect(SCRIPT_STEM["cover-ref"]).toBe("install-sidecar-cover-ref");
  });
});
