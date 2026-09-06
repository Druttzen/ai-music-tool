import { afterAll, describe, expect, it } from "vitest";
import http from "http";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const uiScript = path.join(root, "fail-safe-ops", "bin", "fail-safe-ops-ui.cjs");
const PORT = 8791;

function waitForServer(ms = 8000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(`http://127.0.0.1:${PORT}/`, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > ms) reject(new Error("Ops UI server did not start"));
        else setTimeout(tick, 100);
      });
    };
    tick();
  });
}

describe("fail-safe-ops ui", () => {
  let child;

  afterAll(() => {
    if (child && !child.killed) child.kill("SIGTERM");
  });

  it("diagnoses a pasted CI log via /api/diagnose", async () => {
    child = spawn(process.execPath, [uiScript, "--port", String(PORT)], {
      cwd: root,
      env: { ...process.env, FAIL_SAFE_OPS_UI_NO_OPEN: "1" },
      stdio: "ignore",
    });
    await waitForServer();

    const body = JSON.stringify({ log: "ci-gates — FAILED at: check:full\n" });
    const result = await new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: PORT,
          path: "/api/diagnose",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
          },
        },
        (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            resolve({
              status: res.statusCode,
              json: JSON.parse(Buffer.concat(chunks).toString("utf8")),
            });
          });
        },
      );
      req.on("error", reject);
      req.write(body);
      req.end();
    });

    expect(result.status).toBe(200);
    expect(result.json.summary).toMatch(/Fail-safe/i);
    expect(result.json.agentPrompt).toBeTruthy();
  }, 20_000);
});
