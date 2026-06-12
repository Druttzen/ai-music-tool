import { describe, it, expect } from "vitest";
import {
  DEFAULT_LLM_SETTINGS,
  isCoProducerLlmReady,
} from "../app/lib/co-producer-llm.js";

describe("co-producer-llm", () => {
  it("is not ready when disabled or missing key", () => {
    expect(isCoProducerLlmReady(DEFAULT_LLM_SETTINGS)).toBe(false);
    expect(isCoProducerLlmReady({ ...DEFAULT_LLM_SETTINGS, enabled: true })).toBe(false);
    expect(
      isCoProducerLlmReady({
        ...DEFAULT_LLM_SETTINGS,
        enabled: true,
        apiKey: "sk-test",
      }),
    ).toBe(true);
  });
});
