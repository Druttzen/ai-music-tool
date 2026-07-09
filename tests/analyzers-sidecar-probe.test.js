import { describe, expect, it } from "vitest";
import {
  resolveSidecarAiStatus,
  resolveSidecarGenerateAvailable,
  sidecarProbeDelayMs,
} from "../app/lib/analyzers-sidecar-probe.js";

describe("analyzers-sidecar-probe", () => {
  it("returns ready when HTTP sidecar responds", () => {
    expect(resolveSidecarAiStatus({ httpOk: true, isTauri: false })).toBe("ready");
  });

  it("returns standby when Tauri has not spawned sidecar yet", () => {
    expect(
      resolveSidecarAiStatus({
        httpOk: false,
        isTauri: true,
        tauriManaged: { ready: false, spawned: false },
      }),
    ).toBe("standby");
  });

  it("returns ready when Tauri managed sidecar is ready", () => {
    expect(
      resolveSidecarAiStatus({
        httpOk: false,
        isTauri: true,
        tauriManaged: { ready: true, spawned: true },
      }),
    ).toBe("ready");
  });

  it("returns offline when Tauri spawned but not ready", () => {
    expect(
      resolveSidecarAiStatus({
        httpOk: false,
        isTauri: true,
        tauriManaged: { ready: false, spawned: true },
      }),
    ).toBe("offline");
  });

  it("reads generate_available from health payload", () => {
    expect(resolveSidecarGenerateAvailable({ health: { generate_available: true } })).toBe(true);
    expect(resolveSidecarGenerateAvailable({ health: { generate_available: false } })).toBe(false);
    expect(resolveSidecarGenerateAvailable({ health: null })).toBe(false);
  });

  it("uses longer delay when sidecar is ready", () => {
    expect(sidecarProbeDelayMs("ready")).toBeGreaterThan(sidecarProbeDelayMs("offline"));
    expect(sidecarProbeDelayMs("standby")).toBeGreaterThan(sidecarProbeDelayMs("offline"));
  });
});
