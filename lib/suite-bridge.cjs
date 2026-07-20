/**
 * AI Creator Suite — shared handoff protocol (Node/Electron legacy).
 */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const https = require("https");
const {
  canvasAddonMeta,
  canvasExecutableCandidates,
  canvasInstallFallbackUrl,
  exportsDir,
  findCanvasExecutable,
  findCanvasInstaller,
  handoffFile,
  handoffTimestampIso,
  sanitizeArtworkExt,
  suiteDir,
} = require("./suite-handoff-config.cjs");

const SUITE_DIR = suiteDir();
const EXPORTS_DIR = exportsDir();
const HANDOFF_FILE = handoffFile();

async function ensureSuiteDirs() {
  await fs.promises.mkdir(EXPORTS_DIR, { recursive: true });
}

function canvasAddonStatus() {
  const exe = findCanvasExecutable();
  const meta = canvasAddonMeta();
  return {
    id: "canvas",
    title: meta?.title || "AI Canvas Tool",
    description: meta?.description || "",
    installed: Boolean(exe),
    path: exe,
    repoUrl: meta?.repoUrl || null,
    installUrl: meta?.installUrl || null,
    releasesUrl: meta?.releasesUrl || null,
  };
}

/** @returns {string | null} executable path when spawn succeeded */
function launchCanvasTool(handoffPath) {
  const exe = findCanvasExecutable();
  if (!exe) return null;
  const args = handoffPath ? ["--handoff", handoffPath] : [];
  spawn(exe, args, { detached: true, stdio: "ignore" }).unref();
  return exe;
}

function launchCanvasAddon() {
  const exe = launchCanvasTool(fs.existsSync(HANDOFF_FILE) ? HANDOFF_FILE : null);
  return { ok: Boolean(exe), launched: Boolean(exe), path: exe };
}

function openPathSafe(target) {
  const { shell } = require("electron");
  return shell.openPath(target);
}

function openExternalSafe(url) {
  const { shell } = require("electron");
  return shell.openExternal(url);
}

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "ai-music-tool-suite-addon",
          Accept: "application/vnd.github+json",
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          httpsGetJson(res.headers.location).then(resolve, reject);
          return;
        }
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`GitHub API ${res.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(err);
          }
        });
      },
    );
    req.on("error", reject);
  });
}

function httpsDownload(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const req = https.get(
      url,
      { headers: { "User-Agent": "ai-music-tool-suite-addon" } },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlink(destPath, () => {});
          httpsDownload(res.headers.location, destPath).then(resolve, reject);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          file.close();
          fs.unlink(destPath, () => {});
          reject(new Error(`Download failed (${res.statusCode})`));
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve(destPath)));
      },
    );
    req.on("error", (err) => {
      file.close();
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

function pickReleaseAsset(assets) {
  const names = (assets || []).map((a) => ({ name: a.name || "", url: a.browser_download_url }));
  const prefer =
    process.platform === "win32"
      ? names.find((a) => /setup.*\.exe$/i.test(a.name) || /\.exe$/i.test(a.name))
      : process.platform === "darwin"
        ? names.find((a) => /\.dmg$/i.test(a.name) || /\.pkg$/i.test(a.name))
        : names.find((a) => /\.AppImage$/i.test(a.name) || /\.deb$/i.test(a.name));
  return prefer || names[0] || null;
}

/**
 * Install / download Canvas addon: local installer → GitHub release → build docs.
 */
async function installCanvasAddon() {
  const status = canvasAddonStatus();
  if (status.installed) {
    return { ok: true, alreadyInstalled: true, path: status.path, mode: "installed" };
  }

  const localInstaller = findCanvasInstaller();
  if (localInstaller) {
    await openPathSafe(localInstaller);
    return { ok: true, mode: "local-installer", path: localInstaller };
  }

  const meta = canvasAddonMeta();
  const owner = meta?.githubOwner;
  const repo = meta?.githubRepo;
  if (owner && repo) {
    try {
      const release = await httpsGetJson(`https://api.github.com/repos/${owner}/${repo}/releases/latest`);
      const asset = pickReleaseAsset(release.assets);
      if (asset?.url) {
        const downloads =
          process.env.USERPROFILE || process.env.HOME
            ? path.join(process.env.USERPROFILE || process.env.HOME, "Downloads")
            : EXPORTS_DIR;
        await fs.promises.mkdir(downloads, { recursive: true });
        const dest = path.join(downloads, path.basename(asset.name) || "AI-Canvas-Tool-Setup.exe");
        await httpsDownload(asset.url, dest);
        await openPathSafe(dest);
        return { ok: true, mode: "downloaded", path: dest };
      }
      return openCanvasInstallDocs({
        mode: "no-release-assets",
        message: "GitHub release has no installer assets yet",
      });
    } catch (err) {
      const code = String(err?.message || "");
      if (code.includes("404")) {
        return openCanvasInstallDocs({
          mode: "no-release",
          message: "No GitHub release published yet for AI Canvas Tool",
        });
      }
      // network or other API errors — still open build docs
    }
  }

  return openCanvasInstallDocs({ mode: "docs" });
}

async function openCanvasInstallDocs({ mode = "docs", message = "" } = {}) {
  const url = canvasInstallFallbackUrl();
  await openExternalSafe(url);
  return {
    ok: true,
    mode,
    url,
    message:
      message ||
      "Opened Canvas build instructions — run npm run dist:setup in ai-canvas-tool, or place Setup.exe in Downloads",
  };
}

async function writeArtworkExport(buffer, ext) {
  await ensureSuiteDirs();
  const cleanExt = sanitizeArtworkExt(ext);
  const artPath = path.join(EXPORTS_DIR, `album-art-${Date.now()}.${cleanExt}`);
  await fs.promises.writeFile(artPath, buffer);
  return artPath;
}

/**
 * Write handoff.json and try to launch Canvas Tool.
 * @returns {{ exe: string | null, launched: boolean }}
 */
async function openInCanvasFromMusic({ title, artist, albumArtPath, motionHint, durationSec }) {
  await ensureSuiteDirs();
  const handoff = {
    version: 1,
    timestamp: handoffTimestampIso(),
    source: "ai-music-tool",
    track: { title, artist, albumArtPath },
    canvas: { motionHint, durationSec },
  };
  await fs.promises.writeFile(HANDOFF_FILE, JSON.stringify(handoff, null, 2), "utf8");
  const exe = launchCanvasTool(HANDOFF_FILE);
  return { exe, launched: Boolean(exe) };
}

module.exports = {
  SUITE_DIR,
  EXPORTS_DIR,
  HANDOFF_FILE,
  ensureSuiteDirs,
  findCanvasExecutable,
  canvasExecutableCandidates,
  canvasAddonStatus,
  launchCanvasAddon,
  installCanvasAddon,
  launchCanvasTool,
  writeArtworkExport,
  openInCanvasFromMusic,
};
