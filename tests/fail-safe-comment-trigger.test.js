import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "../scripts/fail-safe-comment-trigger.cjs");

function run(body, user = "someone") {
  const r = spawnSync(process.execPath, [script, "--json-in"], {
    input: JSON.stringify({ body, user }),
    encoding: "utf8",
  });
  return { code: r.status, json: JSON.parse(r.stdout || "{}") };
}

describe("fail-safe-comment-trigger", () => {
  it("matches @fail-safe fix", () => {
    const { code, json } = run("@fail-safe fix please");
    expect(code).toBe(0);
    expect(json.match).toBe(true);
    expect(json.mode).toBe("fix");
  });

  it("matches Sourcery bot", () => {
    const { code, json } = run("Prompt for AI Agents\nissue_to_address", "sourcery-ai[bot]");
    expect(code).toBe(0);
    expect(json.mode).toBe("sourcery");
  });

  it("ignores unrelated comments", () => {
    const { code, json } = run("LGTM thanks");
    expect(code).toBe(2);
    expect(json.match).toBe(false);
  });

  it("matches paid review billing failures", () => {
    const { code, json } = run("Failed to run review: insufficient funds for Bugbot");
    expect(code).toBe(0);
    expect(json.mode).toBe("fix");
  });
});
