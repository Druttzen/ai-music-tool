import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
const { verifySignedArtifact, verifyStudioRelease, releaseChecksums } = createRequire(import.meta.url)("../scripts/verify-studio-release.cjs");

// Public interoperability vector from minisign-verify 0.2.5 (same verifier as Tauri).
const publicKey = Buffer.from("untrusted comment: test\nRWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3\n").toString("base64");
const signatureText = "untrusted comment: signature from minisign secret key\n" +
  "RUQf6LRCGA9i559r3g7V1qNyJDApGip8MfqcadIgT9CuhV3EMhHoN1mGTkUidF/z7SrlQgXdy8ofjb7bNJJylDOocrCo8KLzZwo=\n" +
  "trusted comment: timestamp:1633700835\tfile:test\tprehashed\n" +
  "wLMDjy9FLAuxZ3q4NlEvkgtyhrr0gtTu6KC4KBJdITbbOeAi1zBIYo0v4iTgt8jJpIidRJnp94ABQkJAgAooBQ==\n";
const signature = Buffer.from(signatureText).toString("base64");

function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "studio-release-"));
  const version = "0.50.67";
  const names = [
    `Studio_${version}_x64-setup.exe`, `Studio_${version}_aarch64.app.tar.gz`,
    `Studio_${version}_x64.app.tar.gz`, `Studio_${version}_amd64.AppImage`,
    `Studio_${version}_amd64.deb`, `Studio-${version}-1.x86_64.rpm`,
    `Studio_${version}_aarch64.dmg`, `Studio_${version}_x64.dmg`,
  ];
  const targets = ["windows-x86_64-nsis", "darwin-aarch64-app", "darwin-x86_64-app", "linux-x86_64-appimage", "linux-x86_64-deb", "linux-x86_64-rpm"];
  const assets = [];
  const platforms = {};
  names.forEach((name, i) => {
    const url = `https://github.com/Druttzen/ai-music-tool/releases/download/studio-v${version}/${name}`;
    assets.push({ name, id: i + 1, size: 4, browser_download_url: url });
    writeFileSync(path.join(directory, name), "test");
    if (targets[i]) {
      assets.push({ name: `${name}.sig`, id: i + 101, size: signature.length, browser_download_url: `${url}.sig` });
      writeFileSync(path.join(directory, `${name}.sig`), signature);
      platforms[targets[i]] = { signature, url: `https://api.github.com/repos/Druttzen/ai-music-tool/releases/assets/${i + 1}` };
    }
  });
  ["windows-x86_64", "darwin-aarch64", "darwin-x86_64", "linux-x86_64"].forEach((target, i) => {
    platforms[target] = { ...platforms[targets[i]] };
  });
  return { directory, version, assets, pubkey: publicKey, manifest: { version, platforms } };
}

describe("Studio release signature and platform gate", () => {
  it("publication retries exclude the previous manifest and checksum file", () => {
    const data = fixture();
    try {
      const assets = [...data.assets, { name: "latest.json", size: 0 }, { name: "SHA256SUMS.txt", size: 0 }];
      expect(releaseChecksums(assets, data.directory)).toHaveLength(data.assets.length);
      expect(releaseChecksums(assets, data.directory).join("\n")).not.toContain("SHA256SUMS.txt");
    } finally { rmSync(data.directory, { recursive: true }); }
  });
  it("verifies the Tauri Minisign interoperability vector", () => {
    expect(() => verifySignedArtifact(Buffer.from("test"), signature, publicKey)).not.toThrow();
  });
  it("rejects altered bytes, trusted comments, signatures and different keys", () => {
    expect(() => verifySignedArtifact(Buffer.from("other"), signature, publicKey)).toThrow(/verification failed/);
    const altered = Buffer.from(signatureText.replace("file:test", "file:other")).toString("base64");
    expect(() => verifySignedArtifact(Buffer.from("test"), altered, publicKey)).toThrow(/verification failed/);
    const wrong = Buffer.from(publicKey, "base64").toString().replace("RWQf", "RWQe");
    expect(() => verifySignedArtifact(Buffer.from("test"), signature, Buffer.from(wrong).toString("base64"))).toThrow(/does not match/);
    expect(() => verifySignedArtifact(Buffer.from("test"), "bad", publicKey)).toThrow(/format/);
  });
  it("rejects legacy non-prehashed signatures", () => {
    const lines = signatureText.split("\n");
    const raw = Buffer.from(lines[1], "base64");
    raw[1] = 0x64;
    lines[1] = raw.toString("base64");
    expect(() => verifySignedArtifact(Buffer.from("test"), Buffer.from(lines.join("\n")).toString("base64"), publicKey)).toThrow(/format/);
  });
  it("also verifies a new Ed25519 key pair without the fixture key", () => {
    const { publicKey: key, privateKey } = crypto.generateKeyPairSync("ed25519");
    const id = crypto.randomBytes(8);
    const bytes = Buffer.from("new release");
    const signed = crypto.sign(null, crypto.createHash("blake2b512").update(bytes).digest(), privateKey);
    const comment = "version:0.50.67";
    const global = crypto.sign(null, Buffer.concat([signed, Buffer.from(comment)]), privateKey);
    const pub = Buffer.from(`untrusted comment: key\n${Buffer.concat([Buffer.from("Ed"), id, key.export({ type: "spki", format: "der" }).subarray(-32)]).toString("base64")}\n`).toString("base64");
    const sig = Buffer.from(`untrusted comment: signature\n${Buffer.concat([Buffer.from("ED"), id, signed]).toString("base64")}\ntrusted comment: ${comment}\n${global.toString("base64")}\n`).toString("base64");
    expect(() => verifySignedArtifact(bytes, sig, pub)).not.toThrow();
  });
  it("requires every signed platform and converts API asset URLs to public downloads", () => {
    const data = fixture();
    try {
      expect(verifyStudioRelease(data)).toHaveLength(6);
      expect(data.manifest.platforms["windows-x86_64"].url).toMatch(/^https:\/\/github.com\//);
      delete data.manifest.platforms["darwin-x86_64-app"];
      expect(() => verifyStudioRelease(data)).toThrow(/Missing signed updater target/);
    } finally { rmSync(data.directory, { recursive: true }); }
  });
  it("rejects incomplete, corrupt, mismatched or foreign-release assets", () => {
    const data = fixture();
    try {
      expect(() => verifyStudioRelease({ ...data, version: "0.50.68" })).toThrow(/version/);
      const intel = data.manifest.platforms["darwin-x86_64-app"];
      const intelUrl = intel.url;
      intel.url = data.manifest.platforms["darwin-aarch64-app"].url;
      expect(() => verifyStudioRelease(data)).toThrow(/Incorrect installer format/);
      intel.url = intelUrl;
      const target = data.manifest.platforms["windows-x86_64-nsis"];
      const original = target.url;
      target.url = "https://example.com/installer.exe";
      expect(() => verifyStudioRelease(data)).toThrow(/Invalid updater asset/);
      target.url = original;
      expect(() => verifyStudioRelease({ ...data, assets: data.assets.filter(asset => !asset.name.endsWith(".sig")) })).toThrow(/Missing signature file/);
      writeFileSync(path.join(data.directory, data.assets[0].name), "bad");
      expect(() => verifyStudioRelease(data)).toThrow(/Truncated/);
    } finally { rmSync(data.directory, { recursive: true }); }
  });
});
