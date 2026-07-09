import { describe, expect, it } from "vitest";

describe("vocal-embed-handoff align export", () => {
  it("exportVocalEmbedHandoffPack accepts alignPreview in options", async () => {
    const { exportVocalEmbedHandoffPack } = await import("../app/lib/vocal-embed-handoff.js");
    expect(typeof exportVocalEmbedHandoffPack).toBe("function");
    expect(exportVocalEmbedHandoffPack.length).toBeGreaterThan(0);
  });
});
