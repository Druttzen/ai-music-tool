#!/usr/bin/env node
/**
 * Minimal Fail-Safe Ops local shell — paste a CI log, run diagnose in-browser.
 * Not a full desktop app; interim until Ops leaves the monorepo.
 *
 * Usage: npm run fail-safe-ops -- ui [--port 8787]
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { pathToFileURL } = require("url");

const opsRoot = path.join(__dirname, "..");
const repoRoot = path.join(opsRoot, "..");
const uiDir = path.join(opsRoot, "ui");
const isWin = process.platform === "win32";

function parsePort(argv) {
  const i = argv.indexOf("--port");
  if (i >= 0 && argv[i + 1]) {
    const n = Number(argv[i + 1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return Number(process.env.FAIL_SAFE_OPS_UI_PORT || 8787);
}

function openBrowser(url) {
  if (process.env.FAIL_SAFE_OPS_UI_NO_OPEN === "1") return;
  const cmd = isWin ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = isWin ? ["/c", "start", "", url] : [url];
  spawnSync(cmd, args, { shell: false, stdio: "ignore" });
}

async function diagnoseLog(log) {
  const classifierUrl = pathToFileURL(path.join(repoRoot, "app/lib/fail-safe-bot.js")).href;
  const { classifyFailureText, formatReportSummary, formatAgentFixPrompt } = await import(classifierUrl);
  const issues = classifyFailureText(log || "");
  const report = {
    at: Date.now(),
    overall: issues.length ? "fail" : "warn",
    issues: issues.length
      ? issues
      : [
          {
            id: "unclassified",
            severity: "warn",
            title: "Unclassified CI failure",
            detail: "See log. Run fail-safe-ops run locally.",
            fixCommands: ["npm run fail-safe-ops -- run", "npm run check:ci"],
          },
        ],
  };
  const branch = spawnSync("git", ["branch", "--show-current"], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: isWin,
  }).stdout?.trim();
  return {
    summary: formatReportSummary(report),
    agentPrompt: formatAgentFixPrompt(log || "", { branch }),
    report,
  };
}

function sendJson(res, status, body) {
  const raw = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(raw),
  });
  res.end(raw);
}

function serveStatic(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
  };
  const data = fs.readFileSync(filePath);
  res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
  res.end(data);
}

async function main() {
  const port = parsePort(process.argv.slice(2));
  const indexHtml = path.join(uiDir, "index.html");
  if (!fs.existsSync(indexHtml)) {
    console.error("fail-safe-ops ui: missing ui/index.html");
    process.exit(1);
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
        serveStatic(res, indexHtml);
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/diagnose") {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = Buffer.concat(chunks).toString("utf8");
        let log = body;
        try {
          const parsed = JSON.parse(body);
          log = typeof parsed.log === "string" ? parsed.log : body;
        } catch {
          /* plain text body */
        }
        const result = await diagnoseLog(log);
        sendJson(res, 200, result);
        return;
      }
      res.writeHead(404).end("not found");
    } catch (err) {
      sendJson(res, 500, { error: err?.message || String(err) });
    }
  });

  server.listen(port, "127.0.0.1", () => {
    const url = `http://127.0.0.1:${port}/`;
    console.log(`Fail-Safe Ops UI — ${url}`);
    console.log("Paste a CI log and click Diagnose. Ctrl+C to stop.");
    openBrowser(url);
  });
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
