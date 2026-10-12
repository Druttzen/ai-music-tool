#!/usr/bin/env node
// Release gate only. The installed app delegates signature verification to Tauri.
// Minisign ED format: BLAKE2b-512 + Ed25519, including the trusted comment.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const REQUIRED_TARGETS = [
  "windows-x86_64-nsis", "darwin-aarch64-app", "darwin-x86_64-app",
  "linux-x86_64-appimage", "linux-x86_64-deb", "linux-x86_64-rpm",
];
const REQUIRED_INSTALLERS = [/x64-setup\.exe$/, /aarch64\.dmg$/, /x64\.dmg$/,
  /amd64\.AppImage$/, /amd64\.deb$/, /x86_64\.rpm$/];

function verifySignedArtifact(bytes, signature, encodedPublicKey) {
  const publicLines = Buffer.from(encodedPublicKey, "base64").toString("utf8").trim().split(/\r?\n/);
  const publicBytes = Buffer.from(publicLines[1] || "", "base64");
  const lines = Buffer.from(signature, "base64").toString("utf8").trim().split(/\r?\n/);
  const signed = Buffer.from(lines[1] || "", "base64");
  const globalSignature = Buffer.from(lines[3] || "", "base64");
  if (publicBytes.length !== 42 || publicBytes.subarray(0, 2).toString() !== "Ed" ||
      signed.length !== 74 || signed.subarray(0, 2).toString() !== "ED" ||
      globalSignature.length !== 64 || !lines[2]?.startsWith("trusted comment: ")) {
    throw new Error("Invalid updater public key or Minisign signature format");
  }
  if (!publicBytes.subarray(2, 10).equals(signed.subarray(2, 10))) {
    throw new Error("Updater signing key does not match the app public key");
  }
  const publicKey = crypto.createPublicKey({
    key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), publicBytes.subarray(10)]),
    type: "spki", format: "der",
  });
  const hash = crypto.createHash("blake2b512").update(bytes).digest();
  const trusted = Buffer.concat([signed.subarray(10), Buffer.from(lines[2].slice(17))]);
  if (!crypto.verify(null, hash, publicKey, signed.subarray(10)) ||
      !crypto.verify(null, trusted, publicKey, globalSignature)) {
    throw new Error("Updater signature verification failed");
  }
}

function verifyStudioRelease({ manifest, assets, directory, version, pubkey, release, repo = "Druttzen/ai-music-tool" }) {
  if (manifest.version !== version) throw new Error("Updater feed version differs from the source version");
  const tag = `studio-v${version}`;
  const tagPage = `https://github.com/${repo}/releases/tag/`;
  const downloadBase = `https://github.com/${repo}/releases/download/`;
  let draftTag = null;
  if (release) {
    if (!Number.isSafeInteger(release.id) || release.id <= 0 || release.tag_name !== tag ||
        release.url !== `https://api.github.com/repos/${repo}/releases/${release.id}` ||
        typeof release.draft !== "boolean") {
      throw new Error("Release metadata does not match the source version or repository");
    }
    const temporaryTag = release.draft && release.html_url?.startsWith(tagPage)
      ? release.html_url.slice(tagPage.length) : "";
    if (/^untagged-[a-f0-9]+$/.test(temporaryTag)) draftTag = temporaryTag;
    if (release.html_url !== `${tagPage}${tag}` && !draftTag) {
      throw new Error("Release metadata contains an invalid release page");
    }
  }
  const downloads = new Map();
  const ids = new Map();
  for (const asset of assets) {
    if (path.basename(asset.name) !== asset.name || /[\r\n]/.test(asset.name)) throw new Error("Invalid asset name");
    const apiUrl = `https://api.github.com/repos/${repo}/releases/assets/${asset.id}`;
    if (!Number.isSafeInteger(asset.id) || asset.id <= 0 ||
        ((release || asset.url) && asset.url !== apiUrl)) {
      throw new Error(`Invalid release asset ID or API URL: ${asset.name}`);
    }
    const url = asset.browser_download_url || asset.url;
    const publicUrl = `${downloadBase}${tag}/${encodeURIComponent(asset.name)}`;
    const allowed = [publicUrl, `${downloadBase}${tag}/${asset.name}`];
    if (draftTag) allowed.push(`${downloadBase}${draftTag}/${encodeURIComponent(asset.name)}`, `${downloadBase}${draftTag}/${asset.name}`);
    if (!allowed.includes(url)) {
      throw new Error(`Asset belongs to another release: ${asset.name}`);
    }
    downloads.set(url, asset);
    // A retry may already have replaced manifest URLs before publishing the draft.
    downloads.set(publicUrl, asset);
    downloads.set(`${downloadBase}${tag}/${asset.name}`, asset);
    ids.set(apiUrl, asset);
  }
  for (const pattern of REQUIRED_INSTALLERS) {
    if (!assets.some(asset => pattern.test(asset.name))) throw new Error(`Missing installer: ${pattern}`);
  }
  for (const target of REQUIRED_TARGETS) {
    if (!manifest.platforms?.[target]?.signature || !manifest.platforms[target].url) {
      throw new Error(`Missing signed updater target: ${target}`);
    }
  }
  const verified = new Set();
  for (const [target, entry] of Object.entries(manifest.platforms)) {
    const asset = downloads.get(entry.url) || ids.get(entry.url);
    if (!asset || !asset.name.includes(version)) throw new Error(`Invalid updater asset URL: ${target}`);
    const expectedExtension = target.startsWith("windows-") ? "_x64-setup.exe" :
      target.startsWith("darwin-aarch64") ? "_aarch64.app.tar.gz" :
      target.startsWith("darwin-x86_64") ? "_x64.app.tar.gz" :
      target.endsWith("-deb") ? "_amd64.deb" : target.endsWith("-rpm") ? ".x86_64.rpm" : "_amd64.AppImage";
    if (!asset.name.endsWith(expectedExtension)) throw new Error(`Incorrect installer format: ${target}`);
    const signatureAsset = assets.find(item => item.name === `${asset.name}.sig`);
    if (!signatureAsset) throw new Error(`Missing signature file: ${asset.name}`);
    const signature = fs.readFileSync(path.join(directory, signatureAsset.name), "utf8").trim();
    if (signature !== entry.signature.trim()) throw new Error(`Signature differs from updater feed: ${target}`);
    if (!verified.has(asset.name)) {
      const bytes = fs.readFileSync(path.join(directory, asset.name));
      if (bytes.length !== asset.size) throw new Error(`Truncated updater artifact: ${asset.name}`);
      verifySignedArtifact(bytes, signature, pubkey);
      verified.add(asset.name);
    }
    // Public download URLs work without a GitHub API token or API rate limit.
    // Draft browser URLs use a temporary untagged-* name that disappears on
    // publication. Feed URLs must point at the final, validated source tag.
    entry.url = `${downloadBase}${tag}/${encodeURIComponent(asset.name)}`;
  }
  for (const target of ["windows-x86_64", "darwin-aarch64", "darwin-x86_64", "linux-x86_64"]) {
    if (!manifest.platforms[target]) throw new Error(`Missing fallback updater target: ${target}`);
  }
  return [...verified];
}

function releaseChecksums(assets, directory) {
  // A publication retry may already have uploaded these generated files.
  // Never put a checksum for SHA256SUMS itself into its own replacement.
  return assets.filter(asset => !["latest.json", "SHA256SUMS.txt"].includes(asset.name)).map(asset => {
    const bytes = fs.readFileSync(path.join(directory, asset.name));
    if (bytes.length !== asset.size) throw new Error(`Truncated release asset: ${asset.name}`);
    return `${crypto.createHash("sha256").update(bytes).digest("hex")}  ${asset.name}`;
  });
}

if (require.main === module) {
  try {
    const directory = path.resolve(process.argv[2] || "release-assets");
    const root = path.resolve(__dirname, "..");
    const config = JSON.parse(fs.readFileSync(path.join(root, "src-tauri/tauri.conf.json"), "utf8"));
    const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
    const manifestPath = path.join(directory, "latest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const release = JSON.parse(fs.readFileSync(path.join(directory, "release.json"), "utf8"));
    const verified = verifyStudioRelease({ manifest, assets: release.assets, directory, version, pubkey: config.plugins.updater.pubkey, release });
    const checksums = releaseChecksums(release.assets, directory);
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    checksums.push(`${crypto.createHash("sha256").update(fs.readFileSync(manifestPath)).digest("hex")}  latest.json`);
    fs.writeFileSync(path.join(directory, "SHA256SUMS.txt"), `${checksums.join("\n")}\n`);
    console.log(`Verified ${verified.length} signed updater packages for Studio ${version}; all platforms present.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { verifySignedArtifact, verifyStudioRelease, releaseChecksums };
