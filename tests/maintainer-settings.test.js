import { describe, expect, it, beforeEach, vi } from "vitest";

function createMockStorage() {
  /** @type {Record<string, string>} */
  const data = {};
  return {
    getItem: vi.fn((key) => (key in data ? data[key] : null)),
    setItem: vi.fn((key, value) => {
      data[key] = String(value);
    }),
    removeItem: vi.fn((key) => {
      delete data[key];
    }),
    clear: vi.fn(() => {
      for (const k of Object.keys(data)) delete data[k];
    }),
    _data: data,
  };
}

describe("maintainer-settings", () => {
  /** @type {ReturnType<typeof createMockStorage>} */
  let local;
  /** @type {ReturnType<typeof createMockStorage>} */
  let session;

  beforeEach(() => {
    vi.resetModules();
    local = createMockStorage();
    session = createMockStorage();
    vi.stubGlobal("localStorage", local);
    vi.stubGlobal("sessionStorage", session);
  });

  it("stores PAT in sessionStorage only", async () => {
    const { setMaintainerGithubToken, getMaintainerGithubToken, MAINTAINER_GITHUB_TOKEN_KEY } =
      await import("../app/lib/maintainer-settings.js");
    setMaintainerGithubToken("ghp_test_token");
    expect(getMaintainerGithubToken()).toBe("ghp_test_token");
    expect(session.getItem(MAINTAINER_GITHUB_TOKEN_KEY)).toBe("ghp_test_token");
    expect(local.getItem(MAINTAINER_GITHUB_TOKEN_KEY)).toBeNull();
  });

  it("migrates legacy localStorage token then clears it", async () => {
    const { getMaintainerGithubToken, MAINTAINER_GITHUB_TOKEN_KEY } = await import(
      "../app/lib/maintainer-settings.js"
    );
    local.setItem(MAINTAINER_GITHUB_TOKEN_KEY, "ghp_legacy");
    expect(getMaintainerGithubToken()).toBe("ghp_legacy");
    expect(session.getItem(MAINTAINER_GITHUB_TOKEN_KEY)).toBe("ghp_legacy");
    expect(local.getItem(MAINTAINER_GITHUB_TOKEN_KEY)).toBeNull();
  });

  it("clear removes both storages", async () => {
    const {
      setMaintainerGithubToken,
      clearMaintainerGithubToken,
      getMaintainerGithubToken,
      MAINTAINER_GITHUB_TOKEN_KEY,
    } = await import("../app/lib/maintainer-settings.js");
    setMaintainerGithubToken("ghp_x");
    local.setItem(MAINTAINER_GITHUB_TOKEN_KEY, "should_go");
    clearMaintainerGithubToken();
    expect(getMaintainerGithubToken()).toBe("");
    expect(session.getItem(MAINTAINER_GITHUB_TOKEN_KEY)).toBeNull();
    expect(local.getItem(MAINTAINER_GITHUB_TOKEN_KEY)).toBeNull();
  });
});
