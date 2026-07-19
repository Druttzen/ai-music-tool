import { describe, expect, it } from "vitest";
import { formatApiError, humanizeApiErrorMessage } from "../app/lib/api-error-messages.js";

describe("api-error-messages", () => {
  it("humanizes insufficient funds", () => {
    const msg = humanizeApiErrorMessage("Failed to run review: insufficient funds (request ID: abc)");
    expect(msg).toMatch(/credits|billing|fail-safe/i);
    expect(msg).toMatch(/fail-safe:auto/i);
    expect(msg).not.toMatch(/request ID/i);
  });

  it("humanizes generic API quota without review wording", () => {
    const msg = humanizeApiErrorMessage("insufficient_quota");
    expect(msg).toMatch(/credits|billing/i);
    expect(msg).not.toMatch(/fail-safe/i);
  });

  it("humanizes OpenAI-style JSON errors", () => {
    const body = JSON.stringify({
      error: { message: "You exceeded your current quota, please check your plan and billing details." },
    });
    const msg = formatApiError(429, body, "LLM request");
    expect(msg).toMatch(/billing|credits/i);
  });

  it("parses FastAPI detail string", () => {
    const msg = formatApiError(502, JSON.stringify({ detail: "YouTube resolve failed: timeout" }), "YouTube resolve");
    expect(msg).toContain("timeout");
  });
});
