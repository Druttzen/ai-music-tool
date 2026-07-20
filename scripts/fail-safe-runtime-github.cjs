/**
 * GitHub REST helpers for Fail-Safe Runtime delivery (maintainer PAT or GH_TOKEN).
 */
const https = require("https");

const DEFAULT_OWNER = "Druttzen";
const DEFAULT_REPO = "ai-music-tool";

/**
 * @param {{ token: string, method: string, path: string, body?: object }} opts
 * @returns {Promise<object>}
 */
function githubRequest({ token, method, path, body }) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: "api.github.com",
        path,
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "ai-music-tool-fail-safe-runtime",
          ...(payload
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
              }
            : {}),
        },
      },
      (res) => {
        let chunks = "";
        res.on("data", (chunk) => {
          chunks += chunk;
        });
        res.on("end", () => {
          let parsed = {};
          try {
            parsed = chunks ? JSON.parse(chunks) : {};
          } catch {
            parsed = { message: chunks };
          }
          if (res.statusCode >= 400) {
            reject(new Error(`${res.statusCode}: ${parsed.message || chunks}`));
            return;
          }
          resolve(parsed);
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * @param {{ token: string, owner?: string, repo?: string, title: string, body: string, labels?: string[] }} opts
 */
async function createIssue(opts) {
  const owner = opts.owner || DEFAULT_OWNER;
  const repo = opts.repo || DEFAULT_REPO;
  const issue = await githubRequest({
    token: opts.token,
    method: "POST",
    path: `/repos/${owner}/${repo}/issues`,
    body: {
      title: opts.title,
      body: opts.body,
      labels: opts.labels || ["fail-safe-runtime", "needs-agent"],
    },
  });
  return { url: issue.html_url, number: issue.number };
}

/**
 * @param {{ token: string, owner?: string, repo?: string, title: string, body: string, head: string, base?: string }} opts
 */
async function createDraftPullRequest(opts) {
  const owner = opts.owner || DEFAULT_OWNER;
  const repo = opts.repo || DEFAULT_REPO;
  const pr = await githubRequest({
    token: opts.token,
    method: "POST",
    path: `/repos/${owner}/${repo}/pulls`,
    body: {
      title: opts.title,
      body: opts.body,
      head: opts.head,
      base: opts.base || "master",
      draft: true,
    },
  });
  return { url: pr.html_url, number: pr.number };
}

module.exports = {
  DEFAULT_OWNER,
  DEFAULT_REPO,
  githubRequest,
  createIssue,
  createDraftPullRequest,
};
