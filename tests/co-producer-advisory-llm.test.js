import { describe, expect, it } from "vitest";
import {
  coProducerAdvisoryLlmToPatch,
  parseCoProducerAdvisoryLlmResponse,
} from "../app/lib/co-producer-advisory-llm.js";

describe("co-producer-advisory-llm", () => {
  it("parses advisory JSON and builds patch", () => {
    const advisory = parseCoProducerAdvisoryLlmResponse(
      '{"output":"CO-PRODUCER AI REPORT\\nLooks good.","addSounds":["Dark pads"],"addRhythms":[],"suggestMode":null,"musicGenSketch":false}',
    );
    expect(advisory.output).toMatch(/CO-PRODUCER AI REPORT/);
    const patch = coProducerAdvisoryLlmToPatch(advisory, {
      mode: "Hybrid",
      promptIntensity: 50,
      mood: { energy: 40 },
    });
    const sounds = patch.selectedSounds(["Bass"]);
    expect(sounds).toContain("Dark pads");
    expect(sounds).toContain("Bass");
  });

  it("suggests mode patch when control mode and high intensity", () => {
    const advisory = parseCoProducerAdvisoryLlmResponse(
      '{"output":"CO-PRODUCER AI REPORT\\nSwitch mode.","addSounds":[],"addRhythms":[],"suggestMode":"Hybrid","musicGenSketch":false}',
    );
    const patch = coProducerAdvisoryLlmToPatch(advisory, {
      mode: "Control",
      promptIntensity: 80,
      mood: { energy: 50 },
    });
    expect(patch.mode).toBe("Hybrid");
  });
});
