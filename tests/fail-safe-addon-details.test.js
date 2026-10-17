import { describe, expect, it } from "vitest";
import { buildRuntimeHealthReport } from "../app/lib/fail-safe-bot.js";

describe("Fail-Safe addon diagnostics", () => {
  it("keeps all named plugin failures instead of only the final batch toast", () => {
    const report = buildRuntimeHealthReport({ sidecarAiStatus: "ready", sidecarGenerateAvailable: true,
      sidecarHealth: { librosa_available: true }, appSubsystems: {
        localFaults: [
          { source: "ui.status", message: "Download all finished: 9 installed, 4 failed" },
          ...["stems", "cover", "cover-ref", "vocal-rvc"].map((id) => ({ source: `addons.install:${id}`, message: "failed", stack: `${id} root cause` })),
        ],
      } });
    const failures = report.issues.filter((issue) => issue.id === "sidecar_extra_install");
    expect(failures.map((issue) => issue.extraId)).toEqual(["stems", "cover", "cover-ref", "vocal-rvc"]);
    expect(failures[3].error).toBe("vocal-rvc root cause");
  });
});
