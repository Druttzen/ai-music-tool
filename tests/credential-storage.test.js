import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  clearStoredCredentials,
  hasStoredCredentials,
  CREDENTIAL_STORAGE_NOTICE,
} from "../app/lib/credential-storage.js";
import { LLM_SETTINGS_KEY } from "../app/lib/co-producer-llm.js";
import { STYLE_DNA_SETTINGS_KEY } from "../app/lib/style-dna-settings.js";

describe("credential-storage", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      store: {},
      getItem(k) {
        return this.store[k] ?? null;
      },
      setItem(k, v) {
        this.store[k] = v;
      },
      removeItem(k) {
        delete this.store[k];
      },
    });
  });

  it("detects stored LLM api key", () => {
    localStorage.setItem(LLM_SETTINGS_KEY, JSON.stringify({ apiKey: "sk-test" }));
    expect(hasStoredCredentials()).toBe(true);
  });

  it("clearStoredCredentials removes credential keys", () => {
    localStorage.setItem(LLM_SETTINGS_KEY, JSON.stringify({ apiKey: "sk-test" }));
    localStorage.setItem(STYLE_DNA_SETTINGS_KEY, JSON.stringify({ auddApiToken: "tok" }));
    clearStoredCredentials();
    expect(localStorage.getItem(LLM_SETTINGS_KEY)).toBeNull();
    expect(localStorage.getItem(STYLE_DNA_SETTINGS_KEY)).toBeNull();
    expect(hasStoredCredentials()).toBe(false);
  });

  it("exports a user-facing notice string", () => {
    expect(CREDENTIAL_STORAGE_NOTICE).toMatch(/localStorage/i);
  });
});
