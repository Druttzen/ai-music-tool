#!/usr/bin/env node
/**
 * Delete an existing GitHub release for the current tag so electron-builder
 * can publish all assets (exe, blockmap, latest.yml) without 422 already_exists.
 *
 * Usage: GITHUB_REF_NAME=v0.47.1 GH_TOKEN=... node scripts/prepare-github-release-publish.cjs
 */
const { spawnSync } = require("child_process");

const tag = process.env.GITHUB_REF_NAME || process.argv[2];
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

if (!tag) {
  console.log("prepare-github-release-publish: no tag — skip");
  process.exit(0);
}

if (!token) {
  console.error("prepare-github-release-publish: GH_TOKEN required");
  process.exit(1);
}

function gh(args) {
  const r = spawnSync("gh", args, {
    encoding: "utf8",
    env: { ...process.env, GH_TOKEN: token },
  });
  return { ok: r.status === 0, stdout: (r.stdout || "").trim(), stderr: (r.stderr || "").trim() };
}

const lookup = gh([
  "api",
  `repos/${process.env.GITHUB_REPOSITORY || "Druttzen/ai-music-tool"}/releases/tags/${tag}`,
  "--jq",
  ".id",
]);

if (!lookup.ok) {
  console.log(`prepare-github-release-publish: no existing release for ${tag} — ok`);
  process.exit(0);
}

const releaseId = lookup.stdout;
if (!releaseId) {
  console.log(`prepare-github-release-publish: no release id for ${tag} — ok`);
  process.exit(0);
}

console.log(`prepare-github-release-publish: deleting release ${tag} (id ${releaseId})`);
const del = gh([
  "api",
  "-X",
  "DELETE",
  `repos/${process.env.GITHUB_REPOSITORY || "Druttzen/ai-music-tool"}/releases/${releaseId}`,
]);

if (!del.ok) {
  console.error(`prepare-github-release-publish: delete failed: ${del.stderr}`);
  process.exit(1);
}

console.log(`prepare-github-release-publish: deleted release ${tag} — electron-builder will recreate`);
