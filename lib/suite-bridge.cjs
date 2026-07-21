/** Canvas integration bridge for the legacy Electron desktop build. */
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
  const executable = findCanvasExecutable();
  const meta = canvasAddonMeta();
  return {
    id: "canvas",
    title: meta.title,
    description: meta.description,
    installed: Boolean(executable),
    path: executable,
    repoUrl: meta.repoUrl,
    installUrl: meta.installUrl,
    releasesUrl: meta.releasesUrl,
  };
}

function launchCanvasTool(handoffPath) {
  const executable = findCanvasExecutable();
  if (!executable) return null;
  const args = handoffPath ? ["--handoff", handoffPath] : [];
  spawn(executable, args, { detached: true, stdio: "ignore", windowsHide: true }).unref();
  return executable;
}

function launchCanvasAddon() {
  const executable = launchCanvasTool(fs.existsSync(HANDOFF_FILE) ? HANDOFF_FILE : null);
  return { ok: Boolean(executable), launched: Boolean(executable), path: executable };
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
    const request = https.get(
      url,
      { headers: { "User-Agent": "ai-music-tool-canvas", Accept: "application/vnd.github+json" } },
      (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          httpsGetJson(response.headers.location).then(resolve, reject);
          return;
        }
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => { body += chunk; });
        response.on("end", () => {
          if (response.statusCode >= 400) {
            reject(new Error(`GitHub API ${response.statusCode}`));
            return;
          }
          try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
        });
      },
    );
    request.on("error", reject);
  });
}

function httpsDownload(url, destination) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);
    const request = https.get(url, { headers: { "User-Agent": "ai-music-tool-canvas" } }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.unlink(destination, () => {});
        httpsDownload(response.headers.location, destination).then(resolve, reject);
        return;
      }
      if (response.statusCode >= 400) {
        file.close();
        fs.unlink(destination, () => {});
        reject(new Error(`Download failed (${response.statusCode})`));
        return;
      }
      response.pipe(file);
      file.on("finish", () => file.close(() => resolve(destination)));
    });
    request.on("error", (error) => {
      file.close();
      fs.unlink(destination, () => {});
      reject(error);
    });
  });
}

function pickReleaseAsset(assets) {
  const candidates = (assets || []).map((asset) => ({ name: asset.name || "", url: asset.browser_download_url }));
  const preferred = process.platform === "win32"
    ? candidates.find((asset) => /setup.*\.exe$/i.test(asset.name) || /\.exe$/i.test(asset.name))
    : process.platform === "darwin"
      ? candidates.find((asset) => /\.dmg$/i.test(asset.name) || /\.pkg$/i.test(asset.name))
      : candidates.find((asset) => /\.AppImage$/i.test(asset.name) || /\.deb$/i.test(asset.name));
  return preferred || candidates[0] || null;
}

async function openCanvasInstallDocs({ mode = "docs", message = "" } = {}) {
  const url = canvasInstallFallbackUrl();
  await openExternalSafe(url);
  return {
    ok: true,
    mode,
    url,
    message: message || "Opened AI Canvas Tool install instructions",
  };
}

async function installCanvasAddon() {
  const status = canvasAddonStatus();
  if (status.installed) return { ok: true, alreadyInstalled: true, path: status.path, mode: "installed" };

  const localInstaller = findCanvasInstaller();
  if (localInstaller) {
    await openPathSafe(localInstaller);
    return { ok: true, mode: "local-installer", path: localInstaller };
  }

  const meta = canvasAddonMeta();
  try {
    const release = await httpsGetJson(`https://api.github.com/repos/${meta.githubOwner}/${meta.githubRepo}/releases/latest`);
    const asset = pickReleaseAsset(release.assets);
    if (!asset?.url) {
      return openCanvasInstallDocs({ mode: "no-release-assets", message: "GitHub release has no installer assets yet" });
    }
    const downloads = process.env.USERPROFILE || process.env.HOME
      ? path.join(process.env.USERPROFILE || process.env.HOME, "Downloads")
      : EXPORTS_DIR;
    await fs.promises.mkdir(downloads, { recursive: true });
    const destination = path.join(downloads, path.basename(asset.name) || "AI Canvas Tool Setup.exe");
    await httpsDownload(asset.url, destination);
    await openPathSafe(destination);
    return { ok: true, mode: "downloaded", path: destination };
  } catch (error) {
    const noRelease = String(error?.message || "").includes("404");
    return openCanvasInstallDocs({
      mode: noRelease ? "no-release" : "docs",
      message: noRelease ? "No GitHub release published yet for AI Canvas Tool" : "Could not download Canvas automatically",
    });
  }
}

async function writeArtworkExport(buffer, ext) {
  await ensureSuiteDirs();
  const artPath = path.join(EXPORTS_DIR, `album-art-${Date.now()}.${sanitizeArtworkExt(ext)}`);
  await fs.promises.writeFile(artPath, buffer);
  return artPath;
}

function sanitizeAudioExt(ext) {
  const raw = String(ext || "mp3").trim().replace(/^\.+/, "").toLowerCase();
  if (raw.includes("/") || raw.includes("\\") || raw.includes("..")) return "mp3";
  if (["wav", "flac", "ogg"].includes(raw)) return raw;
  if (["m4a", "aac"].includes(raw)) return "m4a";
  return "mp3";
}

async function writeAudioExport(buffer, ext) {
  await ensureSuiteDirs();
  const audioPath = path.join(EXPORTS_DIR, `track-audio-${Date.now()}.${sanitizeAudioExt(ext)}`);
  await fs.promises.writeFile(audioPath, buffer);
  return audioPath;
}

async function openInCanvasFromMusic({ title, artist, albumArtPath, audioPath, motionHint, durationSec }) {
  await ensureSuiteDirs();
  const handoff = {
    version: 1,
    timestamp: handoffTimestampIso(),
    source: "ai-music-tool",
    track: { title, artist, albumArtPath, ...(audioPath ? { audioPath } : {}) },
    canvas: { motionHint, durationSec },
  };
  await fs.promises.writeFile(HANDOFF_FILE, JSON.stringify(handoff, null, 2), "utf8");
  const executable = launchCanvasTool(HANDOFF_FILE);
  return { exe: executable, launched: Boolean(executable) };
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
  writeAudioExport,
  openInCanvasFromMusic,
};
