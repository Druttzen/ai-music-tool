import { describe, expect, it } from "vitest";
import {
  formatSidecarExtraInstallStatus,
  isSidecarExtraAllowlisted,
  normalizeSidecarExtraId,
  sidecarExtraInstallCompleted,
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

  it("formats install results", () => {
    expect(formatSidecarExtraInstallStatus({ ok: true, extraId: "stems", mode: "installed" })).toMatch(
      /Installed stems/i,
    );
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
    expect(sidecarExtraInstallCompleted({ ok: true, mode: "copied-command" })).toBe(false);
    expect(sidecarExtraInstallCompleted({ ok: false, mode: "installed" })).toBe(false);
  });

  it("keeps Electron script stem map aligned with allowlist", () => {
    expect(SCRIPT_STEM.generate).toBe("install-sidecar-generate");
    expect(SCRIPT_STEM.cover).toBe("install-sidecar-cover");
    expect(SCRIPT_STEM["cover-ref"]).toBe("install-sidecar-cover-ref");
  });
});
