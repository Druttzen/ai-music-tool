/**
 * AI Creator Suite — shared handoff protocol (Node/Electron legacy).
 */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const https = require("https");
const {
  addonInstallFallbackUrl,
  addonMeta,
  canvasAddonMeta,
  canvasExecutableCandidates,
  canvasInstallFallbackUrl,
  exportsDir,
  findAddonExecutable,
  findAddonInstallation,
  findAddonInstaller,
  findCanvasExecutable,
  findCanvasInstaller,
  handoffFile,
  handoffTimestampIso,
  listAddonIds,
  musicVideoExportsDir,
  musicVideoHandoffFile,
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
  return suiteAddonStatus("canvas");
}

function suiteAddonStatus(addonId) {
  const id = String(addonId || "canvas");
  const exe = findAddonExecutable(id);
  const installation = findAddonInstallation(id);
  const meta = addonMeta(id);
  return {
    id,
    title: meta?.title || id,
    description: meta?.description || "",
    installed: Boolean(exe || installation),
    path: exe || installation,
    repoUrl: meta?.repoUrl || null,
    installUrl: meta?.installUrl || null,
    releasesUrl: meta?.releasesUrl || null,
  };
}

function listSuiteAddonsStatus() {
  return listAddonIds().map((id) => suiteAddonStatus(id));
}

/** @returns {string | null} executable path when spawn succeeded */
function launchCanvasTool(handoffPath) {
  return launchAddonExecutable("canvas", handoffPath);
}

function launchAddonExecutable(addonId, handoffPath) {
  const exe = findAddonExecutable(addonId);
  if (!exe) return null;
  const args = handoffPath ? ["--handoff", handoffPath] : [];
  spawn(exe, args, { detached: true, stdio: "ignore" }).unref();
  return exe;
}

function launchCanvasAddon() {
  const exe = launchCanvasTool(fs.existsSync(HANDOFF_FILE) ? HANDOFF_FILE : null);
  return { ok: Boolean(exe), launched: Boolean(exe), path: exe };
}

async function launchSuiteAddon(addonId) {
  const id = String(addonId || "canvas");
  if (id === "canvas") return launchCanvasAddon();
  if (id === "musicVideo") {
    const dir = musicVideoExportsDir();
    if (!fs.existsSync(dir)) {
      return {
        ok: false,
        launched: false,
        mode: "missing-export",
        path: null,
        error: "Create a Music Video handoff first",
      };
    }
    await openPathSafe(dir);
    return { ok: true, launched: false, mode: "exports-folder", path: dir };
  }
  const handoff =
    id === "musicVideo" && fs.existsSync(musicVideoHandoffFile())
      ? musicVideoHandoffFile()
      : null;
  const exe = launchAddonExecutable(id, handoff);
  if (exe) return { ok: true, launched: true, path: exe };
  return { ok: false, launched: false, path: null, error: `${id} is not installed` };
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
  return installSuiteAddon("canvas");
}

async function installSuiteAddon(addonId) {
  const id = String(addonId || "canvas");
  if (id === "musicVideo") {
    return openAddonInstallDocs(id, { mode: "docs" });
  }
  const status = suiteAddonStatus(id);
  if (status.installed) {
    return { ok: true, alreadyInstalled: true, path: status.path, mode: "installed" };
  }

  const localInstaller = findAddonInstaller(id);
  if (localInstaller) {
    await openPathSafe(localInstaller);
    return { ok: true, mode: "local-installer", path: localInstaller };
  }

  const meta = addonMeta(id);
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
        const dest = path.join(downloads, path.basename(asset.name) || `${id}-Setup.exe`);
        await httpsDownload(asset.url, dest);
        await openPathSafe(dest);
        return { ok: true, mode: "downloaded", path: dest };
      }
      return openAddonInstallDocs(id, {
        mode: "no-release-assets",
        message: "GitHub release has no installer assets yet",
      });
    } catch (err) {
      const code = String(err?.message || "");
      if (code.includes("404")) {
        return openAddonInstallDocs(id, {
          mode: "no-release",
          message: `No GitHub release published yet for ${meta?.title || id}`,
        });
      }
    }
  }

  return openAddonInstallDocs(id, { mode: "docs" });
}

async function openCanvasInstallDocs({ mode = "docs", message = "" } = {}) {
  return openAddonInstallDocs("canvas", { mode, message });
}

async function openAddonInstallDocs(addonId, { mode = "docs", message = "" } = {}) {
  const url = addonInstallFallbackUrl(addonId);
  await openExternalSafe(url);
  const title = addonMeta(addonId)?.title || addonId;
  return {
    ok: true,
    mode,
    url,
    message:
      message ||
      `Opened ${title} install instructions — follow the README or place an installer in Downloads`,
  };
}

/**
 * Write music-video handoff JSON and copied media under AI Suite exports.
 * @param {{ prompt?: string, bpm?: string, idea?: string, audioBuffer?: ArrayBuffer|Uint8Array|Buffer|null, audioExt?: string|null, coverBuffer?: ArrayBuffer|Uint8Array|Buffer|null, coverExt?: string|null }} payload
 * @param {{ dir?: string, openFolder?: boolean }} [options]
 */
async function exportMusicVideoHandoff(payload = {}, options = {}) {
  const dir = options.dir || musicVideoExportsDir();
  await fs.promises.mkdir(dir, { recursive: true });
  const handoffPath = options.dir
    ? path.join(dir, path.basename(musicVideoHandoffFile()))
    : musicVideoHandoffFile();
  let audioPath = null;
  let coverPath = null;

  if (payload.audioBuffer?.byteLength) {
    audioPath = path.join(dir, `track-audio.${sanitizeAudioExt(payload.audioExt)}`);
    await fs.promises.writeFile(audioPath, Buffer.from(payload.audioBuffer));
  }
  if (payload.coverBuffer?.byteLength) {
    coverPath = path.join(dir, `cover.${sanitizeArtworkExt(payload.coverExt)}`);
    await fs.promises.writeFile(coverPath, Buffer.from(payload.coverBuffer));
  }

  const handoff = {
    version: 1,
    timestamp: handoffTimestampIso(),
    source: "ai-music-tool",
    tool: "musicVideo",
    prompt: String(payload.prompt || ""),
    bpm: String(payload.bpm || ""),
    idea: String(payload.idea || ""),
    audioPath,
    coverPath,
    exportsDir: dir,
  };
  await fs.promises.writeFile(handoffPath, JSON.stringify(handoff, null, 2), "utf8");
  if (options.openFolder !== false) {
    try {
      await openPathSafe(dir);
    } catch {
      /* ignore */
    }
  }
  return {
    ok: true,
    mode: "handoff",
    path: handoffPath,
    exportsDir: dir,
    audioPath,
    coverPath,
    message: `Music video assets exported to ${dir} — upload them in Glitchframe`,
  };
}

async function writeArtworkExport(buffer, ext) {
  await ensureSuiteDirs();
  const cleanExt = sanitizeArtworkExt(ext);
  const artPath = path.join(EXPORTS_DIR, `album-art-${Date.now()}.${cleanExt}`);
  await fs.promises.writeFile(artPath, buffer);
  return artPath;
}

function sanitizeAudioExt(ext) {
  const raw = String(ext || "mp3")
    .trim()
    .replace(/^\.+/, "")
    .toLowerCase();
  if (raw.includes("/") || raw.includes("\\") || raw.includes("..")) return "mp3";
  if (raw === "wav") return "wav";
  if (raw === "m4a" || raw === "aac") return "m4a";
  if (raw === "flac") return "flac";
  if (raw === "ogg") return "ogg";
  return "mp3";
}

async function writeAudioExport(buffer, ext) {
  await ensureSuiteDirs();
  const cleanExt = sanitizeAudioExt(ext);
  const audioPath = path.join(EXPORTS_DIR, `track-audio-${Date.now()}.${cleanExt}`);
  await fs.promises.writeFile(audioPath, buffer);
  return audioPath;
}

/**
 * Write handoff.json and try to launch Canvas Tool.
 * @returns {{ exe: string | null, launched: boolean }}
 */
async function openInCanvasFromMusic({
  title,
  artist,
  albumArtPath,
  audioPath,
  motionHint,
  durationSec,
}) {
  await ensureSuiteDirs();
  const handoff = {
    version: 1,
    timestamp: handoffTimestampIso(),
    source: "ai-music-tool",
    track: {
      title,
      artist,
      albumArtPath,
      ...(audioPath ? { audioPath } : {}),
    },
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
  suiteAddonStatus,
  listSuiteAddonsStatus,
  launchCanvasAddon,
  launchSuiteAddon,
  installCanvasAddon,
  installSuiteAddon,
  launchCanvasTool,
  writeArtworkExport,
  writeAudioExport,
  openInCanvasFromMusic,
  exportMusicVideoHandoff,
};
